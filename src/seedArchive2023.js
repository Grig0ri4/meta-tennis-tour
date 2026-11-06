/**
 * Meta Tennis Tour — Инициализация архива сезона 2023 и канонического старта 02 Января 2024 (seedArchive2023.js)
 * Зафиксированные истинные данные сезона 2023 года:
 * - Игрок года (World #1) по итогам 2023: GEO Max Kyupan — 12 300 pts (Пик: #1)
 * - Итоговый Топ-10 за 2023 год (и стартовая база на 02 января 2024):
 *   1. GEO Max Kyupan — 12 300 pts (Пик: #1)
 *   2. NOR Will Wentra — 11 950 pts (Пик: #2)
 *   3. SLO Istep Fofol — 6 800 pts (Пик: #1, исторический)
 *   4. USA Ussistian Shifter — 5 050 pts (Пик: #4)
 *   5. ? Fite Memsy Staprin — 4 690 pts (Пик: #5)
 *   6. CHI Puddy Mexalino — 4 060 pts (Пик: #4)
 *   7. USA Gary Riffay — 3 800 pts (Пик: #6)
 *   8. ? Omar Netigios — 3 300 pts (Пик: #8)
 *   9. ? Pen Klak — 3 130 pts (Пик: #9)
 *   10. ? Shaun Salkar — 2 870 pts (Пик: #5)
 */

import { createTournamentDraw } from './drawEngine.js';
import { computeSimMatchScores, advanceWinnerInDraw } from './matchEngine.js';
import {
  CANONICAL_2023_START_TOP10,
  buildCanonical2023StartMap,
  applyCanonical2023StartStateToPlayers,
  populateAndCalibrate2023TournamentPoints,
  calculateAge,
  createTop50Snapshot
} from './rankingEngine.js';
import { buildFallbackFinalPressColumn } from './aiService.js';
import { REAL_USER_DRAWS_2023 } from '../data/realDraws2023.js';

export const HISTORICAL_2023_TOP10 = CANONICAL_2023_START_TOP10;

