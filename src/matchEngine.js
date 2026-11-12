/**
 * Meta Tennis Tour — Движок матчей, ИИ-сводок, сброса результатов и Личных встреч H2H (matchEngine.js)
 * Генерация реалистичного теннисного счета (45% 3-сетовых триллеров, 20% апсетов, баранки 6-0, тайбрейки,
 * запрет шаблонов 6-3 6-2 / 3-6 2-6), анализ пользовательского счета, продвижение по сетке,
 * каскадный сброс результата матча и аналитический блок H2H.
 */

import { calculateGroupStandings } from './drawEngine.js';
import { FULL_CALENDAR_TEMPLATE, rNames128, rNames64, rNamesOlympics, rNames32 } from '../data/tournaments.js';
import { buildInitial300Players } from '../data/players.js';
import { getPlayerSkills, calculateAgeNum, getYoungTalentWinBonus } from './rankingEngine.js';

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

export function parseStageType(stage = '') {
  const s = String(stage || '').toUpperCase();
  const isFinal = (s.includes('ФИНАЛ') || s === 'F' || s === 'FINAL') &&
    !s.includes('1/') && !s.includes('ПОЛУФИНАЛ') && !s.includes('ЧЕТВЕРТЬФИНАЛ');
  const isSemi = s.includes('1/2') || s.includes('ПОЛУФИНАЛ') || s === 'SF' || s === 'SEMI';
  const isBronze = s.includes('3-Е МЕСТО') || s.includes('БРОНЗ');
  const isEarlyRound = s.includes('1/64') || s.includes('1/32') || s.includes('1/16') ||
    s.includes('R128') || s.includes('R64') || s.includes('R32') || s.includes('R16') ||
    s.includes('РАУНД 1') || s.includes('РАУНД 2') || s.includes('ГРУППА');
  return { isFinal, isSemi, isBronze, isEarlyRound };
}

export function formatTennisScore(scoreArray) {
  if (!scoreArray || scoreArray.length === 0) return '';
  const arr = Array.isArray(scoreArray) ? scoreArray : String(scoreArray).split(/\s+/);
  return arr.map(setStr => setStr.replace(/\((\d+)\)/g, '<sup>$1</sup>')).join('  ');
}

