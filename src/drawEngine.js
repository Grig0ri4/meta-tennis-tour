/**
 * Meta Tennis Tour — Движок жеребьевки (drawEngine.js)
 * Посев: ТБШ 1..32, Мастерс 1..16, Олимпиада 1..16 (квота не более 4 игроков от страны + Матч за 3-е место),
 * ATP 500 1..8, Итоговый 2 группы по 4.
 * Реалистичные снятия (отдых/травма) и заявки для игроков 50–85 мест.
 */

export function shuffleArray(arr) {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

export function buildStandardRounds(bracket, size, isOlympics = false) {
  const draw = [];
  const r1 = [];
  for (let i = 0; i < size; i += 2) {
    r1.push({ p1: bracket[i], p2: bracket[i + 1], score: [], winner: null });
  }
  draw.push(r1);

  let count = size / 4;
  while (count >= 1) {
    const round = [];
    if (count === 1 && isOlympics) {
      // В 6-м раунде Олимпиады: индекс [0] — Финал за Золото 🥇, индекс [1] — Матч за 3-е место (Бронзовый финал 🥉)
      round.push({
        p1: null,
        p2: null,
        score: [],
        winner: null,
        stageLabel: 'ФИНАЛ (Матч за Золото 🥇)',
        isGoldMatch: true
      });
      round.push({
        p1: null,
        p2: null,
        score: [],
        winner: null,
        stageLabel: 'Матч за 3-е место (Бронзовый финал 🥉)',
        isBronzeMatch: true
      });
    } else {
      for (let i = 0; i < count; i++) {
        round.push({ p1: null, p2: null, score: [], winner: null });
      }
    }
    draw.push(round);
    count /= 2;
  }
  return draw;
}

/**
 * Отбирает 64 участников на Олимпийские игры по мировому рейтингу
 * со строгим соблюдением национальной квоты: максимум 4 игрока от одной страны!
 */
export function selectOlympicParticipantsWithQuota(players, maxQuotaPerCountry = 4, drawSize = 64) {
  const sortedByRank = [...players].sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const countryCounts = {};
  const qualified = [];
  const quotaExcluded = [];

  for (let i = 0; i < sortedByRank.length; i++) {
    if (qualified.length >= drawSize) break;
    const p = sortedByRank[i];
    const country = (p.flag || '?').toUpperCase();
    const count = countryCounts[country] || 0;

    if (count < maxQuotaPerCountry) {
      countryCounts[country] = count + 1;
      qualified.push({ ...p, entryTag: 'OLY' });
    } else {
      if (i < 85) {
        quotaExcluded.push(`${p.name} (${country} — квота > ${maxQuotaPerCountry})`);
      }
    }
  }

  // На случай если в кастомной базе мало стран — добираем из оставшихся
  if (qualified.length < drawSize) {
    const usedIds = new Set(qualified.map(p => p.id));
    for (const p of sortedByRank) {
      if (qualified.length >= drawSize) break;
      if (!usedIds.has(p.id)) {
        qualified.push({ ...p, entryTag: 'ITF' });
        usedIds.add(p.id);
      }
    }
  }

  return { qualified, quotaExcluded, countryCounts };
}

export function calculateGroupStandings(groupMatches) {
  const stats = {};
  (groupMatches || []).forEach(m => {
    if (m.p1 && !stats[m.p1.id]) {
      stats[m.p1.id] = { player: m.p1, wins: 0, losses: 0, setsW: 0, setsL: 0, gamesW: 0, gamesL: 0 };
    }
    if (m.p2 && !stats[m.p2.id]) {
      stats[m.p2.id] = { player: m.p2, wins: 0, losses: 0, setsW: 0, setsL: 0, gamesW: 0, gamesL: 0 };
    }

    if (m.winner && m.score && m.score.length > 0 && m.p1 && m.p2) {
      const isP1Win = m.winner.id === m.p1.id;
      const p1 = stats[m.p1.id];
      const p2 = stats[m.p2.id];

      if (isP1Win) {
        p1.wins++;
        p2.losses++;
      } else {
        p2.wins++;
        p1.losses++;
      }

      m.score.forEach(s => {
        const clean = String(s || '').trim().replace(/\(\d+\)/g, '');
        const parts = clean.split('-');
        if (parts.length === 2) {
          const g1 = parseInt(parts[0], 10);
          const g2 = parseInt(parts[1], 10);
          if (!isNaN(g1) && !isNaN(g2)) {
            p1.gamesW += g1;
            p1.gamesL += g2;
            p2.gamesW += g2;
            p2.gamesL += g1;
            if (g1 > g2) {
              p1.setsW++;
              p2.setsL++;
            } else if (g2 > g1) {
              p2.setsW++;
              p1.setsL++;
            }
          }
        }
      });
    }
  });

  return Object.values(stats).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const setDiffB = b.setsW - b.setsL;
    const setDiffA = a.setsW - a.setsL;
    if (setDiffB !== setDiffA) return setDiffB - setDiffA;
    return (b.gamesW - b.gamesL) - (a.gamesW - a.gamesL);
  });
}

