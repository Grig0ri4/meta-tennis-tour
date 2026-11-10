/**
 * Meta Tennis Tour — Движок жеребьевки (drawEngine.js)
 * Посев: ТБШ 1..32, Мастерс 1..16, Олимпиада 1..16 (квота не более 4 игроков от страны + разведение по разным четвертям + Матч за 3-е место),
 * ATP 500 1..8, Итоговый 2 группы по 4.
 * Реалистичные снятия (отдых/травма) и заявки для игроков 50–85 мест.
 */
import { normalizeCountryCode } from './countryFlags.js';

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
 * Нормализует коды стран через normalizeCountryCode (например, IT -> ITA, SPN -> ESP, GRC -> GRE).
 */
export function selectOlympicParticipantsWithQuota(players, maxQuotaPerCountry = 4, drawSize = 64) {
  const sortedByRank = [...players].sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const countryCounts = {};
  const qualified = [];
  const quotaExcluded = [];

  for (let i = 0; i < sortedByRank.length; i++) {
    if (qualified.length >= drawSize) break;
    const p = sortedByRank[i];
    const country = normalizeCountryCode(p.flag);
    if (!country || country === '?') continue;
    const count = countryCounts[country] || 0;

    if (count < maxQuotaPerCountry) {
      countryCounts[country] = count + 1;
      qualified.push({ ...p, flag: country, entryTag: 'OLY' });
    } else {
      if (i < 100) {
        quotaExcluded.push(`${p.name} (${country} — квота > ${maxQuotaPerCountry})`);
      }
    }
  }

  // На случай если в тестовой/кастомной базе не хватило игроков с известными флагами — добираем с соблюдением квоты
  if (qualified.length < drawSize) {
    const usedIds = new Set(qualified.map(p => p.id));
    for (const p of sortedByRank) {
      if (qualified.length >= drawSize) break;
      if (usedIds.has(p.id)) continue;
      const country = normalizeCountryCode(p.flag);
      const count = countryCounts[country] || 0;
      if (country === '?' || count < maxQuotaPerCountry) {
        countryCounts[country] = count + 1;
        qualified.push({ ...p, flag: country, entryTag: 'ITF' });
        usedIds.add(p.id);
      }
    }
  }

  return { qualified, quotaExcluded, countryCounts };
}

/**
 * Строит 64-местную олимпийскую сетку со строгим разведением представителей одной страны
 * по разным четвертям (Q0: 0..15, Q1: 16..31, Q2: 32..47, Q3: 48..63),
 * чтобы соотечественники гарантированно не встречались в 1/32, 1/16, 1/8 и 1/4 финала,
 * а при 2 участниках от страны по возможности разводились в разные половины сетки.
 */