// Канонические финалы турниров 2023 года (с очками тайбрейков для верхнего индекса в Зале Славы)
export const HISTORICAL_2023_FINALS = {
  m_1: { winnerName: 'Istep Fofol', runnerUpName: 'Max Kyupan', score: '7-6(4) 7-5', p1IsWinner: true },
  tbsh_1: { winnerName: 'Istep Fofol', runnerUpName: 'Max Kyupan', score: '4-6 7-6(1) 3-6 7-6(4) 6-3', p1IsWinner: true },
  '500_1': { winnerName: 'Ussistian Shifter', runnerUpName: 'Fite Memsy Staprin', score: '6-4 6-4', p1IsWinner: true },
  '500_2': { winnerName: 'Puddy Mexalino', runnerUpName: 'Omar Netigios', score: '6-3 7-5', p1IsWinner: true },
  '500_3': { winnerName: 'Gary Riffay', runnerUpName: 'Pen Klak', score: '7-6(4) 6-3', p1IsWinner: true },
  m_2: { winnerName: 'Fite Memsy Staprin', runnerUpName: 'Ussistian Shifter', score: '6-7(3) 4-6', p1IsWinner: false },
  m_3: { winnerName: 'Max Kyupan', runnerUpName: 'Ussistian Shifter', score: '3-6 4-6', p1IsWinner: false },
  m_4: { winnerName: 'Will Wentra', runnerUpName: 'Sepsor Loreo', score: '6-2 3-6 7-5', p1IsWinner: true },
  '500_4': { winnerName: 'Puddy Mexalino', runnerUpName: 'Shaun Salkar', score: '7-6(5) 6-4', p1IsWinner: true },
  m_5: { winnerName: 'Will Wentra', runnerUpName: 'Putter Price', score: '2-6 3-6', p1IsWinner: false },
  '500_5': { winnerName: 'Fite Memsy Staprin', runnerUpName: 'Markon Leoxan', score: '6-4 6-7(3) 6-3', p1IsWinner: true },
  tbsh_2: { winnerName: 'Will Wentra', runnerUpName: 'Puddy Mexalino', score: '6-7(1) 1-6 4-6', p1IsWinner: false },
  '500_6': { winnerName: 'Ussistian Shifter', runnerUpName: 'Robert Galley', score: '6-4 7-6(4)', p1IsWinner: true },
  '500_7': { winnerName: 'Will Wentra', runnerUpName: 'Gary Riffay', score: '6-3 6-4', p1IsWinner: true },
  m_6: { winnerName: 'Will Wentra', runnerUpName: 'Max Kyupan', score: '2-6 6-7(2)', p1IsWinner: false },
  tbsh_3: { winnerName: 'Will Wentra', runnerUpName: 'Max Kyupan', score: '6-2 6-3 3-6 6-4', p1IsWinner: true },
  '500_8': { winnerName: 'Omar Netigios', runnerUpName: 'Pusto Gerl', score: '7-5 6-4', p1IsWinner: true },
  '500_9': { winnerName: 'Pen Klak', runnerUpName: 'Shramysul Leontiev', score: '6-4 7-6(5)', p1IsWinner: true },
  m_7: { winnerName: 'Max Kyupan', runnerUpName: 'Will Wentra', score: '6-7(7) 7-5 3-6', p1IsWinner: false },
  tbsh_4: { winnerName: 'Max Kyupan', runnerUpName: 'Ussistian Shifter', score: '6-2 7-6(1) 3-6 6-7(3) 2-6', p1IsWinner: false },
  '500_10': { winnerName: 'Gary Riffay', runnerUpName: 'Mercon Leri Toblik', score: '6-3 7-6(4)', p1IsWinner: true },
  '500_11': { winnerName: 'Max Kyupan', runnerUpName: 'Fite Memsy Staprin', score: '6-4 6-3', p1IsWinner: true },
  m_8: { winnerName: 'Max Kyupan', runnerUpName: 'Will Wentra', score: '4-6 6-3 4-6', p1IsWinner: false },
  '500_12': { winnerName: 'Will Wentra', runnerUpName: 'Shaun Salkar', score: '6-4 7-5', p1IsWinner: true },
  m_9: { winnerName: 'Ussistian Shifter', runnerUpName: 'Istep Fofol', score: '6-7(5) 6-7(3)', p1IsWinner: false },
  finals: { winnerName: 'Max Kyupan', runnerUpName: 'Will Wentra', score: '7-6(5) 6-7(5) 4-6', p1IsWinner: false }
};

// Канонические промежуточные очки лидеров в срезах 2023 года (все числа строго круглые, кратные 10/50!)
export const HISTORICAL_2023_SNAPSHOT_LEADERS = {
  seasonStart: [
    { name: 'Istep Fofol', points: 11900 },
    { name: 'Max Kyupan', points: 11400 },
    { name: 'Will Wentra', points: 9850 },
    { name: 'Puddy Mexalino', points: 5400 },
    { name: 'Shaun Salkar', points: 4950 },
    { name: 'Ussistian Shifter', points: 4600 },
    { name: 'Gary Riffay', points: 4250 },
    { name: 'Fite Memsy Staprin', points: 3900 },
    { name: 'Shramysul Leontiev', points: 3450 },
    { name: 'Omar Netigios', points: 3150 }
  ],
  tbsh_1: [
    { name: 'Istep Fofol', points: 12500 },
    { name: 'Max Kyupan', points: 11750 },
    { name: 'Will Wentra', points: 10200 },
    { name: 'Ussistian Shifter', points: 5200 },
    { name: 'Puddy Mexalino', points: 4850 },
    { name: 'Shaun Salkar', points: 4500 },
    { name: 'Gary Riffay', points: 4100 },
    { name: 'Fite Memsy Staprin', points: 3950 },
    { name: 'Omar Netigios', points: 3250 },
    { name: 'Pen Klak', points: 3050 }
  ],
  tbsh_2: [
    { name: 'Will Wentra', points: 12600 },
    { name: 'Max Kyupan', points: 12100 },
    { name: 'Istep Fofol', points: 8400 },
    { name: 'Puddy Mexalino', points: 5300 },
    { name: 'Ussistian Shifter', points: 4950 },
    { name: 'Fite Memsy Staprin', points: 4550 },
    { name: 'Gary Riffay', points: 4150 },
    { name: 'Shaun Salkar', points: 3650 },
    { name: 'Omar Netigios', points: 3350 },
    { name: 'Pen Klak', points: 3100 }
  ],
  tbsh_3: [
    { name: 'Will Wentra', points: 13400 },
    { name: 'Max Kyupan', points: 12400 },
    { name: 'Istep Fofol', points: 7200 },
    { name: 'Ussistian Shifter', points: 5100 },
    { name: 'Fite Memsy Staprin', points: 4700 },
    { name: 'Puddy Mexalino', points: 4450 },
    { name: 'Gary Riffay', points: 3950 },
    { name: 'Omar Netigios', points: 3400 },
    { name: 'Shaun Salkar', points: 3200 },
    { name: 'Pen Klak', points: 3050 }
  ],
  tbsh_4: [
    { name: 'Max Kyupan', points: 13800 },
    { name: 'Will Wentra', points: 12200 },
    { name: 'Istep Fofol', points: 6900 },
    { name: 'Ussistian Shifter', points: 5450 },
    { name: 'Fite Memsy Staprin', points: 4750 },
    { name: 'Puddy Mexalino', points: 4200 },
    { name: 'Gary Riffay', points: 3850 },
    { name: 'Omar Netigios', points: 3350 },
    { name: 'Pen Klak', points: 3150 },
    { name: 'Shaun Salkar', points: 2950 }
  ]
};

