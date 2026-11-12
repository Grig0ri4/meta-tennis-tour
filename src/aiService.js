/**
 * Meta Tennis Tour — Модуль работы со сверхбыстрым Groq API (src/aiService.js)
 * Эндпоинт: https://api.groq.com/openai/v1/chat/completions
 * Модели (СТРОГО в нижнем регистре): 'openai/gpt-oss-120b' (по умолчанию) или 'openai/gpt-oss-20b'.
 * Очистка ответа от Markdown (```json ... ```) перед JSON.parse().
 * Поддерживает два сценария в Матч-центре:
 *  - Сценарий А: ИИ-комментарий к введенному пользователем счету (generateCommentaryForEnteredScore)
 *  - Сценарий Б: Полная ИИ-симуляция матча через Groq с запретом шаблонов 6-3 6-2 / 3-6 2-6, 45% 3-сетовых триллеров и 20% апсетов (simulateMatchWithGroq)
 */

import {
  computeSimMatchScores,
  parseAndValidateScoreString,
  flipTennisScoreSets,
  sanitizeTemplateScore,
  generateMatchNarrative,
  generateMatchQuotes,
  parseStageType
} from './matchEngine.js';
import { NEWGEN_NICKNAMES, NEWGEN_PLAY_STYLES } from './retirementEngine.js';

export const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
export const FAST_GROQ_MODEL = 'openai/gpt-oss-20b';

// Дефолтный ключ берется из локального .env.local (VITE_GROQ_API_KEY), который не попадает в публичный Git
export const DEFAULT_GROQ_API_KEY = (() => {
  try {
    const envKey = (import.meta?.env?.VITE_GROQ_API_KEY || '').trim();
    if (envKey && envKey !== 'YOUR_GROQ_API_KEY') return envKey;
  } catch {
    // ignore
  }
  return '';
})();

const GROQ_KEY_STORAGE = 'groq_api_key';
const LEGACY_GROQ_KEY_STORAGE = 'meta_groq_api_key_v1';
const GROQ_MODEL_STORAGE = 'meta_groq_model_v1';

/**
 * Принудительно приводит имя модели к нижнему регистру и валидирует допустимые имена Groq API.
 * Запрещает заглавные буквы вроде 'GPT-OSS-120B'.
 */
export function normalizeGroqModelName(modelId) {
  const clean = String(modelId || DEFAULT_GROQ_MODEL).trim().toLowerCase();
  const isFast = clean === FAST_GROQ_MODEL || clean === 'gpt-oss-20b' || clean.endsWith('/gpt-oss-20b');
  if (isFast || clean.includes('8b')) {
    return FAST_GROQ_MODEL;
  }
  return DEFAULT_GROQ_MODEL;
}

/**
 * Очищает сырой ответ модели от Markdown-оберток ```json ... ``` перед вызовом JSON.parse()
 */
export function cleanGroqJsonString(rawContent) {
  const stripped = String(rawContent || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1).trim();
  }
  return stripped;
}

/**
 * Формирует честный заголовок источника репортажа в зависимости от сработавшей модели
 */
export function getGroqSourceHeaderLabel(modelId = DEFAULT_GROQ_MODEL) {
  const norm = normalizeGroqModelName(modelId);
  if (norm === FAST_GROQ_MODEL) {
    return 'ИИ-репортаж (Groq / GPT-OSS 20B)';
  }
  return 'ИИ-репортаж (Groq / GPT-OSS 120B)';
}

/**
 * Чтение Groq API Key из localStorage.getItem('groq_api_key'), переменной окружения или дефолтного ключа
 */
export function getGroqApiKey(storage = null) {
  const customStore = storage !== null;
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      const primaryKey = store.getItem(GROQ_KEY_STORAGE);
      if (primaryKey !== null && primaryKey.trim() !== '') {
        return primaryKey.trim();
      }
      const legacyKey = store.getItem(LEGACY_GROQ_KEY_STORAGE);
      if (legacyKey !== null && legacyKey.trim() !== '') {
        return legacyKey.trim();
      }
      if (customStore && (primaryKey === '' || legacyKey === '')) {
        return '';
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    const envKey = (import.meta?.env?.VITE_GROQ_API_KEY || '').trim();
    if (envKey && envKey !== 'YOUR_GROQ_API_KEY') return envKey;
  } catch {
    // ignore env access
  }

  return DEFAULT_GROQ_API_KEY;
}

export function setGroqApiKey(apiKey, storage = null) {
  const cleanKey = String(apiKey || '').trim();
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(GROQ_KEY_STORAGE, cleanKey);
      store.setItem(LEGACY_GROQ_KEY_STORAGE, cleanKey);
    }
  } catch {
    // ignore storage errors
  }
  return cleanKey;
}

export function hasGroqApiKey(storage = null) {
  return Boolean(getGroqApiKey(storage));
}

export function getGroqModel(storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      const saved = store.getItem(GROQ_MODEL_STORAGE);
      if (saved) {
        return normalizeGroqModelName(saved);
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_GROQ_MODEL;
}

export function setGroqModel(modelId, storage = null) {
  const validModel = normalizeGroqModelName(modelId);
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (store) {
      store.setItem(GROQ_MODEL_STORAGE, validModel);
    }
  } catch {
    // ignore
  }
  return validModel;
}

/**
 * Базовый JSON-вызов к Groq API (https://api.groq.com/openai/v1/chat/completions)
 * Не скрывает ошибки: выбрасывает Error с подробным сообщением от Groq API.
 */
