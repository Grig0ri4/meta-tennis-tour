/**
 * Meta Tennis Tour — Движок матчей, ИИ-сводок, сброса результатов и Личных встреч H2H (matchEngine.js)
 * Генерация реалистичного теннисного счета (45% 3-сетовых триллеров, 20% апсетов, баранки 6-0, тайбрейки,
 * запрет шаблонов 6-3 6-2 / 3-6 2-6), анализ пользовательского счета, продвижение по сетке,
 * каскадный сброс результата матча и аналитический блок H2H.
 */

import { calculateGroupStandings } from './drawEngine.js';
import { FULL_CALENDAR_TEMPLATE, rNames128, rNames64, rNamesOlympics, rNames32 } from '../data/tournaments.js';
import { buildInitial300Players } from '../data/players.js';

const CANONICAL_ID_BY_NAME = (() => {
  const map = new Map();
  try {
    const list = buildInitial300Players();
    list.forEach(p => {
      if (p && p.name && p.id) {
        map.set(String(p.name).trim().toLowerCase(), String(p.id));
      }
    });
  } catch {
    // ignore
  }
  return map;
})();

export function formatTennisScore(scoreArray) {
  if (!scoreArray || scoreArray.length === 0) return '';
  const arr = Array.isArray(scoreArray) ? scoreArray : String(scoreArray).split(/\s+/);
  return arr.map(setStr => setStr.replace(/\((\d+)\)/g, '<sup>$1</sup>')).join('  ');
}

export function generateRealisticTennisSet(p1Wins, isDecidingSetTB = false, rankDiff = 0) {
  const roll = Math.random();
  let score = "";

  if (p1Wins) {
    if (roll < 0.08 || (rankDiff > 45 && roll < 0.16)) score = "6-0";
    else if (roll < 0.20 || (rankDiff > 35 && roll < 0.30)) score = "6-1";
    else if (roll < 0.34) score = "6-2";
    else if (roll < 0.48) score = "6-3";
    else if (roll < 0.68) score = "6-4";
    else if (roll < 0.82) score = "7-5";
    else {
      const loserPoints = isDecidingSetTB
        ? (Math.random() < 0.5 ? 8 + Math.floor(Math.random() * 3) : 6 + Math.floor(Math.random() * 2))
        : (2 + Math.floor(Math.random() * 6));
      score = `7-6(${loserPoints})`;
    }
  } else {
    if (roll < 0.08 || (rankDiff < -45 && roll < 0.16)) score = "0-6";
    else if (roll < 0.20 || (rankDiff < -35 && roll < 0.30)) score = "1-6";
    else if (roll < 0.34) score = "2-6";
    else if (roll < 0.48) score = "3-6";
    else if (roll < 0.68) score = "4-6";
    else if (roll < 0.82) score = "5-7";
    else {
      const loserPoints = isDecidingSetTB
        ? (Math.random() < 0.5 ? 8 + Math.floor(Math.random() * 3) : 6 + Math.floor(Math.random() * 2))
        : (2 + Math.floor(Math.random() * 6));
      score = `6-7(${loserPoints})`;
    }
  }
  return score;
}

/**
 * Проверяет и устраняет шаблонные счета 6-3 6-2 / 3-6 2-6 / 6-2 6-3 / 2-6 3-6
 */
export function isBannedTemplateScore(scoreStrOrArr) {
  const joined = Array.isArray(scoreStrOrArr)
    ? scoreStrOrArr.join(' ').trim()
    : String(scoreStrOrArr || '').trim();
  const banned = new Set([
    '6-3 6-2',
    '3-6 2-6',
    '6-2 6-3',
    '2-6 3-6'
  ]);
  return banned.has(joined);
}

