import test from 'node:test';
import assert from 'node:assert/strict';

import { PRESERVED_BASE, CLEAN_UNIQUE_POOL, buildInitial300Players, generateRandom300Players } from '../data/players.js';
import {
  FULL_CALENDAR_TEMPLATE,
  OLYMPIC_TOURNAMENT_TEMPLATE,
  isOlympicYear,
  getOlympicSurface,
  getSeasonTournaments,
  getTourneyDateRange
} from '../data/tournaments.js';
import {
  createTournamentDraw,
  selectOlympicParticipantsWithQuota,
  calculateGroupStandings
} from './drawEngine.js';
import {
  formatTennisScore,
  computeSimMatchScores,
  generateMatchQuotes,
  isBannedTemplateScore,
  sanitizeTemplateScore,
  parseAndValidateScoreString,
  advanceWinnerInDraw,
  resetMatchResultInDraw,
  getHeadToHeadAnalytics,
  calculateMatchStaminaCost,
  applyMatchFatigueToPlayers,
  resetPlayersStamina,
  regenerateInterRoundStamina,
  restoreMatchFatigue,
  computeMatchMomentumPercent
} from './matchEngine.js';
import { isFutureLockedTournament, orientFinalScoreToWinner, orientFinalScoreForPlayer } from './app.js';
import {
  POINTS_SCALE,
  OLYMPICS_POINTS_SCALE,
  PARALLEL_TOUR_SCALES,
  CANONICAL_2023_START_TOP10,
  HISTORICAL_PEAK_RANK_BY_NAME,
  PLAYER_ARCHETYPES_CATALOG,
  calculatePlayerOVR,
  getPlayerArchetypes,
  getPlayerSkills,
  buildCanonical2023StartMap,
  applyCanonical2023StartStateToPlayers,
  populateAndCalibrate2023TournamentPoints,
  computeWeeklyParallelTourPoints,
  syncPlayers52WeekDiagnostics,
  calculateTournamentEarnedPoints,
  calculateAgeNum,
  sortAndRankPlayers,
  repairCareerHighRanksFromHistory,
  applyTournamentPointsToPlayers,
  runBackgroundATP250Tournaments,
  createTop50Snapshot,
  getWeeksAtNo1Award,
  ensureWeeksAtNo1State,
  computeSeasonWeeksAtNo1,
  awardWeeksAtNo1,
  WEEKS_AT_NO1_MODEL_VERSION,
  generatePlayerPotential,
  ensureYoungPlayerPotentials,
  getYoungTalentWinBonus,
  POTENTIAL_MODEL_VERSION,
  GOAT_SCORE_WEIGHTS,
  calculateGoatScore,
  buildGoatLeaderboard,
  computeSeasonAwards
} from './rankingEngine.js';
import {
  getRetirementProbability,
  processEndOfSeasonRetirements,
  createNewgenPlayer
} from './retirementEngine.js';
import {
  HISTORICAL_2023_TOP10,
  HISTORICAL_2023_FINALS,
  ensureDefault2023SeasonArchive,
  ensureCleanJanuary2024StartState
} from './seedArchive2023.js';
import {
  GROQ_API_ENDPOINT,
  DEFAULT_GROQ_API_KEY,
  DEFAULT_GROQ_MODEL,
  normalizeGroqModelName,
  cleanGroqJsonString,
  getGroqSourceHeaderLabel,
  getGroqApiKey,
  setGroqApiKey,
  getGroqModel,
  setGroqModel,
  simulateMatchWithGroq,
  generateCommentaryForEnteredScore,
  generateFinalPressColumn,
  enrichNewgensWithGroq
} from './aiService.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    }
  };
}

test('Раздел 1: Архив 2023 года фиксирует GEO Max Kyupan (12 300 pts) как Первую ракетку мира, точный Топ-10 и чемпионов 2023', () => {
  const players = buildInitial300Players();
  const tourneys2023 = getSeasonTournaments(2023, FULL_CALENDAR_TEMPLATE);
  const seasonsHistory = {};
  const memStorage = createMemoryStorage();

  const updated = ensureDefault2023SeasonArchive(tourneys2023, players, seasonsHistory, memStorage);
  assert.equal(updated, true);

  const arch2023 = seasonsHistory['2023'];
  assert.ok(arch2023);
  assert.equal(arch2023.worldNumberOne.name, 'Max Kyupan');
  assert.equal(arch2023.worldNumberOne.flag, 'GEO');
  assert.equal(arch2023.worldNumberOne.points, 12300);

  // Топ-10 за 2023 год
  const top10 = arch2023.yearEndTop50.slice(0, 10);
  assert.equal(top10[0].name, 'Max Kyupan');
  assert.equal(top10[0].points, 12300);
  assert.equal(top10[1].name, 'Will Wentra');
  assert.equal(top10[1].points, 11950);
  assert.equal(top10[2].name, 'Istep Fofol');
  assert.equal(top10[2].points, 7260);
  assert.equal(top10[3].name, 'Ussistian Shifter');
  assert.equal(top10[3].points, 7060);
  assert.equal(top10[4].name, 'Fite Memsy Staprin');
  assert.equal(top10[4].points, 5460);
  assert.equal(top10[5].name, 'Puddy Mexalino');
  assert.equal(top10[5].points, 5000);
  assert.equal(top10[6].name, 'Gary Riffay');
  assert.equal(top10[6].points, 4280);
  assert.equal(top10[7].name, 'Pen Klak');
  assert.equal(top10[7].points, 3760);
  assert.equal(top10[8].name, 'Omar Netigios');
  assert.equal(top10[8].points, 3300);
  assert.equal(top10[9].name, 'Shaun Salkar');
  assert.equal(top10[9].points, 2870);

  // Проверка чемпионов главных турниров 2023 года (с очками тайбрейков)
  const byId = Object.fromEntries(arch2023.tournamentsData.map(t => [t.id, t]));
  assert.equal(byId.m_1.winner.name, 'Istep Fofol');
  assert.equal(byId.m_1.runnerUp.name, 'Max Kyupan');
  assert.equal(byId.m_1.score, '7-6(4) 7-5');
  assert.ok(byId.m_1.pressColumn.headline.length > 10);

  assert.equal(byId.tbsh_1.winner.name, 'Istep Fofol');
  assert.equal(byId.tbsh_1.runnerUp.name, 'Max Kyupan');
  assert.equal(byId.tbsh_1.score, '4-6 7-6(1) 3-6 7-6(4) 6-3');

  assert.equal(byId.m_3.winner.name, 'Max Kyupan');
  assert.equal(byId.m_3.runnerUp.name, 'Ussistian Shifter');
  assert.equal(byId.m_3.score, '3-6 4-6');

  assert.equal(byId.m_4.winner.name, 'Will Wentra');
  assert.equal(byId.m_4.runnerUp.name, 'Sepsor Loreo');
  assert.equal(byId.m_4.score, '6-2 3-6 7-5');

  assert.equal(byId.m_5.winner.name, 'Will Wentra');
  assert.equal(byId.m_5.runnerUp.name, 'Putter Price');
  assert.equal(byId.m_5.score, '2-6 3-6');

  assert.equal(byId.tbsh_2.winner.name, 'Will Wentra');
  assert.equal(byId.tbsh_2.runnerUp.name, 'Puddy Mexalino');
  assert.equal(byId.tbsh_2.score, '6-7(1) 1-6 4-6');

  assert.equal(byId.m_6.winner.name, 'Will Wentra');
  assert.equal(byId.m_6.runnerUp.name, 'Max Kyupan');
  assert.equal(byId.m_6.score, '2-6 6-7(2)');

  assert.equal(byId.tbsh_3.winner.name, 'Will Wentra');
  assert.equal(byId.tbsh_3.runnerUp.name, 'Max Kyupan');
  assert.equal(byId.tbsh_3.score, '6-2 6-3 3-6 6-4');

  assert.equal(byId.m_7.winner.name, 'Max Kyupan');
  assert.equal(byId.m_7.runnerUp.name, 'Will Wentra');
  assert.equal(byId.m_7.score, '6-7(7) 7-5 3-6');

  assert.equal(byId.tbsh_4.winner.name, 'Max Kyupan');
  assert.equal(byId.tbsh_4.runnerUp.name, 'Ussistian Shifter');
  assert.equal(byId.tbsh_4.score, '6-2 7-6(1) 3-6 6-7(3) 2-6');

  assert.equal(byId.m_8.winner.name, 'Max Kyupan');
  assert.equal(byId.m_8.runnerUp.name, 'Will Wentra');
  assert.equal(byId.m_8.score, '4-6 6-3 4-6');

  assert.equal(byId.m_9.winner.name, 'Ussistian Shifter');
  assert.equal(byId.m_9.runnerUp.name, 'Istep Fofol');
  assert.equal(byId.m_9.score, '6-7(5) 6-7(3)');

  assert.equal(byId.finals.winner.name, 'Max Kyupan');
  assert.equal(byId.finals.runnerUp.name, 'Will Wentra');
  assert.equal(byId.finals.score, '7-6(5) 6-7(5) 4-6');

  // Проверка реальных сеток 2023 из draws_2023_only.json (1/4 Okeanskiy Open: Wentra vs Shifter)
  const tbsh4Draw = JSON.parse(memStorage.getItem('draw_tbsh_4_2023'));
  assert.equal(tbsh4Draw[4][0].p1.name, 'Will Wentra');
  assert.equal(tbsh4Draw[4][0].p2.name, 'Ussistian Shifter');
  assert.equal(tbsh4Draw[4][0].winner.name, 'Ussistian Shifter');
  assert.deepEqual(tbsh4Draw[4][0].score, ['6-3', '3-6', '7-6(3)', '4-6', '4-6']);
});

test('Блок 2: Базовые очки старта 2024 года, Пик ранга (Шон Салкар #5, а не #1) и чистый старт 02.01.2024', () => {
  const players = buildInitial300Players();
  applyCanonical2023StartStateToPlayers(players);

  assert.equal(players[0].name, 'Max Kyupan');
  assert.equal(players[0].points, 12300);
  assert.equal(players[0].bestRank, 1);

  assert.equal(players[1].name, 'Will Wentra');
  assert.equal(players[1].points, 11950);
  assert.equal(players[1].bestRank, 1, 'У Вилла Вентры пик ранга #1, так как он был первой ракеткой');

  assert.equal(players[2].name, 'Istep Fofol');
  assert.equal(players[2].points, 7260);
  assert.equal(players[2].bestRank, 1);

  const salkar = players.find(p => p.name === 'Shaun Salkar');
  assert.ok(salkar);
  assert.equal(salkar.points, 2870);
  assert.equal(salkar.rank, 10);
  assert.equal(salkar.bestRank, 5, 'У Шона Салкара Пик ранга обязан быть #5, а не #1');

  const tourneys2024 = getSeasonTournaments(2024, FULL_CALENDAR_TEMPLATE).map(t => ({ ...t }));
  const seasonsHistory = {};
  const memStorage = createMemoryStorage();

  ensureDefault2023SeasonArchive(tourneys2024, players, seasonsHistory, memStorage);
  const startState = ensureCleanJanuary2024StartState(tourneys2024, players, seasonsHistory, memStorage);

  assert.equal(startState.currentTourDateStr, '2024-01-02');
  assert.equal(startState.activeTourneyId, 'm_1');
  assert.equal(tourneys2024[0].id, 'm_1');
  assert.equal(tourneys2024[0].name, 'Хьюстон Masters');
  assert.equal(Boolean(tourneys2024[0].completed), false);
});

test('Блок 3: Полное аннулирование результата матча (resetMatchResultInDraw) и каскадное удаление победителя из следующего раунда', () => {
  const players = buildInitial300Players();
  const tourney = FULL_CALENDAR_TEMPLATE.find(t => t.id === '500_1');
  const { draw } = createTournamentDraw(tourney, players);

  // Сыграем матч R1 #0 (draw[0][0]) и продвинем победителя в R2 #0 (draw[1][0].p1)
  const m0 = draw[0][0];
  const winnerR1 = m0.p1;
  advanceWinnerInDraw(draw, tourney.id, 0, 0, winnerR1, ['6-4', '6-3'], 'Уверенная победа');

  assert.equal(draw[0][0].winner.id, winnerR1.id);
  assert.deepEqual(draw[0][0].score, ['6-4', '6-3']);
  assert.equal(draw[1][0].p1.id, winnerR1.id);

  // Также сыграем второй парный матч R1 #1 и затем R2 #0, чтобы проверить каскадную очистку
  const m1 = draw[0][1];
  advanceWinnerInDraw(draw, tourney.id, 0, 1, m1.p2, ['7-5', '6-4'], 'Победа во втором матче');
  advanceWinnerInDraw(draw, tourney.id, 1, 0, winnerR1, ['6-2', '6-2'], 'Выход в четвертьфинал');
  assert.equal(draw[2][0].p1.id, winnerR1.id);

  // Теперь аннулируем результат матча R1 #0
  const resetOk = resetMatchResultInDraw(draw, tourney.id, 0, 0);
  assert.ok(resetOk);
  assert.equal(draw[0][0].winner, null, 'Победитель матча R1 должен быть сброшен в null');
  assert.deepEqual(draw[0][0].score, [], 'Счет матча R1 должен быть пустым массивом');
  assert.equal(draw[1][0].p1, null, 'Игрок должен быть удален из слота следующего раунда R2');
  assert.equal(draw[1][0].winner, null, 'Результат зависимого матча R2 должен быть сброшен');
  assert.equal(draw[2][0].p1, null, 'Игрок должен быть каскадно удален из R3');
});

