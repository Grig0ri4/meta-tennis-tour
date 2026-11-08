/**
 * Meta Tennis Tour — Движок рейтинга, Чемпионской гонки, Олимпийских медалей, параллельных ATP 250 / Challenger и снимков Топ-50 (rankingEngine.js)
 * Модернизированная официальная шкала ATP:
 * - ТБШ (128): [10, 50, 100, 200, 400, 800, 1300, 2000] (1-й круг = 10 очков)
 * - Мастерс 1000 (64): [10, 50, 100, 200, 400, 650, 1000] (1-й круг = 10 очков)
 * - ATP 500 (32): [10, 50, 100, 200, 330, 500] (1-й круг = 10 очков)
 * - ATP 250 / Challenger (32): [10, 25, 50, 100, 165, 250] и челленджеры 175/125/100/75 (1-й круг = 10 очков)
 * - Олимпиада (64): [0, 50, 100, 200, 400, 650, 1000], Бронза = 500 (1-й круг = 0 очков)
 * - Итоговый турнир ATP (Топ-8): 200 за победу в группе (0 побед = 0 очков), +400 за 1/2, +500 за Финал (до 1500 очков)
 *
 * Строгая математика 52 недель (без виртуальных очков и отрицательного долга защиты):
 * - StartPoints_Year(p) === sum_{t in PrevYear} tournamentPoints[t.id][PrevYear]
 * - RacePoints(p) = sum_{t in CompletedRegular(Year)} tournamentPoints[t.id][Year]
 * - RemainingDefending(p) = sum_{t not in Completed(Year)} tournamentPoints[t.id][PrevYear]
 * - Points_52w(p) = RemainingDefending(p) + RacePoints(p) + FinalsPoints(p)
 */

import { calculateGroupStandings } from './drawEngine.js';
import { BG_250_NAMES } from '../data/tournaments.js';
import { PRESERVED_BASE, CALIBRATED_2023_POINTS_141_TO_300 } from '../data/players.js';
import { REAL_USER_DRAWS_2023 } from '../data/realDraws2023.js';

export const POINTS_SCALE = {
  128: [10, 50, 100, 200, 400, 800, 1300, 2000], // ТБШ (1-й круг = 10 очков)
  64: [10, 50, 100, 200, 400, 650, 1000],        // Мастерс 1000 (1-й круг = 10 очков)
  32: [10, 50, 100, 200, 330, 500]               // ATP 500 (1-й круг = 10 очков)
};

export const OLYMPICS_POINTS_SCALE = [0, 50, 100, 200, 400, 650, 1000]; // Олимпиада (1-й круг = 0 очков)

export const PARALLEL_TOUR_SCALES = {
  atp250: [10, 25, 50, 100, 165, 250],
  ch175: [10, 25, 45, 80, 115, 175],
  ch125: [10, 20, 35, 65, 90, 125],
  ch100: [10, 18, 30, 50, 75, 100],
  ch75: [10, 15, 25, 40, 60, 75]
};

/**
 * Канонический Топ-10 на старт 2024 года (02.01.2024, по итогам сезона 2023) и их истинный исторический Пик ранга.
 */
export const CANONICAL_2023_START_TOP10 = [
  { name: 'Max Kyupan', flag: 'GEO', points: 12300, peakRank: 1 },
  { name: 'Will Wentra', flag: 'NOR', points: 11950, peakRank: 1 },
  { name: 'Istep Fofol', flag: 'SLO', points: 7260, peakRank: 1 },
  { name: 'Ussistian Shifter', flag: 'USA', points: 7060, peakRank: 4 },
  { name: 'Fite Memsy Staprin', flag: '?', points: 5460, peakRank: 5 },
  { name: 'Puddy Mexalino', flag: 'CHI', points: 5000, peakRank: 4 },
  { name: 'Gary Riffay', flag: 'USA', points: 4280, peakRank: 6 },
  { name: 'Pen Klak', flag: '?', points: 3760, peakRank: 8 },
  { name: 'Omar Netigios', flag: '?', points: 3300, peakRank: 8 },
  { name: 'Shaun Salkar', flag: '?', points: 2870, peakRank: 5 }
];

export const HISTORICAL_PEAK_RANK_BY_NAME = Object.fromEntries(
  CANONICAL_2023_START_TOP10.map(item => [item.name.toLowerCase(), item.peakRank])
);

const CLEAN_REPLACEMENT_BASE_POINTS = {
  p_50: 165,
  p_61: 160,
  p_76: 155,
  p_79: 150,
  p_83: 145
};

const PRESERVED_BASE_POINTS_BY_ID = {
  ...Object.fromEntries(PRESERVED_BASE.map(p => [p.id, p.points])),
  ...(CALIBRATED_2023_POINTS_141_TO_300 || {}),
  ...CLEAN_REPLACEMENT_BASE_POINTS
};

function hashDeterministicSeed(str) {
  const s = String(str || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function getNumericPlayerId(id) {
  const num = Number(String(id || '').replace(/\D+/g, ''));
  return Number.isFinite(num) && num > 0 ? num : 999999;
}

function comparePlayersDeterministicTiebreak(a, b) {
  if (Boolean(a?.isCleanReplacement) !== Boolean(b?.isCleanReplacement)) {
    return a?.isCleanReplacement ? 1 : -1;
  }
  const baseA = Number(a?.start2023Points ?? a?.basePoints ?? PRESERVED_BASE_POINTS_BY_ID[a?.id] ?? 0);
  const baseB = Number(b?.start2023Points ?? b?.basePoints ?? PRESERVED_BASE_POINTS_BY_ID[b?.id] ?? 0);
  if (baseB !== baseA) return baseB - baseA;
  const idDiff = getNumericPlayerId(a?.id) - getNumericPlayerId(b?.id);
  if (idDiff !== 0) return idDiff;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
}

/**
 * Строит неизменяемый детерминированный порядок силы игроков (1..300),
 * который НЕ зависит от текущего мутабельного p.rank или порядка элементов в массиве players.
 */
export function buildDeterministicStrengthOrderMap(players) {
  const { startRankMap } = buildCanonical2023StartMap(players || []);
  const sorted = [...(players || [])].sort((a, b) => {
    if (Boolean(a?.isCleanReplacement) !== Boolean(b?.isCleanReplacement)) {
      return a?.isCleanReplacement ? 1 : -1;
    }
    const rA = startRankMap[a?.id] ?? 999;
    const rB = startRankMap[b?.id] ?? 999;
    if (rA !== rB) return rA - rB;
    return comparePlayersDeterministicTiebreak(a, b);
  });
  return new Map(sorted.map((p, idx) => [p.id, idx + 1]));
}

export function getCanonicalHistoricalPeakRank(playerName, fallbackRank = 300) {
  const key = String(playerName || '').trim().toLowerCase();
  if (HISTORICAL_PEAK_RANK_BY_NAME[key] !== undefined) {
    return HISTORICAL_PEAK_RANK_BY_NAME[key];
  }
  return fallbackRank;
}

/**
 * Строит полную карту стартовых очков на 02 января 2024 года (Очки_Старт2023) и стартовых рангов для всех 300 игроков.
 * У Топ-10 — строгие очки итогов 2023 года, у остальных с 11 по 300 место — их реальные откалиброванные очки сезона 2023 (без виртуальных очков).
 */
export function buildCanonical2023StartMap(players) {
  const startPointsMap = {};
  const startRankMap = {};
  const peakRankMap = {};
  const usedIds = new Set();

  // Если это каноническая вселенная (присутствует Max Kyupan), применяем канонический Топ-10
  const isCanonRoster = players.some(p => String(p.name || '').toLowerCase() === 'max kyupan');

  if (isCanonRoster) {
    CANONICAL_2023_START_TOP10.forEach((item, idx) => {
      const found = players.find(p => String(p.name || '').toLowerCase() === item.name.toLowerCase());
      if (found) {
        usedIds.add(found.id);
        const rank = idx + 1;
        startPointsMap[found.id] = item.points;
        startRankMap[found.id] = rank;
        peakRankMap[found.id] = item.peakRank;
      }
    });

    const remaining = players
      .filter(p => !usedIds.has(p.id))
      .map(p => ({
        player: p,
        legitBasePts: p.isCleanReplacement
          ? (CLEAN_REPLACEMENT_BASE_POINTS[p.id] || 150)
          : (PRESERVED_BASE_POINTS_BY_ID[p.id] ?? p.start2023Points ?? p.basePoints ?? 250)
      }))
      .sort((a, b) => {
        if (Boolean(a.player.isCleanReplacement) !== Boolean(b.player.isCleanReplacement)) {
          return a.player.isCleanReplacement ? 1 : -1;
        }
        if (b.legitBasePts !== a.legitBasePts) return b.legitBasePts - a.legitBasePts;
        return getNumericPlayerId(a.player.id) - getNumericPlayerId(b.player.id);
      });

    let rankCursor = 11;
    remaining.forEach(({ player, legitBasePts }) => {
      const r = rankCursor++;
      // Плавный реалистичный хвост рейтинга ATP для #240..#300 (чтобы у #290..#300 было ~140..185 очков, без 0 и без 300)
      let adjustedPts = legitBasePts;
      if (r >= 240) {
        const tailTarget = Math.round(235 - ((r - 240) / 60) * 90);
        adjustedPts = Math.min(legitBasePts, Math.max(135, tailTarget));
      }
      const cappedPts = Math.min(2810, Math.max(135, adjustedPts));
      startPointsMap[player.id] = cappedPts;
      startRankMap[player.id] = r;
      peakRankMap[player.id] = r;
    });
  } else {
    // Произвольная процедурная вселенная
    const sorted = [...players].sort((a, b) => {
      const ptsA = a.basePoints ?? a.start2023Points ?? 250;
      const ptsB = b.basePoints ?? b.start2023Points ?? 250;
      if (ptsB !== ptsA) return ptsB - ptsA;
      return getNumericPlayerId(a.id) - getNumericPlayerId(b.id);
    });
    sorted.forEach((p, idx) => {
      const r = idx + 1;
      const pts = p.basePoints ?? p.start2023Points ?? 250;
      startPointsMap[p.id] = pts;
      startRankMap[p.id] = r;
      peakRankMap[p.id] = p.historicalBestRank || r;
    });
  }

  return { startPointsMap, startRankMap, peakRankMap };
}

/**
 * Жестко инициализирует базу игроков на старт 2024 года (02.01.2024):
 * - Истинный рейтинг 52 недель по итогам 2023 года
 * - В Чемпионской Гонке у всех 300 игроков строго 0 очков (racePoints = 0)
 * - Исправленный Пик ранга (Shaun Salkar #5, Istep Fofol #1, Puddy Mexalino #4, Gary Riffay #6)
 */
export function applyCanonical2023StartStateToPlayers(players) {
  const { startPointsMap, startRankMap, peakRankMap } = buildCanonical2023StartMap(players);

  players.forEach(p => {
    const basePts = startPointsMap[p.id] !== undefined ? startPointsMap[p.id] : p.points;
    const baseRank = startRankMap[p.id] !== undefined ? startRankMap[p.id] : (p.rank || 300);
    const histPeak = peakRankMap[p.id] !== undefined ? peakRankMap[p.id] : baseRank;

    p.basePoints = basePts;
    p.start2023Points = basePts;
    p.points = basePts;
    p.remainingDefending = basePts;
    p.defendedSoFar = 0;
    p.finalsPoints = 0;
    p.rank = baseRank;
    p.seasonStartRank = baseRank;
    p.historicalBestRank = histPeak;
    p.bestRank = Math.min(histPeak, baseRank);
    p.racePoints = 0;
    p.rankChange = 0;
  });

  sortAndRankPlayers(players, false);
  return players;
}

export function calculateAgeNum(birthDateStr, currentDateStr) {
  if (!birthDateStr) return 24;
  const birth = new Date(birthDateStr);
  const current = new Date(currentDateStr || '2024-01-02');
  let age = current.getFullYear() - birth.getFullYear();
  const m = current.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && current.getDate() < birth.getDate())) age--;
  return age;
}