export function buildOlympicQuarterSeparatedBracket(qualified) {
  const bracket = new Array(64).fill(null);
  const seedsCount = 16;
  const seeds = qualified.slice(0, seedsCount).map((p, idx) => ({
    ...p,
    flag: normalizeCountryCode(p.flag),
    seedNum: idx + 1,
    entryTag: undefined
  }));
  const unseededAll = qualified.slice(seedsCount, 64).map(p => ({
    ...p,
    flag: normalizeCountryCode(p.flag),
    seedNum: undefined
  }));

  const quarterCountries = [new Set(), new Set(), new Set(), new Set()];
  const addCountryToQuarter = (q, flag) => {
    if (flag && flag !== '?') quarterCountries[q].add(flag);
  };
  const hasCountryInHalf = (halfIdx, flag) => {
    if (!flag || flag === '?') return false;
    const qA = halfIdx * 2;
    const qB = halfIdx * 2 + 1;
    return quarterCountries[qA].has(flag) || quarterCountries[qB].has(flag);
  };

  // 1. Посев #1 (Q0, слот 0) и #2 (Q3, слот 63)
  if (seeds[0]) {
    bracket[0] = seeds[0];
    addCountryToQuarter(0, seeds[0].flag);
  }
  if (seeds[1]) {
    bracket[63] = seeds[1];
    addCountryToQuarter(3, seeds[1].flag);
  }

  // 2. Посев #3 и #4 (Q1 слот 31 и Q2 слот 32) — разводим по половинам с соотечественниками #1/#2
  const s34 = shuffleArray(seeds.slice(2, 4));
  if (s34.length === 2) {
    const optA = (hasCountryInHalf(0, s34[0].flag) ? 1 : 0) + (hasCountryInHalf(1, s34[1].flag) ? 1 : 0);
    const optB = (hasCountryInHalf(0, s34[1].flag) ? 1 : 0) + (hasCountryInHalf(1, s34[0].flag) ? 1 : 0);
    const pair = optB < optA ? [s34[1], s34[0]] : [s34[0], s34[1]];
    bracket[31] = pair[0];
    addCountryToQuarter(1, pair[0].flag);
    bracket[32] = pair[1];
    addCountryToQuarter(2, pair[1].flag);
  }

  // 3. Посев #5..#8 (по одному в каждую четверть: Q0=15, Q1=16, Q2=47, Q3=48)
  const slots58ByQ = [15, 16, 47, 48];
  const s58 = shuffleArray(seeds.slice(4, 8));
  if (s58.length === 4) {
    const availableQuarters = [0, 1, 2, 3];
    s58.forEach(pl => {
      availableQuarters.sort((qA, qB) => {
        const flag = pl.flag;
        const penA = (flag && quarterCountries[qA].has(flag) ? 100 : 0) + (flag && hasCountryInHalf(Math.floor(qA / 2), flag) ? 5 : 0);
        const penB = (flag && quarterCountries[qB].has(flag) ? 100 : 0) + (flag && hasCountryInHalf(Math.floor(qB / 2), flag) ? 5 : 0);
        return penA - penB;
      });
      const chosenQ = availableQuarters.shift();
      bracket[slots58ByQ[chosenQ]] = pl;
      addCountryToQuarter(chosenQ, pl.flag);
    });
  }

  // 4. Посев #9..#16 (по 2 слота в каждой четверти: Q0=[7,8], Q1=[23,24], Q2=[39,40], Q3=[55,56])
  const slots916ByQ = [[7, 8], [23, 24], [39, 40], [55, 56]];
  const totalCountryFreq = {};
  qualified.forEach(p => {
    const f = normalizeCountryCode(p.flag);
    totalCountryFreq[f] = (totalCountryFreq[f] || 0) + 1;
  });
  const s916 = shuffleArray(seeds.slice(8, 16)).sort(
    (a, b) => (totalCountryFreq[b.flag] || 0) - (totalCountryFreq[a.flag] || 0)
  );
  for (const pl of s916) {
    const candidateQuarters = shuffleArray([0, 1, 2, 3]).filter(q => slots916ByQ[q].length > 0);
    candidateQuarters.sort((qA, qB) => {
      const penA =
        (quarterCountries[qA].has(pl.flag) ? 100 : 0) +
        (hasCountryInHalf(Math.floor(qA / 2), pl.flag) ? 5 : 0) -
        slots916ByQ[qA].length;
      const penB =
        (quarterCountries[qB].has(pl.flag) ? 100 : 0) +
        (hasCountryInHalf(Math.floor(qB / 2), pl.flag) ? 5 : 0) -
        slots916ByQ[qB].length;
      return penA - penB;
    });
    const chosenQ = candidateQuarters[0];
    const slot = slots916ByQ[chosenQ].pop();
    bracket[slot] = pl;
    addCountryToQuarter(chosenQ, pl.flag);
  }

  // 5. Несеяные игроки (48 человек, по 12 свободных слотов в каждой четверти Q0..Q3)
  const quarterUnseeded = [[], [], [], []];
  const byCountry = {};
  for (const pl of shuffleArray(unseededAll)) {
    const f = pl.flag || '?';
    if (!byCountry[f]) byCountry[f] = [];
    byCountry[f].push(pl);
  }

  // Сначала распределяем страны с наибольшим общим числом участников (4, 3, 2), затем одиночные (1)
  const sortedCountries = shuffleArray(Object.keys(byCountry)).sort((cA, cB) => {
    if (cA === '?') return 1;
    if (cB === '?') return -1;
    const totDiff = (totalCountryFreq[cB] || 0) - (totalCountryFreq[cA] || 0);
    if (totDiff !== 0) return totDiff;
    return byCountry[cB].length - byCountry[cA].length;
  });

  for (const country of sortedCountries) {
    const group = byCountry[country];
    for (const pl of group) {
      let openQuarters = shuffleArray([0, 1, 2, 3]).filter(q => quarterUnseeded[q].length < 12);
      let validQuarters =
        country === '?'
          ? openQuarters
          : openQuarters.filter(q => !quarterCountries[q].has(country));

      if (validQuarters.length > 0) {
        validQuarters.sort((qA, qB) => {
          const halfPenA = hasCountryInHalf(Math.floor(qA / 2), country) ? 10 : 0;
          const halfPenB = hasCountryInHalf(Math.floor(qB / 2), country) ? 10 : 0;
          if (halfPenA !== halfPenB) return halfPenA - halfPenB;
          return quarterUnseeded[qA].length - quarterUnseeded[qB].length;
        });
        const targetQ = validQuarters[0];
        quarterUnseeded[targetQ].push(pl);
        addCountryToQuarter(targetQ, country);
      } else {
        // Если свободная от этой страны четверть уже заполнена (12/12), меняем местами с игроком другой страны
        const nonCollidingFullQuarters = [0, 1, 2, 3].filter(q => !quarterCountries[q].has(country));
        let swapped = false;
        for (const fullQ of nonCollidingFullQuarters) {
          for (const spareQ of openQuarters) {
            const swapIdx = quarterUnseeded[fullQ].findIndex(
              cand => cand.flag === '?' || !quarterCountries[spareQ].has(cand.flag)
            );
            if (swapIdx !== -1) {
              const [movedPlayer] = quarterUnseeded[fullQ].splice(swapIdx, 1);
              if (movedPlayer.flag && movedPlayer.flag !== '?') {
                quarterCountries[fullQ].delete(movedPlayer.flag);
                quarterCountries[spareQ].add(movedPlayer.flag);
              }
              quarterUnseeded[spareQ].push(movedPlayer);
              quarterUnseeded[fullQ].push(pl);
              addCountryToQuarter(fullQ, country);
              swapped = true;
              break;
            }
          }
          if (swapped) break;
        }
        if (!swapped && openQuarters.length > 0) {
          const fallbackQ = openQuarters[0];
          quarterUnseeded[fallbackQ].push(pl);
          addCountryToQuarter(fallbackQ, country);
        }
      }
    }
  }

  // 6. Заполняем пустые слоты внутри каждой четверти и исключаем однофамильцев/соотечественников в парах 1/32
  for (let q = 0; q < 4; q++) {
    const startSlot = q * 16;
    const pool = shuffleArray(quarterUnseeded[q]);
    for (let s = startSlot; s < startSlot + 16; s++) {
      if (!bracket[s]) {
        bracket[s] = pool.pop() || null;
      }
    }
  }

  return bracket;
}