function findPlayerByName(players, name) {
  return players.find(p => String(p.name || '').toLowerCase() === String(name || '').toLowerCase()) || players[0];
}

/**
 * Размещает канонических финалистов в разных половинах сетки до симуляции,
 * чтобы они закономерно дошли до финала без дублей и фантомных матчей в H2H.
 */
function prepareCanonicalFinalistsInDraw(draw, tId, players, spec) {
  if (!spec || !draw || draw.length === 0 || tId === 'finals') return;
  const wPlayer = findPlayerByName(players, spec.winnerName);
  const ruPlayer = findPlayerByName(players, spec.runnerUpName);
  const p1Target = spec.p1IsWinner ? wPlayer : ruPlayer;
  const p2Target = spec.p1IsWinner ? ruPlayer : wPlayer;

  const r0 = draw[0];
  if (!r0 || r0.length < 2) return;

  // Ищем, где сейчас находятся p1Target и p2Target в первом раунде
  let p1Loc = null;
  let p2Loc = null;
  for (let m = 0; m < r0.length; m++) {
    if (r0[m].p1?.id === p1Target.id) p1Loc = { m, slot: 'p1' };
    else if (r0[m].p2?.id === p1Target.id) p1Loc = { m, slot: 'p2' };
    if (r0[m].p1?.id === p2Target.id) p2Loc = { m, slot: 'p1' };
    else if (r0[m].p2?.id === p2Target.id) p2Loc = { m, slot: 'p2' };
  }

  // Помещаем p1Target в самый верхний слот (r0[0].p1), а p2Target в самый нижний слот (r0[last].p2)
  const swapIntoSlot = (targetPlayer, currentLoc, destMatchIdx, destSlot, defaultSeed) => {
    const displaced = r0[destMatchIdx][destSlot];
    const targetPrevSeed = currentLoc ? r0[currentLoc.m]?.[currentLoc.slot]?.seedNum : undefined;
    const slotSeed = displaced?.seedNum || defaultSeed;
    r0[destMatchIdx][destSlot] = { ...targetPlayer, seedNum: slotSeed, entryTag: undefined };
    if (currentLoc && (currentLoc.m !== destMatchIdx || currentLoc.slot !== destSlot) && displaced) {
      r0[currentLoc.m][currentLoc.slot] = { ...displaced, seedNum: targetPrevSeed };
    }
  };

  swapIntoSlot(p1Target, p1Loc, 0, 'p1', 1);
  // Пересчитываем p2Loc после первой перестановки
  p2Loc = null;
  for (let m = 0; m < r0.length; m++) {
    if (r0[m].p1?.id === p2Target.id) p2Loc = { m, slot: 'p1' };
    else if (r0[m].p2?.id === p2Target.id) p2Loc = { m, slot: 'p2' };
  }
  swapIntoSlot(p2Target, p2Loc, r0.length - 1, 'p2', 2);
}