export function calculateAge(birthDateStr, currentDateStr) {
  if (!birthDateStr) return '—';
  return calculateAgeNum(birthDateStr, currentDateStr) + ' г.';
}

export function renderPlayerMedalsHtml(player) {
  if (!player || !player.medals) return '';
  const g = player.medals.gold || 0;
  const s = player.medals.silver || 0;
  const b = player.medals.bronze || 0;
  if (!g && !s && !b) return '';
  const badges = [];
  if (g > 0) badges.push(`<span class="medal-badge gold" title="Золотая медаль Олимпийских игр (${g})">🥇${g > 1 ? g : ''}</span>`);
  if (s > 0) badges.push(`<span class="medal-badge silver" title="Серебряная медаль Олимпийских игр (${s})">🥈${s > 1 ? s : ''}</span>`);
  if (b > 0) badges.push(`<span class="medal-badge bronze" title="Бронзовая медаль Олимпийских игр (${b})">🥉${b > 1 ? b : ''}</span>`);
  return `<span class="player-medals-inline">${badges.join('')}</span>`;
}

export function getDefendingPoints(player, tourneyId, year) {
  const prevYear = year - 1;
  if (!player || !player.tournamentPoints) return 0;
  let def = player.tournamentPoints[tourneyId]?.[prevYear] || 0;
  // Если в прошлом году была Олимпиада (раз в 4 года), её 52-недельная защита списывается в августе на неделе турнира 500_7
  if (tourneyId === '500_7' && (year % 4 !== 0)) {
    def += (player.tournamentPoints['olympics']?.[prevYear] || 0);
  }
  return def;
}

export function sortAndRankPlayers(players, updateRankChange = false) {
  const prevRanks = {};
  if (updateRankChange) {
    players.forEach(p => {
      prevRanks[p.id] = p.rank || 300;
    });
  }

  players.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const raceDiff = (b.racePoints || 0) - (a.racePoints || 0);
    if (raceDiff !== 0) return raceDiff;
    return comparePlayersDeterministicTiebreak(a, b);
  });

  players.forEach((p, idx) => {
    const newRank = idx + 1;
    if (updateRankChange && prevRanks[p.id] !== undefined) {
      p.rankChange = prevRanks[p.id] - newRank;
    } else if (p.rankChange === undefined) {
      p.rankChange = 0;
    }
    p.rank = newRank;

    const canonicalPeak = HISTORICAL_PEAK_RANK_BY_NAME[String(p.name || '').toLowerCase()];
    if (canonicalPeak !== undefined) {
      p.historicalBestRank = canonicalPeak;
      // Пик не может быть хуже исторического канонического (у Wentra пик #1, а не #2).
      // Если у игрока висел старый баг с ошибочным #1 (например, у Salkar с каноническим пиком #5), сбрасываем его
      let currentBest = p.bestRank || canonicalPeak;
      if (currentBest > canonicalPeak) {
        currentBest = canonicalPeak;
      } else if (currentBest < canonicalPeak && canonicalPeak > 1) {
        if (currentBest === 1 && (p.seasonStartRank || 999) >= canonicalPeak && newRank >= canonicalPeak) {
          currentBest = canonicalPeak;
        }
      }
      p.bestRank = Math.min(currentBest, newRank);
    } else {
      const floorPeak = p.historicalBestRank || p.seasonStartRank || newRank;
      const currentBest = (p.bestRank && p.bestRank > 1) ? p.bestRank : floorPeak;
      p.bestRank = Math.min(currentBest, newRank);
    }
  });

  return players;
}