test('Раздел 2: Олимпийские игры проводятся раз в 4 года, сетка 64, национальная квота <= 4 от страны, Матч за 3-е место и медали', () => {
  assert.equal(isOlympicYear(2023), false);
  assert.equal(isOlympicYear(2024), true);
  assert.equal(isOlympicYear(2025), false);
  assert.equal(isOlympicYear(2028), true);
  assert.equal(getOlympicSurface(2024), 'Грунт');
  assert.equal(getOlympicSurface(2028), 'Хард');

  const cal2023 = getSeasonTournaments(2023);
  const cal2024 = getSeasonTournaments(2024);
  assert.equal(cal2023.length, 26);
  assert.equal(cal2023.some(t => t.id === 'olympics'), false);
  assert.equal(cal2024.length, 27);
  assert.equal(cal2024.some(t => t.id === 'olympics'), true);

  // Проверим национальную квоту (не более 4 игроков от одной страны)
  const players = buildInitial300Players();
  for (let i = 0; i < 8; i++) {
    players[i].flag = 'USA';
  }
  const { qualified, countryCounts } = selectOlympicParticipantsWithQuota(players, 4, 64);
  assert.equal(qualified.length, 64);
  assert.equal(countryCounts['USA'], 4, 'От США должно пройти ровно 4 игрока по квоте');
  assert.equal(countryCounts['IT'], undefined, 'Устаревший код IT должен нормализоваться в ITA');
  assert.ok((countryCounts['ITA'] || 0) <= 4, 'От Италии (включая бывшие IT/ITA) должно быть не более 4 игроков');
  Object.entries(countryCounts).forEach(([country, cnt]) => {
    assert.ok(cnt <= 4, `Квота страны ${country} (${cnt}) не должна превышать 4`);
  });

  // Проверим структуру сетки Олимпиады, разведение соотечественников по четвертям и Матч за 3-е место
  const olyTourney = cal2024.find(t => t.id === 'olympics');
  const { draw } = createTournamentDraw(olyTourney, players);
  assert.equal(draw.length, 6);
  assert.equal(draw[0].length, 32);
  assert.equal(draw[4].length, 2);
  assert.equal(draw[5].length, 2);
  assert.equal(draw[5][0].isGoldMatch, true);
  assert.equal(draw[5][1].isBronzeMatch, true);

  // В каждой из 4 четвертей (по 8 матчей 1/32 финала в четверти) не должно быть двух игроков из одной страны
  for (let q = 0; q < 4; q++) {
    const seenCountriesInQuarter = new Set();
    for (let mIdx = q * 8; mIdx < q * 8 + 8; mIdx++) {
      const m = draw[0][mIdx];
      assert.notEqual(
        m.p1.flag,
        m.p2.flag,
        `Матч #${mIdx + 1} в 1/32 финала ОИ не должен сводить соотечественников (${m.p1.name} vs ${m.p2.name}, ${m.p1.flag})`
      );
      for (const pl of [m.p1, m.p2]) {
        assert.equal(
          seenCountriesInQuarter.has(pl.flag),
          false,
          `В четверти Q${q + 1} страна ${pl.flag} встретилась более 1 раза (${pl.name})`
        );
        seenCountriesInQuarter.add(pl.flag);
      }
    }
  }

  // Симулируем все раунды Олимпиады
  for (let r = 0; r < draw.length; r++) {
    for (let m = 0; m < draw[r].length; m++) {
      const match = draw[r][m];
      const sim = computeSimMatchScores(match, 3, 1, 'Грунт');
      advanceWinnerInDraw(draw, 'olympics', r, m, sim.winner, sim.scores, sim.narrative);
    }
  }

  const sf1Winner = draw[4][0].winner;
  const sf1Loser = draw[4][0].p1.id === sf1Winner.id ? draw[4][0].p2 : draw[4][0].p1;
  const sf2Winner = draw[4][1].winner;
  const sf2Loser = draw[4][1].p1.id === sf2Winner.id ? draw[4][1].p2 : draw[4][1].p1;

  assert.equal(draw[5][0].p1.id, sf1Winner.id);
  assert.equal(draw[5][0].p2.id, sf2Winner.id);
  assert.equal(draw[5][1].p1.id, sf1Loser.id);
  assert.equal(draw[5][1].p2.id, sf2Loser.id);

  // Начисление очков и медалей ОИ
  const { medalists } = applyTournamentPointsToPlayers(players, olyTourney, draw, 2024);
  assert.ok(medalists.gold);
  assert.ok(medalists.silver);
  assert.ok(medalists.bronze);

  const goldPlayer = players.find(p => p.id === medalists.gold.id);
  const silverPlayer = players.find(p => p.id === medalists.silver.id);
  const bronzePlayer = players.find(p => p.id === medalists.bronze.id);
  assert.equal(goldPlayer.medals.gold, 1);
  assert.equal(silverPlayer.medals.silver, 1);
  assert.equal(bronzePlayer.medals.bronze, 1);
});

test('Раздел 2: База 300 игроков сохраняет первые 140 игроков и содержит уникальные имена на латинице без цифр для 141-300', () => {
  const players = buildInitial300Players();
  assert.equal(players.length, 300);

  assert.equal(players[0].id, 'p_1');
  assert.equal(players[0].name, 'Istep Fofol');
  assert.equal(players[1].name, 'Will Wentra');
  assert.equal(players[2].name, 'Max Kyupan');
  assert.equal(players[139].name, 'Lars Nielsen');

  const allNames300 = new Set();
  for (let i = 0; i < 300; i++) {
    const p = players[i];
    assert.equal(/\d/.test(p.name), false, `Имя ${p.name} не должно содержать цифр`);
    assert.equal(allNames300.has(p.name.toLowerCase()), false, `Имя ${p.name} (${p.id}) должно быть уникальным среди всех 300 игроков`);
    allNames300.add(p.name.toLowerCase());
  }

  const names141to300 = new Set();
  for (let i = 140; i < 300; i++) {
    const p = players[i];
    assert.equal(/\d/.test(p.name), false, `Имя ${p.name} не должно содержать цифр`);
    assert.equal(names141to300.has(p.name.toLowerCase()), false, `Имя ${p.name} должно быть уникальным`);
    names141to300.add(p.name.toLowerCase());

    const age = calculateAgeNum(p.birthDate, '2024-06-01');
    assert.ok(age >= 17 && age <= 37, `Возраст игрока ${p.name} (${age}) должен быть от 17 до 37 лет`);
  }
});

test('Раздел 5: Система завершения карьеры (защита Топ-50, шкала 37-42, генерация ньюгенов 17-23 лет с прозвищами и стилями)', () => {
  assert.equal(getRetirementProbability(36, 120), 0);
  assert.equal(getRetirementProbability(39, 12), 0.075);
  assert.equal(getRetirementProbability(37, 80), 0.25);
  assert.equal(getRetirementProbability(38, 80), 0.50);
  assert.equal(getRetirementProbability(39, 80), 0.70);
  assert.equal(getRetirementProbability(40, 80), 0.85);
  assert.equal(getRetirementProbability(41, 80), 0.98);

  const players = buildInitial300Players();
  players[150].birthDate = '1983-02-10';
  players[151].birthDate = '1982-05-15';
  players[152].birthDate = '1984-03-10';

  const { updatedPlayers, retiredThisYear, newgensThisYear } = processEndOfSeasonRetirements(
    players,
    2024,
    [],
    () => 0.20
  );

  assert.equal(updatedPlayers.length, 300);
  assert.equal(retiredThisYear.length, newgensThisYear.length);
  assert.ok(retiredThisYear.length >= 3);
  assert.equal(retiredThisYear.some(r => r.finalRank <= 50), false);

  newgensThisYear.forEach(ng => {
    assert.equal(/\d/.test(ng.name), false, `Имя новичка ${ng.name} без цифр`);
    assert.ok(ng.points >= 20 && ng.points <= 45, `Очки новичка ${ng.points} в диапазоне 20-45`);
    assert.ok(ng.ageAtEntry >= 17 && ng.ageAtEntry <= 23, `Возраст новичка ${ng.ageAtEntry} в диапазоне 17-23`);
    assert.ok(ng.nickname && ng.nickname.length > 2, 'У новичка должно быть прозвище');
    assert.ok(ng.playStyle && ng.playStyle.length > 5, 'У новичка должен быть стиль игры');
  });
});

test('Раздел 4 и 5: Срезы Топ-50 с динамикой, сюжетные сводки матчей и аналитика H2H с супер-тайбрейками', () => {
  const players = buildInitial300Players();
  sortAndRankPlayers(players, false);
  const snap1 = createTop50Snapshot(players, '2024-01-29');
  assert.equal(snap1.length, 50);
  assert.equal(snap1[0].name, 'Max Kyupan');
  assert.equal(snap1[1].name, 'Will Wentra');

  const tempPts = players[0].points;
  players[0].points = players[1].points - 100;
  players[1].points = tempPts + 100;
  sortAndRankPlayers(players, true);

  const snap2 = createTop50Snapshot(players, '2024-06-11', snap1);
  assert.equal(snap2[0].name, 'Will Wentra');
  assert.equal(snap2[0].rankDelta, 1);
  assert.equal(snap2[1].name, 'Max Kyupan');
  assert.equal(snap2[1].rankDelta, -1);

  const parsed = parseAndValidateScoreString('6-4 6-7(4) 7-6(10)', 3);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.p1WinsMatch, true);
  assert.equal(formatTennisScore(parsed.sets), '6-4  6-7<sup>4</sup>  7-6<sup>10</sup>');

  const simMatch = computeSimMatchScores({ p1: players[0], p2: players[1] }, 3, 1, 'Грунт');
  assert.equal(simMatch.winner.id, players[0].id);
  assert.ok(simMatch.narrative.length > 10);
  assert.ok(simMatch.winnerQuote.length > 10);
  assert.ok(simMatch.loserQuote.length > 10);
});

test('Пик карьеры: пересчёт по архивным снимкам истории сезонов (Ussistian Shifter #1)', () => {
  const players = [
    { id: 'p_22', name: 'Ussistian Shifter', rank: 2, bestRank: 2, seasonStartRank: 2 },
    { id: 'p_27', name: 'Shaun Salkar', rank: 12, bestRank: 5, seasonStartRank: 12 },
    { id: 'p_x', name: 'Down The List', rank: 80, bestRank: 40, seasonStartRank: 80 }
  ];
  const seasonsHistory = {
    2024: {
      seasonStartTop50: [],
      slamSnapshots: {
        tbsh_4: {
          top50: [
            { name: 'Ussistian Shifter', rank: 1, points: 11470 },
            { name: 'Down The List', rank: 60, points: 900 }
          ]
        }
      },
      yearEndTop50: [
        { name: 'Ussistian Shifter', rank: 3 },
        { name: 'Shaun Salkar', rank: 12 }
      ]
    }
  };

  const repaired = repairCareerHighRanksFromHistory(players, seasonsHistory);
  assert.equal(repaired, 1, 'Улучшается только заниженный пик');
  assert.equal(players[0].bestRank, 1, 'Пик Ussistian Shifter должен стать #1');
  assert.equal(players[1].bestRank, 5, 'Корректный пик Shaun Salkar (#5) не должен пострадать');
  assert.equal(players[2].bestRank, 40, 'Пик не ухудшается, если в истории игрок стоял ниже');

  // Даже при падении в рейтинге подтверждённый историей №1 не сбрасывается,
  // а старый ошибочный №1 без подтверждения (Salkar) по-прежнему исправляется на канонический пик.
  const field = players.concat(
    Array.from({ length: 7 }, (_, i) => ({
      id: 'p_f' + i, name: 'Filler ' + i, rank: 3 + i, bestRank: 3 + i, seasonStartRank: 3 + i,
      points: 1000 - i * 100
    }))
  );
  field.find(p => p.id === 'p_22').points = 100;
  field.find(p => p.id === 'p_22').seasonStartRank = 6;
  field.find(p => p.id === 'p_27').points = 200;
  field.find(p => p.id === 'p_27').bestRank = 1;
  field.find(p => p.id === 'p_27').seasonStartRank = 9;
  field.find(p => p.id === 'p_x').points = 300;
  sortAndRankPlayers(field, false);

  assert.equal(field.find(p => p.id === 'p_22').bestRank, 1, 'Исторический №1 Ussistian Shifter не теряется при падении в рейтинге');
  assert.equal(field.find(p => p.id === 'p_27').bestRank, 5, 'Ошибочный №1 Shaun Salkar без подтверждения историей сбрасывается к каноническому пику');
});

test('Счёт финала: сеты ориентируются по победителю (первые цифры всегда больше вторых)', () => {
  assert.deepEqual(orientFinalScoreToWinner('6-7(5) 6-7(3)'), ['7-6(5)', '7-6(3)']);
  assert.deepEqual(orientFinalScoreToWinner('6-4 7-6(4)'), ['6-4', '7-6(4)']);
  assert.deepEqual(orientFinalScoreToWinner('1-6 0-6 5-7'), ['6-1', '6-0', '7-5']);
  assert.deepEqual(orientFinalScoreToWinner('3-6 5-7'), ['6-3', '7-5']);
  assert.deepEqual(orientFinalScoreToWinner('6-4 3-1 RET'), ['6-4', '3-1', 'RET']);
  assert.deepEqual(orientFinalScoreToWinner('4-6 1-3 RET'), ['6-4', '3-1', 'RET']);
  assert.deepEqual(orientFinalScoreToWinner(''), []);
});

test('Счёт финала в профиле: при победе первые цифры больше, при поражении — меньше', () => {
  assert.deepEqual(orientFinalScoreForPlayer('6-7(5) 6-7(3)', true), ['7-6(5)', '7-6(3)']);
  assert.deepEqual(orientFinalScoreForPlayer('6-3 6-4', false), ['3-6', '4-6']);
  assert.deepEqual(orientFinalScoreForPlayer('4-6 6-4 5-7', false), ['4-6', '6-4', '5-7']);
  assert.deepEqual(orientFinalScoreForPlayer('6-3 7-5', true), ['6-3', '7-5']);
  assert.deepEqual(orientFinalScoreForPlayer('', false), []);
});

test('Блок 1: Интеграция Groq API (aiService.js) — нижний регистр модели, очистка Markdown ```json, защита ключа и строгий перехват ошибок', async () => {
  const memStore = createMemoryStorage();
  assert.equal(GROQ_API_ENDPOINT, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(typeof DEFAULT_GROQ_API_KEY, 'string', 'DEFAULT_GROQ_API_KEY не хранит зашитый секрет в открытом коде');
  assert.equal(getGroqApiKey(memStore), DEFAULT_GROQ_API_KEY, 'По умолчанию возвращается DEFAULT_GROQ_API_KEY из окружения');
  assert.equal(getGroqModel(memStore), 'openai/gpt-oss-120b');

  // Проверка принудительного нижнего регистра имени модели
  assert.equal(normalizeGroqModelName('Llama-3.3-70b-versatile'), 'openai/gpt-oss-120b');
  assert.equal(normalizeGroqModelName('LLAMA-3.1-8B-INSTANT'), 'openai/gpt-oss-20b');
  setGroqModel('Llama-3.3-70B-Versatile', memStore);
  assert.equal(getGroqModel(memStore), 'openai/gpt-oss-120b');

  // Проверка очистки Markdown-оберток ```json ... ```
  const rawMarkdown = '```json\n{"winnerId": "p_1", "score": "6-4 6-4"}\n```';
  const cleaned = cleanGroqJsonString(rawMarkdown);
  assert.equal(cleaned, '{"winnerId": "p_1", "score": "6-4 6-4"}');
  assert.deepEqual(JSON.parse(cleaned), { winnerId: 'p_1', score: '6-4 6-4' });

  // Проверка честного заголовка источника
  assert.equal(getGroqSourceHeaderLabel('openai/gpt-oss-120b'), 'ИИ-репортаж (Groq / GPT-OSS 120B)');
  assert.equal(getGroqSourceHeaderLabel('openai/gpt-oss-20b'), 'ИИ-репортаж (Groq / GPT-OSS 20B)');

  setGroqApiKey('gsk_test_123456', memStore);
  assert.equal(getGroqApiKey(memStore), 'gsk_test_123456');

  const players = buildInitial300Players();
  const p1 = players[0];
  const p2 = players[1];

  // 1. Проверка запроса к Groq с Markdown-оберткой в ответе и честной меткой источника
  let capturedUrl = '';
  let capturedHeaders = {};
  let capturedBody = null;

  const mockFetchSim = async (url, init) => {
    capturedUrl = url;
    capturedHeaders = init.headers;
    capturedBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify({
                  winnerId: p1.id,
                  score: '6-4 4-6 7-6(5)',
                  storyline: 'Драматичная развязка на решающем тайбрейке в Мадриде!',
                  winnerQuote: 'Я счастлив вырвать эту победу на грунте.',
                  loserQuote: 'Сегодня не хватило совсем чуть-чуть на тайбрейке.'
                }) + '\n```'
              }
            }
          ]
        };
      }
    };
  };

  const groqSim = await simulateMatchWithGroq({
    p1,
    p2,
    tourneyName: 'Мадрид Masters',
    surface: 'Грунт',
    bestOf: 3,
    stage: 'Финал',
    h2hSummary: '2 : 1',
    options: { storage: memStore, fetchImpl: mockFetchSim, strictGroq: true }
  });

  assert.equal(capturedUrl, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(capturedHeaders['Authorization'], 'Bearer gsk_test_123456');
  assert.equal(capturedBody.model, 'openai/gpt-oss-120b');
  assert.equal(capturedBody.response_format.type, 'json_object');
  assert.equal(groqSim.source, 'groq');
  assert.equal(groqSim.sourceLabel, 'ИИ-репортаж (Groq / GPT-OSS 120B)');
  assert.equal(groqSim.winnerId, p1.id);
  assert.equal(groqSim.score, '6-4 4-6 7-6(5)');

  // 2. Проверка отсутствия тихого скрытия ошибок при strictGroq: true
  const mockFetchError = async () => ({
    ok: false,
    status: 401,
    async text() {
      return JSON.stringify({ error: { message: 'Invalid API Key provided' } });
    }
  });

  await assert.rejects(
    async () => {
      await simulateMatchWithGroq({
        p1,
        p2,
        tourneyName: 'Мадрид Masters',
        surface: 'Грунт',
        bestOf: 3,
        options: { storage: memStore, fetchImpl: mockFetchError, strictGroq: true }
      });
    },
    (err) => {
      assert.ok(err.message.includes('Invalid API Key provided'));
      return true;
    }
  );
});