export async function requestGroqJson(systemPrompt, userPrompt, options = {}) {
  const apiKey = options.apiKey !== undefined ? String(options.apiKey).trim() : getGroqApiKey(options.storage);
  if (!apiKey) {
    throw new Error('Ключ Groq API не задан! Укажите ключ в окне «⚙️ Настройки API».');
  }

  const model = normalizeGroqModelName(options.model || getGroqModel(options.storage));
  const fetchImpl = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) {
    throw new Error('Fetch API недоступен в текущем окружении.');
  }

  const timeoutMs = options.timeoutMs ?? 30000;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timerId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const buildFetchOptions = (targetModel) => {
      const opts = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: targetModel,
          temperature: options.temperature ?? 0.85,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      };
      if (controller && !options.fetchImpl) {
        opts.signal = controller.signal;
      }
      return opts;
    };

    let response = await fetchImpl(GROQ_API_ENDPOINT, buildFetchOptions(model));

    // Если кластер Groq вернул 404 для модели, пробуем резервную быструю модель FAST_GROQ_MODEL
    if (response.status === 404 && !options.disableModelFallback && model !== FAST_GROQ_MODEL) {
      response = await fetchImpl(GROQ_API_ENDPOINT, buildFetchOptions(FAST_GROQ_MODEL));
    }

    if (!response.ok) {
      let errDetail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errDetail = `${errDetail}: ${errJson.error.message}`;
        }
      } catch {
        try {
          const errText = await response.text();
          if (errText) errDetail = `${errDetail}: ${errText.slice(0, 180)}`;
        } catch {
          // ignore
        }
      }
      throw new Error(`Ошибка Groq API (${errDetail})`);
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Groq API вернул пустой ответ (choices[0].message.content пуст).');
    }

    const cleanedContent = cleanGroqJsonString(rawContent);
    try {
      return JSON.parse(cleanedContent);
    } catch (parseErr) {
      throw new Error(`Ошибка парсинга JSON от Groq: ${parseErr.message}`);
    }
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

/**
 * Извлекает количество сыгранных очных встреч из строки h2hSummary (например "Max Kyupan 3 : 2 Will Wentra")
 */
function parseH2HMatchesCount(h2hSummary = '', h2hTotalMatches = 0) {
  if (typeof h2hTotalMatches === 'number' && h2hTotalMatches > 0) return h2hTotalMatches;
  const m = String(h2hSummary || '').match(/(\d+)\s*:\s*(\d+)/);
  if (!m) return 0;
  return (parseInt(m[1], 10) || 0) + (parseInt(m[2], 10) || 0);
}

/**
 * Формирует гибкий, реалистичный контекст для генерации спортивного репортажа и цитат игроков.
 * Исключает заезженные штампы, ориентируя модель на аутентичную лексику пресс-конференций ATP.
 */
