/**
 * Meta Tennis Tour — Модуль работы со сверхбыстрым Groq API (src/aiService.js)
 * Эндпоинт: https://api.groq.com/openai/v1/chat/completions
 * Модели (СТРОГО в нижнем регистре): 'llama-3.3-70b-versatile' (по умолчанию) или 'llama-3.1-8b-instant'.
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
  generateMatchQuotes
} from './matchEngine.js';
import { NEWGEN_NICKNAMES, NEWGEN_PLAY_STYLES } from './retirementEngine.js';

export const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
export const FAST_GROQ_MODEL = 'llama-3.1-8b-instant';

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
 * Запрещает заглавные буквы вроде 'Llama-3.3-70b-versatile'.
 */
export function normalizeGroqModelName(modelId) {
  const clean = String(modelId || DEFAULT_GROQ_MODEL).trim().toLowerCase();
  if (clean === FAST_GROQ_MODEL || clean.includes('8b')) {
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
    return 'ИИ-репортаж (Groq / Llama 3.1)';
  }
  return 'ИИ-репортаж (Groq / Llama 3.3)';
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

  const timeoutMs = options.timeoutMs ?? 15000;
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

    // Если кластер Groq вернул 404 для алиаса llama-3.3-70b-versatile / llama-3.1-8b-instant,
    // выполняем повторный запрос к реальному Groq API на активный инстанс кластера Groq
    if (response.status === 404 && !options.disableModelFallback) {
      const activeClusterModel = model === FAST_GROQ_MODEL ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b';
      response = await fetchImpl(GROQ_API_ENDPOINT, buildFetchOptions(activeClusterModel));
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

  const stageUpper = String(stage || '').toUpperCase();
  const isFinalStage = (stageUpper.includes('ФИНАЛ') || stageUpper === 'F' || stageUpper === 'FINAL') &&
    !stageUpper.includes('1/') && !stageUpper.includes('ПОЛУФИНАЛ') && !stageUpper.includes('ЧЕТВЕРТЬФИНАЛ');
  const isSemiStage = stageUpper.includes('1/2') || stageUpper.includes('ПОЛУФИНАЛ') || stageUpper === 'SF';
  const stageToneInstruction = isFinalStage
    ? `ТОНАЛЬНОСТЬ ЦИТАТ (ГЛАВНЫЙ ФИНАЛ ЗА ТИТУЛ — ${stage} на «${tourneyName}»): Это ФИНАЛ турнира! Победитель (${winner.name}) становится ЧЕМПИОНОМ турнира и в своей цитате (winnerQuote) ОБЯЗАН выразить огромную радость, слёзы счастья и эйфорию от того, что ему наконец-то удалось победить в этом турнире и поднять кубок над головой! Проигравший (${loser.name}) переживает драму поражения в шаге от титула. Используй живую теннисную лексику («сорванный форхенд», «приём навылет», «мёртвая подача», «забитые ноги»).`
    : (isSemiStage
      ? `ТОНАЛЬНОСТЬ ЦИТАТ (ПОЛУФИНАЛ — ${stage}): Максимальный накал страстей, радость выхода в главный финал турнира, горечь поражения в шаге от битвы за титул. Используй живую теннисную лексику («сорванный форхенд», «приём навылет», «мёртвая подача», «забитые ноги»).`
      : `ТОНАЛЬНОСТЬ ЦИТАТ (РАБОЧАЯ СТАДИЯ — ${stage}): Сдержанный рабочий тон профессионалов (акклиматизация, пристрелка к скорости корта, физическая форма, мозоли на ладонях, настрой на следующий раунд). Используй живую теннисную лексику («сорванный форхенд», «приём навылет», «мёртвая подача», «забитые ноги»).`);

  const rivalryInstruction = isRivalry
    ? `ФАКТОР ПРИНЦИПИАЛЬНОГО СОПЕРНИЧЕСТВА (isRivalry: true, очных встреч: ${totalH2H}, H2H: ${h2hSummary}): Между ${player1.name} и ${player2.name} острое историческое противостояние! Сделай цитаты (winnerQuote и loserQuote) максимально колких, острых, эмоциональных, с элементами спортивного «трэш-тока» и прямой отсылкой к их прошлым очным дуэлям (например: «Я знаю каждую его привычку на корте и сегодня доказал, что его прошлая победа была чистой случайностью»).`
    : `Фактор H2H (isRivalry: false, очных встреч: ${totalH2H}): Уважительный, но конкурентный спортивный тон.`;

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
      'Ты — ведущий теннисный комментатор и спортивный журналист тура Meta Tennis Tour (ATP).',
      'Пользователь зафиксировал точный счет теннисного матча. Твоя задача — проанализировать ИМЕННО ЭТОТ СЧЕТ по сетам, характер борьбы (были ли тайбрейки, баранки 6-0, камбэк после проигранного первого сета, разгром или апсет аутсайдера), покрытие корта и историю H2H.',
      stageToneInstruction,
      rivalryInstruction,
      'Напиши яркую драматичную сводку матча (storyline) и живые разнообразные эмоциональные цитаты обоих игроков (winnerQuote, loserQuote) с прямой отсылкой к деталям этого конкретного счета и стадии турнира!',
      'Верни СТРОГО валидный JSON-объект на русском языке без markdown-оберток:',
      '{',
      '  "storyline": "Драматичная сводка матча (1-2 предложения), отражающая конкретный счет и ход партий",',
      '  "winnerQuote": "Прямая речь победителя для прессы по итогам этого счета (с учетом стадии турнира и isRivalry)",',
      '  "loserQuote": "Честный комментарий проигравшего по итогам этого счета (с учетом стадии турнира и isRivalry)"',
      '}'
    ].join('\n');

    const userPrompt = [
      matchContext,
      stageToneInstruction,
      rivalryInstruction,
      `Проанализируй счет "${finalScoreStr}" (победил ${winner.name}) на стадии "${stage}" и создай репортаж и цитаты игроков именно под этот сценарий матча.`
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
 * СЦЕНАРИЙ Б: Полная ИИ-симуляция матча через Groq ('llama-3.3-70b-versatile')
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

  const stageUpper = String(stage || '').toUpperCase();
  const isFinalStage = (stageUpper.includes('ФИНАЛ') || stageUpper === 'F' || stageUpper === 'FINAL') &&
    !stageUpper.includes('1/') && !stageUpper.includes('ПОЛУФИНАЛ') && !stageUpper.includes('ЧЕТВЕРТЬФИНАЛ');
  const isSemiStage = stageUpper.includes('1/2') || stageUpper.includes('ПОЛУФИНАЛ') || stageUpper === 'SF';
  const stageToneInstruction = isFinalStage
    ? `ТОНАЛЬНОСТЬ ЦИТАТ (ГЛАВНЫЙ ФИНАЛ ЗА ТИТУЛ — ${stage} на «${tourneyName}»): Это ФИНАЛ турнира! Победитель становится ЧЕМПИОНОМ и в своей цитате (winnerQuote) ОБЯЗАН выразить огромную радость, слёзы счастья и эйфорию от того, что ему наконец-то удалось победить в этом турнире и завоевать заветный кубок! Проигравший переживает драму поражения в шаге от титула. Используй живую теннисную лексику («сорванный форхенд», «приём навылет», «мёртвая подача», «забитые ноги»).`
    : (isSemiStage
      ? `ТОНАЛЬНОСТЬ ЦИТАТ (ПОЛУФИНАЛ — ${stage}): Максимальный накал страстей, радость выхода в главный финал турнира, горечь поражения в шаге от битвы за титул. Используй живую теннисную лексику («сорванный форхенд», «приём навылет», «мёртвая подача», «забитые ноги»).`
      : `ТОНАЛЬНОСТЬ ЦИТАТ (РАБОЧАЯ СТАДИЯ — ${stage}): Сдержанный рабочий тон профессионалов (акклиматизация, пристрелка к скорости корта, физическая форма, мозоли на ладонях, настрой на следующий раунд). Используй живую теннисную лексику («сорванный форхенд», «приём навылет», «мёртвая подача», «забитые ноги»).`);

  const scenarioDirective = [
    rollThriller
      ? `Директива длины матча (45% триллер): Сделай этот матч упорным ${bestOf === 5 ? '4 или 5-сетовым' : '3-сетовым'} триллером с обменом партиями (например: "4-6 7-6(5) 6-3" или "7-5 3-6 6-4")!`
      : `Директива длины матча: Матч может завершиться в ${bestOf === 5 ? '3-4' : '2'} сетах, но обязательно с интригой (например, тайбрейк "7-6(5) 6-4", "7-5 6-4" или сет с баранкой "6-0 6-4").`,
    rollUpset
      ? `Директива сенсации (20% апсет): В этом матче аутсайдер ${underdog.name} (ID="${underdog.id}", #${underdog.rank || 50}) сотворяет сенсацию и обыгрывает фаворита ${favorite.name}!`
      : `Фаворит по рейтингу — ${favorite.name} (#${favorite.rank || 50}), но учитывай покрытие «${surface}» и H2H.`,
    rollBagel
      ? `В одной из партий один из игроков может оформить разгромный сет 6-0 или 6-1.`
      : `Используй разнообразные счета геймов: 7-6(5), 7-5, 6-4, 6-1, 6-0.`
  ].join(' ');

  const rivalryInstruction = isRivalry
    ? `ФАКТОР ПРИНЦИПИАЛЬНОГО СОПЕРНИЧЕСТВА (isRivalry: true, очных встреч: ${totalH2H}, H2H: ${h2hSummary}): Между ${player1.name} и ${player2.name} принципиальная дуэль! Сгенерируй острые, дерзкие, эмоциональные цитаты с элементами спортивного «трэш-тока» и прямой отсылкой к счету их личных встреч (например: «Я знаю каждую его привычку на корте и сегодня доказал, что его прошлогодняя победа была чистой случайностью»).`
    : `Фактор H2H (isRivalry: false, очных встреч: ${totalH2H}): Стандартный спортивный тон.`;

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
      'Ты — ведущий теннисный аналитик и симулятор матчей тура Meta Tennis Tour (ATP).',
      matchParamsBlock,
      `Формат матча: best-of-${bestOf} (для победы нужно выиграть ${reqSets} сета).`,
      'ЖЕСТКИЕ ПРАВИЛА ГЕНЕРАЦИИ СЧЕТА:',
      '1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выдавать шаблонные счета "6-3 6-2", "3-6 2-6", "6-2 6-3" или "2-6 3-6"!',
      '2. В 45% матчей генерируй 3-сетовые триллеры (например: "4-6 7-6(5) 6-3", "7-5 3-6 6-4", "6-7(4) 6-4 7-6(8)").',
      '3. Используй упорные тайбрейки (например 7-6(5)), баранки 6-0 и апсеты (20% побед аутсайдеров).',
      '4. Счет (score) всегда записывается со стороны Игрока 1 к Игроку 2 через пробел.',
      '5. Если в сете тайбрейк (7-6 или 6-7), обязательно укажи очки проигравшего на тайбрейке в круглых скобках, например 7-6(5).',
      stageToneInstruction,
      rivalryInstruction,
      scenarioDirective,
      'Верни СТРОГО валидный JSON-объект со следующими ключами на русском языке без комментариев и без markdown-оберток:',
      '{',
      '  "winnerId": "id_победителя",',
      '  "score": "4-6 7-6(5) 6-3",',
      '  "storyline": "Краткая драматичная сводка матча в одно-два предложения",',
      '  "winnerQuote": "Эмоциональная цитата победителя для прессы (с учетом стадии турнира и isRivalry)",',
      '  "loserQuote": "Эмоциональный комментарий проигравшего (с учетом стадии турнира и isRivalry)"',
      '}'
    ].join('\n');

    const userPrompt = [
      matchParamsBlock,
      stageToneInstruction,
      rivalryInstruction,
      scenarioDirective,
      'Сгенерируй нешаблонный, реалистичный исход матча (ЗАПРЕЩЕНЫ счета 6-3 6-2 и 3-6 2-6) с драматичной сводкой и цитатами игроков.'
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