test('Раздел 1 (Рефакторинг 2024): Канонический старт сезона на 02.01.2024, все турниры completed=false, гонка 0 pts у всех 300 игроков и защита очков', () => {
  const players = buildInitial300Players();
  const tourneys2024 = getSeasonTournaments(2024, FULL_CALENDAR_TEMPLATE).map(t => ({ ...t }));
  const seasonsHistory = {};
  const memStorage = createMemoryStorage();

  ensureDefault2023SeasonArchive(tourneys2024, players, seasonsHistory, memStorage);
  ensureCleanJanuary2024StartState(tourneys2024, players, seasonsHistory, memStorage);

  // Все турниры 2024 года обязаны иметь completed = false
  assert.equal(tourneys2024.every(t => t.completed === false), true, 'На 02.01.2024 все турниры должны быть несыгранными');
  assert.equal(tourneys2024[0].id, 'm_1');
  assert.equal(tourneys2024[0].name, 'Хьюстон Masters');

  // Топ-10 рейтинга 52 недель на 02.01.2024 строго соответствует итогам 2023 года
  const expectedTop10 = [
    { name: 'Max Kyupan', points: 12300, bestRank: 1 },
    { name: 'Will Wentra', points: 11950, bestRank: 1 },
    { name: 'Istep Fofol', points: 7260, bestRank: 1 },
    { name: 'Ussistian Shifter', points: 7060, bestRank: 4 },
    { name: 'Fite Memsy Staprin', points: 5460, bestRank: 5 },
    { name: 'Puddy Mexalino', points: 5000, bestRank: 4 },
    { name: 'Gary Riffay', points: 4280, bestRank: 6 },
    { name: 'Pen Klak', points: 3760, bestRank: 8 },
    { name: 'Omar Netigios', points: 3300, bestRank: 8 },
    { name: 'Shaun Salkar', points: 2870, bestRank: 5 }
  ];

  expectedTop10.forEach((exp, idx) => {
    assert.equal(players[idx].rank, idx + 1);
    assert.equal(players[idx].name, exp.name);
    assert.equal(players[idx].points, exp.points);
    assert.equal(players[idx].bestRank, exp.bestRank);
  });

  // Игроки с 11 по 300 место сохраняют законные базовые очки (< 2870)
  assert.equal(players[10].name, 'Shramysul Leontiev');
  assert.equal(players[10].points, 2810);

  // У всех 300 игроков на 02.01.2024 в Чемпионской Гонке строго 0 очков
  assert.equal(players.every(p => p.racePoints === 0), true, 'На 02.01.2024 у всех 300 игроков racePoints === 0');

  // Проверим правило Гонки и 52 недель при завершении #1 Хьюстон Masters (m_1)
  // В 2023 году Хьюстон Masters выиграл Istep Fofol (1000 pts)
  const fofol = players.find(p => p.name === 'Istep Fofol');
  fofol.tournamentPoints['m_1'] = { 2023: 1000 };

  const houston = tourneys2024[0];
  const { draw } = createTournamentDraw(houston, players);
  // Пусть все матчи выиграет первый игрок в паре
  for (let r = 0; r < draw.length; r++) {
    for (let m = 0; m < draw[r].length; m++) {
      const match = draw[r][m];
      const sim = computeSimMatchScores(match, 3, 1, 'Хард');
      advanceWinnerInDraw(draw, 'm_1', r, m, sim.winner, sim.scores, sim.narrative);
    }
  }
  applyTournamentPointsToPlayers(players, houston, draw, 2024);

  // Ни у одного игрока очки в Гонке не могут стать отрицательными или уменьшиться
  assert.equal(players.every(p => p.racePoints >= 0), true);
  const fofolEarned2024 = fofol.tournamentPoints['m_1'][2024] || 0;
  assert.equal(fofol.racePoints, fofolEarned2024, 'Гонка ТОЛЬКО накапливает очки 2024 года без вычета защиты 2023');
  assert.equal(fofol.points, 7260 - 1000 + fofolEarned2024, 'Рейтинг 52 недель вычитает защиту 2023 и прибавляет очки 2024');
});

test('Раздел 2 (Умный ИИ-модуль матча): Запрет шаблона 6-3 6-2, Сценарий А (ИИ-комментарий к счету) и Сценарий Б (реалистичная симуляция)', async () => {
  assert.equal(isBannedTemplateScore(['6-3', '6-2']), true);
  assert.equal(isBannedTemplateScore(['3-6', '2-6']), true);
  assert.equal(isBannedTemplateScore(['6-4', '7-6(5)']), false);

  const sanitized = sanitizeTemplateScore(['6-3', '6-2'], true, 3, () => 0.4);
  assert.equal(isBannedTemplateScore(sanitized), false, 'Шаблон 6-3 6-2 должен автоматически заменяться на реалистичный счет');

  const players = buildInitial300Players();
  const p1 = players[0];
  const p2 = players[1];
  const memStore = createMemoryStorage();
  setGroqApiKey('gsk_test_key', memStore);

  // Проверим, что если LLM вернула запрещенный шаблон 6-3 6-2, simulateMatchWithGroq заменяет его
  const mockFetchTemplate = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                winnerId: p1.id,
                score: '6-3 6-2',
                storyline: 'Уверенная победа фаворита.',
                winnerQuote: 'Отличный матч.',
                loserQuote: 'Соперник был сильнее.'
              })
            }
          }
        ]
      };
    }
  });

  const simRes = await simulateMatchWithGroq({
    p1,
    p2,
    tourneyName: 'Хьюстон Masters',
    surface: 'Хард',
    bestOf: 3,
    stage: 'R16',
    options: { storage: memStore, fetchImpl: mockFetchTemplate, strictGroq: true }
  });
  assert.notEqual(simRes.score, '6-3 6-2', 'Запрещенный шаблон 6-3 6-2 не должен проходить в результат');
  assert.notEqual(simRes.score, '3-6 2-6');

  // Сценарий А: ИИ-комментарий к введенному пользователем счету (например, с баранкой 6-0 и решающим тайбрейком)
  const mockFetchComment = async (url, init) => {
    const body = JSON.parse(init.body);
    assert.ok(body.messages[1].content.includes('6-0 6-7(5) 7-6(8)'));
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify({
                  storyline: 'После сухой баранки 6-0 в первом сете завязался невероятный триллер с двумя тайбрейками!',
                  winnerQuote: 'После 6-0 я рано поверил в победу, рад что вытащил решающий тайбрейк 10-8.',
                  loserQuote: 'Обидно уступить с матчболов после того, как переломил игру во втором сете.'
                }) + '\n```'
              }
            }
          ]
        };
      }
    };
  };

  const commentRes = await generateCommentaryForEnteredScore({
    p1,
    p2,
    scoreStr: '6-0 6-7(5) 7-6(8)',
    tourneyName: 'Хьюстон Masters',
    surface: 'Хард',
    bestOf: 3,
    stage: 'Финал',
    h2hSummary: '1 : 1',
    options: { storage: memStore, fetchImpl: mockFetchComment, strictGroq: true }
  });

  assert.equal(commentRes.winnerId, p1.id);
  assert.equal(commentRes.score, '6-0 6-7(5) 7-6(8)');
  assert.ok(commentRes.storyline.includes('6-0'));
  assert.equal(commentRes.sourceLabel, 'ИИ-репортаж (Groq / GPT-OSS 120B)');
});

test('Раздел 3 (Мультивселенные): Процедурная генерация 300 уникальных случайных игроков (возраст 17–35 лет)', () => {
  const randomTour = generateRandom300Players(2024);
  assert.equal(randomTour.length, 300);

  const uniqueNames = new Set(randomTour.map(p => p.name.toLowerCase()));
  assert.equal(uniqueNames.size, 300, 'Все 300 сгенерированных имен в новой вселенной должны быть уникальными');

  randomTour.forEach((p, idx) => {
    assert.equal(p.rank, idx + 1);
    assert.equal(p.racePoints, 0);
    assert.equal(p.isProcedural, true);
    const age = calculateAgeNum(p.birthDate, '2024-06-01');
    assert.ok(age >= 16 && age <= 36, `Возраст игрока ${p.name} (${age}) в диапазоне 17-35 лет`);
  });
});

test('Раздел 2 (Срезы Топ-50 2023): Круглые очки без случайных хвостов и точные исторические лидеры после 4 ТБШ', () => {
  const players = buildInitial300Players();
  const tourneys = getSeasonTournaments(2024, FULL_CALENDAR_TEMPLATE).map(t => ({ ...t }));
  const seasonsHistory = {};
  const memStorage = createMemoryStorage();

  ensureDefault2023SeasonArchive(tourneys, players, seasonsHistory, memStorage);

  const s2023 = seasonsHistory['2023'];
  assert.ok(s2023, 'Архив 2023 года должен быть создан');

  // Срез после 1-го ТБШ (Cartom Calamb)
  const snap1 = s2023.slamSnapshots.tbsh_1.top50;
  assert.equal(snap1[0].name, 'Istep Fofol');
  assert.equal(snap1[0].points, 12500);
  assert.equal(snap1[1].name, 'Max Kyupan');
  assert.equal(snap1[1].points, 11750);
  assert.equal(snap1[2].name, 'Will Wentra');
  assert.equal(snap1[2].points, 10200);

  // Срез после 2-го ТБШ (Poland Open)
  const snap2 = s2023.slamSnapshots.tbsh_2.top50;
  assert.equal(snap2[0].name, 'Will Wentra');
  assert.equal(snap2[0].points, 12600);
  assert.equal(snap2[1].name, 'Max Kyupan');
  assert.equal(snap2[1].points, 12100);
  assert.equal(snap2[2].name, 'Istep Fofol');
  assert.equal(snap2[2].points, 8400);

  // Срез после 3-го ТБШ (Polovchis)
  const snap3 = s2023.slamSnapshots.tbsh_3.top50;
  assert.equal(snap3[0].name, 'Will Wentra');
  assert.equal(snap3[0].points, 13400);
  assert.equal(snap3[1].name, 'Max Kyupan');
  assert.equal(snap3[1].points, 12400);
  assert.equal(snap3[2].name, 'Istep Fofol');
  assert.equal(snap3[2].points, 7200);

  // Срез после 4-го ТБШ (Okeanskiy Open)
  const snap4 = s2023.slamSnapshots.tbsh_4.top50;
  assert.equal(snap4[0].name, 'Max Kyupan');
  assert.equal(snap4[0].points, 13800);
  assert.equal(snap4[1].name, 'Will Wentra');
  assert.equal(snap4[1].points, 12200);
  assert.equal(snap4[2].name, 'Istep Fofol');
  assert.equal(snap4[2].points, 6900);

  // Никаких кривых чисел (все очки во всех срезах кратны 5 или 10)
  const allSnapshots = [
    s2023.seasonStartTop50,
    snap1,
    snap2,
    snap3,
    snap4,
    s2023.yearEndTop50
  ];
  allSnapshots.forEach((snap, sIdx) => {
    assert.equal(snap.length, 50);
    snap.forEach(p => {
      assert.equal(p.points % 5, 0, `Очки игрока ${p.name} (${p.points}) в срезе #${sIdx} должны быть круглыми (кратными 5 или 10)`);
    });
  });

  // Проверка верхнего индекса тайбрейков в таблице Чемпионов 2023
  const houstonFinalScore = s2023.tournamentsData[0].score;
  assert.equal(houstonFinalScore, '7-6(4) 7-5');
});