export function createTournamentDraw(tourney, players) {
  const size = tourney.size;
  const withdrawals = [];

  // Итоговый турнир World Tour Finals (Топ-8 по Live Race)
  if (tourney.id === 'finals') {
    const raceSorted = [...players].sort((a, b) => {
      const rDiff = (b.racePoints || 0) - (a.racePoints || 0);
      if (rDiff !== 0) return rDiff;
      return a.rank - b.rank;
    });
    const top8 = raceSorted.slice(0, 8).map((p, idx) => ({ ...p, seedNum: idx + 1 }));

    const p34 = shuffleArray([top8[2], top8[3]]);
    const p56 = shuffleArray([top8[4], top8[5]]);
    const p78 = shuffleArray([top8[6], top8[7]]);

    const groupA = [top8[0], p34[0], p56[0], p78[0]];
    const groupB = [top8[1], p34[1], p56[1], p78[1]];

    const rGroupA = [
      { p1: groupA[0], p2: groupA[3], score: [], winner: null, group: 'Группа А' },
      { p1: groupA[1], p2: groupA[2], score: [], winner: null, group: 'Группа А' },
      { p1: groupA[0], p2: groupA[2], score: [], winner: null, group: 'Группа А' },
      { p1: groupA[1], p2: groupA[3], score: [], winner: null, group: 'Группа А' },
      { p1: groupA[0], p2: groupA[1], score: [], winner: null, group: 'Группа А' },
      { p1: groupA[2], p2: groupA[3], score: [], winner: null, group: 'Группа А' }
    ];

    const rGroupB = [
      { p1: groupB[0], p2: groupB[3], score: [], winner: null, group: 'Группа Б' },
      { p1: groupB[1], p2: groupB[2], score: [], winner: null, group: 'Группа Б' },
      { p1: groupB[0], p2: groupB[2], score: [], winner: null, group: 'Группа Б' },
      { p1: groupB[1], p2: groupB[3], score: [], winner: null, group: 'Группа Б' },
      { p1: groupB[0], p2: groupB[1], score: [], winner: null, group: 'Группа Б' },
      { p1: groupB[2], p2: groupB[3], score: [], winner: null, group: 'Группа Б' }
    ];

    const draw = [
      rGroupA,
      rGroupB,
      [
        { p1: null, p2: null, score: [], winner: null },
        { p1: null, p2: null, score: [], winner: null }
      ],
      [
        { p1: null, p2: null, score: [], winner: null }
      ]
    ];

    return { draw, withdrawals: [] };
  }

  // ОЛИМПИЙСКИЕ ИГРЫ (64 игрока, национальная квота <= 4 игроков от страны, Матч за 3-е место + Финал)
  if (tourney.id === 'olympics' || tourney.type === 'Олимпиада' || tourney.isOlympics) {
    const { qualified, quotaExcluded } = selectOlympicParticipantsWithQuota(players, 4, 64);
    const bracket = new Array(64).fill(null);

    const seedsCount = 16;
    const seeds = qualified.slice(0, seedsCount).map((p, idx) => ({ ...p, seedNum: idx + 1, entryTag: undefined }));

    bracket[0] = seeds[0];
    bracket[63] = seeds[1];
    const s34 = shuffleArray(seeds.slice(2, 4));
    bracket[31] = s34[0];
    bracket[32] = s34[1];

    const slots5_8 = [15, 16, 47, 48];
    const s58 = shuffleArray(seeds.slice(4, 8));
    slots5_8.forEach((pos, idx) => { bracket[pos] = s58[idx]; });

    const slots9_16 = [7, 8, 23, 24, 39, 40, 55, 56];
    const s916 = shuffleArray(seeds.slice(8, 16));
    slots9_16.forEach((pos, idx) => { bracket[pos] = s916[idx]; });

    const unseeded = shuffleArray(qualified.slice(16, 64).map(p => ({ ...p, seedNum: undefined })));
    for (let i = 0; i < 64; i++) {
      if (!bracket[i]) bracket[i] = unseeded.pop();
    }

    return {
      draw: buildStandardRounds(bracket, 64, true),
      withdrawals: quotaExcluded.slice(0, 12)
    };
  }

  const committedPlayers = [];

  if (tourney.type === 'ATP 500') {
    players.slice(0, 15).forEach(p => {
      if (Math.random() < 0.25) committedPlayers.push(p);
      else withdrawals.push(p.name);
    });
    players.slice(15, 40).forEach(p => {
      if (Math.random() < 0.35) committedPlayers.push(p);
      else if (p.rank <= 25) withdrawals.push(p.name);
    });
    players.slice(40, 85).forEach(p => {
      if (Math.random() < 0.55) committedPlayers.push(p);
    });
    players.slice(85, 140).forEach(p => {
      if (Math.random() < 0.35) committedPlayers.push(p);
    });
    let extraIdx = 40;
    while (committedPlayers.length < 24 && extraIdx < players.length) {
      const cand = players[extraIdx++];
      if (cand && !committedPlayers.some(x => x.id === cand.id)) {
        committedPlayers.push(cand);
      }
    }
  } else if (tourney.type === 'Мастерс') {
    players.slice(0, 20).forEach(p => {
      if (Math.random() < 0.88) committedPlayers.push(p);
      else withdrawals.push(p.name);
    });
    players.slice(20, 60).forEach(p => {
      if (Math.random() < 0.85) committedPlayers.push(p);
      else if (p.rank <= 30) withdrawals.push(p.name);
    });
    players.slice(60, 95).forEach(p => {
      if (Math.random() < 0.50) committedPlayers.push(p);
    });
    let extraIdx = 20;
    while (committedPlayers.length < 48 && extraIdx < players.length) {
      const cand = players[extraIdx++];
      if (cand && !committedPlayers.some(x => x.id === cand.id)) {
        committedPlayers.push(cand);
      }
    }
  } else if (tourney.type === 'ТБШ') {
    players.slice(0, 105).forEach(p => {
      if (Math.random() < 0.96) committedPlayers.push(p);
      else if (p.rank <= 32) withdrawals.push(p.name);
    });
    players.slice(105, 155).forEach(p => {
      if (Math.random() < 0.65) committedPlayers.push(p);
    });
    let extraIdx = 0;
    while (committedPlayers.length < 96 && extraIdx < players.length) {
      const cand = players[extraIdx++];
      if (cand && !committedPlayers.some(x => x.id === cand.id)) {
        committedPlayers.push(cand);
      }
    }
  }

  committedPlayers.sort((a, b) => a.rank - b.rank);

  const bracket = new Array(size).fill(null);

  if (size === 128) {
    // ТБШ (128): СТРОГО СЕЯНЫЕ С (1) ПО (32)
    const seedsCount = 32;
    const seeds = committedPlayers.slice(0, seedsCount).map((p, idx) => ({ ...p, seedNum: idx + 1 }));

    bracket[0] = seeds[0];
    bracket[127] = seeds[1];
    const s34 = shuffleArray(seeds.slice(2, 4));
    bracket[63] = s34[0];
    bracket[64] = s34[1];

    const slots5_8 = [31, 32, 95, 96];
    const s58 = shuffleArray(seeds.slice(4, 8));
    slots5_8.forEach((pos, idx) => { bracket[pos] = s58[idx]; });

    const slots9_16 = [15, 16, 47, 48, 79, 80, 111, 112];
    const s916 = shuffleArray(seeds.slice(8, 16));
    slots9_16.forEach((pos, idx) => { bracket[pos] = s916[idx]; });

    const slots17_32 = [7, 8, 23, 24, 39, 40, 55, 56, 71, 72, 87, 88, 103, 104, 119, 120];
    const s1732 = shuffleArray(seeds.slice(16, 32));
    slots17_32.forEach((pos, idx) => { bracket[pos] = s1732[idx]; });

    const direct = committedPlayers.slice(32, 96).map(p => ({ ...p, seedNum: undefined }));
    const usedIds = new Set([...seeds.map(p => p.id), ...direct.map(p => p.id)]);
    const poolLower = shuffleArray(players.filter(p => !usedIds.has(p.id)));

    const qualifiers = poolLower.slice(0, 16).map(p => ({ ...p, entryTag: 'Q', seedNum: undefined }));
    const wildcards = poolLower.slice(16, 24).map(p => ({ ...p, entryTag: 'WC', seedNum: undefined }));
    const luckyLosers = poolLower.slice(24, 28).map(p => ({ ...p, entryTag: 'LL', seedNum: undefined }));
    const protectedRanks = poolLower.slice(28, 32).map(p => ({ ...p, entryTag: 'PR', seedNum: undefined }));

    const unseeded = shuffleArray([...direct, ...qualifiers, ...wildcards, ...luckyLosers, ...protectedRanks]);
    for (let i = 0; i < 128; i++) {
      if (!bracket[i]) {
        const nextP = unseeded.pop() || poolLower.pop();
        bracket[i] = nextP ? { ...nextP, seedNum: undefined } : null;
      }
    }
    return { draw: buildStandardRounds(bracket, 128), withdrawals: withdrawals.slice(0, 10) };

  } else if (size === 64) {
    // МАСТЕРС (64): СТРОГО СЕЯНЫЕ С (1) ПО (16)
    const seedsCount = 16;
    const seeds = committedPlayers.slice(0, seedsCount).map((p, idx) => ({ ...p, seedNum: idx + 1 }));

    bracket[0] = seeds[0];
    bracket[63] = seeds[1];
    const s34 = shuffleArray(seeds.slice(2, 4));
    bracket[31] = s34[0];
    bracket[32] = s34[1];

    const slots5_8 = [15, 16, 47, 48];
    const s58 = shuffleArray(seeds.slice(4, 8));
    slots5_8.forEach((pos, idx) => { bracket[pos] = s58[idx]; });

    const slots9_16 = [7, 8, 23, 24, 39, 40, 55, 56];
    const s916 = shuffleArray(seeds.slice(8, 16));
    slots9_16.forEach((pos, idx) => { bracket[pos] = s916[idx]; });

    const direct = committedPlayers.slice(16, 48).map(p => ({ ...p, seedNum: undefined }));
    const usedIds = new Set([...seeds.map(p => p.id), ...direct.map(p => p.id)]);
    const poolLower = shuffleArray(players.filter(p => !usedIds.has(p.id) && p.rank >= 65));

    const qualifiers = poolLower.slice(0, 8).map(p => ({ ...p, entryTag: 'Q', seedNum: undefined }));
    const wildcards = poolLower.slice(8, 12).map(p => ({ ...p, entryTag: 'WC', seedNum: undefined }));
    const luckyLosers = poolLower.slice(12, 14).map(p => ({ ...p, entryTag: 'LL', seedNum: undefined }));
    const protectedRanks = poolLower.slice(14, 16).map(p => ({ ...p, entryTag: 'PR', seedNum: undefined }));

    const unseeded = shuffleArray([...direct, ...qualifiers, ...wildcards, ...luckyLosers, ...protectedRanks]);
    for (let i = 0; i < 64; i++) {
      if (!bracket[i]) {
        const nextP = unseeded.pop() || poolLower.pop();
        bracket[i] = nextP ? { ...nextP, seedNum: undefined } : null;
      }
    }
    return { draw: buildStandardRounds(bracket, 64), withdrawals: withdrawals.slice(0, 10) };

  } else {
    // ATP 500 (32): СТРОГО СЕЯНЫЕ С (1) ПО (8)
    const seedsCount = 8;
    const seeds = committedPlayers.slice(0, seedsCount).map((p, idx) => ({ ...p, seedNum: idx + 1 }));

    bracket[0] = seeds[0];
    bracket[31] = seeds[1];
    const s34 = shuffleArray(seeds.slice(2, 4));
    bracket[15] = s34[0];
    bracket[16] = s34[1];

    const slots5_8 = [7, 8, 23, 24];
    const s58 = shuffleArray(seeds.slice(4, 8));
    slots5_8.forEach((pos, idx) => { bracket[pos] = s58[idx]; });

    const direct = committedPlayers.slice(8, 24).map(p => ({ ...p, seedNum: undefined }));
    const usedIds = new Set([...seeds.map(p => p.id), ...direct.map(p => p.id)]);
    const poolLower = shuffleArray(players.filter(p => !usedIds.has(p.id) && p.rank >= 70));

    const qualifiers = poolLower.slice(0, 4).map(p => ({ ...p, entryTag: 'Q', seedNum: undefined }));
    const wildcards = poolLower.slice(4, 8).map(p => ({ ...p, entryTag: 'WC', seedNum: undefined }));

    const unseeded = shuffleArray([...direct, ...qualifiers, ...wildcards]);
    for (let i = 0; i < 32; i++) {
      if (!bracket[i]) {
        const nextP = unseeded.pop() || poolLower.pop();
        bracket[i] = nextP ? { ...nextP, seedNum: undefined } : null;
      }
    }
    return { draw: buildStandardRounds(bracket, 32), withdrawals: withdrawals.slice(0, 10) };
  }
}

if (typeof window !== 'undefined') {
  window.shuffleArray = shuffleArray;
  window.buildStandardRounds = buildStandardRounds;
  window.selectOlympicParticipantsWithQuota = selectOlympicParticipantsWithQuota;
  window.calculateGroupStandings = calculateGroupStandings;
  window.createTournamentDraw = createTournamentDraw;
}