export function buildMatchPromptContext({
  stage = 'Матч',
  tourneyName = 'Турнир ATP',
  surface = 'Хард',
  winner = null,
  loser = null,
  player1 = null,
  player2 = null,
  isRivalry = false,
  totalH2H = 0,
  h2hSummary = '0 : 0',
  isRetirement = false
} = {}) {
  const { isFinalStage, isSemiStage } = parseStageType(stage);

  const pWinnerName = (winner || player1)?.name || 'Победитель';
  const pLoserName = (loser || player2)?.name || 'Проигравший';

  // 1. Динамическая тональность в зависимости от турнирного значения
  let stageToneInstruction = '';
  if (isFinalStage) {
    stageToneInstruction = `
КОНТЕКСТ СТАДИИ — ФИНАЛ «${tourneyName}»:
- Последний матч недели. У обоих накопленная усталость, поэтому речь должна быть суше и точнее обычного.
- Победитель (${pWinnerName}) говорит о титуле через конкретику: что держало игру, где просел, чем рискнул на приёме или подаче. Одной фразой — о самом титуле, без благодарностей команде и пафоса «исторического дня».
- Проигравший (${pLoserName}) берёт ответственность на себя и называет конкретный элемент, который развалился в решающий момент. Без фраз «не повезло» и «сегодня был не мой день».
- Тон: усталость, самокритика, профессиональная злость. Не больше одной сдержанной эмоции на цитату.`;
  } else if (isSemiStage) {
    stageToneInstruction = `
КОНТЕКСТ СТАДИИ — ПОЛУФИНАЛ:
- Матч за выход в финал. Победитель уже думает о восстановлении и следующем сопернике, но обязан признать, где полуфинал получился грязным.
- Проигравший злится на конкретный провал (приём, вторая подача, игра под давлением), а не на судьбу.
- Тон: короткие деловые фразы, раздражение собственным уровнем, без поздравлений и дежурного уважения.`;
  } else {
    stageToneInstruction = `
КОНТЕКСТ СТАДИИ (${stage}):
- Рядовой матч сетки. Игроки говорят о скорости покрытия «${surface}», ритме подачи и приёма, адаптации к корту; допустимо раздражение графиком и собственным уровнем.
- Тон: рабочий и сухой, без пафоса и без преувеличения значимости матча.`;
  }

  // 2. Реалистичный фактор соперничества (Rivalry)
  let rivalryInstruction = '';
  if (isRivalry) {
    rivalryInstruction = `
ФАКТОР ЛИЧНЫХ ВСТРЕЧ (H2H ${h2hSummary}, матчей: ${totalH2H}):
- Используй только сам счёт H2H. Запрещено придумывать прошлые матчи, турниры, счёт по сетам и «излюбленные точки подачи».
- Победитель может холодно отметить, что счёт личных встреч не отражает лёгкости матча, или что соперник снова дал ему тяжёлый матч.
- Проигравший признаёт, что соперник опять оказался неудобен, но формулирует это через игру, а не через унижение.
- Дозированная колкость разрешена; мат, угрозы и обесценивание соперника запрещены. Не цитируй формулировки из этого промпта дословно.`;
  } else {
    rivalryInstruction = `
ИСТОРИЯ ВСТРЕЧ (H2H ${h2hSummary}):
- Нейтральное уважение без дежурных комплиментов. Разбор тактики важнее оценки характера.`;
  }

  // 3. Жёсткие редакторские и фактические ограничения
  const antiClichéDirective = `
ЖЁСТКИЕ РЕДАКТОРСКИЕ ПРАВИЛА:
1. Запрещённые формулировки и штампы: «нащупал баланс», «вырвал победу», «волевая победа», «на классе», «перевернул игру», «психологическая устойчивость», «не удалось навязать свой теннис», «сегодня был не мой день», «отдал все силы», «теннис высочайшего уровня», «стальные нервы», «драма», «триллер», «эпический», «болельщики увидели», «спасибо команде», «работаем дальше», «главное — победа», «нашёл ритм», «поймал игру», «вошёл в матч», «держал концентрацию», «использовал свои шансы», «сыграл на опыте», «переломил ход».
2. Никаких ярлыков вместо анализа: не называй матч «триллером», «драмой» или «разгромом» — покажи это счётом, тай-брейком, брейком, потерей подачи.
3. Не пересказывай счёт сет за сетом. Запрещена хроника «уступил первый сет — затем выиграл второй — закрепил в третьем». Сначала назови главную теннисную причину исхода, затем подтверди её одной-двумя цифрами счёта.
4. Каждое предложение цепляется к факту: сет и его счёт, тай-брейк, брейк, покрытие, стадия, H2H, конкретный тактический элемент (приём, позиция на задней линии, вторая подача, укороченный).
5. Пиши для тех, кто смотрел матч: без объяснения очевидного и без пересказа счёта словами.
6. Разрешена жёсткая, неудобная правда: недовольство собой, покрытием, графиком, уровнем игры. Запрещены только унижение соперника, мат и выдуманные факты.
7. Назови счёт один раз, дальше используй только отдельные цифры (тай-брейк, счёт сета), которые подтверждают мысль. Запрещено повторять полный счёт второй раз и пересказывать его словами. Сводка и две цитаты не должны дублировать одну мысль.
8. Имена пиши строго латиницей в исходной форме: Max Kyupan, Soren Dahl. Запрещены русские падежные формы и транслитерация («Даля», «Кюпана», «Макс Кюпан»). Если нужен падеж — используй «соперник» или повторяй имя в именительном падеже.
9. Пиши простыми законченными предложениями. Избегай деепричастных оборотов и конструкций, где путается согласование. Используй точные теннисные формулировки: «взял подачу», «отдал подачу», «удержал подачу», «сделал обратный брейк», «выиграл тай-брейк 7:5». Запрещены «разорвал сервис», «пропустил сервис» и подобные конструкции.
10. Без медицинских деталей, если матч не закончился отказом.
11. Представь, что редактор вырежет всё, что можно сказать о любом матче. В тексте должны остаться только детали этого счёта, покрытия и стадии.
12. Перед возвратом результата проверь каждое предложение по списку запретов из правила 1 и по фактическому протоколу. Если фраза из списка встретилась — перепиши предложение, а не оставляй как есть.

ФАКТИЧЕСКИЙ ПРОТОКОЛ:
- Использовать только данные контекста: имена, ранги, возраст, покрытие, стадия, H2H и счёт по сетам.
- Разрешено описывать тактический рисунок в общих терминах (глубина приёма, позиция на задней линии, давление на вторую подачу), если он не противоречит счёту и покрытию.
- Запрещено называть конкретные номера геймов, статистику и эпизоды, которых нет в данных: эйсы, двойные ошибки, проценты первой подачи, брейк-пойнты, время матча, погоду, зрителей, судейские решения, тайм-ауты, счёт прошлых матчей.
- Используй только реальные теннисные термины: подача, приём, удар справа и слева, укороченный, свеча, смэш, выход к сетке, игра на задней линии. Не изобретай «скользящие удары» и подобные конструкции.
- Счёт неприкосновенен: 7-6 означает тай-брейк; 6-0/6-1 — разгромный сет; если победитель отдал первый сет — это отыгранный матч; если сыграно два сета — никаких «пятого сета» и «спасённых матчболов».
- Не упоминай спасённые матчболы, сетболы, брейк-пойнты и медицинские проблемы, если их нет во входных данных.
- Запрещено приписывать травмы, судороги и физические проблемы, если в данных нет RET.
${isRetirement ? '- Матч завершён отказом (RET): победитель коротко желает восстановления, снявшийся игрок называет медицинскую причину без подробностей.' : ''}`;

  return {
    isFinalStage,
    isSemiStage,
    stageToneInstruction: stageToneInstruction.trim(),
    rivalryInstruction: rivalryInstruction.trim(),
    antiClichéDirective: antiClichéDirective.trim()
  };
}