export function generateRealisticTennisSet(p1Wins, isDecidingSetTB = false, rankDiff = 0, allowBagel = false, clutchAdvantage = 0) {
  const roll = Math.random();
  let score = "";

  if (p1Wins) {
    // «Баранка» 6-0 в мужском ATP-туре — очень редкое событие (~0.8% при огромной разнице в классе и не в решающем сете)
    if (allowBagel && !isDecidingSetTB && rankDiff > 55 && roll < 0.008) score = "6-0";
    else if (roll < 0.03 || (rankDiff > 45 && roll < 0.06)) score = "6-1";
    else if (roll < 0.14) score = "6-2";
    else if (roll < 0.41) score = "6-3";
    else if (roll < 0.72) score = "6-4";
    else if (roll < 0.85) score = "7-5";
    else {
      const basePoints = clutchAdvantage > 3 ? (2 + Math.floor(Math.random() * 4)) : (2 + Math.floor(Math.random() * 6));
      const loserPoints = isDecidingSetTB
        ? (Math.random() < 0.5 ? 8 + Math.floor(Math.random() * 3) : 6 + Math.floor(Math.random() * 2))
        : basePoints;
      score = `7-6(${loserPoints})`;
    }
  } else {
    if (allowBagel && !isDecidingSetTB && rankDiff < -55 && roll < 0.008) score = "0-6";
    else if (roll < 0.03 || (rankDiff < -45 && roll < 0.06)) score = "1-6";
    else if (roll < 0.14) score = "2-6";
    else if (roll < 0.41) score = "3-6";
    else if (roll < 0.72) score = "4-6";
    else if (roll < 0.85) score = "5-7";
    else {
      const basePoints = clutchAdvantage < -3 ? (2 + Math.floor(Math.random() * 4)) : (2 + Math.floor(Math.random() * 6));
      const loserPoints = isDecidingSetTB
        ? (Math.random() < 0.5 ? 8 + Math.floor(Math.random() * 3) : 6 + Math.floor(Math.random() * 2))
        : basePoints;
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
    ['7-5', '6-4'],
    ['7-6(4)', '6-4'],
    ['6-4', '6-4']
  ];
  const alternativesP2 = [
    ['4-6', '6-7(5)'],
    ['6-4', '6-7(5)', '3-6'],
    ['5-7', '6-3', '4-6'],
    ['5-7', '4-6'],
    ['6-7(4)', '4-6'],
    ['4-6', '4-6']
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
    return `Драматичный исход на «${tourneyName}»: ${loser.name} досрочно снялся с поединка при счете ${scoreText} из-за повреждения — ${winner.name} проходит дальше.`;
  }

  const { isFinal, isSemi } = parseStageType(stage);

  if (isFinal) {
    return `Триумф на «${tourneyName}» (${surface}): ${winner.name} выдержал напряжение титульного финала против ${loser.name} (${scoreText}) и завоевал главный трофей турнира!`;
  }
  if (isSemi) {
    return `Путевка в финал «${tourneyName}»: ${winner.name} переиграл ${loser.name} (${scoreText}) на покрытии «${surface}» и поборется за чемпионский кубок.`;
  }
  if (hasSuperTB) {
    return `Нервная концовка на «${tourneyName}»: ${winner.name} вырвал победу у ${loser.name} (${scoreText}) на затяжном супер-тай-брейке.`;
  }
  if (isUpset && isLongMatch) {
    return `Сенсация в сетке: андердог ${winner.name} (#${winner.rank || '—'}) сломил сопротивление фаворита ${loser.name} (#${loser.rank || '—'}) в упорной трехсетовой дуэли (${scoreText}).`;
  }
  if (hasBagel) {
    return `Убедительное доминирование: ${winner.name} навязал свой темп на корте «${surface}» и обыграл ${loser.name} (${scoreText}).`;
  }
  if (isLongMatch && hasTiebreak) {
    return `Затяжной трехсетовый триллер на «${tourneyName}»: ${winner.name} выстоял на тай-брейке и сломил сопротивление ${loser.name} (${scoreText}).`;
  }
  if (isLongMatch) {
    return `Волевая победа в борьбе за инициативу: ${winner.name} прибавил в точности в третьей партии и дожал ${loser.name} (${scoreText}).`;
  }
  return `Уверенная победа на корте «${surface}»: ${winner.name} контролировал розыгрыши на задней линии и переиграл ${loser.name} (${scoreText}).`;
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
  const { isFinal, isSemi, isBronze } = parseStageType(stage);

  if (isRetirement) {
    return {
      winnerQuote: `«Побеждать из-за отказа соперника всегда неприятно. Желаю ${loser.name} скорейшего восстановления, здоровье всегда на первом месте.»`,
      loserQuote: `«К сожалению, спазм не позволил доиграть встречу при счете ${scoreText}. Пришлось поберечь себя, чтобы не усугубить травму.»`
    };
  }

  // Параметрический шаблонизатор цитат:
  // [Контекст стадии / исхода] + [Тактический акцент покрытия]
  const surfKey = surface.toLowerCase();
  const winTactics = hasTiebreak
    ? `На тай-брейке помогла концентрация на первой подаче и глубина под заднюю линию.`
    : (hasBagel
      ? `Удалось поймать ритм на приеме и диктовать свои условия на корте (${surfKey}).`
      : (isLongMatch
        ? `В решающей партии нащупал баланс между агрессией и надежностью в розыгрышах.`
        : `План на игру сработал: плотный кросс и переводы по линии держали соперника под давлением.`));

  const loseTactics = hasTiebreak
    ? `Судьбу сета решили буквально два мяча на тай-брейке, где соперник сыграл безошибочно.`
    : (isLongMatch
      ? `В третьем сете немного просел процент первого мяча, а на второй подаче ${winner.name} сразу входил в корт.`
      : `Не хватило чистоты попадания в ключевые моменты на корте (${surfKey}), соперник заслужил победу.`);

  if (isFinal) {
    return {
      winnerQuote: `«Выиграть титул на ${tourneyName} (${scoreText}) — огромная честь и награда за работу всей недели. ${winTactics}»`,
      loserQuote: `«Обидно уступать в финале (${scoreText}), но ${winner.name} провел выдающийся турнир. ${loseTactics}»`
    };
  }
  if (isBronze) {
    return {
      winnerQuote: `«Завоевать олимпийскую медаль для своей страны (${scoreText}) — невероятные эмоции. ${winTactics}»`,
      loserQuote: `«Остаться в шаге от подиума (${scoreText}) непросто. ${loseTactics}»`
    };
  }
  if (isSemi) {
    return {
      winnerQuote: `«Выход в финал ${tourneyName} (${scoreText}) дает отличный заряд. ${winTactics} Теперь фокус на главном матче.»`,
      loserQuote: `«Тяжело останавливаться в полуфинале (${scoreText}). ${loseTactics} Сделаю выводы перед следующим стартом.»`
    };
  }

  return {
    winnerQuote: `«Доволен тем, как справился с задачей (${scoreText}). ${winTactics} Двигаемся дальше по сетке.»`,
    loserQuote: `«Сегодня не удалось навязать свой теннис (${scoreText}). ${loseTactics} Буду готовиться к следующему турниру.»`
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
 * Применяет расход выносливости к участникам матча.
 * Игроки старше 34 лет в затяжных 3-сетовых и 5-сетовых матчах теряют на 15% больше сил.
 */
export function applyMatchFatigueToPlayers(p1, p2, scoresOrStr, bestOf = 3, options = {}) {
  const drain = calculateMatchStaminaCost(scoresOrStr, bestOf);
  const arr = Array.isArray(scoresOrStr)
    ? scoresOrStr
    : String(scoresOrStr || '').trim().split(/\s+/).filter(Boolean);
  const playedSets = arr.filter(t => String(t).toUpperCase() !== 'RET').length;
  const isLongMatch = bestOf === 5 || playedSets >= 3;
  const refDateStr = options.currentDateStr || '2024-06-30';

  const applyOne = (p) => {
    if (!p || typeof p !== 'object') return;
    let personalDrain = drain;
    if (isLongMatch && calculateAgeNum(p.birthDate, refDateStr) > 34) {
      personalDrain = Math.min(60, Math.round(drain * 1.15));
    }
    const cur = typeof p.stamina === 'number' ? p.stamina : 100;
    p.stamina = Math.max(15, Math.min(100, cur - personalDrain));
  };

  applyOne(p1);
  applyOne(p2);
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
 * Восстанавливает выносливость победителя матча (отдых между кругами турнира: +15..25% стамины)
 */
export function regenerateInterRoundStamina(player, recoveryAmount = 20) {
  if (!player || typeof player !== 'object') return 100;
  const current = typeof player.stamina === 'number' ? player.stamina : 100;
  player.stamina = Math.min(100, Math.max(15, current + recoveryAmount));
  return player.stamina;
}

/**
 * Возвращает списанную за матч выносливость при аннулировании (сбросе) результата матча
 */
export function restoreMatchFatigue(match, playersList = null, bestOf = 3) {
  if (!match) return 0;
  const cost = match.staminaCost || (match.score && match.score.length > 0 ? calculateMatchStaminaCost(match.score, bestOf) : 0);

  const restoreOne = (p, preVal) => {
    if (!p || typeof p !== 'object') return;
    if (typeof preVal === 'number') {
      p.stamina = Math.min(100, Math.max(15, preVal));
    } else if (cost > 0) {
      const cur = typeof p.stamina === 'number' ? p.stamina : 100;
      p.stamina = Math.min(100, cur + cost);
    }
  };

  restoreOne(match.p1, match.p1PreStamina);
  restoreOne(match.p2, match.p2PreStamina);

  if (Array.isArray(playersList)) {
    if (match.p1?.id) {
      const p1Live = playersList.find(x => String(x.id) === String(match.p1.id));
      restoreOne(p1Live, match.p1PreStamina);
    }
    if (match.p2?.id) {
      const p2Live = playersList.find(x => String(x.id) === String(match.p2.id));
      restoreOne(p2Live, match.p2PreStamina);
    }
  }

  delete match.p1PreStamina;
  delete match.p2PreStamina;
  delete match.staminaCost;

  return cost;
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

  // Рассчитываем навыки игроков на покрытии и их клатч
  const p1Skills = getPlayerSkills(m.p1, surface);
  const p2Skills = getPlayerSkills(m.p2, surface);
  const surfKey = surface === 'Грунт' ? 'clay' : (surface === 'Трава' ? 'grass' : (surface === 'Зал' ? 'indoor' : 'hard'));
  const surf1 = p1Skills[surfKey] || 75;
  const surf2 = p2Skills[surfKey] || 75;
  const clutch1 = p1Skills.clutch || 75;
  const clutch2 = p2Skills.clutch || 75;

  const surfSkillDiff = (surf1 - surf2) * 0.005;
  const clutchDiff = (clutch1 - clutch2);
  const clutchEdge = clutchDiff * 0.003;
  const staminaEdge = (p1Stamina - p2Stamina) * 0.0025;

  // Определяем фаворита и аутсайдера с учетом навыков покрытия, клатча и выносливости
  const p1IsFavorite = r1 <= r2;
  let p1WinsMatch;
  if (forcedWinnerNumber === 1) {
    p1WinsMatch = true;
  } else if (forcedWinnerNumber === 2) {
    p1WinsMatch = false;
  } else {
    const talentRefDate = options.currentDateStr || '2024-06-30';
    const talentBonus1 = getYoungTalentWinBonus(m.p1, talentRefDate);
    const talentBonus2 = getYoungTalentWinBonus(m.p2, talentRefDate);
    const talentEdge = p1IsFavorite ? -talentBonus2 : talentBonus1;
    const upsetProb = Math.min(0.42, Math.max(0.12, 0.20 + (p1IsFavorite ? (-surfSkillDiff - clutchEdge - staminaEdge) : (surfSkillDiff + clutchEdge + staminaEdge)) + talentEdge));
    const isUpset = Math.random() < upsetProb;
    p1WinsMatch = p1IsFavorite ? !isUpset : isUpset;
  }

  // Проверка технического отказа (RET): если разрешено options.allowRetirement (или у игрока критическое истощение < 35%)
  const loserStamina = p1WinsMatch ? p2Stamina : p1Stamina;
  const criticalFatigue = loserStamina < 35;
  const allowRet = options.allowRetirement !== false && forcedWinnerNumber === 0;
  const retChance = criticalFatigue ? 0.22 : (options.allowRandomInjury ? 0.015 : 0);

  if (allowRet && retChance > 0 && Math.random() < retChance) {
    const cAdv = p1WinsMatch ? clutchDiff : -clutchDiff;
    const firstSet = generateRealisticTennisSet(p1WinsMatch, false, rankDiff, false, cAdv);
    const midGames = p1WinsMatch
      ? pickRandomItem(['3-1', '4-1', '2-0', '3-2', '1-0'])
      : pickRandomItem(['1-3', '1-4', '0-2', '2-3', '0-1']);
    const retScores = [firstSet, midGames, 'RET'];
    const winner = p1WinsMatch ? m.p1 : m.p2;
    const loser = p1WinsMatch ? m.p2 : m.p1;
    const effectiveStage = stage || m?.stageLabel || '';
    const narrative = generateMatchNarrative(winner, loser, retScores, surface, tourneyName, effectiveStage);
    const { winnerQuote, loserQuote } = generateMatchQuotes(winner, loser, retScores, surface, tourneyName, effectiveStage);
    const staminaCost = applyMatchFatigueToPlayers(m.p1, m.p2, retScores, bestOf, options);
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
      // 3-сетовый триллер: исход решающего 3-го сета существенно зависит от параметра клатча (clutch)
      if (forcedWinnerNumber === 0) {
        const deciderProb = Math.min(0.80, Math.max(0.20, 0.50 + clutchDiff * 0.015 + surfSkillDiff * 0.4));
        p1WinsMatch = Math.random() < deciderProb;
      }
      const loserTakesFirst = Math.random() < 0.5;
      const setWinners = loserTakesFirst
        ? [!p1WinsMatch, p1WinsMatch, p1WinsMatch]
        : [p1WinsMatch, !p1WinsMatch, p1WinsMatch];
      scores = setWinners.map((w, idx) => {
        const isDecider = idx === 2;
        const cAdv = w ? clutchDiff : -clutchDiff;
        return generateRealisticTennisSet(w, isDecider, rankDiff, false, cAdv);
      });
    } else {
      const cAdv = p1WinsMatch ? clutchDiff : -clutchDiff;
      const firstSet = generateRealisticTennisSet(p1WinsMatch, false, rankDiff, true, cAdv);
      const alreadyBagel = firstSet === '6-0' || firstSet === '0-6';
      const secondSet = generateRealisticTennisSet(p1WinsMatch, false, rankDiff, !alreadyBagel, cAdv);
      scores = [firstSet, secondSet];
    }
  } else {
    // best-of-5
    if (isThriller && forcedWinnerNumber === 0) {
      const deciderProb = Math.min(0.80, Math.max(0.20, 0.50 + clutchDiff * 0.018 + surfSkillDiff * 0.4));
      p1WinsMatch = Math.random() < deciderProb;
    }
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
    let bagelUsed = false;
    scores = setOrder.map((w, idx) => {
      if (w) p1W++;
      else p2W++;
      const isFifthTB = idx === 4 && p1W + p2W === 5;
      const canBagel = !bagelUsed && w === p1WinsMatch && !isThriller;
      const cAdv = w ? clutchDiff : -clutchDiff;
      const s = generateRealisticTennisSet(w, isFifthTB, rankDiff, canBagel, cAdv);
      if (s === '6-0' || s === '0-6') bagelUsed = true;
      return s;
    });
  }

  scores = sanitizeTemplateScore(scores, p1WinsMatch, bestOf);

  const winner = p1WinsMatch ? m.p1 : m.p2;
  const loser = p1WinsMatch ? m.p2 : m.p1;
  const effectiveStage = stage || m?.stageLabel || '';
  const narrative = generateMatchNarrative(winner, loser, scores, surface, tourneyName, effectiveStage);
  const { winnerQuote, loserQuote } = generateMatchQuotes(winner, loser, scores, surface, tourneyName, effectiveStage);
  const staminaCost = applyMatchFatigueToPlayers(m.p1, m.p2, scores, bestOf, options);

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

const SET_TOKEN_RE = /^(\d{1,2})-(\d{1,2})(?:\((\d{1,2})\))?$/;

function parseSetToken(token) {
  const m = SET_TOKEN_RE.exec(String(token || '').trim());
  if (!m) return null;
  return {
    g1: parseInt(m[1], 10),
    g2: parseInt(m[2], 10),
    tiebreak: m[3] !== undefined ? parseInt(m[3], 10) : null
  };
}

function isCompletedTennisSet(g1, g2) {
  const maxG = Math.max(g1, g2);
  const minG = Math.min(g1, g2);
  return (maxG === 6 && minG <= 4) || (maxG === 7 && (minG === 5 || minG === 6));
}

export function parseAndValidateScoreString(str, bestOf = 3) {
  const cleanStr = (str || '').trim();
  if (!cleanStr) {
    return { valid: false, error: 'Введите счет матча!' };
  }

  const rawTokens = cleanStr.split(/\s+/);
  const lastTokenUpper = rawTokens[rawTokens.length - 1].toUpperCase();
  const isRetirement = lastTokenUpper === 'RET' || lastTokenUpper === 'RET.';

  const req = bestOf === 5 ? 3 : 2;
  const maxSets = bestOf === 5 ? 5 : 3;

  const setTokens = isRetirement ? rawTokens.slice(0, -1) : rawTokens;
  if (setTokens.length === 0) {
    return {
      valid: false,
      error: isRetirement
        ? 'Укажите счет геймов/сетов перед отказом RET (например: 6-4 3-1 RET).'
        : 'Введите счет матча!'
    };
  }
  if (setTokens.length > maxSets) {
    return { valid: false, error: `Слишком много сетов (${setTokens.length}) для формата best-of-${bestOf} (максимум ${maxSets}).` };
  }

  let p1W = 0;
  let p2W = 0;
  let p1TotalG = 0;
  let p2TotalG = 0;

  for (let i = 0; i < setTokens.length; i++) {
    const s = setTokens[i];
    const parsed = parseSetToken(s);
    if (!parsed) {
      return {
        valid: false,
        error: isRetirement
          ? `Некорректный формат сета перед RET: "${s}".`
          : `Некорректный формат сета: "${s}". Используйте формат 6-4 или 7-6(5).`
      };
    }
    const { g1, g2, tiebreak } = parsed;
    const maxG = Math.max(g1, g2);
    const minG = Math.min(g1, g2);

    // Тайбрейк допустим только в сете со счетом 7-6 / 6-7
    if (tiebreak !== null && !(maxG === 7 && minG === 6)) {
      return { valid: false, error: `Тайбрейк в сете "${s}" допустим только при счете 7-6 или 6-7.` };
    }
    if (isRetirement && i === setTokens.length - 1 && !isCompletedTennisSet(g1, g2)) {
      // Незавершенный сет непосредственно перед RET: геймы не могут превышать 6,
      // сет не может остановиться на 6-6 и не может содержать тайбрейк
      if (g1 > 6 || g2 > 6) {
        return { valid: false, error: `Недопустимый счет незавершенного сета перед RET: "${s}". Геймы не могут превышать 6 без завершения сета.` };
      }
      if (g1 === 6 && g2 === 6) {
        return { valid: false, error: `Незавершенный сет перед RET не может остановиться на счете 6-6: "${s}".` };
      }
      if (tiebreak !== null) {
        return { valid: false, error: `Незавершенный сет перед RET не может содержать тайбрейк: "${s}".` };
      }
    } else {
      if (g1 === g2) {
        return { valid: false, error: `В сете "${s}" должен быть определен победитель.` };
      }
      if (!isCompletedTennisSet(g1, g2)) {
        if (isRetirement) {
          return { valid: false, error: `Незавершенный сет "${s}" допустим только непосредственно перед RET.` };
        }
        return { valid: false, error: `Недопустимый теннисный счет в сете "${s}". Допустимы 6-0..6-4, 7-5 или 7-6.` };
      }
      if (!isRetirement && (p1W >= req || p2W >= req)) {
        return { valid: false, error: `Лишний сет "${s}" после того, как победитель матча уже определился.` };
      }
      if (g1 > g2) p1W++;
      else p2W++;
    }

    p1TotalG += g1;
    p2TotalG += g2;
  }

  if (!isRetirement && p1W < req && p2W < req) {
    return { valid: false, error: `Недостаточно выигранных сетов! Для победы требуется ${req} выигранных сета.` };
  }

  if (isRetirement) {
    // Если матч прерван в ходе незавершенного сета, снялся отстающий игрок
    const lastSet = setTokens[setTokens.length - 1];
    const lastParsed = parseSetToken(lastSet);
    const lastSetIsComplete = isCompletedTennisSet(lastParsed.g1, lastParsed.g2);

    if (p1W >= req || p2W >= req) {
      return { valid: false, error: 'Отказ RET недопустим: победитель матча уже определился в завершенных сетах.' };
    }

    const p1WinsMatch = !lastSetIsComplete && lastParsed.g1 !== lastParsed.g2
      ? lastParsed.g1 > lastParsed.g2
      : (p1W !== p2W ? p1W > p2W : p1TotalG >= p2TotalG);

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

  return {
    valid: true,
    sets: setTokens,
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
  delete match.staminaCost;
  delete match.p1PreStamina;
  delete match.p2PreStamina;
}

/**
 * Аннулирует результат сыгранного матча и каскадно очищает слоты в следующих раундах сетки,
 * куда уже успел пройти прежний победитель (или проигравший полуфинала Олимпиады).
 * Восстанавливает выносливость участников матча (Stamina Rollback).
 */
export function resetMatchResultInDraw(draw, tourneyId, rIdx, mIdx, playersList = null) {
  if (!draw || !draw[rIdx] || !draw[rIdx][mIdx]) return draw;
  const match = draw[rIdx][mIdx];

  // Возвращаем списанную за матч выносливость участникам
  restoreMatchFatigue(match, playersList);
  clearSingleMatchFields(match);

  if (tourneyId === 'finals') {
    if (rIdx === 0 || rIdx === 1) {
      if (draw[2]) {
        draw[2].forEach(sf => {
          if (sf) {
            restoreMatchFatigue(sf, playersList);
            sf.p1 = null;
            sf.p2 = null;
            clearSingleMatchFields(sf);
          }
        });
      }
      if (draw[3] && draw[3][0]) {
        restoreMatchFatigue(draw[3][0], playersList);
        draw[3][0].p1 = null;
        draw[3][0].p2 = null;
        clearSingleMatchFields(draw[3][0]);
      }
    } else if (rIdx === 2 && draw[3] && draw[3][0]) {
      restoreMatchFatigue(draw[3][0], playersList);
      if (mIdx === 0) draw[3][0].p1 = null;
      else draw[3][0].p2 = null;
      clearSingleMatchFields(draw[3][0]);
    }
    return draw;
  }

  // Явная очистка финала и матча за 3-е место (бронзовый финал draw[5][1]) для Олимпийских игр
  if (tourneyId === 'olympics' && draw[5]) {
    const goldMatch = draw[5][0];
    const bronzeMatch = draw[5][1];

    if (rIdx === 4) {
      if (mIdx === 0) {
        if (goldMatch) { restoreMatchFatigue(goldMatch, playersList); goldMatch.p1 = null; clearSingleMatchFields(goldMatch); }
        if (bronzeMatch) { restoreMatchFatigue(bronzeMatch, playersList); bronzeMatch.p1 = null; clearSingleMatchFields(bronzeMatch); }
      } else {
        if (goldMatch) { restoreMatchFatigue(goldMatch, playersList); goldMatch.p2 = null; clearSingleMatchFields(goldMatch); }
        if (bronzeMatch) { restoreMatchFatigue(bronzeMatch, playersList); bronzeMatch.p2 = null; clearSingleMatchFields(bronzeMatch); }
      }
      return draw;
    }

    if (rIdx === 3) {
      const sfIdx = Math.floor(mIdx / 2);
      if (draw[4] && draw[4][sfIdx]) {
        restoreMatchFatigue(draw[4][sfIdx], playersList);
        if (mIdx % 2 === 0) draw[4][sfIdx].p1 = null;
        else draw[4][sfIdx].p2 = null;
        clearSingleMatchFields(draw[4][sfIdx]);
      }
      if (sfIdx === 0) {
        if (goldMatch) { restoreMatchFatigue(goldMatch, playersList); goldMatch.p1 = null; clearSingleMatchFields(goldMatch); }
        if (bronzeMatch) { restoreMatchFatigue(bronzeMatch, playersList); bronzeMatch.p1 = null; clearSingleMatchFields(bronzeMatch); }
      } else {
        if (goldMatch) { restoreMatchFatigue(goldMatch, playersList); goldMatch.p2 = null; clearSingleMatchFields(goldMatch); }
        if (bronzeMatch) { restoreMatchFatigue(bronzeMatch, playersList); bronzeMatch.p2 = null; clearSingleMatchFields(bronzeMatch); }
      }
      return draw;
    }
  }

  let currR = rIdx;
  let currM = mIdx;
  while (currR + 1 < draw.length) {
    const nextR = currR + 1;
    if (tourneyId === 'olympics' && currR === 4 && draw[5]) {
      const goldMatch = draw[5][0];
      const bronzeMatch = draw[5][1];
      if (goldMatch) {
        restoreMatchFatigue(goldMatch, playersList);
        if (currM === 0) goldMatch.p1 = null;
        else goldMatch.p2 = null;
        clearSingleMatchFields(goldMatch);
      }
      if (bronzeMatch) {
        restoreMatchFatigue(bronzeMatch, playersList);
        if (currM === 0) bronzeMatch.p1 = null;
        else bronzeMatch.p2 = null;
        clearSingleMatchFields(bronzeMatch);
      }
      break;
    }

    const nextMIdx = Math.floor(currM / 2);
    const nextMatch = draw[nextR]?.[nextMIdx];
    if (!nextMatch) break;

    restoreMatchFatigue(nextMatch, playersList);
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
  window.calculateMatchStaminaCost = calculateMatchStaminaCost;
  window.applyMatchFatigueToPlayers = applyMatchFatigueToPlayers;
  window.resetPlayersStamina = resetPlayersStamina;
  window.regenerateInterRoundStamina = regenerateInterRoundStamina;
  window.restoreMatchFatigue = restoreMatchFatigue;
  window.computeMatchMomentumPercent = computeMatchMomentumPercent;
}