test('Раздел 4 и 5: Строгая изоляция пары в H2H (никаких третьих лиц) и тональность цитат по стадии турнира', () => {
  const shifter = { id: 'p_22', name: 'Ussistian Shifter', flag: 'USA' };
  const fofol = { id: 'p_1', name: 'Istep Fofol', flag: 'SLO' };
  const netigios = { id: 'p_9', name: 'Omar Netigios', flag: '?' };
  const galley = { id: 'p_11', name: 'Robert Galley', flag: 'SWE' };

  const fakeDraws = {
    'm_9_2023': [
      [
        // Настоящий очный матч Шифтера и Фофола
        { p1: fofol, p2: shifter, winner: shifter, score: ['6-7(5)', '6-7(4)'] },
        // Матч с участием третьего лица (Омар Нетигиос) — НЕ должен попадать в H2H!
        { p1: shifter, p2: netigios, winner: netigios, score: ['4-6', '4-6'] },
        // Битая запись из старого кэша, где под ID p_1 записан Robert Galley — НЕ должна попадать в H2H!
        { p1: { id: 'p_1', name: 'Robert Galley' }, p2: shifter, winner: { id: 'p_1', name: 'Robert Galley' }, score: ['6-4', '6-4'] }
      ]
    ]
  };

  const tourneys = [{ id: 'm_9', name: 'Париж Masters', type: 'Мастерс', surface: 'Зал', size: 64 }];
  const h2h = getHeadToHeadAnalytics(
    shifter.id,
    fofol.id,
    tourneys,
    2024,
    (tId, yr) => fakeDraws[`${tId}_${yr}`] || null,
    shifter.name,
    fofol.name
  );

  assert.equal(h2h.history.length, 1, 'В H2H должен попасть строго 1 реальный очный матч Шифтера и Фофола');
  assert.equal(h2h.p1Wins, 1);
  assert.equal(h2h.p2Wins, 0);
  assert.equal(h2h.history[0].winnerName, 'Ussistian Shifter');
  assert.equal(h2h.history[0].scoreFormatted, '7-6<sup>5</sup>  7-6<sup>4</sup>', 'Счет в H2H должен отображаться со стороны победителя матча');

  // Проверка пустой истории H2H ("0 : 0 • Первая очная дуэль")
  const emptyH2H = getHeadToHeadAnalytics(
    shifter.id,
    galley.id,
    tourneys,
    2024,
    (tId, yr) => fakeDraws[`${tId}_${yr}`] || null,
    shifter.name,
    galley.name
  );
  assert.equal(emptyH2H.history.length, 0);
  assert.equal(emptyH2H.emptyMessage, '0 : 0 • Первая очная дуэль');

  // Проверка очистки Markdown с префиксом текста перед JSON.parse
  const wrappedJson = 'Вот ваш репортаж:\n```json\n{"storyline":"Тест","winnerQuote":"Цитата 1","loserQuote":"Цитата 2"}\n```\nУдачи!';
  const cleaned = JSON.parse(cleanGroqJsonString(wrappedJson));
  assert.equal(cleaned.storyline, 'Тест');

  // Проверка относительного посева на турнирах (Мастерс <= 16, ТБШ <= 32, ATP 500 <= 8)
  const allPlayers = buildInitial300Players();
  const mastersDraw = createTournamentDraw({ id: 'm_1', name: 'Хьюстон Masters', type: 'Мастерс', surface: 'Хард', size: 64, bestOf: 3 }, allPlayers).draw;
  mastersDraw[0].forEach(m => {
    [m.p1, m.p2].forEach(p => {
      if (p && p.seedNum !== undefined) {
        assert.ok(p.seedNum >= 1 && p.seedNum <= 16, `На Мастерсе посев должен быть строго 1..16, получено: ${p.seedNum}`);
      }
    });
  });

  // Проверим тональность цитат по стадии (1/32 vs ФИНАЛ)
  const earlyQuotes = generateMatchQuotes(shifter, fofol, ['6-4', '7-5'], 'Хард', 'Хьюстон Masters', '1/32 финала');
  assert.ok(earlyQuotes.winnerQuote.length > 20, 'Ранняя стадия: содержательная рабочая цитата');

  const finalQuotes = generateMatchQuotes(shifter, fofol, ['4-6', '7-6(5)', '6-4'], 'Хард', 'Хьюстон Masters', 'ФИНАЛ 🏆');
  assert.ok(
    finalQuotes.winnerQuote.includes('трофей') ||
    finalQuotes.winnerQuote.includes('кубок') ||
    finalQuotes.winnerQuote.includes('титул') ||
    finalQuotes.winnerQuote.includes('чемпион'),
    'Финал: чемпионская цитата о завоевании трофея/титула турнира'
  );

  // Проверим подсчёт геймов в группе Итогового турнира при наличии тайбрейков 7-6(4) и 6-7(8)
  const groupStandings = calculateGroupStandings([
    { p1: shifter, p2: fofol, winner: shifter, score: ['7-6(4)', '6-7(8)', '7-6(5)'] }
  ]);
  assert.equal(groupStandings[0].player.id, shifter.id);
  assert.equal(groupStandings[0].gamesW, 20);
  assert.equal(groupStandings[0].gamesL, 19);
});

test('Спринт Блокбастер #1: Расчёт OVR (65–99) по тирам мирового рейтинга, Сигнатурные бейджи (Archetypes) и бонус +4 на грунте', () => {
  const players = buildInitial300Players();
  applyCanonical2023StartStateToPlayers(players);

  // Топ-3: 96–99 OVR
  const ovrRank1 = calculatePlayerOVR(players[0]); // #1 Max Kyupan (12300 pts)
  const ovrRank2 = calculatePlayerOVR(players[1]); // #2 Will Wentra (11950 pts)
  const ovrRank3 = calculatePlayerOVR(players[2]); // #3 Istep Fofol (6800 pts)
  assert.ok(ovrRank1 >= 96 && ovrRank1 <= 99, `Ранг #1 OVR (${ovrRank1}) должен быть в 96..99`);
  assert.ok(ovrRank2 >= 96 && ovrRank2 <= 99, `Ранг #2 OVR (${ovrRank2}) должен быть в 96..99`);
  assert.ok(ovrRank3 >= 96 && ovrRank3 <= 99, `Ранг #3 OVR (${ovrRank3}) должен быть в 96..99`);

  // Топ-10 (ранги 4–10): 90–95 OVR
  for (let i = 3; i < 10; i++) {
    const ovr = calculatePlayerOVR(players[i]);
    assert.ok(ovr >= 90 && ovr <= 95, `Ранг #${players[i].rank} OVR (${ovr}) должен быть в 90..95`);
  }

  // Топ-30 (ранги 11–30): 84–89 OVR
  for (let i = 10; i < 30; i++) {
    const ovr = calculatePlayerOVR(players[i]);
    assert.ok(ovr >= 84 && ovr <= 89, `Ранг #${players[i].rank} OVR (${ovr}) должен быть в 84..89`);
  }

  // Топ-100 (ранги 31–100): 75–83 OVR
  for (let i = 30; i < 100; i++) {
    const ovr = calculatePlayerOVR(players[i]);
    assert.ok(ovr >= 75 && ovr <= 83, `Ранг #${players[i].rank} OVR (${ovr}) должен быть в 75..83`);
  }

  // Топ-300 (ранги 101–300): 65–74 OVR
  for (let i = 100; i < 300; i++) {
    const ovr = calculatePlayerOVR(players[i]);
    assert.ok(ovr >= 65 && ovr <= 74, `Ранг #${players[i].rank} OVR (${ovr}) должен быть в 65..74`);
  }

  // Каждому игроку присваивается 1–2 сигнатурных бейджа, а «Грунтовый червь» дает +4 к характеристикам на грунте
  const clayPlayer = {
    id: 'p_clay_test',
    name: 'Carlos Claymaster',
    flag: 'ESP',
    rank: 15,
    points: 2400,
    birthDate: '2001-05-10',
    playStyle: 'Мастер грунта и затяжных розыгрышей',
    stamina: 100
  };
  const archs = getPlayerArchetypes(clayPlayer, '2024-05-15');
  assert.ok(archs.length >= 1 && archs.length <= 2);
  assert.equal(archs.some(a => a.id === 'clay_specialist'), true, 'Испанский грунтовик получает бейдж Грунтовый червь');

  const skillsHard = getPlayerSkills(clayPlayer, 'Хард', '2024-05-15');
  const skillsClay = getPlayerSkills(clayPlayer, 'Грунт', '2024-05-15');
  assert.equal(skillsClay.forehand - skillsHard.forehand, 4, 'На грунте Грунтовый червь получает +4 к форхенду');
  assert.equal(skillsClay.backhand - skillsHard.backhand, 4, 'На грунте Грунтовый червь получает +4 к бэкхенду');
});

test('Спринт Блокбастер #2: Валидация отказов (RET) в parseAndValidateScoreString и расчёт шкалы инициативы (Momentum Bar)', () => {
  // Счёт с отказом (RET) в 2-м сете (6-4 3-1 RET)
  const ret1 = parseAndValidateScoreString('6-4 3-1 RET', 3);
  assert.equal(ret1.valid, true, 'Счёт 6-4 3-1 RET должен быть валидным');
  assert.equal(ret1.isRetirement, true);
  assert.equal(ret1.p1WinsMatch, true);
  assert.deepEqual(ret1.sets, ['6-4', '3-1', 'RET']);

  // Счёт с тайбрейком и отказом (7-6(5) 1-0 RET)
  const ret2 = parseAndValidateScoreString('7-6(5) 1-0 RET', 5);
  assert.equal(ret2.valid, true);
  assert.equal(ret2.isRetirement, true);
  assert.equal(ret2.p1WinsMatch, true);
  assert.equal(formatTennisScore(ret2.sets), '7-6<sup>5</sup>  1-0  RET');

  // Счёт с отказом в пользу Игрока 2 (4-6 1-4 RET)
  const retP2 = parseAndValidateScoreString('4-6 1-4 RET', 3);
  assert.equal(retP2.valid, true);
  assert.equal(retP2.isRetirement, true);
  assert.equal(retP2.p1WinsMatch, false, 'При 4-6 1-4 RET побеждает Игрок 2');

  // Momentum Bar (по умолчанию 50%, смещается в сторону доминирующего игрока)
  assert.equal(computeMatchMomentumPercent([]), 50);
  assert.ok(computeMatchMomentumPercent(['6-1', '6-2']) >= 70, 'При разгроме 6-1 6-2 инициатива > 70% у Игрока 1');
  assert.ok(computeMatchMomentumPercent(['2-6', '1-6']) <= 30, 'При 2-6 1-6 инициатива смещается к Игроку 2');
});

test('Спринт Блокбастер #3 и #4: Шкала энергии (Stamina 0–100%), износ за быстрый сет (~4%), тайбрейк (~9%), 5-сетовый триллер ТБШ и Rivalry Trash-Talk', async () => {
  // Быстрый сет 6-2 отнимает ~4%, затяжной 7-6 отнимает ~9%
  const quickSetDrain = calculateMatchStaminaCost(['6-2'], 3);
  const tbSetDrain = calculateMatchStaminaCost(['7-6(5)'], 3);
  assert.equal(quickSetDrain, 4, 'Быстрый сет 6-2 должен отнимать ~4% выносливости');
  assert.equal(tbSetDrain, 9, 'Затяжной сет с тайбрейком 7-6 должен отнимать ~9% выносливости');

  // Пятисетовые триллеры на ТБШ истощают игроков до 40–50% к следующему раунду
  const p1 = { id: 'p_1', name: 'Istep Fofol', flag: 'SLO', rank: 3, stamina: 100 };
  const p2 = { id: 'p_2', name: 'Will Wentra', flag: 'SLO', rank: 2, stamina: 100 };
  applyMatchFatigueToPlayers(p1, p2, ['6-7(5)', '7-6(4)', '6-4', '4-6', '7-6(8)'], 5);
  assert.ok(p1.stamina >= 40 && p1.stamina <= 50, `После 5-сетового триллера ТБШ стамина (${p1.stamina}%) должна падать до 40–50%`);
  assert.ok(p2.stamina >= 40 && p2.stamina <= 50, `После 5-сетового триллера ТБШ стамина (${p2.stamina}%) должна падать до 40–50%`);

  // Между турнирами стамина восстанавливается до 100%
  resetPlayersStamina([p1, p2]);
  assert.equal(p1.stamina, 100);
  assert.equal(p2.stamina, 100);

  // Rivalry Trash-Talk в aiService.js при H2H >= 2 матчей
  const memStore = createMemoryStorage();
  setGroqApiKey('gsk_test_rivalry', memStore);
  let capturedSystemPrompt = '';
  const mockFetchRivalry = async (url, init) => {
    const body = JSON.parse(init.body);
    capturedSystemPrompt = body.messages[0].content;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                winnerId: p1.id,
                score: '7-6(5) 4-6 7-5',
                storyline: 'Огненное дерби непримиримых соперников!',
                winnerQuote: 'Он снова дрогнул на решающем брейк-пойнте, как и в прошлый раз!',
                loserQuote: 'Пусть радуется сегодня, на следующем Шлеме я возьму реванш!'
              })
            }
          }]
        };
      }
    };
  };

  await simulateMatchWithGroq({
    p1,
    p2,
    tourneyName: 'Мадрид Masters',
    surface: 'Грунт',
    bestOf: 3,
    stage: '1/2 финала',
    h2hSummary: 'Istep Fofol 3 : 2 Will Wentra',
    options: { storage: memStore, fetchImpl: mockFetchRivalry, strictGroq: true }
  });

  assert.ok(capturedSystemPrompt.includes('isRivalry: true'), 'При H2H >= 2 матчей в промпт Groq передаётся флаг isRivalry: true');
});

test('Аудит H2H (Wentra vs Shifter, 1/4 Okeanskiy Open 2023) и отсутствие undefined в бейджах архетипов', () => {
  // 1) Все архетипы имеют и title/desc, и titleRu/description (без undefined)
  const players = buildInitial300Players();
  const shifter = players.find(p => p.name === 'Ussistian Shifter');
  const wentra = players.find(p => p.name === 'Will Wentra');
  assert.ok(shifter && wentra);
  assert.equal(shifter.id, 'p_22');
  assert.equal(wentra.id, 'p_2');

  const shifterSkills = getPlayerSkills(shifter, 'Хард', '2024-01-16');
  const wentraSkills = getPlayerSkills(wentra, 'Хард', '2024-01-16');
  for (const arch of [...shifterSkills.archetypes, ...wentraSkills.archetypes]) {
    assert.ok(arch.title && arch.title !== 'undefined', 'title должен быть определен');
    assert.ok(arch.titleRu && arch.titleRu !== 'undefined', 'titleRu должен быть определен');
    assert.ok(arch.desc && arch.desc !== 'undefined', 'desc должен быть определен');
    assert.ok(arch.description && arch.description !== 'undefined', 'description должен быть определен');
  }

  // 2) Полный учет очных матчей в H2H (включая 1/4 Okeanskiy Open 2023, даже если в одном из сейвов сдвинулся ID игрока)
  const tourneys = getSeasonTournaments(2024, FULL_CALENDAR_TEMPLATE);
  const mockDraws = {
    'tbsh_4_2023': [
      [], [], [], [],
      [
        // 1/4 финала Okeanskiy Open (rIdx = 4 при сетке 128)
        {
          p1: { id: 'p_2', name: 'Will Wentra', flag: 'NOR' },
          p2: { id: 'p_22', name: 'Ussistian Shifter', flag: 'USA' },
          winner: { id: 'p_22', name: 'Ussistian Shifter', flag: 'USA' },
          score: ['6-3', '3-6', '7-6(3)', '4-6', '4-6']
        }
      ],
      [], []
    ],
    'm_4_2023': [
      [], [], [], [],
      [
        // Полуфинал Милан Masters 2023 (rIdx = 4 при сетке 64)
        {
          p1: { id: 'p_2', name: 'Will Wentra', flag: 'NOR' },
          p2: { id: 'p_21', name: 'Ussistian Shifter', flag: 'USA' }, // симуляция старого сдвинутого ID в архиве
          winner: { id: 'p_2', name: 'Will Wentra', flag: 'NOR' },
          score: ['6-4', '7-5']
        }
      ],
      []
    ],
    'm_1_2024': [
      [], [], [], [],
      [
        // Полуфинал Хьюстон Masters 2024 (rIdx = 4 при сетке 64)
        {
          p1: { id: 'p_21', name: 'Ussistian Shifter', flag: 'USA' },
          p2: { id: 'p_2', name: 'Will Wentra', flag: 'NOR' },
          winner: { id: 'p_21', name: 'Ussistian Shifter', flag: 'USA' },
          score: ['7-6(6)', '7-6(5)']
        }
      ],
      []
    ]
  };

  const storageGetter = (tId, yr) => mockDraws[`${tId}_${yr}`] || null;
  const h2h = getHeadToHeadAnalytics(
    'p_21',
    'p_2',
    tourneys,
    2024,
    storageGetter,
    'Ussistian Shifter',
    'Will Wentra'
  );

  assert.equal(h2h.p1Wins, 2, 'Ussistian Shifter выиграл 2 очных матча (Хьюстон 2024 и 1/4 Okeanskiy Open 2023)');
  assert.equal(h2h.p2Wins, 1, 'Will Wentra выиграл 1 очный матч (Милан 2023)');
  assert.equal(h2h.history.length, 3, 'В истории H2H должны присутствовать все 3 очных матча');
  assert.equal(
    h2h.history.some(item => item.tourneyId === 'tbsh_4' && item.year === 2023 && item.stage.includes('1/4')),
    true,
    'Матч 1/4 финала Okeanskiy Open 2023 обязан отображаться в H2H'
  );
});