/**
 * СЦЕНАРИЙ А: Пользователь сам ввел счет руками -> Groq пишет репортаж и цитаты под конкретный счет!
 * Анализирует введенный счет (например, 7-6(5) 1-6 7-6(8) или 6-0 6-1), победителя, покрытие и H2H.
 */
export async function generateCommentaryForEnteredScore({
  match,
  p1,
  p2,
  enteredScore = '',
  scoreStr = '',
  tourneyName = 'Турнир ATP',
  surface = 'Хард',
  bestOf = 3,
  stage = 'Матч',
  h2hSummary = '0 : 0',
  h2hTotalMatches = 0,
  isRivalry: explicitRivalry,
  options = {}
}) {
  const player1 = p1 || match?.p1;
  const player2 = p2 || match?.p2;
  const strictGroq = Boolean(options.strictGroq);
  const totalH2H = parseH2HMatchesCount(h2hSummary, h2hTotalMatches);
  const isRivalry = explicitRivalry !== undefined ? Boolean(explicitRivalry) : totalH2H >= 2;

  if (!player1 || !player2) {
    throw new Error('Участники матча не определены.');
  }

  const rawScoreInput = String(enteredScore || scoreStr || '').trim();
  const validation = parseAndValidateScoreString(rawScoreInput, bestOf);
  if (!validation.valid) {
    throw new Error(validation.error || 'Введите корректный счет матча перед генерацией ИИ-комментария.');
  }

  const winner = validation.p1WinsMatch ? player1 : player2;
  const loser = validation.p1WinsMatch ? player2 : player1;
  const finalScoreStr = validation.sets.join(' ');
  const activeModel = normalizeGroqModelName(options.model || getGroqModel(options.storage));

  const fallbackStoryline = generateMatchNarrative(winner, loser, validation.sets, surface, tourneyName, stage);
  const fallbackQuotes = generateMatchQuotes(winner, loser, validation.sets, surface, tourneyName, stage);

  const isRetirement = validation.sets.includes('RET') || Boolean(validation.isRetirement);
  const { stageToneInstruction, rivalryInstruction, antiClichéDirective } = buildMatchPromptContext({
    stage,
    tourneyName,
    surface,
    winner,
    loser,
    player1,
    player2,
    isRivalry,
    totalH2H,
    h2hSummary,
    isRetirement
  });

  try {
    const matchContext = [
      `Турнир: ${tourneyName} (Стадия: ${stage})`,
      `Покрытие корта: ${surface}`,
      `Формат матча: best-of-${bestOf}`,
      `Игрок 1: ${player1.name} (${player1.flag || 'ATP'}, ранг #${player1.rank || 50}, возраст ${player1.age || '24 г.'})`,
      `Игрок 2: ${player2.name} (${player2.flag || 'ATP'}, ранг #${player2.rank || 50}, возраст ${player2.age || '24 г.'})`,
      `История очных встреч (H2H): ${h2hSummary} (isRivalry: ${isRivalry})`,
      `ИТОГОВЫЙ СЧЕТ МАТЧА (со стороны Игрока 1 к Игроку 2): ${finalScoreStr}`,
      `ПОБЕДИТЕЛЬ МАТЧА: ${winner.name} (${winner.flag || 'ATP'}, ранг #${winner.rank || 50})`,
      `ПРОИГРАВШИЙ: ${loser.name} (${loser.flag || 'ATP'}, ранг #${loser.rank || 50})`
    ].join('\n');

    const systemPrompt = [
      'Ты — послематчевый корреспондент ATP Tour. Пишешь жёсткую, точную заметку для новостной ленты и цитаты для пресс-конференции. Твой текст должен выдерживать редактуру: ни одного общего слова, ни одного выдуманного числа.',
      'Пользователь зафиксировал точный счёт. Разбери именно его: кто и когда терял подачу, где решался сет, как счёт отражает характер матча (тай-брейк, разгромный сет, отыгранная партия). Не придумывай события, которых не следует из счёта.',
      'Не смягчай оценки и не хвали игроков без причины. Победитель может быть недоволен своим уровнем, проигравший — раздражён и конкретен.',
      'Цитаты должны звучать как расшифровка с диктофона: живая речь, короткие фразы, профессиональная лексика. Канцелярит и пресс-релизный тон запрещены.',
      'Редактор вырежет всё, что подходит к любому матчу. В тексте должны остаться только детали этого счёта, покрытия и стадии.',
      stageToneInstruction,
      rivalryInstruction,
      antiClichéDirective,
      'Сформулируй storyline как сухую послематчевую сводку (2-3 предложения): главная теннисная причина исхода плюс одна-две цифры счёта. Без хроники по сетам. В цитатах — по 2-3 предложения каждому игроку, с конкретикой и без повторов сводки.',
      'Верни СТРОГО валидный JSON-объект на русском языке без markdown-оберток:',
      '{',
      '  "storyline": "Сводка на 2-3 предложения: причина исхода и 1-2 цифры счёта, без пересказа сет за сетом",',
      '  "winnerQuote": "Прямая речь победителя: 2-3 предложения, конкретика, допустима самокритика",',
      '  "loserQuote": "Прямая речь проигравшего: 2-3 предложения, ответственность и конкретный провал"',
      '}'
    ].join('\n');

    const userPrompt = [
      matchContext,
      stageToneInstruction,
      rivalryInstruction,
      antiClichéDirective,
      `Разбери счёт "${finalScoreStr}" (победил ${winner.name}) на стадии "${stage}" без домыслов и напиши редакторски жёсткую сводку и две живые цитаты.`
    ].join('\n');

    const parsed = await requestGroqJson(systemPrompt, userPrompt, { ...options, model: activeModel });

    return {
      winnerId: winner.id,
      winner,
      loser,
      score: finalScoreStr,
      sets: validation.sets,
      storyline: String(parsed?.storyline || fallbackStoryline).trim(),
      winnerQuote: String(parsed?.winnerQuote || fallbackQuotes.winnerQuote).trim(),
      loserQuote: String(parsed?.loserQuote || fallbackQuotes.loserQuote).trim(),
      source: 'groq',
      model: activeModel,
      sourceLabel: getGroqSourceHeaderLabel(activeModel)
    };
  } catch (err) {
    if (strictGroq) {
      throw err;
    }
    return {
      winnerId: winner.id,
      winner,
      loser,
      score: finalScoreStr,
      sets: validation.sets,
      storyline: fallbackStoryline,
      winnerQuote: fallbackQuotes.winnerQuote,
      loserQuote: fallbackQuotes.loserQuote,
      source: 'local-engine',
      sourceLabel: 'ИИ-репортаж (Авто-движок)'
    };
  }
}