export function enforceCanonicalFinalInDraw(draw, players, spec) {
  if (!spec || !draw || draw.length === 0) return;
  const wPlayer = findPlayerByName(players, spec.winnerName);
  const ruPlayer = findPlayerByName(players, spec.runnerUpName);
  const finalRound = draw[draw.length - 1];
  const finalM = finalRound[0];
  const p1 = spec.p1IsWinner ? { ...wPlayer } : { ...ruPlayer };
  const p2 = spec.p1IsWinner ? { ...ruPlayer } : { ...wPlayer };

  finalM.p1 = p1;
  finalM.p2 = p2;
  finalM.winner = { ...wPlayer };
  finalM.score = spec.score.split(' ');
}

export function build2023YearEndTop50(players, dateStr = '2023-11-19', prevList = null) {
  const prevMap = {};
  if (prevList) {
    prevList.forEach(p => { prevMap[p.id] = p.rank; });
  }

  const { startPointsMap, startRankMap, peakRankMap } = buildCanonical2023StartMap(players);
  const sortedBy2023 = [...players].sort((a, b) => (startRankMap[a.id] || 999) - (startRankMap[b.id] || 999));

  return sortedBy2023.slice(0, 50).map((p, idx) => {
    const rank = idx + 1;
    const prevRank = prevMap[p.id] !== undefined ? prevMap[p.id] : rank;
    const rawPts = startPointsMap[p.id] || p.points || 820;
    const cleanPts = Math.round(rawPts / 5) * 5;
    return {
      id: p.id,
      rank,
      name: p.name,
      flag: p.flag,
      points: cleanPts,
      bestRank: peakRankMap[p.id] || rank,
      birthDate: p.birthDate,
      age: calculateAge(p.birthDate, dateStr),
      rankDelta: prevRank - rank
    };
  });
}

/**
 * Строит исторический срез Топ-50 2023 года с точными лидерами после каждого ТБШ
 * и СТРОГО круглыми очками (кратными 10 или 50, никаких случайных хвостов вроде 12 387!).
 */
function buildCleanHistoricalSnapshot2023(players, baseEndTop50, snapshotKey, dateStr, stepOffset, prevList = null) {
  const prevMap = {};
  if (prevList && Array.isArray(prevList)) {
    prevList.forEach(p => { prevMap[p.id] = p.rank; });
  }

  const leadersSpec = HISTORICAL_2023_SNAPSHOT_LEADERS[snapshotKey] || [];
  const leaderPointsByName = new Map(
    leadersSpec.map(item => [item.name.toLowerCase(), item.points])
  );

  // Детерминированные круглые поправки (строго кратные 10!) для мест 11..50
  const deltaMultiplesOf10 = [40, -30, 60, -20, 50, -40, 30, -10, 20, -30];

  const items = baseEndTop50.map((p, idx) => {
    const overridePts = leaderPointsByName.get(String(p.name || '').toLowerCase());
    let cleanPoints;
    if (overridePts !== undefined) {
      cleanPoints = overridePts;
    } else {
      const baseRounded10 = Math.round((p.points || 850) / 10) * 10;
      const shift = deltaMultiplesOf10[(idx + stepOffset) % deltaMultiplesOf10.length];
      // Гарантируем, что места 11..50 не превышают #10 и всегда заканчиваются на 0
      cleanPoints = Math.min(2840, Math.max(750, baseRounded10 + shift));
      cleanPoints = Math.round(cleanPoints / 10) * 10;
    }
    return {
      ...p,
      points: cleanPoints,
      baseRank: idx + 1
    };
  });

  items.sort((a, b) => b.points - a.points);

  // Устраняем возможные совпадения очков у соседей с шагом 10 очков, сохраняя кратность 10
  for (let i = 11; i < items.length; i++) {
    if (items[i].points >= items[i - 1].points) {
      items[i].points = Math.max(700, items[i - 1].points - 10);
    }
  }

  return items.map((p, idx) => {
    const rank = idx + 1;
    const prevRank = prevMap[p.id] !== undefined ? prevMap[p.id] : rank;
    return {
      id: p.id,
      rank,
      name: p.name,
      flag: p.flag,
      points: p.points,
      bestRank: p.bestRank || rank,
      birthDate: p.birthDate,
      age: calculateAge(p.birthDate, dateStr),
      rankDelta: prevList ? (prevRank - rank) : 0
    };
  });
}