export function calculateTournamentEarnedPoints(tourney, draw) {
  const earnedMap = {};
  const participantsList = [];
  const medalists = { gold: null, silver: null, bronze: null };
  if (!draw || draw.length === 0) {
    return { earnedMap, participantsList, medalists };
  }
  const finalMatch = draw[draw.length - 1]?.[0];

  if (tourney.id === 'finals' || tourney.type === 'Итоговый') {
    const groupAStats = calculateGroupStandings(draw[0] || []);
    const groupBStats = calculateGroupStandings(draw[1] || []);
    [...groupAStats, ...groupBStats].forEach(st => {
      // На Итоговом турнире за 0 побед в группе даётся 0 очков (200 за каждую победу в RR)
      earnedMap[st.player.id] = (st.wins * 200);
      participantsList.push(st.player);
    });

    if (draw[2] && draw[2][0] && draw[2][0].winner && draw[2][0].p1 && draw[2][0].p2) {
      const sfLoser1 = (draw[2][0].winner.id === draw[2][0].p1.id) ? draw[2][0].p2 : draw[2][0].p1;
      if (sfLoser1) earnedMap[sfLoser1.id] = (earnedMap[sfLoser1.id] || 0);
    }

    if (finalMatch && finalMatch.winner && finalMatch.p1 && finalMatch.p2) {
      const finalWinner = finalMatch.winner;
      const finalRunnerUp = (finalMatch.p1.id === finalWinner.id) ? finalMatch.p2 : finalMatch.p1;
      earnedMap[finalWinner.id] = (earnedMap[finalWinner.id] || 0) + 900;
      earnedMap[finalRunnerUp.id] = (earnedMap[finalRunnerUp.id] || 0) + 400;
    }
  } else if (tourney.id === 'olympics' || tourney.type === 'Олимпиада' || tourney.isOlympics) {
    // На Олимпиаде за вылет в 1-м круге (rIdx === 0) даётся строго 0 очков!
    const scale = OLYMPICS_POINTS_SCALE;
    draw.forEach((round, rIdx) => {
      if (rIdx < 5) {
        (round || []).forEach(m => {
          if (m && m.winner && m.p1 && m.p2) {
            const loser = (m.p1.id === m.winner.id) ? m.p2 : m.p1;
            earnedMap[loser.id] = scale[rIdx];
            if (rIdx === 0) {
              participantsList.push(m.p1, m.p2);
            }
          }
        });
      }
    });

    const goldMatch = draw[5]?.[0];
    const bronzeMatch = draw[5]?.[1];
    if (bronzeMatch && bronzeMatch.winner && bronzeMatch.p1 && bronzeMatch.p2) {
      const fourthPlace = bronzeMatch.p1.id === bronzeMatch.winner.id ? bronzeMatch.p2 : bronzeMatch.p1;
      earnedMap[fourthPlace.id] = 400;
      earnedMap[bronzeMatch.winner.id] = 500;
      medalists.bronze = bronzeMatch.winner;
    }
    if (goldMatch && goldMatch.winner && goldMatch.p1 && goldMatch.p2) {
      const silverPlayer = goldMatch.p1.id === goldMatch.winner.id ? goldMatch.p2 : goldMatch.p1;
      earnedMap[silverPlayer.id] = 650;
      earnedMap[goldMatch.winner.id] = 1000;
      medalists.silver = silverPlayer;
      medalists.gold = goldMatch.winner;
    }
  } else {
    // На всех остальных турнирах (ТБШ 128, Мастерс 64, ATP 500 32) за участие в 1-м круге даётся 10 очков!
    const scale = POINTS_SCALE[tourney.size] || POINTS_SCALE[32];
    draw.forEach((round, rIdx) => {
      (round || []).forEach(m => {
        if (m && m.winner && m.p1 && m.p2) {
          const loser = (m.p1.id === m.winner.id) ? m.p2 : m.p1;
          earnedMap[loser.id] = scale[rIdx];
          if (rIdx === 0) {
            participantsList.push(m.p1, m.p2);
          }
        }
      });
    });
    if (finalMatch && finalMatch.winner) {
      earnedMap[finalMatch.winner.id] = scale[scale.length - 1];
    }
  }

  return { earnedMap, participantsList, medalists };
}

function generateDeterministicRealisticMatchScore(p1Wins, keyPrefix) {
  const twoSetPoolP1 = [
    ['6-4', '6-4'],
    ['6-4', '6-3'],
    ['7-5', '6-4'],
    ['6-3', '6-4'],
    ['7-6(4)', '6-4'],
    ['6-4', '7-5'],
    ['7-6(5)', '6-3'],
    ['6-3', '7-5'],
    ['6-2', '6-4'],
    ['6-4', '7-6(3)'],
    ['7-5', '7-6(5)'],
    ['6-1', '6-4']
  ];
  const twoSetPoolP2 = [
    ['4-6', '4-6'],
    ['4-6', '3-6'],
    ['5-7', '4-6'],
    ['3-6', '4-6'],
    ['6-7(4)', '4-6'],
    ['4-6', '5-7'],
    ['6-7(5)', '3-6'],
    ['3-6', '5-7'],
    ['2-6', '4-6'],
    ['4-6', '6-7(3)'],
    ['5-7', '6-7(5)'],
    ['1-6', '4-6']
  ];
  const threeSetPoolP1 = [
    ['6-4', '4-6', '6-3'],
    ['4-6', '6-4', '6-4'],
    ['7-5', '3-6', '6-4'],
    ['6-7(5)', '6-4', '6-3'],
    ['6-3', '5-7', '7-5'],
    ['4-6', '7-6(4)', '6-3'],
    ['6-4', '3-6', '7-6(5)'],
    ['3-6', '6-3', '6-4'],
    ['7-6(3)', '4-6', '6-4'],
    ['5-7', '6-4', '6-2']
  ];
  const threeSetPoolP2 = [
    ['4-6', '6-4', '3-6'],
    ['6-4', '4-6', '4-6'],
    ['5-7', '6-3', '4-6'],
    ['7-6(5)', '4-6', '3-6'],
    ['3-6', '7-5', '5-7'],
    ['6-4', '6-7(4)', '3-6'],
    ['4-6', '6-3', '6-7(5)'],
    ['6-3', '3-6', '4-6'],
    ['6-7(3)', '6-4', '4-6'],
    ['7-5', '4-6', '2-6']
  ];

  const h = hashDeterministicSeed(keyPrefix);
  const isThreeSets = (h % 100) < 42;
  if (isThreeSets) {
    const list = p1Wins ? threeSetPoolP1 : threeSetPoolP2;
    return list[(h >> 3) % list.length];
  }
  const list = p1Wins ? twoSetPoolP1 : twoSetPoolP2;
  return list[(h >> 3) % list.length];
}

/**
 * Автоматически формирует и рассчитывает сетку официального турнира ATP 250 (28 участников в сетке на 32 слота):
 * - Первые 4 сеяных ([1]..[4]) ВСЕГДА пропускают 1-й раунд (BYE в 1/16 финала) и выходят сразу в 1/8 финала!
 * - Все матчи всех 5 раундов сразу заполняются реалистичным счетом без спама «баранок» 6-0.
 */