/**
 * СЦЕНАРИЙ Б: Полная ИИ-симуляция матча через Groq ('openai/gpt-oss-120b')
 * ЖЕСТКИЕ ПРАВИЛА ПРОМПТА:
 * - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдавать шаблонные счета 6-3 6-2 / 3-6 2-6!
 * - В 45% матчей генерировать 3-сетовые триллеры (например: 4-6 7-6(5) 6-3, 7-5 3-6 6-4).
 * - Использовать упорные тайбрейки, баранки 6-0 и апсеты (20% побед аутсайдеров).
 * - Тональность цитат зависит от стадии турнира (1/32 и 1/16 — сдержанный рабочий тон; 1/2 и ФИНАЛ — максимальный накал страстей).
 */
export async function simulateMatchWithGroq({
  match,
  p1,
  p2,
  tourneyName = 'Турнир ATP',
  surface = 'Хард',
  bestOf = 3,
  stage = 'Матч',
  h2hSummary = '0 : 0',
  h2hTotalMatches = 0,
  isRivalry: explicitRivalry,
  options = {}
}) {
  const player1 = p1 || match?.p1;
  const player2 = p2 || match?.p2;
  const reqSets = bestOf === 5 ? 3 : 2;
  const strictGroq = Boolean(options.strictGroq);
  const totalH2H = parseH2HMatchesCount(h2hSummary, h2hTotalMatches);
  const isRivalry = explicitRivalry !== undefined ? Boolean(explicitRivalry) : totalH2H >= 2;

  const buildLocalFallback = () => {
    const sim = computeSimMatchScores(
      { p1: player1, p2: player2, stageLabel: stage },
      bestOf,
      0,
      surface,
      tourneyName,
      stage
    );
    return {
      winnerId: sim.winner.id,
      winner: sim.winner,
      score: sim.scores.join(' '),
      sets: sim.scores,
      storyline: sim.storyline || sim.narrative,
      winnerQuote: sim.winnerQuote,
      loserQuote: sim.loserQuote,
      source: 'local-engine',
      sourceLabel: 'ИИ-репортаж (Авто-движок)'
    };
  };

  if (!player1 || !player2) {
    if (strictGroq) {
      throw new Error('Участники матча не определены.');
    }
    return buildLocalFallback();
  }

  const activeModel = normalizeGroqModelName(options.model || getGroqModel(options.storage));

  // Генерируем вероятностные директивы для этого конкретного розыгрыша (45% 3-сетовый триллер, 20% апсет аутсайдера)
  const rollThriller = Math.random() < 0.45;
  const rollUpset = Math.random() < 0.20;
  const rollBagel = Math.random() < 0.18;

  const p1Rank = player1.rank || 50;
  const p2Rank = player2.rank || 50;
  const underdog = p1Rank > p2Rank ? player1 : player2;
  const favorite = p1Rank <= p2Rank ? player1 : player2;

  const { stageToneInstruction, rivalryInstruction, antiClichéDirective } = buildMatchPromptContext({
    stage,
    tourneyName,
    surface,
    player1,
    player2,
    isRivalry,
    totalH2H,
    h2hSummary,
    isRetirement: false
  });

  const scenarioDirective = [
    rollThriller
      ? `Директива длины матча (45% упорных матчей): Сделай этот матч затяжным ${bestOf === 5 ? '4-5-сетовым' : '3-сетовым'} с обменом партиями (например: "4-6 7-6(5) 6-3" или "7-5 3-6 6-4").`
      : `Директива длины матча: Матч может завершиться в ${bestOf === 5 ? '3-4' : '2'} сетах, но обязательно с интригой (например, тайбрейк "7-6(5) 6-4", "7-5 6-4" или сет с баранкой "6-0 6-4").`,
    rollUpset
      ? `Директива сенсации (20% апсет): В этом матче аутсайдер ${underdog.name} (ID="${underdog.id}", #${underdog.rank || 50}) обыгрывает фаворита ${favorite.name}.`
      : `Фаворит по рейтингу — ${favorite.name} (#${favorite.rank || 50}), но учитывай покрытие «${surface}» и H2H.`,
    rollBagel
      ? `В одной из партий один из игроков может оформить разгромный сет 6-0 или 6-1.`
      : `Используй разнообразные счета геймов: 7-6(5), 7-5, 6-4, 6-1, 6-0.`
  ].join(' ');

  try {
    const matchParamsBlock = [
      `Параметры матча:`,
      `- Турнир: ${tourneyName} (Стадия: ${stage})`,
      `- Покрытие: ${surface}`,
      `- Формат: best-of-${bestOf} (до ${reqSets} выигранных сетов)`,
      `- Игрок 1: ID="${player1.id}", ${player1.name} (ранг: #${player1.rank || 50}, возраст: ${player1.age || '24 г.'}, страна: ${player1.flag || 'ATP'})`,
      `- Игрок 2: ID="${player2.id}", ${player2.name} (ранг: #${player2.rank || 50}, возраст: ${player2.age || '24 г.'}, страна: ${player2.flag || 'ATP'})`,
      `- История личных встреч (H2H): ${h2hSummary} (isRivalry: ${isRivalry})`
    ].join('\n');

    const systemPrompt = [
      'Ты — ATP-аналитик, который моделирует матч и одновременно пишет к нему послематчевый материал для новостной ленты и пресс-конференции.',
      'Сначала выбери правдоподобный счёт, затем опиши его так, будто матч действительно состоялся. Счёт, сводка и цитаты не должны противоречить друг другу.',
      'Не смягчай оценки и не хвали игроков без причины. Победитель может быть недоволен своим уровнем, проигравший — раздражён и конкретен.',
      'Цитаты должны звучать как расшифровка с диктофона: живая речь, короткие фразы, профессиональная лексика. Канцелярит и пресс-релизный тон запрещены.',
      matchParamsBlock,
      `Формат матча: best-of-${bestOf} (для победы нужно выиграть ${reqSets} сета).`,
      'ЖЕСТКИЕ ПРАВИЛА ГЕНЕРАЦИИ СЧЕТА:',
      '1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдавать шаблонные счета "6-3 6-2", "3-6 2-6", "6-2 6-3" или "2-6 3-6"!',
      '2. В 45% матчей генерируй упорные трёхсетовые матчи (например: "4-6 7-6(5) 6-3", "7-5 3-6 6-4", "6-7(4) 6-4 7-6(8)").',
      '3. Используй упорные тайбрейки (например 7-6(5)), баранки 6-0 и апсеты (20% побед аутсайдеров).',
      '4. Счет (score) всегда записывается со стороны Игрока 1 к Игроку 2 через пробел.',
      '5. Если в сете тайбрейк (7-6 или 6-7), обязательно укажи очки проигравшего на тайбрейке в круглых скобках, например 7-6(5).',
      stageToneInstruction,
      rivalryInstruction,
      antiClichéDirective,
      scenarioDirective,
      'Верни СТРОГО валидный JSON-объект со следующими ключами на русском языке без комментариев и без markdown-оберток:',
      '{',
      '  "winnerId": "id_победителя",',
      '  "score": "4-6 7-6(5) 6-3",',
      '  "storyline": "Сводка на 2-3 предложения: причина исхода и 1-2 цифры счёта, без пересказа сет за сетом",',
      '  "winnerQuote": "Прямая речь победителя: 2-3 предложения, конкретика, допустима самокритика",',
      '  "loserQuote": "Прямая речь проигравшего: 2-3 предложения, ответственность и конкретный провал"',
      '}'
    ].join('\n');

    const userPrompt = [
      matchParamsBlock,
      stageToneInstruction,
      rivalryInstruction,
      antiClichéDirective,
      scenarioDirective,
      'Сгенерируй нешаблонный, физически возможный счёт (ЗАПРЕЩЕНЫ 6-3 6-2 и 3-6 2-6), затем жёсткую сводку и две живые цитаты, которые не противоречат этому счёту.'
    ].join('\n');

    const parsed = await requestGroqJson(systemPrompt, userPrompt, { ...options, model: activeModel });
    let validation = parseAndValidateScoreString(parsed?.score, bestOf);

    if (!validation.valid) {
      const rawWinnerId = String(parsed?.winnerId || '').trim();
      const declaresP2 = rawWinnerId === player2.id || rawWinnerId.toLowerCase().includes(String(player2.name || '').toLowerCase());
      const forcedSim = computeSimMatchScores(
        { p1: player1, p2: player2, stageLabel: stage },
        bestOf,
        declaresP2 ? 2 : 1,
        surface,
        tourneyName,
        stage
      );
      validation = parseAndValidateScoreString(forcedSim.scores.join(' '), bestOf);
    }

    const rawWinnerId = String(parsed?.winnerId || '').trim();
    const rawWinnerLower = rawWinnerId.toLowerCase();
    const p1NameLower = String(player1.name || '').toLowerCase();
    const p2NameLower = String(player2.name || '').toLowerCase();
    const declaresP2 =
      rawWinnerId === String(player2.id) ||
      (p2NameLower && rawWinnerLower.includes(p2NameLower));
    const declaresP1 =
      rawWinnerId === String(player1.id) ||
      (p1NameLower && rawWinnerLower.includes(p1NameLower));

    if (declaresP2 && validation.p1WinsMatch) {
      const flippedSets = flipTennisScoreSets(validation.sets);
      const reval = parseAndValidateScoreString(flippedSets.join(' '), bestOf);
      if (reval.valid) validation = reval;
    } else if (declaresP1 && !validation.p1WinsMatch) {
      const flippedSets = flipTennisScoreSets(validation.sets);
      const reval = parseAndValidateScoreString(flippedSets.join(' '), bestOf);
      if (reval.valid) validation = reval;
    }

    // Гарантируем отсутствие запрещенных шаблонов 6-3 6-2 / 3-6 2-6
    const sanitizedSets = sanitizeTemplateScore(validation.sets, validation.p1WinsMatch, bestOf);
    validation.sets = sanitizedSets;

    const actualWinner = validation.p1WinsMatch ? player1 : player2;
    const actualLoser = validation.p1WinsMatch ? player2 : player1;
    const fallbackQuotes = computeSimMatchScores(
      { p1: player1, p2: player2, stageLabel: stage },
      bestOf,
      validation.p1WinsMatch ? 1 : 2,
      surface,
      tourneyName,
      stage
    );

    return {
      winnerId: actualWinner.id,
      winner: actualWinner,
      loser: actualLoser,
      score: validation.sets.join(' '),
      sets: validation.sets,
      storyline: String(parsed.storyline || fallbackQuotes.storyline).trim(),
      winnerQuote: String(parsed.winnerQuote || fallbackQuotes.winnerQuote).trim(),
      loserQuote: String(parsed.loserQuote || fallbackQuotes.loserQuote).trim(),
      source: 'groq',
      model: activeModel,
      sourceLabel: getGroqSourceHeaderLabel(activeModel)
    };
  } catch (err) {
    if (strictGroq) {
      throw err;
    }
    return buildLocalFallback();
  }
}