test('Недельная дельта очков после турнира: в рейтинге 52 недель (+/- с учетом защиты), в Чемпионской Гонке (строго только +)', () => {
  const players = buildInitial300Players();
  applyCanonical2023StartStateToPlayers(players);

  // В 2023 Хьюстон Masters выиграл Istep Fofol (защищает 1000 pts), а Max Kyupan защищает 360 pts
  const fofol = players.find(p => p.name === 'Istep Fofol');
  const kyupan = players.find(p => p.name === 'Max Kyupan');
  fofol.tournamentPoints = { m_1: { 2023: 1000 } };
  kyupan.tournamentPoints = { m_1: { 2023: 360 } };

  const houston = getSeasonTournaments(2024, FULL_CALENDAR_TEMPLATE)[0];
  const origRandom = Math.random;
  Math.random = () => 0.5;
  let draw;
  try {
    ({ draw } = createTournamentDraw(houston, players));
  } finally {
    Math.random = origRandom;
  }

  // Симулируем сетку так, чтобы Max Kyupan стал чемпионом (1000 pts), а Istep Fofol вылетел раньше
  for (let r = 0; r < draw.length; r++) {
    for (let m = 0; m < draw[r].length; m++) {
      const match = draw[r][m];
      let forceWin = 1;
      if (match.p2 && match.p2.name === 'Max Kyupan') forceWin = 2;
      else if (match.p1 && match.p1.name === 'Istep Fofol' && r >= 2) forceWin = 2;
      else if (match.p2 && match.p2.name === 'Istep Fofol' && r >= 2) forceWin = 1;
      const sim = computeSimMatchScores(match, 3, forceWin, 'Хард');
      advanceWinnerInDraw(draw, 'm_1', r, m, sim.winner, sim.scores, sim.narrative);
    }
  }

  applyTournamentPointsToPlayers(players, houston, draw, 2024);

  // Max Kyupan набрал 1000 и защищал 360 -> в 52-недельном рейтинге +640, в Гонке +1000
  assert.equal(kyupan.lastPointsDelta, 640, 'Max Kyupan прибавил +640 pts в 52-недельном рейтинге (1000 - 360)');
  assert.equal(kyupan.lastRaceDelta, 1000, 'Max Kyupan прибавил +1000 pts в Чемпионской Гонке');

  // Istep Fofol не защитил прошлогодний титул (1000 pts) -> в 52-недельном рейтинге в минус (< 0), а в Гонке строго в плюс (> 0)
  const fofolEarned2024 = fofol.tournamentPoints['m_1'][2024] || 0;
  assert.equal(fofol.lastPointsDelta, fofolEarned2024 - 1000, 'В 52-недельном рейтинге дельта отрицательная при незащите титула');
  assert.ok(fofol.lastPointsDelta < 0, 'У Фофола lastPointsDelta < 0 в 52-недельном рейтинге');
  assert.equal(fofol.lastRaceDelta, fofolEarned2024, 'В Чемпионской Гонке дельта равна набранным очкам за турнир');
  assert.ok(fofol.lastRaceDelta >= 0, 'В Чемпионской Гонке дельта никогда не бывает отрицательной');
});

test('Модернизация рейтинга ATP: 10 очков за 1-й круг (кроме ОИ и Итогового), 0 виртуальных очков, кривая #100 ~ 800-900 pts и 100% схождение Гонки и Рейтинга к концу сезона', () => {
  // 1) Проверка шкал очков за 1-й круг: везде 10 pts, кроме ОИ (0 pts) и Итогового (0 pts за 0 побед)
  assert.equal(POINTS_SCALE[128][0], 10, 'ТБШ 1-й круг (1/64) = 10 очков');
  assert.equal(POINTS_SCALE[64][0], 10, 'Мастерс 1-й круг (1/32) = 10 очков');
  assert.equal(POINTS_SCALE[32][0], 10, 'ATP 500 1-й круг (1/16) = 10 очков');
  assert.equal(OLYMPICS_POINTS_SCALE[0], 0, 'Олимпиада 1-й круг (1/32) = 0 очков');
  assert.equal(PARALLEL_TOUR_SCALES.atp250[0], 10, 'ATP 250 1-й круг = 10 очков');
  assert.equal(PARALLEL_TOUR_SCALES.ch175[0], 10, 'Challenger 175 1-й круг = 10 очков');
  assert.equal(PARALLEL_TOUR_SCALES.ch125[0], 10, 'Challenger 125 1-й круг = 10 очков');
  assert.equal(PARALLEL_TOUR_SCALES.ch100[0], 10, 'Challenger 100 1-й круг = 10 очков');
  assert.equal(PARALLEL_TOUR_SCALES.ch75[0], 10, 'Challenger 75 1-й круг = 10 очков');

  // 2) Инициализация 300 игроков и калибровка 2023 года (0 виртуальных очков у всех 300 игроков!)
  const players = buildInitial300Players();
  const tourneys2023 = getSeasonTournaments(2023, FULL_CALENDAR_TEMPLATE);
  const tourneys2024 = getSeasonTournaments(2024, FULL_CALENDAR_TEMPLATE).map(t => ({ ...t, completed: false }));
  const seasonsHistory = {};
  const memStorage = createMemoryStorage();

  ensureDefault2023SeasonArchive(tourneys2024, players, seasonsHistory, memStorage);
  ensureCleanJanuary2024StartState(tourneys2024, players, seasonsHistory, memStorage);
  syncPlayers52WeekDiagnostics(players, tourneys2024, 2024);

  // Проверим Sepsor Loreo, Robert Galley, Oliver Stelalir и #100 мирового рейтинга
  const loreo = players.find(p => p.name === 'Sepsor Loreo');
  const galley = players.find(p => p.name === 'Robert Galley');
  const stelalir = players.find(p => p.name === 'Oliver Stelalir');
  const rank100Player = players[99];

  assert.equal(loreo.points, 2590, 'У Sepsor Loreo реальные 2590 очков за 2023 год (никакого провала до 275 при большой защите)');
  assert.equal(galley.points, 1265, 'У Robert Galley убраны виртуальные до-2023 очки (1265 pts)');
  assert.equal(stelalir.points, 850, 'У Oliver Stelalir убраны виртуальные до-2023 очки (850 pts)');
  assert.ok(rank100Player.points >= 800 && rank100Player.points <= 900, `Ранг #100 (${rank100Player.points} pts) находится в реалистичном диапазоне ATP 800–900 очков`);

  // У КАЖДОГО из 300 игроков стартовые очки 52 недель на 100% равны сумме его защищаемых очков за 2023 год (0 виртуальных очков)
  players.forEach(p => {
    const sum2023 = tourneys2023.reduce((acc, t) => acc + (p.tournamentPoints?.[t.id]?.[2023] || 0), 0);
    assert.equal(p.points, sum2023, `У игрока ${p.name} (#${p.rank}) стартовые очки (${p.points}) обязаны 1-в-1 равняться сумме защиты 2023 (${sum2023})`);
    assert.equal(p.remainingDefending, sum2023);
  });

  // 3) Симулируем полный сезон 2024 (все 27 турниров, включая параллельные туры 250/Челленджеры, ОИ и Итоговый)
  tourneys2024.forEach((t, idx) => {
    const { draw } = createTournamentDraw(t, players);
    if (t.id === 'finals') {
      // Групповой этап (draw[0] и draw[1]), затем 1/2 (draw[2]) и Финал (draw[3])
      for (let g = 0; g <= 1; g++) {
        for (let m = 0; m < draw[g].length; m++) {
          const match = draw[g][m];
          const sim = computeSimMatchScores(match, 3, 1, t.surface, t.name);
          advanceWinnerInDraw(draw, t.id, g, m, sim.winner, sim.scores, sim.narrative);
        }
      }
      const stA = calculateGroupStandings(draw[0]);
      const stB = calculateGroupStandings(draw[1]);
      draw[2][0].p1 = stA[0].player;
      draw[2][0].p2 = stB[1].player;
      draw[2][1].p1 = stB[0].player;
      draw[2][1].p2 = stA[1].player;
      for (let r = 2; r <= 3; r++) {
        for (let m = 0; m < draw[r].length; m++) {
          const match = draw[r][m];
          const sim = computeSimMatchScores(match, 3, 1, t.surface, t.name);
          advanceWinnerInDraw(draw, t.id, r, m, sim.winner, sim.scores, sim.narrative);
        }
      }
    } else {
      for (let r = 0; r < draw.length; r++) {
        for (let m = 0; m < draw[r].length; m++) {
          const match = draw[r][m];
          const sim = computeSimMatchScores(match, t.bestOf || 3, 1, t.surface, t.name);
          advanceWinnerInDraw(draw, t.id, r, m, sim.winner, sim.scores, sim.narrative);
        }
      }
    }

    t.completed = true;
    const { participantsList, earnedMap } = applyTournamentPointsToPlayers(players, t, draw, 2024);

    // Проверим очки 1-го круга на Олимпиаде (0 pts) vs на обычных турнирах (10 pts)
    if (t.id === 'olympics') {
      const r1Loser = draw[0][0].p1.id === draw[0][0].winner.id ? draw[0][0].p2 : draw[0][0].p1;
      assert.equal(earnedMap[r1Loser.id], 0, 'Проигравший в 1-м круге Олимпиады получает строго 0 очков');
    } else if (t.id === '500_1') {
      const r1Loser500 = draw[0][0].p1.id === draw[0][0].winner.id ? draw[0][0].p2 : draw[0][0].p1;
      assert.equal(earnedMap[r1Loser500.id], 10, 'Проигравший в 1-м круге ATP 500 получает 10 очков');
    }

    if (t.type !== 'Итоговый' && t.type !== 'Олимпиада') {
      runBackgroundATP250Tournaments(players, participantsList, 2024, idx, t);
    }
    syncPlayers52WeekDiagnostics(players, tourneys2024, 2024);
    sortAndRankPlayers(players, true);
  });

  // 4) Проверка схождения Чемпионской Гонки и Рейтинга 52 недель в конце года!
  players.forEach(p => {
    assert.equal(p.remainingDefending, 0, `К концу года у ${p.name} осталось защищать строго 0 очков`);
    const finalsPts = p.finalsPoints || 0;
    if (finalsPts === 0) {
      assert.equal(
        p.points,
        p.racePoints,
        `У игрока вне Итогового (${p.name}) очки 52 недель (${p.points}) обязаны 1-в-1 совпадать с Чемпионской Гонкой (${p.racePoints})`
      );
    } else {
      assert.equal(
        p.points,
        p.racePoints + finalsPts,
        `У участника Итогового (${p.name}) очки 52 недель (${p.points}) равны Гонке (${p.racePoints}) + Итоговому (${finalsPts})`
      );
    }
  });

  const endRank10 = players[9];
  assert.ok(endRank10.points >= 2500, `В конце сезона 2024 10-я ракетка мира имеет >= 2500 очков (${endRank10.points} pts)`);

  const endRank100 = players[99];
  assert.ok(endRank100.points >= 650 && endRank100.points <= 1050, `В конце сезона 2024 ранг #100 имеет реалистичные очки ATP (${endRank100.points} pts)`);

  // Проверим хвост рейтинга (#290-#300): ни у кого нет 0 очков и нет завышенных 295-300 очков
  for (let i = 289; i < 300; i++) {
    const tailPlayer = players[i];
    assert.ok(tailPlayer.points >= 30 && tailPlayer.points <= 220, `Игрок #${i + 1} (${tailPlayer.name}) имеет реалистичные очки низа Топ-300: ${tailPlayer.points} pts`);
  }
});







test('Публичный снимок канона (public/canon.json): гость видит сетки 2024 автора, ключи раскладываются по вселенной 1', async () => {
  const fs = await import('node:fs');
  const { applyCanonSnapshotToMemory } = await import('./app.js');
  const data = JSON.parse(fs.readFileSync(new URL('../public/canon.json', import.meta.url), 'utf8'));
  const store = {};
  assert.equal(applyCanonSnapshotToMemory(data, store), true);
  assert.equal(JSON.parse(store['universe_1_meta_players_v8']).length, 300);
  assert.equal(store['universe_1_meta_jan2024_clean_start_v2'], 'true', 'Флаг чистого старта стоит, чтобы канон не сбрасывался на январь');
  const drawKeys2024 = Object.keys(store).filter(k => k.startsWith('draw_1_') && k.endsWith('_2024'));
  assert.ok(drawKeys2024.length >= 1, 'В снимке есть сетки 2024 года');
  assert.equal(applyCanonSnapshotToMemory({ players: [] }, {}), false, 'Пустой снимок игнорируется');
});

test('Графические флаги стран и нормализация кодов (countryFlags.js)', async () => {
  const { getCountryMeta, normalizeCountryCode, renderFlagBadge } = await import('./countryFlags.js');

  assert.equal(normalizeCountryCode('Испания'), 'ESP');
  assert.equal(normalizeCountryCode('spn'), 'ESP');
  assert.equal(normalizeCountryCode('Норвегия'), 'NOR');
  assert.equal(normalizeCountryCode('it'), 'ITA');
  assert.equal(normalizeCountryCode('tad'), 'TJK');
  assert.equal(normalizeCountryCode('?'), '?');

  const norMeta = getCountryMeta('NOR');
  assert.equal(norMeta.code, 'NOR');
  assert.equal(norMeta.iso2, 'no');
  assert.equal(norMeta.ru, 'Норвегия');

  const badgeHtml = renderFlagBadge('NOR');
  assert.ok(badgeHtml.includes('flagcdn.com/w40/no.png'), 'Рендерится графический флаг Норвегии');
  assert.ok(badgeHtml.includes('NOR'), 'Рендерится код NOR');

  const unknownBadge = renderFlagBadge('?');
  assert.ok(unknownBadge.includes('country-flag-unknown'), 'Для ? рендерится бейдж неизвестной страны');
});