export function simulateDeterministicATP250Bracket(pool, scale, keyPrefix, strengthOrderMap = null, tourneyName = 'ATP 250') {
  const earnedByPlayerId = {};
  const details = {
    winner: null,
    finalist: null,
    semifinalists: [],
    draw: []
  };
  if (!pool || pool.length === 0) {
    return { earnedByPlayerId, details };
  }

  const entrants = pool.slice(0, 28).map((p, idx) => ({
    ...p,
    seed: idx < 8 ? (idx + 1) : null
  }));
  while (entrants.length < 28) {
    const fallback = pool[entrants.length % pool.length];
    entrants.push({ ...fallback, seed: null });
  }

  // Классическая расстановка 32-слотовой сетки ATP 250 с 4 BYE для первых 4 сеяных:
  // Слоты матчей 1/16 финала (0..15):
  // m=0: Seed 1 vs BYE
  // m=3: Seed 8 vs unseeded
  // m=4: Seed 4 vs BYE
  // m=7: Seed 5 vs unseeded
  // m=8: Seed 6 vs unseeded
  // m=11: Seed 3 vs BYE
  // m=12: Seed 7 vs unseeded
  // m=15: Seed 2 vs BYE
  const s1 = entrants[0];
  const s2 = entrants[1];
  const s3 = entrants[2];
  const s4 = entrants[3];
  const s5 = entrants[4];
  const s6 = entrants[5];
  const s7 = entrants[6];
  const s8 = entrants[7];
  const unseeded = entrants.slice(8);
  let uCursor = 0;
  const nextUnseeded = () => unseeded[uCursor++] || entrants[entrants.length - 1];

  const makeByePlayer = (seedNum) => ({
    id: `bye_atp250_${seedNum}`,
    name: 'BYE (Пропуск 1-го круга)',
    flag: 'ATP',
    rank: '—',
    isBye: true
  });

  const r0Matches = new Array(16);
  for (let mIdx = 0; mIdx < 16; mIdx++) {
    if (mIdx === 0) {
      r0Matches[mIdx] = { p1: s1, p2: makeByePlayer(1), winner: s1, score: ['BYE'], isByeMatch: true, isBye: true, narrative: `Сеяный #1 ${s1.name} пропускает 1-й раунд (BYE) и выходит сразу в 1/8 финала.` };
    } else if (mIdx === 4) {
      r0Matches[mIdx] = { p1: s4, p2: makeByePlayer(4), winner: s4, score: ['BYE'], isByeMatch: true, isBye: true, narrative: `Сеяный #4 ${s4.name} пропускает 1-й раунд (BYE) и выходит сразу в 1/8 финала.` };
    } else if (mIdx === 11) {
      r0Matches[mIdx] = { p1: s3, p2: makeByePlayer(3), winner: s3, score: ['BYE'], isByeMatch: true, isBye: true, narrative: `Сеяный #3 ${s3.name} пропускает 1-й раунд (BYE) и выходит сразу в 1/8 финала.` };
    } else if (mIdx === 15) {
      r0Matches[mIdx] = { p1: s2, p2: makeByePlayer(2), winner: s2, score: ['BYE'], isByeMatch: true, isBye: true, narrative: `Сеяный #2 ${s2.name} пропускает 1-й раунд (BYE) и выходит сразу в 1/8 финала.` };
    } else if (mIdx === 3) {
      r0Matches[mIdx] = { p1: s8, p2: nextUnseeded(), winner: null, score: [] };
    } else if (mIdx === 7) {
      r0Matches[mIdx] = { p1: s5, p2: nextUnseeded(), winner: null, score: [] };
    } else if (mIdx === 8) {
      r0Matches[mIdx] = { p1: s6, p2: nextUnseeded(), winner: null, score: [] };
    } else if (mIdx === 12) {
      r0Matches[mIdx] = { p1: s7, p2: nextUnseeded(), winner: null, score: [] };
    } else {
      r0Matches[mIdx] = { p1: nextUnseeded(), p2: nextUnseeded(), winner: null, score: [] };
    }
  }

  const draw = [
    r0Matches,
    Array.from({ length: 8 }, () => ({ p1: null, p2: null, winner: null, score: [] })),
    Array.from({ length: 4 }, () => ({ p1: null, p2: null, winner: null, score: [] })),
    Array.from({ length: 2 }, () => ({ p1: null, p2: null, winner: null, score: [] })),
    Array.from({ length: 1 }, () => ({ p1: null, p2: null, winner: null, score: [] }))
  ];

  const getOrderRank = (pl) => {
    if (!pl || !pl.id) return 999;
    if (strengthOrderMap instanceof Map && strengthOrderMap.has(pl.id)) {
      return strengthOrderMap.get(pl.id);
    }
    return Number(pl.rank) || 150;
  };

  for (let r = 0; r < 5; r++) {
    const roundMatches = draw[r];
    for (let mIdx = 0; mIdx < roundMatches.length; mIdx++) {
      const m = roundMatches[mIdx];
      if (m.isByeMatch && m.winner) {
        if (r < 4) {
          const nextM = draw[r + 1][Math.floor(mIdx / 2)];
          if (mIdx % 2 === 0) nextM.p1 = m.winner;
          else nextM.p2 = m.winner;
        }
        continue;
      }

      const a = m.p1;
      const b = m.p2;
      if (!b) {
        if (a) {
          m.winner = a;
          m.score = ['W/O'];
          if (r < 4) {
            const nextM = draw[r + 1][Math.floor(mIdx / 2)];
            if (mIdx % 2 === 0) nextM.p1 = a;
            else nextM.p2 = a;
          }
        }
        continue;
      }

      const rankA = getOrderRank(a);
      const rankB = getOrderRank(b);
      const aIsFav = rankA <= rankB;
      const rankGap = Math.abs(rankB - rankA);
      // Фавориты из Топ-30 имеют весомое преимущество на турнирах ATP 250
      const favWinProb = rankGap > 40 ? 0.80 : (rankGap > 18 ? 0.74 : 0.64);
      const probA = aIsFav ? favWinProb : (1 - favWinProb);
      const roll = (hashDeterministicSeed(`${keyPrefix}_r${r}_m${mIdx}_${a.id}_${b.id}`) % 1000) / 1000;
      const aWins = roll < probA;
      const w = aWins ? a : b;
      const l = aWins ? b : a;

      const scoreArr = generateDeterministicRealisticMatchScore(aWins, `${keyPrefix}_sc_r${r}_m${mIdx}_${a.id}_${b.id}`);
      m.winner = w;
      m.score = scoreArr;
      m.narrative = `${w.name} переиграл ${l.name} (${scoreArr.join(' ')}) на турнире «${tourneyName}».`;

      earnedByPlayerId[l.id] = scale[r];
      if (r === 3) {
        details.semifinalists.push(l);
      } else if (r === 4) {
        details.finalist = l;
      }

      if (r < 4) {
        const nextM = draw[r + 1][Math.floor(mIdx / 2)];
        if (mIdx % 2 === 0) nextM.p1 = w;
        else nextM.p2 = w;
      } else {
        earnedByPlayerId[w.id] = scale[5];
        details.winner = w;
      }
    }
  }

  details.draw = draw;
  return { earnedByPlayerId, details };
}

function simulateDeterministic32Bracket(pool, scale, keyPrefix) {
  const earnedByPlayerId = {};
  const details = {
    winner: null,
    finalist: null,
    semifinalists: []
  };
  if (!pool || pool.length === 0) {
    return { earnedByPlayerId, details };
  }

  let current = [...pool];
  for (let r = 0; r < 5; r++) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      if (!b) {
        if (a) next.push(a);
        continue;
      }
      const probRoll = (hashDeterministicSeed(`${keyPrefix}_${r}_${a.id}_${b.id}`) % 1000) / 1000;
      const aWins = probRoll < 0.62;
      const w = aWins ? a : b;
      const l = aWins ? b : a;
      earnedByPlayerId[l.id] = scale[r]; // r=0 -> 10 очков за 1-й круг!
      if (r === 3) {
        details.semifinalists.push(l);
      } else if (r === 4) {
        details.finalist = l;
      }
      next.push(w);
    }
    current = next;
  }

  if (current[0]) {
    earnedByPlayerId[current[0].id] = scale[5];
    details.winner = current[0];
  }

  return { earnedByPlayerId, details };
}

/**
 * Рассчитывает детерминированные очки еженедельных параллельных турниров ATP 250 и ATP Challenger (175/125/100/75)
 * для всех игроков вне основной сетки текущего турнира (кроме недель Итогового турнира и Олимпиады).
 * В каждом параллельном турнире за участие в 1-м круге (1/16 финала) начисляется 10 очков!
 */
export function computeWeeklyParallelTourPoints(tourney, players, mainDrawParticipantIds, year, options = {}) {
  const parallelEarnedMap = {};
  if (!tourney || tourney.id === 'finals' || tourney.id === 'olympics' || tourney.type === 'Итоговый' || tourney.type === 'Олимпиада' || tourney.isOlympics) {
    return { parallelEarnedMap, leadBracketDetails: null, leadTourneyName: '' };
  }

  const inMainSet = mainDrawParticipantIds instanceof Set
    ? mainDrawParticipantIds
    : new Set(Array.isArray(mainDrawParticipantIds) ? mainDrawParticipantIds : []);
  const mainEarnedMap = options.mainEarnedMap && typeof options.mainEarnedMap === 'object' ? options.mainEarnedMap : null;

  const strengthOrderMap = options.strengthOrderMap instanceof Map
    ? options.strengthOrderMap
    : buildDeterministicStrengthOrderMap(players);
  const excludedNamesLower = options.excludedNamesLower instanceof Set ? options.excludedNamesLower : new Set();

  const tourneyIdx = Number(options.tourneyIndex) || 0;
  const leadTourneyName = BG_250_NAMES[tourneyIdx % BG_250_NAMES.length] || BG_250_NAMES[0] || 'Женева 250';

  // 1) Формируем состав главного турнира недели ATP 250 (28 участников, первые 4 сеяных получают BYE в 1-м круге):
  // - Топ-4 мирового рейтинга (orderRank <= 4) ВСЕГДА пропускают турниры ATP 250!
  // - Игроки с #5 по #30 активно участвуют в серии ATP 250 (включая тех, кто не дошел до 1/2 основного турнира окна или не попал в сетку ATP 500)
  const atp250Candidates = (players || [])
    .filter(p => {
      if (!p || !p.id) return false;
      const nameL = String(p.name || '').toLowerCase();
      if (excludedNamesLower.has(nameL)) return false;
      const orderRank = strengthOrderMap.get(p.id) || 999;
      // Первые 4 игрока мира ВСЕГДА пропускают ATP 250
      if (orderRank <= 4) return false;

      if (!inMainSet.has(p.id)) {
        return orderRank <= 95;
      }

      // Игроки из Топ-5..32 также заявляются на турниры ATP 250 по календарной ротации (если не вышли в полуфинал/финал главного турнира недели)
      if (orderRank >= 5 && orderRank <= 32) {
        const mainPts = mainEarnedMap ? (mainEarnedMap[p.id] || 0) : 0;
        if (mainPts >= 330) return false;
        const rotRoll = hashDeterministicSeed(`atp250_entry_${year}_${tourney.id}_${p.id}`) % 100;
        const entryQuotaPct = orderRank <= 16 ? 78 : 55;
        return rotRoll < entryQuotaPct;
      }
      return false;
    })
    .sort((a, b) => {
      const ra = strengthOrderMap.get(a.id) || 999;
      const rb = strengthOrderMap.get(b.id) || 999;
      if (ra !== rb) return ra - rb;
      return getNumericPlayerId(a.id) - getNumericPlayerId(b.id);
    });

  // Если кандидатов в Топ-95 меньше 28, добираем следующих по рейтингу вне основной сетки
  if (atp250Candidates.length < 28) {
    const inCandIds = new Set(atp250Candidates.map(x => x.id));
    const backups = (players || [])
      .filter(p => p && p.id && !inCandIds.has(p.id) && !inMainSet.has(p.id) && (strengthOrderMap.get(p.id) || 999) > 4)
      .sort((a, b) => (strengthOrderMap.get(a.id) || 999) - (strengthOrderMap.get(b.id) || 999));
    while (atp250Candidates.length < 28 && backups.length > 0) {
      atp250Candidates.push(backups.shift());
    }
  }

  const atp250Pool = atp250Candidates.slice(0, 28);
  const inAtp250Set = new Set(atp250Pool.map(p => p.id));

  const { atp250, ch175, ch125, ch100, ch75 } = PARALLEL_TOUR_SCALES;
  const { earnedByPlayerId: atp250Earned, details: atp250Details } = simulateDeterministicATP250Bracket(
    atp250Pool,
    atp250,
    `${year}_${tourney.id}_atp250`,
    strengthOrderMap,
    leadTourneyName
  );
  const leadBracketDetails = {
    ...atp250Details,
    scaleMax: 250,
    tourneyName: leadTourneyName
  };
  Object.entries(atp250Earned).forEach(([pid, pts]) => {
    parallelEarnedMap[pid] = pts;
  });

  // 2) Серия турниров ATP Challenger (175 / 125 / 100 / 75) для остальных игроков вне основной сетки и вне ATP 250
  // Игроки нижней части рейтинга (#210..300) играют по реалистичному графику (~42% недель), чтобы у #290..300 было ~135..175 очков (без 0 и без 300)
  const challengerEligible = (players || [])
    .filter(p => {
      if (!p || !p.id || inMainSet.has(p.id) || inAtp250Set.has(p.id)) return false;
      const nameL = String(p.name || '').toLowerCase();
      if (excludedNamesLower.has(nameL)) return false;
      const orderRank = strengthOrderMap.get(p.id) || 999;
      if (orderRank <= 15) return false;
      if (orderRank > 200) {
        const playRoll = hashDeterministicSeed(`ch_sched_${year}_${tourney.id}_${p.id}`) % 100;
        const playProb = orderRank > 260 ? 45 : 55;
        return playRoll < playProb;
      }
      return true;
    })
    .sort((a, b) => {
      const ra = strengthOrderMap.get(a.id) || 999;
      const rb = strengthOrderMap.get(b.id) || 999;
      if (ra !== rb) return ra - rb;
      return getNumericPlayerId(a.id) - getNumericPlayerId(b.id);
    });

  const chScales = tourney.size === 32
    ? [ch175, ch175, ch125, ch100, ch75, ch75]
    : [ch175, ch125, ch100, ch75, ch75];

  for (let b = 0; b * 32 < challengerEligible.length; b++) {
    const slice = challengerEligible.slice(b * 32, (b + 1) * 32);
    const sc = chScales[Math.min(b, chScales.length - 1)];
    const { earnedByPlayerId } = simulateDeterministic32Bracket(slice, sc, `${year}_${tourney.id}_ch${b}`);
    Object.entries(earnedByPlayerId).forEach(([pid, pts]) => {
      parallelEarnedMap[pid] = pts;
    });
  }

  return { parallelEarnedMap, leadBracketDetails, leadTourneyName };
}