/**
 * Локальный генератор послематчевой колонки для финалов ТБШ и Мастерсов (3-4 предложения)
 */
export function buildFallbackFinalPressColumn({
  tourneyName = 'Турнир ATP',
  tourneyType = 'Мастерс',
  surface = 'Хард',
  year = 2024,
  winner,
  runnerUp,
  score = '6-4 6-4'
}) {
  const formatPlayerWithFlag = (p, fallbackLabel) => {
    if (!p || !p.name) return fallbackLabel;
    return p.flag && p.flag !== '?' ? `${p.name} (${p.flag})` : p.name;
  };

  const wName = formatPlayerWithFlag(winner, 'Чемпион тура');
  const rName = formatPlayerWithFlag(runnerUp, 'Финалист');
  const wShort = winner?.name || 'Чемпион';
  const rShort = runnerUp?.name || 'соперник';

  const hasTiebreak = String(score).includes('7-6') || String(score).includes('6-7');
  const setsCount = String(score).trim().split(/\s+/).filter(Boolean).length;

  const tierLabel = tourneyType === 'ТБШ'
    ? 'турнира Большого Шлема'
    : (tourneyType === 'Олимпиада'
      ? 'Олимпийского теннисного турнира'
      : (tourneyType === 'Итоговый' ? 'Итогового чемпионата ATP' : `престижного турнира категории «${tourneyType}»`));

  let headline = `${wShort} покоряет ${tourneyName} ${year}: триумф на покрытии «${surface}»!`;
  if (tourneyType === 'ТБШ' && setsCount >= 4) {
    headline = `Корона Большого Шлема: ${wShort} вырывает титул ${tourneyName} ${year} в ${setsCount}-сетовом марафоне!`;
  } else if (hasTiebreak) {
    headline = `Стальные нервы в финале ${tourneyName} ${year}: ${wShort} сломил ${rShort} на решающем тайбрейке!`;
  } else if (surface === 'Грунт') {
    headline = setsCount >= 3
      ? `Грунтовый триллер на ${tourneyName} ${year}: ${wShort} дожал ${rShort} в решающей партии финала!`
      : `Король грунта на ${tourneyName} ${year}: ${wShort} уверенно переиграл ${rShort} в титульном матче!`;
  } else if (surface === 'Трава') {
    headline = `Изумрудный триумф на ${tourneyName} ${year}: ${wShort} берет главный трофей на траве!`;
  } else if (surface === 'Зал') {
    headline = `Безупречный индор-теннис: ${wShort} забирает кубок ${tourneyName} ${year} под сводами арены!`;
  }

  const sentence1 = `В главном финале ${tierLabel} «${tourneyName}» сезона ${year} года ${wName} переиграл ${rName} с итоговым счетом ${score}.`;

  let sentence2 = `На быстром покрытии «${surface}» чемпион захватил контроль над центром корта за счет агрессивного приема и глубоких переводов по линии.`;
  if (surface === 'Грунт') {
    sentence2 = `В вязких грунтовых розыгрышах с высоким отскоком ${wShort} переиграл оппонента тактически, чередуя тяжелый топ-спин с неожиданными укороченными ударами.`;
  } else if (surface === 'Трава') {
    sentence2 = `На стремительном травяном корте решающим фактором стала вариативная первая подача ${wShort} и безупречные выходы к сетке в ключевых геймах.`;
  } else if (surface === 'Зал') {
    sentence2 = `В идеальных условиях крытого корта ${wShort} задал запредельный темп обмена ударами с задней линии и доминировал в розыгрышах до четырех ударов.`;
  }

  const sentence3 = hasTiebreak
    ? `Кульминацией встречи стал нервный тайбрейк, где ${wShort} отыграл скрытые сетболы и исполнил серию чистых виннерсов навылет.`
    : (setsCount >= 3
      ? `Несмотря на упорное сопротивление ${rShort} и смену инициативы по ходу партий, в решающем отрезке матча ${wShort} показал чемпионскую выдержку на брейк-пойнтах.`
      : `На протяжении всех ${setsCount} партий ${wShort} удерживал образцовый процент попадания первого мяча, не позволив ${rShort} зацепиться за чужую подачу.`);

  const sentence4 = `Завоеванный титул приносит ${wShort} весомую прибавку очков в 52-недельный рейтинг ATP и золотыми буквами вписывает его имя в архив Зала Славы Meta Tennis Tour.`;

  return {
    headline,
    article: [sentence1, sentence2, sentence3, sentence4].join(' '),
    source: 'local-press'
  };
}