export function sanitizeTemplateScore(sets, p1WinsMatch, bestOf = 3) {
  const joined = (sets || []).join(' ').trim();
  if (!isBannedTemplateScore(joined)) return sets;

  const alternativesP1 = [
    ['6-4', '7-6(5)'],
    ['4-6', '7-6(5)', '6-3'],
    ['7-5', '3-6', '6-4'],
    ['6-0', '6-4'],
    ['7-6(4)', '6-4']
  ];
  const alternativesP2 = [
    ['4-6', '6-7(5)'],
    ['6-4', '6-7(5)', '3-6'],
    ['5-7', '6-3', '4-6'],
    ['0-6', '4-6'],
    ['6-7(4)', '4-6']
  ];

  const pool = p1WinsMatch ? alternativesP1 : alternativesP2;
  if (bestOf === 5) {
    return p1WinsMatch ? ['6-4', '4-6', '7-6(5)', '6-3'] : ['4-6', '6-4', '6-7(5)', '3-6'];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function getSurfaceAffinityBonus(player, surface) {
  if (!player || !player.id) return 0;
  const flag = player.flag || '';
  if (surface === 'Грунт' && ['ESP', 'ARG', 'BRA', 'CHI', 'ITA', 'NOR', 'FRA'].includes(flag)) return 0.035;
  if (surface === 'Трава' && ['GBR', 'AUS', 'GER', 'SUI', 'USA', 'NED'].includes(flag)) return 0.035;
  if (surface === 'Хард' && ['USA', 'GEO', 'SLO', 'RUS', 'SRB', 'CAN', 'AUS'].includes(flag)) return 0.03;
  if (surface === 'Зал' && ['GEO', 'SLO', 'NOR', 'SUI', 'RUS', 'FRA'].includes(flag)) return 0.03;
  return 0;
}

function pickRandomItem(list, seedHint = 0) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const idx = Math.floor(Math.random() * list.length);
  return list[idx] || list[seedHint % list.length];
}

export function generateMatchNarrative(winner, loser, scores, surface = 'Хард', tourneyName = 'Турнир ATP', stage = '') {
  if (!winner || !loser) return '';
  const arr = Array.isArray(scores) ? scores : String(scores || '').trim().split(/\s+/);
  const scoreText = arr.join(' ');
  const isRetirement = arr.some(s => String(s).toUpperCase() === 'RET');
  const hasTiebreak = arr.some(s => String(s).includes('7-6') || String(s).includes('6-7'));
  const hasSuperTB = arr.some(s => /\((8|9|1\d)\)/.test(String(s)));
  const hasBagel = arr.some(s => s === '6-0' || s === '0-6');
  const isLongMatch = arr.filter(s => String(s).toUpperCase() !== 'RET').length >= 3;
  const isUpset = (winner.rank || 100) > (loser.rank || 100) + 15;

  if (isRetirement) {
    return `Драма на корте («${tourneyName}»): ${loser.name} был вынужден досрочно сняться с матча из-за критической усталости и микротравмы при счете ${scoreText} — ${winner.name} шагает дальше!`;
  }

  const stageUpper = String(stage || '').toUpperCase();
  const isFinal = (stageUpper.includes('ФИНАЛ') || stageUpper === 'F' || stageUpper === 'FINAL') &&
    !stageUpper.includes('1/') && !stageUpper.includes('ПОЛУФИНАЛ') && !stageUpper.includes('ЧЕТВЕРТЬФИНАЛ');
  const isSemi = stageUpper.includes('1/2') || stageUpper.includes('ПОЛУФИНАЛ') || stageUpper === 'SF';

  if (isFinal) {
    const finalNarratives = [
      `Триумфальный финал на «${tourneyName}»: ${winner.name} выдержал колоссальное давление титульного матча и сломил сопротивление ${loser.name} (${scoreText}), завоевав долгожданный кубок!`,
      `Чемпионская драма на «${tourneyName}» (${surface}): ${winner.name} переиграл ${loser.name} со счетом ${scoreText} и поднял главный трофей турнира над головой!`,
      `Историческая развязка титульного поединка: ${winner.name} безупречно провел ключевые розыгрыши финала против ${loser.name} (${scoreText}) и стал новым чемпионом «${tourneyName}»!`,
      `Битва за титул «${tourneyName}» осталась за ${winner.name}: в напряженном финале со счетом ${scoreText} он оказался крепче нервами, чем ${loser.name}!`
    ];
    return pickRandomItem(finalNarratives);
  }

  if (isSemi) {
    const semiNarratives = [
      `Битва за путёвку в главный финал «${tourneyName}»: ${winner.name} на жилах вырвал победу у ${loser.name} (${scoreText}) и теперь сразится за титул!`,
      `Электрический полуфинал на покрытии «${surface}»: ${winner.name} превзошел ${loser.name} (${scoreText}) в ключевых геймах и шагнул в титульный матч!`
    ];
    return pickRandomItem(semiNarratives);
  }

  if (hasSuperTB) {
    return pickRandomItem([
      `Волевая победа ${winner.name} после отыгрыша матчболов на драматичном решающем супер-тайбрейке против ${loser.name} (${scoreText})!`,
      `Нервы как канаты: ${winner.name} вытащил концовку на затяжном тайбрейке у ${loser.name} (${scoreText}) под рев трибун!`
    ]);
  }
  if (isUpset && isLongMatch) {
    return pickRandomItem([
      `Громкая сенсация тура: ${winner.name} (#${winner.rank || '—'}) сотворил апсет, сломив фаворита ${loser.name} (#${loser.rank || '—'}) в ${arr.length}-сетовом триллере (${scoreText})!`,
      `Неожиданный поворот в сетке: андердог ${winner.name} (#${winner.rank || '—'}) перетерпел фаворита ${loser.name} (#${loser.rank || '—'}) в затяжной рубке (${scoreText})!`
    ]);
  }
  if (hasBagel && isLongMatch) {
    return `Матч резких контрастов с «баранкой» 6-0: ${winner.name} перехватил инициативу и дожал ${loser.name} со счетом ${scoreText}!`;
  }
  if (hasBagel) {
    return `Тотальное доминирование на корте («${surface}»): ${winner.name} оформил «баранку» 6-0 и уверенно разобрался с ${loser.name} (${scoreText})!`;
  }
  if (isLongMatch && hasTiebreak) {
    return pickRandomItem([
      `${winner.name} вырвал победу в напряженном триллере из ${arr.length} сетов (${scoreText}), оказавшись точнее ${loser.name} на ключевом тайбрейке!`,
      `Качельный марафон из ${arr.length} партий (${scoreText}): ${winner.name} выстоял на тайбрейке и оставил не у дел ${loser.name}!`
    ]);
  }
  if (isLongMatch) {
    return pickRandomItem([
      `Затяжная битва характеров: ${winner.name} переломил ход встречи в решающей партии и сломил сопротивление ${loser.name} (${scoreText})!`,
      `Трудовая победа в ${arr.length} сетах: ${winner.name} добавил агрессии на приёме в решающей партии и дожал ${loser.name} (${scoreText})!`
    ]);
  }
  if (hasTiebreak) {
    return `${winner.name} хладнокровно провел концовку на тайбрейке и закрыл матч против ${loser.name} (${scoreText}) без потери концентрации!`;
  }
  return pickRandomItem([
    `${winner.name} доминировал на покрытии «${surface}», реализовал ключевые брейк-пойнты и переиграл ${loser.name} со счетом ${scoreText}!`,
    `Уверенный класс от ${winner.name}: глубина ударов с задней линии и острая первая подача принесли победу над ${loser.name} (${scoreText})!`
  ]);
}

export function generateMatchQuotes(winner, loser, scores, surface = 'Хард', tourneyName = 'Турнир ATP', stage = '') {
  if (!winner || !loser) {
    return { winnerQuote: '', loserQuote: '' };
  }
  const arr = Array.isArray(scores) ? scores : String(scores || '').trim().split(/\s+/);
  const scoreText = arr.join(' ');
  const isRetirement = arr.some(s => String(s).toUpperCase() === 'RET');
  const hasTiebreak = arr.some(s => String(s).includes('7-6') || String(s).includes('6-7'));
  const hasBagel = arr.some(s => s === '6-0' || s === '0-6');
  const isLongMatch = arr.filter(s => String(s).toUpperCase() !== 'RET').length >= 3;

  if (isRetirement) {
    return {
      winnerQuote: `«Никогда не хочется выигрывать матч из-за снятия соперника (${scoreText}). Желаю ${loser.name} скорейшего восстановления — сегодня на корте была колоссальная нагрузка.»`,
      loserQuote: `«Организм просто сказал "стоп" при счете ${scoreText}: свело мышцы, забитые ноги больше не держали опору, и продолжать матч на ${tourneyName} было слишком опасно.»`
    };
  }

  const stageUpper = String(stage || '').toUpperCase();
  const isFinal = (stageUpper.includes('ФИНАЛ') || stageUpper === 'F' || stageUpper === 'FINAL') &&
    !stageUpper.includes('1/') && !stageUpper.includes('ПОЛУФИНАЛ') && !stageUpper.includes('ЧЕТВЕРТЬФИНАЛ');
  const isBronze = stageUpper.includes('3-Е МЕСТО') || stageUpper.includes('БРОНЗ');
  const isSemi = stageUpper.includes('1/2') || stageUpper.includes('ПОЛУФИНАЛ') || stageUpper === 'SF';
  const isEarlyRound = stageUpper.includes('1/64') || stageUpper.includes('1/32') || stageUpper.includes('1/16') ||
    stageUpper.includes('R128') || stageUpper.includes('R64') || stageUpper.includes('R32') || stageUpper.includes('R16') ||
    stageUpper.includes('РАУНД 1') || stageUpper.includes('РАУНД 2') || stageUpper.includes('ГРУППА');

  if (isFinal) {
    const finalWinnerQuotes = [
      `«Я безумно счастлив, что мне наконец-то удалось победить на ${tourneyName}! Мы с командой шли к этому титулу долгие месяцы, в концовке (${scoreText}) ноги были просто забитые, но приём навылет на чемпионшип-пойнте подарил лучшую минуту в моей жизни!»`,
      `«Не могу сдержать слёз радости — поднять над головой кубок ${tourneyName} было моей главной мечтой! Финал против ${loser.name} (${scoreText}) получился невероятно нервным, но в решающем гейме выручила первая подача и вера в себя.»`,
      `«Наконец-то этот трофей наш! Столько раз я останавливался в шаге от титула, и сегодня на корте ${tourneyName} (${scoreText}) отдал всего себя без остатка — даже через сбитое дыхание и забитые ноги я знал, что не упущу этот кубок!»`,
      `«Это чистая эйфория — выиграть титул ${tourneyName} после такой тяжелейшей недели! Спасибо трибунам за сумасшедшую энергетику: когда в финале (${scoreText}) прошёл мой последний приём навылет, я просто упал на корт от счастья!»`,
      `«Победа в финале ${tourneyName} (${scoreText}) значит для меня абсолютно всё! ${loser.name} бился как лев на каждом мяче, но сегодня я поймал чемпионский кураж и невероятно рад наконец-то вписать своё имя в историю этого турнира!»`
    ];
    const finalLoserQuotes = [
      `«Сердце разрывается остановиться в одном шаге от кубка ${tourneyName} (${scoreText}). В решающий момент меня подвёл сорванный форхенд по линии и мёртвая подача на брейк-пойнте, а ${winner.name} сыграл как настоящий чемпион и заслужил этот титул.»`,
      `«Проигрывать в финале всегда больно до кома в горле (${scoreText}). Я оставил на этом корте все силы, но к концу матча забитые ноги не позволили чисто подойти к мячу, а ${winner.name} провёл выдающийся титульный поединок.»`,
      `«Сейчас внутри пустота — титул ${tourneyName} был так близко (${scoreText}). Пара секунд потери концентрации, один сорванный форхенд на ключевом мяче решили судьбу трофея. Поздравляю ${winner.name} с заслуженной победой в турнире.»`,
      `«Больно смотреть на главный кубок со второго места после такой битвы (${scoreText}). Сегодня у меня в решающем гейме вдруг пропала первая — пошла мёртвая подача, чем ${winner.name} воспользовался мгновенно.»`
    ];
    return {
      winnerQuote: pickRandomItem(finalWinnerQuotes),
      loserQuote: pickRandomItem(finalLoserQuotes)
    };
  }

  if (isBronze) {
    return {
      winnerQuote: `«Уехать с Олимпиады с бронзовой медалью для своей страны после вчерашнего полуфинала — огромная гордость! Собрал волю в кулак (${scoreText}), перетерпел забитые ноги и выгрыз этот подиум!»`,
      loserQuote: `«Обидно до слёз остаться на четвёртом месте в шаге от олимпийской медали (${scoreText}). После вчерашней битвы не хватило эмоций, подвёл сорванный форхенд в концовке.»`
    };
  }

  if (isSemi) {
    const semiWinnerQuotes = [
      `«Выход в главный финал ${tourneyName} — это чистая эйфория! Матч против ${loser.name} (${scoreText}) выжал меня эмоционально до предела, но на ключевых мячах выручили приём навылет и подача в корпус.»`,
      `«Ещё один шаг до заветного титула ${tourneyName}! В полуфинале (${scoreText}) пришлось терпеть через забитые ноги и затяжные ралли, но мысль о завтрашнем финале дала второе дыхание.»`,
      `«Невероятные эмоции — я в финале ${tourneyName}! ${loser.name} давил весь матч (${scoreText}), однако в решающие минуты мой бэкхенд по линии и приём навылет сработали безотказно.»`
    ];
    const semiLoserQuotes = [
      `«Безумно больно проигрывать в полуфинале за шаг до титульного матча (${scoreText}). На покрытии «${surface}» сегодня не хватило свежести в затяжных перестрелках — забитые ноги не дали добежать до ключевых мячей.»`,
      `«Остановиться в полуфинале ${tourneyName} (${scoreText}) — тяжёлый удар. В концовке меня подвёл сорванный форхенд и мёртвая подача на скрытом матчболе, а ${winner.name} заслужил путёвку в финал.»`
    ];
    return {
      winnerQuote: pickRandomItem(semiWinnerQuotes),
      loserQuote: pickRandomItem(semiLoserQuotes)
    };
  }

  if (isEarlyRound) {
    const earlyWinnerQuotes = [
      `«Для стартовых раундов (${stage || 'ранняя стадия'}) главное — пройти акклиматизацию и прибиться к скорости корта (${surface.toLowerCase()}). Счет ${scoreText} рабочий, хотя мозоли на ладонях дали о себе знать, двигаемся дальше по сетке.»`,
      `«На ранних стадиях ${tourneyName} никто не дарит лёгких очков (${scoreText}). Рад, что вовремя нащупал приём навылет и сэкономил силы перед следующими кругами.»`,
      `«Рабочая победа в стартовом раунде (${scoreText}): корт на ${tourneyName} довольно быстрый, пару геймов ушло на пристрелку, но дальше подача пошла по месту.»`
    ];
    const earlyLoserQuotes = [
      `«Тяжело входить в турнир без должной пристрелки: не успел адаптироваться к отскоку мяча на ${tourneyName} (${scoreText}), пару раз подвёл сорванный форхенд, а ${winner.name} сразу поймал рабочий ритм.»`,
      `«Сегодня с самого утра ощущались забитые ноги после перелёта и смены покрытия (${scoreText}). Мёртвая подача в ключевых геймах не оставила шансов зацепиться за этот раунд.»`
    ];
    return {
      winnerQuote: pickRandomItem(earlyWinnerQuotes),
      loserQuote: pickRandomItem(earlyLoserQuotes)
    };
  }

  if (hasBagel) {
    return {
      winnerQuote: `«В партии со счетом 6-0 я поймал невероятный кураж: проходил каждый приём навылет, и мяч ложился точно в заднюю линию (${scoreText}).»`,
      loserQuote: `«Тяжело объяснить провал в сете с баранкой — сегодня у меня была просто мёртвая подача, а ${winner.name} читал все направления атак.»`
    };
  }
  if (isLongMatch && hasTiebreak) {
    return {
      winnerQuote: pickRandomItem([
        `«Это была жесткая проверка на характер против ${loser.name} (${scoreText}) — несмотря на забитые ноги в концовке, на тайбрейке я доверился первой подаче и трибунам на ${tourneyName}.»`,
        `«Такие трёхсетовые битвы с тайбрейком (${scoreText}) закаляют сильнее всего: в решающий момент прошёл чистый приём навылет по линии!»`
      ]),
      loserQuote: pickRandomItem([
        `«Судьбу матча решил один сорванный форхенд на тайбрейке (${scoreText}); обидно уступать в такой равной рубке, но ${winner.name} сегодня отыграл чище в ключевых геймах.»`,
        `«Матч шёл мяч в мяч (${scoreText}), но в концовке тайбрейка дали о себе знать забитые ноги и мёртвая вторая подача.»`
      ])
    };
  }
  if (isLongMatch) {
    return {
      winnerQuote: `«В решающем сете (${scoreText}) мне удалось перетерпеть усталость, включить острый приём навылет и забрать инициативу на задней линии (${surface.toLowerCase()}).»`,
      loserQuote: `«К третьей партии дали о себе знать забитые ноги и мозоли, допустил пару срывов с форхенда на брейк-пойнтах (${scoreText}), чем ${winner.name} мгновенно воспользовался.»`
    };
  }
  if (hasTiebreak) {
    return {
      winnerQuote: `«Ключевым моментом стал тайбрейк (${scoreText}): я сохранил холодную голову на приёме и не позволил ${loser.name} затянуть встречу в решающую партию.»`,
      loserQuote: `«У меня были скрытые сетболы, но на тайбрейке подвела мёртвая вторая подача (${scoreText}), а ${winner.name} отподавал первый мяч без единого сбоя.»`
    };
  }
  return {
    winnerQuote: pickRandomItem([
      `«Сегодня с первого гейма отлично летела подача по углам и работал приём навылет (${scoreText}) — скорость корта («${surface}») идеально легла под мой удар.»`,
      `«Чётко выполнил план на игру против ${loser.name} (${scoreText}): держал глубокую длину ударов и не давал сопернику времени на подготовку атаки.»`
    ]),
    loserQuote: pickRandomItem([
      `«${winner.name} предложил запредельный темп с первых минут (${scoreText}), а меня в ключевых геймах подвёл сорванный форхенд по линии.»`,
      `«Сегодня не сработала первая подача (${scoreText}), пришлось много бегать в обороне, и к середине второго сета уже сказались забитые ноги.»`
    ])
  };
}

/**
 * Рассчитывает расход выносливости (Stamina 0–100%) по итогам сыгранных сетов:
 * - Быстрый сет (6-0, 6-1, 6-2): ~4%
 * - Стандартный сет (6-3, 6-4): ~6%
 * - Затяжной сет (7-5): ~8%, тайбрейк (7-6): ~9%
 * - 5-сетовый триллер на ТБШ дополнительно истощает игроков до 40–50% остатка энергии к следующему кругу.
 */
export function calculateMatchStaminaCost(scoresOrStr, bestOf = 3) {
  const arr = Array.isArray(scoresOrStr)
    ? scoresOrStr
    : String(scoresOrStr || '').trim().split(/\s+/).filter(Boolean);

  const setTokens = arr.filter(t => String(t).toUpperCase() !== 'RET');
  if (setTokens.length === 0) return 4;

  let totalDrain = 0;
  for (const s of setTokens) {
    const clean = String(s).replace(/\(\d+\)/g, '');
    const parts = clean.split('-');
    if (parts.length !== 2) continue;
    const g1 = parseInt(parts[0], 10);
    const g2 = parseInt(parts[1], 10);
    if (isNaN(g1) || isNaN(g2)) continue;
    const totalGames = g1 + g2;
    const maxG = Math.max(g1, g2);
    const minG = Math.min(g1, g2);

    if (maxG === 7 && minG === 6) {
      totalDrain += 9;
    } else if (maxG === 7 && minG === 5) {
      totalDrain += 8;
    } else if (maxG === 6 && minG <= 2) {
      totalDrain += 4;
    } else if (maxG === 6 && minG <= 4) {
      totalDrain += 6;
    } else {
      // Незавершенный сет перед RET
      totalDrain += Math.max(2, Math.round(totalGames * 0.6));
    }
  }

  // Пятисетовые триллеры на ТБШ (4–5 сетов) требуют колоссальных затрат энергии (до 50–55% расхода)
  if (bestOf === 5 && setTokens.length === 5) {
    totalDrain = Math.max(50, totalDrain + 16);
  } else if (bestOf === 5 && setTokens.length === 4) {
    totalDrain = Math.max(34, totalDrain + 8);
  } else if (bestOf === 3 && setTokens.length === 3) {
    totalDrain += 4;
  }

  return Math.min(60, Math.max(3, totalDrain));
}

/**
 * Применяет расход выносливости к участникам матча
 */
export function applyMatchFatigueToPlayers(p1, p2, scoresOrStr, bestOf = 3) {
  const drain = calculateMatchStaminaCost(scoresOrStr, bestOf);
  if (p1 && typeof p1 === 'object') {
    const cur1 = typeof p1.stamina === 'number' ? p1.stamina : 100;
    p1.stamina = Math.max(15, Math.min(100, cur1 - drain));
  }
  if (p2 && typeof p2 === 'object') {
    const cur2 = typeof p2.stamina === 'number' ? p2.stamina : 100;
    p2.stamina = Math.max(15, Math.min(100, cur2 - drain));
  }
  return drain;
}

/**
 * Восстанавливает выносливость всех игроков до 100% между турнирами
 */
export function resetPlayersStamina(playersList) {
  if (!Array.isArray(playersList)) return playersList;
  playersList.forEach(p => {
    if (p && typeof p === 'object') {
      p.stamina = 100;
    }
  });
  return playersList;
}

/**
 * Вычисляет процент доминирования Игрока 1 (Momentum Bar: 12..88%, 50% по умолчанию) по текущему счету
 */
export function computeMatchMomentumPercent(scoresOrStr) {
  const arr = Array.isArray(scoresOrStr)
    ? scoresOrStr
    : String(scoresOrStr || '').trim().split(/\s+/).filter(Boolean);
  const setTokens = arr.filter(t => String(t).toUpperCase() !== 'RET');
  if (setTokens.length === 0) return 50;

  let g1Total = 0;
  let g2Total = 0;
  let s1W = 0;
  let s2W = 0;

  for (const s of setTokens) {
    const clean = String(s).replace(/\(\d+\)/g, '');
    const parts = clean.split('-');
    if (parts.length === 2) {
      const g1 = parseInt(parts[0], 10);
      const g2 = parseInt(parts[1], 10);
      if (!isNaN(g1) && !isNaN(g2)) {
        g1Total += g1;
        g2Total += g2;
        if (g1 > g2) s1W++;
        else if (g2 > g1) s2W++;
      }
    }
  }

  const totalG = g1Total + g2Total;
  if (totalG === 0) return 50;
  const gameShare = (g1Total / totalG) * 100;
  const setBias = (s1W - s2W) * 8;
  return Math.min(88, Math.max(12, Math.round(gameShare + setBias)));
}

export function computeSimMatchScores(m, bestOf = 3, forcedWinnerNumber = 0, surface = 'Хард', tourneyName = 'Турнир ATP', stage = '', options = {}) {
  const req = bestOf === 5 ? 3 : 2;
  const r1 = (m.p1 && m.p1.rank) ? m.p1.rank : 100;
  const r2 = (m.p2 && m.p2.rank) ? m.p2.rank : 100;
  const rankDiff = r2 - r1;

  const p1Stamina = (m.p1 && typeof m.p1.stamina === 'number') ? m.p1.stamina : 100;
  const p2Stamina = (m.p2 && typeof m.p2.stamina === 'number') ? m.p2.stamina : 100;

  // Определяем фаворита и аутсайдера (20% шанс апсета, если победитель не задан принудительно)
  const p1IsFavorite = r1 <= r2;
  let p1WinsMatch;
  if (forcedWinnerNumber === 1) {
    p1WinsMatch = true;
  } else if (forcedWinnerNumber === 2) {
    p1WinsMatch = false;
  } else {
    const surfBonus1 = getSurfaceAffinityBonus(m.p1, surface);
    const surfBonus2 = getSurfaceAffinityBonus(m.p2, surface);
    const staminaEdge = (p1Stamina - p2Stamina) * 0.0025;
    const upsetProb = Math.min(0.38, Math.max(0.15, 0.20 + (p1IsFavorite ? (surfBonus2 - surfBonus1 - staminaEdge) : (surfBonus1 - surfBonus2 + staminaEdge))));
    const isUpset = Math.random() < upsetProb;
    p1WinsMatch = p1IsFavorite ? !isUpset : isUpset;
  }

  // Проверка технического отказа (RET): если разрешено options.allowRetirement (или у игрока критическое истощение < 35%)
  const loserStamina = p1WinsMatch ? p2Stamina : p1Stamina;
  const criticalFatigue = loserStamina < 35;
  const allowRet = options.allowRetirement !== false && forcedWinnerNumber === 0;
  const retChance = criticalFatigue ? 0.22 : (options.allowRandomInjury ? 0.015 : 0);

  if (allowRet && retChance > 0 && Math.random() < retChance) {
    const firstSet = generateRealisticTennisSet(p1WinsMatch, false, rankDiff);
    const midGames = p1WinsMatch
      ? pickRandomItem(['3-1', '4-1', '2-0', '3-2', '1-0'])
      : pickRandomItem(['1-3', '1-4', '0-2', '2-3', '0-1']);
    const retScores = [firstSet, midGames, 'RET'];
    const winner = p1WinsMatch ? m.p1 : m.p2;
    const loser = p1WinsMatch ? m.p2 : m.p1;
    const effectiveStage = stage || m?.stageLabel || '';
    const narrative = generateMatchNarrative(winner, loser, retScores, surface, tourneyName, effectiveStage);
    const { winnerQuote, loserQuote } = generateMatchQuotes(winner, loser, retScores, surface, tourneyName, effectiveStage);
    const staminaCost = applyMatchFatigueToPlayers(m.p1, m.p2, retScores, bestOf);
    return {
      winner,
      scores: retScores,
      isRetirement: true,
      staminaCost,
      momentumP1: computeMatchMomentumPercent(retScores),
      narrative,
      storyline: narrative,
      winnerQuote,
      loserQuote
    };
  }

  // В 45% матчей генерируем полноценный 3-сетовый (или 4-5 сетовый для ТБШ) триллер
  const isThriller = Math.random() < 0.45;
  let scores = [];

  if (bestOf === 3) {
    if (isThriller) {
      // 3-сетовый триллер: победитель берет 2 сета, проигравший — 1 сет (в 1-м или 2-м сете)
      const loserTakesFirst = Math.random() < 0.5;
      const setWinners = loserTakesFirst
        ? [!p1WinsMatch, p1WinsMatch, p1WinsMatch]
        : [p1WinsMatch, !p1WinsMatch, p1WinsMatch];
      scores = setWinners.map((w, idx) => generateRealisticTennisSet(w, idx === 2, rankDiff));
    } else {
      scores = [
        generateRealisticTennisSet(p1WinsMatch, false, rankDiff),
        generateRealisticTennisSet(p1WinsMatch, false, rankDiff)
      ];
    }
  } else {
    // best-of-5
    let p1W = 0;
    let p2W = 0;
    const targetLoserSets = isThriller ? (Math.random() < 0.55 ? 2 : 1) : 0;
    const setOrder = [];
    for (let i = 0; i < targetLoserSets; i++) setOrder.push(!p1WinsMatch);
    for (let i = 0; i < 2; i++) setOrder.push(p1WinsMatch);
    // Перемешиваем первые сеты, а решающий всегда за победителем
    for (let i = setOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [setOrder[i], setOrder[j]] = [setOrder[j], setOrder[i]];
    }
    setOrder.push(p1WinsMatch);
    scores = setOrder.map((w, idx) => {
      if (w) p1W++;
      else p2W++;
      const isFifthTB = idx === 4 && p1W + p2W === 5;
      return generateRealisticTennisSet(w, isFifthTB, rankDiff);
    });
  }

  scores = sanitizeTemplateScore(scores, p1WinsMatch, bestOf);

  const winner = p1WinsMatch ? m.p1 : m.p2;
  const loser = p1WinsMatch ? m.p2 : m.p1;
  const effectiveStage = stage || m?.stageLabel || '';
  const narrative = generateMatchNarrative(winner, loser, scores, surface, tourneyName, effectiveStage);
  const { winnerQuote, loserQuote } = generateMatchQuotes(winner, loser, scores, surface, tourneyName, effectiveStage);
  const staminaCost = applyMatchFatigueToPlayers(m.p1, m.p2, scores, bestOf);

  return {
    winner,
    scores,
    isRetirement: false,
    staminaCost,
    momentumP1: computeMatchMomentumPercent(scores),
    narrative,
    storyline: narrative,
    winnerQuote,
    loserQuote
  };
}

export function parseAndValidateScoreString(str, bestOf = 3) {
  const cleanStr = (str || '').trim();
  if (!cleanStr) {
    return { valid: false, error: 'Введите счет матча!' };
  }

  const rawTokens = cleanStr.split(/\s+/);
  const lastTokenUpper = rawTokens[rawTokens.length - 1].toUpperCase();
  const isRetirement = lastTokenUpper === 'RET' || lastTokenUpper === 'RET.';

  if (isRetirement) {
    const setTokens = rawTokens.slice(0, -1);
    if (setTokens.length === 0) {
      return { valid: false, error: 'Укажите счет геймов/сетов перед отказом RET (например: 6-4 3-1 RET).' };
    }
    let p1W = 0;
    let p2W = 0;
    let p1TotalG = 0;
    let p2TotalG = 0;
    let lastG1 = 0;
    let lastG2 = 0;

    for (let i = 0; i < setTokens.length; i++) {
      const s = setTokens[i];
      const clean = s.replace(/\(\d+\)/g, '');
      const parts = clean.split('-');
      if (parts.length !== 2) {
        return { valid: false, error: `Некорректный формат сета перед RET: "${s}".` };
      }
      const g1 = parseInt(parts[0], 10);
      const g2 = parseInt(parts[1], 10);
      if (isNaN(g1) || isNaN(g2) || g1 < 0 || g2 < 0 || g1 > 7 || g2 > 7) {
        return { valid: false, error: `Некорректный счет геймов перед RET: "${s}".` };
      }
      p1TotalG += g1;
      p2TotalG += g2;
      lastG1 = g1;
      lastG2 = g2;
      const maxG = Math.max(g1, g2);
      const minG = Math.min(g1, g2);
      const isCompletedSet = (maxG === 6 && minG <= 4) || (maxG === 7 && (minG === 5 || minG === 6));
      if (isCompletedSet) {
        if (g1 > g2) p1W++;
        else if (g2 > g1) p2W++;
      } else if (i < setTokens.length - 1) {
        return { valid: false, error: `Незавершенный сет "${s}" допустим только непосредственно перед RET.` };
      }
    }

    const p1WinsMatch = p1W !== p2W
      ? p1W > p2W
      : (lastG1 !== lastG2 ? lastG1 > lastG2 : p1TotalG >= p2TotalG);

    const normalizedSets = [...setTokens, 'RET'];
    return {
      valid: true,
      sets: normalizedSets,
      isRetirement: true,
      p1WinsMatch,
      p1W,
      p2W
    };
  }

  const sets = rawTokens;
  const req = bestOf === 5 ? 3 : 2;
  const maxSets = bestOf === 5 ? 5 : 3;
  if (sets.length > maxSets) {
    return { valid: false, error: `Слишком много сетов (${sets.length}) для формата best-of-${bestOf} (максимум ${maxSets}).` };
  }

  let p1W = 0;
  let p2W = 0;

  for (const s of sets) {
    if (p1W >= req || p2W >= req) {
      return { valid: false, error: `Лишний сет "${s}" после того, как победитель матча уже определился.` };
    }
    const clean = s.replace(/\(\d+\)/g, '');
    const parts = clean.split('-');
    if (parts.length !== 2) {
      return { valid: false, error: `Некорректный формат сета: "${s}". Используйте формат 6-4 или 7-6(5).` };
    }
    const g1 = parseInt(parts[0], 10);
    const g2 = parseInt(parts[1], 10);
    if (isNaN(g1) || isNaN(g2) || g1 === g2 || g1 < 0 || g2 < 0) {
      return { valid: false, error: `В сете "${s}" должен быть определен победитель.` };
    }
    const maxG = Math.max(g1, g2);
    const minG = Math.min(g1, g2);
    const isValidTennisSet =
      (maxG === 6 && minG <= 4) ||
      (maxG === 7 && (minG === 5 || minG === 6));
    if (!isValidTennisSet) {
      return { valid: false, error: `Недопустимый теннисный счет в сете "${s}". Допустимы 6-0..6-4, 7-5 или 7-6.` };
    }
    if (g1 > g2) p1W++;
    else if (g2 > g1) p2W++;
  }

  if (p1W < req && p2W < req) {
    return { valid: false, error: `Недостаточно выигранных сетов! Для победы требуется ${req} выигранных сета.` };
  }

  return {
    valid: true,
    sets,
    isRetirement: false,
    p1WinsMatch: p1W > p2W,
    p1W,
    p2W
  };
}

export function flipTennisScoreSets(setsOrStr) {
  const arr = Array.isArray(setsOrStr)
    ? setsOrStr
    : String(setsOrStr || '').trim().split(/\s+/).filter(Boolean);
  return arr.map(s => {
    const m = String(s).trim().match(/^(\d+)-(\d+)(\(\d+\))?$/);
    if (!m) return s;
    return `${m[2]}-${m[1]}${m[3] || ''}`;
  });
}

function clearSingleMatchFields(match) {
  if (!match) return;
  match.winner = null;
  match.score = [];
  delete match.narrative;
  delete match.storyline;
  delete match.winnerQuote;
  delete match.loserQuote;
  delete match.aiSourceLabel;
}

/**
 * Аннулирует результат сыгранного матча и каскадно очищает слоты в следующих раундах сетки,
 * куда уже успел пройти прежний победитель (или проигравший полуфинала Олимпиады).
 */
export function resetMatchResultInDraw(draw, tourneyId, rIdx, mIdx) {
  if (!draw || !draw[rIdx] || !draw[rIdx][mIdx]) return draw;
  const match = draw[rIdx][mIdx];
  clearSingleMatchFields(match);

  if (tourneyId === 'finals') {
    if (rIdx === 0 || rIdx === 1) {
      if (draw[2]) {
        draw[2].forEach(sf => {
          if (sf) {
            sf.p1 = null;
            sf.p2 = null;
            clearSingleMatchFields(sf);
          }
        });
      }
      if (draw[3] && draw[3][0]) {
        draw[3][0].p1 = null;
        draw[3][0].p2 = null;
        clearSingleMatchFields(draw[3][0]);
      }
    } else if (rIdx === 2 && draw[3] && draw[3][0]) {
      if (mIdx === 0) draw[3][0].p1 = null;
      else draw[3][0].p2 = null;
      clearSingleMatchFields(draw[3][0]);
    }
    return draw;
  }

  if (tourneyId === 'olympics' && rIdx === 4 && draw[5]) {
    const goldMatch = draw[5][0];
    const bronzeMatch = draw[5][1];
    if (goldMatch) {
      if (mIdx === 0) goldMatch.p1 = null;
      else goldMatch.p2 = null;
      clearSingleMatchFields(goldMatch);
    }
    if (bronzeMatch) {
      if (mIdx === 0) bronzeMatch.p1 = null;
      else bronzeMatch.p2 = null;
      clearSingleMatchFields(bronzeMatch);
    }
    return draw;
  }

  let currR = rIdx;
  let currM = mIdx;
  while (currR + 1 < draw.length) {
    const nextR = currR + 1;
    if (tourneyId === 'olympics' && currR === 4 && draw[5]) {
      const goldMatch = draw[5][0];
      const bronzeMatch = draw[5][1];
      if (goldMatch) {
        if (currM === 0) goldMatch.p1 = null;
        else goldMatch.p2 = null;
        clearSingleMatchFields(goldMatch);
      }
      if (bronzeMatch) {
        if (currM === 0) bronzeMatch.p1 = null;
        else bronzeMatch.p2 = null;
        clearSingleMatchFields(bronzeMatch);
      }
      break;
    }

    const nextMIdx = Math.floor(currM / 2);
    const nextMatch = draw[nextR]?.[nextMIdx];
    if (!nextMatch) break;

    if (currM % 2 === 0) {
      nextMatch.p1 = null;
    } else {
      nextMatch.p2 = null;
    }
    clearSingleMatchFields(nextMatch);

    currR = nextR;
    currM = nextMIdx;
  }

  return draw;
}

export function advanceWinnerInDraw(draw, tourneyId, rIdx, mIdx, winnerObj, scoresArray, narrativeStr = '', extraMeta = null) {
  const match = draw[rIdx][mIdx];
  match.winner = winnerObj;
  match.score = scoresArray;
  if (narrativeStr) {
    match.narrative = narrativeStr;
    match.storyline = narrativeStr;
  }
  if (extraMeta && typeof extraMeta === 'object') {
    if (extraMeta.storyline) {
      match.storyline = extraMeta.storyline;
      match.narrative = extraMeta.storyline;
    }
    if (extraMeta.winnerQuote) match.winnerQuote = extraMeta.winnerQuote;
    if (extraMeta.loserQuote) match.loserQuote = extraMeta.loserQuote;
    if (extraMeta.aiSourceLabel) match.aiSourceLabel = extraMeta.aiSourceLabel;
  }

  if (tourneyId === 'finals') {
    if (rIdx === 0 || rIdx === 1) {
      const isGroupAComplete = draw[0].every(m => m.winner);
      const isGroupBComplete = draw[1].every(m => m.winner);
      if (isGroupAComplete && isGroupBComplete) {
        const groupAStats = calculateGroupStandings(draw[0]);
        const groupBStats = calculateGroupStandings(draw[1]);
        if (groupAStats.length >= 2 && groupBStats.length >= 2) {
          draw[2][0].p1 = groupAStats[0].player;
          draw[2][0].p2 = groupBStats[1].player;
          draw[2][1].p1 = groupBStats[0].player;
          draw[2][1].p2 = groupAStats[1].player;
        }
      }
    } else if (rIdx === 2) {
      if (mIdx === 0) draw[3][0].p1 = winnerObj;
      else draw[3][0].p2 = winnerObj;
    }
  } else if (tourneyId === 'olympics') {
    if (rIdx < 4) {
      const nextMatchIdx = Math.floor(mIdx / 2);
      if (mIdx % 2 === 0) draw[rIdx + 1][nextMatchIdx].p1 = winnerObj;
      else draw[rIdx + 1][nextMatchIdx].p2 = winnerObj;
    } else if (rIdx === 4 && draw[5]) {
      const loserObj = (match.p1 && match.p1.id === winnerObj.id) ? match.p2 : match.p1;
      const goldMatch = draw[5][0];
      const bronzeMatch = draw[5][1];
      if (mIdx === 0) {
        if (goldMatch) goldMatch.p1 = winnerObj;
        if (bronzeMatch) bronzeMatch.p1 = loserObj;
      } else {
        if (goldMatch) goldMatch.p2 = winnerObj;
        if (bronzeMatch) bronzeMatch.p2 = loserObj;
      }
    }
  } else {
    if (rIdx + 1 < draw.length) {
      const nextMatchIdx = Math.floor(mIdx / 2);
      if (mIdx % 2 === 0) draw[rIdx + 1][nextMatchIdx].p1 = winnerObj;
      else draw[rIdx + 1][nextMatchIdx].p2 = winnerObj;
    }
  }
}

export function getStageNameForRound(tourney, rIdx, mObj = null) {
  if (mObj && mObj.stageLabel) return mObj.stageLabel;
  if (tourney.id === 'finals') {
    if (rIdx === 0) return 'Группа А';
    if (rIdx === 1) return 'Группа Б';
    if (rIdx === 2) return 'Полуфинал';
    return 'Финал';
  }
  if (tourney.id === 'olympics' || tourney.isOlympics) {
    return (rNamesOlympics[rIdx] || `Раунд ${rIdx + 1}`).replace(' 🏅', '');
  }
  const rNames = tourney.size === 128 ? rNames128 : (tourney.size === 64 ? rNames64 : rNames32);
  return (rNames[rIdx] || `Раунд ${rIdx + 1}`).replace(' 🏆', '');
}

export function getHeadToHeadAnalytics(p1Id, p2Id, tournaments, maxYear = 2024, storageGetter = null, p1Name = '', p2Name = '') {
  let p1Wins = 0;
  let p2Wins = 0;
  const surfaceStats = {
    "Хард": [0, 0],
    "Грунт": [0, 0],
    "Трава": [0, 0],
    "Зал": [0, 0]
  };
  const history = [];

  const normP1Name = String(p1Name || '').trim().toLowerCase();
  const normP2Name = String(p2Name || '').trim().toLowerCase();

  if (!p1Id || !p2Id || String(p1Id) === String(p2Id)) {
    return { p1Wins, p2Wins, surfaceStats, history, emptyMessage: '0 : 0 • Первая очная дуэль' };
  }
  if (normP1Name && normP2Name && normP1Name === normP2Name) {
    return { p1Wins, p2Wins, surfaceStats, history, emptyMessage: '0 : 0 • Первая очная дуэль' };
  }

  // Набор допустимых ID для Игрока 1 и Игрока 2 (текущий ID + канонический ID по базе 300 игроков на случай сдвига ID между сезонами)
  const validP1Ids = new Set([String(p1Id)]);
  const validP2Ids = new Set([String(p2Id)]);
  if (normP1Name && CANONICAL_ID_BY_NAME.has(normP1Name)) {
    validP1Ids.add(CANONICAL_ID_BY_NAME.get(normP1Name));
  }
  if (normP2Name && CANONICAL_ID_BY_NAME.has(normP2Name)) {
    validP2Ids.add(CANONICAL_ID_BY_NAME.get(normP2Name));
  }

  // Объединяем переданный список турниров с полным шаблоном календаря, чтобы ни один турнир (включая ТБШ и ОИ) не выпал из выборки
  const tourneyMap = new Map();
  (FULL_CALENDAR_TEMPLATE || []).forEach(t => {
    if (t && t.id) tourneyMap.set(t.id, t);
  });
  (tournaments || []).forEach(t => {
    if (t && t.id) tourneyMap.set(t.id, t);
  });
  if (!tourneyMap.has('olympics')) {
    tourneyMap.set('olympics', {
      id: 'olympics',
      name: 'Olympic Tennis Tournament (Олимпийские игры)',
      type: 'Олимпиада',
      surface: 'Грунт',
      size: 64,
      bestOf: 3,
      isOlympics: true
    });
  }
  const allTourneys = Array.from(tourneyMap.values());

  for (let yr = maxYear; yr >= 2023; yr--) {
    allTourneys.forEach(t => {
      let drawData = null;
      if (storageGetter) {
        drawData = storageGetter(t.id, yr);
      } else if (typeof localStorage !== 'undefined') {
        try {
          const activeUnivId = localStorage.getItem('meta_active_universe_id_v1') || '1';
          const raw =
            localStorage.getItem(`draw_${activeUnivId}_${t.id}_${yr}`) ||
            localStorage.getItem(`universe_${activeUnivId}_draw_${t.id}_${yr}`) ||
            localStorage.getItem(`draw_${t.id}_${yr}`);
          drawData = raw ? JSON.parse(raw) : null;
        } catch {
          drawData = null;
        }
      }
      if (!drawData || !Array.isArray(drawData)) return;

      drawData.forEach((round, rIdx) => {
        (round || []).forEach(m => {
          if (!m || !m.p1 || !m.p2 || !m.winner) return;

          const mP1Id = String(m.p1.id || '');
          const mP2Id = String(m.p2.id || '');
          const mWinId = String(m.winner.id || '');
          if (!mP1Id || !mP2Id || mP1Id === mP2Id) return;

          const idsMatch =
            (validP1Ids.has(mP1Id) && validP2Ids.has(mP2Id)) ||
            (validP1Ids.has(mP2Id) && validP2Ids.has(mP1Id));
          if (!idsMatch) return;
          if (!validP1Ids.has(mWinId) && !validP2Ids.has(mWinId)) return;
          if (mWinId !== mP1Id && mWinId !== mP2Id) return;

          const mP1Name = String(m.p1.name || '').trim().toLowerCase();
          const mP2Name = String(m.p2.name || '').trim().toLowerCase();
          const mWinName = String(m.winner.name || '').trim().toLowerCase();

          if (normP1Name && normP2Name) {
            const namesMatch =
              (mP1Name === normP1Name && mP2Name === normP2Name) ||
              (mP1Name === normP2Name && mP2Name === normP1Name);
            if (!namesMatch) return;
            if (mWinName !== normP1Name && mWinName !== normP2Name) return;
          }

          const isP1Winner = (normP1Name && mWinName)
            ? (mWinName === normP1Name)
            : validP1Ids.has(mWinId);
          const winnerWasSlot2 = mWinId === mP2Id;

          const surf = surfaceStats[t.surface] ? t.surface : "Хард";
          let displayScores = m.score ? [...m.score] : [];
          // Если победитель стоял во 2-м слоте (m.p2), разворачиваем сеты, чтобы счет в H2H всегда читался со стороны победителя матча
          if (winnerWasSlot2) {
            displayScores = flipTennisScoreSets(displayScores);
          }

          if (isP1Winner) {
            p1Wins++;
            surfaceStats[surf][0]++;
          } else {
            p2Wins++;
            surfaceStats[surf][1]++;
          }

          history.push({
            year: yr,
            tourneyId: t.id,
            tourneyName: t.name,
            surface: t.surface,
            stage: getStageNameForRound(t, rIdx, m),
            winnerId: isP1Winner ? p1Id : p2Id,
            winnerName: m.winner.name,
            scoreFormatted: formatTennisScore(displayScores),
            narrative: m.narrative || ''
          });
        });
      });
    });
  }

  return {
    p1Wins,
    p2Wins,
    surfaceStats,
    history,
    emptyMessage: history.length === 0 ? '0 : 0 • Первая очная дуэль' : ''
  };
}

export function getHeadToHeadHistory(p1Id, p2Id, tournaments, maxYear = 2024, storageGetter = null, p1Name = '', p2Name = '') {
  return getHeadToHeadAnalytics(p1Id, p2Id, tournaments, maxYear, storageGetter, p1Name, p2Name);
}

if (typeof window !== 'undefined') {
  window.formatTennisScore = formatTennisScore;
  window.generateRealisticTennisSet = generateRealisticTennisSet;
  window.isBannedTemplateScore = isBannedTemplateScore;
  window.sanitizeTemplateScore = sanitizeTemplateScore;
  window.generateMatchNarrative = generateMatchNarrative;
  window.generateMatchQuotes = generateMatchQuotes;
  window.computeSimMatchScores = computeSimMatchScores;
  window.parseAndValidateScoreString = parseAndValidateScoreString;
  window.flipTennisScoreSets = flipTennisScoreSets;
  window.resetMatchResultInDraw = resetMatchResultInDraw;
  window.advanceWinnerInDraw = advanceWinnerInDraw;
  window.getHeadToHeadAnalytics = getHeadToHeadAnalytics;
  window.getHeadToHeadHistory = getHeadToHeadHistory;
  window.calculateMatchStaminaCost = calculateMatchStaminaCost;
  window.applyMatchFatigueToPlayers = applyMatchFatigueToPlayers;
  window.resetPlayersStamina = resetPlayersStamina;
  window.computeMatchMomentumPercent = computeMatchMomentumPercent;
}