/**
 * Заполняет и калибрует tournamentPoints[t.id][2023] для всех 300 игроков так, чтобы:
 * 1) Очки с 14 реальных сеток автора (REAL_USER_DRAWS_2023) сохранялись один-в-один;
 * 2) Недостающие недели заполнялись детерминированными ATP 500 + параллельными ATP 250 / Challenger (10 очков за 1-й круг);
 * 3) У КАЖДОГО из 300 игроков сумма очков за 26 турниров 2023 года СТРОГО равнялась его стартовым очкам на 02.01.2024
 *    (0 виртуальных очков, 0 отрицательного долга защиты!).
 */
export function populateAndCalibrate2023TournamentPoints(players, tourneys2023, getDraw2023 = null, finalsSpecMap = {}, options = {}) {
  if (!players || players.length === 0 || !tourneys2023 || tourneys2023.length === 0) return;

  // Очищаем старые записи 2023 года
  players.forEach(p => {
    if (!p.tournamentPoints) p.tournamentPoints = {};
    tourneys2023.forEach(t => {
      if (p.tournamentPoints[t.id]) {
        delete p.tournamentPoints[t.id][2023];
      }
    });
  });

  // 1) Считаем очки по 14 главным турнирам 2023 года для определения истинной силы игроков в 2023 году
  const real14Map = {};
  players.forEach(p => { real14Map[p.id] = 0; });
  tourneys2023.forEach(t => {
    const savedDraw = typeof getDraw2023 === 'function' ? getDraw2023(t.id) : null;
    const draw = (savedDraw && savedDraw.length > 0 && REAL_USER_DRAWS_2023[t.id])
      ? savedDraw
      : REAL_USER_DRAWS_2023[t.id];
    if (draw && draw.length > 0) {
      const { earnedMap } = calculateTournamentEarnedPoints(t, draw);
      Object.entries(earnedMap).forEach(([pid, pts]) => {
        real14Map[pid] = (real14Map[pid] || 0) + pts;
      });
    }
  });

  const initialIdx = new Map(players.map((p, i) => [p.id, getNumericPlayerId(p.id) || (i + 1)]));
  const strengthSorted = [...players].sort((a, b) => {
    if (Boolean(a.isCleanReplacement) !== Boolean(b.isCleanReplacement)) {
      return a.isCleanReplacement ? 1 : -1;
    }
    const diff = (real14Map[b.id] || 0) - (real14Map[a.id] || 0);
    if (diff !== 0) return diff;
    return (initialIdx.get(a.id) || 999) - (initialIdx.get(b.id) || 999);
  });
  const strengthOrderMap = new Map(strengthSorted.map((p, i) => [p.id, i + 1]));

  const fixedTargetsByName = new Map(
    CANONICAL_2023_START_TOP10.map(x => [x.name.toLowerCase(), x.points])
  );
  fixedTargetsByName.set('shramysul leontiev', 2810);
  const excludedNamesLower = new Set(fixedTargetsByName.keys());

  const protectedTourneysMap = new Map();
  players.forEach(p => protectedTourneysMap.set(p.id, new Set()));

  tourneys2023.forEach((t, tIdx) => {
    let earnedMap = {};
    let participantsList = [];
    const savedDraw = typeof getDraw2023 === 'function' ? getDraw2023(t.id) : null;

    if (REAL_USER_DRAWS_2023[t.id]) {
      const drawToUse = (savedDraw && savedDraw.length > 0) ? savedDraw : REAL_USER_DRAWS_2023[t.id];
      const res = calculateTournamentEarnedPoints(t, drawToUse);
      earnedMap = res.earnedMap;
      participantsList = res.participantsList;
      Object.keys(earnedMap).forEach(pid => protectedTourneysMap.get(pid)?.add(t.id));
    } else if (savedDraw && savedDraw.length > 0 && savedDraw[savedDraw.length - 1]?.[0]?.winner) {
      const res = calculateTournamentEarnedPoints(t, savedDraw);
      earnedMap = res.earnedMap;
      participantsList = res.participantsList;
      const finalMatch = savedDraw[savedDraw.length - 1]?.[0];
      if (finalMatch && finalMatch.winner) {
        protectedTourneysMap.get(finalMatch.winner.id)?.add(t.id);
        const ru = finalMatch.p1?.id === finalMatch.winner.id ? finalMatch.p2 : finalMatch.p1;
        if (ru) protectedTourneysMap.get(ru.id)?.add(t.id);
      }
    } else {
      const spec = finalsSpecMap[t.id];
      const wP = spec ? players.find(x => String(x.name || '').toLowerCase() === String(spec.winnerName || '').toLowerCase()) : null;
      const ruP = spec ? players.find(x => String(x.name || '').toLowerCase() === String(spec.runnerUpName || '').toLowerCase()) : null;
      if (wP) protectedTourneysMap.get(wP.id)?.add(t.id);
      if (ruP) protectedTourneysMap.get(ruP.id)?.add(t.id);
      const pool32 = [];
      if (wP) pool32.push(wP);
      if (ruP && (!wP || ruP.id !== wP.id)) pool32.push(ruP);
      const rest = players
        .filter(p => !p.isCleanReplacement && (!wP || p.id !== wP.id) && (!ruP || p.id !== ruP.id))
        .sort((a, b) => {
          const ha = (strengthOrderMap.get(a.id) || 999) + (hashDeterministicSeed(`500entry_${t.id}_${a.id}`) % 35);
          const hb = (strengthOrderMap.get(b.id) || 999) + (hashDeterministicSeed(`500entry_${t.id}_${b.id}`) % 35);
          if (ha !== hb) return ha - hb;
          return (strengthOrderMap.get(a.id) || 999) - (strengthOrderMap.get(b.id) || 999);
        });
      while (pool32.length < 32 && rest.length > 0) {
        pool32.push(rest.shift());
      }
      const { earnedByPlayerId } = simulateDeterministic32Bracket(pool32, POINTS_SCALE[32], `2023_main500_${t.id}`);
      if (wP) earnedByPlayerId[wP.id] = 500;
      if (ruP) earnedByPlayerId[ruP.id] = 330;
      earnedMap = earnedByPlayerId;
      participantsList = pool32;
    }

    const inMainSet = new Set(Object.keys(earnedMap));
    participantsList.forEach(p => { if (p && p.id) inMainSet.add(p.id); });

    Object.entries(earnedMap).forEach(([pid, pts]) => {
      const p = players.find(x => String(x.id) === String(pid));
      if (p) {
        if (!p.tournamentPoints[t.id]) p.tournamentPoints[t.id] = {};
        p.tournamentPoints[t.id][2023] = pts;
      }
    });

    if (t.id === 'finals' || t.id === 'olympics') return;

    const { parallelEarnedMap } = computeWeeklyParallelTourPoints(t, players, inMainSet, 2023, {
      strengthOrderMap,
      excludedNamesLower,
      tourneyIndex: tIdx,
      mainEarnedMap: earnedMap
    });
    Object.entries(parallelEarnedMap).forEach(([pid, pts]) => {
      const p = players.find(x => String(x.id) === String(pid));
      if (p && !protectedTourneysMap.get(p.id)?.has(t.id)) {
        if (!p.tournamentPoints[t.id]) p.tournamentPoints[t.id] = {};
        p.tournamentPoints[t.id][2023] = (p.tournamentPoints[t.id][2023] || 0) + pts;
      }
    });
  });

  const { startPointsMap } = buildCanonical2023StartMap(players);
  const allRegIds = tourneys2023.filter(t => t.id !== 'finals').map(t => t.id);
  // Чередуем турниры второй половины сезона и первой половины, чтобы очки защиты 2023 распределялись равномерно по всему году
  const secondHalfIds = allRegIds.slice(Math.floor(allRegIds.length / 2)).reverse();
  const firstHalfIds = allRegIds.slice(0, Math.floor(allRegIds.length / 2));
  const balancedOrderIds = [];
  const maxHalfLen = Math.max(secondHalfIds.length, firstHalfIds.length);
  for (let i = 0; i < maxHalfLen; i++) {
    if (i < secondHalfIds.length) balancedOrderIds.push(secondHalfIds[i]);
    if (i < firstHalfIds.length) balancedOrderIds.push(firstHalfIds[i]);
  }
  const resetLivePoints = options.resetLivePoints !== false;

  players.forEach(p => {
    const target =
      fixedTargetsByName.get(String(p.name || '').toLowerCase()) ??
      startPointsMap[p.id] ??
      PRESERVED_BASE_POINTS_BY_ID[p.id] ??
      p.basePoints ??
      p.start2023Points ??
      150;
    let sum = 0;
    tourneys2023.forEach(t => { sum += (p.tournamentPoints[t.id]?.[2023] || 0); });

    if (target !== undefined) {
      let diff = target - sum;
      // В список пула для балансировки включаем ТОЛЬКО турниры, где у игрока не было реальной сетки
      const protectedSet = protectedTourneysMap.get(p.id) || new Set();
      const poolIds = balancedOrderIds.filter(tid => !protectedSet.has(tid));
      let safety = 0;
      while (diff !== 0 && safety < 40 && poolIds.length > 0) {
        safety++;
        let changed = false;
        for (const tid of poolIds) {
          if (diff === 0) break;
          if (!p.tournamentPoints[tid]) p.tournamentPoints[tid] = {};
          const cur = p.tournamentPoints[tid][2023] || 0;
          if (diff > 0) {
            const add = Math.min(diff, 90);
            p.tournamentPoints[tid][2023] = cur + add;
            diff -= add;
            changed = true;
          } else if (diff < 0 && cur > 0) {
            const sub = Math.min(-diff, cur);
            if (sub > 0) {
              p.tournamentPoints[tid][2023] = cur - sub;
              diff += sub;
              changed = true;
            }
          }
        }
        if (!changed) break;
      }
    }

    let finalSum2023 = 0;
    tourneys2023.forEach(t => { finalSum2023 += (p.tournamentPoints[t.id]?.[2023] || 0); });

    // Истинные стартовые очки на 02.01.2024 СТРОГО равны сумме всех турниров 2023 года (0 виртуальных очков!)
    p.start2023Points = finalSum2023;
    p.basePoints = finalSum2023;
    if (resetLivePoints) {
      p.points = finalSum2023;
      p.remainingDefending = finalSum2023;
    }
  });
}