export function calculateGroupStandings(groupMatches) {
  const stats = {};
  const h2hMap = {};

  (groupMatches || []).forEach(m => {
    if (m.p1 && !stats[m.p1.id]) {
      stats[m.p1.id] = { player: m.p1, wins: 0, losses: 0, setsW: 0, setsL: 0, gamesW: 0, gamesL: 0 };
    }
    if (m.p2 && !stats[m.p2.id]) {
      stats[m.p2.id] = { player: m.p2, wins: 0, losses: 0, setsW: 0, setsL: 0, gamesW: 0, gamesL: 0 };
    }
    if (m.winner && m.p1 && m.p2) {
      h2hMap[`${m.p1.id}_vs_${m.p2.id}`] = m.winner.id;
      h2hMap[`${m.p2.id}_vs_${m.p1.id}`] = m.winner.id;
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

  const list = Object.values(stats);
  return list.sort((a, b) => {
    // 1. Количество побед в группе
    if (b.wins !== a.wins) return b.wins - a.wins;

    // 2. Если 2 игрока имеют одинаковое число побед — решает очная встреча (H2H по регламенту ATP)
    const tiedWithSameWins = list.filter(x => x.wins === a.wins);
    if (tiedWithSameWins.length === 2) {
      const directWinner = h2hMap[`${a.player.id}_vs_${b.player.id}`];
      if (directWinner === a.player.id) return -1;
      if (directWinner === b.player.id) return 1;
    }

    // 3. При равенстве побед у 3 игроков — разница сетов, затем разница геймов
    const setDiffB = b.setsW - b.setsL;
    const setDiffA = a.setsW - a.setsL;
    if (setDiffB !== setDiffA) return setDiffB - setDiffA;

    const gameDiffB = b.gamesW - b.gamesL;
    const gameDiffA = a.gamesW - a.gamesL;
    if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;

    // 4. Очная встреча между a и b при равенстве остальных показателей
    const directWinner = h2hMap[`${a.player.id}_vs_${b.player.id}`];
    if (directWinner === a.player.id) return -1;
    if (directWinner === b.player.id) return 1;

    // 5. Детерминированный фоллбэк по рейтингу ATP
    return (Number(a.player.rank) || 999) - (Number(b.player.rank) || 999);
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

  // ОЛИМПИЙСКИЕ ИГРЫ (64 игрока, национальная квота <= 4 игроков от страны, разведение по разным четвертям, Матч за 3-е место + Финал)
  if (tourney.id === 'olympics' || tourney.type === 'Олимпиада' || tourney.isOlympics) {
    const { qualified, quotaExcluded } = selectOlympicParticipantsWithQuota(players, 4, 64);
    const bracket = buildOlympicQuarterSeparatedBracket(qualified);

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