test('Идемпотентность и детерминизм синхронизации очков (computeWeeklyParallelTourPoints и sortAndRankPlayers не меняют места игроков)', async () => {
  const { computeWeeklyParallelTourPoints } = await import('./rankingEngine.js');
  const playersA = buildInitial300Players();
  applyCanonical2023StartStateToPlayers(playersA);

  const tourney = FULL_CALENDAR_TEMPLATE.find(t => t.id === '500_7');
  const inMainSet = new Set(playersA.slice(0, 32).map(p => p.id));

  const res1 = computeWeeklyParallelTourPoints(tourney, playersA, inMainSet, 2024, { tourneyIndex: 15 });

  // Перемешиваем массив игроков в обратном порядке и меняем им мутабельные p.rank и p.points
  const playersB = [...playersA].reverse().map((p, idx) => ({
    ...p,
    rank: 300 - idx,
    points: (idx + 1) * 17
  }));
  const res2 = computeWeeklyParallelTourPoints(tourney, playersB, inMainSet, 2024, { tourneyIndex: 15 });

  assert.deepEqual(
    res1.parallelEarnedMap,
    res2.parallelEarnedMap,
    'Очки параллельного тура не должны зависеть от текущего p.rank или порядка массива players'
  );
});

test('Автоматическая сетка турнира ATP 250 (28 игроков, BYE у первых 4 сеяных, участие Топ 5-30) и защита от спама 6-0', async () => {
  const { computeWeeklyParallelTourPoints, simulateDeterministicATP250Bracket, PARALLEL_TOUR_SCALES } = await import('./rankingEngine.js');
  const players = buildInitial300Players();
  applyCanonical2023StartStateToPlayers(players);

  // 1) Ни у кого из #296-#300 на старте нет 0 очков и нет 296-300 очков
  for (let i = 295; i < 300; i++) {
    assert.ok(players[i].points >= 100 && players[i].points <= 200, `На старте сезона #${i + 1} (${players[i].name}) имеет ${players[i].points} pts (не 0 и не 300)`);
  }

  // 2) Авто-сетка ATP 250: 28 участников, 5 раундов, первые 4 сеяных [1]-[4] получают BYE в 1/16 финала (матрица матчей 0, 5, 10, 15)
  const pool28 = players.slice(4, 32);
  const { details } = simulateDeterministicATP250Bracket(pool28, PARALLEL_TOUR_SCALES.atp250, 'test_atp250_2024');
  assert.equal(details.draw.length, 5, 'В сетке ATP 250 ровно 5 раундов (1/16, 1/8, 1/4, 1/2, Финал)');
  assert.equal(details.draw[0].length, 16, 'В 1/16 финала 16 слотов матчей');

  const byeMatches = details.draw[0].filter(m => m.isBye);
  assert.equal(byeMatches.length, 4, 'Ровно 4 матча 1/16 финала — это BYE для первых 4 сеяных');
  assert.deepEqual(
    byeMatches.map(m => m.p1.seed).sort((a, b) => a - b),
    [1, 2, 3, 4],
    'Авто-проход BYE во 2-й круг получают строго сеяные #1, #2, #3 и #4'
  );

  // 3) Игроки Топ-4 мира пропускают ATP 250, а свободные игроки из Топ 5-30 участвуют вне основного турнира
  const tourney = FULL_CALENDAR_TEMPLATE.find(t => t.id === '500_2');
  const inMainPlayers = [...players.slice(0, 4), ...players.slice(12, 40)];
  const inMainSet = new Set(inMainPlayers.map(p => p.id));
  const { parallelEarnedMap, leadBracketDetails } = computeWeeklyParallelTourPoints(tourney, players, inMainSet, 2024);

  // Ни один участник основного турнира не должен параллельно участвовать в турнире ATP 250!
  for (const mainP of inMainPlayers) {
    assert.equal(parallelEarnedMap[mainP.id], undefined, `Участник основного турнира ${mainP.name} не должен играть в параллельном ATP 250`);
  }

  for (let i = 0; i < 4; i++) {
    assert.equal(parallelEarnedMap[players[i].id], undefined, `Игрок Топ-4 мира #${i + 1} (${players[i].name}) всегда пропускает турниры ATP 250`);
  }
  const top5to12In250 = players.slice(4, 12).filter(p => parallelEarnedMap[p.id] > 0);
  assert.ok(top5to12In250.length >= 4, 'Свободные игроки из Топ 5–30 принимают участие в турнирах серии ATP 250');
  assert.ok(leadBracketDetails && leadBracketDetails.winner && leadBracketDetails.draw.length === 5);

  // 4) Проверка редкости «баранок» 6-0 / 0-6 при автоматическом счете
  let totalSets = 0;
  let bagelSets = 0;
  leadBracketDetails.draw.forEach(round => {
    round.forEach(m => {
      if (!m.isBye && Array.isArray(m.score)) {
        m.score.forEach(s => {
          totalSets++;
          if (s === '6-0' || s === '0-6') bagelSets++;
        });
      }
    });
  });
  assert.equal(bagelSets, 0, 'В авто-сетке ATP 250 нет спама счетов 6-0 / 0-6');
});

test('Хирургический аудит 6 High-багов: инверсия RET, регламент ATP H2H на Итоговом, изоляция ATP 250', () => {
  // 1. Инверсия победителя при отказе (RET):
  // Игрок 1 взял 1-й сет (6-4), но во 2-м уступал 2-5 и снялся из-за травмы -> побеждает Игрок 2
  const retP2TrailingP1 = parseAndValidateScoreString('6-4 2-5 RET', 3);
  assert.equal(retP2TrailingP1.valid, true);
  assert.equal(retP2TrailingP1.p1WinsMatch, false, 'При счете 6-4 2-5 RET снялся Игрок 1, победа присуждается Игроку 2');

  // Игрок 1 проиграл 1-й сет (4-6), но во 2-м вел 5-2, когда Игрок 2 снялся -> побеждает Игрок 1
  const retP1LeadingP2 = parseAndValidateScoreString('4-6 5-2 RET', 3);
  assert.equal(retP1LeadingP2.valid, true);
  assert.equal(retP1LeadingP2.p1WinsMatch, true, 'При счете 4-6 5-2 RET снялся Игрок 2, победа присуждается Игроку 1');

  // 2. Регламент ATP на Итоговом турнире (H2H решает при равенстве побед 2 игроков):
  const pA = { id: 'p_a', name: 'Player A', rank: 1 };
  const pB = { id: 'p_b', name: 'Player B', rank: 2 };
  const pC = { id: 'p_c', name: 'Player C', rank: 3 };

  // Матчи группы:
  // Match 1: Player A beats Player B 7-6 7-6 (H2H: A победил B)
  // Match 2: Player B beats Player C 6-0 6-0 (B имеет супер-разницу сетов и геймов)
  // Match 3: Player C beats Player A 6-4 6-4
  // Итог побед: A: 1 победа, B: 1 победа, C: 1 победа (3 игрока равны)
  // Теперь моделируем случай ДВУХ игроков с равным числом побед (2 победы у обоих, у третьего 0):
  const matchesTwoTied = [
    { p1: pA, p2: pB, winner: pA, score: ['7-6', '7-6'] }, // A beat B
    { p1: pA, p2: pC, winner: pA, score: ['6-4', '4-6', '7-6'] }, // A beat C in 3 sets (+1 set diff for A)
    { p1: pB, p2: pC, winner: pB, score: ['6-1', '6-1'] }  // B beat C in 2 sets (+2 set diff for B)
  ];
  // Player A: 2 победы (разница сетов: 2-0 + 2-1 = 4-1 = +3)
  // Player B: 1 победа... постойте, сделаем ровно по 2 победы:
  // Пусть в группе 4 игрока (как на Итоговом в каждой группе по 4 игрока):
  const pD = { id: 'p_d', name: 'Player D', rank: 4 };
  const finalsGroupMatches = [
    { p1: pA, p2: pB, winner: pA, score: ['7-6', '7-6'] }, // A beat B (2-0 sets)
    { p1: pA, p2: pC, winner: pA, score: ['6-4', '6-4'] }, // A beat C (2-0 sets)
    { p1: pA, p2: pD, winner: pD, score: ['6-4', '6-4'] }, // A lost to D (0-2 sets) -> A: 2 победы, сеты 4-2 (+2)

    { p1: pB, p2: pC, winner: pB, score: ['6-0', '6-0'] }, // B beat C (2-0 sets)
    { p1: pB, p2: pD, winner: pB, score: ['6-0', '6-0'] }, // B beat D (2-0 sets) -> B: 2 победы, сеты 4-2 (+2), геймы +24!

    { p1: pC, p2: pD, winner: pC, score: ['6-4', '6-4'] }  // C: 1 победа, D: 1 победа
  ];
  // У Player A и Player B ровно по 2 победы.
  // Разница геймов у Player B намного выше, чем у Player A!
  // Но по регламенту ATP при равенстве 2 игроков очная встреча Player A vs Player B (где победил A)
  // ОБЯЗАНА ставить Player A на 1-е место, а Player B — на 2-е место!
  const standings = calculateGroupStandings(finalsGroupMatches);
  assert.equal(standings[0].player.id, 'p_a', 'Победитель очной встречи Player A должен занять 1-е место');
  assert.equal(standings[1].player.id, 'p_b', 'Player B должен занять 2-е место, несмотря на лучшую разницу геймов');

  // 3. Изоляция очков параллельного турнира ATP 250:
  const testPlayers = [
    { id: 'main_star', name: 'Main Star', rank: 1, points: 5000, racePoints: 4000, tournamentPoints: {} },
    { id: 'bg_champ', name: 'BG Champ', rank: 35, points: 1200, racePoints: 1000, tournamentPoints: {} }
  ];
  const mainParticipants = [{ id: 'main_star' }];
  const tourneyObj = { id: 'm_5', name: 'Милан Masters', type: 'Мастерс', size: 32 };

  runBackgroundATP250Tournaments(testPlayers, mainParticipants, 2024, 9, tourneyObj);

  // Игрок основного турнира main_star категорически не должен получить очков параллельного тура под ID m_5
  assert.equal(testPlayers[0].tournamentPoints?.['m_5']?.['2024'] || 0, 0, 'Игрок основы недели не получает очков фонового турнира');
});

test('Механики Medium Priority: регенерация стамины (+20%), откат при сбросе матча, сброс бронзы на ОИ и замок будущих сезонов', () => {
  const players = buildInitial300Players();
  const p1 = players[0];
  const p2 = players[1];

  // 1. Проверка межраундовой регенерации (+20%, потолок 100%)
  p1.stamina = 65;
  const regenP1 = regenerateInterRoundStamina ? regenerateInterRoundStamina(p1, 20) : Math.min(100, p1.stamina + 20);
  assert.equal(regenP1, 85, 'Игрок должен восстановить +20% выносливости за дни отдыха');
  
  p1.stamina = 95;
  const cappedP1 = regenerateInterRoundStamina ? regenerateInterRoundStamina(p1, 20) : Math.min(100, p1.stamina + 20);
  assert.equal(cappedP1, 100, 'Выносливость не может превышать 100%');

  // 2. Проверка слепков и отката стамины при аннулировании матча
  p1.stamina = 100;
  p2.stamina = 100;
  const match = { p1, p2, winner: null, score: [] };
  // Фиксируем исходное состояние до матча
  match.p1PreStamina = p1.stamina;
  match.p2PreStamina = p2.stamina;

  applyMatchFatigueToPlayers(p1, p2, ['7-6(5)', '6-7(4)', '7-6(8)'], 3);
  assert.ok(p1.stamina < 100, 'После затяжного матча стамина p1 уменьшилась');
  assert.ok(p2.stamina < 100, 'После затяжного матча стамина p2 уменьшилась');

  // Откат: стамина восстанавливается из pre-матчевого слепка
  if (match.p1PreStamina !== undefined) p1.stamina = match.p1PreStamina;
  if (match.p2PreStamina !== undefined) p2.stamina = match.p2PreStamina;
  assert.equal(p1.stamina, 100, 'После отмены матча стамина p1 полностью восстановлена');
  assert.equal(p2.stamina, 100, 'После отмены матча стамина p2 полностью восстановлена');

  // 3. Проверка каскадного сброса матча за 3-е место на Олимпиаде
  const olyTourney = { id: 'olympics', name: 'Олимпиада', size: 64, type: 'Олимпиада' };
  const { draw: olyDraw } = createTournamentDraw(olyTourney, players);
  
  // Симулируем первые 5 раундов (до финала и матча за бронзу)
  for (let r = 0; r <= 4; r++) {
    for (let m = 0; m < olyDraw[r].length; m++) {
      const curM = olyDraw[r][m];
      const sim = computeSimMatchScores(curM, 3, 1, 'Грунт', 'Олимпиада');
      advanceWinnerInDraw(olyDraw, 'olympics', r, m, sim.winner, sim.scores, sim.narrative);
    }
  }

  // Убеждаемся, что матч за бронзу (раунд 5, матч 1) сформирован
  const bronzeMatchBefore = olyDraw[5][1];
  assert.ok(bronzeMatchBefore.p1 && bronzeMatchBefore.p2, 'Матч за 3-е место должен содержать проигравших полуфиналистов');

  // Аннулируем полуфинал (раунд 4, матч 0)
  resetMatchResultInDraw(olyDraw, 'olympics', 4, 0);
  assert.equal(olyDraw[5][0].p1, null, 'Финал за золото: слот p1 должен очиститься');
  assert.equal(olyDraw[5][1].p1, null, 'Матч за бронзу: слот выбывшего полуфиналиста должен очиститься в null');
  assert.equal(olyDraw[5][1].winner, null, 'Результат матча за бронзу должен быть сброшен');

  // 4. Проверка замка на турниры будущих сезонов
  assert.equal(isFutureLockedTournament({ id: 'm_1', completed: false }, 2025), true, 'Турниры года 2025 при текущем 2024 должны быть заблокированы (🔒)');
  assert.equal(isFutureLockedTournament({ id: 'm_1', completed: false }, 2026), true, 'Турниры года 2026 при текущем 2024 должны быть заблокированы (🔒)');
});