/**
 * Применяет очки за завершенный турнир:
 * - В 52-недельном рейтинге действует защита очков: points = points - defending + earned
 * - В Чемпионской Гонке (Live Race) очки ТОЛЬКО накапливаются в регулярном сезоне (кроме Итогового турнира для Топ-8).
 */
export function applyTournamentPointsToPlayers(players, tourney, draw, viewingYear) {
  const { earnedMap, participantsList, medalists } = calculateTournamentEarnedPoints(tourney, draw);
  const isFinals = tourney.id === 'finals' || tourney.type === 'Итоговый';

  // Сохраняем предыдущие позиции в Чемпионской Гонке для расчета динамики мест
  const prevRaceRanks = {};
  const hadRacePointsBefore = players.some(p => (p.racePoints || 0) > 0);
  if (hadRacePointsBefore) {
    const prevRaceSorted = [...players].sort((a, b) => {
      const diff = (b.racePoints || 0) - (a.racePoints || 0);
      if (diff !== 0) return diff;
      return (a.rank || 300) - (b.rank || 300);
    });
    prevRaceSorted.forEach((p, idx) => {
      prevRaceRanks[p.id] = idx + 1;
      p._prevRaceRank = idx + 1;
    });
  } else {
    players.forEach(p => { p._prevRaceRank = 0; });
  }

  players.forEach(p => {
    const prevPoints = p.points;
    const earned = Math.max(0, earnedMap[p.id] || 0);
    const defending = getDefendingPoints(p, tourney.id, viewingYear);
    const diff = earned - defending;

    p.points = Math.max(0, p.points + diff);
    // В Чемпионской Гонке накапливаются все турниры регулярного сезона (до Итогового),
    // а очки Итогового турнира (для 8 участников) фиксируются в p.finalsPoints и общем рейтинге 52 недель!
    if (isFinals) {
      p.finalsPoints = earned;
    } else {
      p.racePoints = Math.max(p.racePoints || 0, (p.racePoints || 0) + earned);
    }

    p.lastPointsDelta = p.points - prevPoints;
    p.lastRaceDelta = earned;
    p.lastTourneyEarned = earned;
    p.lastTourneyDefended = defending;
    p.lastTourneyName = tourney.name || '';

    if (!p.tournamentPoints) p.tournamentPoints = {};
    if (!p.tournamentPoints[tourney.id]) p.tournamentPoints[tourney.id] = {};
    p.tournamentPoints[tourney.id][viewingYear] = earned;

    if (!p.medals) p.medals = { gold: 0, silver: 0, bronze: 0 };
    if (medalists.gold && p.id === medalists.gold.id) {
      p.medals.gold = (p.medals.gold || 0) + 1;
    }
    if (medalists.silver && p.id === medalists.silver.id) {
      p.medals.silver = (p.medals.silver || 0) + 1;
    }
    if (medalists.bronze && p.id === medalists.bronze.id) {
      p.medals.bronze = (p.medals.bronze || 0) + 1;
    }
  });

  // Обновляем изменение позиции в Гонке (raceRankChange)
  const newRaceSorted = [...players].sort((a, b) => {
    const diff = (b.racePoints || 0) - (a.racePoints || 0);
    if (diff !== 0) return diff;
    return (a.rank || 300) - (b.rank || 300);
  });
  newRaceSorted.forEach((p, idx) => {
    const newRaceRank = idx + 1;
    p.raceRankChange = hadRacePointsBefore && prevRaceRanks[p.id] !== undefined
      ? (prevRaceRanks[p.id] - newRaceRank)
      : 0;
  });

  return { participantsList, earnedMap, medalists };
}