export function ensureDefault2023SeasonArchive(tournaments, players, seasonsHistory, storage = null) {
  const getItem = (k) => (storage ? storage.getItem(k) : (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null));
  const setItem = (k, v) => {
    try {
      if (storage) storage.setItem(k, v);
      else if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
    } catch {
      // ignore quota error
    }
  };

  // Если это произвольная (процедурная) вселенная без Max Kyupan, не перетираем ее каноническим архивом 2023
  const isCanonRoster = players.some(p => String(p.name || '').toLowerCase() === 'max kyupan');
  if (!isCanonRoster) {
    return false;
  }

  applyCanonical2023StartStateToPlayers(players);

  const tourneys2023List = (tournaments || []).filter(t => t && t.id !== 'olympics');
  const existing2023 = seasonsHistory['2023'];

  const isSnap1Clean =
    existing2023?.slamSnapshots?.tbsh_1?.top50?.[0]?.name === 'Istep Fofol' &&
    existing2023?.slamSnapshots?.tbsh_1?.top50?.[0]?.points === 12500 &&
    existing2023?.slamSnapshots?.tbsh_2?.top50?.[0]?.name === 'Will Wentra' &&
    existing2023?.slamSnapshots?.tbsh_2?.top50?.[0]?.points === 12600 &&
    existing2023?.slamSnapshots?.tbsh_3?.top50?.[0]?.points === 13400 &&
    existing2023?.slamSnapshots?.tbsh_4?.top50?.[0]?.name === 'Max Kyupan' &&
    existing2023?.slamSnapshots?.tbsh_4?.top50?.[0]?.points === 13800 &&
    existing2023?.slamSnapshots?.tbsh_1?.top50?.every(p => p.points % 5 === 0);

  const hasRealUserDrawsV6 = getItem('meta_archive_2023_real_user_draws_v6') === 'true';

  const isWorldNo1Correct =
    hasRealUserDrawsV6 &&
    isSnap1Clean &&
    existing2023 &&
    existing2023.worldNumberOne &&
    existing2023.worldNumberOne.name === 'Max Kyupan' &&
    existing2023.worldNumberOne.points === 12300 &&
    existing2023.yearEndTop50 &&
    existing2023.yearEndTop50[0]?.name === 'Max Kyupan' &&
    existing2023.yearEndTop50[1]?.name === 'Will Wentra' &&
    existing2023.yearEndTop50[2]?.name === 'Istep Fofol' &&
    existing2023.tournamentsData &&
    existing2023.tournamentsData.length >= 26 &&
    String(existing2023.tournamentsData[0]?.score || '').includes('(');

  const readDraw2023FromStorage = (tId) => {
    try {
      const raw = getItem(`draw_${tId}_2023`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return REAL_USER_DRAWS_2023?.[tId] || null;
  };

  if (isWorldNo1Correct) {
    populateAndCalibrate2023TournamentPoints(players, tourneys2023List, readDraw2023FromStorage, HISTORICAL_2023_FINALS);
    return false;
  }

  const baseEndTop50 = build2023YearEndTop50(players, '2023-11-19');

  const snapStart = buildCleanHistoricalSnapshot2023(players, baseEndTop50, 'seasonStart', '2023-01-02', 1, null);
  const snap1 = buildCleanHistoricalSnapshot2023(players, baseEndTop50, 'tbsh_1', '2023-02-05', 2, snapStart);
  const snap2 = buildCleanHistoricalSnapshot2023(players, baseEndTop50, 'tbsh_2', '2023-06-11', 3, snap1);
  const snap3 = buildCleanHistoricalSnapshot2023(players, baseEndTop50, 'tbsh_3', '2023-07-23', 4, snap2);
  const snap4 = buildCleanHistoricalSnapshot2023(players, baseEndTop50, 'tbsh_4', '2023-09-10', 5, snap3);
  const snapEnd = build2023YearEndTop50(players, '2023-11-19', snap4);

  const simPlayers2023 = players.map((p, i) => ({
    ...p,
    racePoints: Math.max(0, 6000 - i * 180)
  }));

  const tourneys2023Data = [];

  tourneys2023List.forEach(t => {
    const histSpec = HISTORICAL_2023_FINALS[t.id];
    const wTarget = histSpec ? findPlayerByName(players, histSpec.winnerName) : null;
    const ruTarget = histSpec ? findPlayerByName(players, histSpec.runnerUpName) : null;

    let draw2023 = null;
    // 1) При первой миграции на v6 обязательно загружаем истинные сетки автора из draws_2023_only.json (REAL_USER_DRAWS_2023)
    if (!hasRealUserDrawsV6 && REAL_USER_DRAWS_2023 && Array.isArray(REAL_USER_DRAWS_2023[t.id])) {
      draw2023 = JSON.parse(JSON.stringify(REAL_USER_DRAWS_2023[t.id]));
      setItem(`draw_${t.id}_2023`, JSON.stringify(draw2023));
    } else {
      try {
        const existingRaw = getItem(`draw_${t.id}_2023`);
        if (existingRaw) {
          const parsed = JSON.parse(existingRaw);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[parsed.length - 1]?.[0]?.winner) {
            draw2023 = parsed;
          }
        }
      } catch {
        draw2023 = null;
      }
    }

    if (!draw2023 && REAL_USER_DRAWS_2023 && Array.isArray(REAL_USER_DRAWS_2023[t.id])) {
      draw2023 = JSON.parse(JSON.stringify(REAL_USER_DRAWS_2023[t.id]));
      setItem(`draw_${t.id}_2023`, JSON.stringify(draw2023));
    }

    if (!draw2023) {
      // Генерируем дефолтную сетку 2023 года ТОЛЬКО для турниров 500, если они отсутствовали в сохранении
      const created = createTournamentDraw(t, simPlayers2023);
      draw2023 = created.draw;

      if (histSpec && t.id !== 'finals') {
        prepareCanonicalFinalistsInDraw(draw2023, t.id, players, histSpec);
      }

      for (let r = 0; r < draw2023.length; r++) {
        for (let m = 0; m < draw2023[r].length; m++) {
          const match = draw2023[r][m];
          if (match.p1 && match.p2 && !match.winner) {
            let forceWin = 0;
            const isFinalRound = r === draw2023.length - 1;
            if (!isFinalRound && wTarget && ruTarget) {
              if (match.p1.id === wTarget.id || match.p1.id === ruTarget.id) forceWin = 1;
              else if (match.p2.id === wTarget.id || match.p2.id === ruTarget.id) forceWin = 2;
            } else if (isFinalRound && histSpec && wTarget) {
              forceWin = match.p1.id === wTarget.id ? 1 : (match.p2.id === wTarget.id ? 2 : 0);
            }
            const sim = computeSimMatchScores(match, t.bestOf, forceWin, t.surface, t.name);
            advanceWinnerInDraw(draw2023, t.id, r, m, sim.winner, sim.scores, sim.narrative);
          }
        }
      }

      if (histSpec && draw2023 && draw2023.length > 0) {
        enforceCanonicalFinalInDraw(draw2023, players, histSpec);
      }

      setItem(`draw_${t.id}_2023`, JSON.stringify(draw2023));
    }

    const finalM = draw2023[draw2023.length - 1][0];
    const winner = finalM?.winner || findPlayerByName(players, 'Max Kyupan');
    const runnerUp = (finalM && finalM.p1 && finalM.p2)
      ? (finalM.p1.id === winner.id ? finalM.p2 : finalM.p1)
      : findPlayerByName(players, 'Will Wentra');
    const scoreStr = (finalM && finalM.score && finalM.score.length > 0)
      ? finalM.score.join(' ')
      : '6-4 6-3';

    const isMajor = ['ТБШ', 'Мастерс', 'Итоговый', 'Олимпиада'].includes(t.type);
    const pressColumn = isMajor
      ? buildFallbackFinalPressColumn({
          tourneyName: t.name,
          tourneyType: t.type,
          surface: t.surface,
          year: 2023,
          winner,
          runnerUp,
          score: scoreStr
        })
      : null;

    tourneys2023Data.push({
      id: t.id,
      name: t.name,
      type: t.type,
      surface: t.surface,
      winner: { id: winner.id, name: winner.name, flag: winner.flag },
      runnerUp: { id: runnerUp.id, name: runnerUp.name, flag: runnerUp.flag },
      score: scoreStr,
      pressColumn
    });
  });

  const maxKyupan = findPlayerByName(players, 'Max Kyupan');

  seasonsHistory['2023'] = {
    year: 2023,
    worldNumberOne: {
      id: maxKyupan.id,
      name: 'Max Kyupan',
      flag: 'GEO',
      points: 12300
    },
    seasonStartTop50: snapStart,
    slamSnapshots: {
      tbsh_1: {
        tourneyName: 'Cartom Calamb (ТБШ)',
        date: '2023-02-05',
        top50: snap1
      },
      tbsh_2: {
        tourneyName: 'Poland Open (ТБШ)',
        date: '2023-06-11',
        top50: snap2
      },
      tbsh_3: {
        tourneyName: 'Polovchis (ТБШ)',
        date: '2023-07-23',
        top50: snap3
      },
      tbsh_4: {
        tourneyName: 'Okeanskiy Open (ТБШ)',
        date: '2023-09-10',
        top50: snap4
      }
    },
    yearEndTop50: snapEnd,
    tournamentsData: tourneys2023Data
  };

  populateAndCalibrate2023TournamentPoints(players, tourneys2023List, readDraw2023FromStorage, HISTORICAL_2023_FINALS);

  setItem('meta_archive_2023_clean_v5', 'true');
  setItem('meta_archive_2023_real_user_draws_v6', 'true');
  return true;
}

/**
 * РАЗДЕЛ 3: Канонический старт сезона 2024 с чистого листа (02 Января 2024 года):
 * - Текущая дата: 2024-01-02 (02 Января 2024)
 * - Текущий турнир: #1 Хьюстон Masters (m_1, сетка чистая, ожидает жеребьевки)
 * - Все турниры 2024 года: completed = false
 * - У всех 300 игроков в Гонке: racePoints = 0
 * - В 52-недельном рейтинге: строгие очки итогов 2023 года (#1 Max Kyupan 12 300, #2 Will Wentra 11 950, #3 Istep Fofol 6 800 и т.д.)
 */
export function ensureCleanJanuary2024StartState(tournaments, players, seasonsHistory, storage = null) {
  const removeItem = (k) => {
    try {
      if (storage && typeof storage.removeItem === 'function') storage.removeItem(k);
      else if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
    } catch {
      // ignore
    }
  };

  applyCanonical2023StartStateToPlayers(players);

  (tournaments || []).forEach(t => {
    t.completed = false;
    delete t.lastWinner;
    delete t.lastRunnerUp;
    delete t.lastScore;
    removeItem(`draw_${t.id}_2024`);
    removeItem(`withdrawals_${t.id}_2024`);
    removeItem(`bg250_${t.id}_2024`);
  });

  seasonsHistory['2024'] = {
    year: 2024,
    seasonStartTop50: createTop50Snapshot(players, '2024-01-02', seasonsHistory['2023']?.yearEndTop50 || null),
    slamSnapshots: {},
    tournamentsData: []
  };

  return {
    currentTourYear: 2024,
    currentTourDateStr: '2024-01-02',
    activeTourneyId: 'm_1'
  };
}