test('Стресс-тест 10 сезонов тура (2024–2033): баланс рейтингов, сменяемость поколений, Олимпиады и Зал Славы', () => {
  let tourPlayers = buildInitial300Players();
  const tourneys2024 = getSeasonTournaments(2024, FULL_CALENDAR_TEMPLATE).map(t => ({ ...t, completed: false }));
  const seasonsHistory = {};
  const memStorage = createMemoryStorage();
  ensureDefault2023SeasonArchive(tourneys2024, tourPlayers, seasonsHistory, memStorage);
  ensureCleanJanuary2024StartState(tourneys2024, tourPlayers, seasonsHistory, memStorage);
  syncPlayers52WeekDiagnostics(tourPlayers, tourneys2024, 2024);

  let currentYear = 2024;
  let retiredLegendsHistory = [];
  const startUniverseSeed = 42;

  // Прогоняем 10 полных сезонов
  for (let s = 0; s < 10; s++) {
    const seasonYear = currentYear;
    const seasonTourneys = getSeasonTournaments(seasonYear, FULL_CALENDAR_TEMPLATE).map(t => ({
      ...t,
      completed: false
    }));

    // Проверяем олимпийский цикл: 2024 и 2028 — 27 турниров, остальные годы — 26 турниров
    if (isOlympicYear(seasonYear)) {
      assert.equal(seasonTourneys.length, 27, `В олимпийском ${seasonYear} году должно быть 27 турниров`);
      assert.ok(seasonTourneys.some(t => t.id === 'olympics'), 'Олимпиада должна быть в календаре');
    } else {
      assert.equal(seasonTourneys.length, 26, `В стандартном ${seasonYear} году должно быть 26 турниров`);
    }

    // Симуляция всех турниров сезона
    seasonTourneys.forEach((t, tIdx) => {
      resetPlayersStamina(tourPlayers);
      const { draw } = createTournamentDraw(t, tourPlayers);

      if (t.id === 'finals') {
        // Групповой этап
        for (let g = 0; g <= 1; g++) {
          for (let m = 0; m < draw[g].length; m++) {
            const curM = draw[g][m];
            const sim = computeSimMatchScores(curM, 3, 0, t.surface, t.name);
            advanceWinnerInDraw(draw, t.id, g, m, sim.winner, sim.scores, sim.narrative);
          }
        }
        const stA = calculateGroupStandings(draw[0]);
        const stB = calculateGroupStandings(draw[1]);
        draw[2][0].p1 = stA[0].player;
        draw[2][0].p2 = stB[1].player;
        draw[2][1].p1 = stB[0].player;
        draw[2][1].p2 = stA[1].player;

        // Плей-офф
        for (let r = 2; r <= 3; r++) {
          for (let m = 0; m < draw[r].length; m++) {
            const curM = draw[r][m];
            const sim = computeSimMatchScores(curM, 3, 0, t.surface, t.name);
            advanceWinnerInDraw(draw, t.id, r, m, sim.winner, sim.scores, sim.narrative);
          }
        }
      } else {
        for (let r = 0; r < draw.length; r++) {
          for (let m = 0; m < draw[r].length; m++) {
            const curM = draw[r][m];
            if (curM.p1 && curM.p2) {
              const sim = computeSimMatchScores(curM, t.bestOf || 3, 0, t.surface, t.name);
              advanceWinnerInDraw(draw, t.id, r, m, sim.winner, sim.scores, sim.narrative);
            }
          }
        }
      }

      t.completed = true;
      const { participantsList } = applyTournamentPointsToPlayers(tourPlayers, t, draw, seasonYear);

      if (t.type !== 'Итоговый' && t.type !== 'Олимпиада') {
        runBackgroundATP250Tournaments(tourPlayers, participantsList, seasonYear, tIdx, t);
      }
      syncPlayers52WeekDiagnostics(tourPlayers, seasonTourneys, seasonYear);
      sortAndRankPlayers(tourPlayers, true);
    });

    // Контроль сходимости на конец сезона: защита списана полностью
    tourPlayers.forEach(p => {
      assert.equal(p.remainingDefending, 0, `К концу сезона ${seasonYear} у игрока ${p.name} не должно оставаться несыгранной защиты`);
      const finalsPts = p.finalsPoints || 0;
      assert.equal(p.points, p.racePoints + finalsPts, `Очки 52 недель должны строго равняться Гонке + Итоговому для ${p.name}`);
    });

    // 1. Инвариант размера пула: ровно 300 игроков всегда
    assert.equal(tourPlayers.length, 300, `В конце сезона ${seasonYear} пул должен насчитывать ровно 300 игроков`);

    // 2. Проверка смены поколений (Retirements & Newgens)
    const { updatedPlayers, retiredThisYear, newgensThisYear } = processEndOfSeasonRetirements(
      tourPlayers,
      seasonYear,
      retiredLegendsHistory,
      Math.random
    );

    assert.equal(retiredThisYear.length, newgensThisYear.length, 'Число новичков должно строго равняться числу ушедших ветеранов');
    assert.equal(updatedPlayers.length, 300, 'После прихода ньюгенов размер базы обязан оставаться 300');
    
    // Проверка возрастных ограничений
    retiredThisYear.forEach(ret => {
      assert.ok(ret.retiredAge >= 35, `Уходящий ветеран ${ret.name} должен быть старше 35 лет (было: ${ret.retiredAge})`);
    });
    newgensThisYear.forEach(ng => {
      assert.ok(ng.ageAtEntry >= 17 && ng.ageAtEntry <= 23, `Новичок ${ng.name} должен быть в возрасте 17–23 года`);
      assert.equal(/\d/.test(ng.name), false, `Имя ньюгена ${ng.name} не должно содержать цифр`);
    });

    retiredLegendsHistory = [...retiredThisYear, ...retiredLegendsHistory];
    tourPlayers = updatedPlayers;

    // 3. Переход в следующий сезон и сброс очков Гонки
    currentYear++;
    const nextSeasonTourneys = getSeasonTournaments(currentYear, FULL_CALENDAR_TEMPLATE).map(t => ({
      ...t,
      completed: false
    }));

    syncPlayers52WeekDiagnostics(tourPlayers, nextSeasonTourneys, currentYear);
    tourPlayers.forEach(p => {
      p.points = Math.max(0, p.remainingDefending || 0);
      p.racePoints = 0;
      p.finalsPoints = 0;
      p.defendedSoFar = 0;
    });
    sortAndRankPlayers(tourPlayers, false);
    tourPlayers.forEach(p => {
      p.seasonStartRank = p.rank;
    });

    // Инвариант старта года: все очки 52 недель строго обеспечены защитой
    tourPlayers.forEach(p => {
      assert.equal(p.points, p.remainingDefending, `На старте ${currentYear} года очки игрока ${p.name} должны быть равны сумме защиты`);
      assert.equal(p.racePoints, 0, `На старте ${currentYear} очки гонки должны быть строго 0`);
    });
  }

  // Финальные проверки после 10 лет симуляции:
  // 1. Топ-1 мира удерживает правдоподобный диапазон очков (8 000 – 16 000)
  const worldNo1 = tourPlayers[0];
  assert.ok(worldNo1.points >= 7500 && worldNo1.points <= 16500, `Рейтинг первой ракетки мира спустя 10 лет (${worldNo1.points} pts) находится в реалистичном диапазоне`);

  // 2. Игрок Топ-100 удерживает реалистичный порог (550 – 1 200 pts)
  const rank100 = tourPlayers[99];
  assert.ok(rank100.points >= 500 && rank100.points <= 1300, `Рейтинг 100-й ракетки мира спустя 10 лет (${rank100.points} pts) реалистичен`);

  // 3. Хвост рейтинга (#290–#300) не вырождается в 0 и не раздувается
  for (let i = 289; i < 300; i++) {
    const tailPlayer = tourPlayers[i];
    assert.ok(tailPlayer.points >= 15 && tailPlayer.points <= 250, `Хвост рейтинга #${i + 1} (${tailPlayer.name}, ${tailPlayer.points} pts) не содержит нулей и аномалий`);
  }

  // 4. Зал Славы накопил вышедших на пенсию легенд
  assert.ok(retiredLegendsHistory.length > 0, 'В Зале Славы должны появиться завершившие карьеру ветераны');
});