export function runBackgroundATP250Tournaments(players, mainTourneyParticipants, viewingYear, tourneyIndex = 0, tourney = null) {
  try {
    const effectiveTourney = tourney || {
      id: `bg250_${tourneyIndex}`,
      name: BG_250_NAMES[tourneyIndex % BG_250_NAMES.length] || 'Женева 250',
      type: 'ATP 500',
      size: 32
    };
    if (effectiveTourney.id === 'finals' || effectiveTourney.id === 'olympics' || effectiveTourney.type === 'Итоговый' || effectiveTourney.type === 'Олимпиада') {
      return '';
    }

    const participantIds = new Set(
      (mainTourneyParticipants || []).filter(p => p && p.id).map(p => p.id)
    );
    const hasRealTourney = Boolean(tourney && tourney.id);
    const mainEarnedMap = {};
    if (hasRealTourney) {
      players.forEach(p => {
        if (p && p.id) {
          mainEarnedMap[p.id] = p.tournamentPoints?.[tourney.id]?.[viewingYear] || 0;
        }
      });
    }

    const { parallelEarnedMap, leadBracketDetails, leadTourneyName } = computeWeeklyParallelTourPoints(
      effectiveTourney,
      players,
      participantIds,
      viewingYear,
      { tourneyIndex, mainEarnedMap }
    );

    Object.entries(parallelEarnedMap).forEach(([pid, pts]) => {
      const pl = players.find(x => String(x.id) === String(pid));
      if (!pl || pts <= 0) return;
      const safeEarned = Math.max(0, pts);

      if (hasRealTourney) {
        // Защита за эту неделю уже была списана в applyTournamentPointsToPlayers, поэтому добавляем набранные очки параллельного тура
        const prevMainPts = pl.tournamentPoints?.[tourney.id]?.[viewingYear] || 0;
        pl.points = Math.max(0, (pl.points || 0) + safeEarned);
        pl.racePoints = Math.max(pl.racePoints || 0, (pl.racePoints || 0) + safeEarned);
        pl.lastPointsDelta = (pl.lastPointsDelta || 0) + safeEarned;
        pl.lastRaceDelta = prevMainPts + safeEarned;
        pl.lastTourneyEarned = prevMainPts + safeEarned;
        pl.lastTourneyName = prevMainPts > 0
          ? `${tourney.name} + ${leadTourneyName} (ATP 250)`
          : `${leadTourneyName} (ATP 250 / Challenger)`;
        if (!pl.tournamentPoints) pl.tournamentPoints = {};
        if (!pl.tournamentPoints[tourney.id]) pl.tournamentPoints[tourney.id] = {};
        pl.tournamentPoints[tourney.id][viewingYear] = prevMainPts + safeEarned;
      } else {
        const prevPoints = pl.points;
        const defending = getDefendingPoints(pl, `bg250_${leadTourneyName}`, viewingYear);
        pl.points = Math.max(0, pl.points - defending + safeEarned);
        pl.racePoints = Math.max(pl.racePoints || 0, (pl.racePoints || 0) + safeEarned);
        pl.lastPointsDelta = (pl.lastPointsDelta || 0) + (pl.points - prevPoints);
        pl.lastRaceDelta = safeEarned;
        pl.lastTourneyEarned = safeEarned;
        pl.lastTourneyDefended = defending;
        pl.lastTourneyName = `${leadTourneyName} (ATP 250)`;
        if (!pl.tournamentPoints) pl.tournamentPoints = {};
        if (!pl.tournamentPoints[`bg250_${leadTourneyName}`]) pl.tournamentPoints[`bg250_${leadTourneyName}`] = {};
        pl.tournamentPoints[`bg250_${leadTourneyName}`][viewingYear] = safeEarned;
      }
    });

    if (hasRealTourney) {
      const updatedRaceSorted = [...players].sort((a, b) => {
        const diff = (b.racePoints || 0) - (a.racePoints || 0);
        if (diff !== 0) return diff;
        return (a.rank || 300) - (b.rank || 300);
      });
      updatedRaceSorted.forEach((p, idx) => {
        const newRaceRank = idx + 1;
        if (p._prevRaceRank) {
          p.raceRankChange = p._prevRaceRank - newRaceRank;
        }
      });
    }

    if (!leadBracketDetails || !leadBracketDetails.winner || !leadBracketDetails.finalist) {
      return '';
    }

    const winner = leadBracketDetails.winner;
    const finalist = leadBracketDetails.finalist;
    const sfNames = (leadBracketDetails.semifinalists || []).map(p => p.name).join(', ');
    const winPts = leadBracketDetails.scaleMax || 250;
    const tierLabel = winPts === 250 ? 'ATP 250' : `Challenger ${winPts}`;

    return `🎾 <b>Параллельный тур недели (${leadTourneyName} · ${tierLabel} + серия Челленджеров):</b> Чемпион: <b>${winner.name}</b> (+${winPts} pts) · Финалист: <b>${finalist.name}</b> · 1/2 финала: ${sfNames || '—'} · Топ-4 сеяных [1]–[4] с BYE в 1/16 · <button type="button" class="btn-gold" onclick="openWeeklyATP250BracketModal('${tourney.id}', ${viewingYear})" style="padding:2px 9px; font-size:11.5px; margin-left:6px;">🏆 Открыть авто-сетку ATP 250</button>`;
  } catch (err) {
    console.warn("Background 250 error avoided:", err);
    return "";
  }
}

export function syncPlayers52WeekDiagnostics(players, seasonTourneys, year) {
  if (!Array.isArray(players) || !Array.isArray(seasonTourneys)) return;
  players.forEach(p => {
    let defendedSoFar = 0;
    let remainingDefending = 0;
    seasonTourneys.forEach(t => {
      if (!t) return;
      const def = getDefendingPoints(p, t.id, year);
      if (t.completed) {
        defendedSoFar += def;
      } else {
        remainingDefending += def;
      }
    });
    p.defendedSoFar = defendedSoFar;
    p.remainingDefending = remainingDefending;
  });
}

export const PLAYER_ARCHETYPES_CATALOG = {
  serve_bot: {
    id: 'serve_bot',
    icon: '⚡',
    title: 'Пушечная подача',
    titleRu: 'Пушечная подача',
    enTitle: 'Serve Bot',
    desc: 'Повышенный шанс эйсов и выигрыша на тайбрейке',
    description: 'Повышенный шанс эйсов и выигрыша на тайбрейке'
  },
  baseline_wall: {
    id: 'baseline_wall',
    icon: '🛡️',
    title: 'Бетонная стена',
    titleRu: 'Бетонная стена',
    enTitle: 'Baseline Wall',
    desc: 'Мастер затяжных розыгрышей и грунта',
    description: 'Мастер затяжных розыгрышей и грунта'
  },
  clutch_king: {
    id: 'clutch_king',
    icon: '🧊',
    title: 'Железные нервы',
    titleRu: 'Железные нервы',
    enTitle: 'Clutch King',
    desc: 'Бонус к игре на скрытых сетболах и матчболах',
    description: 'Бонус к игре на скрытых сетболах и матчболах'
  },
  clay_specialist: {
    id: 'clay_specialist',
    icon: '🚀',
    title: 'Грунтовый червь',
    titleRu: 'Грунтовый червь',
    enTitle: 'Clay Specialist',
    desc: '+4 к характеристикам на грунте',
    description: '+4 к характеристикам на грунте'
  },
  aggressive_returner: {
    id: 'aggressive_returner',
    icon: '🌪️',
    title: 'Атака с приёма',
    titleRu: 'Атака с приёма',
    enTitle: 'Aggressive Returner',
    desc: 'Острейший приём навылет со второй подачи соперника',
    description: 'Острейший приём навылет со второй подачи соперника'
  }
};