/**
 * 2. Послематчевая колонка для финалов ТБШ и Мастерсов (Groq API + локальный фоллбэк)
 */
export async function generateFinalPressColumn({
  tourneyName = 'Турнир ATP',
  tourneyType = 'Мастерс',
  surface = 'Хард',
  year = 2024,
  winner,
  runnerUp,
  score = '6-4 6-4',
  options = {}
}) {
  const fallback = buildFallbackFinalPressColumn({
    tourneyName,
    tourneyType,
    surface,
    year,
    winner,
    runnerUp,
    score
  });

  if (!winner || !runnerUp) {
    return fallback;
  }

  try {
    const systemPrompt = [
      'Ты — главный редактор спортивного издания Meta Tennis Tour Press.',
      'Напиши послематчевую колонку для архива Зала Славы по итогам финала крупного теннисного турнира (ТБШ / Мастерс / Олимпиада / Итоговый).',
      'Верни СТРОГО валидный JSON-объект на русском языке без markdown-разметки:',
      '{',
      '  "headline": "Броский журнальный заголовок статьи",',
      '  "article": "Краткая аналитическая заметка ровно в 3-4 предложения о ходе финала и значимости титула"',
      '}'
    ].join('\n');

    const userPrompt = [
      `Турнир: ${tourneyName} (${tourneyType}, сезон ${year})`,
      `Покрытие: ${surface}`,
      `Чемпион: ${winner.name} (${winner.flag}, ранг #${winner.rank || 1})`,
      `Финалист: ${runnerUp.name} (${runnerUp.flag}, ранг #${runnerUp.rank || 2})`,
      `Счет финала: ${score}`
    ].join('\n');

    const parsed = await requestGroqJson(systemPrompt, userPrompt, options);
    if (parsed && parsed.headline && parsed.article) {
      return {
        headline: String(parsed.headline).trim(),
        article: String(parsed.article).trim(),
        source: 'groq'
      };
    }
  } catch (err) {
    if (options.strictGroq) {
      throw err;
    }
  }

  return fallback;
}

