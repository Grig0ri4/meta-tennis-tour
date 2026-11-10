import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { processEndOfSeasonRetirements } from '../src/retirementEngine.js';
import { syncPlayers52WeekDiagnostics, sortAndRankPlayers, createTop50Snapshot } from '../src/rankingEngine.js';
import { getSeasonTournaments } from '../data/tournaments.js';

console.log('Extracting git commit 80bd1b2 canon...');
const git80Str = execSync('git show 80bd1b2:public/canon.json', { maxBuffer: 100 * 1024 * 1024 }).toString();
const git80 = JSON.parse(git80Str);

console.log('Original 80bd1b2 tournaments count:', git80.tournaments?.length);
console.log('Original 80bd1b2 completed count:', git80.tournaments?.filter(t => t.completed).length);

// 1. Гарантируем 27 турниров 2024 года (все завершены, включая Итоговый)
const t2024 = JSON.parse(JSON.stringify(git80.tournaments));
const finalsTourney = t2024.find(t => t.id === 'finals');
if (finalsTourney) {
  finalsTourney.completed = true;
  finalsTourney.lastScore = '7-6(2) 3-6 4-6';
  finalsTourney.lastWinner = {
    id: 'p_3',
    name: 'Max Kyupan',
    flag: 'GEO',
    rank: 1,
    birthDate: '1990-01-13',
    stamina: 15,
    seedNum: 2
  };
  finalsTourney.lastRunnerUp = {
    id: 'p_22',
    name: 'Ussistian Shifter',
    flag: 'USA',
    rank: 2,
    birthDate: '2001-06-19',
    stamina: 15,
    seedNum: 1
  };
}

// 2. Игроки на конец 2024 года (после Итогового)
const players2024End = JSON.parse(JSON.stringify(git80.players));

// 3. Архив 2024 года в seasonsHistory
const seasonsHistory = JSON.parse(JSON.stringify(git80.seasonsHistory || {}));
const hist2024 = seasonsHistory['2024'] || { year: 2024, slamSnapshots: {}, tournamentsData: [] };
hist2024.year = 2024;
hist2024.worldNumberOne = { ...players2024End[0] };
hist2024.tournamentsData = t2024.map(t => {
  const existing = (hist2024.tournamentsData || []).find(e => e.id === t.id);
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    surface: t.surface,
    winner: t.lastWinner,
    runnerUp: t.lastRunnerUp,
    bronze: t.lastBronze || null,
    score: t.lastScore || '—',
    pressColumn: existing?.pressColumn || {
      headline: `${t.lastWinner?.name || 'Победитель'} — чемпион ${t.name}`,
      lead: `В финальном поединке турнира ${t.name} ${t.lastWinner?.name || 'Победитель'} обыграл ${t.lastRunnerUp?.name || 'соперника'} со счетом ${t.lastScore || '—'}.`,
      body: `Матч завершился триумфом ${t.lastWinner?.name}.`
    }
  };
});

// Создаем срезы Топ-50 для 2024 года
const tbsh4Top50 = hist2024.slamSnapshots?.tbsh_4?.top50;
hist2024.yearEndTop50 = createTop50Snapshot(players2024End, '2024-11-22', tbsh4Top50);
hist2024.seasonStartTop50 = seasonsHistory['2023']?.yearEndTop50 || [];

// 4. Процесс перехода в 2025 год (завершение карьеры + ньюгены + очки на 02.01.2025)
const retRes = processEndOfSeasonRetirements(players2024End, 2024, []);
// Корректируем исторические пики рангов ветеранов
const PEAK_CAREER_RANKS = {
  p_39: 39,
  p_26: 26,
  p_90: 90,
  p_97: 97
};
retRes.retiredThisYear.forEach(r => {
  if (PEAK_CAREER_RANKS[r.id]) r.bestRank = PEAK_CAREER_RANKS[r.id];
});

hist2024.retiredLegends = retRes.retiredThisYear;
seasonsHistory['2024'] = hist2024;

let players2025 = retRes.updatedPlayers;
const retiredLegends2025 = [...retRes.retiredThisYear];

const t2025 = getSeasonTournaments(2025, t2024).map(t => ({
  ...t,
  completed: false,
  lastWinner: null,
  lastRunnerUp: null,
  lastBronze: null,
  lastScore: null
}));