function hashPlayerSeed(player) {
  const str = String(player?.id || player?.name || 'p_1');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Рассчитывает общий рейтинг игрока (OVR 65–99) в стиле FIFA / Top Spin Ultimate Team:
 * - Топ-3: 96–99 OVR
 * - Топ-10: 90–95 OVR
 * - Топ-30: 84–89 OVR
 * - Топ-100: 75–83 OVR
 * - Топ-300: 65–74 OVR
 */
export function calculatePlayerOVR(player) {
  if (!player) return 70;
  const rank = Math.max(1, Number(player.rank) || 150);
  const points = Math.max(0, Number(player.points) || 0);

  if (rank <= 3) {
    if (rank === 1) return points >= 11500 ? 99 : 98;
    if (rank === 2) return points >= 10000 ? 98 : 97;
    return 96;
  }
  if (rank <= 10) {
    // rank 4 -> 95, rank 10 -> 90
    const ratio = (10 - rank) / 6;
    return Math.min(95, Math.max(90, Math.round(90 + ratio * 5)));
  }
  if (rank <= 30) {
    // rank 11 -> 89, rank 30 -> 84
    const ratio = (30 - rank) / 19;
    return Math.min(89, Math.max(84, Math.round(84 + ratio * 5)));
  }
  if (rank <= 100) {
    // rank 31 -> 83, rank 100 -> 75
    const ratio = (100 - rank) / 69;
    return Math.min(83, Math.max(75, Math.round(75 + ratio * 8)));
  }
  // rank 101..300+ -> 65..74
  const clampedRank = Math.min(300, rank);
  const ratio = (300 - clampedRank) / 199;
  return Math.min(74, Math.max(65, Math.round(65 + ratio * 9)));
}

/**
 * Определяет 1–2 сигнатурных архетипа (перка) игрока на основе его характеристик, страны и возраста
 */
export function getPlayerArchetypes(player, currentDateStr = '2024-01-02') {
  if (!player) return [PLAYER_ARCHETYPES_CATALOG.baseline_wall];
  const seed = hashPlayerSeed(player);
  const rank = Number(player.rank) || 100;
  const flag = String(player.flag || '').toUpperCase();
  const age = calculateAgeNum(player.birthDate, currentDateStr);
  const styleText = String(player.playStyle || '').toLowerCase();

  const clayFlags = ['ESP', 'ARG', 'BRA', 'CHI', 'ITA', 'NOR', 'FRA', 'PER', 'COL'];
  const fastFlags = ['USA', 'GEO', 'SLO', 'CRO', 'AUS', 'CAN', 'GBR', 'GER', 'RUS', 'KAZ'];

  const list = [];

  if (styleText.includes('подач') || styleText.includes('эйс')) {
    list.push(PLAYER_ARCHETYPES_CATALOG.serve_bot);
  } else if (styleText.includes('грунт')) {
    list.push(PLAYER_ARCHETYPES_CATALOG.clay_specialist);
  } else if (styleText.includes('защит') || styleText.includes('стена') || styleText.includes('контрпанч')) {
    list.push(PLAYER_ARCHETYPES_CATALOG.baseline_wall);
  } else if (styleText.includes('прием') || styleText.includes('приём') || styleText.includes('агресс')) {
    list.push(PLAYER_ARCHETYPES_CATALOG.aggressive_returner);
  }

  if (list.length === 0) {
    if (clayFlags.includes(flag) && seed % 2 === 0) {
      list.push(PLAYER_ARCHETYPES_CATALOG.clay_specialist);
    } else if (fastFlags.includes(flag) && seed % 3 === 0) {
      list.push(PLAYER_ARCHETYPES_CATALOG.serve_bot);
    } else if (age <= 24 && seed % 2 === 0) {
      list.push(PLAYER_ARCHETYPES_CATALOG.aggressive_returner);
    } else if (seed % 2 === 0) {
      list.push(PLAYER_ARCHETYPES_CATALOG.baseline_wall);
    } else {
      list.push(PLAYER_ARCHETYPES_CATALOG.serve_bot);
    }
  }

  // Второй перк для игроков Топ-50 или опытных мастеров
  if (rank <= 50 || seed % 3 !== 0) {
    let second = null;
    if (rank <= 15 || age >= 27) {
      second = PLAYER_ARCHETYPES_CATALOG.clutch_king;
    } else if (clayFlags.includes(flag)) {
      second = PLAYER_ARCHETYPES_CATALOG.baseline_wall;
    } else if (seed % 2 === 0) {
      second = PLAYER_ARCHETYPES_CATALOG.aggressive_returner;
    } else {
      second = PLAYER_ARCHETYPES_CATALOG.serve_bot;
    }
    if (second && second.id !== list[0].id) {
      list.push(second);
    }
  }

  return list.slice(0, 2);
}

/**
 * Рассчитывает 5 ключевых навыков теннисиста (50–99) для Spider Chart и карточки Ultimate Team:
 * Подача (serve), Форхенд (forehand), Бэкхенд (backhand), Выносливость (stamina), Ментальная стойкость (clutch)
 */
export function getPlayerSkills(player, surface = 'Хард', currentDateStr = '2024-01-02') {
  const ovr = calculatePlayerOVR(player);
  const seed = hashPlayerSeed(player);
  const age = calculateAgeNum(player?.birthDate, currentDateStr);
  const archetypes = getPlayerArchetypes(player, currentDateStr);
  const archIds = new Set(archetypes.map(a => a.id));

  const clampSkill = (val) => Math.min(99, Math.max(50, Math.round(val)));

  let serve = ovr + ((seed % 7) - 3);
  let forehand = ovr + (((seed >> 3) % 7) - 3);
  let backhand = ovr + (((seed >> 6) % 7) - 3);
  let stamina = ovr + (((seed >> 9) % 7) - 3);
  let clutch = ovr + (((seed >> 12) % 7) - 3);

  // Возрастные модификаторы
  if (age <= 22) {
    stamina += 3;
    clutch -= 2;
  } else if (age >= 32) {
    stamina -= 4;
    clutch += 4;
  }

  // Бонусы сигнатурных перков
  if (archIds.has('serve_bot')) serve += 5;
  if (archIds.has('baseline_wall')) {
    backhand += 4;
    stamina += 4;
  }
  if (archIds.has('clutch_king')) clutch += 5;
  if (archIds.has('aggressive_returner')) {
    forehand += 4;
    backhand += 3;
  }
  if (archIds.has('clay_specialist') && surface === 'Грунт') {
    serve += 4;
    forehand += 4;
    backhand += 4;
    stamina += 4;
    clutch += 4;
  }

  // Учет текущей усталости игрока в турнире (если stamina < 100%)
  const liveStaminaPct = (player && typeof player.stamina === 'number') ? player.stamina : 100;
  if (liveStaminaPct < 75) {
    const fatiguePenalty = Math.round((75 - liveStaminaPct) / 8);
    stamina -= fatiguePenalty;
  }

  return {
    ovr,
    serve: clampSkill(serve),
    forehand: clampSkill(forehand),
    backhand: clampSkill(backhand),
    stamina: clampSkill(stamina),
    clutch: clampSkill(clutch),
    archetypes
  };
}

export function createTop50Snapshot(players, currentTourDateStr, prevSnapshotTop50 = null) {
  const prevRankMap = {};
  if (prevSnapshotTop50 && Array.isArray(prevSnapshotTop50)) {
    prevSnapshotTop50.forEach(p => {
      if (p && p.id) prevRankMap[p.id] = p.rank;
      else if (p && p.name) prevRankMap[p.name] = p.rank;
    });
  }

  return players.slice(0, 50).map(p => {
    const prevRank = prevRankMap[p.id] || prevRankMap[p.name] || p.seasonStartRank || p.rank;
    const rankDelta = prevRank - p.rank;
    const intPoints = Math.round(Number(p.points) || 0);
    return {
      id: p.id,
      rank: p.rank,
      name: p.name,
      flag: p.flag,
      points: intPoints,
      birthDate: p.birthDate,
      age: calculateAge(p.birthDate, currentTourDateStr),
      rankDelta: rankDelta,
      medals: p.medals ? { ...p.medals } : undefined
    };
  });
}

if (typeof window !== 'undefined') {
  window.POINTS_SCALE = POINTS_SCALE;
  window.OLYMPICS_POINTS_SCALE = OLYMPICS_POINTS_SCALE;
  window.PARALLEL_TOUR_SCALES = PARALLEL_TOUR_SCALES;
  window.CANONICAL_2023_START_TOP10 = CANONICAL_2023_START_TOP10;
  window.applyCanonical2023StartStateToPlayers = applyCanonical2023StartStateToPlayers;
  window.populateAndCalibrate2023TournamentPoints = populateAndCalibrate2023TournamentPoints;
  window.computeWeeklyParallelTourPoints = computeWeeklyParallelTourPoints;
  window.calculateAgeNum = calculateAgeNum;
  window.calculateAge = calculateAge;
  window.renderPlayerMedalsHtml = renderPlayerMedalsHtml;
  window.getDefendingPoints = getDefendingPoints;
  window.sortAndRankPlayers = sortAndRankPlayers;
  window.calculateTournamentEarnedPoints = calculateTournamentEarnedPoints;
  window.applyTournamentPointsToPlayers = applyTournamentPointsToPlayers;
  window.runBackgroundATP250Tournaments = runBackgroundATP250Tournaments;
  window.syncPlayers52WeekDiagnostics = syncPlayers52WeekDiagnostics;
  window.createTop50Snapshot = createTop50Snapshot;
  window.PLAYER_ARCHETYPES_CATALOG = PLAYER_ARCHETYPES_CATALOG;
  window.calculatePlayerOVR = calculatePlayerOVR;
  window.getPlayerArchetypes = getPlayerArchetypes;
  window.getPlayerSkills = getPlayerSkills;
}