/**
 * 3. Стили и характеры молодых новичков — ньюгенов (17–23 года) при смене сезона
 */
export async function enrichNewgensWithGroq(newgensList = [], options = {}) {
  if (!Array.isArray(newgensList) || newgensList.length === 0) {
    return [];
  }

  newgensList.forEach((ng, idx) => {
    if (!ng.nickname) {
      ng.nickname = NEWGEN_NICKNAMES[idx % NEWGEN_NICKNAMES.length];
    }
    if (!ng.playStyle) {
      ng.playStyle = NEWGEN_PLAY_STYLES[idx % NEWGEN_PLAY_STYLES.length];
    }
  });

  try {
    const systemPrompt = [
      'Ты — скаут академии талантов Meta Tennis Tour.',
      'Для списка молодых теннисистов-новичков (17–23 года) придумай уникальные короткие прозвища и теннисные стили игры на русском языке (например: "Агрессивный бейслайнер с мощной подачей", "Грунтовый контрпанчер с феноменальной защитой").',
      'Верни СТРОГО валидный JSON-объект формата без markdown-оберток:',
      '{',
      '  "profiles": [',
      '    { "id": "id_игрока", "nickname": "Короткое прозвище", "playStyle": "Описание стиля игры (4-7 слов)" }',
      '  ]',
      '}'
    ].join('\n');

    const userPrompt = JSON.stringify(
      newgensList.map(ng => ({
        id: ng.id,
        name: ng.name,
        country: ng.flag,
        age: ng.ageAtEntry || 19
      }))
    );

    const parsed = await requestGroqJson(systemPrompt, userPrompt, options);
    if (parsed && Array.isArray(parsed.profiles)) {
      const profileMap = new Map(parsed.profiles.map(p => [p.id, p]));
      newgensList.forEach((ng, idx) => {
        const prof = profileMap.get(ng.id) || parsed.profiles[idx];
        if (prof) {
          if (prof.nickname) ng.nickname = String(prof.nickname).trim();
          if (prof.playStyle) ng.playStyle = String(prof.playStyle).trim();
        }
      });
    }
  } catch (err) {
    if (options.strictGroq) {
      throw err;
    }
  }

  return newgensList;
}

if (typeof window !== 'undefined') {
  window.getGroqApiKey = getGroqApiKey;
  window.setGroqApiKey = setGroqApiKey;
  window.hasGroqApiKey = hasGroqApiKey;
  window.getGroqModel = getGroqModel;
  window.setGroqModel = setGroqModel;
  window.normalizeGroqModelName = normalizeGroqModelName;
  window.cleanGroqJsonString = cleanGroqJsonString;
  window.getGroqSourceHeaderLabel = getGroqSourceHeaderLabel;
  window.generateCommentaryForEnteredScore = generateCommentaryForEnteredScore;
  window.simulateMatchWithGroq = simulateMatchWithGroq;
  window.generateFinalPressColumn = generateFinalPressColumn;
  window.enrichNewgensWithGroq = enrichNewgensWithGroq;
}