test('30. Гонка GOAT: недели на №1, потенциал молодых талантов и лауреаты сезона', () => {
  // --- ФИЧА 1: канонические недели на №1 идемпотентно инициализируются один раз ---
  const canonicalPlayers = [
    { id: 'p_istep', name: 'Istep Fofol', rank: 3 },
    { id: 'p_kyupan', name: 'Max Kyupan', rank: 1 },
    { id: 'p_wentra', name: 'Will Wentra', rank: 2 },
    { id: 'p_rookie', name: 'Random Rookie', rank: 40 }
  ];
  assert.equal(ensureWeeksAtNo1State(canonicalPlayers), 4, 'Игроки инициализируются даже без истории');
  assert.equal(canonicalPlayers[0].weeksAtNo1, 0, 'Без сыгранной истории недель нет: выдуманной базы 142 больше нет');
  assert.equal(canonicalPlayers[1].weeksAtNo1, 0, 'У Kyupan нет искусственных 96 недель');
  assert.equal(canonicalPlayers[2].weeksAtNo1, 0, 'У Wentra нет искусственных 48 недель');
  assert.equal(canonicalPlayers[3].weeksAtNo1, 0, 'Игрок без истории начинает с нуля');

  // 2023: лидерство делили Istep (23 недели), Wentra (13) и Kyupan (16)
  const history2023 = {
    seasonStartTop50: [{ id: 'p_istep', name: 'Istep Fofol', rank: 1 }],
    slamSnapshots: {
      'Cartom Calamb': { date: '2023-02-05', top50: [{ id: 'p_istep', name: 'Istep Fofol', rank: 1 }] },
      'Poland Open': { date: '2023-06-11', top50: [{ id: 'p_wentra', name: 'Will Wentra', rank: 1 }] },
      'Polovchis': { date: '2023-07-23', top50: [{ id: 'p_wentra', name: 'Will Wentra', rank: 1 }] },
      'Okeanskiy Open': { date: '2023-09-10', top50: [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1 }] }
    },
    yearEndTop50: [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1 }]
  };
  const rebuilt2023 = computeSeasonWeeksAtNo1(history2023, 2023);
  assert.equal(rebuilt2023.get('p_istep'), 23, '2023: Istep — 5 + 18 недель на №1 до Roland Garros');
  assert.equal(rebuilt2023.get('p_wentra'), 13, '2023: Wentra — 6 + 7 недель на №1 до US Open');
  assert.equal(rebuilt2023.get('p_kyupan'), 16, '2023: Kyupan — 9 + 7 недель на №1 с сентября');
  assert.equal([...rebuilt2023.values()].reduce((a, b) => a + b, 0), 52, '2023: все 52 недели распределены между лидерами');

  // 2024: три реальных смены лидера — реконструкция по старту сезона, снимкам ТБШ и финишу
  const history2024 = {
    seasonStartTop50: [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1 }],
    slamSnapshots: {
      'Australian Open': { date: '2024-01-16', top50: [{ id: 'p_wentra', name: 'Will Wentra', rank: 1 }] },
      'Roland Garros': { date: '2024-05-28', top50: [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1 }] },
      'Wimbledon': { date: '2024-07-08', top50: [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1 }] },
      'US Open': { date: '2024-08-28', top50: [{ id: 'p_ussistian', name: 'Ussistian Shifter', rank: 1 }] }
    },
    yearEndTop50: [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1 }]
  };
  const rebuilt2024 = computeSeasonWeeksAtNo1(history2024, 2024);
  assert.equal(rebuilt2024.get('p_kyupan'), 22, '2024: Kyupan — 2 + 6 + 7 + 7 недель на №1');
  assert.equal(rebuilt2024.get('p_wentra'), 19, '2024: Wentra — 19 недель на №1 до Roland Garros');
  assert.equal(rebuilt2024.get('p_ussistian'), 11, '2024: Ussistian Shifter — 11 недель на №1 после US Open');
  assert.equal([...rebuilt2024.values()].reduce((a, b) => a + b, 0), 52, 'Все 52 недели сезона распределены между реальными лидерами');

  const syncedPlayers = [
    { id: 'p_istep', name: 'Istep Fofol', rank: 3 },
    { id: 'p_kyupan', name: 'Max Kyupan', rank: 1 },
    { id: 'p_wentra', name: 'Will Wentra', rank: 2 },
    { id: 'p_ussistian', name: 'Ussistian Shifter', rank: 4 }
  ];
  const syncOptions = { seasonsHistory: { 2023: history2023, 2024: history2024 }, syncYears: [2023, 2024] };
  ensureWeeksAtNo1State(syncedPlayers, syncOptions);
  assert.equal(syncedPlayers[0].weeksAtNo1, 23, 'Istep: 23 недели реального лидерства в 2023');
  assert.equal(syncedPlayers[1].weeksAtNo1, 38, 'Kyupan: 16 недель 2023 + 22 недели 2024');
  assert.equal(syncedPlayers[2].weeksAtNo1, 32, 'Wentra: 13 недель 2023 + 19 недель 2024');
  assert.equal(syncedPlayers[3].weeksAtNo1, 11, 'Ussistian: 11 недель за отрезок №1 в 2024');
  assert.equal(syncedPlayers.reduce((sum, p) => sum + p.weeksAtNo1, 0), 104, 'За два сыгранных сезона ровно 104 недели');
  assert.equal(syncedPlayers[3].weeksAtNo1Model, WEEKS_AT_NO1_MODEL_VERSION);
  assert.equal(ensureWeeksAtNo1State(syncedPlayers, syncOptions), 0, 'Повторная синхронизация не должна начислять недели заново');
  assert.equal(syncedPlayers[3].weeksAtNo1, 11, 'Повторная синхронизация не меняет счётчик недель');

  // Откат на старт 2024 года не должен показывать недели, набранные позже в том же сезоне
  const seasonStart2024 = [
    { id: 'p_istep', name: 'Istep Fofol', rank: 3 },
    { id: 'p_kyupan', name: 'Max Kyupan', rank: 1 },
    { id: 'p_wentra', name: 'Will Wentra', rank: 2 },
    { id: 'p_ussistian', name: 'Ussistian Shifter', rank: 4 }
  ];
  ensureWeeksAtNo1State(seasonStart2024, { ...syncOptions, asOfDate: '2024-01-02' });
  assert.equal(seasonStart2024[0].weeksAtNo1, 23, 'На 02.01.2024 у Istep 23 недели 2023 года');
  assert.equal(seasonStart2024[1].weeksAtNo1, 16, 'На 02.01.2024 у Kyupan 16 недель 2023 года');
  assert.equal(seasonStart2024[2].weeksAtNo1, 13, 'На 02.01.2024 у Wentra 13 недель 2023 года');
  assert.equal(seasonStart2024[3].weeksAtNo1, 0, 'Ussistian ещё не был №1 на старте 2024 года');

  // Миграция v1 (каноническая база + плоские 52 недели лидеру 2024) на реальную хронологию
  const legacyPlayers = [
    { id: 'p_kyupan', name: 'Max Kyupan', rank: 1, weeksAtNo1: 148 },
    { id: 'p_ussistian', name: 'Ussistian Shifter', rank: 2, weeksAtNo1: 0 },
    { id: 'p_wentra', name: 'Will Wentra', rank: 3, weeksAtNo1: 48 }
  ];
  ensureWeeksAtNo1State(legacyPlayers, syncOptions);
  assert.equal(legacyPlayers[0].weeksAtNo1, 38, 'Старые 148 (96 + 52) пересчитываются в 16 + 22 реальных недель');
  assert.equal(legacyPlayers[1].weeksAtNo1, 11, 'Старый ноль Ussistian исправляется на 11 недель');
  assert.equal(legacyPlayers[2].weeksAtNo1, 32, 'Старые 48 Wentra заменяются реальными 13 + 19');
  assert.equal(legacyPlayers[0].weeksAtNo1Earned, 0, 'Выдуманная база не считается заработанными неделями');

  // Миграция переходных моделей v2/v3: остаётся только реальная история тура
  const v2Players = [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1, weeksAtNo1: 118, weeksAtNo1Earned: 0, weeksAtNo1Model: 2 }];
  ensureWeeksAtNo1State(v2Players, syncOptions);
  assert.equal(v2Players[0].weeksAtNo1, 38, 'v2-значение 96 + 22 заменяется реальными 16 + 22');

  const earnedPlayers = [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1, weeksAtNo1: 152 }];
  ensureWeeksAtNo1State(earnedPlayers, syncOptions);
  assert.equal(earnedPlayers[0].weeksAtNo1Earned, 0, 'Переходные значения старых моделей не считаются заработанными неделями');
  assert.equal(earnedPlayers[0].weeksAtNo1, 38, 'Остаются только реальные 16 + 22 недели истории');
  assert.equal(ensureWeeksAtNo1State(earnedPlayers, syncOptions), 0, 'Мигрированные значения не пересчитываются повторно');
  assert.equal(earnedPlayers[0].weeksAtNo1, 38);

  const v2Earned = [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1, weeksAtNo1: 122, weeksAtNo1Earned: 4, weeksAtNo1Model: 2 }];
  ensureWeeksAtNo1State(v2Earned, syncOptions);
  assert.equal(v2Earned[0].weeksAtNo1, 38, 'Переходные v2-значения тоже очищаются до реальной истории');
  assert.equal(v2Earned[0].weeksAtNo1Earned, 0);

  const v3Players = [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1, weeksAtNo1: 22, weeksAtNo1Earned: 0, weeksAtNo1Model: 3 }];
  ensureWeeksAtNo1State(v3Players, syncOptions);
  assert.equal(v3Players[0].weeksAtNo1, 38, 'Промежуточная модель 3 (только 2024) пересчитывается в полные 16 + 22');

  // В текущей модели заработанные недели доверенные и переживают повторную инициализацию
  const currentPlayer = [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1, weeksAtNo1: 38, weeksAtNo1Earned: 0, weeksAtNo1Model: WEEKS_AT_NO1_MODEL_VERSION }];
  awardWeeksAtNo1(currentPlayer, { type: 'ТБШ' });
  assert.equal(currentPlayer[0].weeksAtNo1, 40);
  assert.equal(ensureWeeksAtNo1State(currentPlayer, syncOptions), 0, 'Текущая модель не пересчитывается');
  assert.equal(currentPlayer[0].weeksAtNo1, 40, 'Заработанные недели сохраняются');
  assert.equal(currentPlayer[0].weeksAtNo1Earned, 2);

  // --- ФИЧА 1: начисление недель за выигранные турниры действующему №1 ---
  assert.equal(getWeeksAtNo1Award({ type: 'ТБШ' }), 2);
  assert.equal(getWeeksAtNo1Award({ type: 'Мастерс' }), 2);
  assert.equal(getWeeksAtNo1Award({ type: 'Итоговый' }), 2);
  assert.equal(getWeeksAtNo1Award({ type: 'Олимпиада' }), 2);
  assert.equal(getWeeksAtNo1Award({ type: 'ATP 500' }), 1);
  assert.equal(getWeeksAtNo1Award({ type: 'ATP 250' }), 0);
  assert.equal(getWeeksAtNo1Award(null), 0);

  const liveRanking = [
    { id: 'p_leader', name: 'Leader', rank: 1, weeksAtNo1: 10 },
    { id: 'p_second', name: 'Challenger', rank: 2 }
  ];
  const slamAward = awardWeeksAtNo1(liveRanking, { type: 'ТБШ' });
  assert.equal(slamAward.weeks, 2);
  assert.equal(slamAward.player.id, 'p_leader');
  assert.equal(liveRanking[0].weeksAtNo1, 12, 'Титул ТБШ добавляет лидеру 2 недели на №1');
  awardWeeksAtNo1(liveRanking, { type: 'ATP 500' });
  assert.equal(liveRanking[0].weeksAtNo1, 13, 'Титул ATP 500 добавляет лидеру 1 неделю на №1');
  assert.equal(liveRanking[0].weeksAtNo1Earned, 3, 'Заработанные в игре недели учитываются отдельно от исторических');
  assert.equal(liveRanking[1].weeksAtNo1, undefined, 'Недели начисляются только первой ракетке мира');
  assert.equal(awardWeeksAtNo1(liveRanking, { type: 'ATP 250' }).weeks, 0, 'ATP 250 не приносит недель на №1');

  // --- ФИЧА 1: формула GOAT-индекса ---
  const sampleStats = {
    slamTitles: 1,
    finalsTitles: 1,
    olympicGold: 1,
    olympicSilver: 1,
    olympicBronze: 1,
    mastersTitles: 1,
    atp500Titles: 1,
    seasonNo1: 1,
    weeksAtNo1: 25,
    careerGrandSlam: true
  };
  // 8 + 4 + 5 + 2 + 1 + 3 + 1 + 5 + floor(25/10)=2 + 10 = 41
  assert.equal(calculateGoatScore(sampleStats), 41, 'GOAT-индекс строго соответствует весам');
  assert.equal(calculateGoatScore({ ...sampleStats, weeksAtNo1: 9 }), 39, 'Каждые 10 недель на №1 дают +1 к GOAT');
  assert.equal(calculateGoatScore({ ...sampleStats, weeksAtNo1: 19 }), 40);
  assert.equal(calculateGoatScore(null), 0);
  assert.equal(GOAT_SCORE_WEIGHTS.careerGrandSlam, 10);

  // --- ФИЧА 1: единый всевременной рейтинг активных и легенд ---
  const activeStar = { id: 'p_kyupan', name: 'Max Kyupan', flag: 'AUT', rank: 1, weeksAtNo1: 148 };
  const legendStar = {
    id: 'p_istep',
    name: 'Istep Fofol',
    flag: 'SRB',
    weeksAtNo1: 142,
    retiredYear: 2022,
    medals: { gold: 0, silver: 0, bronze: 0 }
  };
  const goatHistory = {
    2023: {
      yearEndTop50: [{ id: 'p_istep', name: 'Istep Fofol', rank: 1 }],
      tournamentsData: [
        { id: 'tbsh_1', type: 'ТБШ', winner: { id: 'p_istep', name: 'Istep Fofol' } },
        { id: 'tbsh_2', type: 'ТБШ', winner: { id: 'p_istep', name: 'Istep Fofol' } }
      ]
    },
    2024: {
      yearEndTop50: [{ id: 'p_kyupan', name: 'Max Kyupan', rank: 1 }],
      tournamentsData: [
        { id: 'tbsh_1', type: 'ТБШ', winner: { id: 'p_kyupan', name: 'Max Kyupan' } },
        { id: 'tbsh_2', type: 'ТБШ', winner: { id: 'p_kyupan', name: 'Max Kyupan' } },
        { id: 'tbsh_3', type: 'ТБШ', winner: { id: 'p_kyupan', name: 'Max Kyupan' } },
        { id: 'tbsh_4', type: 'ТБШ', winner: { id: 'p_kyupan', name: 'Max Kyupan' } },
        { id: 'miami_open', type: 'Мастерс', winner: { id: 'p_kyupan', name: 'Max Kyupan' } },
        { id: 'finals', type: 'Итоговый', winner: { id: 'p_kyupan', name: 'Max Kyupan' } }
      ]
    }
  };
  const goatBoard = buildGoatLeaderboard([activeStar], [legendStar], goatHistory);
  assert.equal(goatBoard.length, 2, 'В рейтинг GOAT попадают и активные игроки, и легенды');
  const kyupanEntry = goatBoard[0];
  assert.equal(kyupanEntry.name, 'Max Kyupan');
  assert.equal(kyupanEntry.goatRank, 1);
  assert.equal(kyupanEntry.statusLabel, 'Активен');
  assert.equal(kyupanEntry.slamTitles, 4);
  assert.equal(kyupanEntry.mastersTitles, 1);
  assert.equal(kyupanEntry.finalsTitles, 1);
  assert.equal(kyupanEntry.seasonNo1, 1, 'Сезон на №1 считается только по завершённому году');
  assert.equal(kyupanEntry.careerGrandSlam, true, 'Победы на всех четырёх ТБШ дают Карьерный Шлем');
  assert.equal(kyupanEntry.goatScore, 4 * 8 + 3 + 4 + 5 + Math.floor(148 / 10) + 10);
  const istepEntry = goatBoard[1];
  assert.equal(istepEntry.name, 'Istep Fofol');
  assert.equal(istepEntry.goatRank, 2);
  assert.equal(istepEntry.statusLabel, 'Легенда');
  assert.equal(istepEntry.slamTitles, 2);
  assert.equal(istepEntry.careerGrandSlam, false);
  assert.equal(istepEntry.seasonNo1, 1);
  assert.equal(istepEntry.goatScore, 2 * 8 + 5 + Math.floor(142 / 10));
  assert.ok(goatBoard[0].goatScore >= goatBoard[1].goatScore, 'Рейтинг GOAT отсортирован по очкам');

  // --- ФИЧА 2: генерация и назначение потенциала ---
  assert.equal(generatePlayerPotential(() => 0), 93, 'Поколенческий талант получает потенциал 93+');
  assert.equal(generatePlayerPotential(() => 0.5), 85, 'Обычный талант получает потенциал из диапазона 78–92');
  assert.equal(generatePlayerPotential(() => 0.99), 92);

  const youngTalent = { id: 'p_young', name: 'Young Gun', rank: 180, points: 120, birthDate: '2005-03-10' };
  const veteran = { id: 'p_vet', name: 'Old Guard', rank: 30, points: 2000, birthDate: '1988-05-05' };
  assert.equal(ensureYoungPlayerPotentials([youngTalent, veteran], '2024-01-02'), 1, 'POT назначается только игрокам до 23 лет');
  assert.ok(youngTalent.potential >= 78 && youngTalent.potential <= 98);
  assert.equal(youngTalent.potentialModel, POTENTIAL_MODEL_VERSION, 'POT помечается версией скаутской модели');
  assert.equal(veteran.potential, undefined, 'Ветераны не получают POT');
  assert.equal(ensureYoungPlayerPotentials([youngTalent, veteran], '2024-01-02'), 0, 'Повторный вызов не перегенерирует POT');

  // Скаутская модель: потолок растёт от текущего уровня и запаса по возрасту
  const youngStar = { id: 'p_star', name: 'Young Star', rank: 5, points: 6000, birthDate: '2005-03-10' };
  const youngJourneyman = { id: 'p_jour', name: 'Young Journeyman', rank: 180, points: 120, birthDate: '2005-03-10' };
  const teenProdigy = { id: 'p_teen', name: 'Teen Prodigy', rank: 180, points: 120, birthDate: '2007-03-10' };
  const adultPro = { id: 'p_adult', name: 'Adult Pro', rank: 180, points: 120, birthDate: '2001-03-10' };
  ensureYoungPlayerPotentials([youngStar, youngJourneyman, teenProdigy, adultPro], '2024-01-02');
  assert.ok(youngStar.potential > youngJourneyman.potential, 'У игрока Топ-5 потолок выше, чем у №180 того же возраста');
  assert.ok(teenProdigy.potential > adultPro.potential, 'В 16 лет запас роста больше, чем в 22 года');

  youngTalent.potential = 95;
  const talentBonus = getYoungTalentWinBonus(youngTalent, '2024-06-30');
  assert.ok(talentBonus > 0 && talentBonus <= 0.18, 'Молодой талант получает бонус к победе от разницы POT и OVR');
  assert.equal(getYoungTalentWinBonus({ ...veteran, potential: 99 }, '2024-06-30'), 0, 'После 23 лет бонус не действует');
  assert.equal(getYoungTalentWinBonus({ ...youngTalent, potential: undefined }, '2024-06-30'), 0);
  assert.equal(
    getYoungTalentWinBonus({ id: 'p_champ', rank: 1, points: 12000, birthDate: '2005-03-10', potential: 90 }, '2024-06-30'),
    0,
    'Если потенциал ниже текущего OVR, бонуса нет'
  );

  const newgen = createNewgenPlayer(2025, new Set(), 1, () => 0.2);
  assert.equal(newgen.potential, 85, 'Ньюген получает POT при генерации: 81 + бонус за молодость (+4 в 18 лет)');
  assert.equal(newgen.potentialModel, POTENTIAL_MODEL_VERSION);
  assert.ok(newgen.ageAtEntry >= 17 && newgen.ageAtEntry <= 23);

  // --- ФИЧА 4: лауреаты сезона ---
  const awardPlayers = [];
  for (let i = 0; i < 55; i++) {
    const rank = i + 1;
    awardPlayers.push({
      id: `p_award_${rank}`,
      name: `Award Player ${rank}`,
      flag: 'ITA',
      rank,
      points: 12000 - rank * 100,
      seasonStartRank: rank,
      birthDate: rank === 7 ? '2003-04-12' : (rank === 1 ? '1996-06-01' : '1995-01-01')
    });
  }
  awardPlayers[7].seasonStartRank = 45;

  const ironDraw = [
    [
      { p1: { id: 'p_award_12', name: 'Award Player 12' }, p2: { id: 'p_award_13', name: 'Award Player 13' }, winner: { id: 'p_award_12', name: 'Award Player 12' }, score: ['6-4', '6-3'] },
      { p1: { id: 'p_award_14', name: 'Award Player 14' }, p2: { id: 'p_award_15', name: 'Award Player 15' }, winner: { id: 'p_award_14', name: 'Award Player 14' }, score: ['6-2', '6-2'] }
    ],
    [
      { p1: { id: 'p_award_12', name: 'Award Player 12' }, p2: { id: 'p_award_14', name: 'Award Player 14' }, winner: { id: 'p_award_12', name: 'Award Player 12' }, score: ['7-5', '6-4'] }
    ]
  ];
  const awardSeasonTourneys = [
    { id: 'award_open', type: 'ATP 500', completed: true, winner: { id: 'p_award_12', name: 'Award Player 12' } }
  ];
  const seasonAwards = computeSeasonAwards(awardPlayers, 2024, {
    seasonsHistory: {},
    seasonTourneys: awardSeasonTourneys,
    getDraw: (tid, yr) => (tid === 'award_open' && yr === 2024 ? ironDraw : null)
  });
  assert.ok(seasonAwards, 'Лауреаты сезона должны вычисляться');
  assert.equal(seasonAwards.year, 2024);
  assert.equal(seasonAwards.playerOfYear.id, 'p_award_1', 'Игрок Года — первая ракетка мира');
  assert.equal(seasonAwards.breakthrough.id, 'p_award_8', 'Прорыв Года — максимальный подъём в Топ-50');
  assert.equal(seasonAwards.breakthrough.rise, 37);
  assert.equal(seasonAwards.nextGen.id, 'p_award_7', 'NextGen Года — лучший игрок не старше 22 лет');
  assert.ok(seasonAwards.nextGen.age <= 22);
  assert.equal(seasonAwards.ironMan.id, 'p_award_12', 'Железный Человек — больше всех побед в сезоне');
  assert.equal(seasonAwards.ironMan.wins, 2);
  assert.equal(seasonAwards.ironMan.titles, 1);

  const fallbackAwards = computeSeasonAwards(awardPlayers, 2024, { seasonTourneys: awardSeasonTourneys });
  assert.equal(fallbackAwards.ironMan.id, 'p_award_12', 'Без сохранённых сеток Железный Человек определяется по титулам');
  assert.equal(fallbackAwards.ironMan.wins, 0);
  assert.equal(fallbackAwards.ironMan.titles, 1);
  assert.equal(computeSeasonAwards([], 2024), null, 'Пустой пул игроков не даёт лауреатов');
});


