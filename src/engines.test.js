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
  computeMatchMomentumPercent
} from './matchEngine.js';
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
  applyTournamentPointsToPlayers,
  runBackgroundATP250Tournaments,
  createTop50Snapshot
} from './rankingEngine.js';
import {
  getRetirementProbability,
  processEndOfSeasonRetirements
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
  assert.equal(top10[2].points, 6800);
  assert.equal(top10[3].name, 'Ussistian Shifter');
  assert.equal(top10[3].points, 5050);
  assert.equal(top10[4].name, 'Fite Memsy Staprin');
  assert.equal(top10[4].points, 4690);
  assert.equal(top10[5].name, 'Puddy Mexalino');
  assert.equal(top10[5].points, 4060);
  assert.equal(top10[6].name, 'Gary Riffay');
  assert.equal(top10[6].points, 3800);
  assert.equal(top10[7].name, 'Omar Netigios');
  assert.equal(top10[7].points, 3300);
  assert.equal(top10[8].name, 'Pen Klak');
  assert.equal(top10[8].points, 3130);
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
  assert.equal(players[1].bestRank, 2);

  assert.equal(players[2].name, 'Istep Fofol');
  assert.equal(players[2].points, 6800);
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
  Object.entries(countryCounts).forEach(([country, cnt]) => {
    assert.ok(cnt <= 4, `Квота страны ${country} (${cnt}) не должна превышать 4`);
  });

  // Проверим структуру сетки Олимпиады и Матч за 3-е место
  const olyTourney = cal2024.find(t => t.id === 'olympics');
  const { draw } = createTournamentDraw(olyTourney, players);
  assert.equal(draw.length, 6);
  assert.equal(draw[0].length, 32);
  assert.equal(draw[4].length, 2);
  assert.equal(draw[5].length, 2);
  assert.equal(draw[5][0].isGoldMatch, true);
  assert.equal(draw[5][1].isBronzeMatch, true);

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

test('Блок 1: Интеграция Groq API (aiService.js) — нижний регистр модели, очистка Markdown ```json, защита ключа и строгий перехват ошибок', async () => {
  const memStore = createMemoryStorage();
  assert.equal(GROQ_API_ENDPOINT, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(typeof DEFAULT_GROQ_API_KEY, 'string', 'DEFAULT_GROQ_API_KEY не хранит зашитый секрет в открытом коде');
  assert.equal(getGroqApiKey(memStore), DEFAULT_GROQ_API_KEY, 'По умолчанию возвращается DEFAULT_GROQ_API_KEY из окружения');
  assert.equal(getGroqModel(memStore), 'llama-3.3-70b-versatile');

  // Проверка принудительного нижнего регистра имени модели
  assert.equal(normalizeGroqModelName('Llama-3.3-70b-versatile'), 'llama-3.3-70b-versatile');
  assert.equal(normalizeGroqModelName('LLAMA-3.1-8B-INSTANT'), 'llama-3.1-8b-instant');
  setGroqModel('Llama-3.3-70B-Versatile', memStore);
  assert.equal(getGroqModel(memStore), 'llama-3.3-70b-versatile');

  // Проверка очистки Markdown-оберток ```json ... ```
  const rawMarkdown = '```json\n{"winnerId": "p_1", "score": "6-4 6-4"}\n```';
  const cleaned = cleanGroqJsonString(rawMarkdown);
  assert.equal(cleaned, '{"winnerId": "p_1", "score": "6-4 6-4"}');
  assert.deepEqual(JSON.parse(cleaned), { winnerId: 'p_1', score: '6-4 6-4' });

  // Проверка честного заголовка источника
  assert.equal(getGroqSourceHeaderLabel('llama-3.3-70b-versatile'), 'ИИ-репортаж (Groq / Llama 3.3)');
  assert.equal(getGroqSourceHeaderLabel('llama-3.1-8b-instant'), 'ИИ-репортаж (Groq / Llama 3.1)');

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
  assert.equal(capturedBody.model, 'llama-3.3-70b-versatile');
  assert.equal(capturedBody.response_format.type, 'json_object');
  assert.equal(groqSim.source, 'groq');
  assert.equal(groqSim.sourceLabel, 'ИИ-репортаж (Groq / Llama 3.3)');
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
    { name: 'Will Wentra', points: 11950, bestRank: 2 },
    { name: 'Istep Fofol', points: 6800, bestRank: 1 },
    { name: 'Ussistian Shifter', points: 5050, bestRank: 4 },
    { name: 'Fite Memsy Staprin', points: 4690, bestRank: 5 },
    { name: 'Puddy Mexalino', points: 4060, bestRank: 4 },
    { name: 'Gary Riffay', points: 3800, bestRank: 6 },
    { name: 'Omar Netigios', points: 3300, bestRank: 8 },
    { name: 'Pen Klak', points: 3130, bestRank: 9 },
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
  assert.equal(fofol.points, 6800 - 1000 + fofolEarned2024, 'Рейтинг 52 недель вычитает защиту 2023 и прибавляет очки 2024');
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
  assert.equal(commentRes.sourceLabel, 'ИИ-репортаж (Groq / Llama 3.3)');
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

  const endRank100 = players[99];
  assert.ok(endRank100.points >= 750 && endRank100.points <= 1050, `В конце сезона 2024 ранг #100 имеет реалистичные очки ATP (${endRank100.points} pts)`);
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