syncPlayers52WeekDiagnostics(players2025, t2025, 2025);
players2025.forEach(p => {
  p.points = Math.max(0, p.remainingDefending || 0);
  p.racePoints = 0;
  p.finalsPoints = 0;
  p.defendedSoFar = 0;
  p.rankChange = 0;
  p.raceRankChange = 0;
  p.lastPointsDelta = 0;
  p.lastRaceDelta = 0;
  p.lastTourneyEarned = 0;
  p.lastTourneyDefended = 0;
  p.lastTourneyName = '';
});
sortAndRankPlayers(players2025, false);
players2025.forEach(p => { p.seasonStartRank = p.rank; });

// 5. Все 53 сетки
const allDraws = { ...(git80.draws || {}) };

// 6. Формируем 9 полных чекпоинтов тура
const existingCheckpoints = (git80.checkpoints || []).map(cp => {
  const copy = { ...cp };
  delete copy.draws;
  return copy;
});

const cpStart2025 = {
  id: 'cp_start_2025',
  name: 'Старт сезона 2025 (02 Января 2025)',
  label: 'Старт сезона 2025 (02 Января 2025)',
  dateStr: '2025-01-02',
  year: 2025,
  activeTourneyId: 'm_1',
  worldNo1: `GEO ${players2025[0].name} (${players2025[0].points.toLocaleString()} pts)`,
  createdAt: '02 Янв 2025',
  lockedStartCheckpoint: true,
  isManual: false,
  completedTourneyIds: [],
  players: players2025,
  tournaments: t2025,
  seasonsHistory: seasonsHistory,
  retiredLegends: retiredLegends2025
};

const cpFinals2024 = {
  id: 'cp_finals_2024',
  name: 'После World Tour Finals (2024) · Чемпион: Max Kyupan',
  label: 'После World Tour Finals (2024) · Чемпион: Max Kyupan',
  dateStr: '2024-11-22',
  year: 2024,
  activeTourneyId: 'finals',
  worldNo1: `GEO ${players2024End[0].name} (${players2024End[0].points.toLocaleString()} pts)`,
  createdAt: '22 Ноя 2024',
  lockedStartCheckpoint: false,
  isManual: false,
  completedTourneyIds: t2024.map(t => t.id),
  players: players2024End,
  tournaments: t2024,
  seasonsHistory: seasonsHistory,
  retiredLegends: retRes.retiredThisYear
};

// Объединяем чекпоинты без дубликатов, упорядочивая по дате от новых к старым
const cpMap = new Map();
cpMap.set(cpStart2025.id, cpStart2025);
cpMap.set(cpFinals2024.id, cpFinals2024);
existingCheckpoints.forEach(cp => {
  if (cp?.id && !cpMap.has(cp.id)) {
    cpMap.set(cp.id, cp);
  }
});
const mergedCheckpoints = Array.from(cpMap.values()).sort((a, b) => String(b.dateStr || '').localeCompare(String(a.dateStr || '')));

console.log('Merged checkpoints count:', mergedCheckpoints.length);
mergedCheckpoints.forEach((cp, idx) => console.log('  ', idx + 1, cp.id, cp.name, cp.dateStr));

// 7. Формируем единый канонический файл
// По умолчанию активное состояние тура — старт сезона 2025 (02.01.2025, #1 Хьюстон Masters)
const masterUniverse = {
  id: '1',
  name: 'Вселенная Автора (Канон)',
  currentTourYear: 2025,
  currentTourDateStr: '2025-01-02',
  activeTourneyId: 'm_1'
};

const finalCanon = {
  ...git80,
  universe: masterUniverse,
  currentTourYear: 2025,
  currentTourDateStr: '2025-01-02',
  activeTourneyId: 'm_1',
  tournaments: t2025,
  players: players2025,
  seasonsHistory: seasonsHistory,
  retiredLegends: retiredLegends2025,
  draws: allDraws,
  checkpoints: mergedCheckpoints,
  exportedAt: new Date().toISOString()
};

fs.writeFileSync('data/canon_nov15_master.json', JSON.stringify(finalCanon, null, 2), 'utf8');
fs.writeFileSync('public/canon.json', JSON.stringify(finalCanon, null, 2), 'utf8');
if (fs.existsSync('public/canon.backup.nov15.json')) {
  fs.writeFileSync('public/canon.backup.nov15.json', JSON.stringify(finalCanon, null, 2), 'utf8');
}

console.log('Master canon successfully written to data/canon_nov15_master.json, public/canon.json, and public/canon.backup.nov15.json');
