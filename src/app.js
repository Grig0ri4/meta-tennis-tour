/**
 * Meta Tennis Tour — Главный контроллер приложения (src/app.js)
 * Инициализация базы 300 игроков, 26/27 турниров (включая Олимпийские игры раз в 4 года),
 * система Мультивселенных (Save Slots) и Экспорт/Импорт (.json),
 * двухрежимный симулятор матчей (локальный + Groq API Llama 3.3 70B / 3.1 8B), рейтинги, Зал Славы и смена поколений.
 */

import { PRESERVED_BASE, CLEAN_UNIQUE_POOL, PROCEDURAL_FLAGS, buildInitial300Players, generateRandom300Players } from '../data/players.js';

let RESTORED_2024_DRAWS = {};
let CANON_MASTER_SNAPSHOT = null;

async function ensureMasterArchivesLoaded() {
  if (CANON_MASTER_SNAPSHOT) return;
  try {
    const [restoredMod, canonMod] = await Promise.all([
      import('../data/restored_halle_hamburg_draws.json'),
      import('../data/canon_nov15_master.json')
    ]);
    RESTORED_2024_DRAWS = restoredMod.default || restoredMod || {};
    CANON_MASTER_SNAPSHOT = canonMod.default || canonMod || null;
  } catch (e) {
    console.warn('Master archives lazy load skipped:', e);
  }
}
import {
  FULL_CALENDAR_TEMPLATE,
  OLYMPIC_TOURNAMENT_TEMPLATE,
  isOlympicYear,
  getOlympicSurface,
  getSeasonTournaments,
  rNames128,
  rNames64,
  rNamesOlympics,
  rNames32,
  rNamesFinals,
  getTourneyDateRange
} from '../data/tournaments.js';
import {
  calculateGroupStandings,
  createTournamentDraw,
  selectOlympicParticipantsWithQuota
} from './drawEngine.js';
import {
  formatTennisScore,
  flipTennisScoreSets,
  computeSimMatchScores,
  parseAndValidateScoreString,
  advanceWinnerInDraw,
  resetMatchResultInDraw,
  getStageNameForRound,
  getHeadToHeadAnalytics,
  calculateMatchStaminaCost,
  applyMatchFatigueToPlayers,
  resetPlayersStamina,
  regenerateInterRoundStamina,
  restoreMatchFatigue,
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
  calculateAge,
  calculateAgeNum,
  renderPlayerMedalsHtml,
  getDefendingPoints,
  sortAndRankPlayers,
  applyTournamentPointsToPlayers,
  runBackgroundATP250Tournaments,
  createTop50Snapshot
} from './rankingEngine.js';
import {
  NEWGEN_NICKNAMES,
  NEWGEN_PLAY_STYLES,
  processEndOfSeasonRetirements
} from './retirementEngine.js';
import {
  HISTORICAL_2023_FINALS,
  ensureDefault2023SeasonArchive,
  ensureCleanJanuary2024StartState
} from './seedArchive2023.js';
import {
  DEFAULT_GROQ_API_KEY,
  normalizeGroqModelName,
  getGroqSourceHeaderLabel,
  getGroqApiKey,
  setGroqApiKey,
  hasGroqApiKey,
  getGroqModel,
  setGroqModel,
  simulateMatchWithGroq,
  generateCommentaryForEnteredScore,
  generateFinalPressColumn,
  buildFallbackFinalPressColumn,
  enrichNewgensWithGroq
} from './aiService.js';
import {
  COUNTRY_CATALOG,
  getCountryMeta,
  normalizeCountryCode,
  renderFlagBadge
} from './countryFlags.js';

// --- СИСТЕМА МУЛЬТИВСЕЛЕННЫХ (SAVE SLOTS В LOCALSTORAGE) И ЗАЩИТА КАНОНА АВТОРА ---
const UNIVERSES_LIST_KEY = 'meta_universes_registry_v1';
const ACTIVE_UNIVERSE_KEY = 'meta_active_universe_id_v1';
const CANON_AUTHOR_UNLOCK_KEY = 'meta_canon_author_unlocked_v1';
const CANON_GUEST_PREVIEW_KEY = 'meta_canon_guest_preview_v1';
const CANON_AUTHOR_PASSCODE = 'grig0ri4';

let universesList = [];
let activeUniverseId = '1';

export function isCanonUniverseActive() {
  const currentUnivMeta = universesList.find(u => u.id === activeUniverseId);
  return activeUniverseId === '1' || Boolean(currentUnivMeta?.isCanon);
}

export function isAuthorOwnerMode() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(CANON_GUEST_PREVIEW_KEY) === 'true') {
      return false;
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem(CANON_AUTHOR_UNLOCK_KEY) === 'true') {
      return true;
    }
    if (typeof window !== 'undefined' && window.location) {
      const host = String(window.location.hostname || '').toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1') {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export function isCanonReadOnly() {
  if (!isCanonUniverseActive()) return false;
  return !isAuthorOwnerMode();
}

export function guardCanonReadOnly() {
  if (!isCanonReadOnly()) return false;
  showToast('🔒 <b>«Вселенная Автора (Канон)» открыта в режиме только для чтения.</b> Нажмите «+ Создать новую вселенную», чтобы проводить собственные турниры и сезоны!');
  return true;
}

export function openAuthorUnlockModal() {
  const input = document.getElementById('authorPasscodeInput');
  const errEl = document.getElementById('authorUnlockError');
  if (input) input.value = '';
  if (errEl) errEl.style.display = 'none';
  document.getElementById('authorUnlockModal')?.classList.add('open');
  setTimeout(() => input?.focus(), 60);
}

export function confirmAuthorUnlock() {
  const input = document.getElementById('authorPasscodeInput');
  const errEl = document.getElementById('authorUnlockError');
  const code = String(input?.value || '').trim();
  if (code.toLowerCase() === CANON_AUTHOR_PASSCODE.toLowerCase()) {
    try {
      localStorage.setItem(CANON_AUTHOR_UNLOCK_KEY, 'true');
      localStorage.removeItem(CANON_GUEST_PREVIEW_KEY);
    } catch {
      // ignore
    }
    closeModal('authorUnlockModal');
    initUI({ preserveSelectedTourney: true });
    renderPlayersTable();
    renderRaceTable();
    renderCalendarTable();
    showToast('👑 <b>Режим Автора активирован!</b> Вам доступно полное управление «Вселенной Автора (Канон)».');
  } else {
    if (errEl) {
      errEl.innerText = '⚠️ Неверный ключ Автора. Гости могут создать собственную вселенную кнопкой «+ Создать новую вселенную».';
      errEl.style.display = 'block';
    }
  }
}

export function toggleGuestReadOnlyPreview(enableGuestPreview) {
  try {
    if (enableGuestPreview) {
      localStorage.setItem(CANON_GUEST_PREVIEW_KEY, 'true');
    } else {
      localStorage.removeItem(CANON_GUEST_PREVIEW_KEY);
    }
  } catch {
    // ignore
  }
  initUI({ preserveSelectedTourney: true });
  renderPlayersTable();
  renderRaceTable();
  renderCalendarTable();
  if (enableGuestPreview) {
    showToast('👁️ <b>Включён режим Гостя (Read-Only)!</b> Именно так посетители на GitHub видят «Вселенную Автора (Канон)». Для возврата нажмите «🔑 Я Автор».');
  } else {
    showToast('👑 <b>Вы вернулись в режим Автора.</b>');
  }
}

export function updateCanonReadOnlyUI() {
  const canonActive = isCanonUniverseActive();
  const readOnly = isCanonReadOnly();

  const roBanner = document.getElementById('canonReadOnlyBanner');
  const ownerBanner = document.getElementById('canonOwnerControlBanner');
  if (roBanner) {
    roBanner.style.display = (canonActive && readOnly) ? 'flex' : 'none';
    const textBox = roBanner.querySelector('div');
    if (textBox && canonSnapshotInfo) {
      let stamp = document.getElementById('canonSnapshotStamp');
      if (!stamp) {
        stamp = document.createElement('div');
        stamp.id = 'canonSnapshotStamp';
        stamp.style.cssText = 'font-size: 11.5px; color: #7dd3fc; margin-top: 3px;';
        textBox.appendChild(stamp);
      }
      const tourDate = canonSnapshotInfo.date ? formatDateDisplay(canonSnapshotInfo.date) : '';
      const pubDate = canonSnapshotInfo.exportedAt ? new Date(canonSnapshotInfo.exportedAt).toLocaleString('ru-RU') : '';
      stamp.innerHTML = `📡 Снимок канона: тур на <b>${tourDate}</b>${pubDate ? ` · опубликован ${pubDate}` : ''}`;
    }
  }
  if (ownerBanner) {
    ownerBanner.style.display = (canonActive && !readOnly) ? 'flex' : 'none';
  }

  const headerButtonsToLock = [
    'btnTestSimSeason',
    'btnImportUniverse',
    'btnImport2023Archive'
  ];
  headerButtonsToLock.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = readOnly ? 'none' : 'inline-flex';
    }
  });

  const panelButtonsToHide = [
    'btnEditCurrentTourney',
    'btnAddNewPlayer',
    'btnManualRepairPts',
    'btnResetJan2024',
    'btnEndSeason',
    'btnCreateManualCheckpoint',
    'btnProfileOpenEdit'
  ];
  panelButtonsToHide.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = readOnly ? 'none' : 'inline-flex';
    }
  });
}

function loadUniversesRegistry() {
  try {
    const raw = localStorage.getItem(UNIVERSES_LIST_KEY);
    universesList = raw ? JSON.parse(raw) : [];
  } catch {
    universesList = [];
  }
  if (!Array.isArray(universesList) || universesList.length === 0) {
    universesList = [{ id: '1', name: 'Вселенная Автора (Канон)', year: 2024, startYear: 2024, isCanon: true }];
    localStorage.setItem(UNIVERSES_LIST_KEY, JSON.stringify(universesList));
  } else {
    const canonUniv = universesList.find(u => u.id === '1');
    if (canonUniv) {
      canonUniv.name = 'Вселенная Автора (Канон)';
      canonUniv.isCanon = true;
      canonUniv.startYear = 2024;
    } else {
      universesList.unshift({ id: '1', name: 'Вселенная Автора (Канон)', year: 2024, startYear: 2024, isCanon: true });
    }
    universesList.forEach(u => {
      if (u.id === '1') {
        u.startYear = 2024;
      } else if (!u.startYear) {
        u.startYear = u.year || 2024;
      }
    });
    localStorage.setItem(UNIVERSES_LIST_KEY, JSON.stringify(universesList));
  }
  const savedActive = localStorage.getItem(ACTIVE_UNIVERSE_KEY);
  if (savedActive && universesList.some(u => u.id === savedActive)) {
    activeUniverseId = savedActive;
  } else {
    activeUniverseId = universesList[0].id;
    localStorage.setItem(ACTIVE_UNIVERSE_KEY, activeUniverseId);
  }
}

function saveUniversesRegistry() {
  const currentUniv = universesList.find(u => u.id === activeUniverseId);
  if (currentUniv) {
    if (!currentUniv.startYear) currentUniv.startYear = currentUniv.id === '1' ? 2024 : (currentUniv.year || 2024);
    currentUniv.year = currentTourYear;
  }
  try {
    localStorage.setItem(UNIVERSES_LIST_KEY, JSON.stringify(universesList));
    localStorage.setItem(ACTIVE_UNIVERSE_KEY, activeUniverseId);
  } catch {
    // ignore quota error
  }
}

const memoryUniverseStore = {};

export function runStorageGarbageCollector() {
  if (typeof localStorage === 'undefined') return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const isLegacySuffix = /_v[1-8]$/.test(k) || /_v[1-8]_/.test(k);
      const isLegacyPrefix =
        k.startsWith('meta_players_') ||
        k.startsWith('meta_tournaments_') ||
        k.startsWith('meta_tour_date_') ||
        k.startsWith('meta_tour_year_') ||
        k.startsWith('meta_active_tourney_') ||
        k.startsWith('meta_checkpoints_') ||
        k.startsWith('meta_seasons_history_') ||
        k.startsWith('universe_1_draw_') ||
        k.startsWith('draw_m_1') ||
        k.startsWith('universe_1_meta_checkpoints_v') ||
        k.startsWith('universe_1_meta_tournaments_v') ||
        k.startsWith('universe_1_meta_players_v') ||
        k.startsWith('universe_1_meta_seasons_history_v') ||
        k.startsWith('universe_1_meta_tour_');
      const isDuplicateUnprefixedDraw = k.startsWith('draw_') && !k.startsWith('draw_1_');
      if (isLegacySuffix || isLegacyPrefix || isDuplicateUnprefixedDraw) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {
    // ignore
  }
}

export const universeStorage = {
  key(k) {
    if (String(k).startsWith('draw_')) {
      return `draw_${activeUniverseId}_${String(k).slice(5)}`;
    }
    return `universe_${activeUniverseId}_${k}`;
  },
  getItem(k) {
    const fullKey = this.key(k);
    if (memoryUniverseStore[fullKey] !== undefined) {
      return memoryUniverseStore[fullKey];
    }
    try {
      let val = localStorage.getItem(fullKey);
      if (val !== null) {
        memoryUniverseStore[fullKey] = val;
        return val;
      }
      // Фоллбэк на legacy-ключи с версиями (_v8, _v2)
      if (!k.includes('_v8') && !k.includes('_v2')) {
        const v8Key = this.key(`${k}_v8`);
        val = localStorage.getItem(v8Key);
        if (val !== null) {
          memoryUniverseStore[fullKey] = val;
          return val;
        }
        const v2Key = this.key(`${k}_v2`);
        val = localStorage.getItem(v2Key);
        if (val !== null) {
          memoryUniverseStore[fullKey] = val;
          return val;
        }
      }
      if (activeUniverseId === '1') {
        const legacyVal = localStorage.getItem(k);
        if (legacyVal !== null) {
          memoryUniverseStore[fullKey] = legacyVal;
          return legacyVal;
        }
      }
      return null;
    } catch {
      return memoryUniverseStore[fullKey] ?? null;
    }
  },
  setItem(k, v) {
    const strVal = String(v);
    const fullKey = this.key(k);
    memoryUniverseStore[fullKey] = strVal;
    if (canonSnapshotInfo && activeUniverseId === '1') return;
    try {
      localStorage.setItem(fullKey, strVal);
    } catch {
      runStorageGarbageCollector();
      try {
        localStorage.setItem(fullKey, strVal);
      } catch {
        // Значение надежно сохранено в памяти memoryUniverseStore
      }
    }
  },
  removeItem(k) {
    const fullKey = this.key(k);
    delete memoryUniverseStore[fullKey];
    try {
      localStorage.removeItem(fullKey);
      if (!k.includes('_v8')) {
        localStorage.removeItem(this.key(`${k}_v8`));
      }
      if (activeUniverseId === '1') {
        localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
  }
};

// --- ПУБЛИЧНЫЙ СНИМОК КАНОНА АВТОРА (public/canon.json) ДЛЯ ГОСТЕЙ НА GITHUB PAGES ---
// Гости получают актуальный канон автора из опубликованного файла canon.json.
// Снимок кладётся только в память (memoryUniverseStore) и всегда имеет приоритет над localStorage гостя,
// поэтому у гостя канон всегда свежий, а локальная вселенная автора на localhost никогда не перезаписывается.
const CANON_SNAPSHOT_URL = './canon.json';
let canonSnapshotInfo = null;

export function shouldLoadPublishedCanonSnapshot() {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    const host = String(window.location.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return false;
    if (typeof localStorage !== 'undefined' && localStorage.getItem(CANON_AUTHOR_UNLOCK_KEY) === 'true') return false;
    return true;
  } catch {
    return false;
  }
}

export function applyCanonSnapshotToMemory(data, store = memoryUniverseStore) {
  if (!data || !Array.isArray(data.players) || data.players.length === 0) return false;
  const uKey = (k) => `universe_1_${k}`;
  const u = data.universe || {};
  const yearStr = String(Number(u.currentTourYear) || 2024);
  const dateStr = String(u.currentTourDateStr || '2024-01-02');
  const tourneyStr = String(u.activeTourneyId || 'm_1');
  const playersJson = JSON.stringify(data.players);
  const tourneysJson = JSON.stringify(data.tournaments || []);
  const historyJson = JSON.stringify(data.seasonsHistory || {});
  const legendsJson = JSON.stringify(data.retiredLegends || []);

  store[uKey('meta_tour_year')] = yearStr;
  store[uKey('meta_tour_year_v8')] = yearStr;
  store[uKey('meta_tour_date')] = dateStr;
  store[uKey('meta_tour_date_v8')] = dateStr;
  store[uKey('meta_active_tourney')] = tourneyStr;
  store[uKey('meta_active_tourney_v8')] = tourneyStr;
  store[uKey('meta_players')] = playersJson;
  store[uKey('meta_players_v8')] = playersJson;
  store[uKey('meta_tournaments')] = tourneysJson;
  store[uKey('meta_tournaments_v8')] = tourneysJson;
  store[uKey('meta_seasons_history')] = historyJson;
  store[uKey('meta_seasons_history_v8')] = historyJson;
  store[uKey('meta_retired_legends')] = legendsJson;
  store[uKey('meta_retired_legends_v8')] = legendsJson;
  store[uKey('meta_jan2024_clean_start_v2')] = 'true';

  Object.entries(data.draws || {}).forEach(([k, v]) => {
    const rest = String(k).startsWith('draw_') ? String(k).slice(5) : String(k);
    store[`draw_1_${rest}`] = typeof v === 'string' ? v : JSON.stringify(v);
  });
  Object.entries(data.withdrawals || {}).forEach(([k, v]) => {
    store[uKey(k)] = typeof v === 'string' ? v : JSON.stringify(v);
  });
  Object.entries(data.bg250 || {}).forEach(([k, v]) => {
    store[uKey(k)] = String(v);
  });
  return true;
}

async function loadPublishedCanonSnapshot() {
  if (!shouldLoadPublishedCanonSnapshot()) return false;
  try {
    const res = await fetch(CANON_SNAPSHOT_URL, { cache: 'no-cache' });
    if (!res.ok) return false;
    const data = await res.json();
    const ok = applyCanonSnapshotToMemory(data);
    if (ok) {
      canonSnapshotInfo = { exportedAt: data.exportedAt, date: data.universe?.currentTourDateStr };
    }
    return ok;
  } catch (err) {
    console.warn('Canon snapshot load failed:', err);
    return false;
  }
}

// --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ТУРА ---
let currentTourYear = 2024;
let currentTourDateStr = '2024-01-02';
let activeTourneyId = 'm_1';
let viewingYear = 2024;

let tournaments = null;
let players = [];
let seasonsHistory = {};
let retiredLegends = [];

let activeTourney = null;
let currentDraw = [];
let activeRoundIdx = 0;
let activeMatchScore = null;
let pendingAiNarrative = '';
let pendingWinnerQuote = '';
let pendingLoserQuote = '';
let pendingAiSourceLabel = '';
let includeMatchCommentaryMode = true;
try {
  if (typeof localStorage !== 'undefined') {
    const savedMode = localStorage.getItem('meta_include_match_comments_v1');
    if (savedMode === 'false') includeMatchCommentaryMode = false;
  }
} catch {
  includeMatchCommentaryMode = true;
}
let activeProfilePlayerId = null;
let activeSnapshotKey = 'yearEnd';
let activeCompareMode = 'prev'; // 'prev' | 'start'
let activeHallSubtab = 'archive';
let toastTimeout = null;

export function showToast(messageHtml, durationMs = 4200) {
  const banner = document.getElementById('toastBanner');
  if (!banner) return;
  banner.innerHTML = messageHtml;
  banner.style.display = 'block';
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    banner.style.display = 'none';
  }, durationMs);
}

// --- 1. ИНИЦИАЛИЗАЦИЯ И СОХРАНЕНИЕ ДАННЫХ ВСЕЛЕННОЙ ---
function loadUniverseStateFromStorage() {
  currentTourYear = parseInt(universeStorage.getItem('meta_tour_year'), 10) || 2024;
  currentTourDateStr = universeStorage.getItem('meta_tour_date') || `${currentTourYear}-01-02`;
  activeTourneyId = universeStorage.getItem('meta_active_tourney') || 'm_1';
  viewingYear = currentTourYear;

  try {
    tournaments = JSON.parse(universeStorage.getItem('meta_tournaments')) || null;
  } catch {
    tournaments = null;
  }
  try {
    players = JSON.parse(universeStorage.getItem('meta_players')) || [];
  } catch {
    players = [];
  }
  try {
    seasonsHistory = JSON.parse(universeStorage.getItem('meta_seasons_history')) || {};
  } catch {
    seasonsHistory = {};
  }
  try {
    retiredLegends = JSON.parse(universeStorage.getItem('meta_retired_legends')) || [];
  } catch {
    retiredLegends = [];
  }
}

const CUSTOM_PLAYER_OVERRIDES_KEY = 'meta_custom_player_overrides_v1';

let serverPlayerOverridesCache = {};

function loadCustomPlayerOverrides() {
  const merged = { ...serverPlayerOverridesCache };
  try {
    if (typeof localStorage !== 'undefined') {
      const globalRaw = localStorage.getItem(`${CUSTOM_PLAYER_OVERRIDES_KEY}_${activeUniverseId}`);
      if (globalRaw) Object.assign(merged, JSON.parse(globalRaw));
    }
  } catch {
    // ignore
  }
  try {
    const univRaw = universeStorage.getItem(CUSTOM_PLAYER_OVERRIDES_KEY);
    if (univRaw) Object.assign(merged, JSON.parse(univRaw));
  } catch {
    // ignore
  }
  return merged;
}

function pushOverridesToLocalServer(overridesMap) {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const host = String(window.location.hostname || '').toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1') return;
    fetch('/api/player-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overridesMap || {})
    }).catch(() => {});
  } catch {
    // ignore
  }
}

async function fetchOverridesFromLocalServer() {
  try {
    if (typeof window === 'undefined' || !window.location) return;
    const host = String(window.location.hostname || '').toLowerCase();
    if (host !== 'localhost' && host !== '127.0.0.1') return;
    const res = await fetch('/api/player-overrides', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        serverPlayerOverridesCache = data;
      }
    }
  } catch {
    // ignore
  }
}

function saveCustomPlayerOverridesMap(overridesMap) {
  serverPlayerOverridesCache = { ...serverPlayerOverridesCache, ...(overridesMap || {}) };
  const json = JSON.stringify(serverPlayerOverridesCache);
  try {
    universeStorage.setItem(CUSTOM_PLAYER_OVERRIDES_KEY, json);
  } catch {
    // ignore
  }
  try {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(`${CUSTOM_PLAYER_OVERRIDES_KEY}_${activeUniverseId}`, json);
      } catch {
        runStorageGarbageCollector();
        localStorage.setItem(`${CUSTOM_PLAYER_OVERRIDES_KEY}_${activeUniverseId}`, json);
      }
    }
  } catch {
    // ignore
  }
  pushOverridesToLocalServer(serverPlayerOverridesCache);
}

function recordCustomPlayerOverride(player, canonicalName = null) {
  if (!player) return;
  const overrides = loadCustomPlayerOverrides();
  const payload = {
    name: player.name,
    flag: player.flag,
    birthDate: player.birthDate,
    nickname: player.nickname || '',
    playStyle: player.playStyle || ''
  };
  if (player.id) overrides[`id:${player.id}`] = payload;
  const normName = String(canonicalName || player.name || '').trim().toLowerCase();
  if (normName) overrides[`name:${normName}`] = payload;
  saveCustomPlayerOverridesMap(overrides);
}

function propagatePlayerIdentityUpdate(updatedPlayer, oldNameLower = '') {
  if (!updatedPlayer) return;
  const currentUnivMeta = (universesList || []).find(u => u.id === activeUniverseId);
  const universeStartYear = activeUniverseId === '1' ? 2024 : (currentUnivMeta?.startYear || 2024);
  const targetId = String(updatedPlayer.id);
  const targetNameLower = String(updatedPlayer.name || '').trim().toLowerCase();

  const matchesPlayerRef = (ref) => {
    if (!ref) return false;
    if (ref.id !== undefined && String(ref.id) === targetId) return true;
    const rn = String(ref.name || '').trim().toLowerCase();
    return Boolean(rn && (rn === targetNameLower || (oldNameLower && rn === oldNameLower)));
  };

  const patchRef = (ref) => {
    if (!matchesPlayerRef(ref)) return false;
    let changed = false;
    if (ref.name !== updatedPlayer.name) { ref.name = updatedPlayer.name; changed = true; }
    if (ref.flag !== updatedPlayer.flag) { ref.flag = updatedPlayer.flag; changed = true; }
    if (updatedPlayer.birthDate && ref.birthDate !== updatedPlayer.birthDate) { ref.birthDate = updatedPlayer.birthDate; changed = true; }
    return changed;
  };

  // 1) Текущая открытая сетка в памяти
  if (Array.isArray(currentDraw)) {
    currentDraw.forEach(round => {
      if (!Array.isArray(round)) return;
      round.forEach(m => {
        if (!m) return;
        patchRef(m.p1);
        patchRef(m.p2);
        patchRef(m.winner);
      });
    });
  }

  // 2) Все сохраненные сетки в universeStorage
  const allTourneyTemplates = [...FULL_CALENDAR_TEMPLATE];
  if (!allTourneyTemplates.some(t => t.id === 'olympics')) {
    allTourneyTemplates.push(OLYMPIC_TOURNAMENT_TEMPLATE);
  }
  const maxYear = Math.max(universeStartYear, currentTourYear || universeStartYear);
  const minYear = Math.min(2023, universeStartYear - 1);
  for (let yr = minYear; yr <= maxYear; yr++) {
    allTourneyTemplates.forEach(t => {
      const draw = readSavedDraw(t.id, yr);
      if (!draw || !Array.isArray(draw) || draw.length === 0) return;
      let drawChanged = false;
      draw.forEach(round => {
        if (!Array.isArray(round)) return;
        round.forEach(m => {
          if (!m) return;
          if (patchRef(m.p1)) drawChanged = true;
          if (patchRef(m.p2)) drawChanged = true;
          if (patchRef(m.winner)) drawChanged = true;
        });
      });
      if (drawChanged) {
        universeStorage.setItem(`draw_${t.id}_${yr}`, JSON.stringify(draw));
      }
    });
  }

  // 3) Чемпионы и призеры в списке турниров
  let tourneysChanged = false;
  (tournaments || []).forEach(t => {
    if (!t) return;
    if (patchRef(t.lastWinner)) tourneysChanged = true;
    if (patchRef(t.lastRunnerUp)) tourneysChanged = true;
    if (patchRef(t.lastBronze)) tourneysChanged = true;
  });
  if (tourneysChanged) saveTournaments();

  // 4) Архив сезонов и срезы Топ-50
  let historyChanged = false;
  Object.values(seasonsHistory || {}).forEach(sec => {
    if (!sec) return;
    if (patchRef(sec.worldNumberOne)) historyChanged = true;
    (sec.seasonStartTop50 || []).forEach(item => { if (patchRef(item)) historyChanged = true; });
    (sec.yearEndTop50 || []).forEach(item => { if (patchRef(item)) historyChanged = true; });
    Object.values(sec.slamSnapshots || {}).forEach(snap => {
      (snap?.top50 || []).forEach(item => { if (patchRef(item)) historyChanged = true; });
    });
    (sec.tournamentsData || []).forEach(td => {
      if (patchRef(td?.winner)) historyChanged = true;
      if (patchRef(td?.runnerUp)) historyChanged = true;
      if (patchRef(td?.bronze)) historyChanged = true;
    });
  });
  if (historyChanged) saveHistory();
}

function repairCanonicalPlayersAndDraws() {
  const canonicalRoster = buildInitial300Players();
  const canonByName = new Map();
  const canonById = new Map();
  canonicalRoster.forEach(c => {
    canonByName.set(String(c.name || '').trim().toLowerCase(), c);
    canonById.set(String(c.id), c);
  });

  const customOverrides = loadCustomPlayerOverrides();
  let overridesModified = false;

  const resolvePlayerFields = (source, canon) => {
    const normName = String((source && source.name) || canon.name || '').trim().toLowerCase();
    const canonNormName = String(canon.name || '').trim().toLowerCase();
    const ov = {
      ...(customOverrides[`name:${canonNormName}`] || {}),
      ...(customOverrides[`name:${normName}`] || {}),
      ...(customOverrides[`id:${canon.id}`] || {})
    };
    const resolvedFlag = (ov.flag && ov.flag !== '?')
      ? ov.flag
      : ((source.flag && source.flag !== '?') ? source.flag : canon.flag);
    const resolvedName = (ov.name && !/\s+\d+$/.test(ov.name))
      ? ov.name
      : ((source.name && !/\s+\d+$/.test(source.name)) ? source.name : canon.name);
    const resolvedBirth = ov.birthDate || source.birthDate || canon.birthDate;
    const resolvedNick = ov.nickname !== undefined ? ov.nickname : (source.nickname || '');
    const resolvedStyle = ov.playStyle !== undefined ? ov.playStyle : (source.playStyle || '');

    if (resolvedFlag && resolvedFlag !== '?' && resolvedFlag !== canon.flag && !ov.flag) {
      const entry = {
        name: resolvedName,
        flag: resolvedFlag,
        birthDate: resolvedBirth,
        nickname: resolvedNick,
        playStyle: resolvedStyle
      };
      customOverrides[`id:${canon.id}`] = entry;
      customOverrides[`name:${ String(resolvedName).trim().toLowerCase() }`] = entry;
      overridesModified = true;
    }

    return {
      ...source,
      id: canon.id,
      name: resolvedName,
      flag: resolvedFlag,
      birthDate: resolvedBirth,
      nickname: resolvedNick,
      playStyle: resolvedStyle,
      basePoints: source.basePoints || canon.basePoints,
      start2023Points: source.start2023Points || canon.start2023Points
    };
  };

  const newgensAndCustom = (players || []).filter(p => p && (p.isNewgen || p.isProcedural));
  const byIdMap = new Map();
  const byNameBest = new Map();

  (players || []).forEach(p => {
    if (!p || p.isNewgen || p.isProcedural) return;
    if (p.id) byIdMap.set(String(p.id), p);
    const normName = String(p.name || '').trim().toLowerCase();
    const existing = byNameBest.get(normName);
    if (!existing || (p.points || 0) > (existing.points || 0)) {
      byNameBest.set(normName, p);
    }
  });

  const repairedPlayers = [];
  const usedIds = new Set();

  const currentUnivMeta = (universesList || []).find(u => u.id === activeUniverseId);
  const universeStartYear = activeUniverseId === '1' ? 2024 : (currentUnivMeta?.startYear || 2024);

  if (currentTourYear <= universeStartYear && newgensAndCustom.length === 0) {
    canonicalRoster.forEach(canon => {
      const normName = String(canon.name || '').trim().toLowerCase();
      const source = byIdMap.get(String(canon.id)) || byNameBest.get(normName) || canon;
      repairedPlayers.push(resolvePlayerFields(source, canon));
      usedIds.add(String(canon.id));
    });
  } else {
    (players || []).forEach(p => {
      if (!p) return;
      if (p.isNewgen || p.isProcedural) {
        repairedPlayers.push(p);
        usedIds.add(String(p.id));
        return;
      }
      const canon = canonById.get(String(p.id)) || canonByName.get(String(p.name || '').trim().toLowerCase());
      if (canon && !usedIds.has(String(canon.id))) {
        const bestSource = byIdMap.get(String(canon.id)) || p;
        repairedPlayers.push(resolvePlayerFields(bestSource, canon));
        usedIds.add(String(canon.id));
      } else if (!usedIds.has(String(p.id))) {
        repairedPlayers.push(p);
        usedIds.add(String(p.id));
      }
    });
    canonicalRoster.forEach(canon => {
      if (!usedIds.has(String(canon.id)) && repairedPlayers.length < 300) {
        repairedPlayers.push(resolvePlayerFields(canon, canon));
        usedIds.add(String(canon.id));
      }
    });
  }

  players = repairedPlayers;
  const liveById = new Map(players.map(p => [String(p.id), p]));
  const liveByName = new Map(players.map(p => [String(p.name || '').trim().toLowerCase(), p]));

  // 2) Ремонтируем все сохраненные сетки (2023..currentTourYear): синхронизируем ID и флаги из актуального состава (не затирая страны на '?')
  const allTourneyTemplates = [...FULL_CALENDAR_TEMPLATE];
  if (!allTourneyTemplates.some(t => t.id === 'olympics')) {
    allTourneyTemplates.push(OLYMPIC_TOURNAMENT_TEMPLATE);
  }
  const maxYear = Math.max(universeStartYear, currentTourYear || universeStartYear);
  const minYear = Math.min(2023, universeStartYear - 1);
  for (let yr = minYear; yr <= maxYear; yr++) {
    allTourneyTemplates.forEach(t => {
      const draw = readSavedDraw(t.id, yr);
      if (!draw || !Array.isArray(draw) || draw.length === 0) return;
      let drawChanged = false;
      const tourneyStamina = new Map();

      draw.forEach(round => {
        if (!Array.isArray(round)) return;
        round.forEach(m => {
          if (!m) return;
          ['p1', 'p2', 'winner'].forEach(slot => {
            const ref = m[slot];
            if (!ref || !ref.name) return;
            const normRefName = String(ref.name).trim().toLowerCase();
            const liveP = liveByName.get(normRefName) || (canonByName.has(normRefName) ? liveById.get(String(canonByName.get(normRefName).id)) : null);
            if (liveP) {
              // Если в сетке была указана страна, а у игрока стоял '?', восстанавливаем страну из сетки
              if ((!liveP.flag || liveP.flag === '?') && ref.flag && ref.flag !== '?') {
                liveP.flag = ref.flag;
                customOverrides[`id:${liveP.id}`] = { ...(customOverrides[`id:${liveP.id}`] || {}), name: liveP.name, flag: liveP.flag, birthDate: liveP.birthDate };
                overridesModified = true;
              }
              const targetFlag = (liveP.flag && liveP.flag !== '?') ? liveP.flag : (ref.flag || liveP.flag);
              if (ref.id !== liveP.id || ref.flag !== targetFlag || ref.birthDate !== liveP.birthDate) {
                ref.id = liveP.id;
                ref.flag = targetFlag;
                ref.birthDate = liveP.birthDate;
                drawChanged = true;
              }
            } else if (/\s+\d+$/.test(String(ref.name)) && liveById.has(String(ref.id))) {
              const liveIdObj = liveById.get(String(ref.id));
              ref.name = liveIdObj.name;
              ref.flag = liveIdObj.flag;
              ref.birthDate = liveIdObj.birthDate;
              drawChanged = true;
            }
          });

          if (m.p1 && m.p2 && m.winner && Array.isArray(m.score) && m.score.length > 0) {
            const k1 = String(m.p1.id || m.p1.name);
            const k2 = String(m.p2.id || m.p2.name);
            const prevS1 = tourneyStamina.has(k1) ? tourneyStamina.get(k1) : 100;
            const prevS2 = tourneyStamina.has(k2) ? tourneyStamina.get(k2) : 100;
            const drain = calculateMatchStaminaCost(m.score, t.bestOf || 3);
            const nextS1 = Math.max(18, Math.round(prevS1 - drain));
            const nextS2 = Math.max(18, Math.round(prevS2 - drain));
            tourneyStamina.set(k1, nextS1);
            tourneyStamina.set(k2, nextS2);

            if (typeof m.p1.stamina !== 'number' || m.p1.stamina === 100) {
              m.p1.stamina = nextS1;
              drawChanged = true;
            }
            if (typeof m.p2.stamina !== 'number' || m.p2.stamina === 100) {
              m.p2.stamina = nextS2;
              drawChanged = true;
            }
          }
        });
      });

      if (drawChanged) {
        const jsonStr = JSON.stringify(draw);
        universeStorage.setItem(`draw_${t.id}_${yr}`, jsonStr);
      }
    });
  }

  saveCustomPlayerOverridesMap(customOverrides);
}

export function initData() {
  loadUniversesRegistry();
  loadUniverseStateFromStorage();

  const currentUnivMeta = universesList.find(u => u.id === activeUniverseId);
  const isCanonUniverse = activeUniverseId === '1' || Boolean(currentUnivMeta?.isCanon);
  const isCustomRandomUniverse = Boolean(currentUnivMeta?.rosterMode === 'random');

  // Формируем календарь с учетом олимпийского цикла (в 2024/2028 — с Олимпиадой, в 2023/2025 — без)
  const expectedSeasonList = getSeasonTournaments(currentTourYear, tournaments);
  if (!tournaments || tournaments.length < 26) {
    tournaments = expectedSeasonList.map(t => ({ ...t }));
    saveTournaments();
  } else {
    tournaments = getSeasonTournaments(currentTourYear, tournaments);
    saveTournaments();
  }

  // В канонической Вселенной Автора на 2024 год гарантируем 26 завершенных турниров (включая Океанский шлем #20 и Хельсинки #26)
  if (isCanonUniverse && currentTourYear === 2024) {
    const completedCount = tournaments ? tournaments.filter(t => t && t.completed).length : 0;
    if (completedCount < 26 && CANON_MASTER_SNAPSHOT && Array.isArray(CANON_MASTER_SNAPSHOT.tournaments)) {
      tournaments = JSON.parse(JSON.stringify(CANON_MASTER_SNAPSHOT.tournaments));
      saveTournaments();
    }
  }

  if (!players || players.length < 300) {
    players = isCustomRandomUniverse
      ? generateRandom300Players(currentTourYear)
      : buildInitial300Players();
  } else if (!isCustomRandomUniverse) {
    repairCanonicalPlayersAndDraws();
  }

  players.forEach((p, idx) => {
    if (!p.tournamentPoints) p.tournamentPoints = {};
    if (p.rankChange === undefined) p.rankChange = 0;
    if (p.racePoints === undefined) p.racePoints = 0;
    const normFlag = normalizeCountryCode(p.flag);
    if (!normFlag || normFlag === '?') {
      p.flag = PROCEDURAL_FLAGS[idx % PROCEDURAL_FLAGS.length];
    } else {
      p.flag = normFlag;
    }
    const histPeak = HISTORICAL_PEAK_RANK_BY_NAME[String(p.name || '').toLowerCase()];
    if (histPeak !== undefined) {
      if (!p.bestRank || p.bestRank > histPeak) {
        p.bestRank = histPeak;
      } else if (p.bestRank === 1 && histPeak > 1 && (p.seasonStartRank || 999) >= histPeak && (p.rank || 999) >= histPeak) {
        p.bestRank = histPeak;
      }
    } else if (!p.bestRank) {
      p.bestRank = p.rank || (idx + 1);
    }
    if (p.seasonsPlayed === undefined) p.seasonsPlayed = 1;
    if (!p.seasonStartRank) p.seasonStartRank = p.rank || (idx + 1);
    if (!p.medals) p.medals = { gold: 0, silver: 0, bronze: 0 };
    if (typeof p.stamina !== 'number' || Number.isNaN(p.stamina)) p.stamina = 100;
    if (p.isNewgen && !p.nickname) {
      p.nickname = NEWGEN_NICKNAMES[idx % NEWGEN_NICKNAMES.length];
    }
    if (p.isNewgen && !p.playStyle) {
      p.playStyle = NEWGEN_PLAY_STYLES[idx % NEWGEN_PLAY_STYLES.length];
    }
  });

  if (isCanonUniverse || !isCustomRandomUniverse) {
    // 1) Гарантируем истинный архив 2023 года: World #1 GEO Max Kyupan (12 300 pts), Топ-10 и чемпионы 2023
    const archive2023Updated = ensureDefault2023SeasonArchive(tournaments, players, seasonsHistory, universeStorage);

    if (archive2023Updated) {
      repairCanonicalPlayersAndDraws();
      saveHistory();
    }

    backfill2023HistoryFromDraws();
    repairOvercountedPoints();
  } else {
    // Для процедурно сгенерированной пользовательской вселенной: чистый старт сезона
    if (!universeStorage.getItem('meta_custom_world_initialized_v1')) {
      tournaments.forEach(t => {
        t.completed = false;
        delete t.lastWinner;
        delete t.lastRunnerUp;
        delete t.lastBronze;
        delete t.lastScore;
        universeStorage.removeItem(`draw_${t.id}_${currentTourYear}`);
      });
      players.forEach(p => {
        p.racePoints = 0;
        p.rankChange = 0;
      });
      sortAndRankPlayers(players, false);
      currentTourDateStr = `${currentTourYear}-01-02`;
      activeTourneyId = 'm_1';
      universeStorage.setItem('meta_custom_world_initialized_v1', 'true');
      saveTournaments();
      saveDate();
    }
  }

  savePlayers(false);
  ensureInitialSeasonCheckpoint();

  // Синхронизируем историю сезонов с реальными турнирными сетками
  const syncYears = new Set([
    ...Object.keys(seasonsHistory || {}).map(Number),
    2023,
    2024,
    Number(currentTourYear)
  ]);
  syncYears.forEach(yr => {
    if (yr && !isNaN(yr)) {
      syncSeasonHistoryWithActualDraws(yr);
    }
  });
}

export function resetCurrentSeasonToCleanJanuary() {
  if (guardCanonReadOnly()) return;

  // Честный сброс ТЕКУЩЕГО сезона (год currentTourYear НЕ МЕНЯЕТСЯ):
  viewingYear = currentTourYear;
  tournaments = getSeasonTournaments(currentTourYear, FULL_CALENDAR_TEMPLATE).map(t => ({
    ...t,
    completed: false,
    lastWinner: null,
    lastRunnerUp: null,
    lastBronze: null,
    lastScore: null
  }));

  // Очищаются сетки и данные ТОЛЬКО текущего года
  tournaments.forEach(t => {
    universeStorage.removeItem(`draw_${t.id}_${currentTourYear}`);
    universeStorage.removeItem(`withdrawals_${t.id}_${currentTourYear}`);
    universeStorage.removeItem(`bg250_${t.id}_${currentTourYear}`);
  });

  // Очищаем турнирные очки сбрасываемого года у всех игроков:
  players.forEach(p => {
    if (p.tournamentPoints) {
      tournaments.forEach(t => {
        if (p.tournamentPoints[t.id]) {
          delete p.tournamentPoints[t.id][currentTourYear];
        }
      });
    }
  });

  // Очки гонки сбрасываются в 0, очки рейтинга фиксируются по защите текущего года
  syncPlayers52WeekDiagnostics(players, tournaments, currentTourYear);
  players.forEach(p => {
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

  sortAndRankPlayers(players, false);
  players.forEach(p => {
    p.seasonStartRank = p.rank;
  });

  currentTourDateStr = `${currentTourYear}-01-02`;
  activeTourney = tournaments[0];
  activeTourneyId = activeTourney ? activeTourney.id : 'm_1';

  if (typeof window !== 'undefined') {
    window._preSimSnapshot = null;
  }
  universeStorage.removeItem('meta_pre_sim_snapshot_v1');
  universeStorage.removeItem('meta_test_sim_report_v1');

  savePlayers(false);
  saveTournaments();
  saveHistory();
  saveDate();
  saveSeasonCheckpoint(`cp_start_${currentTourYear}`, `Старт сезона ${currentTourYear} (02.01.${currentTourYear})`);
  initUI();
  renderPlayersTable();
  renderRaceTable();
  renderCalendarTable();
  showToast(`🔄 <b>Сезон ${currentTourYear} сброшен на 02.01.${currentTourYear}!</b> Сетки очищены, очки зафиксированы по защите.`);
}

export function hardResetUniverseTo2024() {
  if (guardCanonReadOnly()) return;
  if (typeof window !== 'undefined' && !window.confirm('ВНИМАНИЕ! Это действие выполнит полный заводской сброс всей Вселенной к начальному 2024 году. Все последующие сезоны будут стерты. Продолжить?')) {
    return;
  }

  currentTourYear = 2024;
  viewingYear = 2024;
  tournaments = getSeasonTournaments(2024, FULL_CALENDAR_TEMPLATE);
  ensureDefault2023SeasonArchive(tournaments, players, seasonsHistory, universeStorage);
  ensureCleanJanuary2024StartState(tournaments, players, seasonsHistory, universeStorage);
  backfill2023HistoryFromDraws();
  repairOvercountedPoints();
  currentTourDateStr = '2024-01-02';
  activeTourneyId = 'm_1';
  activeTourney = tournaments[0];
  universeStorage.setItem('meta_jan2024_clean_start_v2', 'true');

  if (typeof window !== 'undefined') {
    window._preSimSnapshot = null;
  }
  universeStorage.removeItem('meta_pre_sim_snapshot_v1');
  universeStorage.removeItem('meta_test_sim_report_v1');

  savePlayers(false);
  saveTournaments();
  saveHistory();
  saveDate();
  saveSeasonCheckpoint(`cp_start_2024`, `Старт сезона 2024 (02.01.2024)`);
  initUI();
  renderPlayersTable();
  renderRaceTable();
  renderCalendarTable();
  showToast('⚠️ <b>Вселенная полностью сброшена к исходному канону 02.01.2024!</b>');
}

function recordPoints(playerId, tourneyId, year, pts) {
  const p = players.find(x => String(x.id) === String(playerId));
  if (p) {
    if (!p.tournamentPoints) p.tournamentPoints = {};
    if (!p.tournamentPoints[tourneyId]) p.tournamentPoints[tourneyId] = {};
    p.tournamentPoints[tourneyId][year] = pts;
  }
}

function backfill2023HistoryFromDraws(resetLivePoints = false) {
  const tourneys2023 = getSeasonTournaments(2023, tournaments);
  populateAndCalibrate2023TournamentPoints(
    players,
    tourneys2023,
    (tId) => readSavedDraw(tId, 2023),
    HISTORICAL_2023_FINALS,
    { resetLivePoints }
  );
}

function repairOvercountedPoints() {
  const exactRaceEarned = {};
  const exactFinalsEarned = {};
  players.forEach(p => {
    exactRaceEarned[p.id] = 0;
    exactFinalsEarned[p.id] = 0;
  });

  const seasonTourneys = getSeasonTournaments(currentTourYear, tournaments);
  seasonTourneys.forEach((t, idx) => {
    if (!t.completed) {
      players.forEach(p => {
        if (p.tournamentPoints && p.tournamentPoints[t.id]) {
          delete p.tournamentPoints[t.id][currentTourYear];
        }
      });
      return;
    }

    const isFinals = t.id === 'finals' || t.type === 'Итоговый';
    const isOlympics = t.id === 'olympics' || t.type === 'Олимпиада';
    const drawCurr = readSavedDraw(t.id, currentTourYear);

    if (drawCurr && drawCurr.length > 0) {
      const finalM = drawCurr[drawCurr.length - 1][0];
      if (finalM && finalM.winner) {
        const { earnedMap, participantsList } = calculateTournamentEarnedPoints(t, drawCurr);
        const inMainSet = new Set((participantsList || []).filter(p => p && p.id).map(p => p.id));

        // Если для этого завершенного турнира уже сохранены очки параллельного тура — НЕ перезатираем их, чтобы позиции игроков никогда не смещались!
        const hasSavedParallel = !isFinals && !isOlympics && players.filter(
          p => p && !inMainSet.has(p.id) && (p.tournamentPoints?.[t.id]?.[currentTourYear] || 0) > 0
        ).length >= 20;

        if (hasSavedParallel) {
          players.forEach(pObj => {
            if (!pObj || !pObj.id) return;
            let pts = 0;
            if (inMainSet.has(pObj.id)) {
              pts = earnedMap[pObj.id] || 0;
              recordPoints(pObj.id, t.id, currentTourYear, pts);
            } else {
              pts = pObj.tournamentPoints?.[t.id]?.[currentTourYear] || 0;
            }
            if (pts > 0) {
              if (isFinals) {
                exactFinalsEarned[pObj.id] = (exactFinalsEarned[pObj.id] || 0) + pts;
              } else {
                exactRaceEarned[pObj.id] = (exactRaceEarned[pObj.id] || 0) + pts;
              }
            }
          });
        } else {
          players.forEach(p => {
            if (p.tournamentPoints && p.tournamentPoints[t.id]) {
              delete p.tournamentPoints[t.id][currentTourYear];
            }
          });

          Object.entries(earnedMap).forEach(([pid, pts]) => {
            recordPoints(pid, t.id, currentTourYear, pts);
            const pObj = players.find(x => String(x.id) === String(pid));
            if (pObj) {
              if (isFinals) {
                exactFinalsEarned[pObj.id] = (exactFinalsEarned[pObj.id] || 0) + pts;
              } else {
                exactRaceEarned[pObj.id] = (exactRaceEarned[pObj.id] || 0) + pts;
              }
            }
          });

          if (!isFinals && !isOlympics) {
            const { parallelEarnedMap } = computeWeeklyParallelTourPoints(
              t,
              players,
              inMainSet,
              currentTourYear,
              { tourneyIndex: idx, mainEarnedMap: earnedMap }
            );
            Object.entries(parallelEarnedMap).forEach(([pid, pts]) => {
              if (pts > 0) {
                const pObj = players.find(x => String(x.id) === String(pid));
                const prevMainPts = pObj?.tournamentPoints?.[t.id]?.[currentTourYear] || 0;
                recordPoints(pid, t.id, currentTourYear, prevMainPts + pts);
                if (pObj) {
                  exactRaceEarned[pObj.id] = (exactRaceEarned[pObj.id] || 0) + pts;
                }
              }
            });
          }
        }
      }
    }
  });

  const currentUnivMeta = (universesList || []).find(u => u.id === activeUniverseId);
  const universeStartYear = activeUniverseId === '1' ? 2024 : (currentUnivMeta?.startYear || 2024);
  const { startRankMap, peakRankMap } = buildCanonical2023StartMap(players);
  const completedTourneys = seasonTourneys.filter(t => t.completed);
  const lastCompletedTourney = completedTourneys.length > 0 ? completedTourneys[completedTourneys.length - 1] : null;
  const ptsBeforeLastMap = {};
  const raceBeforeLastMap = {};

  players.forEach(p => {
    const raceEarned = exactRaceEarned[p.id] || 0;
    const finalsEarned = exactFinalsEarned[p.id] || 0;
    p.racePoints = raceEarned;
    p.finalsPoints = finalsEarned;

    let defendedSoFar = 0;
    let remainingDefending = 0;
    seasonTourneys.forEach(t => {
      const def = getDefendingPoints(p, t.id, currentTourYear);
      if (t.completed) {
        defendedSoFar += def;
      } else {
        remainingDefending += def;
      }
    });

    p.defendedSoFar = defendedSoFar;
    p.remainingDefending = remainingDefending;

    // Строгий математический инвариант 52 недель (0 виртуальных очков!):
    // Очки 52 нед. = Незащищённый остаток прошлого сезона + Очки Чемпионской Гонки + Очки Итогового турнира
    p.points = Math.max(0, remainingDefending + raceEarned + finalsEarned);

    if (lastCompletedTourney) {
      const earnedLast = Math.max(0, p.tournamentPoints?.[lastCompletedTourney.id]?.[currentTourYear] || 0);
      const defLast = Math.max(0, getDefendingPoints(p, lastCompletedTourney.id, currentTourYear));
      const ptsBeforeLast = Math.max(0, p.points - earnedLast + defLast);
      const raceEarnedLast = lastCompletedTourney.id === 'finals' ? 0 : earnedLast;
      ptsBeforeLastMap[p.id] = ptsBeforeLast;
      raceBeforeLastMap[p.id] = Math.max(0, raceEarned - raceEarnedLast);
      p.lastPointsDelta = p.points - ptsBeforeLast;
      p.lastRaceDelta = raceEarnedLast;
      p.lastTourneyEarned = earnedLast;
      p.lastTourneyDefended = defLast;
      p.lastTourneyName = lastCompletedTourney.name || '';
    } else {
      ptsBeforeLastMap[p.id] = p.points;
      raceBeforeLastMap[p.id] = 0;
      p.lastPointsDelta = 0;
      p.lastRaceDelta = 0;
      p.lastTourneyEarned = 0;
      p.lastTourneyDefended = 0;
      p.lastTourneyName = '';
      p.raceRankChange = 0;
    }

    if (!p.seasonStartRank) {
      if (currentTourYear === universeStartYear && startRankMap[p.id]) {
        p.seasonStartRank = startRankMap[p.id];
      } else {
        p.seasonStartRank = p.rank || 300;
      }
    }
    const histPeak = HISTORICAL_PEAK_RANK_BY_NAME[String(p.name || '').toLowerCase()];
    if (histPeak !== undefined) {
      if (!p.bestRank || p.bestRank > histPeak) {
        p.bestRank = histPeak;
      } else if (p.bestRank === 1 && histPeak > 1 && (p.seasonStartRank || 999) >= histPeak && (p.rank || 999) >= histPeak) {
        p.bestRank = histPeak;
      }
    } else if (peakRankMap[p.id]) {
      p.bestRank = Math.min(p.bestRank || 999, peakRankMap[p.id]);
    }
  });

  // Детерминированно вычисляем ранги до последнего завершенного турнира, чтобы rankChange и raceRankChange никогда не сбивались
  const getNumId = (id) => Number(String(id || '').replace(/\D+/g, '')) || 999999;
  const prevRankSorted = [...players].sort((a, b) => {
    if (Boolean(a.isCleanReplacement) !== Boolean(b.isCleanReplacement)) return a.isCleanReplacement ? 1 : -1;
    const diff = (ptsBeforeLastMap[b.id] || 0) - (ptsBeforeLastMap[a.id] || 0);
    if (diff !== 0) return diff;
    const rDiff = (raceBeforeLastMap[b.id] || 0) - (raceBeforeLastMap[a.id] || 0);
    if (rDiff !== 0) return rDiff;
    const bDiff = (b.start2023Points || b.basePoints || 0) - (a.start2023Points || a.basePoints || 0);
    if (bDiff !== 0) return bDiff;
    return getNumId(a.id) - getNumId(b.id);
  });
  const rankBeforeLastMap = {};
  prevRankSorted.forEach((p, idx) => { rankBeforeLastMap[p.id] = idx + 1; });

  sortAndRankPlayers(players, false);

  if (lastCompletedTourney) {
    players.forEach(p => {
      p.rankChange = p.isCleanReplacement ? 0 : ((rankBeforeLastMap[p.id] || p.rank) - p.rank);
    });
    if (completedTourneys.length > 1) {
      const prevRaceSorted = [...players].sort((a, b) => {
        if (Boolean(a.isCleanReplacement) !== Boolean(b.isCleanReplacement)) return a.isCleanReplacement ? 1 : -1;
        const diff = (raceBeforeLastMap[b.id] || 0) - (raceBeforeLastMap[a.id] || 0);
        if (diff !== 0) return diff;
        return (rankBeforeLastMap[a.id] || 300) - (rankBeforeLastMap[b.id] || 300);
      });
      const prevRaceRankMap = {};
      prevRaceSorted.forEach((p, idx) => { prevRaceRankMap[p.id] = idx + 1; });

      const currRaceSorted = [...players].sort((a, b) => {
        if (Boolean(a.isCleanReplacement) !== Boolean(b.isCleanReplacement)) return a.isCleanReplacement ? 1 : -1;
        const diff = (b.racePoints || 0) - (a.racePoints || 0);
        if (diff !== 0) return diff;
        return (a.rank || 300) - (b.rank || 300);
      });
      currRaceSorted.forEach((p, idx) => {
        const newRaceRank = idx + 1;
        p.raceRankChange = p.isCleanReplacement ? 0 : ((prevRaceRankMap[p.id] || newRaceRank) - newRaceRank);
      });
    } else {
      players.forEach(p => { p.raceRankChange = 0; });
    }
  } else {
    players.forEach(p => {
      p.rankChange = 0;
      p.raceRankChange = 0;
    });
  }

  universeStorage.setItem('meta_players_v8', JSON.stringify(players));
}

export function manualRepairPoints() {
  if (guardCanonReadOnly()) return;
  const currentUnivMeta = universesList.find(u => u.id === activeUniverseId);
  const isCustomRandomUniverse = Boolean(currentUnivMeta?.rosterMode === 'random');
  if (!isCustomRandomUniverse) {
    repairCanonicalPlayersAndDraws();
    backfill2023HistoryFromDraws(false);
  }
  repairOvercountedPoints();
  initUI();
  renderPlayersTable();
  renderRaceTable();
  showToast('✅ Очки всех игроков синхронизированы строго по завершенным сеткам текущего сезона (без задвоений).');
}

function savePlayers(updateRankChange = false) {
  sortAndRankPlayers(players, updateRankChange);
  universeStorage.setItem('meta_players', JSON.stringify(players));
}

function saveTournaments() {
  universeStorage.setItem('meta_tournaments', JSON.stringify(tournaments));
}

function saveHistory() {
  universeStorage.setItem('meta_seasons_history', JSON.stringify(seasonsHistory));
}

function saveRetiredLegends() {
  universeStorage.setItem('meta_retired_legends', JSON.stringify(retiredLegends));
}

function saveDate() {
  universeStorage.setItem('meta_tour_year', String(currentTourYear));
  universeStorage.setItem('meta_tour_date', currentTourDateStr);
  if (activeTourney) {
    universeStorage.setItem('meta_active_tourney', activeTourney.id);
  }
  saveUniversesRegistry();
}

function compactPlayerRefForDraw(p) {
  if (!p) return null;
  const ref = {
    id: p.id,
    name: p.name,
    flag: p.flag,
    rank: p.rank,
    birthDate: p.birthDate
  };
  if (typeof p.stamina === 'number' && !Number.isNaN(p.stamina)) ref.stamina = Math.round(p.stamina);
  if (p.seedNum) ref.seedNum = p.seedNum;
  if (p.entryTag) ref.entryTag = p.entryTag;
  if (p.nickname) ref.nickname = p.nickname;
  if (p.playStyle) ref.playStyle = p.playStyle;
  return ref;
}

function readSavedDraw(tourneyId, year) {
  if (!tourneyId || !year) return [];
  const drawKey = `draw_${tourneyId}_${year}`;
  const hasCompletedWinner = (d) => Array.isArray(d) && d.length > 0 && d.some(r => Array.isArray(r) && r.some(m => m && (m.winner || (Array.isArray(m.score) && m.score.length > 0))));

  try {
    const memKey = `draw_1_${tourneyId}_${year}`;
    if (memoryUniverseStore[memKey]) {
      try {
        const parsed = JSON.parse(memoryUniverseStore[memKey]);
        if (hasCompletedWinner(parsed)) return parsed;
      } catch {}
    }
    if (memoryUniverseStore[drawKey]) {
      try {
        const parsed = JSON.parse(memoryUniverseStore[drawKey]);
        if (hasCompletedWinner(parsed)) return parsed;
      } catch {}
    }

    const raw = universeStorage.getItem(drawKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (hasCompletedWinner(parsed)) {
          return parsed;
        }
      } catch {}
    }
    // ЖЕЛЕЗНЫЙ ФОЛЛБЭК: Если для канонической вселенной сетка отсутствует или не завершена — отдаем из CANON_MASTER_SNAPSHOT или RESTORED_2024_DRAWS
    if (String(activeUniverseId) === '1') {
      const fallbackDraw =
        (CANON_MASTER_SNAPSHOT?.draws && CANON_MASTER_SNAPSHOT.draws[drawKey]) ||
        (RESTORED_2024_DRAWS && RESTORED_2024_DRAWS[drawKey]);
      if (Array.isArray(fallbackDraw) && fallbackDraw.length > 0) {
        const str = JSON.stringify(fallbackDraw);
        memoryUniverseStore[memKey] = str;
        memoryUniverseStore[drawKey] = str;
        try { universeStorage.setItem(drawKey, str); } catch {}
        return fallbackDraw;
      }
    }
    if (memoryUniverseStore[memKey]) {
      try {
        const parsed = JSON.parse(memoryUniverseStore[memKey]);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {}
    }
    return [];
  } catch {
    return [];
  }
}

export function syncSeasonHistoryWithActualDraws(targetYear) {
  const y = Number(targetYear);
  if (!y || !seasonsHistory) return;
  const yrStr = String(y);
  if (!seasonsHistory[yrStr]) {
    seasonsHistory[yrStr] = { tournamentsData: [] };
  }
  if (!Array.isArray(seasonsHistory[yrStr].tournamentsData)) {
    seasonsHistory[yrStr].tournamentsData = [];
  }

  const seasonTourneys = getSeasonTournaments(y, tournaments);
  let changed = false;

  seasonTourneys.forEach(tmpl => {
    const liveT = (y === currentTourYear && Array.isArray(tournaments))
      ? tournaments.find(x => x && x.id === tmpl.id)
      : null;
    // В текущем сезоне не трогаем турнир, пока пользователь не нажал «Завершить турнир»
    if (y === currentTourYear && (!liveT || !liveT.completed)) return;

    const d = readSavedDraw(tmpl.id, y);
    if (!Array.isArray(d) || d.length === 0) return;

    const fm = d[d.length - 1]?.[0];
    if (!fm || !fm.winner || !fm.p1 || !fm.p2) return;

    const w = fm.winner;
    const ru = String(fm.p1.id) === String(w.id) ? fm.p2 : fm.p1;
    const scoreStr = Array.isArray(fm.score) && fm.score.length > 0 ? fm.score.join(' ') : (typeof fm.score === 'string' && fm.score ? fm.score : '6-4 6-4');
    const bronze = tmpl.id === 'olympics' ? (d[d.length - 1]?.[1]?.winner || null) : null;
    const isMajor = ['ТБШ', 'Мастерс', 'Итоговый', 'Олимпиада'].includes(tmpl.type);

    let histEntry = seasonsHistory[yrStr].tournamentsData.find(t => t && t.id === tmpl.id);
    if (!histEntry) {
      histEntry = {
        id: tmpl.id,
        name: tmpl.name,
        type: tmpl.type,
        surface: tmpl.surface,
        winner: w,
        runnerUp: ru,
        bronze: bronze,
        score: scoreStr,
        pressColumn: isMajor
          ? buildFallbackFinalPressColumn({
              tourneyName: tmpl.name,
              tourneyType: tmpl.type,
              surface: tmpl.surface,
              year: y,
              winner: w,
              runnerUp: ru,
              score: scoreStr
            })
          : null
      };
      seasonsHistory[yrStr].tournamentsData.push(histEntry);
      changed = true;
    } else {
      const winnerDiff = String(histEntry.winner?.id) !== String(w.id) || histEntry.winner?.name !== w.name;
      const ruDiff = String(histEntry.runnerUp?.id) !== String(ru.id) || histEntry.runnerUp?.name !== ru.name;
      const scoreDiff = histEntry.score !== scoreStr;
      const bronzeDiff = tmpl.id === 'olympics' && String(histEntry.bronze?.id) !== String(bronze?.id);
      const pressMissingOrMismatched = isMajor && (
        !histEntry.pressColumn ||
        (histEntry.pressColumn.headline && w.name && !histEntry.pressColumn.headline.includes(w.name) && !histEntry.pressColumn.article?.includes(w.name))
      );

      if (winnerDiff || ruDiff || scoreDiff || bronzeDiff || pressMissingOrMismatched) {
        histEntry.winner = w;
        histEntry.runnerUp = ru;
        histEntry.score = scoreStr;
        histEntry.bronze = bronze;
        if (isMajor) {
          histEntry.pressColumn = buildFallbackFinalPressColumn({
            tourneyName: tmpl.name,
            tourneyType: tmpl.type,
            surface: tmpl.surface,
            year: y,
            winner: w,
            runnerUp: ru,
            score: scoreStr
          });
        }
        changed = true;
      }
    }

    if (y === currentTourYear && liveT && liveT.completed) {
      liveT.lastWinner = w;
      liveT.lastRunnerUp = ru;
      liveT.lastScore = scoreStr;
      if (tmpl.id === 'olympics') liveT.lastBronze = bronze;
      tmpl.lastWinner = w;
      tmpl.lastRunnerUp = ru;
      tmpl.lastScore = scoreStr;
      if (tmpl.id === 'olympics') tmpl.lastBronze = bronze;
    }
  });

  if (changed) {
    saveHistory();
    if (y === currentTourYear) {
      saveTournaments();
    }
  }
}
if (typeof window !== 'undefined') {
  window.syncSeasonHistoryWithActualDraws = syncSeasonHistoryWithActualDraws;
}

function saveDraw() {
  if (!activeTourney) return;
  // Не затираем сохраненную сетку пустым массивом (для удаления используется resetCurrentDraw)
  if (!Array.isArray(currentDraw) || currentDraw.length === 0) return;
  const compact = currentDraw.map(round =>
    Array.isArray(round)
      ? round.map(m => ({
          ...m,
          p1: compactPlayerRefForDraw(m.p1),
          p2: compactPlayerRefForDraw(m.p2),
          winner: compactPlayerRefForDraw(m.winner)
        }))
      : []
  );
  const jsonStr = JSON.stringify(compact);
  universeStorage.setItem(`draw_${activeTourney.id}_${viewingYear}`, jsonStr);
  if (typeof window !== 'undefined' && typeof window.syncLiveCanonSnapshotToLocalServer === 'function') {
    window.syncLiveCanonSnapshotToLocalServer();
  }
}

function formatDateDisplay(dateStr) {
  const parts = String(dateStr || '2024-01-02').split('-');
  const y = parseInt(parts[0], 10) || 2024;
  const m = (parseInt(parts[1], 10) || 1) - 1;
  const day = String(parseInt(parts[2], 10) || 2).padStart(2, '0');
  const months = ["Января", "Февраля", "Марта", "Апреля", "Мая", "Июня", "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"];
  return `${day} ${months[m] || 'Января'} ${y}`;
}

// --- РАЗДЕЛ 3: МУЛЬТИВСЕЛЕННЫЕ И СЛОТЫ МИРОВ (СОЗДАНИЕ, ПЕРЕКЛЮЧЕНИЕ, УДАЛЕНИЕ, ЭКСПОРТ/ИМПОРТ) ---
function renderUniverseSelector() {
  const sel = document.getElementById('universeSelect');
  if (!sel) return;
  // В выпадающем списке отображаются ТОЛЬКО созданные миры (без дублирующего пункта "+ Создать новую вселенную...")
  const opts = universesList.map(u => {
    const yr = u.id === activeUniverseId ? currentTourYear : (u.year || 2024);
    const labelName = u.id === '1' ? 'Вселенная Автора (Канон)' : `${u.name} 🗑️`;
    return `<option value="${u.id}" ${u.id === activeUniverseId ? 'selected' : ''}>${labelName} · ${yr}</option>`;
  }).join('');
  sel.innerHTML = opts;

  const delBtn = document.getElementById('btnDeleteUniverse');
  if (delBtn) {
    delBtn.style.display = activeUniverseId === '1' ? 'none' : 'inline-flex';
  }
}

export function openCreateUniverseModal() {
  const nameInput = document.getElementById('newUniverseNameInput');
  const yearSelect = document.getElementById('newUniverseYearSelect');
  const errEl = document.getElementById('createUniverseError');
  const nextNum = universesList.length + 1;
  if (nameInput) nameInput.value = `Вселенная #${nextNum}: Новая Эра`;
  if (yearSelect) yearSelect.value = '2024';
  if (errEl) errEl.style.display = 'none';

  const sel = document.getElementById('universeSelect');
  if (sel) sel.value = activeUniverseId;

  const modal = document.getElementById('createUniverseModal');
  if (modal) modal.classList.add('open');
  setTimeout(() => nameInput?.focus(), 60);
}

export function confirmCreateNewUniverse() {
  const nameInput = document.getElementById('newUniverseNameInput');
  const yearSelect = document.getElementById('newUniverseYearSelect');
  const rosterRadios = document.querySelectorAll('input[name="newUniverseRosterMode"]');
  const errEl = document.getElementById('createUniverseError');

  const rawName = String(nameInput?.value || '').trim();
  if (!rawName) {
    if (errEl) {
      errEl.innerText = '⚠️ Пожалуйста, введите название вашей новой вселенной.';
      errEl.style.display = 'block';
    }
    return;
  }

  const startYear = parseInt(yearSelect?.value, 10) || 2024;
  let rosterMode = 'random';
  rosterRadios.forEach(r => {
    if (r.checked) rosterMode = r.value;
  });

  const newId = String(Date.now());
  const newUniv = {
    id: newId,
    name: rawName,
    year: startYear,
    startYear: startYear,
    rosterMode,
    isCanon: false
  };

  // Если выбран режим копирования классического тура — берем эталонную базу 300 игроков канона с чистой гонкой (0 pts) на 02.01
  const existingOverrides = loadCustomPlayerOverrides();
  const clonedPlayers = (rosterMode === 'copy'
    ? buildInitial300Players()
    : generateRandom300Players(startYear)
  ).map((p, idx) => {
    const ov = rosterMode === 'copy'
      ? (existingOverrides[`id:${p.id}`] || existingOverrides[`name:${String(p.name || '').trim().toLowerCase()}`] || null)
      : null;
    const rawFlag = (ov?.flag && ov.flag !== '?') ? ov.flag : p.flag;
    const normFlag = normalizeCountryCode(rawFlag);
    return {
      ...p,
      flag: (!normFlag || normFlag === '?')
        ? PROCEDURAL_FLAGS[Math.floor(Math.random() * PROCEDURAL_FLAGS.length)]
        : normFlag
    };
  });

  universesList.push(newUniv);
  activeUniverseId = newId;
  currentTourYear = startYear;
  viewingYear = startYear;
  currentTourDateStr = `${startYear}-01-02`;
  activeTourneyId = 'm_1';

  tournaments = getSeasonTournaments(startYear, FULL_CALENDAR_TEMPLATE).map(t => ({
    ...t,
    completed: false
  }));
  players = clonedPlayers;
  seasonsHistory = {};
  retiredLegends = [];

  if (rosterMode === 'random') {
    universeStorage.setItem('meta_custom_world_initialized_v1', 'true');
  }
  savePlayers(false);
  saveTournaments();
  saveHistory();
  saveRetiredLegends();
  saveDate();
  saveUniversesRegistry();

  closeModal('createUniverseModal');
  initData();
  initUI();
  renderPlayersTable();
  renderRaceTable();
  renderCalendarTable();

  const modeDesc = rosterMode === 'random' ? '300 уникальных случайных игроков' : 'классический ростер 300 игроков тура';
  showToast(`🌌 Создана ваша вселенная <b>«${rawName}»</b> (Старт: 02.01.${startYear}, ${modeDesc}). Полное управление разблокировано!`);
}

export function promptDeleteCurrentUniverse() {
  if (activeUniverseId === '1') {
    showToast('⚠️ Каноническая «Вселенная Автора (Канон)» защищена от удаления.');
    return;
  }
  const curr = universesList.find(u => u.id === activeUniverseId);
  const msgEl = document.getElementById('deleteUniverseModalText');
  if (msgEl && curr) {
    msgEl.innerHTML = `Вы действительно хотите безвозвратно удалить мир <b>«${curr.name}»</b> и все его турнирные сетки? Каноническая Вселенная Автора останется нетронутой.`;
  }
  const modal = document.getElementById('deleteUniverseModal');
  if (modal) modal.classList.add('open');
}

export function confirmDeleteCurrentUniverse() {
  if (activeUniverseId === '1') return;
  const deletedId = activeUniverseId;
  const deletedUniv = universesList.find(u => u.id === deletedId);

  try {
    const prefix = `universe_${deletedId}_`;
    const drawPrefix = `draw_${deletedId}_`;
    Object.keys(memoryUniverseStore).forEach(k => {
      if (k.startsWith(prefix) || k.startsWith(drawPrefix)) {
        delete memoryUniverseStore[k];
      }
    });
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(prefix) || k.startsWith(drawPrefix))) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }

  universesList = universesList.filter(u => u.id !== deletedId);
  activeUniverseId = '1';
  saveUniversesRegistry();

  closeModal('deleteUniverseModal');
  initData();
  initUI();
  renderPlayersTable();
  renderRaceTable();
  renderCalendarTable();
  showToast(`🗑️ Вселенная <b>«${deletedUniv ? deletedUniv.name : deletedId}»</b> удалена. Вы вернулись во Вселенную Автора (Канон).`);
}

export function handleUniverseChange(val) {
  if (val === '__create_new__') {
    openCreateUniverseModal();
    return;
  }

  if (universesList.some(u => u.id === val)) {
    activeUniverseId = val;
    saveUniversesRegistry();
    initData();
    initUI();
    renderPlayersTable();
    renderRaceTable();
    renderCalendarTable();
    const currentU = universesList.find(u => u.id === val);
    showToast(`🌌 Переключено на мир: <b>${currentU ? currentU.name : val}</b>`);
  }
}

export function exportCurrentUniverse() {
  const drawsBackup = {};
  const withdrawalsBackup = {};
  const bg250Backup = {};

  for (let y = 2023; y <= currentTourYear + 1; y++) {
    const yearTourneys = getSeasonTournaments(y, tournaments);
    yearTourneys.forEach(t => {
      const d = universeStorage.getItem(`draw_${t.id}_${y}`);
      if (d) drawsBackup[`draw_${t.id}_${y}`] = JSON.parse(d);
      const w = universeStorage.getItem(`withdrawals_${t.id}_${y}`);
      if (w) withdrawalsBackup[`withdrawals_${t.id}_${y}`] = JSON.parse(w);
      const bg = universeStorage.getItem(`bg250_${t.id}_${y}`);
      if (bg) bg250Backup[`bg250_${t.id}_${y}`] = bg;
    });
  }

  const currentUniv = universesList.find(u => u.id === activeUniverseId) || { id: activeUniverseId, name: 'Основной тур' };
  const payload = {
    metaTennisSaveVersion: 2,
    exportedAt: new Date().toISOString(),
    universe: {
      id: currentUniv.id,
      name: currentUniv.name,
      currentTourYear,
      currentTourDateStr,
      activeTourneyId
    },
    players,
    tournaments,
    seasonsHistory,
    retiredLegends,
    draws: drawsBackup,
    withdrawals: withdrawalsBackup,
    bg250: bg250Backup
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meta_tennis_save.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('📥 Файл <b>meta_tennis_save.json</b> успешно сохранен!');
}

export function triggerImportUniverse() {
  if (guardCanonReadOnly()) return;
  const fileInput = document.getElementById('importUniverseFile');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

export function triggerImport2023ArchiveOnly() {
  if (guardCanonReadOnly()) return;
  const fileInput = document.getElementById('import2023ArchiveFile');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

export function import2023DrawsOnlyFromObject(data) {
  if (!data || typeof data !== 'object') return 0;
  let importedDrawsCount = 0;

  const extractDrawEntry = (rawKey, rawVal) => {
    const keyStr = String(rawKey || '').trim();
    const match2023 = keyStr.match(/(?:^|_)draw_(?:1_)?([a-z0-9_]+)_2023$/i);
    if (!match2023) return;
    const tId = match2023[1];
    let parsedArr = rawVal;
    if (typeof rawVal === 'string') {
      try {
        parsedArr = JSON.parse(rawVal);
      } catch {
        return;
      }
    }
    if (Array.isArray(parsedArr) && parsedArr.length > 0) {
      universeStorage.setItem(`draw_${tId}_2023`, JSON.stringify(parsedArr));
      importedDrawsCount++;
    }
  };

  if (data.draws && typeof data.draws === 'object') {
    Object.entries(data.draws).forEach(([k, v]) => extractDrawEntry(k, v));
  }
  Object.entries(data).forEach(([k, v]) => {
    if (k !== 'draws') extractDrawEntry(k, v);
  });

  if (importedDrawsCount > 0) {
    let hist2023 = data.seasonsHistory?.[2023] || data.seasonsHistory?.['2023'] || null;
    if (!hist2023 && typeof data.meta_seasons_history_v6 === 'string') {
      try {
        const parsedHist = JSON.parse(data.meta_seasons_history_v6);
        hist2023 = parsedHist?.[2023] || parsedHist?.['2023'] || null;
      } catch {
        // ignore
      }
    }
    if (hist2023 && typeof hist2023 === 'object') {
      if (!seasonsHistory[2023]) seasonsHistory[2023] = {};
      seasonsHistory[2023] = {
        ...seasonsHistory[2023],
        ...hist2023,
        tournaments: {
          ...(seasonsHistory[2023]?.tournaments || {}),
          ...(hist2023.tournaments || {})
        }
      };
    }

    // Синхронизируем финалы 2023 из загруженных сеток, не трогая 2024 год
    const tourneys2023 = getSeasonTournaments(2023, FULL_CALENDAR_TEMPLATE);
    if (!seasonsHistory[2023]) seasonsHistory[2023] = { tournaments: {} };
    if (!seasonsHistory[2023].tournaments) seasonsHistory[2023].tournaments = {};
    tourneys2023.forEach(t => {
      const d = readSavedDraw(t.id, 2023);
      if (d && d.length > 0) {
        const finalM = d[d.length - 1]?.[0];
        if (finalM && finalM.winner && finalM.p1 && finalM.p2) {
          const loser = finalM.winner.id === finalM.p1.id ? finalM.p2 : finalM.p1;
          seasonsHistory[2023].tournaments[t.id] = {
            ...(seasonsHistory[2023].tournaments[t.id] || {}),
            winner: finalM.winner,
            runnerUp: loser,
            score: Array.isArray(finalM.score) ? finalM.score.join(' ') : String(finalM.score || '')
          };
        }
      }
    });

    repairCanonicalPlayersAndDraws();
    backfill2023HistoryFromDraws();
    repairOvercountedPoints();
    saveHistory();
    savePlayers(false);

    initUI({ preserveSelectedTourney: true });
    renderPlayersTable();
    renderRaceTable();
    renderCalendarTable();
  }

  return importedDrawsCount;
}

export function handleImport2023ArchiveFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(String(e.target?.result || '{}'));
      const count = import2023DrawsOnlyFromObject(data);
      if (count > 0) {
        showToast(`✅ <b>Импортировано сеток 2023 года: ${count} шт.!</b> Сезон 2024 и все матчи 2024 года остались нетронутыми.`);
      } else {
        showToast('⚠️ В выбранном файле не найдено сеток 2023 года (ключей draw_*_2023).');
      }
    } catch (err) {
      console.error('Import 2023 archive error:', err);
      showToast('⚠️ Не удалось прочитать JSON-файл архива 2023.');
    }
  };
  reader.readAsText(file);
}

export function handleImportUniverseFile(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(String(e.target?.result || '{}'));
      // Если это файл только с сетками 2023 (или дамп localStorage из старого tennis.html без массива players) — импортируем ТОЛЬКО 2023 год, не трогая 2024!
      if (data && (data.only2023Archive || !Array.isArray(data.players) || data.players.length === 0)) {
        const count2023 = import2023DrawsOnlyFromObject(data);
        if (count2023 > 0) {
          showToast(`✅ <b>Импортировано сеток 2023 года: ${count2023} шт.!</b> Сезон 2024 остался полностью нетронутым.`);
          return;
        }
        showToast('⚠️ Ошибка импорта: неверный формат файла сохранения.');
        return;
      }

      if (data.universe) {
        currentTourYear = Number(data.universe.currentTourYear) || 2024;
        currentTourDateStr = data.universe.currentTourDateStr || `${currentTourYear}-04-14`;
        activeTourneyId = data.universe.activeTourneyId || 'm_4';
        const currU = universesList.find(u => u.id === activeUniverseId);
        if (currU && data.universe.name) {
          currU.name = data.universe.name;
          currU.year = currentTourYear;
        }
      }

      players = data.players;
      tournaments = getSeasonTournaments(currentTourYear, data.tournaments || FULL_CALENDAR_TEMPLATE);
      seasonsHistory = data.seasonsHistory || {};
      retiredLegends = data.retiredLegends || [];
      viewingYear = currentTourYear;

      if (data.draws && typeof data.draws === 'object') {
        Object.entries(data.draws).forEach(([k, v]) => {
          universeStorage.setItem(k, JSON.stringify(v));
        });
      }
      if (data.withdrawals && typeof data.withdrawals === 'object') {
        Object.entries(data.withdrawals).forEach(([k, v]) => {
          universeStorage.setItem(k, JSON.stringify(v));
        });
      }
      if (data.bg250 && typeof data.bg250 === 'object') {
        Object.entries(data.bg250).forEach(([k, v]) => {
          universeStorage.setItem(k, String(v));
        });
      }

      savePlayers(false);
      saveTournaments();
      saveHistory();
      saveRetiredLegends();
      saveDate();

      initUI();
      renderPlayersTable();
      renderRaceTable();
      showToast('📤 Мир успешно загружен из файла <b>meta_tennis_save.json</b>!');
    } catch (err) {
      console.error('Import error:', err);
      showToast('⚠️ Не удалось прочитать JSON-файл вселенной.');
    }
  };
  reader.readAsText(file);
}

/// --- РАЗДЕЛ 7: ЗАМОК НА БУДУЩИЕ ТУРНИРЫ КАЛЕНДАРЯ (🔒) ---
function getFirstUncompletedTourneyIndex(tourneyList) {
  if (!Array.isArray(tourneyList)) return 0;
  const idx = tourneyList.findIndex(t => !t.completed);
  return idx === -1 ? tourneyList.length : idx;
}

export function isFutureLockedTournament(tourney, year, tourneyList = null) {
  if (!tourney || year < currentTourYear) return false;
  if (year > currentTourYear) return true;
  if (tourney.completed) return false;
  const list = tourneyList || getSeasonTournaments(year, tournaments);
  const firstOpenIdx = getFirstUncompletedTourneyIndex(list);
  const targetIdx = list.findIndex(t => t.id === tourney.id);
  return targetIdx > firstOpenIdx;
}

function formatTourneyOptionLabel(t, idx, year, tourneyList) {
  const locked = isFutureLockedTournament(t, year, tourneyList);
  const startDay = String(t.startDay || 2).padStart(2, '0');
  const startMonth = String((t.startMonth || 0) + 1).padStart(2, '0');
  const hasTypeInName = String(t.name || '').includes(`(${t.type})`);
  const typeSuffix = hasTypeInName ? '' : ` (${t.type})`;
  if (locked) {
    return `🔒 #${idx + 1} ${t.name}${typeSuffix} [Ожидается ${startDay}.${startMonth}]`;
  }
  const doneBadge = (year < currentTourYear || t.completed) ? ' ✅' : '';
  return `#${idx + 1} ${t.name} (${t.type} • ${t.surface}) [${getTourneyDateRange(t, year)}]${doneBadge}`;
}

function updateTestSimBannerUI() {
  const banner = document.getElementById('testSimActiveBanner');
  if (!banner) return;
  const hasSnapshot = Boolean(
    (typeof window !== 'undefined' && window._preSimSnapshot) ||
    universeStorage.getItem('meta_pre_sim_snapshot_v1')
  );
  banner.style.display = hasSnapshot ? 'flex' : 'none';
}

// --- 2. UI ИНИЦИАЛИЗАЦИЯ И НАВИГАЦИЯ (ГАРАНТИРОВАННОЕ НАПОЛНЕНИЕ СЕЛЕКТОРОВ) ---
export function initUI(options = {}) {
  renderUniverseSelector();
  updateTestSimBannerUI();
  updateCanonReadOnlyUI();

  const viewingTourneys = getSeasonTournaments(viewingYear, tournaments);
  if (!viewingTourneys || viewingTourneys.length === 0) return;

  // Если мы в текущем сезоне и не передан флаг сохранения выбранного турнира,
  // а текущий activeTourneyId указывает на уже завершенный турнир — синхронизируем с первым незавершенным по календарю
  if (viewingYear === currentTourYear && !options.preserveSelectedTourney) {
    const candidate = viewingTourneys.find(t => t.id === activeTourneyId);
    if (!candidate || candidate.completed) {
      const firstOpenIdx = getFirstUncompletedTourneyIndex(viewingTourneys);
      if (firstOpenIdx >= 0 && firstOpenIdx < viewingTourneys.length) {
        activeTourneyId = viewingTourneys[firstOpenIdx].id;
      }
    }
  }

  activeTourney = viewingTourneys.find(t => t.id === activeTourneyId) || viewingTourneys[0];
  activeTourneyId = activeTourney.id;

  const yearEl = document.getElementById('currentYearDisplay');
  if (yearEl) yearEl.innerText = `Сезон ${currentTourYear}`;

  const dateEl = document.getElementById('currentDateDisplay');
  if (dateEl) dateEl.innerText = formatDateDisplay(currentTourDateStr);

  const raceHeaderEl = document.getElementById('raceYearHeader');
  if (raceHeaderEl) raceHeaderEl.innerText = String(currentTourYear);

  const btnReset = document.getElementById('btnResetJan2024');
  if (btnReset) {
    btnReset.textContent = `🔄 Начать ${currentTourYear} с 02.01`;
    btnReset.title = `Сбросить текущий сезон ${currentTourYear} на 02 января ${currentTourYear} года`;
  }

  // 1) Гарантированно наполняем drawYearSelect (Сезон 2024, Сезон 2023 (Архив) и т.д.)
  const drawYearSel = document.getElementById('drawYearSelect');
  if (drawYearSel) {
    let drawYearOpts = '';
    const maxYear = Math.max(2024, currentTourYear);
    for (let y = maxYear; y >= 2023; y--) {
      drawYearOpts += `<option value="${y}" ${y === viewingYear ? 'selected' : ''}>Сезон ${y}${y < currentTourYear ? ' (Архив)' : ''}</option>`;
    }
    drawYearSel.innerHTML = drawYearOpts;
    drawYearSel.value = String(viewingYear);
  }

  // 2) Гарантированно наполняем tourneySelect всеми турнирами выбранного сезона (с замками 🔒 на будущих турнирах)
  const select = document.getElementById('tourneySelect');
  if (select) {
    select.innerHTML = viewingTourneys.map((t, idx) => `
      <option value="${t.id}" ${t.id === activeTourney.id ? 'selected' : ''}>
        ${formatTourneyOptionLabel(t, idx, viewingYear, viewingTourneys)}
      </option>
    `).join('');
    select.value = activeTourney.id;
  }

  const calYearSelect = document.getElementById('calendarYearSelect');
  if (calYearSelect) {
    const prevSelectedCalYear = parseInt(calYearSelect.value, 10) || currentTourYear;
    let yearOptions = '';
    const maxCalYear = Math.max(2032, currentTourYear + 4);
    for (let y = 2023; y <= maxCalYear; y++) {
      yearOptions += `<option value="${y}" ${y === prevSelectedCalYear ? 'selected' : ''}>Сезон ${y}${isOlympicYear(y) ? ' 🏅 (ОИ)' : ''}</option>`;
    }
    calYearSelect.innerHTML = yearOptions;
  }

  // 3) Сразу вызываем загрузку выбранного турнира (чистое чтение без перезаписи сетки!)
  loadSelectedTournament();
  renderCalendarTable();
  initHistoryUI();
}

export function changeDrawYear() {
  const drawYearSel = document.getElementById('drawYearSelect');
  if (!drawYearSel) return;
  viewingYear = parseInt(drawYearSel.value, 10) || currentTourYear;

  const viewingTourneys = getSeasonTournaments(viewingYear, tournaments);
  const select = document.getElementById('tourneySelect');
  if (select && viewingTourneys.length > 0) {
    const currentId = select.value;
    const targetTourney = viewingTourneys.find(t => t.id === currentId) || viewingTourneys[0];
    select.innerHTML = viewingTourneys.map((t, idx) => `
      <option value="${t.id}" ${t.id === targetTourney.id ? 'selected' : ''}>
        ${formatTourneyOptionLabel(t, idx, viewingYear, viewingTourneys)}
      </option>
    `).join('');
    select.value = targetTourney.id;
  }
  loadSelectedTournament();
}

// СТРОГО ЧИСТОЕ ЧТЕНИЕ (Read-Only): Запрещено вызывать saveDraw() внутри функции переключения или загрузки турнира!
export function loadSelectedTournament() {
  const viewingTourneys = getSeasonTournaments(viewingYear, tournaments);
  if (!viewingTourneys || viewingTourneys.length === 0) return;

  const select = document.getElementById('tourneySelect');
  const selectedId = select?.value || activeTourneyId || viewingTourneys[0].id;

  activeTourney = viewingTourneys.find(t => t.id === selectedId) || viewingTourneys[0];
  activeTourneyId = activeTourney.id;
  if (select) {
    select.innerHTML = viewingTourneys.map((t, idx) => `
      <option value="${t.id}" ${t.id === activeTourneyId ? 'selected' : ''}>
        ${formatTourneyOptionLabel(t, idx, viewingYear, viewingTourneys)}
      </option>
    `).join('');
    select.value = activeTourneyId;
  }
  saveDate();

  currentDraw = readSavedDraw(activeTourney.id, viewingYear);
  const hasFinishedFinal = currentDraw.length > 0 && Boolean(currentDraw[currentDraw.length - 1]?.[0]?.winner);
  activeRoundIdx = hasFinishedFinal ? currentDraw.length - 1 : 0;

  let withdrawals = [];
  try {
    withdrawals = JSON.parse(universeStorage.getItem(`withdrawals_${activeTourney.id}_${viewingYear}`)) || [];
  } catch {
    withdrawals = [];
  }
  const noticeBox = document.getElementById('withdrawalsNotice');
  if (noticeBox) {
    if (withdrawals.length > 0) {
      noticeBox.style.display = 'block';
      const label = activeTourney.id === 'olympics'
        ? '🏅 <b>Национальная квота ОИ (макс. 4 игрока от страны) — не прошли по квоте:</b>'
        : '⚠️ <b>Пропускают турнир (Отдых / Травма / График):</b>';
      noticeBox.innerHTML = `${label} ${withdrawals.join(', ')}`;
    } else {
      noticeBox.style.display = 'none';
    }
  }

  const bgReport = universeStorage.getItem(`bg250_${activeTourney.id}_${viewingYear}`);
  const bgBox = document.getElementById('bg250Notice');
  if (bgBox) {
    if (bgReport) {
      bgBox.style.display = 'block';
      bgBox.innerHTML = bgReport;
    } else {
      bgBox.style.display = 'none';
    }
  }

  const isHistoricalArchive = (viewingYear < currentTourYear);
  const isCompletedInCurrentYear = (viewingYear === currentTourYear && Boolean(activeTourney.completed));
  const isFutureLocked = isFutureLockedTournament(activeTourney, viewingYear, viewingTourneys);
  const readOnlyCanon = isCanonReadOnly();

  updateCanonReadOnlyUI();

  const isOlympicsTourney = Boolean(activeTourney && (activeTourney.id === 'olympics' || activeTourney.type === 'Олимпиада' || activeTourney.isOlympics));
  const isFinalsTourney = Boolean(activeTourney && (activeTourney.id === 'finals' || activeTourney.type === 'Итоговый'));
  const btnOlympicTeams = document.getElementById('btnOlympicTeams');
  if (btnOlympicTeams) {
    btnOlympicTeams.style.display = isOlympicsTourney ? 'inline-block' : 'none';
  }
  const btnFinalsDefending = document.getElementById('btnFinalsDefending');
  if (btnFinalsDefending) {
    btnFinalsDefending.style.display = isFinalsTourney ? 'inline-block' : 'none';
  }
  const btnOpenATP250AutoDraw = document.getElementById('btnOpenATP250AutoDraw');
  if (btnOpenATP250AutoDraw) {
    btnOpenATP250AutoDraw.style.display = (!isOlympicsTourney && !isFinalsTourney) ? 'inline-block' : 'none';
  }
  if (bgBox && bgReport && !bgReport.includes('openWeeklyATP250BracketModal') && !isOlympicsTourney && !isFinalsTourney) {
    bgBox.innerHTML = `${bgReport} · <button type="button" class="btn-gold" onclick="openWeeklyATP250BracketModal('${activeTourney.id}', ${viewingYear})" style="padding:2px 9px; font-size:11.5px; margin-left:6px;">🏆 Открыть авто-сетку ATP 250</button>`;
  }

  if (noticeBox && isOlympicsTourney) {
    const olySummary = buildOlympicDelegationsData();
    noticeBox.style.display = 'block';
    const excludedText = withdrawals.length > 0
      ? `<div style="margin-top: 4px; font-size: 12px; color: var(--text-dim);">Не прошли по лимиту &gt;4 от страны: ${withdrawals.join(', ')}</div>`
      : '';
    noticeBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div>
          🏅 <b>Олимпийский отбор МОК / ITF:</b> заявлено <b>${olySummary.countries.length} стран</b> (${olySummary.totalPlayers} участников · квота до 4 игроков от страны, разведение по разным четвертям Q1–Q4).
          ${excludedText}
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button type="button" class="btn-gold btn-compact" onclick="changeRound('teams')">🌍 Вкладка сборных (${olySummary.countries.length} стран)</button>
          <button type="button" class="btn-edit btn-compact" onclick="openOlympicTeamsModal()">📋 Открыть в окне</button>
        </div>
      </div>
    `;
  } else if (noticeBox && isFinalsTourney) {
    noticeBox.style.display = 'block';
    noticeBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div>
          🛡️ <b>World Tour Finals 2024:</b> Завершилась чемпионская гонка сезона 2024! В турнире участвуют <b>Топ-8 Чемпионской гонки</b>. Все 8 участников 2023 года защищают свои очки (включая не прошедших квалификацию Puddy Mexalino [#10] и Fite Memsy Staprin [#30]).
        </div>
        <button type="button" class="btn-gold btn-compact" onclick="openFinalsDefendingModal()" style="font-weight: 600;">🛡️ Защита очков Итогового</button>
      </div>
    `;
  }

  const btnMakeDraw = document.getElementById('btnMakeDraw');
  const btnSimRound = document.getElementById('btnSimRound');
  const btnSimAll = document.getElementById('btnSimAllTourney');
  const btnReset = document.getElementById('btnResetDraw');

  if (btnMakeDraw) {
    btnMakeDraw.style.display = (isHistoricalArchive || readOnlyCanon) ? 'none' : 'inline-block';
    btnMakeDraw.disabled = isCompletedInCurrentYear || isFutureLocked || readOnlyCanon;
    btnMakeDraw.innerText = isFutureLocked ? '🔒 Ожидается по календарю' : '🎲 Жеребьевка';
  }
  if (btnSimRound) {
    btnSimRound.style.display = (isHistoricalArchive || readOnlyCanon) ? 'none' : 'inline-block';
    btnSimRound.disabled = isCompletedInCurrentYear || isFutureLocked || readOnlyCanon;
  }
  if (btnSimAll) {
    btnSimAll.style.display = (isHistoricalArchive || readOnlyCanon) ? 'none' : 'inline-block';
    btnSimAll.disabled = isCompletedInCurrentYear || isFutureLocked || readOnlyCanon;
  }
  if (btnReset) {
    btnReset.style.display = (isHistoricalArchive || readOnlyCanon) ? 'none' : 'inline-block';
    btnReset.disabled = isCompletedInCurrentYear || isFutureLocked || readOnlyCanon;
  }

  // НАДЕЖНАЯ ЗАЩИТА КНОПКИ «ЗАВЕРШИТЬ ТУРНИР» ОТ ДВОЙНОГО НАЖАТИЯ И БУДУЩИХ ТУРНИРОВ
  const btnFinish = document.getElementById('btnFinishTourney');
  if (btnFinish) {
    if (isHistoricalArchive || readOnlyCanon) {
      btnFinish.style.display = 'none';
    } else {
      btnFinish.style.display = 'inline-block';
      if (isCompletedInCurrentYear) {
        btnFinish.disabled = true;
        btnFinish.innerText = 'Турнир завершен ✅';
      } else if (isFutureLocked) {
        btnFinish.disabled = true;
        btnFinish.innerText = '🔒 Турнир еще не начался';
      } else {
        btnFinish.disabled = false;
        btnFinish.innerText = '🏆 Завершить турнир';
      }
    }
  }

  renderRoundTabs();
  renderMatches();
  renderCalendarTable();
}

// --- 3. ЖЕРЕБЬЕВКА И СЕТКА ТУРНИРА ---
export function generateRealisticDraw() {
  if (guardCanonReadOnly()) return;
  if (viewingYear < currentTourYear) return;
  if (activeTourney && activeTourney.completed) {
    showToast('⚠️ Этот турнир уже завершен в текущем сезоне и очки начислены.');
    return;
  }
  if (isFutureLockedTournament(activeTourney, viewingYear)) {
    const startDay = String(activeTourney.startDay || 2).padStart(2, '0');
    const startMonth = String((activeTourney.startMonth || 0) + 1).padStart(2, '0');
    showToast(`🔒 <b>Турнир «${activeTourney.name}» еще не начался!</b> Дата старта: ${startDay}.${startMonth}.${viewingYear}. Сначала завершите текущий турнир по календарю.`);
    return;
  }

  // На старте нового турнира у всех игроков выносливость 100%
  resetPlayersStamina(players);
  savePlayers(false);

  const { draw, withdrawals } = createTournamentDraw(activeTourney, players);
  currentDraw = draw;
  activeRoundIdx = 0;

  const noticeBox = document.getElementById('withdrawalsNotice');
  if (withdrawals.length > 0) {
    universeStorage.setItem(`withdrawals_${activeTourney.id}_${viewingYear}`, JSON.stringify(withdrawals));
    if (noticeBox) {
      noticeBox.style.display = 'block';
      if (activeTourney.id === 'olympics') {
        const olySummary = buildOlympicDelegationsData();
        noticeBox.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div>
              🏅 <b>Олимпийский отбор МОК / ITF:</b> заявлено <b>${olySummary.countries.length} стран</b> (${olySummary.totalPlayers} участников · квота до 4 игроков от страны, разведение по разным четвертям Q1–Q4).
              <div style="margin-top: 4px; font-size: 12px; color: var(--text-dim);">Не прошли по лимиту &gt;4 от страны: ${withdrawals.join(', ')}</div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button type="button" class="btn-gold btn-compact" onclick="changeRound('teams')">🌍 Вкладка сборных (${olySummary.countries.length} стран)</button>
              <button type="button" class="btn-edit btn-compact" onclick="openOlympicTeamsModal()">📋 Открыть в окне</button>
            </div>
          </div>
        `;
      } else {
        noticeBox.innerHTML = `⚠️ <b>Пропускают турнир (Отдых / Травма / График):</b> ${withdrawals.join(', ')}`;
      }
    }
  } else {
    universeStorage.removeItem(`withdrawals_${activeTourney.id}_${viewingYear}`);
    if (noticeBox && activeTourney.id !== 'olympics') noticeBox.style.display = 'none';
  }

  activeTourney.completed = false;
  saveTournaments();
  saveDraw();
  renderRoundTabs();
  renderMatches();
}

export function resetCurrentDraw() {
  if (guardCanonReadOnly()) return;
  if (viewingYear < currentTourYear) return;
  if (activeTourney && activeTourney.completed) {
    showToast('⚠️ Завершенный турнир сезона нельзя сбросить после начисления очков.');
    return;
  }
  currentDraw = [];
  universeStorage.removeItem(`draw_${activeTourney.id}_${viewingYear}`);
  universeStorage.removeItem(`withdrawals_${activeTourney.id}_${viewingYear}`);
  const noticeBox = document.getElementById('withdrawalsNotice');
  if (noticeBox && activeTourney?.id !== 'olympics') noticeBox.style.display = 'none';
  renderRoundTabs();
  renderMatches();
}

// --- СБОРНЫЕ И СОСТАВЫ СТРАН НА ОЛИМПИЙСКИЕ ИГРЫ ---
let olympicTeamsFilterMode = 'all'; // 'all' | '4' | '23' | '1'
let olympicTeamsSearchQuery = '';

export function buildOlympicDelegationsData() {
  const isOlympics = Boolean(activeTourney && (activeTourney.id === 'olympics' || activeTourney.type === 'Олимпиада' || activeTourney.isOlympics));
  const hasDraw = isOlympics && Array.isArray(currentDraw) && currentDraw.length > 0 && Array.isArray(currentDraw[0]) && currentDraw[0].length === 32;

  const sortedByRank = [...players].sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const excludedByCountry = {};
  const tempCounts = {};
  let tempAdmitted = 0;
  for (let i = 0; i < sortedByRank.length; i++) {
    if (tempAdmitted >= 64) break;
    const pl = sortedByRank[i];
    const c = normalizeCountryCode(pl.flag);
    if (!c || c === '?') continue;
    const cnt = tempCounts[c] || 0;
    if (cnt < 4) {
      tempCounts[c] = cnt + 1;
      tempAdmitted++;
    } else if (i < 100) {
      if (!excludedByCountry[c]) excludedByCountry[c] = [];
      excludedByCountry[c].push({
        id: pl.id,
        name: pl.name,
        rank: pl.rank,
        points: pl.points || 0
      });
    }
  }

  const participants = [];
  if (hasDraw) {
    currentDraw[0].forEach((m, mIdx) => {
      const qNum = Math.floor(mIdx / 8) + 1;
      const matchNum = mIdx + 1;
      for (const side of [m?.p1, m?.p2]) {
        if (!side) continue;
        const liveP = players.find(x => x.id === side.id) || side;
        const normFlag = normalizeCountryCode(liveP.flag || side.flag);
        participants.push({
          id: liveP.id || side.id,
          name: liveP.name || side.name,
          flag: normFlag,
          rank: liveP.rank || side.rank || 999,
          points: liveP.points ?? 0,
          birthDate: liveP.birthDate || side.birthDate,
          seedNum: side.seedNum || null,
          quarterNum: qNum,
          matchNum
        });
      }
    });
  } else {
    const { qualified } = selectOlympicParticipantsWithQuota(players, 4, 64);
    qualified.forEach((p, idx) => {
      participants.push({
        id: p.id,
        name: p.name,
        flag: normalizeCountryCode(p.flag),
        rank: p.rank || (idx + 1),
        points: p.points ?? 0,
        birthDate: p.birthDate,
        seedNum: idx < 16 ? (idx + 1) : null,
        quarterNum: null,
        matchNum: null
      });
    });
  }

  const byCountryMap = new Map();
  participants.forEach(p => {
    const code = p.flag || '?';
    if (!byCountryMap.has(code)) {
      const meta = getCountryMeta(code);
      byCountryMap.set(code, {
        code,
        nameRu: meta.ru || code,
        nameEn: meta.en || code,
        players: [],
        excluded: excludedByCountry[code] || []
      });
    }
    byCountryMap.get(code).players.push(p);
  });

  const countries = Array.from(byCountryMap.values()).map(group => {
    group.players.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    group.bestRank = group.players[0]?.rank || 999;
    group.seedsCount = group.players.filter(x => x.seedNum).length;
    return group;
  });

  countries.sort((a, b) => {
    if (b.players.length !== a.players.length) return b.players.length - a.players.length;
    return a.bestRank - b.bestRank;
  });

  const count4 = countries.filter(c => c.players.length === 4).length;
  const count23 = countries.filter(c => c.players.length === 2 || c.players.length === 3).length;
  const count1 = countries.filter(c => c.players.length === 1).length;
  const totalExcluded = Object.values(excludedByCountry).reduce((acc, arr) => acc + arr.length, 0);

  return {
    hasDraw,
    totalPlayers: participants.length,
    countries,
    count4,
    count23,
    count1,
    totalExcluded
  };
}

export function renderOlympicDelegationsContentHtml(contextId = 'tab') {
  const data = buildOlympicDelegationsData();
  const q = String(olympicTeamsSearchQuery || '').trim().toLowerCase();

  const filteredCountries = data.countries.filter(c => {
    if (olympicTeamsFilterMode === '4' && c.players.length !== 4) return false;
    if (olympicTeamsFilterMode === '23' && !(c.players.length === 2 || c.players.length === 3)) return false;
    if (olympicTeamsFilterMode === '1' && c.players.length !== 1) return false;
    if (!q) return true;
    const matchCountry =
      c.code.toLowerCase().includes(q) ||
      c.nameRu.toLowerCase().includes(q) ||
      c.nameEn.toLowerCase().includes(q);
    const matchPlayer = c.players.some(p => String(p.name || '').toLowerCase().includes(q));
    return matchCountry || matchPlayer;
  });

  const cardsHtml = filteredCountries.map((c, idx) => {
    const quotaColor = c.players.length === 4
      ? 'background: rgba(16, 185, 129, 0.16); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);'
      : (c.players.length >= 2
        ? 'background: rgba(56, 189, 248, 0.14); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35);'
        : 'background: rgba(148, 163, 184, 0.12); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.25);');

    const rowsHtml = c.players.map((p, pIdx) => {
      const seedHtml = p.seedNum
        ? `<span class="seed-tag" style="margin-left: 4px;">Посев (${p.seedNum})</span>`
        : `<span class="entry-tag" style="margin-left: 4px;">[OLY]</span>`;
      const quarterHtml = p.quarterNum
        ? `<span style="font-size: 11px; padding: 2px 7px; border-radius: 5px; background: rgba(245, 158, 11, 0.14); color: var(--gold); border: 1px solid rgba(245, 158, 11, 0.3); font-weight: 700;">Q${p.quarterNum} · М#${p.matchNum}</span>`
        : `<span style="font-size: 11px; color: var(--text-dim);">Отбор по рейтингу</span>`;
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; background: rgba(15, 23, 42, 0.55); border: 1px solid rgba(255,255,255,0.05);">
          <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
            <span style="font-size: 11.5px; color: var(--text-dim); font-weight: 700; width: 16px;">${pIdx + 1}.</span>
            <span style="font-size: 11.5px; font-weight: 800; color: var(--accent); min-width: 34px;">#${p.rank}</span>
            <span class="player-profile-link" onclick="openPlayerProfileModal('${p.id}')" style="font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
            ${seedHtml}
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <span style="font-size: 11.5px; color: var(--text-dim);">${(p.points || 0).toLocaleString('ru-RU')} pts</span>
            ${quarterHtml}
          </div>
        </div>
      `;
    }).join('');

    const excludedFooterHtml = c.excluded.length > 0
      ? `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.08); font-size: 11.5px; color: #fca5a5;">
           🚫 <b>Отсечены квотой (&gt;4 от страны):</b> ${c.excluded.map(e => `${e.name} (#${e.rank})`).join(', ')}
         </div>`
      : '';

    return `
      <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.07);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; color: var(--text-dim); font-weight: 700;">#${idx + 1}</span>
              ${renderFlagBadge(c.code)}
              <div>
                <div style="font-weight: 800; font-size: 14px; color: var(--text-main);">${c.nameRu}</div>
                <div style="font-size: 11px; color: var(--text-dim);">Лидер сборной: #${c.bestRank} ATP${c.seedsCount > 0 ? ` · Сеяных: ${c.seedsCount}` : ''}</div>
              </div>
            </div>
            <span style="font-size: 11.5px; font-weight: 800; padding: 3px 9px; border-radius: 999px; ${quotaColor}">
              ${c.players.length} / 4 уч.
            </span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 5px;">
            ${rowsHtml}
          </div>
        </div>
        ${excludedFooterHtml}
      </div>
    `;
  }).join('');

  return `
    <div style="grid-column: 1 / -1;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); gap: 10px; margin-bottom: 14px;">
        <div style="background: rgba(245, 158, 11, 0.09); border: 1px solid rgba(245, 158, 11, 0.32); border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11.5px; color: var(--text-dim);">Заявлено стран на ОИ</div>
          <div style="font-size: 22px; font-weight: 900; color: var(--gold);">${data.countries.length} стран</div>
        </div>
        <div style="background: rgba(16, 185, 129, 0.09); border: 1px solid rgba(16, 185, 129, 0.32); border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11.5px; color: var(--text-dim);">Участников сетки ОИ</div>
          <div style="font-size: 22px; font-weight: 900; color: var(--primary);">${data.totalPlayers} / 64 игроков</div>
        </div>
        <div style="background: rgba(56, 189, 248, 0.09); border: 1px solid rgba(56, 189, 248, 0.32); border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11.5px; color: var(--text-dim);">Максимальная квота (4/4)</div>
          <div style="font-size: 22px; font-weight: 900; color: var(--accent);">${data.count4} сборных</div>
        </div>
        <div style="background: rgba(168, 85, 247, 0.09); border: 1px solid rgba(168, 85, 247, 0.32); border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 11.5px; color: var(--text-dim);">Разведение по четвертям</div>
          <div style="font-size: 14px; font-weight: 800; color: #e9d5ff; margin-top: 4px;">Q1 · Q2 · Q3 · Q4 (строго ≤ 1 от страны)</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; background: var(--card-bg); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);">
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button type="button" class="round-tab ${olympicTeamsFilterMode === 'all' ? 'active' : ''}" onclick="setOlympicTeamsFilter('all')">Все страны (${data.countries.length})</button>
          <button type="button" class="round-tab ${olympicTeamsFilterMode === '4' ? 'active' : ''}" onclick="setOlympicTeamsFilter('4')">Полная квота 4/4 (${data.count4})</button>
          <button type="button" class="round-tab ${olympicTeamsFilterMode === '23' ? 'active' : ''}" onclick="setOlympicTeamsFilter('23')">2–3 участника (${data.count23})</button>
          <button type="button" class="round-tab ${olympicTeamsFilterMode === '1' ? 'active' : ''}" onclick="setOlympicTeamsFilter('1')">1 участник (${data.count1})</button>
        </div>
        <div class="search-input-wrap" style="min-width: 260px;">
          <span class="search-input-icon" aria-hidden="true">🔍</span>
          <input type="text" id="olympicTeamsSearchInput_${contextId}" value="${olympicTeamsSearchQuery.replace(/"/g, '&quot;')}" placeholder="Страна или игрок (Италия, USA, Wentra)..." oninput="handleOlympicTeamsSearch(this.value, '${contextId}')" style="width: 280px;">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px;">
        ${cardsHtml || `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-dim);">По вашему запросу сборных не найдено.</div>`}
      </div>
    </div>
  `;
}

export function setOlympicTeamsFilter(mode) {
  olympicTeamsFilterMode = mode || 'all';
  if (activeRoundIdx === 'teams') {
    renderMatches();
  }
  const modalBody = document.getElementById('olympicTeamsModalBody');
  const modal = document.getElementById('olympicTeamsModal');
  if (modal && modal.classList.contains('open') && modalBody) {
    modalBody.innerHTML = renderOlympicDelegationsContentHtml('modal');
  }
}

export function handleOlympicTeamsSearch(val, sourceContext = 'tab') {
  olympicTeamsSearchQuery = String(val || '');
  if (activeRoundIdx === 'teams') {
    renderMatches();
  }
  const modalBody = document.getElementById('olympicTeamsModalBody');
  const modal = document.getElementById('olympicTeamsModal');
  if (modal && modal.classList.contains('open') && modalBody) {
    modalBody.innerHTML = renderOlympicDelegationsContentHtml('modal');
  }
  const inputEl = document.getElementById(`olympicTeamsSearchInput_${sourceContext}`);
  if (inputEl) {
    inputEl.focus();
    const len = inputEl.value.length;
    try { inputEl.setSelectionRange(len, len); } catch { /* ignore */ }
  }
}

export function openOlympicTeamsModal() {
  const modal = document.getElementById('olympicTeamsModal');
  const body = document.getElementById('olympicTeamsModalBody');
  if (!modal || !body) return;
  body.innerHTML = renderOlympicDelegationsContentHtml('modal');
  modal.classList.add('open');
}

export function openFinalsDefendingModal() {
  const modal = document.getElementById('finalsDefendingModal');
  const body = document.getElementById('finalsDefendingModalBody');
  if (!modal || !body) return;

  const curYear = Number(viewingYear || currentTourYear || 2024);
  const prevYear = curYear - 1;

  const raceSorted = [...(players || [])].sort((a, b) => {
    const diff = (b.racePoints || 0) - (a.racePoints || 0);
    if (diff !== 0) return diff;
    return (a.rank || 300) - (b.rank || 300);
  });
  const getRaceRank = (id) => raceSorted.findIndex(p => p.id === id) + 1;

  // 1. Находим игроков, у которых есть очки защиты за прошлый Итоговый турнир (prevYear)
  const defendingPlayers = (players || []).filter(p => {
    const pts = p.tournamentPoints?.['finals']?.[prevYear];
    return typeof pts === 'number' && pts > 0;
  });

  // 2. Получаем текущий Топ-8 Чемпионской Гонки текущего года viewingYear
  const top8Race = raceSorted.slice(0, 8);

  // 3. Объединяем обе группы без дубликатов
  const combinedMap = new Map();

  defendingPlayers.forEach(p => {
    const defPts = p.tournamentPoints?.['finals']?.[prevYear] || 0;
    combinedMap.set(p.id, {
      id: p.id,
      player: p,
      name: p.name,
      flag: p.flag,
      defPts,
      playedPrevYear: true
    });
  });

  top8Race.forEach(p => {
    if (!combinedMap.has(p.id)) {
      combinedMap.set(p.id, {
        id: p.id,
        player: p,
        name: p.name,
        flag: p.flag,
        defPts: 0,
        playedPrevYear: false
      });
    }
  });

  // Формируем динамический список участников и статусов защиты
  const dynamicRoster = Array.from(combinedMap.values()).map(item => {
    const pl = item.player || (players || []).find(p => p.id === item.id);
    const raceRank = getRaceRank(item.id);
    const isQualified = raceRank <= 8;
    const defPts = item.defPts || 0;
    const racePoints = pl ? (pl.racePoints || 0) : 0;
    const livePoints = pl ? (pl.points || 0) : 0;
    const liveRank = pl ? (pl.rank || '—') : '—';
    const flagSvg = typeof getCountryFlagSvg === 'function' ? getCountryFlagSvg(item.flag, 20, 14) : renderFlagBadge(item.flag, { compact: true });

    let resPrev = `— (Дебют ${curYear})`;
    if (item.playedPrevYear) {
      if (defPts >= 1100) resPrev = '🏆 Чемпион';
      else if (defPts >= 600) resPrev = '🥈 Финалист';
      else if (defPts >= 200) resPrev = '🥉 1/2 финала';
      else if (defPts > 0) resPrev = 'Групповой этап';
    }

    let statusBadge = '';
    let note = '';

    if (isQualified && !item.playedPrevYear) {
      statusBadge = `<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 700;">🌟 ДЕБЮТАНТ (ТОП-8)</span>`;
      note = `Дебютант Итогового (+0 к защите, чистый плюс)`;
    } else if (isQualified) {
      statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 700;">✅ ОТОБРАЛСЯ (ТОП-8)</span>`;
      note = `Квалифицировался (Защищает ${defPts.toLocaleString()} pts)`;
    } else {
      statusBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 700;">❌ НЕ ОТОБРАЛСЯ</span>`;
      note = `Не отобрался (${defPts.toLocaleString()} pts сгорают без защиты)`;
    }

    return {
      ...item,
      pl,
      raceRank,
      isQualified,
      defPts,
      racePoints,
      livePoints,
      liveRank,
      flagSvg,
      resPrev,
      statusBadge,
      note
    };
  });

  // Сортировка: квалифицировавшиеся по месту в Гонке (1..8), затем не отобравшиеся по убыванию защиты
  dynamicRoster.sort((a, b) => {
    if (a.isQualified && !b.isQualified) return -1;
    if (!a.isQualified && b.isQualified) return 1;
    if (a.isQualified && b.isQualified) return a.raceRank - b.raceRank;
    return b.defPts - a.defPts;
  });

  const totalDefending = dynamicRoster.filter(r => r.playedPrevYear).reduce((sum, r) => sum + r.defPts, 0);
  const defendingCount = dynamicRoster.filter(r => r.playedPrevYear).length;
  const nonQualifiers = dynamicRoster.filter(r => !r.isQualified);
  const debutants = dynamicRoster.filter(r => r.isQualified && !r.playedPrevYear);

  const nonQualifiersText = nonQualifiers.length > 0
    ? nonQualifiers.map(x => `<b>${x.name}</b> [#${x.raceRank} в гонке]`).join(', ')
    : 'нет';
  const debutantsText = debutants.length > 0
    ? debutants.map(x => `<b>${x.name}</b>`).join(', ')
    : 'нет';

  const rowsHtml = dynamicRoster.map((item, idx) => {
    const rowBg = !item.isQualified
      ? 'background: rgba(239, 68, 68, 0.05);'
      : (item.defPts >= 600 ? 'background: rgba(245, 158, 11, 0.05);' : '');

    return `
      <tr style="${rowBg} border-bottom: 1px solid var(--border);">
        <td style="padding: 10px 12px; font-weight: 600; text-align: center; color: var(--text-dim);">${idx + 1}</td>
        <td style="padding: 10px 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${item.flagSvg}
            <div>
              <span style="font-weight: 700; color: var(--text-main); font-size: 13.5px;">${item.name}</span>
              <span style="color: var(--text-dim); font-size: 11.5px; margin-left: 4px;">(${item.flag})</span>
            </div>
          </div>
        </td>
        <td style="padding: 10px 12px; font-size: 13px;">
          <b>${item.resPrev}</b>
        </td>
        <td style="padding: 10px 12px; text-align: center; font-size: 13.5px; font-weight: 700; color: ${item.defPts > 0 ? 'var(--gold)' : 'var(--text-dim)'};">
          ${item.defPts > 0 ? `🛡️ ${item.defPts.toLocaleString()} pts` : '0 pts'}
        </td>
        <td style="padding: 10px 12px; text-align: center; font-size: 13px;">
          <b style="color: ${item.raceRank <= 8 ? '#10b981' : 'var(--text-dim)'};">#${item.raceRank}</b>
          <div style="font-size: 11.5px; color: var(--text-dim);">${item.racePoints.toLocaleString()} pts</div>
        </td>
        <td style="padding: 10px 12px; text-align: center; font-size: 13px;">
          #${item.liveRank}
          <div style="font-size: 11.5px; color: var(--text-dim);">${item.livePoints.toLocaleString()} pts</div>
        </td>
        <td style="padding: 10px 12px; text-align: center;">
          ${item.statusBadge}
        </td>
        <td style="padding: 10px 12px; font-size: 12px; color: var(--text-dim);">
          ${item.note}
        </td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px 16px; border-radius: 8px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3);">
        <div>
          <div style="font-weight: 700; color: var(--gold); font-size: 14.5px; margin-bottom: 4px;">
            🏆 Регламент защиты очков на World Tour Finals (${curYear})
          </div>
          <div style="font-size: 12.5px; color: var(--text-main); line-height: 1.5;">
            На Итоговом турнире ${prevYear} года участвовало <b>${defendingCount} игроков</b> (суммарно <b>${totalDefending.toLocaleString()} очков</b> к защите).
            В сезоне ${curYear} года в турнир квалифицировались строго <b>Топ-8 Чемпионской гонки (Race ${curYear})</b>.
            Очки игроков, не прошедших квалификацию (${nonQualifiersText}), сгорают ровно через 52 недели.
            Дебютанты турнира ${curYear} года (${debutantsText}) защитных очков не имеют и получают чистый прирост мирового рейтинга.
          </div>
        </div>
      </div>

      <div style="overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--card-bg);">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <thead style="background: rgba(255, 255, 255, 0.03); border-bottom: 2px solid var(--border);">
            <tr>
              <th style="padding: 10px 12px; text-align: center; width: 40px;">#</th>
              <th style="padding: 10px 12px;">Игрок</th>
              <th style="padding: 10px 12px;">Результат ${prevYear}</th>
              <th style="padding: 10px 12px; text-align: center;">Защита ${curYear}</th>
              <th style="padding: 10px 12px; text-align: center;">Гонка ${curYear} (Race)</th>
              <th style="padding: 10px 12px; text-align: center;">Рейтинг 52 нед.</th>
              <th style="padding: 10px 12px; text-align: center;">Статус ${curYear}</th>
              <th style="padding: 10px 12px;">Примечание</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div style="font-size: 12px; color: var(--text-dim); line-height: 1.45; padding: 0 4px;">
        💡 <b>Справка начисления очков ${curYear}:</b> Групповой этап (Round Robin) — <b>+200 pts</b> за каждую победу в матче. Выход в финал — <b>+400 pts</b>. Победа в финале — <b>+500 pts</b>. Чемпион без поражений (3 победы в группе + SF + F) набирает максимум <b>1 500 очков</b>.
      </div>
    </div>
  `;

  modal.classList.add('open');
}

// --- МОДАЛЬНОЕ ОКНО АВТОМАТИЧЕСКОГО ТУРНИРА ATP 250 ---
let atp250ModalState = {
  tourneyId: null,
  year: null,
  activeRoundIdx: 0,
  details: null,
  tourneyObj: null,
  leadTourneyName: ''
};

function computeATP250BracketForTourneyWeek(tourneyObj, year) {
  if (!tourneyObj) return null;
  const savedDraw = (activeTourney && activeTourney.id === tourneyObj.id && viewingYear === year && currentDraw && currentDraw.length > 0)
    ? currentDraw
    : readSavedDraw(tourneyObj.id, year);

  const inMainSet = new Set();
  const mainEarnedMap = {};
  if (savedDraw && Array.isArray(savedDraw) && savedDraw.length > 0 && Array.isArray(savedDraw[0])) {
    const { earnedMap, participantsList } = calculateTournamentEarnedPoints(tourneyObj, savedDraw);
    Object.assign(mainEarnedMap, earnedMap || {});
    (participantsList || []).forEach(p => {
      if (p?.id) inMainSet.add(p.id);
    });
    savedDraw[0].forEach(m => {
      if (m?.p1?.id && !m.p1.isBye) inMainSet.add(m.p1.id);
      if (m?.p2?.id && !m.p2.isBye) inMainSet.add(m.p2.id);
    });
  } else {
    const sorted = [...players].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    sorted.slice(0, tourneyObj.size || 32).forEach(p => {
      if (p?.id) inMainSet.add(p.id);
    });
  }

  const allTourneys = getSeasonTournaments(year, tournaments);
  const tIdx = allTourneys.findIndex(t => t.id === tourneyObj.id);
  return computeWeeklyParallelTourPoints(tourneyObj, players, inMainSet, year, {
    tourneyIndex: tIdx >= 0 ? tIdx : 0,
    mainEarnedMap
  });
}

export function renderATP250ModalContent() {
  const titleEl = document.getElementById('atp250ModalTitle');
  const summaryEl = document.getElementById('atp250ModalSummaryBar');
  const tabsEl = document.getElementById('atp250ModalRoundTabs');
  const matchesEl = document.getElementById('atp250ModalMatchesContainer');
  if (!tabsEl || !matchesEl) return;

  const { details, tourneyObj, leadTourneyName, year, activeRoundIdx: rIdx } = atp250ModalState;
  if (!details || !Array.isArray(details.draw) || details.draw.length === 0) {
    matchesEl.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 36px; color: var(--text-dim);">На этой неделе параллельный турнир ATP 250 не проводится.</div>`;
    return;
  }

  if (titleEl && tourneyObj) {
    titleEl.innerHTML = `🏆 ${leadTourneyName} (ATP 250 • ${tourneyObj.surface}) — Авто-сетка (${year})`;
  }

  const winner = details.winner;
  const finalist = details.finalist;
  const sfNames = (details.semifinalists || []).map(p => p.name).join(', ');
  const roundNames = ['1/16 финала (Топ-4 BYE)', '1/8 финала', '1/4 финала', 'Полуфинал', 'Финал 🏆'];

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:10px 14px; border-radius:8px; background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.3); font-size:12.5px;">
        <div>
          🏆 <b>Чемпион:</b> <span style="color:var(--gold); font-weight:700;">${winner ? winner.name : '—'}</span> (+250 pts)
          &nbsp;•&nbsp; 🥈 <b>Финалист:</b> <b>${finalist ? finalist.name : '—'}</b> (+165 pts)
          &nbsp;•&nbsp; <b>1/2 финала:</b> ${sfNames || '—'} (+100 pts)
        </div>
        <div style="color:var(--text-dim); font-size:11.5px;">
          Параллельно с турниром: <b>${tourneyObj ? tourneyObj.name : ''}</b> [${tourneyObj ? getTourneyDateRange(tourneyObj, year) : ''}]
        </div>
      </div>
    `;
  }

  tabsEl.innerHTML = details.draw.map((_, idx) => `
    <button type="button" class="round-tab ${idx === rIdx ? 'active' : ''}" onclick="switchATP250ModalRound(${idx})">
      ${roundNames[idx] || `Раунд ${idx + 1}`}
    </button>
  `).join('');

  const roundMatches = details.draw[rIdx] || [];
  const refDateStr = `${String(tourneyObj?.endDay || 10).padStart(2, '0')}.${String((tourneyObj?.endMonth || 0) + 1).padStart(2, '0')}.${year}`;

  matchesEl.innerHTML = roundMatches.map((m, idx) => {
    const p1Live = m.p1 && !m.p1.isBye ? (players.find(x => x.id === m.p1.id) || m.p1) : m.p1;
    const p2Live = m.p2 && !m.p2.isBye ? (players.find(x => x.id === m.p2.id) || m.p2) : m.p2;
    const p1Win = m.winner && m.p1 && m.winner.id === m.p1.id;
    const p2Win = m.winner && m.p2 && m.winner.id === m.p2.id;

    const p1SeedTag = m.p1?.seed ? `<span class="seed-tag">(${m.p1.seed})</span>` : (m.p1 && !m.p1.isBye && p1Live?.rank ? `<span class="entry-tag">[#${p1Live.rank}]</span>` : '');
    const p2SeedTag = m.p2?.seed ? `<span class="seed-tag">(${m.p2.seed})</span>` : (m.p2 && !m.p2.isBye && p2Live?.rank ? `<span class="entry-tag">[#${p2Live.rank}]</span>` : '');

    const p1Html = m.p1 && !m.p1.isBye
      ? `<span style="min-width: 38px; flex-shrink: 0; display: inline-flex; align-items: center;">${renderFlagBadge(p1Live?.flag || m.p1.flag, { compact: true })}</span>
         <span class="player-name player-profile-link" onclick="openPlayerProfileModal('${m.p1.id}')">${m.p1.name}${rIdx === 4 && p1Win ? ' 🏆' : ''}</span>
         <span class="player-age-tag">${calculateAge(p1Live?.birthDate || m.p1.birthDate, refDateStr)}</span>
         ${p1SeedTag}`
      : `<span class="player-name" style="color:var(--text-dim); font-style:italic;">BYE (Пропуск 1-го круга для Топ-4 посева)</span>`;

    const p2Html = m.p2 && !m.p2.isBye
      ? `<span style="min-width: 38px; flex-shrink: 0; display: inline-flex; align-items: center;">${renderFlagBadge(p2Live?.flag || m.p2.flag, { compact: true })}</span>
         <span class="player-name player-profile-link" onclick="openPlayerProfileModal('${m.p2.id}')">${m.p2.name}${rIdx === 4 && p2Win ? ' 🏆' : ''}</span>
         <span class="player-age-tag">${calculateAge(p2Live?.birthDate || m.p2.birthDate, refDateStr)}</span>
         ${p2SeedTag}`
      : `<span class="player-name" style="color:var(--gold); font-style:italic; font-weight:600;">⚡ BYE — Посев [1–4] напрямую в 1/8 финала</span>`;

    const scoreText = m.isBye
      ? 'Авто-проход (BYE)'
      : (Array.isArray(m.score) && m.score.length > 0 ? m.score.join(' ') : 'Завершен');

    return `
      <div class="match-card" style="cursor:default;">
        <div style="font-size: 11px; color: ${rIdx === 4 ? 'var(--gold)' : 'var(--text-dim)'}; font-weight: ${rIdx === 4 ? '700' : '500'}; margin-bottom: 4px; display: flex; justify-content: space-between;">
          <span>${rIdx === 4 ? '🏆 Финал ATP 250' : `Матч #${idx + 1}`}</span>
          <span>${m.isBye ? 'Пропуск 1-го круга' : 'Авто-расчет'}</span>
        </div>
        <div class="match-player ${p1Win ? 'winner' : ''}">
          <div class="player-info">${p1Html}</div>
        </div>
        <div class="match-player ${p2Win ? 'winner' : ''}">
          <div class="player-info">${p2Html}</div>
        </div>
        <div class="score-line">${scoreText}</div>
      </div>
    `;
  }).join('');
}

export function openWeeklyATP250BracketModal(tourneyId = null, year = null) {
  const modal = document.getElementById('atp250BracketModal');
  const selectEl = document.getElementById('atp250WeekSelect');
  if (!modal) return;

  const targetYear = Number(year) || viewingYear || currentTourYear;
  const yearTourneys = getSeasonTournaments(targetYear, tournaments).filter(
    t => t && t.id !== 'finals' && t.id !== 'olympics' && t.type !== 'Итоговый' && t.type !== 'Олимпиада' && !t.isOlympics
  );
  if (yearTourneys.length === 0) return;

  const chosenTourney = yearTourneys.find(t => t.id === (tourneyId || activeTourney?.id)) || yearTourneys[0];

  if (selectEl) {
    selectEl.innerHTML = yearTourneys.map((t, idx) => {
      const selectedAttr = t.id === chosenTourney.id ? 'selected' : '';
      return `<option value="${t.id}" ${selectedAttr}>Неделя #${idx + 1}: параллельно с «${t.name}» [${getTourneyDateRange(t, targetYear)}]</option>`;
    }).join('');
  }

  const res = computeATP250BracketForTourneyWeek(chosenTourney, targetYear);
  atp250ModalState = {
    tourneyId: chosenTourney.id,
    year: targetYear,
    activeRoundIdx: 0,
    details: res ? res.leadBracketDetails : null,
    tourneyObj: chosenTourney,
    leadTourneyName: res ? res.leadTourneyName : 'ATP 250'
  };

  renderATP250ModalContent();
  modal.classList.add('open');
}

export function changeATP250ModalTourney(tourneyId) {
  const targetYear = atp250ModalState.year || viewingYear || currentTourYear;
  const yearTourneys = getSeasonTournaments(targetYear, tournaments);
  const chosenTourney = yearTourneys.find(t => t.id === tourneyId);
  if (!chosenTourney) return;
  const res = computeATP250BracketForTourneyWeek(chosenTourney, targetYear);
  atp250ModalState = {
    tourneyId: chosenTourney.id,
    year: targetYear,
    activeRoundIdx: 0,
    details: res ? res.leadBracketDetails : null,
    tourneyObj: chosenTourney,
    leadTourneyName: res ? res.leadTourneyName : 'ATP 250'
  };
  renderATP250ModalContent();
}

export function switchATP250ModalRound(rIdx) {
  atp250ModalState.activeRoundIdx = Number(rIdx) || 0;
  renderATP250ModalContent();
}

export function renderRoundTabs() {
  const container = document.getElementById('roundTabs');
  if (!container) return;
  const isOlympics = Boolean(activeTourney && (activeTourney.id === 'olympics' || activeTourney.type === 'Олимпиада' || activeTourney.isOlympics));

  if (!currentDraw || currentDraw.length === 0) {
    if (isOlympics) {
      const olyData = buildOlympicDelegationsData();
      container.innerHTML = `
        <button type="button" role="tab" aria-selected="${activeRoundIdx === 0}" class="round-tab ${activeRoundIdx === 0 ? 'active' : ''}" onclick="changeRound(0)">
          🎲 Сетка турнира
        </button>
        <button type="button" role="tab" aria-selected="${activeRoundIdx === 'teams'}" class="round-tab ${activeRoundIdx === 'teams' ? 'active' : ''}" onclick="changeRound('teams')" style="border-color: rgba(245, 158, 11, 0.45); color: var(--gold);">
          🌍 Сборные и участники ОИ (${olyData.countries.length} стран · ${olyData.totalPlayers} уч.)
        </button>
      `;
    } else {
      container.innerHTML = '';
    }
    return;
  }

  let names;
  if (activeTourney.id === 'finals') names = rNamesFinals;
  else if (activeTourney.id === 'olympics') names = rNamesOlympics;
  else if (currentDraw.length === 7) names = rNames128;
  else if (currentDraw.length === 6) names = rNames64;
  else names = rNames32;

  const roundButtonsHtml = currentDraw.map((r, idx) => `
    <button type="button" role="tab" aria-selected="${idx === activeRoundIdx}" class="round-tab ${idx === activeRoundIdx ? 'active' : ''}" onclick="changeRound(${idx})">
      ${names[idx] || `Раунд ${idx + 1}`}
    </button>
  `).join('');

  if (isOlympics) {
    const olyData = buildOlympicDelegationsData();
    const teamsBtnHtml = `
      <button type="button" role="tab" aria-selected="${activeRoundIdx === 'teams'}" class="round-tab ${activeRoundIdx === 'teams' ? 'active' : ''}" onclick="changeRound('teams')" style="border-color: rgba(245, 158, 11, 0.45); color: ${activeRoundIdx === 'teams' ? '#fff' : 'var(--gold)'};">
        🌍 Сборные и квоты ОИ (${olyData.countries.length} стран · ${olyData.totalPlayers} уч.)
      </button>
    `;
    container.innerHTML = roundButtonsHtml + teamsBtnHtml;
  } else {
    container.innerHTML = roundButtonsHtml;
  }
}

export function changeRound(idx) {
  activeRoundIdx = idx;
  renderRoundTabs();
  renderMatches();
}

// РАЗДЕЛ 4: Номера посева строго в допустимых границах категории турнира (ТБШ: 1..32, Мастерс/ОИ: 1..16, ATP 500/Finals: 1..8)
function getPlayerSeedOrEntryTag(p) {
  if (!p) return '';
  const maxSeed = activeTourney?.id === 'finals'
    ? 8
    : (activeTourney?.size === 128 ? 32 : (activeTourney?.size === 64 ? 16 : 8));
  if (p.seedNum && p.seedNum >= 1 && p.seedNum <= maxSeed) {
    return `<span class="seed-tag">(${p.seedNum})</span>`;
  }
  if (p.entryTag) return `<span class="entry-tag">[${p.entryTag}]</span>`;
  return '';
}

export function renderMatches() {
  const container = document.getElementById('matchesContainer');
  const tablesContainer = document.getElementById('finalsGroupTablesContainer');
  if (!container || !tablesContainer) return;
  container.innerHTML = '';

  const isOlympics = Boolean(activeTourney && (activeTourney.id === 'olympics' || activeTourney.type === 'Олимпиада' || activeTourney.isOlympics));
  if (isOlympics && activeRoundIdx === 'teams') {
    tablesContainer.style.display = 'none';
    container.innerHTML = renderOlympicDelegationsContentHtml('tab');
    return;
  }

  if (!currentDraw || currentDraw.length === 0) {
    tablesContainer.style.display = 'none';
    const isFutureLocked = isFutureLockedTournament(activeTourney, viewingYear);
    const startDay = String(activeTourney?.startDay || 2).padStart(2, '0');
    const startMonth = String((activeTourney?.startMonth || 0) + 1).padStart(2, '0');
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 54px 20px; color: var(--text-dim); background: var(--card-bg); border: 1px dashed var(--border); border-radius: 8px;">
        <div style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">
          ${isFutureLocked
            ? `🔒 Турнир «${activeTourney ? activeTourney.name : ''}» ожидает своей даты в календаре (${startDay}.${startMonth}.${viewingYear})`
            : `Сетка турнира «${activeTourney ? activeTourney.name : ''}» еще не сформирована`}
        </div>
        <div style="font-size: 13px; margin-bottom: 14px;">
          ${isFutureLocked
            ? 'Последовательно завершите предыдущие турниры сезона (или запустите «⚡ Пробная симуляция сезона»), чтобы открыть жеребьевку этого турнира.'
            : (isOlympics
              ? 'Нажмите <b>«🎲 Жеребьевка»</b>, чтобы провести олимпийский отбор (64 игрока, максимум 4 представителя от одной страны, Матч за 3-е место и Финал).'
              : 'Нажмите <b>«🎲 Жеребьевка»</b>, чтобы сформировать турнирную сетку с учетом посева и рейтинга.')}
        </div>
        <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="btn-green" ${isFutureLocked ? 'disabled' : ''} onclick="generateRealisticDraw()">${isFutureLocked ? `🔒 Ожидается ${startDay}.${startMonth}` : '🎲 Провести жеребьевку'}</button>
          ${isOlympics ? `<button type="button" class="btn-gold" onclick="changeRound('teams')">🌍 Посмотреть заявленные страны и составы ОИ</button>` : ''}
        </div>
      </div>
    `;
    return;
  }

  const refDateStr = viewingYear < currentTourYear ? `${viewingYear}-06-15` : currentTourDateStr;

  if (activeTourney.id === 'finals') {
    tablesContainer.style.display = 'block';
    const groupAStats = calculateGroupStandings(currentDraw[0]);
    const groupBStats = calculateGroupStandings(currentDraw[1]);

    function makeTableHtml(title, list) {
      return `
        <div style="flex: 1; min-width: 300px;">
          <h4 style="margin-bottom: 6px; color: var(--accent); font-size: 14px;">${title}</h4>
          <table class="finals-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Игрок</th>
                <th>Матчи</th>
                <th>Сеты</th>
                <th>Геймы</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((st, i) => `
                <tr class="${i < 2 ? 'qualified-row' : ''}">
                  <td><b>${i + 1}</b></td>
                  <td>
                    ${renderFlagBadge(st.player.flag, { compact: true })} <span class="player-profile-link" onclick="openPlayerProfileModal('${st.player.id}')">${st.player.name}</span>
                    <span class="player-age-tag">${calculateAge(st.player.birthDate, refDateStr)}</span>
                    ${i < 2 ? '<span style="color:var(--primary); font-size:11px; margin-left:4px;">· 1/2 финала</span>' : ''}
                  </td>
                  <td><b>${st.wins}</b> - ${st.losses}</td>
                  <td>${st.setsW}-${st.setsL}</td>
                  <td>${st.gamesW}-${st.gamesL}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    tablesContainer.innerHTML = `
      <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        ${makeTableHtml('Таблица Группы А', groupAStats)}
        ${makeTableHtml('Таблица Группы Б', groupBStats)}
      </div>
    `;

    const isGroupAComplete = currentDraw[0].every(m => m.winner);
    const isGroupBComplete = currentDraw[1].every(m => m.winner);
    if (isGroupAComplete && isGroupBComplete && groupAStats.length >= 2 && groupBStats.length >= 2) {
      currentDraw[2][0].p1 = groupAStats[0].player;
      currentDraw[2][0].p2 = groupBStats[1].player;
      currentDraw[2][1].p1 = groupBStats[0].player;
      currentDraw[2][1].p2 = groupAStats[1].player;
    }
  } else {
    tablesContainer.style.display = 'none';
  }

  const matches = currentDraw[activeRoundIdx] || [];
  matches.forEach((m, idx) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'match-card';
    if (m.isGoldMatch) card.classList.add('olympic-gold-card');
    if (m.isBronzeMatch) card.classList.add('olympic-bronze-card');

    const matchLabel = m.stageLabel || `${m.group ? m.group + ' · ' : ''}Матч #${idx + 1}`;
    card.setAttribute('aria-label', `${matchLabel}: ${m.p1 ? m.p1.name : 'TBD'} против ${m.p2 ? m.p2.name : 'TBD'}`);
    card.onclick = () => openScoreModal(activeRoundIdx, idx);

    const p1Win = m.winner && m.p1 && m.winner.id === m.p1.id;
    const p2Win = m.winner && m.p2 && m.winner.id === m.p2.id;
    const scoreHtml = m.score && m.score.length > 0
      ? formatTennisScore(m.score)
      : (m.winner ? 'W/O' : 'Ввести счет ✍️');

    const p1Live = m.p1 ? (players.find(x => x.id === m.p1.id) || players.find(x => x.name && m.p1.name && x.name.toLowerCase() === m.p1.name.toLowerCase()) || m.p1) : null;
    const p2Live = m.p2 ? (players.find(x => x.id === m.p2.id) || players.find(x => x.name && m.p2.name && x.name.toLowerCase() === m.p2.name.toLowerCase()) || m.p2) : null;
    const p1ForStamina = p1Live ? { ...p1Live, stamina: typeof m.p1?.stamina === 'number' ? m.p1.stamina : p1Live.stamina } : null;
    const p2ForStamina = p2Live ? { ...p2Live, stamina: typeof m.p2?.stamina === 'number' ? m.p2.stamina : p2Live.stamina } : null;

    let medalBadgeP1 = '';
    let medalBadgeP2 = '';
    if (m.isGoldMatch && m.winner) {
      medalBadgeP1 = p1Win ? ' 🥇' : ' 🥈';
      medalBadgeP2 = p2Win ? ' 🥇' : ' 🥈';
    } else if (m.isBronzeMatch && m.winner) {
      medalBadgeP1 = p1Win ? ' 🥉' : '';
      medalBadgeP2 = p2Win ? ' 🥉' : '';
    }

    const p1NameHtml = m.p1
      ? `<span class="player-name player-profile-link" onclick="event.stopPropagation(); openPlayerProfileModal('${m.p1.id}')" title="Профиль игрока">${m.p1.name}${medalBadgeP1}</span>`
      : `<span class="player-name">—</span>`;
    const p2NameHtml = m.p2
      ? `<span class="player-name player-profile-link" onclick="event.stopPropagation(); openPlayerProfileModal('${m.p2.id}')" title="Профиль игрока">${m.p2.name}${medalBadgeP2}</span>`
      : `<span class="player-name">—</span>`;

    card.innerHTML = `
      <div style="font-size: 11px; color: ${m.isGoldMatch ? 'var(--gold)' : (m.isBronzeMatch ? '#fb923c' : 'var(--text-dim)')}; font-weight: ${m.stageLabel ? '700' : '500'}; margin-bottom: 4px; display: flex; justify-content: space-between;">
        <span>${matchLabel}</span>
        <span>${m.winner ? 'Завершен' : 'Ожидает'}</span>
      </div>
      <div class="match-player ${p1Win ? 'winner' : ''}">
        <div class="player-info">
          <span style="min-width: 38px; flex-shrink: 0; display: inline-flex; align-items: center;">${m.p1 ? renderFlagBadge(p1Live?.flag || m.p1.flag, { compact: true }) : ''}</span>
          ${p1NameHtml}
          ${p1Live ? renderPlayerMedalsHtml(p1Live) : ''}
          <span class="player-age-tag">${m.p1 ? calculateAge(m.p1.birthDate, refDateStr) : ''}</span>
          ${getPlayerSeedOrEntryTag(m.p1)}
          ${p1ForStamina ? renderStaminaInlineBadge(p1ForStamina) : ''}
        </div>
      </div>
      <div class="match-player ${p2Win ? 'winner' : ''}">
        <div class="player-info">
          <span style="min-width: 38px; flex-shrink: 0; display: inline-flex; align-items: center;">${m.p2 ? renderFlagBadge(p2Live?.flag || m.p2.flag, { compact: true }) : ''}</span>
          ${p2NameHtml}
          ${p2Live ? renderPlayerMedalsHtml(p2Live) : ''}
          <span class="player-age-tag">${m.p2 ? calculateAge(m.p2.birthDate, refDateStr) : ''}</span>
          ${getPlayerSeedOrEntryTag(m.p2)}
          ${p2ForStamina ? renderStaminaInlineBadge(p2ForStamina) : ''}
        </div>
      </div>
      <div class="match-score" style="text-align: right; margin-top: 6px;">${scoreHtml}</div>
      ${m.narrative ? `<div class="match-card-narrative">💬 ${m.narrative}</div>` : ''}
    `;
    container.appendChild(card);
  });
}

// --- 4. ИНТЕРФЕЙС МАТЧА, КАРТОЧКИ ULTIMATE TEAM, SPIDER CHART, MOMENTUM BAR И H2H ---
function getSurfaceTextClass(surf) {
  if (surf === 'Хард') return 'surface-text-hard';
  if (surf === 'Грунт') return 'surface-text-clay';
  if (surf === 'Трава') return 'surface-text-grass';
  return 'surface-text-indoor';
}

export function renderStaminaInlineBadge(player) {
  if (!player) return '';
  const st = typeof player.stamina === 'number' && !Number.isNaN(player.stamina) ? Math.round(player.stamina) : 100;
  let cls = '';
  if (st <= 48) cls = 'stamina-crit';
  else if (st <= 74) cls = 'stamina-warn';
  return `<span class="stamina-badge-inline ${cls}" title="Физическая выносливость (Stamina)">⚡${st}%</span>`;
}

export function handleUtCardMouseMove(event, cardEl) {
  if (!cardEl || cardEl.getAttribute('data-top20') !== 'true') return;
  const rect = cardEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const relX = (event.clientX - rect.left) / rect.width;
  const relY = (event.clientY - rect.top) / rect.height;
  const rotY = ((relX - 0.5) * 18).toFixed(2);
  const rotX = ((0.5 - relY) * 16).toFixed(2);
  cardEl.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.015, 1.015, 1.015)`;
  const glareEl = cardEl.querySelector('.ut-glare');
  if (glareEl) {
    glareEl.style.setProperty('--glare-x', `${Math.round(relX * 100)}%`);
    glareEl.style.setProperty('--glare-y', `${Math.round(relY * 100)}%`);
  }
}

export function handleUtCardMouseLeave(cardEl) {
  if (!cardEl) return;
  cardEl.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
}

const playerCardAnalyticsCache = new Map();
let cardAnalyticsCacheVersion = 0;

export function invalidatePlayerCardAnalyticsCache() {
  playerCardAnalyticsCache.clear();
  cardAnalyticsCacheVersion++;
}

/**
 * ШАГ 2: Быстрый сбор реальной клатч-статистики, формы и титулов игрока из сохраненных сеток тура
 */
export function getPlayerLiveCardAnalytics(player) {
  if (!player || (!player.id && !player.name)) {
    return {
      surfaceRecord: { 'Хард': { w: 0, l: 0 }, 'Грунт': { w: 0, l: 0 }, 'Трава': { w: 0, l: 0 }, 'Зал': { w: 0, l: 0 } },
      tbWins: 0,
      tbLosses: 0,
      deciderWins: 0,
      deciderLosses: 0,
      last5Matches: [],
      winStreak: 0,
      bestSurface: 'Хард',
      hasGiantKill: false,
      titlesBySurface: { 'Хард': 0, 'Грунт': 0, 'Трава': 0, 'Зал': 0 }
    };
  }

  const pIdStr = String(player.id || '');
  const pNameLower = String(player.name || '').trim().toLowerCase();
  const targetYear = viewingYear || currentTourYear || 2024;
  const cacheKey = `${pIdStr || pNameLower}_${targetYear}_v${cardAnalyticsCacheVersion}`;
  if (playerCardAnalyticsCache.has(cacheKey)) {
    return playerCardAnalyticsCache.get(cacheKey);
  }

  const surfaceRecord = {
    'Хард': { w: 0, l: 0 },
    'Грунт': { w: 0, l: 0 },
    'Трава': { w: 0, l: 0 },
    'Зал': { w: 0, l: 0 }
  };
  const titlesBySurface = {
    'Хард': 0,
    'Грунт': 0,
    'Трава': 0,
    'Зал': 0
  };
  let tbWins = 0;
  let tbLosses = 0;
  let deciderWins = 0;
  let deciderLosses = 0;
  let hasGiantKill = false;

  const isPlayerMatch = (m) => {
    if (!m || !m.p1 || !m.p2 || !m.winner) return null;
    const isP1 = (pIdStr && String(m.p1.id) === pIdStr) || (pNameLower && m.p1.name && m.p1.name.trim().toLowerCase() === pNameLower);
    const isP2 = (pIdStr && String(m.p2.id) === pIdStr) || (pNameLower && m.p2.name && m.p2.name.trim().toLowerCase() === pNameLower);
    if (!isP1 && !isP2) return null;
    return { isP1, isP2 };
  };

  const scanYear = (yr) => {
    const seasonTourneys = getSeasonTournaments(yr, FULL_CALENDAR_TEMPLATE);
    const matches = [];
    seasonTourneys.forEach(t => {
      const d = readSavedDraw(t.id, yr);
      if (!Array.isArray(d) || d.length === 0) return;
      const surf = surfaceRecord[t.surface] ? t.surface : 'Хард';

      d.forEach((round, rIdx) => {
        if (!Array.isArray(round)) return;
        const isFinalRound = rIdx === d.length - 1;

        round.forEach((m, mIdx) => {
          const matchCheck = isPlayerMatch(m);
          if (!matchCheck) return;

          const { isP1 } = matchCheck;
          const mySlot = isP1 ? m.p1 : m.p2;
          const oppSlot = isP1 ? m.p2 : m.p1;
          const won = (pIdStr && String(m.winner.id) === pIdStr) ||
                      (pNameLower && m.winner.name && m.winner.name.trim().toLowerCase() === pNameLower);

          const myRank = Number(mySlot?.rank || player.rank) || 100;
          const oppRank = Number(oppSlot?.rank) || 100;

          const rawSets = Array.isArray(m.score)
            ? m.score
            : (typeof m.score === 'string' ? m.score.trim().split(/\s+/).filter(Boolean) : []);
          const mySets = isP1 ? rawSets : flipTennisScoreSets(rawSets);

          matches.push({
            year: yr,
            tourneyId: t.id,
            tourneyName: t.name,
            surface: surf,
            won,
            myRank,
            oppRank,
            opponentName: oppSlot?.name || 'Соперник',
            mySets,
            score: mySets.join(' '),
            isFinalMatch: isFinalRound && mIdx === 0,
            bestOf: t.bestOf || (t.isGrandSlam ? 5 : 3)
          });
        });
      });
    });
    return matches;
  };

  let allMatches = scanYear(targetYear);
  if (allMatches.length < 5 && targetYear > 2023) {
    const prevMatches = scanYear(targetYear - 1);
    allMatches = [...prevMatches, ...allMatches];
  }

  allMatches.forEach(m => {
    if (m.won) {
      surfaceRecord[m.surface].w++;
      if (m.isFinalMatch) {
        titlesBySurface[m.surface] = (titlesBySurface[m.surface] || 0) + 1;
      }
      if (m.myRank >= m.oppRank + 15) {
        hasGiantKill = true;
      }
    } else {
      surfaceRecord[m.surface].l++;
    }

    (m.mySets || []).forEach(setStr => {
      const trimmed = String(setStr).trim();
      if (trimmed.startsWith('7-6')) {
        tbWins++;
      } else if (trimmed.startsWith('6-7')) {
        tbLosses++;
      }
    });

    const finishedSetsCount = (m.mySets || []).filter(s => !String(s).toUpperCase().includes('RET')).length;
    if (m.bestOf === 3 && finishedSetsCount >= 3) {
      if (m.won) deciderWins++;
      else deciderLosses++;
    } else if (m.bestOf === 5 && finishedSetsCount >= 5) {
      if (m.won) deciderWins++;
      else deciderLosses++;
    }
  });

  let winStreak = 0;
  for (let i = allMatches.length - 1; i >= 0; i--) {
    if (allMatches[i].won) {
      winStreak++;
    } else {
      break;
    }
  }

  const last5Matches = allMatches.slice(-5);

  let bestSurface = 'Хард';
  let bestWinRate = -1;
  let maxWins = -1;

  for (const [sName, rec] of Object.entries(surfaceRecord)) {
    const total = rec.w + rec.l;
    if (total >= 3) {
      const rate = rec.w / total;
      if (rate > bestWinRate || (rate === bestWinRate && rec.w > maxWins)) {
        bestWinRate = rate;
        maxWins = rec.w;
        bestSurface = sName;
      }
    }
  }

  if (bestWinRate < 0) {
    let topW = -1;
    for (const [sName, rec] of Object.entries(surfaceRecord)) {
      if (rec.w > topW) {
        topW = rec.w;
        bestSurface = sName;
      }
    }
  }

  const result = {
    surfaceRecord,
    tbWins,
    tbLosses,
    deciderWins,
    deciderLosses,
    last5Matches,
    winStreak,
    bestSurface,
    hasGiantKill,
    titlesBySurface
  };

  playerCardAnalyticsCache.set(cacheKey, result);
  return result;
}

/**
 * ШАГ 3: Карточка теннисиста с 5 реальными покрытиями/клатчем, бейджами формы и клатч-досье
 */
export function renderUltimateTeamCardHtml(player, surface = 'Хард', options = {}) {
  if (!player) return '';
  const refDateStr = options.refDateStr || (viewingYear < currentTourYear ? `${viewingYear}-06-15` : currentTourDateStr);
  const liveStats = options.liveStats || getPlayerLiveCardAnalytics(player);
  const skills = getPlayerSkills(player, surface, refDateStr, liveStats);
  const rank = Number(player.rank) || 150;
  const isTop20 = rank <= 20;

  let tierClass = 'ut-card-tier-silver';
  let tierRibbon = 'PRO TOUR CARD';
  if (rank <= 3) {
    tierClass = 'ut-card-tier-icon';
    tierRibbon = '👑 TOTY ICON · TOP-3';
  } else if (rank <= 20) {
    tierClass = 'ut-card-tier-gold';
    tierRibbon = '✨ HOLO GOLD · TOP-20';
  } else if (rank <= 100) {
    tierClass = 'ut-card-tier-emerald';
    tierRibbon = '💎 EMERALD · TOP-100';
  }

  const liveStamina = typeof player.stamina === 'number' && !Number.isNaN(player.stamina) ? Math.round(player.stamina) : 100;
  const staminaColor = liveStamina <= 48 ? '#ef4444' : (liveStamina <= 74 ? '#f59e0b' : '#10b981');

  const archetypesHtml = (skills.archetypes || []).map(arch => {
    const label = arch.titleRu || arch.title || arch.enTitle || 'Мастер корта';
    const desc = arch.description || arch.desc || label;
    return `
      <span class="ut-archetype-pill" title="${String(desc).replace(/"/g, '&quot;')}">
        <span>${arch.icon || '⚡'}</span>
        <span>${label}</span>
      </span>
    `;
  }).join('');

  const formBadgesHtml = [0, 1, 2, 3, 4].map(idx => {
    const m = liveStats?.last5Matches?.[idx];
    if (m) {
      const cls = m.won ? 'badge-win' : 'badge-loss';
      const char = m.won ? 'В' : 'П';
      const tip = `${m.won ? 'Победа' : 'Поражение'} vs ${m.opponentName || 'Соперник'} (${m.score || ''}) · ${m.tourneyName || ''} [${m.surface || ''}]`;
      return `<span class="ut-form-badge ${cls}" title="${String(tip).replace(/"/g, '&quot;')}">${char}</span>`;
    }
    return `<span class="ut-form-badge badge-empty" title="Матч еще не сыгран">—</span>`;
  }).join('');

  const tbText = `ТБ: ${liveStats?.tbWins || 0}-${liveStats?.tbLosses || 0}`;
  const deciderText = `Реш: ${liveStats?.deciderWins || 0}-${liveStats?.deciderLosses || 0}`;
  const specText = `Спец: ${liveStats?.bestSurface || surface}`;

  return `
    <div class="ut-card-perspective-wrap">
      <div class="ut-card ${tierClass} ${isTop20 ? 'ut-card-top20' : ''}"
           data-top20="${isTop20 ? 'true' : 'false'}"
           onmousemove="handleUtCardMouseMove(event, this)"
           onmouseleave="handleUtCardMouseLeave(this)">
        <div class="ut-glare"></div>
        <div class="ut-card-top-row">
          <div class="ut-ovr-box" title="Общий рейтинг игрока (OVR 65–99)">
            <span class="ut-ovr-num">${skills.ovr}</span>
            <span class="ut-ovr-label">OVR</span>
          </div>
          <div class="ut-player-identity">
            <div class="ut-tier-ribbon">${tierRibbon}</div>
            <div class="ut-player-title">
              <span>${renderFlagBadge(player.flag || 'ATP', { compact: true })}</span>
              <span class="player-profile-link" onclick="event.stopPropagation(); openPlayerProfileModal('${player.id}')">${player.name}</span>
              ${renderPlayerMedalsHtml(player)}
            </div>
            <div class="ut-player-sub">
              ATP #${rank} · ${calculateAge(player.birthDate, refDateStr)}${player.nickname ? ` · <span style="color:var(--gold);">«${player.nickname}»</span>` : ''}
            </div>
          </div>
        </div>

        <div class="ut-stats-grid">
          <div class="ut-stat-cell ${surface === 'Хард' ? 'ut-stat-active-surface' : ''}" title="Хард (Hard Court)">
            <span class="ut-stat-lbl">HRD</span>
            <span class="ut-stat-val" style="color: ${skills.hard >= 90 ? 'var(--gold)' : 'var(--text-main)'};">${skills.hard}</span>
          </div>
          <div class="ut-stat-cell ${surface === 'Грунт' ? 'ut-stat-active-surface' : ''}" title="Грунт (Clay Court)">
            <span class="ut-stat-lbl">CLY</span>
            <span class="ut-stat-val" style="color: ${skills.clay >= 90 ? 'var(--gold)' : 'var(--text-main)'};">${skills.clay}</span>
          </div>
          <div class="ut-stat-cell ${surface === 'Трава' ? 'ut-stat-active-surface' : ''}" title="Трава (Grass Court)">
            <span class="ut-stat-lbl">GRS</span>
            <span class="ut-stat-val" style="color: ${skills.grass >= 90 ? 'var(--gold)' : 'var(--text-main)'};">${skills.grass}</span>
          </div>
          <div class="ut-stat-cell ${surface === 'Зал' ? 'ut-stat-active-surface' : ''}" title="Зал (Indoor Hard / Carpet)">
            <span class="ut-stat-lbl">IND</span>
            <span class="ut-stat-val" style="color: ${skills.indoor >= 90 ? 'var(--gold)' : 'var(--text-main)'};">${skills.indoor}</span>
          </div>
          <div class="ut-stat-cell" title="Клатч: тай-брейки и решающие сеты (Clutch)">
            <span class="ut-stat-lbl">CLT</span>
            <span class="ut-stat-val" style="color: ${skills.clutch >= 90 ? 'var(--accent)' : 'var(--text-main)'};">${skills.clutch}</span>
          </div>
        </div>

        <div class="ut-live-dossier-row">
          <div class="ut-dossier-top-line">
            <div class="ut-form-badges-wrap">
              <span class="ut-dossier-label">ФОРМА:</span>
              <div class="ut-form-badges">
                ${formBadgesHtml}
              </div>
            </div>
            <div class="ut-dossier-spec" style="white-space: nowrap; font-size: 11px;">
              Спец: <b>${liveStats?.bestSurface || surface}</b>
            </div>
          </div>
          <div class="ut-dossier-bottom-line">
            <span style="white-space: nowrap;">Тай-брейки: <b>${liveStats?.tbWins || 0}–${liveStats?.tbLosses || 0}</b></span>
            <span style="white-space: nowrap;">Реш. сеты: <b>${liveStats?.deciderWins || 0}–${liveStats?.deciderLosses || 0}</b></span>
          </div>
        </div>

        <div class="ut-archetype-badges">
          ${archetypesHtml}
        </div>

        <div class="ut-stamina-row">
          <span style="color: var(--text-dim); font-weight: 700;">⚡ Энергия к матчу:</span>
          <div class="stamina-meter-bar">
            <div class="stamina-meter-fill" style="width: ${liveStamina}%; background: ${staminaColor};"></div>
          </div>
          <b style="color: ${staminaColor}; font-family: 'JetBrains Mono', monospace;">${liveStamina}%</b>
        </div>
      </div>
    </div>
  `;
}

/**
 * ШАГ 3: Радар навыков со шкалами Hard, Clay, Grass, Indoor, Clutch
 */
export function renderSpiderChartSvg(p1Skills, p2Skills, p1Name, p2Name) {
  const axes = [
    { key: 'hard', label: 'Хард' },
    { key: 'clay', label: 'Грунт' },
    { key: 'grass', label: 'Трава' },
    { key: 'indoor', label: 'Зал' },
    { key: 'clutch', label: 'Клатч' }
  ];
  const cx = 105;
  const cy = 96;
  const maxR = 64;

  const angleForIdx = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
  const valToRadius = (val) => {
    const clamped = Math.max(50, Math.min(99, Number(val) || 75));
    return ((clamped - 45) / 55) * maxR;
  };

  const gridLevels = [0.35, 0.68, 1.0];
  const gridPolygons = gridLevels.map(lvl => {
    const pts = axes.map((_, i) => {
      const a = angleForIdx(i);
      const r = maxR * lvl;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="rgba(156, 163, 175, 0.2)" stroke-width="1" />`;
  }).join('');

  const axisLinesAndLabels = axes.map((ax, i) => {
    const a = angleForIdx(i);
    const xEnd = (cx + maxR * Math.cos(a)).toFixed(1);
    const yEnd = (cy + maxR * Math.sin(a)).toFixed(1);
    const lblR = maxR + 18;
    const lx = (cx + lblR * Math.cos(a)).toFixed(1);
    const ly = (cy + lblR * Math.sin(a) + 3).toFixed(1);
    return `
      <line x1="${cx}" y1="${cy}" x2="${xEnd}" y2="${yEnd}" stroke="rgba(156, 163, 175, 0.22)" stroke-width="1" />
      <text x="${lx}" y="${ly}" fill="#9ca3af" font-size="9.5" font-weight="700" text-anchor="middle">${ax.label}</text>
    `;
  }).join('');

  const buildPlayerPoly = (skillsObj) => axes.map((ax, i) => {
    const a = angleForIdx(i);
    const r = valToRadius(skillsObj?.[ax.key] || 75);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

  const p1Pts = buildPlayerPoly(p1Skills);
  const p2Pts = buildPlayerPoly(p2Skills);

  const shortP1 = String(p1Name || 'Игрок 1').split(' ').pop();
  const shortP2 = String(p2Name || 'Игрок 2').split(' ').pop();

  return `
    <div class="spider-chart-box">
      <div style="font-size: 10.5px; font-weight: 800; color: var(--gold); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">
        🕸️ Радар навыков (55–98)
      </div>
      <svg style="width: 100%; max-width: 172px; height: auto;" viewBox="0 0 210 186" aria-label="Spider Chart сравнения игроков">
        ${gridPolygons}
        ${axisLinesAndLabels}
        <polygon points="${p2Pts}" fill="rgba(249, 115, 22, 0.30)" stroke="#f97316" stroke-width="2" />
        <polygon points="${p1Pts}" fill="rgba(56, 189, 248, 0.32)" stroke="#38bdf8" stroke-width="2" />
      </svg>
      <div class="spider-chart-legend">
        <span style="color: #38bdf8;"><i class="spider-legend-dot" style="background:#38bdf8;"></i>${shortP1}</span>
        <span style="color: #f97316;"><i class="spider-legend-dot" style="background:#f97316;"></i>${shortP2}</span>
      </div>
    </div>
  `;
}

export function updateMomentumBarUI(scoresOrStr, p1Name = 'Игрок 1', p2Name = 'Игрок 2') {
  const container = document.getElementById('matchMomentumContainer');
  if (!container) return;
  const p1Pct = computeMatchMomentumPercent(scoresOrStr);
  const p2Pct = 100 - p1Pct;

  let statusText = '⚖️ Равная борьба за инициативу (50 / 50)';
  if (p1Pct >= 62) {
    statusText = `🔥 Доминирование на корте: ${p1Name} (${p1Pct}%)`;
  } else if (p2Pct >= 62) {
    statusText = `🔥 Доминирование на корте: ${p2Name} (${p2Pct}%)`;
  } else if (p1Pct > 51) {
    statusText = `⚡ Небольшой перевес: ${p1Name} (${p1Pct}% / ${p2Pct}%)`;
  } else if (p2Pct > 51) {
    statusText = `⚡ Небольшой перевес: ${p2Name} (${p1Pct}% / ${p2Pct}%)`;
  }

  container.innerHTML = `
    <div class="momentum-header-row">
      <span style="color: #38bdf8;">🔵 ${p1Name} (${p1Pct}%)</span>
      <span style="color: var(--gold); font-size: 11px;">📺 MOMENTUM BAR · ${statusText}</span>
      <span style="color: #f97316;">${p2Name} (${p2Pct}%) 🟠</span>
    </div>
    <div class="momentum-track">
      <div class="momentum-fill-p1" style="width: ${p1Pct}%;"></div>
      <div class="momentum-center-tick"></div>
    </div>
  `;
}

export function handleLiveScoreInputForMomentum() {
  if (!activeMatchScore || !activeMatchScore.match) return;
  const val = document.getElementById('quickScoreStr')?.value || '';
  updateMomentumBarUI(val, activeMatchScore.match.p1.name, activeMatchScore.match.p2.name);
}

function renderMatchAiReportBlock(storyline = '', winnerQuote = '', loserQuote = '', winnerName = 'Победитель', loserName = 'Соперник', sourceLabel = 'ИИ-репортаж (Groq / Llama 3.3)') {
  const reportCard = document.getElementById('aiMatchReportCard');
  const narrativeBox = document.getElementById('aiMatchNarrative');
  const quotesBox = document.getElementById('aiMatchQuotes');

  const hasContent = Boolean(storyline || winnerQuote || loserQuote);
  if (reportCard) {
    reportCard.style.display = hasContent ? 'block' : 'none';
  }

  if (narrativeBox) {
    if (storyline) {
      narrativeBox.style.display = 'block';
      narrativeBox.innerHTML = `🧠 <b>${sourceLabel}:</b> <em>«${storyline}»</em>`;
    } else {
      narrativeBox.style.display = 'none';
      narrativeBox.innerHTML = '';
    }
  }

  if (quotesBox) {
    if (winnerQuote || loserQuote) {
      quotesBox.style.display = 'flex';
      quotesBox.innerHTML = `
        ${winnerQuote ? `<div class="ai-quote-item"><small>🎙️ ${winnerName} (Победитель):</small> ${winnerQuote}</div>` : ''}
        ${loserQuote ? `<div class="ai-quote-item"><small>🎙️ ${loserName}:</small> ${loserQuote}</div>` : ''}
      `;
    } else {
      quotesBox.style.display = 'none';
      quotesBox.innerHTML = '';
    }
  }
}

export function setMatchCommentaryMode(enabled) {
  includeMatchCommentaryMode = Boolean(enabled);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('meta_include_match_comments_v1', includeMatchCommentaryMode ? 'true' : 'false');
    }
  } catch {
    // ignore
  }
  updateMatchCommentaryModeUI();
  if (!includeMatchCommentaryMode) {
    renderMatchAiReportBlock('', '', '');
  } else if (activeMatchScore && activeMatchScore.match && (pendingAiNarrative || pendingWinnerQuote || pendingLoserQuote)) {
    const m = activeMatchScore.match;
    const wName = m.winner ? m.winner.name : m.p1.name;
    const lName = m.winner ? (m.winner.id === m.p1.id ? m.p2.name : m.p1.name) : m.p2.name;
    renderMatchAiReportBlock(pendingAiNarrative, pendingWinnerQuote, pendingLoserQuote, wName, lName, pendingAiSourceLabel);
  }
}

function updateMatchCommentaryModeUI() {
  const btnWith = document.getElementById('btnModeWithComments');
  const btnOnly = document.getElementById('btnModeScoreOnly');
  if (btnWith) {
    btnWith.classList.toggle('active-mode-pill', includeMatchCommentaryMode);
  }
  if (btnOnly) {
    btnOnly.classList.toggle('active-mode-pill', !includeMatchCommentaryMode);
  }
}

export function openScoreModal(rIdx, mIdx) {
  const match = currentDraw[rIdx]?.[mIdx];
  if (!match || !match.p1 || !match.p2) {
    showToast('⚠️ Участники этого матча еще не определены в сетке!');
    return;
  }

  activeMatchScore = { rIdx, mIdx, match };
  pendingAiNarrative = match.storyline || match.narrative || '';
  pendingWinnerQuote = match.winnerQuote || '';
  pendingLoserQuote = match.loserQuote || '';
  pendingAiSourceLabel = match.aiSourceLabel || 'Сводка матча';

  updateMatchCommentaryModeUI();

  const errEl = document.getElementById('scoreInputError');
  if (errEl) {
    errEl.className = 'error-text';
    errEl.style.display = 'none';
  }
  const confirmBox = document.getElementById('resetMatchConfirmBox');
  if (confirmBox) confirmBox.style.display = 'none';

  const wName = match.winner ? match.winner.name : match.p1.name;
  const lName = match.winner ? (match.winner.id === match.p1.id ? match.p2.name : match.p1.name) : match.p2.name;
  if (includeMatchCommentaryMode) {
    renderMatchAiReportBlock(pendingAiNarrative, pendingWinnerQuote, pendingLoserQuote, wName, lName, pendingAiSourceLabel);
  } else {
    renderMatchAiReportBlock('', '', '');
  }

  const storageGetter = (tId, yr) => {
    const d = readSavedDraw(tId, yr);
    return d.length > 0 ? d : null;
  };

  // РАЗДЕЛ 4: Полная и строго изолированная аналитика очных встреч (H2H) только между этими двумя игроками
  const h2h = getHeadToHeadAnalytics(
    match.p1.id,
    match.p2.id,
    tournaments,
    Math.max(currentTourYear, viewingYear),
    storageGetter,
    match.p1.name,
    match.p2.name
  );
  const refDateStr = viewingYear < currentTourYear ? `${viewingYear}-06-15` : currentTourDateStr;

  const p1Base = players.find(p => p.id === match.p1.id) || players.find(p => p.name && match.p1.name && p.name.toLowerCase() === match.p1.name.toLowerCase()) || match.p1;
  const p2Base = players.find(p => p.id === match.p2.id) || players.find(p => p.name && match.p2.name && p.name.toLowerCase() === match.p2.name.toLowerCase()) || match.p2;
  const p1Live = { ...p1Base, stamina: typeof match.p1?.stamina === 'number' ? match.p1.stamina : (p1Base.stamina ?? 100) };
  const p2Live = { ...p2Base, stamina: typeof match.p2?.stamina === 'number' ? match.p2.stamina : (p2Base.stamina ?? 100) };
  const currentSurface = activeTourney ? activeTourney.surface : 'Хард';
  const p1LiveStats = getPlayerLiveCardAnalytics(p1Live);
  const p2LiveStats = getPlayerLiveCardAnalytics(p2Live);
  const p1Skills = getPlayerSkills(p1Live, currentSurface, refDateStr, p1LiveStats);
  const p2Skills = getPlayerSkills(p2Live, currentSurface, refDateStr, p2LiveStats);
  const totalH2H = (h2h.p1Wins || 0) + (h2h.p2Wins || 0);
  const isRivalry = totalH2H >= 2;

  let h2hHtml = `
    <div class="tv-prematch-showcase">
      ${renderUltimateTeamCardHtml(p1Live, currentSurface, { refDateStr, liveStats: p1LiveStats })}
      ${renderSpiderChartSvg(p1Skills, p2Skills, p1Live.name, p2Live.name)}
      ${renderUltimateTeamCardHtml(p2Live, currentSurface, { refDateStr, liveStats: p2LiveStats })}
    </div>

    <div class="h2h-players-banner" style="margin-top: 6px;">
      <div class="h2h-col">
        <div class="h2h-player-name">${renderFlagBadge(p1Live?.flag || match.p1.flag, { compact: true })} <span class="player-profile-link" onclick="openPlayerProfileModal('${match.p1.id}')">${match.p1.name}</span> ${renderPlayerMedalsHtml(p1Live)}</div>
        <div class="h2h-meta">Ранг: #${p1Live.rank || match.p1.rank} · OVR: <b style="color:var(--gold);">${p1Skills.ovr}</b> · Энергия: <b>${Math.round(p1Live.stamina ?? 100)}%</b></div>
      </div>
      <div class="h2h-center-score">
        <div class="h2h-label">${isRivalry ? '🔥 RIVALRY H2H' : 'H2H'}</div>
        <div class="h2h-big-score">${h2h.p1Wins} : ${h2h.p2Wins}</div>
      </div>
      <div class="h2h-col right">
        <div class="h2h-player-name">${renderPlayerMedalsHtml(p2Live)} <span class="player-profile-link" onclick="openPlayerProfileModal('${match.p2.id}')">${match.p2.name}</span> ${renderFlagBadge(p2Live?.flag || match.p2.flag, { compact: true })}</div>
        <div class="h2h-meta">Ранг: #${p2Live.rank || match.p2.rank} · OVR: <b style="color:var(--gold);">${p2Skills.ovr}</b> · Энергия: <b>${Math.round(p2Live.stamina ?? 100)}%</b></div>
      </div>
    </div>

    <div class="h2h-surface-bar">
      <span>Хард: <b>${h2h.surfaceStats['Хард'][0]}-${h2h.surfaceStats['Хард'][1]}</b></span>
      <span aria-hidden="true">|</span>
      <span>Грунт: <b>${h2h.surfaceStats['Грунт'][0]}-${h2h.surfaceStats['Грунт'][1]}</b></span>
      <span aria-hidden="true">|</span>
      <span>Трава: <b>${h2h.surfaceStats['Трава'][0]}-${h2h.surfaceStats['Трава'][1]}</b></span>
      <span aria-hidden="true">|</span>
      <span>Зал: <b>${h2h.surfaceStats['Зал'][0]}-${h2h.surfaceStats['Зал'][1]}</b></span>
      ${isRivalry ? `<span aria-hidden="true">|</span><span class="rivalry-fire-badge">🔥 ПРИНЦИПИАЛЬНОЕ СОПЕРНИЧЕСТВО (${totalH2H} М.)</span>` : ''}
    </div>
  `;

  if (h2h.history.length === 0) {
    h2hHtml += `<div style="color: var(--text-dim); font-size: 12.5px; text-align: center; padding: 10px 0;">0 : 0 • Первая очная дуэль</div>`;
  } else {
    h2hHtml += `<div class="h2h-history-list">`;
    h2h.history.forEach(item => {
      const isP1Win = item.winnerId === match.p1.id;
      h2hHtml += `
        <div class="h2h-item">
          <div>
            <b>${item.year}</b> · ${item.tourneyName} (<span class="${getSurfaceTextClass(item.surface)}">${item.surface}</span>) · <span style="color:var(--text-dim);">${item.stage}</span>
          </div>
          <div style="white-space: nowrap;">
            <b style="color: ${isP1Win ? 'var(--primary)' : 'var(--accent)'}; margin-right: 8px;">${item.winnerName}</b>
            <span class="match-score">${item.scoreFormatted}</span>
          </div>
        </div>
      `;
    });
    h2hHtml += `</div>`;
  }

  document.getElementById('h2hContainer').innerHTML = h2hHtml;
  const currentScoreVal = match.score ? match.score.join(' ') : '';
  document.getElementById('quickScoreStr').value = currentScoreVal;
  updateMomentumBarUI(currentScoreVal, match.p1.name, match.p2.name);

  const readOnlyCanon = isCanonReadOnly();
  const isLocked = readOnlyCanon || (viewingYear === currentTourYear && Boolean(activeTourney.completed));
  const roMatchNotice = document.getElementById('canonReadOnlyMatchNotice');
  if (roMatchNotice) {
    roMatchNotice.style.display = readOnlyCanon ? 'flex' : 'none';
  }
  const scoreInputEl = document.getElementById('quickScoreStr');
  if (scoreInputEl) {
    scoreInputEl.readOnly = readOnlyCanon;
  }
  const btnSave = document.getElementById('btnSaveScore');
  if (btnSave) btnSave.disabled = isLocked;
  const btnSaveOnly = document.getElementById('btnSaveScoreOnly');
  if (btnSaveOnly) btnSaveOnly.disabled = isLocked;
  const btnGen = document.getElementById('btnGenScoreInput');
  if (btnGen) btnGen.disabled = isLocked;
  const btnInstant = document.getElementById('btnInstantSimMatch');
  if (btnInstant) btnInstant.disabled = isLocked;
  const btnAi = document.getElementById('btnAiSimMatch');
  if (btnAi) btnAi.disabled = isLocked;
  const btnAiComment = document.getElementById('btnAiCommentScore');
  if (btnAiComment) btnAiComment.disabled = isLocked;
  const btnResetMatch = document.getElementById('btnResetMatchResult');
  if (btnResetMatch) btnResetMatch.disabled = isLocked;

  document.getElementById('playerPresets').innerHTML = `
    <button type="button" class="player-win-btn" ${isLocked ? 'disabled' : ''} onclick="quickApplyWinner('${match.p1.id}')">
      <span>⚡ Победа: <b>${match.p1.name}</b></span>
      <span style="color: var(--primary);">Быстрый расчет</span>
    </button>
    <button type="button" class="player-win-btn" ${isLocked ? 'disabled' : ''} onclick="quickApplyWinner('${match.p2.id}')">
      <span>⚡ Победа: <b>${match.p2.name}</b></span>
      <span style="color: var(--primary);">Быстрый расчет</span>
    </button>
  `;

  document.getElementById('scoreModal').classList.add('open');
  setTimeout(() => document.getElementById('quickScoreStr')?.focus(), 60);
}

export function appendSetScore(scoreStr) {
  if (guardCanonReadOnly()) return;
  const input = document.getElementById('quickScoreStr');
  if (!input) return;
  input.value = (input.value.trim() + ' ' + scoreStr).trim();
  handleLiveScoreInputForMomentum();
  input.focus();
}

export function clearScoreInput() {
  if (guardCanonReadOnly()) return;
  const input = document.getElementById('quickScoreStr');
  if (!input) return;
  input.value = '';
  pendingAiNarrative = '';
  pendingWinnerQuote = '';
  pendingLoserQuote = '';
  pendingAiSourceLabel = '';
  renderMatchAiReportBlock('', '', '');
  handleLiveScoreInputForMomentum();
  input.focus();
}

// --- БЛОК 3: ПОЛНОЕ АННУЛИРОВАНИЕ РЕЗУЛЬТАТА МАТЧА И КАСКАДНАЯ ОЧИСТКА СЛЕДУЮЩЕГО РАУНДА ---
export function promptResetMatchResult() {
  if (guardCanonReadOnly()) return;
  if (!activeMatchScore || !activeMatchScore.match) return;
  if (viewingYear === currentTourYear && Boolean(activeTourney?.completed)) {
    showToast('⚠️ Нельзя аннулировать результат матча в уже завершенном турнире текущего сезона.');
    return;
  }
  const confirmBox = document.getElementById('resetMatchConfirmBox');
  if (confirmBox) {
    confirmBox.style.display = 'flex';
  } else {
    confirmResetMatchResult();
  }
}

export function cancelResetMatchResult() {
  const confirmBox = document.getElementById('resetMatchConfirmBox');
  if (confirmBox) confirmBox.style.display = 'none';
}

export function confirmResetMatchResult() {
  if (guardCanonReadOnly()) return;
  if (viewingYear === currentTourYear && Boolean(activeTourney?.completed)) return;
  if (!activeMatchScore || !activeMatchScore.match) return;
  const { rIdx, mIdx } = activeMatchScore;

  resetMatchResultInDraw(currentDraw, activeTourney.id, rIdx, mIdx, players);

  pendingAiNarrative = '';
  pendingWinnerQuote = '';
  pendingLoserQuote = '';
  pendingAiSourceLabel = '';

  const input = document.getElementById('quickScoreStr');
  if (input) input.value = '';
  const errEl = document.getElementById('scoreInputError');
  if (errEl) errEl.style.display = 'none';
  const confirmBox = document.getElementById('resetMatchConfirmBox');
  if (confirmBox) confirmBox.style.display = 'none';

  renderMatchAiReportBlock('', '', '');
  handleLiveScoreInputForMomentum();
  saveDraw();
  savePlayers(false);
  invalidatePlayerCardAnalyticsCache();
  renderPlayersTable();
  if (viewingYear < currentTourYear) {
    backfill2023HistoryFromDraws();
    repairOvercountedPoints();
    savePlayers(false);
    renderPlayersTable();
  }
  renderMatches();
  showToast('🗑️ <b>Результат матча аннулирован.</b> Счет очищен, выносливость восстановлена, победитель удален из следующего раунда.');
}

// Кнопка «🎲 Сгенерировать счет в поле» — локальный алгоритмический рандом с учетом рейтинга, покрытия, стадии и режима комментариев
export function generateRandomScoreToInput() {
  if (guardCanonReadOnly()) return;
  if (viewingYear === currentTourYear && Boolean(activeTourney?.completed)) return;
  if (!activeMatchScore || !activeMatchScore.match) return;
  const stageName = getStageNameForRound(activeTourney, activeMatchScore.rIdx, activeMatchScore.match);
  const p1Live = players.find(p => p.id === activeMatchScore.match.p1.id) || activeMatchScore.match.p1;
  const p2Live = players.find(p => p.id === activeMatchScore.match.p2.id) || activeMatchScore.match.p2;
  const sim = computeSimMatchScores(
    { ...activeMatchScore.match, p1: p1Live, p2: p2Live },
    activeTourney ? activeTourney.bestOf : 3,
    0,
    activeTourney ? activeTourney.surface : 'Хард',
    activeTourney ? activeTourney.name : 'Турнир ATP',
    stageName,
    { allowRandomInjury: true }
  );
  const scoreStr = sim.scores.join(' ');
  document.getElementById('quickScoreStr').value = scoreStr;
  updateMomentumBarUI(sim.scores, activeMatchScore.match.p1.name, activeMatchScore.match.p2.name);
  if (includeMatchCommentaryMode) {
    pendingAiNarrative = sim.storyline || sim.narrative || '';
    pendingWinnerQuote = sim.winnerQuote || '';
    pendingLoserQuote = sim.loserQuote || '';
    pendingAiSourceLabel = 'Сводка симулятора';
    const loser = sim.winner.id === activeMatchScore.match.p1.id ? activeMatchScore.match.p2 : activeMatchScore.match.p1;
    renderMatchAiReportBlock(pendingAiNarrative, pendingWinnerQuote, pendingLoserQuote, sim.winner.name, loser.name, pendingAiSourceLabel);
  } else {
    pendingAiNarrative = '';
    pendingWinnerQuote = '';
    pendingLoserQuote = '';
    pendingAiSourceLabel = '';
    renderMatchAiReportBlock('', '', '');
  }

  const errEl = document.getElementById('scoreInputError');
  if (errEl) errEl.style.display = 'none';
}

// РАЗДЕЛ 2 (Сценарий А): Кнопка «🎙️ ИИ-комментарий к введенному счету» — анализирует введенный пользователем счет через Groq API
export async function generateCommentaryForScoreWithAI() {
  if (guardCanonReadOnly()) return;
  if (viewingYear === currentTourYear && Boolean(activeTourney?.completed)) return;
  if (!activeMatchScore || !activeMatchScore.match) return;
  const match = activeMatchScore.match;
  const scoreStr = document.getElementById('quickScoreStr')?.value || '';
  const bestOf = activeTourney ? activeTourney.bestOf : 3;
  const validation = parseAndValidateScoreString(scoreStr, bestOf);
  const errEl = document.getElementById('scoreInputError');
  const btnComment = document.getElementById('btnAiCommentScore');

  if (!validation.valid) {
    if (errEl) {
      errEl.className = 'error-text';
      errEl.innerText = validation.error || '⚠️ Сначала введите корректный теннисный счет в поле (например: 6-4 3-6 7-6(5)).';
      errEl.style.display = 'block';
    }
    return;
  }

  if (errEl) {
    errEl.className = 'error-text';
    errEl.style.display = 'none';
  }

  const p1Live = players.find(p => p.id === match.p1.id) || match.p1;
  const p2Live = players.find(p => p.id === match.p2.id) || match.p2;
  const refDateStr = viewingYear < currentTourYear ? `${viewingYear}-06-15` : currentTourDateStr;

  const storageGetter = (tId, yr) => {
    const d = readSavedDraw(tId, yr);
    return d.length > 0 ? d : null;
  };
  const h2h = getHeadToHeadAnalytics(match.p1.id, match.p2.id, tournaments, currentTourYear, storageGetter, p1Live.name, p2Live.name);
  const stageName = getStageNameForRound(activeTourney, activeMatchScore.rIdx, match);

  if (btnComment) {
    btnComment.disabled = true;
    btnComment.innerText = '🎙️ Groq пишет репортаж по счету...';
  }

  try {
    const result = await generateCommentaryForEnteredScore({
      match,
      scoreStr,
      p1: {
        id: p1Live.id,
        name: p1Live.name,
        flag: p1Live.flag,
        rank: p1Live.rank,
        age: calculateAge(p1Live.birthDate, refDateStr)
      },
      p2: {
        id: p2Live.id,
        name: p2Live.name,
        flag: p2Live.flag,
        rank: p2Live.rank,
        age: calculateAge(p2Live.birthDate, refDateStr)
      },
      tourneyName: activeTourney ? activeTourney.name : 'Турнир ATP',
      surface: activeTourney ? activeTourney.surface : 'Хард',
      bestOf,
      stage: stageName,
      h2hSummary: `${p1Live.name} ${h2h.p1Wins} : ${h2h.p2Wins} ${p2Live.name}`,
      h2hTotalMatches: (h2h.p1Wins || 0) + (h2h.p2Wins || 0),
      isRivalry: ((h2h.p1Wins || 0) + (h2h.p2Wins || 0)) >= 2,
      options: { strictGroq: true }
    });

    const sets = result.sets || validation.sets;
    const winnerObj = String(result.winnerId) === String(match.p1.id) ? match.p1 : match.p2;
    const loserObj = winnerObj.id === match.p1.id ? match.p2 : match.p1;

    pendingAiNarrative = result.storyline || '';
    pendingWinnerQuote = result.winnerQuote || '';
    pendingLoserQuote = result.loserQuote || '';
    const sourceTag = result.sourceLabel || getGroqSourceHeaderLabel(result.model || getGroqModel());
    pendingAiSourceLabel = sourceTag;
    match.aiSourceLabel = sourceTag;

    // Включаем режим показа комментариев, так как пользователь явно запросил ИИ-комментарий
    setMatchCommentaryMode(true);

    commitMatchOutcome({
      winner: winnerObj,
      scoreArray: sets,
      narrative: pendingAiNarrative,
      quotes: { winnerQuote: pendingWinnerQuote, loserQuote: pendingLoserQuote },
      sourceTag,
      closePopup: false
    });

    renderMatchAiReportBlock(pendingAiNarrative, pendingWinnerQuote, pendingLoserQuote, winnerObj.name, loserObj.name, sourceTag);
  } catch (err) {
    const errMsg = err?.message || 'Не удалось связаться с Groq API';
    if (errEl) {
      errEl.className = 'error-text groq-error-alert';
      errEl.innerHTML = `❌ <b>Ошибка запроса к Groq API:</b> ${errMsg}`;
      errEl.style.display = 'block';
    }
    showToast(`❌ <b>Сбой запроса к Groq API:</b> ${errMsg}`, 6500);
  } finally {
    if (btnComment) {
      btnComment.disabled = false;
      btnComment.innerText = '🎙️ ИИ-комментарий к введенному счету';
    }
  }
}

// РАЗДЕЛ 2 (Сценарий Б): Кнопка «🧠 ИИ-симуляция матча (Groq)» — полная симуляция без шаблонов 6-3 6-2 (45% триллеров, 20% апсетов)
export async function simulateMatchWithAI() {
  if (guardCanonReadOnly()) return;
  if (viewingYear === currentTourYear && Boolean(activeTourney?.completed)) return;
  if (!activeMatchScore || !activeMatchScore.match) return;
  const match = activeMatchScore.match;
  const btnAi = document.getElementById('btnAiSimMatch');
  const errEl = document.getElementById('scoreInputError');
  if (errEl) {
    errEl.className = 'error-text';
    errEl.style.display = 'none';
  }

  const p1Live = players.find(p => p.id === match.p1.id) || match.p1;
  const p2Live = players.find(p => p.id === match.p2.id) || match.p2;
  const refDateStr = viewingYear < currentTourYear ? `${viewingYear}-06-15` : currentTourDateStr;

  const storageGetter = (tId, yr) => {
    const d = readSavedDraw(tId, yr);
    return d.length > 0 ? d : null;
  };
  const h2h = getHeadToHeadAnalytics(match.p1.id, match.p2.id, tournaments, currentTourYear, storageGetter, p1Live.name, p2Live.name);
  const stageName = getStageNameForRound(activeTourney, activeMatchScore.rIdx, match);

  if (btnAi) {
    btnAi.disabled = true;
    btnAi.innerText = '🧠 Groq симулирует матч...';
  }

  try {
    const result = await simulateMatchWithGroq({
      match,
      p1: {
        id: p1Live.id,
        name: p1Live.name,
        flag: p1Live.flag,
        rank: p1Live.rank,
        age: calculateAge(p1Live.birthDate, refDateStr)
      },
      p2: {
        id: p2Live.id,
        name: p2Live.name,
        flag: p2Live.flag,
        rank: p2Live.rank,
        age: calculateAge(p2Live.birthDate, refDateStr)
      },
      tourneyName: activeTourney ? activeTourney.name : 'Турнир ATP',
      surface: activeTourney ? activeTourney.surface : 'Хард',
      bestOf: activeTourney ? activeTourney.bestOf : 3,
      stage: stageName,
      h2hSummary: `${p1Live.name} ${h2h.p1Wins} : ${h2h.p2Wins} ${p2Live.name}`,
      h2hTotalMatches: (h2h.p1Wins || 0) + (h2h.p2Wins || 0),
      isRivalry: ((h2h.p1Wins || 0) + (h2h.p2Wins || 0)) >= 2,
      options: { strictGroq: true }
    });

    const sets = result.sets || String(result.score).split(/\s+/);
    const winnerObj = String(result.winnerId) === String(match.p1.id) ? match.p1 : match.p2;
    const loserObj = winnerObj.id === match.p1.id ? match.p2 : match.p1;

    document.getElementById('quickScoreStr').value = sets.join(' ');
    updateMomentumBarUI(sets, match.p1.name, match.p2.name);
    if (includeMatchCommentaryMode) {
      pendingAiNarrative = result.storyline || '';
      pendingWinnerQuote = result.winnerQuote || '';
      pendingLoserQuote = result.loserQuote || '';
      const sourceTag = result.sourceLabel || getGroqSourceHeaderLabel(result.model || getGroqModel());
      pendingAiSourceLabel = sourceTag;
      match.aiSourceLabel = sourceTag;
      renderMatchAiReportBlock(pendingAiNarrative, pendingWinnerQuote, pendingLoserQuote, winnerObj.name, loserObj.name, sourceTag);
    } else {
      pendingAiNarrative = '';
      pendingWinnerQuote = '';
      pendingLoserQuote = '';
      pendingAiSourceLabel = '';
      renderMatchAiReportBlock('', '', '');
    }

    // Автоматически вставляем сгенерированный счет в сетку матча
    commitMatchOutcome({
      winner: winnerObj,
      scoreArray: sets,
      narrative: pendingAiNarrative,
      quotes: { winnerQuote: pendingWinnerQuote, loserQuote: pendingLoserQuote },
      sourceTag: match.aiSourceLabel || pendingAiSourceLabel,
      closePopup: false
    });
  } catch (err) {
    const errMsg = err?.message || 'Не удалось связаться с Groq API';
    if (errEl) {
      errEl.className = 'error-text groq-error-alert';
      errEl.innerHTML = `❌ <b>Ошибка запроса к Groq API:</b> ${errMsg}`;
      errEl.style.display = 'block';
    }
    showToast(`❌ <b>Сбой запроса к Groq API:</b> ${errMsg}`, 6500);
  } finally {
    if (btnAi) {
      btnAi.disabled = false;
      btnAi.innerText = '🧠 ИИ-симуляция матча (Groq)';
    }
  }
}

/**
 * Единый диспетчер фиксации исхода матча для всех контроллеров Матч-центра (DRY).
 */
export function commitMatchOutcome({
  winner,
  scoreArray,
  narrative = '',
  quotes = null,
  sourceTag = '',
  closePopup = false,
  rIdx = null,
  mIdx = null,
  targetMatch = null
} = {}) {
  const roundIdx = rIdx !== null ? rIdx : activeMatchScore?.rIdx;
  const matchIdx = mIdx !== null ? mIdx : activeMatchScore?.mIdx;
  const match = targetMatch || activeMatchScore?.match || currentDraw?.[roundIdx]?.[matchIdx];

  if (!match || !winner || !scoreArray || roundIdx === null || matchIdx === null) return;
  if (viewingYear === currentTourYear && Boolean(activeTourney?.completed)) return;

  const bestOf = activeTourney ? activeTourney.bestOf : 3;
  const useComments = includeMatchCommentaryMode && Boolean(narrative || quotes);
  const finalNarrative = useComments ? String(narrative || '').trim() : '';
  const finalQuotes = useComments && quotes
    ? {
        winnerQuote: String(quotes.winnerQuote || '').trim(),
        loserQuote: String(quotes.loserQuote || '').trim()
      }
    : { winnerQuote: '', loserQuote: '' };

  if (sourceTag) {
    pendingAiSourceLabel = sourceTag;
    match.aiSourceLabel = sourceTag;
  }

  // Обновляем выносливость участников текущего сезона и межраундовую регенерацию
  if (viewingYear === currentTourYear && match.p1 && match.p2) {
    const p1Live = players.find(x => x.id === match.p1.id) || match.p1;
    const p2Live = players.find(x => x.id === match.p2.id) || match.p2;

    match.p1.stamina = p1Live.stamina ?? 100;
    match.p2.stamina = p2Live.stamina ?? 100;
    match.p1PreStamina = p1Live.stamina ?? 100;
    match.p2PreStamina = p2Live.stamina ?? 100;

    const staminaCost = applyMatchFatigueToPlayers(p1Live, p2Live, scoreArray, bestOf);
    match.staminaCost = staminaCost;

    // Межраундовая регенерация победителя (+20% стамины к следующему кругу)
    const winnerLive = String(winner.id) === String(p1Live.id) ? p1Live : p2Live;
    regenerateInterRoundStamina(winnerLive, 20);

    // На Олимпиаде в полуфинале проигравший тоже отдыхает перед матчем за 3-е место
    if (activeTourney?.id === 'olympics' && roundIdx === 4) {
      const loserLive = String(winner.id) === String(p1Live.id) ? p2Live : p1Live;
      regenerateInterRoundStamina(loserLive, 20);
    }

    match.p1.stamina = p1Live.stamina;
    match.p2.stamina = p2Live.stamina;
    savePlayers(false);
  }

  advanceWinnerInDraw(currentDraw, activeTourney.id, roundIdx, matchIdx, winner, scoreArray, finalNarrative, finalQuotes);
  if (pendingAiSourceLabel && finalNarrative) {
    match.aiSourceLabel = pendingAiSourceLabel;
  }
  saveDraw();

  // Если завершен финал турнира прошлых лет — синхронизируем историю
  if (viewingYear < currentTourYear) {
    const finalM = currentDraw[currentDraw.length - 1]?.[0];
    if (finalM && finalM.winner && finalM.p1 && finalM.p2) {
      if (!seasonsHistory[viewingYear]) seasonsHistory[viewingYear] = { tournamentsData: [] };
      if (!Array.isArray(seasonsHistory[viewingYear].tournamentsData)) seasonsHistory[viewingYear].tournamentsData = [];
      const loser = String(finalM.winner.id) === String(finalM.p1.id) ? finalM.p2 : finalM.p1;
      const scoreStr = Array.isArray(finalM.score) && finalM.score.length > 0 ? finalM.score.join(' ') : (typeof finalM.score === 'string' && finalM.score ? finalM.score : '6-4 6-4');
      const bronze = activeTourney.id === 'olympics' ? (currentDraw[currentDraw.length - 1]?.[1]?.winner || null) : null;
      const isMajor = ['ТБШ', 'Мастерс', 'Итоговый', 'Олимпиада'].includes(activeTourney.type);

      let histEntry = seasonsHistory[viewingYear].tournamentsData.find(t => t && t.id === activeTourney.id);
      if (!histEntry) {
        histEntry = {
          id: activeTourney.id,
          name: activeTourney.name,
          type: activeTourney.type,
          surface: activeTourney.surface,
          winner: finalM.winner,
          runnerUp: loser,
          bronze: bronze,
          score: scoreStr,
          pressColumn: isMajor ? buildFallbackFinalPressColumn({
            tourneyName: activeTourney.name,
            tourneyType: activeTourney.type,
            surface: activeTourney.surface,
            year: viewingYear,
            winner: finalM.winner,
            runnerUp: loser,
            score: scoreStr
          }) : null
        };
        seasonsHistory[viewingYear].tournamentsData.push(histEntry);
      } else {
        histEntry.winner = finalM.winner;
        histEntry.runnerUp = loser;
        histEntry.score = scoreStr;
        histEntry.bronze = bronze;
        if (isMajor) {
          histEntry.pressColumn = buildFallbackFinalPressColumn({
            tourneyName: activeTourney.name,
            tourneyType: activeTourney.type,
            surface: activeTourney.surface,
            year: viewingYear,
            winner: finalM.winner,
            runnerUp: loser,
            score: scoreStr
          });
        }
      }
      syncSeasonHistoryWithActualDraws(viewingYear);
      saveHistory();
    }
    backfill2023HistoryFromDraws();
    repairOvercountedPoints();
    savePlayers(false);
    renderPlayersTable();
    renderCalendarTable();
  }

  if (closePopup) {
    closeModal('scoreModal');
  }
  invalidatePlayerCardAnalyticsCache();
  renderMatches();
}

function executeOfflineSimulation(forcedWinner = 0) {
  if (guardCanonReadOnly()) return;
  if (viewingYear === currentTourYear && Boolean(activeTourney?.completed)) return;
  if (!activeMatchScore || !activeMatchScore.match) return;
  const match = activeMatchScore.match;
  const stageName = getStageNameForRound(activeTourney, activeMatchScore.rIdx, match);
  const sim = computeSimMatchScores(
    match,
    activeTourney ? activeTourney.bestOf : 3,
    forcedWinner,
    activeTourney ? activeTourney.surface : 'Хард',
    activeTourney ? activeTourney.name : 'Турнир ATP',
    stageName
  );
  commitMatchOutcome({
    winner: sim.winner,
    scoreArray: sim.scores,
    narrative: sim.narrative,
    quotes: { winnerQuote: sim.winnerQuote, loserQuote: sim.loserQuote },
    closePopup: true
  });
}

// Кнопка «⚡ Быстрый расчет (Оффлайн)»
export function instantSimulateMatch() {
  executeOfflineSimulation(0);
}

export function quickApplyWinner(winnerId) {
  if (!activeMatchScore || !activeMatchScore.match) return;
  const isP1 = activeMatchScore.match.p1.id === winnerId;
  executeOfflineSimulation(isP1 ? 1 : 2);
}

export function saveQuickStringScore(forceScoreOnly = false) {
  if (guardCanonReadOnly()) return;
  if (viewingYear === currentTourYear && Boolean(activeTourney?.completed)) return;
  if (!activeMatchScore) return;
  const str = document.getElementById('quickScoreStr')?.value;
  const validation = parseAndValidateScoreString(str, activeTourney ? activeTourney.bestOf : 3);
  const errEl = document.getElementById('scoreInputError');

  if (!validation.valid) {
    if (errEl) {
      errEl.className = 'error-text';
      errEl.innerText = validation.error;
      errEl.style.display = 'block';
    }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  const winner = validation.p1WinsMatch ? activeMatchScore.match.p1 : activeMatchScore.match.p2;
  const useComments = !forceScoreOnly && includeMatchCommentaryMode;

  commitMatchOutcome({
    winner,
    scoreArray: validation.sets,
    narrative: useComments ? pendingAiNarrative : '',
    quotes: useComments ? { winnerQuote: pendingWinnerQuote, loserQuote: pendingLoserQuote } : null,
    sourceTag: useComments ? pendingAiSourceLabel : '',
    closePopup: true
  });
}

export function saveQuickStringScoreOnly() {
  saveQuickStringScore(true);
}

export function applyMatchWinner(rIdx, mIdx, winner, scoreArr, narrative = '', quotes = null) {
  commitMatchOutcome({
    rIdx,
    mIdx,
    winner,
    scoreArray: scoreArr,
    narrative,
    quotes,
    closePopup: false
  });
}

export function autoSimulateRound() {
  if (guardCanonReadOnly()) return;
  if (viewingYear < currentTourYear || activeTourney.completed) return;
  if (!currentDraw || currentDraw.length === 0) {
    generateRealisticDraw();
  }
  const stageName = getStageNameForRound(activeTourney, activeRoundIdx);
  currentDraw[activeRoundIdx].forEach((m, idx) => {
    if (!m.winner && m.p1 && m.p2) {
      const mStage = getStageNameForRound(activeTourney, activeRoundIdx, m) || stageName;
      const sim = computeSimMatchScores(m, activeTourney.bestOf, 0, activeTourney.surface, activeTourney.name, mStage, { allowRandomInjury: true });
      const narrative = includeMatchCommentaryMode ? sim.narrative : '';
      const quotes = includeMatchCommentaryMode ? { winnerQuote: sim.winnerQuote, loserQuote: sim.loserQuote } : null;
      commitMatchOutcome({
        winner: sim.winner,
        scoreArray: sim.scores,
        narrative,
        quotes,
        rIdx: activeRoundIdx,
        mIdx: idx,
        targetMatch: m,
        closePopup: false
      });
    }
  });
  savePlayers(false);
  saveDraw();
  renderMatches();
}

export function autoSimulateEntireTournament() {
  if (guardCanonReadOnly()) return;
  if (viewingYear < currentTourYear || activeTourney.completed) return;
  if (!currentDraw || currentDraw.length === 0) {
    generateRealisticDraw();
  }
  for (let r = 0; r < currentDraw.length; r++) {
    const stageName = getStageNameForRound(activeTourney, r);
    currentDraw[r].forEach((m, idx) => {
      if (!m.winner && m.p1 && m.p2) {
        const mStage = getStageNameForRound(activeTourney, r, m) || stageName;
        const sim = computeSimMatchScores(m, activeTourney.bestOf, 0, activeTourney.surface, activeTourney.name, mStage, { allowRandomInjury: true });
        const narrative = includeMatchCommentaryMode ? sim.narrative : '';
        const quotes = includeMatchCommentaryMode ? { winnerQuote: sim.winnerQuote, loserQuote: sim.loserQuote } : null;
        commitMatchOutcome({
          winner: sim.winner,
          scoreArray: sim.scores,
          narrative,
          quotes,
          rIdx: r,
          mIdx: idx,
          targetMatch: m,
          closePopup: false
        });
      }
    });
  }
  activeRoundIdx = currentDraw.length - 1;
  savePlayers(false);
  saveDraw();
  renderRoundTabs();
  renderMatches();
}

// --- 5. ЗАВЕРШЕНИЕ ТУРНИРА, НАЧИСЛЕНИЕ ОЧКОВ, МЕДАЛЕЙ ОИ И КОЛОНКА ПРЕССЫ ДЛЯ ЗАЛА СЛАВЫ ---
export function finishTournamentAndAwardPoints(options = {}) {
  if (guardCanonReadOnly()) return;
  if (!activeTourney || viewingYear < currentTourYear) return;
  if (activeTourney.completed) {
    showToast('⚠️ Этот турнир уже завершен в текущем сезоне! Повторное начисление очков заблокировано.');
    return;
  }
  if (!currentDraw || currentDraw.length === 0) {
    showToast('⚠️ Сетка турнира пуста! Сначала проведите жеребьевку.');
    return;
  }

  const finalRound = currentDraw[currentDraw.length - 1];
  const finalMatch = finalRound?.[0];
  if (!finalMatch || !finalMatch.winner) {
    showToast('⚠️ Финал турнира еще не сыгран! Завершите все раунды перед начислением очков.');
    return;
  }

  // Если это Олимпиада и матч за 3-е место (finalRound[1]) еще не доигран при сыгранном финале — доигрываем автоматически
  if (activeTourney.id === 'olympics' && finalRound?.[1] && finalRound[1].p1 && finalRound[1].p2 && !finalRound[1].winner) {
    const simBronze = computeSimMatchScores(finalRound[1], activeTourney.bestOf, 0, activeTourney.surface, activeTourney.name);
    advanceWinnerInDraw(currentDraw, activeTourney.id, currentDraw.length - 1, 1, simBronze.winner, simBronze.scores, simBronze.narrative, {
      winnerQuote: simBronze.winnerQuote,
      loserQuote: simBronze.loserQuote
    });
    saveDraw();
  }

  // МГНОВЕННАЯ БЛОКИРОВКА КНОПКИ «ЗАВЕРШИТЬ ТУРНИР» (исключает накрутку очков)
  activeTourney.completed = true;
  const masterTourneyRef = tournaments.find(t => t.id === activeTourney.id);
  if (masterTourneyRef) masterTourneyRef.completed = true;

  const btnFinish = document.getElementById('btnFinishTourney');
  if (btnFinish) {
    btnFinish.disabled = true;
    btnFinish.innerText = 'Турнир завершен ✅';
  }

  const { participantsList, medalists } = applyTournamentPointsToPlayers(players, activeTourney, currentDraw, viewingYear);

  // Параллельный фоновый турнир ATP 250 / Челленджеры
  let bgReport = '';
  const viewingTourneys = getSeasonTournaments(viewingYear, tournaments);
  const currentIndex = viewingTourneys.findIndex(t => t.id === activeTourney.id);
  if (activeTourney.type !== 'Итоговый' && activeTourney.type !== 'Олимпиада') {
    bgReport = runBackgroundATP250Tournaments(players, participantsList, viewingYear, currentIndex, activeTourney);
    if (bgReport) {
      universeStorage.setItem(`bg250_${activeTourney.id}_${viewingYear}`, bgReport);
      const bgBox = document.getElementById('bg250Notice');
      if (bgBox) {
        bgBox.style.display = 'block';
        bgBox.innerHTML = bgReport;
      }
    }
  }

  syncPlayers52WeekDiagnostics(players, viewingTourneys, viewingYear);

  activeTourney.lastWinner = { ...finalMatch.winner };
  activeTourney.lastRunnerUp = finalMatch.p1.id === finalMatch.winner.id ? { ...finalMatch.p2 } : { ...finalMatch.p1 };
  activeTourney.lastScore = finalMatch.score ? finalMatch.score.join(' ') : 'W/O';
  if (medalists && medalists.bronze) {
    activeTourney.lastBronze = { ...medalists.bronze };
  }

  if (masterTourneyRef) {
    masterTourneyRef.lastWinner = activeTourney.lastWinner;
    masterTourneyRef.lastRunnerUp = activeTourney.lastRunnerUp;
    masterTourneyRef.lastScore = activeTourney.lastScore;
    if (activeTourney.lastBronze) masterTourneyRef.lastBronze = activeTourney.lastBronze;
  }

  // Восстанавливаем выносливость всех игроков до 100% между турнирами
  resetPlayersStamina(players);

  // ОБЯЗАТЕЛЬНО сохраняем завершенную сетку текущего турнира в хранилище перед переходом!
  saveDraw();
  saveTournaments();
  savePlayers(true);

  if (!seasonsHistory[viewingYear]) {
    seasonsHistory[viewingYear] = {
      year: viewingYear,
      slamSnapshots: {},
      tournamentsData: []
    };
  }
  if (!seasonsHistory[viewingYear].slamSnapshots) {
    seasonsHistory[viewingYear].slamSnapshots = {};
  }

  const finishedTourneyObj = activeTourney;
  const isMajorTourney = ['ТБШ', 'Мастерс', 'Итоговый', 'Олимпиада'].includes(finishedTourneyObj.type);
  const initialPressColumn = isMajorTourney
    ? buildFallbackFinalPressColumn({
        tourneyName: finishedTourneyObj.name,
        tourneyType: finishedTourneyObj.type,
        surface: finishedTourneyObj.surface,
        year: viewingYear,
        winner: finishedTourneyObj.lastWinner,
        runnerUp: finishedTourneyObj.lastRunnerUp,
        score: finishedTourneyObj.lastScore
      })
    : null;

  const existingTourneysData = seasonsHistory[viewingYear].tournamentsData || [];
  const tEntry = {
    id: finishedTourneyObj.id,
    name: finishedTourneyObj.name,
    type: finishedTourneyObj.type,
    surface: finishedTourneyObj.surface,
    winner: finishedTourneyObj.lastWinner,
    runnerUp: finishedTourneyObj.lastRunnerUp,
    bronze: finishedTourneyObj.lastBronze || null,
    score: finishedTourneyObj.lastScore,
    pressColumn: initialPressColumn
  };
  const existingIdx = existingTourneysData.findIndex(x => x.id === finishedTourneyObj.id);
  if (existingIdx >= 0) existingTourneysData[existingIdx] = tEntry;
  else existingTourneysData.push(tEntry);
  seasonsHistory[viewingYear].tournamentsData = existingTourneysData;
  seasonsHistory[viewingYear].worldNumberOne = { ...players[0] };

  // Если это крупный турнир (ТБШ / Мастерс / Олимпиада / Итоговый), запрашиваем послематчевую колонку у Groq
  if (isMajorTourney && !options?.skipGroq) {
    const finishedTourneySnapshot = {
      id: finishedTourneyObj.id,
      name: finishedTourneyObj.name,
      type: finishedTourneyObj.type,
      surface: finishedTourneyObj.surface,
      year: viewingYear,
      winner: finishedTourneyObj.lastWinner,
      runnerUp: finishedTourneyObj.lastRunnerUp,
      score: finishedTourneyObj.lastScore
    };
    generateFinalPressColumn({
      tourneyName: finishedTourneySnapshot.name,
      tourneyType: finishedTourneySnapshot.type,
      surface: finishedTourneySnapshot.surface,
      year: finishedTourneySnapshot.year,
      winner: finishedTourneySnapshot.winner,
      runnerUp: finishedTourneySnapshot.runnerUp,
      score: finishedTourneySnapshot.score
    }).then(pressCol => {
      const targetYearHist = seasonsHistory[finishedTourneySnapshot.year];
      if (targetYearHist && Array.isArray(targetYearHist.tournamentsData)) {
        const entry = targetYearHist.tournamentsData.find(x => x.id === finishedTourneySnapshot.id);
        if (entry && pressCol) {
          entry.pressColumn = pressCol;
          saveHistory();
          if (document.getElementById('tab-history')?.classList.contains('active')) {
            renderHistoryYear();
          }
        }
      }
    }).catch(err => {
      console.warn('generateFinalPressColumn failed:', err);
    });
  }

  if (finishedTourneyObj.type === 'ТБШ') {
    const slamOrder = ['tbsh_1', 'tbsh_2', 'tbsh_3', 'tbsh_4'];
    const sIdx = slamOrder.indexOf(finishedTourneyObj.id);
    let prevSnapList = null;
    if (sIdx > 0) {
      const prevSlamId = slamOrder[sIdx - 1];
      prevSnapList = seasonsHistory[viewingYear].slamSnapshots[prevSlamId]?.top50 || null;
    }
    if (!prevSnapList) {
      prevSnapList = seasonsHistory[viewingYear - 1]?.yearEndTop50 || null;
    }

    seasonsHistory[viewingYear].slamSnapshots[finishedTourneyObj.id] = {
      tourneyName: finishedTourneyObj.name,
      date: currentTourDateStr,
      top50: createTop50Snapshot(players, currentTourDateStr, prevSnapList)
    };
  }

  saveHistory();

  // Продвигаем календарную дату тура к следующему незавершенному турниру, но на экране оставляем завершенный турнир (пока пользователь сам не переключит селектор или вкладку)
  let nextTourneyIdForCheckpoint = finishedTourneyObj.id;
  if (currentIndex >= 0 && currentIndex < viewingTourneys.length - 1) {
    const nextTourney = viewingTourneys[currentIndex + 1];
    const nextStartMonth = String(nextTourney.startMonth + 1).padStart(2, '0');
    const nextStartDay = String(nextTourney.startDay).padStart(2, '0');
    currentTourDateStr = `${currentTourYear}-${nextStartMonth}-${nextStartDay}`;
    nextTourneyIdForCheckpoint = nextTourney.id;
  } else {
    currentTourDateStr = `${currentTourYear}-11-25`;
  }

  saveDate();

  // РАЗДЕЛ 7: Автоматический чекпоинт после каждого ТБШ и после Итогового турнира (с глубоким клонированием!)
  if (finishedTourneyObj.type === 'ТБШ' || finishedTourneyObj.id === 'finals') {
    saveSeasonCheckpoint(
      `cp_${finishedTourneyObj.id}_${viewingYear}`,
      `После ${finishedTourneyObj.name} (${viewingYear}) · Чемпион: ${finalMatch.winner.name}`,
      {
        dateStr: currentTourDateStr,
        activeTourneyId: nextTourneyIdForCheckpoint
      }
    );
  }

  syncSeasonHistoryWithActualDraws(viewingYear);
  invalidatePlayerCardAnalyticsCache();

  // Сохраняем выбранный завершенный турнир на экране сразу после клика «Завершить турнир», чтобы сетка не исчезала перед глазами
  initUI({ preserveSelectedTourney: true });
  renderPlayersTable();
  renderRaceTable();

  if (finishedTourneyObj.id === 'olympics' && medalists.gold) {
    showToast(
      `🏅 <b>Олимпийские игры</b> завершены! 🥇 Золото: <b>${medalists.gold.name}</b> · 🥈 Серебро: <b>${medalists.silver?.name || '—'}</b> · 🥉 Бронза: <b>${medalists.bronze?.name || '—'}</b>.`
    );
  } else {
    showToast(`🏆 <b>${finishedTourneyObj.name}</b> завершен! Чемпион: <b>${finalMatch.winner.name}</b>. Рейтинг 52 недель и Гонка обновлены.`);
  }
}

// --- 6. ЗАВЕРШЕНИЕ СЕЗОНА, ПЕНСИЯ ВЕТЕРАНОВ И ГЕНЕРАЦИЯ НЬЮГЕНОВ С ПРОЗВИЩАМИ И СТИЛЯМИ ИГРЫ ---
export function endSeasonAndDecayPoints() {
  if (guardCanonReadOnly()) return;
  const endingYear = currentTourYear;
  const endingSeasonTourneys = getSeasonTournaments(endingYear, tournaments);

  if (!seasonsHistory[endingYear]) {
    seasonsHistory[endingYear] = { year: endingYear, slamSnapshots: {}, tournamentsData: [] };
  }

  const prevSnap =
    seasonsHistory[endingYear].slamSnapshots?.tbsh_4?.top50 ||
    seasonsHistory[endingYear - 1]?.yearEndTop50 ||
    null;

  const existingEntriesMap = {};
  (seasonsHistory[endingYear].tournamentsData || []).forEach(e => {
    existingEntriesMap[e.id] = e;
  });

  seasonsHistory[endingYear].year = endingYear;
  seasonsHistory[endingYear].worldNumberOne = { ...players[0] };
  seasonsHistory[endingYear].yearEndTop50 = createTop50Snapshot(players, `${endingYear}-11-25`, prevSnap);
  seasonsHistory[endingYear].tournamentsData = endingSeasonTourneys.map(t => {
    const prevEntry = existingEntriesMap[t.id];
    const winner = t.lastWinner || prevEntry?.winner || null;
    const runnerUp = t.lastRunnerUp || prevEntry?.runnerUp || null;
    const score = t.lastScore || prevEntry?.score || '—';
    const isMajor = ['ТБШ', 'Мастерс', 'Итоговый', 'Олимпиада'].includes(t.type);
    const pressColumn = prevEntry?.pressColumn || (isMajor && winner && runnerUp
      ? buildFallbackFinalPressColumn({
          tourneyName: t.name,
          tourneyType: t.type,
          surface: t.surface,
          year: endingYear,
          winner,
          runnerUp,
          score
        })
      : null);

    return {
      id: t.id,
      name: t.name,
      type: t.type,
      surface: t.surface,
      winner,
      runnerUp,
      bronze: t.lastBronze || prevEntry?.bronze || null,
      score,
      pressColumn
    };
  });
  saveHistory();

  // ЗАПУСК СИСТЕМЫ ЗАВЕРШЕНИЯ КАРЬЕРЫ И ГЕНЕРАЦИИ МОЛОДЫХ НОВИЧКОВ (НЬЮГЕНОВ)
  const { updatedPlayers, retiredThisYear, newgensThisYear } = processEndOfSeasonRetirements(
    players,
    endingYear,
    retiredLegends
  );

  players = updatedPlayers;
  retiredLegends = [...retiredThisYear, ...retiredLegends];
  saveRetiredLegends();

  // Переход в новый сезон
  currentTourYear++;
  viewingYear = currentTourYear;
  currentTourDateStr = `${currentTourYear}-01-02`;

  // Перестраиваем календарь под новый год (если год олимпийский — включится Олимпиада, иначе — 26 турниров)
  tournaments = getSeasonTournaments(currentTourYear, tournaments).map(t => ({
    ...t,
    completed: false,
    lastWinner: null,
    lastRunnerUp: null,
    lastBronze: null,
    lastScore: null
  }));
  activeTourney = tournaments[0];
  activeTourneyId = activeTourney.id;

  // Сначала рассчитываем чистую сумму очков к защите на новый сезон
  syncPlayers52WeekDiagnostics(players, tournaments, currentTourYear);

  // На 02 января рейтинг 52 недель строго равен оставшейся защите прошлого года (Гонка = 0, Итоговый = 0)
  players.forEach(p => {
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

  // Ранжируем игроков строго по чистым очкам нового сезона и фиксируем стартовую позицию
  sortAndRankPlayers(players, false);
  players.forEach(p => {
    p.seasonStartRank = p.rank;
  });

  savePlayers(false);
  saveTournaments();
  saveDate();
  ensureInitialSeasonCheckpoint();
  initUI();
  renderPlayersTable();
  renderRaceTable();

  openSeasonTransitionReportModal(endingYear, currentTourYear, retiredThisYear, newgensThisYear);

  // Запрашиваем у Groq уникальные короткие прозвища и стили игры для молодых новичков
  if (newgensThisYear.length > 0) {
    enrichNewgensWithGroq(newgensThisYear).then(enrichedList => {
      enrichedList.forEach(ng => {
        const target = players.find(p => p.id === ng.id);
        if (target) {
          target.nickname = ng.nickname;
          target.playStyle = ng.playStyle;
        }
      });
      savePlayers(false);
      renderPlayersTable();
      if (document.getElementById('seasonTransitionModal')?.classList.contains('open')) {
        openSeasonTransitionReportModal(endingYear, currentTourYear, retiredThisYear, enrichedList);
      }
    });
  }
}

function openSeasonTransitionReportModal(endedYear, newYear, retiredList, newgensList) {
  document.getElementById('seasonTransitionTitle').innerText = `Сезон ${endedYear} завершен · Добро пожаловать в сезон ${newYear}!`;
  document.getElementById('seasonTransitionSubtitle').innerText =
    `Архив сезона ${endedYear} сохранен в Зале Славы. Чемпионская гонка (Live Race) обнулена к 1 января ${newYear} года.${isOlympicYear(newYear) ? ' В календаре этого года пройдут Олимпийские игры!' : ''} Баланс пула: 300 игроков.`;

  const retiredHtml = retiredList.length === 0
    ? `<div style="padding: 16px; color: var(--text-dim); text-align: center;">В этом межсезонье никто из ветеранов не завершил карьеру.</div>`
    : retiredList.map(r => `
        <div class="h2h-item" style="flex-direction: column; align-items: flex-start; gap: 3px;">
          <div style="display: flex; justify-content: space-between; width: 100%;">
            <b>${r.flag} ${r.name}</b>
            <span style="color: var(--gold); font-weight: 700;">${r.retiredAge} лет</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-dim);">
            Наивысший рейтинг: <b style="color: var(--text-main);">#${r.bestRank}</b> · Финальный ранг: #${r.finalRank} · Сыграно сезонов: <b>${r.seasonsPlayed}</b>
          </div>
        </div>
      `).join('');

  const newgensHtml = newgensList.length === 0
    ? `<div style="padding: 16px; color: var(--text-dim); text-align: center;">Новые игроки не призывались.</div>`
    : newgensList.map(ng => `
        <div class="h2h-item" style="flex-direction: column; align-items: flex-start; gap: 4px;">
          <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
            <div>
              <b>${ng.flag} ${ng.name}</b>
              ${ng.nickname ? `<span class="player-nickname-badge">«${ng.nickname}»</span>` : ''}
            </div>
            <span style="color: var(--primary); font-weight: 700;">${ng.ageAtEntry} лет</span>
          </div>
          ${ng.playStyle ? `<div style="font-size: 12px; color: var(--accent);">🎾 Стиль: <b>${ng.playStyle}</b></div>` : ''}
          <div style="font-size: 11.5px; color: var(--text-dim);">
            Дата рожд.: ${ng.birthDate} · Стартовые очки ATP: <b style="color: var(--accent);">${ng.points} pts</b>
          </div>
        </div>
      `).join('');

  document.getElementById('seasonTransitionBody').innerHTML = `
    <div class="report-columns">
      <div style="background: #0d1420; border: 1px solid var(--border); border-radius: 8px; padding: 14px;">
        <h4 style="color: var(--gold); font-size: 14px; margin-bottom: 10px;">👋 Завершили карьеру (${retiredList.length})</h4>
        <div style="max-height: 300px; overflow-y: auto;">
          ${retiredHtml}
        </div>
      </div>
      <div style="background: #0d1420; border: 1px solid var(--border); border-radius: 8px; padding: 14px;">
        <h4 style="color: var(--primary); font-size: 14px; margin-bottom: 10px;">🌟 Прибывшие молодые таланты — Ньюгены (${newgensList.length})</h4>
        <div style="max-height: 300px; overflow-y: auto;">
          ${newgensHtml}
        </div>
      </div>
    </div>
  `;

  document.getElementById('seasonTransitionModal').classList.add('open');
}

// --- 7. ТАБЛИЦЫ РЕЙТИНГА (52 НЕДЕЛИ), ГОНКИ И КАЛЕНДАРЯ ---
function renderRankChangeBadge(diff) {
  if (diff > 0) return `<span style="color: #10b981; font-size: 11.5px; font-weight: 700;">▲ +${diff}</span>`;
  if (diff < 0) return `<span style="color: #ef4444; font-size: 11.5px; font-weight: 700;">▼ ${diff}</span>`;
  return `<span style="color: var(--text-dim); font-size: 11.5px;">— 0</span>`;
}

export function renderPointsDeltaBadge(delta, player = null) {
  const num = Math.round(Number(delta) || 0);
  const tName = player?.lastTourneyName ? ` (${player.lastTourneyName})` : '';
  const earned = Math.round(Number(player?.lastTourneyEarned) || 0);
  const defended = Math.round(Number(player?.lastTourneyDefended) || 0);
  const breakdownHint = (earned > 0 || defended > 0)
    ? ` · Набрано: +${earned.toLocaleString()} pts, защита: -${defended.toLocaleString()} pts`
    : '';

  if (num > 0) {
    return `<span class="pts-delta-badge pts-delta-pos" title="Прибавка за неделю${tName}: +${num.toLocaleString()} pts${breakdownHint}">▲ +${num.toLocaleString()}</span>`;
  }
  if (num < 0) {
    return `<span class="pts-delta-badge pts-delta-neg" title="Изменение за неделю${tName}: ${num.toLocaleString()} pts${breakdownHint}">▼ ${num.toLocaleString()}</span>`;
  }
  return `<span class="pts-delta-badge pts-delta-zero" title="Без изменений по очкам за последнюю неделю${tName}${breakdownHint}">0</span>`;
}

export function renderRaceDeltaBadge(raceDelta, player = null) {
  // В Чемпионской Гонке очки ТОЛЬКО прибавляются (только плюс, никогда не минус)
  const gain = Math.max(0, Math.round(Number(raceDelta) || 0));
  const tName = player?.lastTourneyName ? ` (${player.lastTourneyName})` : '';
  if (gain > 0) {
    return `<span class="pts-delta-badge pts-delta-pos" title="Прибавка в Чемпионской Гонке за последний турнир${tName}: +${gain.toLocaleString()} pts">▲ +${gain.toLocaleString()}</span>`;
  }
  return `<span class="pts-delta-badge pts-delta-zero" title="За последний турнир${tName} очки в Гонку не добавлялись">+0</span>`;
}

let filterOnlyUnknownCountry = false;

export function matchesPlayerSearchQuery(p, rawQuery) {
  if (!p) return false;
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const meta = getCountryMeta(p.flag);
  const nameWords = String(p.name || '').toLowerCase().split(/\s+/).filter(Boolean);
  const reversedName = [...nameWords].reverse().join(' ');
  const haystack = [
    String(p.name || '').toLowerCase(),
    reversedName,
    String(p.flag || '').toLowerCase(),
    String(meta.code || '').toLowerCase(),
    String(meta.nameRu || '').toLowerCase(),
    String(meta.nameEn || '').toLowerCase(),
    String(p.nickname || '').toLowerCase(),
    String(p.playStyle || '').toLowerCase(),
    `#${p.rank}`
  ].join(' ');

  return tokens.every(tok => haystack.includes(tok));
}

export function clearPlayerSearch() {
  const input = document.getElementById('playerSearch');
  if (input) input.value = '';
  renderPlayersTable();
}

export function toggleUnknownCountryFilter() {
  filterOnlyUnknownCountry = !filterOnlyUnknownCountry;
  renderPlayersTable();
}

export function quickSaveInlineFlag(playerId, rawValue, moveFocusToNext = false) {
  if (guardCanonReadOnly()) return;
  const cleanVal = String(rawValue || '').trim();
  if (!cleanVal || cleanVal === '?') return;
  const p = players.find(x => String(x.id) === String(playerId));
  if (!p) return;
  const oldNameLower = String(p.name || '').trim().toLowerCase();
  p.flag = normalizeCountryCode(cleanVal);
  recordCustomPlayerOverride(p);
  propagatePlayerIdentityUpdate(p, oldNameLower);
  savePlayers(false);
  renderPlayersTable();
  renderRaceTable();
  if (currentDraw && currentDraw.length > 0) {
    renderDraw();
  }
  const meta = getCountryMeta(p.flag);
  showToast(`✅ Страна для <b>${p.name}</b> сохранена: ${renderFlagBadge(p.flag, { compact: true })} <b>${meta.ru}</b>`, 2400);
  if (moveFocusToNext && typeof document !== 'undefined') {
    setTimeout(() => {
      const firstInline = document.querySelector('.inline-flag-quick-input');
      if (firstInline) firstInline.focus();
    }, 30);
  }
}

export function renderPlayersTable() {
  ensureCountryCodesDatalistPopulated();
  const tbody = document.getElementById('playersTableBody');
  if (!tbody) return;
  const rawSearch = document.getElementById('playerSearch')?.value || '';
  const clearBtn = document.getElementById('btnClearPlayerSearch');
  if (clearBtn) {
    clearBtn.style.display = rawSearch.trim().length > 0 ? 'inline-block' : 'none';
  }

  const unknownCount = players.filter(p => !p.flag || p.flag === '?').length;
  const filterBtn = document.getElementById('btnFilterUnknownCountry');
  if (filterBtn) {
    filterBtn.classList.toggle('active', filterOnlyUnknownCountry);
    filterBtn.textContent = `❓ Без страны (?) · ${unknownCount}`;
  }

  const filtered = players.filter(p => {
    if (filterOnlyUnknownCountry && p.flag && p.flag !== '?') return false;
    return matchesPlayerSearchQuery(p, rawSearch);
  });

  const countEl = document.getElementById('playerSearchCount');
  if (countEl) {
    if (rawSearch.trim().length > 0 || filterOnlyUnknownCountry) {
      countEl.innerHTML = `Показано: <b style="color: var(--accent);">${filtered.length}</b> из ${players.length}`;
    } else {
      countEl.textContent = '';
    }
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">
          Игроки по запросу не найдены. Попробуйте изменить запрос или отключить фильтр «❓ Без страны (?)».
        </td>
      </tr>
    `;
    return;
  }

  const readOnly = isCanonReadOnly();
  tbody.innerHTML = filtered.map(p => {
    const isUnknownFlag = !p.flag || p.flag === '?';
    const flagCellHtml = (isUnknownFlag && !readOnly)
      ? `<div style="display: flex; align-items: center; gap: 4px;">
          ${renderFlagBadge(p.flag)}
          <input
            type="text"
            class="inline-flag-quick-input"
            list="countryCodesDatalist"
            placeholder="Код/Страна"
            title="Введите код (ESP, SRB, RUS) или страну и нажмите Enter"
            style="width: 82px; padding: 3px 6px; font-size: 11.5px; background: #0d1522; border: 1px solid rgba(251, 191, 36, 0.45); border-radius: 5px; color: #f8fafc;"
            onkeydown="if(event.key==='Enter'){event.preventDefault();quickSaveInlineFlag('${p.id}', this.value, true);}"
            onchange="if(this.value.trim().length>=2){quickSaveInlineFlag('${p.id}', this.value, false);}"
          />
        </div>`
      : renderFlagBadge(p.flag);

    return `
    <tr>
      <td>
        <div style="font-weight: 700; font-size: 14px;">#${p.rank}</div>
        <div>${renderRankChangeBadge(p.rankChange || 0)}</div>
      </td>
      <td>${flagCellHtml}</td>
      <td>
        <div>
          <button type="button" class="player-profile-link" onclick="openPlayerProfileModal('${p.id}')" title="Открыть профиль игрока">${p.name}</button>
          ${renderPlayerMedalsHtml(p)}
          ${p.isNewgen ? '<span style="color: var(--primary); font-size: 11px; margin-left: 6px;">· Newgen</span>' : ''}
          ${p.nickname ? `<span class="player-nickname-badge">«${p.nickname}»</span>` : ''}
        </div>
        ${p.playStyle ? `<span class="player-style-pill">🎾 ${p.playStyle}</span>` : ''}
      </td>
      <td style="color: var(--accent); font-weight: 700;">${calculateAge(p.birthDate, currentTourDateStr)}</td>
      <td style="color: var(--text-dim); font-size: 12.5px;">${p.birthDate || '—'}</td>
      <td style="color: var(--gold); font-size: 12.5px; font-weight: 600;">#${p.bestRank || p.rank}</td>
      <td>
        <div class="pts-cell-flex">
          <span><b style="color: #fff;">${p.points.toLocaleString()}</b> <small style="color: var(--text-dim);">pts</small></span>
          ${renderPointsDeltaBadge(p.lastPointsDelta || 0, p)}
        </div>
        <div style="font-size: 10.5px; color: var(--text-dim); margin-top: 2px;">
          Гонка: <b style="color: var(--gold);">${(p.racePoints || 0).toLocaleString()}</b> · Защита: <b style="color: #94a3b8;">${(p.remainingDefending !== undefined ? p.remainingDefending : Math.max(0, p.points - (p.racePoints || 0) - (p.finalsPoints || 0))).toLocaleString()}</b>${p.finalsPoints ? ` · Итоговый: <b style="color: var(--primary);">+${p.finalsPoints.toLocaleString()}</b>` : ''}
        </div>
      </td>
      <td style="display: flex; gap: 6px;">
        <button type="button" class="btn-edit" onclick="openPlayerProfileModal('${p.id}')" title="Профиль и Зал Трофеев">👤 Профиль</button>
        ${isCanonReadOnly() ? '' : `<button type="button" class="btn-edit" onclick="openEditPlayerModal('${p.id}')">Ред.</button>`}
      </td>
    </tr>
  `;
  }).join('');
}

export function renderRaceTable() {
  const tbody = document.getElementById('raceTableBody');
  if (!tbody) return;
  const rawSearch = document.getElementById('raceSearch')?.value || '';

  const raceSorted = [...players].sort((a, b) => {
    const diff = (b.racePoints || 0) - (a.racePoints || 0);
    if (diff !== 0) return diff;
    return a.rank - b.rank;
  });

  const filtered = raceSorted.filter(p => matchesPlayerSearchQuery(p, rawSearch));

  tbody.innerHTML = filtered.map(p => {
    const raceRank = raceSorted.findIndex(x => x.id === p.id) + 1;
    let statusBadge = '';
    if (raceRank <= 8) {
      statusBadge = `<span style="color: var(--primary); font-weight: 700; font-size: 12.5px;">Квалификация Топ-8 (#${raceRank})</span>`;
    } else if (raceRank <= 10) {
      statusBadge = `<span style="color: var(--gold); font-size: 12px;">Запасной (#${raceRank})</span>`;
    } else {
      statusBadge = `<span style="color: var(--text-dim); font-size: 12px;">Претендент</span>`;
    }

    return `
      <tr style="${raceRank <= 8 ? 'background: rgba(16, 185, 129, 0.06);' : ''}">
        <td>
          <div style="font-weight: 700; font-size: 14px;">#${raceRank}</div>
          <div>${renderRankChangeBadge(p.raceRankChange || 0)}</div>
        </td>
        <td>${renderFlagBadge(p.flag)}</td>
        <td>
          <button type="button" class="player-profile-link" onclick="openPlayerProfileModal('${p.id}')" title="Открыть профиль игрока">${p.name}</button>
          ${renderPlayerMedalsHtml(p)}
        </td>
        <td style="color: var(--accent);">${calculateAge(p.birthDate, currentTourDateStr)}</td>
        <td>
          <div class="pts-cell-flex">
            <span><b style="color: var(--gold); font-size: 14.5px;">${(p.racePoints || 0).toLocaleString()}</b> <small style="color: var(--text-dim);">pts</small></span>
            ${renderRaceDeltaBadge(p.lastRaceDelta || 0, p)}
          </div>
          ${p.finalsPoints ? `<div style="font-size: 10.5px; color: var(--primary); margin-top: 2px;">+${p.finalsPoints.toLocaleString()} Итоговый · 52 нед.: <b>${p.points.toLocaleString()}</b></div>` : ''}
        </td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

export function renderCalendarTable() {
  const tbody = document.getElementById('calendarTableBody');
  if (!tbody) return;
  const selectedYear = parseInt(document.getElementById('calendarYearSelect')?.value, 10) || currentTourYear;

  const yearTourneys = getSeasonTournaments(selectedYear, tournaments);
  const histTourneys = seasonsHistory[selectedYear]?.tournamentsData || [];

  const summaryEl = document.getElementById('calendarSummaryText');
  if (summaryEl) {
    summaryEl.innerHTML = isOlympicYear(selectedYear)
      ? `Турниров в сезоне ${selectedYear}: <b>${yearTourneys.length}</b> (4 ТБШ · 9 Мастерсов · <b>1 Олимпиада 🏅</b> · 12 ATP 500 · 1 Итоговый)`
      : `Турниров в сезоне ${selectedYear}: <b>${yearTourneys.length}</b> (4 ТБШ · 9 Мастерсов · 12 ATP 500 · 1 Итоговый) + фоновый тур ATP 250`;
  }

  tbody.innerHTML = yearTourneys.map((t, idx) => {
    const dateRange = getTourneyDateRange(t, selectedYear);
    const isCurrent = (selectedYear === currentTourYear && activeTourney && t.id === activeTourney.id);
    const histEntry = histTourneys.find(h => h.id === t.id);

    let drawExists = false;
    let drawWinner = null;
    try {
      const savedD = readSavedDraw(t.id, selectedYear);
      if (savedD && savedD.length > 0 && savedD[savedD.length - 1]?.[0]?.winner) {
        drawExists = true;
        drawWinner = savedD[savedD.length - 1][0].winner;
      }
    } catch {
      drawExists = false;
    }

    const isDone = (selectedYear < currentTourYear && (histEntry?.winner || drawExists)) ||
                   (selectedYear === currentTourYear && Boolean(t.completed));

    const champObj = drawWinner || (selectedYear === currentTourYear ? t.lastWinner : null) || histEntry?.winner || null;
    const liveChamp = champObj ? (players.find(x => String(x.id) === String(champObj.id)) || champObj) : null;
    const champName = liveChamp
      ? `${renderFlagBadge(liveChamp.flag, { compact: true })} ${liveChamp.name}`
      : '';

    const statusBadge = isDone
      ? `<span style="color: var(--primary); font-weight: 600;">Завершен ✅ ${champName ? '· 🏆 ' + champName : ''}</span>`
      : (isCurrent ? `<span style="color: var(--gold); font-weight: 700;">Активный турнир 🎾</span>` : `<span style="color: var(--text-dim);">По расписанию</span>`);

    let tierClass = 'tier-text-1000';
    if (t.type === 'ТБШ') tierClass = 'tier-text-slam';
    else if (t.type === 'ATP 500') tierClass = 'tier-text-500';
    else if (t.type === 'Итоговый') tierClass = 'tier-text-finals';
    else if (t.type === 'Олимпиада') tierClass = 'tier-text-olympics';

    return `
      <tr class="${isCurrent ? 'active-tourney-row' : ''}">
        <td><b>#${idx + 1}</b></td>
        <td style="color: var(--accent); font-family: 'JetBrains Mono', monospace; font-size: 12.5px;">${dateRange}</td>
        <td><span class="${tierClass}">${t.type}</span></td>
        <td><b>${t.name}</b></td>
        <td><span class="${getSurfaceTextClass(t.surface)}">${t.surface}</span></td>
        <td>${t.size} игр.</td>
        <td>${statusBadge}</td>
        <td style="display: flex; gap: 6px;">
          <button type="button" onclick="jumpToTourney('${t.id}', ${selectedYear})">Открыть сетку</button>
          ${isCanonReadOnly() ? '' : `<button type="button" class="btn-edit" onclick="openEditTourneyModal('${t.id}')">Ред.</button>`}
        </td>
      </tr>
    `;
  }).join('');
}

export function jumpToTourney(tourneyId, year = null) {
  if (year) {
    viewingYear = parseInt(year, 10);
    const drawYearSel = document.getElementById('drawYearSelect');
    if (drawYearSel) {
      if (!Array.from(drawYearSel.options).some(o => parseInt(o.value, 10) === viewingYear)) {
        const opt = document.createElement('option');
        opt.value = String(viewingYear);
        opt.textContent = `Сезон ${viewingYear}${viewingYear < currentTourYear ? ' (Архив)' : ''}`;
        drawYearSel.appendChild(opt);
      }
      drawYearSel.value = String(viewingYear);
    }
  }
  const viewingTourneys = getSeasonTournaments(viewingYear, tournaments);
  const tSelect = document.getElementById('tourneySelect');
  if (tSelect) {
    tSelect.innerHTML = viewingTourneys.map((t, idx) => `
      <option value="${t.id}" ${t.id === tourneyId ? 'selected' : ''}>
        #${idx + 1} ${t.name} (${t.type} • ${t.surface}) [${getTourneyDateRange(t, viewingYear)}]
      </option>
    `).join('');
    tSelect.value = tourneyId;
  }
  activeTourneyId = tourneyId;
  loadSelectedTournament();
  switchTab('tourney');
}

// --- БЛОК 4: ПОЛНОЦЕННАЯ КАРТОЧКА ПРОФИЛЯ ИГРОКА (ЗАЛ ТРОФЕЕВ, МЕДАЛИ И СТАТИСТИКА СЕЗОНА) ---
function computePlayerCareerAndSeasonStats(player) {
  const pIdStr = String(player.id);
  const pNameLower = String(player.name || '').toLowerCase();

  const isSamePlayer = (cand) => {
    if (!cand) return false;
    if (cand.name && pNameLower) {
      return String(cand.name).trim().toLowerCase() === pNameLower;
    }
    if (cand.id !== undefined && String(cand.id) === pIdStr) return true;
    return false;
  };

  const titlesCount = {
    slam: 0,
    masters: 0,
    olympics: 0,
    finals: 0,
    atp500: 0
  };
  const titlesList = [];
  const olympicMedalsList = [];
  const seenTourneyYear = new Set();

  const maxYear = Math.max(2024, currentTourYear);
  for (let yr = 2023; yr <= maxYear; yr++) {
    const yearTourneys = getSeasonTournaments(yr, tournaments);
    const histTourneys = seasonsHistory[yr]?.tournamentsData || [];

    yearTourneys.forEach(t => {
      const key = `${yr}_${t.id}`;
      if (seenTourneyYear.has(key)) return;

      let winner = null;
      let runnerUp = null;
      let bronze = null;
      let score = '';

      let draw = readSavedDraw(t.id, yr);
      if (!draw || draw.length === 0) draw = null;

      const histEntry = histTourneys.find(h => h.id === t.id);

      if (yr === currentTourYear && !t.completed && (!histEntry || !histEntry.winner)) {
        // Незавершенный турнир текущего года не дает титула
        draw = null;
      }

      if (draw && draw.length > 0 && draw[draw.length - 1]?.[0]?.winner) {
        const finalM = draw[draw.length - 1][0];
        winner = finalM.winner;
        runnerUp = (finalM.p1 && finalM.p2)
          ? (String(finalM.p1.id) === String(winner.id) ? finalM.p2 : finalM.p1)
          : null;
        score = finalM.score ? finalM.score.join(' ') : '6-4 6-4';
        if (t.id === 'olympics' && draw[draw.length - 1]?.[1]?.winner) {
          bronze = draw[draw.length - 1][1].winner;
        }
      } else if (histEntry && histEntry.winner) {
        winner = histEntry.winner;
        runnerUp = histEntry.runnerUp || null;
        bronze = histEntry.bronze || null;
        score = histEntry.score || '6-4 6-4';
      }

      if (winner) {
        seenTourneyYear.add(key);
        if (isSamePlayer(winner)) {
          if (t.type === 'ТБШ') titlesCount.slam++;
          else if (t.type === 'Мастерс') titlesCount.masters++;
          else if (t.type === 'Олимпиада') titlesCount.olympics++;
          else if (t.type === 'Итоговый') titlesCount.finals++;
          else titlesCount.atp500++;

          titlesList.push({
            year: yr,
            id: t.id,
            name: t.name,
            type: t.type,
            surface: t.surface,
            runnerUpName: runnerUp ? `${runnerUp.flag} ${runnerUp.name}` : '—',
            score
          });

          if (t.id === 'olympics') {
            olympicMedalsList.push({
              year: yr,
              medal: '🥇 Золото',
              color: 'var(--gold)',
              tourneyName: t.name,
              surface: t.surface
            });
          }
        } else if (t.id === 'olympics' && isSamePlayer(runnerUp)) {
          olympicMedalsList.push({
            year: yr,
            medal: '🥈 Серебро',
            color: '#e2e8f0',
            tourneyName: t.name,
            surface: t.surface
          });
        } else if (t.id === 'olympics' && isSamePlayer(bronze)) {
          olympicMedalsList.push({
            year: yr,
            medal: '🥉 Бронза',
            color: '#fb923c',
            tourneyName: t.name,
            surface: t.surface
          });
        }
      }
    });
  }

  // Баланс побед и поражений за текущий сезон и по покрытиям
  const seasonWL = { w: 0, l: 0 };
  const careerWL = { w: 0, l: 0 };
  const surfaceWL = {
    'Хард': { w: 0, l: 0 },
    'Грунт': { w: 0, l: 0 },
    'Трава': { w: 0, l: 0 },
    'Зал': { w: 0, l: 0 }
  };

  for (let yr = 2023; yr <= maxYear; yr++) {
    const yearTourneys = getSeasonTournaments(yr, tournaments);
    yearTourneys.forEach(t => {
      const draw = readSavedDraw(t.id, yr);
      if (!draw || !Array.isArray(draw) || draw.length === 0) return;
      const surf = surfaceWL[t.surface] ? t.surface : 'Хард';
      draw.forEach(round => {
        if (!Array.isArray(round)) return;
        round.forEach(m => {
          if (!m || !m.winner || !m.p1 || !m.p2) return;
          const isP1 = isSamePlayer(m.p1);
          const isP2 = isSamePlayer(m.p2);
          if (!isP1 && !isP2) return;
          const won = isSamePlayer(m.winner);
          if (won) {
            careerWL.w++;
            if (yr === currentTourYear) {
              seasonWL.w++;
              surfaceWL[surf].w++;
            }
          } else {
            careerWL.l++;
            if (yr === currentTourYear) {
              seasonWL.l++;
              surfaceWL[surf].l++;
            }
          }
        });
      });
    });
  }

  // Таблица набранных и защищаемых очков по всем турнирам текущего года
  const currentSeasonTourneys = getSeasonTournaments(currentTourYear, tournaments);
  const tourneyPointsRows = currentSeasonTourneys.map((t, idx) => {
    const defPts = getDefendingPoints(player, t.id, currentTourYear);
    const isCompleted = Boolean(t.completed);
    const earnedPts = isCompleted ? (player.tournamentPoints?.[t.id]?.[currentTourYear] || 0) : null;
    const delta = earnedPts !== null ? (earnedPts - defPts) : null;
    return {
      num: idx + 1,
      id: t.id,
      name: t.name,
      type: t.type,
      surface: t.surface,
      completed: isCompleted,
      defPts,
      earnedPts,
      delta
    };
  });

  return {
    titlesCount,
    totalTitles: titlesList.length,
    titlesList,
    olympicMedalsList,
    seasonWL,
    careerWL,
    surfaceWL,
    tourneyPointsRows
  };
}

export function openPlayerProfileModal(playerId) {
  const player = players.find(x => String(x.id) === String(playerId));
  if (!player) {
    showToast('⚠️ Профиль игрока не найден.');
    return;
  }

  activeProfilePlayerId = player.id;
  const stats = computePlayerCareerAndSeasonStats(player);

  const raceSorted = [...players].sort((a, b) => {
    const diff = (b.racePoints || 0) - (a.racePoints || 0);
    if (diff !== 0) return diff;
    return a.rank - b.rank;
  });
  const raceRank = raceSorted.findIndex(x => String(x.id) === String(player.id)) + 1;

  const titleEl = document.getElementById('playerProfileTitle');
  const subEl = document.getElementById('playerProfileSubtitle');
  if (titleEl) {
    titleEl.innerHTML = `👤 Профиль игрока · ${renderFlagBadge(player.flag)} ${player.name}`;
  }
  if (subEl) {
    subEl.innerHTML = `Мировой рейтинг ATP (52 недели), Зал Трофеев и детальная статистика сезона ${currentTourYear}`;
  }

  const seasonTotalMatches = stats.seasonWL.w + stats.seasonWL.l;
  const seasonWinPct = seasonTotalMatches > 0 ? Math.round((stats.seasonWL.w / seasonTotalMatches) * 100) : 0;

  const careerTotalMatches = stats.careerWL.w + stats.careerWL.l;
  const careerWinPct = careerTotalMatches > 0 ? Math.round((stats.careerWL.w / careerTotalMatches) * 100) : 0;

  const totalDefendingPlayed = stats.tourneyPointsRows
    .filter(r => r.completed)
    .reduce((acc, r) => acc + r.defPts, 0);
  const totalDefendingSeason = stats.tourneyPointsRows
    .reduce((acc, r) => acc + r.defPts, 0);

  const medalsHtml = stats.olympicMedalsList.length > 0
    ? stats.olympicMedalsList.map(m => `
        <span style="display: inline-flex; align-items: center; gap: 6px; background: #131c2e; border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; font-size: 12.5px; font-weight: 700; color: ${m.color};">
          ${m.medal} · ОИ-${m.year} (${m.surface})
        </span>
      `).join('')
    : `<span style="color: var(--text-dim); font-size: 12.5px;">Медалей Олимпийских игр пока нет</span>`;

  const titlesListHtml = stats.titlesList.length > 0
    ? `
      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
        ${stats.titlesList.map(t => `
          <span style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 6px; padding: 4px 9px; font-size: 12px; color: var(--text-main);">
            🏆 <b>${t.name} (${t.year})</b> · <small style="color: var(--accent);">${t.type}</small> · <span class="match-score" style="font-size: 11px;">${t.score ? formatTennisScore(t.score.split(' ')) : ''}</span>
          </span>
        `).join('')}
      </div>
    `
    : `<div style="color: var(--text-dim); font-size: 12.5px; margin-top: 6px;">В одиночном разряде крупных титулов пока не завоевано.</div>`;

  const bodyEl = document.getElementById('playerProfileBody');
  if (bodyEl) {
    const profileSurf = activeTourney ? activeTourney.surface : 'Хард';
    const playerLiveStats = getPlayerLiveCardAnalytics(player);
    const utCardHtml = renderUltimateTeamCardHtml(player, profileSurf, { refDateStr: currentTourDateStr, liveStats: playerLiveStats });
    bodyEl.innerHTML = `
      <div style="display: grid; grid-template-columns: minmax(290px, 340px) 1fr; gap: 14px; margin-bottom: 14px; align-items: stretch;">
        ${utCardHtml}
        <div class="profile-header-card" style="margin-bottom: 0; flex-direction: column; justify-content: space-between; align-items: stretch;">
          <div class="profile-identity">
            <div class="profile-flag-badge" style="padding: 6px 10px;">${renderFlagBadge(player.flag)}</div>
            <div>
              <div class="profile-name-title">
                ${player.name}
                ${renderPlayerMedalsHtml(player)}
                ${player.nickname ? `<span class="player-nickname-badge">«${player.nickname}»</span>` : ''}
              </div>
              <div class="profile-submeta">
                Возраст: <b style="color: var(--accent);">${calculateAge(player.birthDate, currentTourDateStr)}</b> (Дата рожд.: <b>${player.birthDate || '—'}</b>)
                · Сезонов в туре: <b>${player.seasonsPlayed || 1}</b>
              </div>
              ${player.playStyle ? `<div style="margin-top: 4px;"><span class="player-style-pill">🎾 Стиль игры: ${player.playStyle}</span></div>` : ''}
            </div>
          </div>
          <div class="profile-metrics-row" style="margin-top: 10px;">
            <div class="profile-metric-pill">
              <small>Текущий ранг</small>
              <b style="color: var(--primary);">#${player.rank}</b>
            </div>
            <div class="profile-metric-pill">
              <small>Пик карьеры</small>
              <b style="color: var(--gold);">Пик: #${player.bestRank || player.rank}</b>
            </div>
            <div class="profile-metric-pill">
              <small>Очки 52 недель</small>
              <b style="color: #fff;">${(player.points || 0).toLocaleString()} <span style="font-size: 11px; color: var(--text-dim);">pts</span></b>
            </div>
            <div class="profile-metric-pill">
              <small>Гонка ${currentTourYear} (#${raceRank})</small>
              <b style="color: var(--accent);">${(player.racePoints || 0).toLocaleString()} <span style="font-size: 11px; color: var(--text-dim);">pts</span></b>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-section-box">
        <h4>🏆 Зал Трофеев (Всего титулов: <span style="color: var(--primary);">${stats.totalTitles}</span>)</h4>
        <div class="trophy-cabinet-grid">
          <div class="trophy-badge-card ${stats.titlesCount.slam > 0 ? 'has-trophy' : ''}">
            <div class="trophy-icon">🏆</div>
            <div class="trophy-count">${stats.titlesCount.slam}</div>
            <div class="trophy-label">ТБШ (Grand Slam)</div>
          </div>
          <div class="trophy-badge-card ${stats.titlesCount.masters > 0 ? 'has-trophy' : ''}">
            <div class="trophy-icon">💎</div>
            <div class="trophy-count">${stats.titlesCount.masters}</div>
            <div class="trophy-label">Мастерс 1000</div>
          </div>
          <div class="trophy-badge-card ${stats.titlesCount.olympics > 0 ? 'has-trophy' : ''}">
            <div class="trophy-icon">🥇</div>
            <div class="trophy-count">${stats.titlesCount.olympics}</div>
            <div class="trophy-label">Олимпиада</div>
          </div>
          <div class="trophy-badge-card ${stats.titlesCount.finals > 0 ? 'has-trophy' : ''}">
            <div class="trophy-icon">👑</div>
            <div class="trophy-count">${stats.titlesCount.finals}</div>
            <div class="trophy-label">Итоговый турнир</div>
          </div>
          <div class="trophy-badge-card ${stats.titlesCount.atp500 > 0 ? 'has-trophy' : ''}">
            <div class="trophy-icon">🔥</div>
            <div class="trophy-count">${stats.titlesCount.atp500}</div>
            <div class="trophy-label">ATP 500</div>
          </div>
        </div>
        ${titlesListHtml}
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 12px; color: var(--text-dim); font-weight: 600;">🏅 Олимпийские медали:</span>
          ${medalsHtml}
        </div>
      </div>

      <div class="profile-section-box">
        <h4>📊 Статистика матчей (W - L) и баланс по покрытиям</h4>
        <div class="profile-stats-grid">
          <div class="profile-wl-box">
            <small>Баланс в сезоне ${currentTourYear} (W - L)</small>
            <b style="color: var(--primary);">${stats.seasonWL.w} - ${stats.seasonWL.l} <span style="font-size: 12px; color: var(--text-dim);">(${seasonWinPct}%)</span></b>
          </div>
          <div class="profile-wl-box">
            <small>Карьерный баланс (2023–${currentTourYear})</small>
            <b style="color: var(--accent);">${stats.careerWL.w} - ${stats.careerWL.l} <span style="font-size: 12px; color: var(--text-dim);">(${careerWinPct}%)</span></b>
          </div>
          <div class="profile-wl-box">
            <small>По покрытиям в ${currentTourYear} году</small>
            <div style="font-size: 12px; font-weight: 600; display: flex; gap: 8px; flex-wrap: wrap;">
              <span class="surface-text-hard">Хард: ${stats.surfaceWL['Хард'].w}-${stats.surfaceWL['Хард'].l}</span>
              <span class="surface-text-clay">Грунт: ${stats.surfaceWL['Грунт'].w}-${stats.surfaceWL['Грунт'].l}</span>
              <span class="surface-text-grass">Трава: ${stats.surfaceWL['Трава'].w}-${stats.surfaceWL['Трава'].l}</span>
              <span class="surface-text-indoor">Зал: ${stats.surfaceWL['Зал'].w}-${stats.surfaceWL['Зал'].l}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-section-box">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
          <h4 style="margin: 0;">📅 Таблица набранных и защищаемых очков по всем турнирам (${currentTourYear})</h4>
          <div style="font-size: 12px; color: var(--text-dim);">
            Списано защиты: <b style="color: #f87171;">-${totalDefendingPlayed.toLocaleString()}</b> из ${totalDefendingSeason.toLocaleString()} pts ·
            Осталось защитить: <b style="color: var(--gold);">${Math.max(0, totalDefendingSeason - totalDefendingPlayed).toLocaleString()} pts</b> ·
            Набрано в ${currentTourYear}: <b style="color: var(--primary);">+${(player.racePoints || 0).toLocaleString()} pts</b>${player.finalsPoints ? ` (+${player.finalsPoints.toLocaleString()} Итоговый)` : ''}
          </div>
        </div>
        <div style="border: 1px solid var(--border); border-radius: 6px;">
          <table class="custom-table" style="font-size: 12px;">
            <thead>
              <tr>
                <th style="width: 44px;">#</th>
                <th>Турнир</th>
                <th>Категория</th>
                <th>Покрытие</th>
                <th>Защита ${currentTourYear - 1}</th>
                <th>Набрано ${currentTourYear}</th>
                <th>Баланс (Δ)</th>
              </tr>
            </thead>
            <tbody>
              ${stats.tourneyPointsRows.map(r => {
                let deltaHtml = '<span style="color: var(--text-dim);">Впереди</span>';
                if (r.delta !== null) {
                  if (r.delta > 0) deltaHtml = `<span style="color: #10b981; font-weight: 700;">+${r.delta}</span>`;
                  else if (r.delta < 0) deltaHtml = `<span style="color: #ef4444; font-weight: 700;">${r.delta}</span>`;
                  else deltaHtml = `<span style="color: var(--text-dim);">0</span>`;
                }
                return `
                  <tr>
                    <td><b>#${r.num}</b></td>
                    <td><b>${r.name}</b></td>
                    <td>${r.type}</td>
                    <td><span class="${getSurfaceTextClass(r.surface)}">${r.surface}</span></td>
                    <td style="color: var(--gold); font-weight: 600;">${r.defPts > 0 ? r.defPts.toLocaleString() : '0'}</td>
                    <td style="color: ${r.completed ? 'var(--primary)' : 'var(--text-dim)'}; font-weight: 700;">
                      ${r.completed ? (r.earnedPts || 0).toLocaleString() : '—'}
                    </td>
                    <td>${deltaHtml}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  document.getElementById('playerProfileModal')?.classList.add('open');
}

export function openEditFromPlayerProfile() {
  if (!activeProfilePlayerId) return;
  const targetId = activeProfilePlayerId;
  closeModal('playerProfileModal');
  openEditPlayerModal(targetId);
}

// --- 8. МОДАЛКИ РЕДАКТИРОВАНИЯ ИГРОКОВ, ТУРНИРОВ И GROQ API ---
function ensureCountryCodesDatalistPopulated() {
  if (typeof document === 'undefined') return;
  const dl = document.getElementById('countryCodesDatalist');
  if (!dl || dl.dataset.populated === '1') return;
  dl.innerHTML = COUNTRY_CATALOG.map(c =>
    `<option value="${c.code}">${c.ru} (${c.en})</option>`
  ).join('');
  dl.dataset.populated = '1';
}

export function updateEditPlayerFlagPreview() {
  if (typeof document === 'undefined') return;
  const input = document.getElementById('editPlayerFlag');
  const preview = document.getElementById('editPlayerFlagPreview');
  if (!input || !preview) return;
  const raw = input.value.trim();
  const normCode = normalizeCountryCode(raw || '?');
  const meta = getCountryMeta(normCode);
  preview.innerHTML = `
    ${renderFlagBadge(normCode)}
    <span style="font-size: 11.5px; color: var(--text-dim); font-weight: 600; white-space: nowrap;">${meta.ru}</span>
  `;
}

export function openEditPlayerModal(id) {
  if (guardCanonReadOnly()) return;
  const p = players.find(x => String(x.id) === String(id));
  if (!p) return;
  ensureCountryCodesDatalistPopulated();
  document.getElementById('editPlayerId').value = p.id;
  document.getElementById('editPlayerName').value = p.name;
  document.getElementById('editPlayerFlag').value = p.flag;
  document.getElementById('editPlayerBirth').value = p.birthDate || '2000-01-01';
  const nickInput = document.getElementById('editPlayerNickname');
  if (nickInput) nickInput.value = p.nickname || '';
  const styleInput = document.getElementById('editPlayerPlayStyle');
  if (styleInput) styleInput.value = p.playStyle || '';
  document.getElementById('editPlayerPoints').value = p.points;
  updateEditPlayerFlagPreview();
  document.getElementById('editPlayerModal').classList.add('open');
}

export function savePlayerEdit() {
  if (guardCanonReadOnly()) return;
  const id = document.getElementById('editPlayerId').value;
  const p = players.find(x => String(x.id) === String(id));
  if (p) {
    const oldNameLower = String(p.name || '').trim().toLowerCase();
    const newName = document.getElementById('editPlayerName').value.trim();
    const rawFlag = document.getElementById('editPlayerFlag').value.trim();
    if (newName && !/\d/.test(newName)) p.name = newName;
    if (rawFlag) {
      p.flag = normalizeCountryCode(rawFlag);
    }
    p.birthDate = document.getElementById('editPlayerBirth').value || p.birthDate;
    const nickInput = document.getElementById('editPlayerNickname');
    if (nickInput) p.nickname = nickInput.value.trim();
    const styleInput = document.getElementById('editPlayerPlayStyle');
    if (styleInput) p.playStyle = styleInput.value.trim();

    recordCustomPlayerOverride(p);
    propagatePlayerIdentityUpdate(p, oldNameLower);
    savePlayers(false);
    renderPlayersTable();
    renderRaceTable();
    renderCalendarTable();
    if (currentDraw && currentDraw.length > 0) {
      renderDraw();
    }
    const meta = getCountryMeta(p.flag);
    closeModal('editPlayerModal');
    showToast(`✅ Данные игрока <b>${p.name}</b> сохранены (${renderFlagBadge(p.flag, { compact: true })} ${meta.ru}).`);
  }
}

export async function generateSinglePlayerStyleWithGroq() {
  const id = document.getElementById('editPlayerId')?.value;
  const p = players.find(x => x.id === id);
  const nameVal = document.getElementById('editPlayerName')?.value?.trim() || p?.name || 'Tennis Player';
  const flagVal = document.getElementById('editPlayerFlag')?.value?.trim() || p?.flag || 'ATP';
  const btn = document.getElementById('btnGenPlayerStyleGroq');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '🧠 Генерация...';
  }
  try {
    const tempObj = {
      id: id || 'temp_player',
      name: nameVal,
      flag: flagVal,
      ageAtEntry: 20
    };
    const [enriched] = await enrichNewgensWithGroq([tempObj]);
    if (enriched) {
      const nickInput = document.getElementById('editPlayerNickname');
      const styleInput = document.getElementById('editPlayerPlayStyle');
      if (nickInput && enriched.nickname) nickInput.value = enriched.nickname;
      if (styleInput && enriched.playStyle) styleInput.value = enriched.playStyle;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🧠 Сгенерировать профиль (Groq)';
    }
  }
}

export function openAddPlayerModal() {
  if (guardCanonReadOnly()) return;
  document.getElementById('newPlayerName').value = '';
  document.getElementById('newPlayerFlag').value = 'USA';
  document.getElementById('newPlayerBirth').value = '2003-05-15';
  const errEl = document.getElementById('addPlayerError');
  if (errEl) errEl.style.display = 'none';
  document.getElementById('addPlayerModal').classList.add('open');
}

export function confirmAddPlayer() {
  if (guardCanonReadOnly()) return;
  const name = document.getElementById('newPlayerName').value.trim();
  const country = normalizeCountryCode(document.getElementById('newPlayerFlag').value.trim() || 'USA');
  const birth = document.getElementById('newPlayerBirth').value || '2003-05-15';
  const errEl = document.getElementById('addPlayerError');

  if (!name || /\d/.test(name)) {
    if (errEl) {
      errEl.innerText = 'Введите корректное имя и фамилию на латинице без цифр.';
      errEl.style.display = 'block';
    }
    return;
  }

  players.push({
    id: 'p_custom_' + Date.now(),
    rank: players.length + 1,
    name,
    flag: country,
    points: 25,
    racePoints: 0,
    birthDate: birth,
    tournamentPoints: {},
    rankChange: 0,
    bestRank: players.length + 1,
    seasonsPlayed: 1,
    medals: { gold: 0, silver: 0, bronze: 0 }
  });

  savePlayers(false);
  renderPlayersTable();
  renderRaceTable();
  closeModal('addPlayerModal');
  showToast(`✅ Игрок <b>${name} (${country})</b> добавлен в тур.`);
}

export function openEditTourneyModal(id) {
  if (guardCanonReadOnly()) return;
  const viewingTourneys = getSeasonTournaments(viewingYear, tournaments);
  const t = viewingTourneys.find(x => x.id === id) || tournaments.find(x => x.id === id);
  if (!t) return;
  document.getElementById('editTourneyId').value = t.id;
  document.getElementById('editTourneyName').value = t.name;
  document.getElementById('editTourneySurface').value = t.surface;
  document.getElementById('editTourneyModal').classList.add('open');
}

export function openEditCurrentTourney() {
  if (activeTourney) openEditTourneyModal(activeTourney.id);
}

export function saveTourneyEdit() {
  const id = document.getElementById('editTourneyId').value;
  const t = tournaments.find(x => x.id === id);
  if (t) {
    const newName = document.getElementById('editTourneyName').value.trim();
    const newSurface = document.getElementById('editTourneySurface').value;
    if (newName) t.name = newName;
    if (newSurface) t.surface = newSurface;
    saveTournaments();
    initUI();
    closeModal('editTourneyModal');
    showToast(`✅ Турнир <b>${t.name}</b> обновлен.`);
  }
}

export function openPointsInfoModal() {
  document.getElementById('pointsInfoModal').classList.add('open');
}

function updateGroqStatusBadgeUI() {
  const badge = document.getElementById('groqKeyStatusBadge');
  if (!badge) return;
  const activeKey = getGroqApiKey();
  const model = normalizeGroqModelName(getGroqModel());
  if (activeKey) {
    const masked = activeKey.length > 8
      ? `${activeKey.slice(0, 4)}••••${activeKey.slice(-4)}`
      : '••••••••';
    badge.style.borderColor = 'var(--primary)';
    badge.style.color = 'var(--primary)';
    badge.innerHTML = `🟢 <b>Ключ Groq API активен</b> (${masked}) · Модель: <b>${model}</b>`;
  } else {
    badge.style.borderColor = 'var(--gold)';
    badge.style.color = 'var(--gold)';
    badge.innerHTML = `🟡 <b>Ключ Groq не задан</b>`;
  }
}

export function openApiSettingsModal() {
  const input = document.getElementById('groqApiKeyInput');
  const modelSel = document.getElementById('groqModelSelect');
  if (input) input.value = getGroqApiKey();
  if (modelSel) modelSel.value = normalizeGroqModelName(getGroqModel());
  updateGroqStatusBadgeUI();
  document.getElementById('apiSettingsModal')?.classList.add('open');
}

export function saveGroqApiSettings() {
  const input = document.getElementById('groqApiKeyInput');
  const modelSel = document.getElementById('groqModelSelect');
  if (input) setGroqApiKey(input.value);
  if (modelSel) setGroqModel(normalizeGroqModelName(modelSel.value));
  updateGroqStatusBadgeUI();
  closeModal('apiSettingsModal');
  showToast(`⚙️ Настройки Groq API сохранены! Активная модель: <b>${getGroqModel()}</b>.`);
}

export function clearGroqApiKeySettings() {
  setGroqApiKey(DEFAULT_GROQ_API_KEY);
  const input = document.getElementById('groqApiKeyInput');
  if (input) input.value = DEFAULT_GROQ_API_KEY;
  updateGroqStatusBadgeUI();
  showToast('🔄 Восстановлен ключ Groq API по умолчанию.');
}

// --- 9. ЗАЛ СЛАВЫ (АРХИВ СЕЗОНОВ, 5 СРЕЗОВ ТОП-50, МЕДАЛИ И ЛЕГЕНДЫ ТУРА) ---
export function switchHallSubtab(subtab) {
  activeHallSubtab = subtab;
  const btnArch = document.getElementById('subtab-archive-btn');
  const btnLeg = document.getElementById('subtab-legends-btn');
  const contentArch = document.getElementById('historyContent');
  const contentLeg = document.getElementById('legendsContent');
  const pickerWrap = document.getElementById('historyYearPickerWrap');

  if (subtab === 'legends') {
    btnArch?.classList.remove('active');
    btnLeg?.classList.add('active');
    if (contentArch) contentArch.style.display = 'none';
    if (contentLeg) contentLeg.style.display = 'block';
    if (pickerWrap) pickerWrap.style.display = 'none';
    renderLegendsTab();
  } else {
    btnLeg?.classList.remove('active');
    btnArch?.classList.add('active');
    if (contentLeg) contentLeg.style.display = 'none';
    if (contentArch) contentArch.style.display = 'block';
    if (pickerWrap) pickerWrap.style.display = 'flex';
    renderHistoryYear();
  }
}

export function initHistoryUI() {
  const select = document.getElementById('historyYearSelect');
  if (!select) return;
  const years = Object.keys(seasonsHistory).sort((a, b) => Number(b) - Number(a));
  if (years.length === 0) {
    select.innerHTML = '<option value="2024">Сезон 2024</option>';
    return;
  }
  // По умолчанию показываем последний завершенный сезон тура (например 2024 при старте 2025), либо сохраняем текущий выбор
  const lastFinishedYear = String(currentTourYear - 1);
  const defaultYear = years.includes(lastFinishedYear) ? lastFinishedYear : (years[0] || '2024');
  const currentSelected = select.value && years.includes(select.value) ? select.value : defaultYear;
  select.innerHTML = years.map(y => `<option value="${y}" ${y === currentSelected ? 'selected' : ''}>Сезон ${y}</option>`).join('');
  select.value = currentSelected;

  if (activeHallSubtab === 'legends') {
    renderLegendsTab();
  } else {
    renderHistoryYear();
  }
}

export function setSnapshotKey(key) {
  activeSnapshotKey = key;
  renderHistoryYear();
}

export function setCompareMode(mode) {
  activeCompareMode = mode;
  renderHistoryYear();
}

export function renderHistoryYear() {
  const year = document.getElementById('historyYearSelect')?.value || '2023';
  syncSeasonHistoryWithActualDraws(year);
  const data = seasonsHistory[year];
  const container = document.getElementById('historyContent');
  if (!container || !data) return;

  const slamSnaps = data.slamSnapshots || {};
  const yearEnd50 = data.yearEndTop50 || [];
  const start50 = data.seasonStartTop50 || seasonsHistory[Number(year) - 1]?.yearEndTop50 || [];

  let activeList = [];
  let activeTitle = '';
  let prevRefList = start50;

  if (activeSnapshotKey === 'yearEnd') {
    activeList = yearEnd50;
    activeTitle = `Итоговый Топ-50 сезона ${year} года`;
    prevRefList = activeCompareMode === 'start' ? start50 : (slamSnaps['tbsh_4']?.top50 || start50);
  } else if (slamSnaps[activeSnapshotKey]) {
    activeList = slamSnaps[activeSnapshotKey].top50 || [];
    activeTitle = `Срез Топ-50 после ${slamSnaps[activeSnapshotKey].tourneyName} (${slamSnaps[activeSnapshotKey].date})`;
    const slamOrder = ['tbsh_1', 'tbsh_2', 'tbsh_3', 'tbsh_4'];
    const idx = slamOrder.indexOf(activeSnapshotKey);
    if (activeCompareMode === 'start' || idx <= 0) {
      prevRefList = start50;
    } else {
      prevRefList = slamSnaps[slamOrder[idx - 1]]?.top50 || start50;
    }
  }

  const refRankMap = {};
  (prevRefList || []).forEach(p => {
    if (p && p.id) refRankMap[p.id] = p.rank;
    else if (p && p.name) refRankMap[p.name] = p.rank;
  });

  const comparisonLabel = activeCompareMode === 'start'
    ? 'Динамика (к началу года)'
    : 'Динамика (к пред. Шлему)';

  const savedTourneysMap = {};
  (data.tournamentsData || []).forEach(t => { savedTourneysMap[t.id] = t; });

  const seasonTemplateList = getSeasonTournaments(Number(year), tournaments);
  const fullTourneysList = seasonTemplateList.map(tmpl => {
    const saved = savedTourneysMap[tmpl.id];
    const isMajor = ['ТБШ', 'Мастерс', 'Итоговый', 'Олимпиада'].includes(tmpl.type);

    let d = null;
    try {
      const candidate = readSavedDraw(tmpl.id, Number(year));
      if (Array.isArray(candidate) && candidate.length > 0 && candidate[candidate.length - 1]?.[0]?.winner) {
        d = candidate;
      }
    } catch {
      d = null;
    }

    if (d) {
      const fm = d[d.length - 1][0];
      const w = fm.winner;
      const ru = (fm.p1 && fm.p2) ? (String(fm.p1.id) === String(w.id) ? fm.p2 : fm.p1) : null;
      const bronzeM = tmpl.id === 'olympics' ? d[d.length - 1]?.[1] : null;
      const scoreStr = Array.isArray(fm.score) && fm.score.length > 0 ? fm.score.join(' ') : (typeof fm.score === 'string' && fm.score ? fm.score : '6-4 6-4');
      const bronzeWinner = bronzeM?.winner || null;

      // Проверяем, подходит ли колонка прессы от saved, или нужно перегенерировать под реального чемпиона w
      let pressCol = saved?.pressColumn || null;
      const pressMatchesWinner = pressCol?.headline && (
        (w.name && pressCol.headline.includes(w.name)) ||
        (w.name && pressCol.article && pressCol.article.includes(w.name))
      );
      if (isMajor && (!pressCol || !pressMatchesWinner)) {
        pressCol = buildFallbackFinalPressColumn({
          tourneyName: tmpl.name,
          tourneyType: tmpl.type,
          surface: tmpl.surface,
          year: Number(year),
          winner: w,
          runnerUp: ru,
          score: scoreStr
        });
      }

      return {
        id: tmpl.id,
        name: tmpl.name,
        type: tmpl.type,
        surface: tmpl.surface,
        winner: w,
        runnerUp: ru,
        bronze: bronzeWinner,
        score: scoreStr,
        pressColumn: pressCol
      };
    }

    if (saved && saved.winner) {
      if (isMajor && !saved.pressColumn) {
        saved.pressColumn = buildFallbackFinalPressColumn({
          tourneyName: saved.name,
          tourneyType: saved.type,
          surface: saved.surface,
          year: Number(year),
          winner: saved.winner,
          runnerUp: saved.runnerUp,
          score: saved.score
        });
      }
      return saved;
    }

    return saved || {
      id: tmpl.id,
      name: tmpl.name,
      type: tmpl.type,
      surface: tmpl.surface,
      winner: null,
      runnerUp: null,
      bronze: null,
      score: '—',
      pressColumn: null
    };
  });

  const majorColumnsList = fullTourneysList.filter(t => t.winner && t.pressColumn && t.pressColumn.headline);

  // 1. Главные турниры сезона (Мэйджоры: ТБШ, Олимпиада, Итоговый)
  const majorsList = fullTourneysList.filter(t => ['ТБШ', 'Олимпиада', 'Итоговый'].includes(t.type));

  // 2. Лидеры сезона по завоеванным титулам (нормализация по имени)
  const titleCountsMap = {};
  fullTourneysList.forEach(t => {
    if (t && t.winner && t.winner.name) {
      const key = (t.winner.name || '').trim().toLowerCase();
      if (!titleCountsMap[key]) {
        titleCountsMap[key] = { player: t.winner, count: 0, majors: 0, tourneys: [] };
      }
      titleCountsMap[key].count++;
      if (['ТБШ', 'Олимпиада', 'Итоговый'].includes(t.type)) {
        titleCountsMap[key].majors++;
      }
      titleCountsMap[key].tourneys.push(t.name);
    }
  });
  const topTitleWinners = Object.values(titleCountsMap).sort((a, b) => b.count !== a.count ? b.count - a.count : b.majors - a.majors);

  // 3. Участники, завершившие карьеру по итогам выбранного сезона
  const seasonRetirees = (retiredLegends || []).filter(r => String(r.retiredYear) === String(year));

  const rawWorldNo1 = data.worldNumberOne || activeList[0] || players[0];
  const worldNo1 = rawWorldNo1 ? (players.find(x => String(x.id) === String(rawWorldNo1.id)) || rawWorldNo1) : players[0];

  const html = `
    <div class="history-card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="font-size: 12px; color: var(--gold); font-weight: 700;">ПЕРВАЯ РАКЕТКА МИРА ПО ИТОГАМ ${year} ГОДА</div>
        <div style="font-size: 21px; font-weight: 800; margin-top: 4px; display: flex; align-items: center; gap: 8px;">
          ${renderFlagBadge(worldNo1.flag)} <button type="button" class="player-profile-link" style="font-size: 21px; font-weight: 800;" onclick="openPlayerProfileModal('${worldNo1.id}')">${worldNo1.name}</button>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 12px; color: var(--text-dim);">Итоговые очки 52 недель:</div>
        <div style="font-size: 19px; color: var(--accent); font-weight: 800;">${(worldNo1.points || 0).toLocaleString()} pts</div>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 16px;">
      <div>
        <h3 style="font-size: 16px; margin-bottom: 4px;">📊 Снимки Рейтинга Топ-50 за ${year} год</h3>
        <small style="color: var(--text-dim);">Переключайтесь между срезами после каждого ТБШ и итоговым рейтингом сезона:</small>
      </div>
      <div style="display: flex; gap: 6px; align-items: center;">
        <span style="font-size: 12px; color: var(--text-dim);">Сравнение динамики:</span>
        <button type="button" class="btn-edit" style="${activeCompareMode === 'prev' ? 'border-color: var(--accent); color: var(--accent);' : ''}" onclick="setCompareMode('prev')">К пред. Шлему</button>
        <button type="button" class="btn-edit" style="${activeCompareMode === 'start' ? 'border-color: var(--accent); color: var(--accent);' : ''}" onclick="setCompareMode('start')">К началу года</button>
      </div>
    </div>

    <div class="snapshot-tabs" role="tablist" aria-label="Снимки Топ-50 сезона">
      <button type="button" class="snapshot-btn ${activeSnapshotKey === 'tbsh_1' ? 'active' : ''}" onclick="setSnapshotKey('tbsh_1')">Срез Топ-50 после 1-го ТБШ</button>
      <button type="button" class="snapshot-btn ${activeSnapshotKey === 'tbsh_2' ? 'active' : ''}" onclick="setSnapshotKey('tbsh_2')">Срез Топ-50 после 2-го ТБШ</button>
      <button type="button" class="snapshot-btn ${activeSnapshotKey === 'tbsh_3' ? 'active' : ''}" onclick="setSnapshotKey('tbsh_3')">Срез Топ-50 после 3-го ТБШ</button>
      <button type="button" class="snapshot-btn ${activeSnapshotKey === 'tbsh_4' ? 'active' : ''}" onclick="setSnapshotKey('tbsh_4')">Срез Топ-50 после 4-го ТБШ</button>
      <button type="button" class="snapshot-btn ${activeSnapshotKey === 'yearEnd' ? 'active' : ''}" onclick="setSnapshotKey('yearEnd')">Итоговый Топ-50 сезона</button>
    </div>

    <div style="font-size: 14px; font-weight: 700; color: var(--accent); margin-bottom: 10px;">${activeTitle}</div>

    ${activeList.length === 0 ? `
      <div style="padding: 24px; color: var(--text-dim); text-align: center; border: 1px dashed var(--border); border-radius: 8px; margin-bottom: 24px;">
        Срез для этого турнира Большого Шлема появится автоматически сразу после завершения турнира в сезоне ${year}.
      </div>
    ` : `
      <div style="margin-bottom: 28px;">
        <table class="custom-table">
          <thead>
            <tr>
              <th style="width: 75px;">Ранг</th>
              <th style="width: 195px;">${comparisonLabel}</th>
              <th style="width: 80px;">Страна</th>
              <th>Игрок</th>
              <th style="width: 100px;">Возраст</th>
              <th>Очки ATP</th>
            </tr>
          </thead>
          <tbody>
            ${activeList.map(p => {
              const refRank = refRankMap[p.id] || refRankMap[p.name];
              const delta = refRank !== undefined ? (refRank - p.rank) : (p.rankDelta || 0);
              const liveP = players.find(x => String(x.id) === String(p.id)) || p;
              const dispFlag = (liveP && liveP.flag && liveP.flag !== '?') ? liveP.flag : p.flag;
              return `
                <tr>
                  <td><b>#${p.rank}</b></td>
                  <td>${renderRankChangeBadge(delta)}</td>
                  <td>${renderFlagBadge(dispFlag)}</td>
                  <td>
                    <button type="button" class="player-profile-link" onclick="openPlayerProfileModal('${liveP.id}')">${liveP.name || p.name}</button>
                    ${renderPlayerMedalsHtml(liveP)}
                  </td>
                  <td style="color: var(--accent);">${p.age || calculateAge(p.birthDate, `${year}-06-15`)}</td>
                  <td><b>${(p.points || 0).toLocaleString()}</b> <small style="color:var(--text-dim);">pts</small></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `}

    <div class="history-card" style="margin-bottom: 24px; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px;">
        <div>
          <h3 style="font-size: 17px; color: var(--gold); margin: 0 0 4px 0;">🏆 Главные итоги сезона ${year} года</h3>
          <small style="color: var(--text-dim);">Триумфаторы турниров Большого Шлема, Олимпийских игр, Итогового турнира, лидеры по титулам и завершившие карьеру:</small>
        </div>
        <div style="font-size: 12px; background: rgba(245, 158, 11, 0.15); color: var(--gold); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 4px; padding: 3px 8px; font-weight: 700;">
          Завершено турниров: ${fullTourneysList.filter(t => t.winner).length} из ${fullTourneysList.length}
        </div>
      </div>

      <!-- Сетка главных триумфаторов (Мэйджоры) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-bottom: 18px;">
        ${majorsList.map(m => {
          const isOly = m.id === 'olympics';
          const typeBadge = isOly ? '🏅 Олимпиада' : (m.type === 'Итоговый' ? '🛡️ Итоговый турнир' : '🏆 ТБШ');
          const w = m.winner ? (players.find(x => String(x.id) === String(m.winner.id)) || m.winner) : null;
          const ru = m.runnerUp ? (players.find(x => String(x.id) === String(m.runnerUp.id)) || m.runnerUp) : null;
          const br = m.bronze ? (players.find(x => String(x.id) === String(m.bronze.id)) || m.bronze) : null;
          return `
            <div style="background: #0e1624; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 6px;">
                  <span style="color: var(--gold); font-weight: 700;">${typeBadge}</span>
                  <span class="${getSurfaceTextClass(m.surface)}">${m.surface}</span>
                </div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">${m.name}</div>
                <div style="font-size: 13px; display: flex; align-items: center; gap: 6px;">
                  <span style="color: var(--gold); font-weight: 800;">${isOly ? '🥇 ' : '🏆 '}</span>
                  ${w ? `${renderFlagBadge(w.flag, { compact: true })} <button type="button" class="player-profile-link" style="color: var(--primary); font-weight: 700;" onclick="openPlayerProfileModal('${w.id}')">${w.name}</button>` : '<span style="color:var(--text-dim);">—</span>'}
                </div>
                <div style="font-size: 12px; color: var(--text-dim); margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                  <span>${isOly ? '🥈' : 'Финалист:'}</span>
                  ${ru ? `${renderFlagBadge(ru.flag, { compact: true })} <button type="button" class="player-profile-link" onclick="openPlayerProfileModal('${ru.id}')">${ru.name}</button>` : '—'}
                </div>
                ${isOly && br ? `
                  <div style="font-size: 12px; color: #fb923c; margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                    <span>🥉 Бронза:</span>
                    ${renderFlagBadge(br.flag, { compact: true })} <button type="button" class="player-profile-link" onclick="openPlayerProfileModal('${br.id}')">${br.name}</button>
                  </div>
                ` : ''}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; margin-top: 4px;">
                <span style="color: var(--text-dim);">Счет финала:</span>
                <span class="match-score">${m.score && m.score !== '—' ? formatTennisScore(m.score.split(' ')) : '—'}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Лидеры по завоеванным титулам -->
      <div style="background: #0e1624; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; margin-bottom: 18px;">
        <div style="font-size: 13px; font-weight: 700; color: var(--accent); margin-bottom: 10px;">🎾 Лидеры сезона ${year} года по завоеванным титулам:</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${topTitleWinners.slice(0, 6).map(tw => `
            <div style="background: #131c2e; border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 12.5px; display: flex; align-items: center; gap: 7px;">
              ${renderFlagBadge(tw.player.flag, { compact: true })}
              <button type="button" class="player-profile-link" onclick="openPlayerProfileModal('${tw.player.id}')" style="font-weight: 700;">${tw.player.name}</button>
              <span style="background: var(--primary); color: #05080c; font-weight: 800; font-size: 11px; padding: 1px 6px; border-radius: 4px;">
                ${tw.count} ${tw.count === 1 ? 'титул' : (tw.count < 5 ? 'титула' : 'титулов')}
              </span>
              ${tw.majors > 0 ? `<span style="color: var(--gold); font-size: 11px; font-weight: 700;">(${tw.majors} мэйдж.)</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Завершили карьеру по итогам сезона -->
      <div style="background: #0e1624; border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-size: 14px; font-weight: 700; color: var(--gold);">
              👋 Завершили карьеру по итогам ${year} года (${seasonRetirees.length} игр.)
            </div>
            <small style="color: var(--text-dim);">Ветераны тура, сыгравшие свой последний профессиональный сезон в ${year} году:</small>
          </div>
          <button type="button" class="btn-gold btn-compact" onclick="switchHallSubtab('legends')" style="font-size: 11.5px; padding: 3px 9px;">
            📜 Все легенды Зала Славы →
          </button>
        </div>

        ${seasonRetirees.length === 0 ? `
          <div style="font-size: 12.5px; color: var(--text-dim); padding: 8px 0;">
            В этом сезоне никто из игроков топ-пула не объявил о завершении карьеры.
          </div>
        ` : `
          <div class="legends-grid" style="margin-top: 8px;">
            ${seasonRetirees.map(leg => `
              <div class="legend-card" style="background: #131c2e;">
                <div class="legend-card-header">
                  <span class="legend-name">${renderFlagBadge(leg.flag, { compact: true })} ${leg.name}</span>
                  <span style="color: var(--gold); font-size: 11.5px; font-weight: 700;">Выпуск ${leg.retiredYear}</span>
                </div>
                <div class="legend-meta">
                  Возраст ухода: <b style="color: var(--text-main);">${leg.retiredAge} лет</b> (${leg.birthDate || '—'})
                </div>
                <div class="legend-meta">
                  Наивысший рейтинг: <b style="color: var(--primary);">#${leg.bestRank}</b> · Финальный ранг: <b>#${leg.finalRank}</b>
                </div>
                <div class="legend-meta">
                  Сыграно сезонов: <b>${leg.seasonsPlayed || 1}</b> · Очки: <b>${(leg.finalPoints || 0).toLocaleString()} pts</b>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>

    <h3 style="margin: 18px 0 10px 0; font-size: 16px;">🏆 Таблица чемпионов всех ${fullTourneysList.length} турниров сезона ${year}</h3>
    <div style="margin-bottom: 24px;">
      <table class="custom-table">
        <thead>
          <tr>
            <th style="width: 50px;">№</th>
            <th>Турнир</th>
            <th>Категория</th>
            <th>Покрытие</th>
            <th>Чемпион</th>
            <th>Финалист / Призеры</th>
            <th>Счет финала</th>
            <th style="width: 140px;">Историческая сетка</th>
          </tr>
        </thead>
        <tbody>
          ${fullTourneysList.map((t, idx) => {
            const isOly = t.id === 'olympics';
            const liveW = t.winner ? (players.find(x => String(x.id) === String(t.winner.id)) || t.winner) : null;
            const liveRU = t.runnerUp ? (players.find(x => String(x.id) === String(t.runnerUp.id)) || t.runnerUp) : null;
            const liveBr = t.bronze ? (players.find(x => String(x.id) === String(t.bronze.id)) || t.bronze) : null;
            const champCell = liveW
              ? `${isOly ? '🥇 ' : ''}${renderFlagBadge(liveW.flag, { compact: true })} <button type="button" class="player-profile-link" style="color: var(--primary);" onclick="openPlayerProfileModal('${liveW.id}')">${liveW.name}</button>`
              : '—';
            let ruCell = liveRU
              ? `${isOly ? '🥈 ' : ''}${renderFlagBadge(liveRU.flag, { compact: true })} <button type="button" class="player-profile-link" onclick="openPlayerProfileModal('${liveRU.id}')">${liveRU.name}</button>`
              : '—';
            if (isOly && liveBr) {
              ruCell += ` · <span style="color:#fb923c;">🥉 ${renderFlagBadge(liveBr.flag, { compact: true })} ${liveBr.name}</span>`;
            }
            return `
              <tr>
                <td><b>#${idx + 1}</b></td>
                <td><b>${t.name}</b></td>
                <td>${t.type}</td>
                <td><span class="${getSurfaceTextClass(t.surface)}">${t.surface}</span></td>
                <td style="color: var(--primary); font-weight: 700;">${champCell}</td>
                <td style="color: var(--text-dim);">${ruCell}</td>
                <td class="match-score">${t.score && t.score !== '—' ? formatTennisScore(t.score.split(' ')) : '—'}</td>
                <td>
                  <button type="button" onclick="jumpToTourney('${t.id}', ${year})">🔍 Вся сетка</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <h3 id="historyPressColumnsSection" style="margin: 18px 0 6px 0; font-size: 16px;">📰 Послематчевая колонка финалов ТБШ и Мастерсов (${year})</h3>
    <small style="color: var(--text-dim); display: block; margin-bottom: 12px;">Аналитические материалы и заметки прессы (3–4 предложения) по итогам главных финалов сезона (Groq API + редакторский архив):</small>
    ${majorColumnsList.length === 0 ? `
      <div style="padding: 20px; color: var(--text-dim); text-align: center; border: 1px dashed var(--border); border-radius: 8px;">
        Статьи появятся здесь после завершения финалов турниров Большого Шлема и Мастерсов.
      </div>
    ` : `
      <div class="press-columns-grid">
        ${majorColumnsList.map(t => `
          <article class="press-column-card">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--text-dim); gap: 6px;">
              <span><b>${t.name}</b> · ${t.type} (${t.surface})</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="match-score">${t.score && t.score !== '—' ? formatTennisScore(t.score.split(' ')) : '—'}</span>
                <button type="button" class="btn-purple btn-compact" style="padding: 2px 7px; font-size: 10.5px;" onclick="regeneratePressColumnForTourney('${t.id}', ${year})" title="Сгенерировать новую заметку через Groq">🧠 Groq</button>
              </div>
            </div>
            <div class="press-column-headline">«${t.pressColumn.headline}»</div>
            <div class="press-column-article">${t.pressColumn.article}</div>
          </article>
        `).join('')}
      </div>
    `}
  `;

  container.innerHTML = html;
}

export async function regeneratePressColumnForTourney(tourneyId, year) {
  const targetYear = String(year || document.getElementById('historyYearSelect')?.value || '2023');
  const histData = seasonsHistory[targetYear];
  if (!histData || !Array.isArray(histData.tournamentsData)) return;
  const entry = histData.tournamentsData.find(t => t.id === tourneyId);
  if (!entry || !entry.winner || !entry.runnerUp) return;

  const col = await generateFinalPressColumn({
    tourneyName: entry.name,
    tourneyType: entry.type,
    surface: entry.surface,
    year: Number(targetYear),
    winner: entry.winner,
    runnerUp: entry.runnerUp,
    score: entry.score
  });
  if (col) {
    entry.pressColumn = col;
    saveHistory();
    renderHistoryYear();
    showToast(`📰 Послематчевая колонка для <b>${entry.name} (${targetYear})</b> обновлена!`);
  }
}

export function renderLegendsTab() {
  const container = document.getElementById('legendsContent');
  if (!container) return;

  if (!retiredLegends || retiredLegends.length === 0) {
    container.innerHTML = `
      <div class="history-card" style="text-align: center; padding: 40px 20px;">
        <h3 style="font-size: 17px; color: var(--gold); margin-bottom: 8px;">Зал Славы: Завершившие карьеру (Легенды тура)</h3>
        <p style="color: var(--text-dim); font-size: 13.5px; max-width: 560px; margin: 0 auto;">
          Когда возрастные игроки (37–42 лет) завершают профессиональную карьеру по окончании сезона, их именные карточки с пиковым рейтингом и количеством сезонов бережно сохраняются здесь.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h3 style="font-size: 17px; color: var(--gold);">Завершившие карьеру (Легенды тура) · ${retiredLegends.length} игр.</h3>
        <small style="color: var(--text-dim);">Почетный архив ветеранов, повесивших ракетку на гвоздь по итогам прошлых сезонов.</small>
      </div>
    </div>
    <div class="legends-grid">
      ${retiredLegends.map(leg => `
        <div class="legend-card">
          <div class="legend-card-header">
            <span class="legend-name">${renderFlagBadge(leg.flag, { compact: true })} ${leg.name}</span>
            <span style="color: var(--gold); font-size: 12px; font-weight: 700;">Выпуск ${leg.retiredYear}</span>
          </div>
          <div class="legend-meta">
            Возраст ухода: <b style="color: var(--text-main);">${leg.retiredAge} лет</b> (${leg.birthDate || '—'})
          </div>
          <div class="legend-meta">
            Наивысший рейтинг в карьере: <b style="color: var(--primary);">#${leg.bestRank}</b>
          </div>
          <div class="legend-meta">
            Финальный рейтинг: <b>#${leg.finalRank}</b> · Сыграно сезонов: <b>${leg.seasonsPlayed}</b>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// --- 9.5. ИНТЕРАКТИВНАЯ КИБЕР-ГАЗЕТА «📰 ЛЕНТА ТУРА (TENNIS FEED)» ---
let activeTennisFeedFilter = 'all';
const likedFeedPostsSet = new Set();

function makeTourneyHashtag(tourneyName, year = currentTourYear) {
  const clean = String(tourneyName || 'MetaTennisTour')
    .replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');
  return `#${clean || 'ATP'}${year}`;
}

export function setTennisFeedFilter(filterKey) {
  activeTennisFeedFilter = filterKey || 'all';
  ['all', 'breaking', 'rivalry', 'titles'].forEach(k => {
    const btn = document.getElementById(`feed-filter-${k}`);
    if (btn) btn.classList.toggle('active', k === activeTennisFeedFilter);
  });
  renderTennisFeed();
}

export function toggleFeedPostLike(postId) {
  if (likedFeedPostsSet.has(postId)) {
    likedFeedPostsSet.delete(postId);
  } else {
    likedFeedPostsSet.add(postId);
  }
  renderTennisFeed();
}

export function renderTennisFeed() {
  const container = document.getElementById('tennisFeedContainer');
  if (!container) return;

  const posts = [];
  const storageGetter = (tId, yr) => {
    const d = readSavedDraw(tId, yr);
    return d.length > 0 ? d : null;
  };

  // 1. Собираем горячие события из активной сетки текущего турнира (апсеты, отказы RET, триллеры, трэш-ток)
  if (activeTourney && Array.isArray(currentDraw) && currentDraw.length > 0) {
    const tHashtag = makeTourneyHashtag(activeTourney.name, viewingYear);
    for (let rIdx = currentDraw.length - 1; rIdx >= 0; rIdx--) {
      const round = currentDraw[rIdx] || [];
      const stageName = getStageNameForRound(activeTourney, rIdx);
      for (let mIdx = 0; mIdx < round.length; mIdx++) {
        const m = round[mIdx];
        if (!m || !m.winner || !m.p1 || !m.p2) continue;
        const winner = m.winner;
        const loser = m.p1.id === winner.id ? m.p2 : m.p1;
        const wRank = Number(winner.rank) || 100;
        const lRank = Number(loser.rank) || 100;
        const scoreStr = m.score ? m.score.join(' ') : '6-4 6-4';
        const isRet = /\bRET\b/i.test(scoreStr);
        const isUpset = (wRank - lRank >= 18 && lRank <= 25) || (loser.seedNum && !winner.seedNum && lRank <= 16);
        const h2h = getHeadToHeadAnalytics(m.p1.id, m.p2.id, tournaments, viewingYear, storageGetter, m.p1.name, m.p2.name);
        const totalH2H = (h2h.p1Wins || 0) + (h2h.p2Wins || 0);
        const isRivalry = totalH2H >= 2;
        const isFinal = rIdx === currentDraw.length - 1 && mIdx === 0;

        if (!isUpset && !isRet && !isRivalry && !isFinal && rIdx < currentDraw.length - 2) {
          continue;
        }

        const postId = `feed_match_${viewingYear}_${activeTourney.id}_${rIdx}_${mIdx}`;
        let category = 'match';
        if (isUpset || isRet) category = 'breaking';
        else if (isFinal) category = 'titles';
        else if (isRivalry) category = 'rivalry';

        const authorPool = isUpset || isRet
          ? { avatar: '🚨', name: 'CourtSide Insider', handle: '@CourtSideBreaking', time: 'Только что' }
          : (isRivalry
            ? { avatar: '🔥', name: 'ATP Rivalry Watch', handle: '@TennisTrashTalk', time: '12 мин назад' }
            : { avatar: '🎙️', name: 'Fabrizio Tennis', handle: '@FabrizioCourt', time: '25 мин назад' });

        let headlineHtml = '';
        if (isRet) {
          headlineHtml = `🚑 <b>ЭКСТРЕННАЯ СВОДКА С КОРТА!</b> Матч на турнире <b>${activeTourney.name}</b> (${stageName}) завершен досрочно при счете <b>${scoreStr}</b>. ${loser.flag} <b>${loser.name}</b> (#${lRank}) вынужден сняться из-за критического истощения/травмы, пропуская дальше ${winner.flag} <b>${winner.name}</b> (#${wRank})!`;
        } else if (isUpset) {
          headlineHtml = `💣 <b>ГРОМКАЯ СЕНСАЦИЯ НА ${activeTourney.name.toUpperCase()}!</b> ${winner.flag} <b>${winner.name}</b> (ATP #${wRank}) выбивает из сетки фаворита ${loser.flag} <b>${loser.name}</b> (ATP #${lRank}${loser.seedNum ? `, посев #${loser.seedNum}` : ''}) на стадии «${stageName}» со счетом <b>${scoreStr}</b>!`;
        } else if (isFinal) {
          headlineHtml = `🏆 <b>ЧЕМПИОНСКИЙ ТРИУМФ!</b> ${winner.flag} <b>${winner.name}</b> (#${wRank}) обыгрывает в финале ${loser.flag} <b>${loser.name}</b> (#${lRank}) со счетом <b>${scoreStr}</b> и забирает главный трофей <b>${activeTourney.name}</b>!`;
        } else {
          headlineHtml = `⚡ Горячая развязка в матче «${stageName}» на <b>${activeTourney.name}</b>: ${winner.flag} <b>${winner.name}</b> (#${wRank}) побеждает ${loser.flag} <b>${loser.name}</b> (#${lRank}) — <b>${scoreStr}</b>. ${m.narrative || ''}`;
        }

        const quoteHtml = (m.winnerQuote || m.loserQuote)
          ? `
            <div class="feed-quote-callout">
              ${m.winnerQuote ? `<div>🎙️ <b>${winner.name}:</b> ${m.winnerQuote}</div>` : ''}
              ${m.loserQuote ? `<div style="margin-top:4px; color:var(--text-dim);">🎙️ <b>${loser.name}:</b> ${m.loserQuote}</div>` : ''}
            </div>
          `
          : '';

        const hashtags = [
          tHashtag,
          `#${winner.name.replace(/\s+/g, '')}`,
          isUpset ? '#Sensation' : (isRet ? '#MedicalTimeout' : (isRivalry ? '#RivalryTrashTalk' : '#MetaTennisTour'))
        ];

        posts.push({
          id: postId,
          category,
          isBreaking: isUpset || isRet,
          isRivalry,
          author: authorPool,
          bodyHtml: headlineHtml,
          quoteHtml,
          hashtags,
          baseLikes: 340 + ((rIdx + 1) * 190) + (isUpset ? 620 : 0),
          baseReposts: 78 + ((rIdx + 1) * 42) + (isUpset ? 185 : 0)
        });
      }
    }
  }

  // 2. Добавляем посты по итогам завершенных турниров сезона и архива
  const targetYears = [currentTourYear, 2023];
  targetYears.forEach(yr => {
    const tData = seasonsHistory[yr]?.tournamentsData || [];
    for (let i = tData.length - 1; i >= Math.max(0, tData.length - 6); i--) {
      const t = tData[i];
      if (!t || !t.winner) continue;
      const postId = `feed_champ_${yr}_${t.id}`;
      const col = t.pressColumn;
      const isMajor = ['ТБШ', 'Мастерс', 'Итоговый', 'Олимпиада'].includes(t.type);
      posts.push({
        id: postId,
        category: 'titles',
        isBreaking: t.type === 'ТБШ',
        isRivalry: false,
        author: {
          avatar: isMajor ? '🏆' : '📰',
          name: isMajor ? 'Grand Slam Gazette' : 'ATP Tour Media',
          handle: isMajor ? '@SlamGazette' : '@ATPTourMedia',
          time: `Сезон ${yr}`
        },
        bodyHtml: col?.headline
          ? `<b>«${col.headline}»</b><br>${col.article}`
          : `🏆 <b>${t.winner.flag} ${t.winner.name}</b> завоевывает титул <b>${t.name} (${yr})</b> на покрытии «${t.surface}», переиграв в финале ${t.runnerUp ? `${t.runnerUp.flag} ${t.runnerUp.name}` : 'соперника'} со счетом <b>${t.score || '6-4 6-4'}</b>!`,
        quoteHtml: '',
        hashtags: [makeTourneyHashtag(t.name, yr), `#${t.winner.name.replace(/\s+/g, '')}`, `#Champion${yr}`],
        baseLikes: isMajor ? 1480 : 690,
        baseReposts: isMajor ? 410 : 145
      });
    }
  });

  // 3. Инсайды аналитиков о лидере мирового рейтинга, выносливости и главных соперничествах тура
  const world1 = players[0];
  const world2 = players[1];
  if (world1 && world2) {
    const w1Skills = getPlayerSkills(world1, activeTourney?.surface || 'Хард', currentTourDateStr);
    const w2Skills = getPlayerSkills(world2, activeTourney?.surface || 'Хард', currentTourDateStr);
    posts.unshift({
      id: `feed_insider_no1_${currentTourYear}`,
      category: 'rivalry',
      isBreaking: false,
      isRivalry: true,
      author: {
        avatar: '📊',
        name: 'Tennis Data Lab',
        handle: '@MetaTennisAnalytics',
        time: formatDateDisplay(currentTourDateStr)
      },
      bodyHtml: `🔥 <b>Битва титанов за трон ATP!</b> Первая ракетка мира ${world1.flag} <b>${world1.name}</b> (OVR <b>${w1Skills.ovr}</b> · ${world1.points.toLocaleString()} pts) удерживает лидерство, но ${world2.flag} <b>${world2.name}</b> (OVR <b>${w2Skills.ovr}</b> · ${world2.points.toLocaleString()} pts) дышит в спину перед турниром <b>${activeTourney ? activeTourney.name : 'сезона'}</b>.`,
      quoteHtml: `<div class="feed-quote-callout">🎙️ <b>${world2.name}:</b> «Я знаю каждое его слабое место по нашим прошлым очным дуэлям. В этом сезоне первая строчка рейтинга сменит владельца!»</div>`,
      hashtags: ['#WorldNo1', `#${world1.name.replace(/\s+/g, '')}`, `#${world2.name.replace(/\s+/g, '')}`, '#Rivalry'],
      baseLikes: 2150,
      baseReposts: 540
    });
  }

  const filteredPosts = posts.filter(p => {
    if (activeTennisFeedFilter === 'all') return true;
    if (activeTennisFeedFilter === 'breaking') return p.isBreaking || p.category === 'breaking';
    if (activeTennisFeedFilter === 'rivalry') return p.isRivalry || p.category === 'rivalry';
    if (activeTennisFeedFilter === 'titles') return p.category === 'titles';
    return true;
  });

  if (filteredPosts.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 42px 20px; background: var(--card-bg); border: 1px dashed var(--border); border-radius: 10px; color: var(--text-dim);">
        В этой рубрике пока нет публикаций. Сыграйте несколько матчей в сетке турнира или переключите фильтр на «Все посты».
      </div>
    `;
    return;
  }

  container.innerHTML = filteredPosts.slice(0, 18).map(post => {
    const isLiked = likedFeedPostsSet.has(post.id);
    const likesCount = post.baseLikes + (isLiked ? 1 : 0);
    return `
      <article class="feed-post-card ${post.isBreaking ? 'feed-post-breaking' : ''} ${post.isRivalry ? 'feed-post-rivalry' : ''}">
        <div class="feed-author-row">
          <div class="feed-author-left">
            <div class="feed-avatar">${post.author.avatar}</div>
            <div>
              <div class="feed-author-name">
                <span>${post.author.name}</span>
                <span class="feed-verified-check" title="Верифицированный инсайдер тура">✔</span>
              </div>
              <div class="feed-author-handle">${post.author.handle} · ${post.author.time}</div>
            </div>
          </div>
          <div>
            ${post.isBreaking ? `<span class="breaking-news-badge">🔴 BREAKING NEWS</span>` : ''}
            ${!post.isBreaking && post.isRivalry ? `<span class="rivalry-fire-badge">🔥 RIVALRY</span>` : ''}
          </div>
        </div>

        <div class="feed-content-body">${post.bodyHtml}</div>
        ${post.quoteHtml || ''}

        <div class="feed-hashtags-row">
          ${(post.hashtags || []).map(tag => `<span class="feed-hashtag">${tag}</span>`).join('')}
        </div>

        <div class="feed-actions-bar">
          <button type="button" class="feed-action-btn ${isLiked ? 'liked' : ''}" onclick="toggleFeedPostLike('${post.id}')">
            <span>${isLiked ? '❤️' : '🤍'}</span>
            <span>${likesCount.toLocaleString()}</span>
          </button>
          <span style="display: inline-flex; align-items: center; gap: 4px;">🔁 ${post.baseReposts} репостов</span>
          <span style="display: inline-flex; align-items: center; gap: 4px;">💬 Обсуждение в туре</span>
        </div>
      </article>
    `;
  }).join('');
}

// --- 10. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК И МОДАЛОК ---
export function switchTab(tabId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const targetPanel = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`nav-${tabId}`);
  if (targetPanel) targetPanel.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  if (tabId === 'tourney') {
    // При открытии вкладки «Сетка Турнира» в текущем сезоне, если стоял завершенный турнир,
    // автоматически переключаемся на первый незавершенный по календарю (#2 Cartom Calamb и т.д.)
    if (viewingYear === currentTourYear) {
      const viewingTourneys = getSeasonTournaments(viewingYear, tournaments);
      const curr = viewingTourneys.find(t => t.id === activeTourneyId);
      if (!curr || curr.completed) {
        const firstOpenIdx = getFirstUncompletedTourneyIndex(viewingTourneys);
        if (firstOpenIdx >= 0 && firstOpenIdx < viewingTourneys.length) {
          activeTourneyId = viewingTourneys[firstOpenIdx].id;
          activeTourney = viewingTourneys[firstOpenIdx];
          const select = document.getElementById('tourneySelect');
          if (select) select.value = activeTourneyId;
          loadSelectedTournament();
        }
      }
    }
  } else if (tabId === 'players') {
    renderPlayersTable();
  } else if (tabId === 'race') {
    renderRaceTable();
  } else if (tabId === 'calendar') {
    renderCalendarTable();
  } else if (tabId === 'history') {
    initHistoryUI();
  } else if (tabId === 'feed') {
    renderTennisFeed();
  }
}

export function closeModal(id) {
  if (!id) {
    document.querySelectorAll('.modal.open').forEach(el => el.classList.remove('open'));
    activeMatchScore = null;
    pendingAiNarrative = '';
    pendingWinnerQuote = '';
    pendingLoserQuote = '';
    return;
  }
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  if (id === 'scoreModal') {
    activeMatchScore = null;
    pendingAiNarrative = '';
    pendingWinnerQuote = '';
    pendingLoserQuote = '';
  }
}

// --- РАЗДЕЛ 7: ТЕСТОВАЯ СИМУЛЯЦИЯ СЕЗОНА (С ОТКАТОМ / УТВЕРЖДЕНИЕМ) И ИЗОЛИРОВАННЫЕ ЧЕКПОИНТЫ (DEEP CLONE) ---
const memoryCheckpointsByUniverse = {};
let memoryTestSimReport = null;

export function getAllCurrentDrawsMap(year = currentTourYear) {
  const drawsMap = {};
  const seasonTourneys = getSeasonTournaments(year, FULL_CALENDAR_TEMPLATE);
  if (!seasonTourneys.some(t => t.id === 'olympics')) {
    seasonTourneys.push(OLYMPIC_TOURNAMENT_TEMPLATE);
  }
  seasonTourneys.forEach(t => {
    const drawArr = readSavedDraw(t.id, year);
    if (Array.isArray(drawArr) && drawArr.length > 0) {
      drawsMap[`draw_${t.id}_${year}`] = JSON.parse(JSON.stringify(drawArr));
    }
  });
  return drawsMap;
}

export function getCurrentState(options = {}) {
  const drawsSnapshot = {};
  const withdrawalsSnapshot = {};
  const bg250Snapshot = {};
  const maxYr = Math.max(2024, currentTourYear);
  const startYr = options.includeArchive2023 ? 2023 : 2024;
  const allTourneys = getSeasonTournaments(currentTourYear, FULL_CALENDAR_TEMPLATE);
  if (!allTourneys.some(t => t.id === 'olympics')) {
    allTourneys.push(OLYMPIC_TOURNAMENT_TEMPLATE);
  }

  for (let yr = startYr; yr <= maxYr; yr++) {
    allTourneys.forEach(t => {
      if (!options.skipDraws) {
        const d = universeStorage.getItem(`draw_${t.id}_${yr}`);
        if (d !== null) drawsSnapshot[`draw_${t.id}_${yr}`] = d;
      }
      const w = universeStorage.getItem(`withdrawals_${t.id}_${yr}`);
      if (w !== null) withdrawalsSnapshot[`withdrawals_${t.id}_${yr}`] = w;
      const b = universeStorage.getItem(`bg250_${t.id}_${yr}`);
      if (b !== null) bg250Snapshot[`bg250_${t.id}_${yr}`] = b;
    });
  }

  return {
    currentTourYear,
    currentTourDateStr: String(currentTourDateStr),
    activeTourneyId: String(activeTourneyId),
    viewingYear,
    tournaments: JSON.parse(JSON.stringify(tournaments || [])),
    players: JSON.parse(JSON.stringify(players || [])),
    seasonsHistory: JSON.parse(JSON.stringify(seasonsHistory || {})),
    retiredLegends: JSON.parse(JSON.stringify(retiredLegends || [])),
    drawsSnapshot,
    withdrawalsSnapshot,
    bg250Snapshot
  };
}

export function applyStateSnapshot(stateObj) {
  if (!stateObj) return false;
  currentTourYear = Number(stateObj.currentTourYear || stateObj.year) || 2024;
  currentTourDateStr = String(stateObj.currentTourDateStr || stateObj.dateStr || `${currentTourYear}-01-02`);
  activeTourneyId = String(stateObj.activeTourneyId || 'm_1');
  viewingYear = currentTourYear;
  tournaments = JSON.parse(JSON.stringify(stateObj.tournaments || []));
  players = JSON.parse(JSON.stringify(stateObj.players || []));
  if (stateObj.seasonsHistory) {
    seasonsHistory = JSON.parse(JSON.stringify(stateObj.seasonsHistory));
  }
  if (stateObj.retiredLegends) {
    retiredLegends = JSON.parse(JSON.stringify(stateObj.retiredLegends));
  }

  const maxYr = Math.max(2024, currentTourYear + 1);
  const allTourneys = getSeasonTournaments(currentTourYear, FULL_CALENDAR_TEMPLATE);
  if (!allTourneys.some(t => t.id === 'olympics')) {
    allTourneys.push(OLYMPIC_TOURNAMENT_TEMPLATE);
  }
  const hasExplicitDrawsMap =
    (stateObj.draws && typeof stateObj.draws === 'object' && Object.keys(stateObj.draws).length > 0) ||
    (stateObj.drawsSnapshot && typeof stateObj.drawsSnapshot === 'object' && Object.keys(stateObj.drawsSnapshot).length > 0);
  const completedSetAtSnapshot = new Set(
    Array.isArray(stateObj.completedTourneyIds)
      ? stateObj.completedTourneyIds
      : (stateObj.tournaments || []).filter(t => t && t.completed).map(t => t.id)
  );

  // Очищаем сетки ТОЛЬКО будущих турниров текущего сезона и будущих сезонов.
  // Завершенные сетки прошлых сезонов (2023, 2024) и завершенные турниры текущего сезона НИКОГДА не удаляются!
  for (let yr = currentTourYear; yr <= maxYr; yr++) {
    allTourneys.forEach(t => {
      const isFutureInCurrentYear = (yr === currentTourYear && !completedSetAtSnapshot.has(t.id));
      const isFutureYear = (yr > currentTourYear);
      if (isFutureInCurrentYear || isFutureYear) {
        universeStorage.removeItem(`draw_${t.id}_${yr}`);
        universeStorage.removeItem(`withdrawals_${t.id}_${yr}`);
        universeStorage.removeItem(`bg250_${t.id}_${yr}`);
      }
    });
  }

  // Восстанавливаем сетки из stateObj.draws (формат объекта/массива) или stateObj.drawsSnapshot (формат строки)
  if (stateObj.draws && typeof stateObj.draws === 'object') {
    Object.entries(stateObj.draws).forEach(([k, v]) => {
      const strVal = typeof v === 'string' ? v : JSON.stringify(v);
      universeStorage.setItem(k, strVal);
    });
  } else if (stateObj.drawsSnapshot && typeof stateObj.drawsSnapshot === 'object') {
    Object.entries(stateObj.drawsSnapshot).forEach(([k, v]) => {
      const strVal = typeof v === 'string' ? v : JSON.stringify(v);
      universeStorage.setItem(k, strVal);
    });
  }

  if (stateObj.withdrawalsSnapshot && typeof stateObj.withdrawalsSnapshot === 'object') {
    Object.entries(stateObj.withdrawalsSnapshot).forEach(([k, v]) => {
      universeStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    });
  }
  if (stateObj.bg250Snapshot && typeof stateObj.bg250Snapshot === 'object') {
    Object.entries(stateObj.bg250Snapshot).forEach(([k, v]) => {
      universeStorage.setItem(k, String(v));
    });
  }

  savePlayers(false);
  saveTournaments();
  saveHistory();
  saveRetiredLegends();
  saveDate();
  return true;
}

const CHECKPOINTS_STORAGE_KEY = 'meta_checkpoints';

function getSavedCheckpointsList() {
  let list = memoryCheckpointsByUniverse[activeUniverseId];
  if (!Array.isArray(list) || list.length === 0) {
    try {
      const raw = universeStorage.getItem(CHECKPOINTS_STORAGE_KEY);
      list = raw ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) list = [];
  if (String(activeUniverseId) === '1' && CANON_MASTER_SNAPSHOT && Array.isArray(CANON_MASTER_SNAPSHOT.checkpoints)) {
    const map = new Map();
    CANON_MASTER_SNAPSHOT.checkpoints.forEach(cp => { if (cp?.id) map.set(cp.id, cp); });
    list.forEach(cp => {
      if (cp?.id) {
        if (!map.has(cp.id) || cp.id.startsWith('cp_manual_') || cp.isManual || cp.name?.includes('Ручной')) {
          map.set(cp.id, cp);
        }
      }
    });
    list = Array.from(map.values()).sort((a, b) => String(b.dateStr || '').localeCompare(String(a.dateStr || '')));
  }
  memoryCheckpointsByUniverse[activeUniverseId] = list;
  return list;
}

function buildCleanSeasonStartCheckpoint(year = 2024) {
  const startDateStr = `${year}-01-02`;
  const cleanTourneys = getSeasonTournaments(year, FULL_CALENDAR_TEMPLATE).map(t => ({
    ...t,
    completed: false,
    lastWinner: null,
    lastRunnerUp: null,
    lastBronze: null,
    lastScore: null
  }));

  const currentUnivMeta = universesList.find(u => u.id === activeUniverseId);
  const isCustomRandom = Boolean(currentUnivMeta?.rosterMode === 'random');

  const cleanPlayers = JSON.parse(JSON.stringify(players || []));
  if (year === 2024 && !isCustomRandom) {
    applyCanonical2023StartStateToPlayers(cleanPlayers);
  } else {
    cleanPlayers.forEach(p => {
      p.racePoints = 0;
      p.rankChange = 0;
      if (p.tournamentPoints) {
        Object.keys(p.tournamentPoints).forEach(tid => {
          if (p.tournamentPoints[tid] && p.tournamentPoints[tid][year] !== undefined) {
            delete p.tournamentPoints[tid][year];
          }
        });
      }
    });
    sortAndRankPlayers(cleanPlayers, false);
  }

  const cleanHist = JSON.parse(JSON.stringify(seasonsHistory || {}));
  delete cleanHist[year];

  const label = `Старт сезона ${year} (02 Января ${year})`;
  return {
    id: `cp_start_${year}`,
    name: label,
    label,
    dateStr: startDateStr,
    year,
    activeTourneyId: 'm_1',
    worldNo1: cleanPlayers[0] ? `${cleanPlayers[0].flag} ${cleanPlayers[0].name} (${(cleanPlayers[0].points || 0).toLocaleString()} pts)` : '—',
    createdAt: '02.01',
    lockedStartCheckpoint: true,
    players: JSON.parse(JSON.stringify(cleanPlayers)),
    tournaments: JSON.parse(JSON.stringify(cleanTourneys)),
    seasonsHistory: cleanHist,
    retiredLegends: JSON.parse(JSON.stringify(retiredLegends || [])),
    draws: {}
  };
}

export function saveSeasonCheckpoint(cpId, customName, options = {}) {
  try {
    const list = [...getSavedCheckpointsList()];
    const targetId = cpId || `cp_${Date.now()}`;

    // Фиксированный стартовый чекпоинт блокируется от перезаписи!
    const existingIdx = list.findIndex(x => x.id === targetId);
    if (existingIdx >= 0 && list[existingIdx].lockedStartCheckpoint && list[existingIdx].dateStr === `${list[existingIdx].year}-01-02`) {
      return list[existingIdx];
    }

    const fixedDateStr = String(options.dateStr || currentTourDateStr);
    const fixedYear = Number(options.year || currentTourYear);
    const fixedActiveTourneyId = String(options.activeTourneyId || activeTourney?.id || activeTourneyId || 'm_1');
    const clonedPlayers = JSON.parse(JSON.stringify(options.players || players || []));
    const clonedTournaments = JSON.parse(JSON.stringify(options.tournaments || tournaments || []));
    const clonedSeasonsHistory = JSON.parse(JSON.stringify(options.seasonsHistory || seasonsHistory || {}));
    const clonedRetiredLegends = JSON.parse(JSON.stringify(options.retiredLegends || retiredLegends || []));
    const completedTourneyIds = clonedTournaments.filter(t => t && t.completed).map(t => t.id);

    const labelText = customName || `Чекпоинт · ${formatDateDisplay(fixedDateStr)}`;

    // Компактный слепок игроков: исключаем дублирование статических полей
    const leanPlayers = clonedPlayers.map(p => ({
      id: p.id,
      name: p.name,
      flag: p.flag,
      rank: p.rank,
      points: p.points,
      racePoints: p.racePoints || 0,
      finalsPoints: p.finalsPoints || 0,
      remainingDefending: p.remainingDefending || 0,
      defendedSoFar: p.defendedSoFar || 0,
      birthDate: p.birthDate,
      tournamentPoints: p.tournamentPoints || {},
      bestRank: p.bestRank,
      seasonStartRank: p.seasonStartRank,
      stamina: p.stamina,
      medals: p.medals,
      nickname: p.nickname,
      playStyle: p.playStyle,
      isNewgen: p.isNewgen,
      isCleanReplacement: p.isCleanReplacement
    }));

    // В чекпоинте храним историю только активного года (прошлые сезоны уже в сохраненной глобальной базе)
    const leanHistory = clonedSeasonsHistory[fixedYear]
      ? { [fixedYear]: clonedSeasonsHistory[fixedYear] }
      : clonedSeasonsHistory;

    const checkpointData = {
      id: targetId,
      name: labelText,
      label: labelText,
      dateStr: fixedDateStr,
      year: fixedYear,
      activeTourneyId: fixedActiveTourneyId,
      worldNo1: clonedPlayers[0] ? `${clonedPlayers[0].flag} ${clonedPlayers[0].name} (${(clonedPlayers[0].points || 0).toLocaleString()} pts)` : '—',
      createdAt: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      lockedStartCheckpoint: Boolean(options.lockedStartCheckpoint),
      completedTourneyIds,
      players: leanPlayers,
      tournaments: clonedTournaments,
      seasonsHistory: leanHistory,
      retiredLegends: clonedRetiredLegends
    };

    if (existingIdx >= 0) {
      list[existingIdx] = checkpointData;
    } else {
      list.unshift(checkpointData);
    }

    // Гарантируем, что стартовый чекпоинт сезона никогда не вытесняется из списка
    const startId = `cp_start_${fixedYear}`;
    const startItem = list.find(x => x.id === startId);
    let trimmed = list.filter(x => x.id !== startId).slice(0, 7);
    if (startItem) trimmed.push(startItem);

    memoryCheckpointsByUniverse[activeUniverseId] = trimmed;
    universeStorage.setItem(CHECKPOINTS_STORAGE_KEY, JSON.stringify(trimmed));
    return checkpointData;
  } catch {
    return null;
  }
}

function buildRetroactiveMajorCheckpoint(majorTourney, majorIdx, seasonTourneys, year = 2024) {
  const cpTourneys = seasonTourneys.map((t, idx) => {
    if (idx <= majorIdx) {
      return JSON.parse(JSON.stringify(t));
    }
    return {
      ...JSON.parse(JSON.stringify(t)),
      completed: false,
      lastWinner: null,
      lastRunnerUp: null,
      lastBronze: null,
      lastScore: null
    };
  });

  let cpDateStr = `${year}-11-25`;
  let cpActiveTourneyId = majorTourney.id;
  if (majorIdx < seasonTourneys.length - 1) {
    const nextT = seasonTourneys[majorIdx + 1];
    const nextStartMonth = String(nextT.startMonth + 1).padStart(2, '0');
    const nextStartDay = String(nextT.startDay).padStart(2, '0');
    cpDateStr = `${year}-${nextStartMonth}-${nextStartDay}`;
    cpActiveTourneyId = nextT.id;
  }

  const completedUpToMajor = new Set(seasonTourneys.slice(0, majorIdx + 1).map(t => t.id));
  const cpPlayers = JSON.parse(JSON.stringify(players || []));
  cpPlayers.forEach(p => {
    if (p.tournamentPoints) {
      Object.keys(p.tournamentPoints).forEach(tid => {
        if (!completedUpToMajor.has(tid) && p.tournamentPoints[tid]?.[year] !== undefined) {
          delete p.tournamentPoints[tid][year];
        }
      });
    }
    let raceEarned = 0;
    let finalsEarned = 0;
    let defendedSoFar = 0;
    let remainingDefending = 0;
    seasonTourneys.forEach((t, idx) => {
      const def = getDefendingPoints(p, t.id, year);
      if (idx <= majorIdx) {
        defendedSoFar += def;
        const earned = Math.max(0, p.tournamentPoints?.[t.id]?.[year] || 0);
        if (t.id === 'finals' || t.type === 'Итоговый') {
          finalsEarned += earned;
        } else {
          raceEarned += earned;
        }
      } else {
        remainingDefending += def;
      }
    });
    p.racePoints = raceEarned;
    p.finalsPoints = finalsEarned;
    p.defendedSoFar = defendedSoFar;
    p.remainingDefending = remainingDefending;
    p.points = Math.max(0, remainingDefending + raceEarned + finalsEarned);
  });
  sortAndRankPlayers(cpPlayers, false);

  const cpHist = JSON.parse(JSON.stringify(seasonsHistory || {}));
  if (cpHist[year]) {
    if (Array.isArray(cpHist[year].tournamentsData)) {
      cpHist[year].tournamentsData = cpHist[year].tournamentsData.filter(td => completedUpToMajor.has(td.id));
    }
    if (cpHist[year].slamSnapshots && typeof cpHist[year].slamSnapshots === 'object') {
      Object.keys(cpHist[year].slamSnapshots).forEach(sid => {
        if (!completedUpToMajor.has(sid)) delete cpHist[year].slamSnapshots[sid];
      });
    }
    if (cpPlayers[0]) {
      cpHist[year].worldNumberOne = { ...cpPlayers[0] };
    }
  }

  const champName = majorTourney.lastWinner?.name || 'Чемпион';
  const label = `После ${majorTourney.name} (${year}) · Чемпион: ${champName}`;
  return {
    id: `cp_${majorTourney.id}_${year}`,
    name: label,
    label,
    dateStr: cpDateStr,
    year,
    activeTourneyId: cpActiveTourneyId,
    worldNo1: cpPlayers[0] ? `${cpPlayers[0].flag} ${cpPlayers[0].name} (${(cpPlayers[0].points || 0).toLocaleString()} pts)` : '—',
    createdAt: formatDateDisplay(cpDateStr).slice(0, 6),
    lockedStartCheckpoint: false,
    completedTourneyIds: Array.from(completedSetForList(cpTourneys)),
    players: cpPlayers,
    tournaments: cpTourneys,
    seasonsHistory: cpHist,
    retiredLegends: JSON.parse(JSON.stringify(retiredLegends || []))
  };
}

function completedSetForList(tourneysArr) {
  return new Set((tourneysArr || []).filter(t => t && t.completed).map(t => t.id));
}

function ensureInitialSeasonCheckpoint() {
  let list = [...getSavedCheckpointsList()].map(cp => {
    if (cp && cp.draws) {
      const copy = { ...cp };
      if (!Array.isArray(copy.completedTourneyIds) && Array.isArray(copy.tournaments)) {
        copy.completedTourneyIds = copy.tournaments.filter(t => t && t.completed).map(t => t.id);
      }
      delete copy.draws;
      return copy;
    }
    return cp;
  });

  const startId = `cp_start_${currentTourYear}`;
  const expectedStartDate = `${currentTourYear}-01-02`;
  const existingIdx = list.findIndex(c => c.id === startId);
  let changed = false;

  // 1) Если стартового чекпоинта еще нет ИЛИ он был поврежден — создаем эталонный слепок 02.01
  if (
    existingIdx === -1 ||
    list[existingIdx].dateStr !== expectedStartDate ||
    !Array.isArray(list[existingIdx].players) ||
    !Array.isArray(list[existingIdx].tournaments)
  ) {
    const cleanStartCp = buildCleanSeasonStartCheckpoint(currentTourYear);
    delete cleanStartCp.draws;
    cleanStartCp.completedTourneyIds = [];
    if (existingIdx >= 0) {
      list[existingIdx] = cleanStartCp;
    } else {
      list.push(cleanStartCp);
    }
    changed = true;
  }

  // 2) Автоматически восстанавливаем недостающие чекпоинты после каждого уже проведённого ТБШ и Итогового турнира текущего сезона
  const seasonTourneys = getSeasonTournaments(currentTourYear, tournaments);
  seasonTourneys.forEach((t, idx) => {
    if (!t || !t.completed) return;
    if (t.type !== 'ТБШ' && t.id !== 'finals') return;
    const cpId = `cp_${t.id}_${currentTourYear}`;
    const foundMajorIdx = list.findIndex(c => c.id === cpId);
    if (foundMajorIdx === -1) {
      const rebuiltCp = buildRetroactiveMajorCheckpoint(t, idx, seasonTourneys, currentTourYear);
      list.unshift(rebuiltCp);
      changed = true;
    }
  });

  if (changed || String(activeUniverseId) === '1') {
    // Сохраняем все ручные чекпоинты пользователя и мастер-точки канона (они никогда не вытесняются!)
    const cpMap = new Map();
    if (String(activeUniverseId) === '1' && CANON_MASTER_SNAPSHOT && Array.isArray(CANON_MASTER_SNAPSHOT.checkpoints)) {
      CANON_MASTER_SNAPSHOT.checkpoints.forEach(cp => { if (cp?.id) cpMap.set(cp.id, cp); });
    }
    const manualItems = list.filter(x => x && (x.isManual || String(x.id).startsWith('cp_manual_')));
    const startItem = list.find(x => x.id === startId);
    const others = list
      .filter(x => x.id !== startId && !x.isManual && !String(x.id).startsWith('cp_manual_'))
      .sort((a, b) => String(b.dateStr || '').localeCompare(String(a.dateStr || '')));

    manualItems.forEach(cp => { if (cp?.id) cpMap.set(cp.id, cp); });
    others.slice(0, 10).forEach(cp => { if (cp?.id) cpMap.set(cp.id, cp); });
    if (startItem) cpMap.set(startItem.id, startItem);

    list = Array.from(cpMap.values()).sort((a, b) => String(b.dateStr || '').localeCompare(String(a.dateStr || '')));
    memoryCheckpointsByUniverse[activeUniverseId] = list;
    universeStorage.setItem(CHECKPOINTS_STORAGE_KEY, JSON.stringify(list));
  }
}

export function createManualCheckpoint() {
  if (guardCanonReadOnly()) return;
  const cp = saveSeasonCheckpoint(
    `cp_manual_${Date.now()}`,
    `Ручной чекпоинт · ${formatDateDisplay(currentTourDateStr)} (${activeTourney ? activeTourney.name : 'Тур'})`,
    {
      dateStr: currentTourDateStr,
      activeTourneyId: activeTourney ? activeTourney.id : activeTourneyId
    }
  );
  renderCheckpointsModalList();
  if (cp) {
    showToast(`💾 <b>Чекпоинт сохранен:</b> ${cp.label}`);
  }
}

function renderCheckpointsModalList() {
  const container = document.getElementById('checkpointsListContainer');
  if (!container) return;
  const readOnly = isCanonReadOnly();
  const list = getSavedCheckpointsList();
  if (list.length === 0) {
    container.innerHTML = `<div style="padding: 18px; text-align: center; color: var(--text-dim); border: 1px dashed var(--border); border-radius: 8px;">Пока нет сохраненных чекпоинтов. Нажмите «Создать ручной чекпоинт» или завершите турнир Большого Шлема.</div>`;
    return;
  }
  container.innerHTML = list.map(cp => `
    <div class="checkpoint-item">
      <div>
        <div style="font-size: 13.5px; font-weight: 700; color: var(--text-main);">🕒 ${cp.name || cp.label}</div>
        <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">
          Дата тура: <b style="color: var(--accent);">${formatDateDisplay(cp.dateStr)}</b> · Лидер #1: <b style="color: var(--primary);">${cp.worldNo1 || '—'}</b>
        </div>
      </div>
      ${readOnly
        ? `<span style="font-size: 11.5px; color: var(--text-dim);">🔒 Только просмотр</span>`
        : `<button type="button" class="btn-gold btn-compact" onclick="restoreSeasonCheckpoint('${cp.id}')">⏪ Откатиться к точке</button>`
      }
    </div>
  `).join('');
}

export function openCheckpointsModal() {
  ensureInitialSeasonCheckpoint();
  updateCanonReadOnlyUI();
  renderCheckpointsModalList();
  const modal = document.getElementById('checkpointsModal');
  if (modal) modal.classList.add('open');
}

export function restoreSeasonCheckpoint(cpId) {
  if (guardCanonReadOnly()) return;
  ensureInitialSeasonCheckpoint();
  const list = getSavedCheckpointsList();
  const found = list.find(x => x.id === cpId);
  if (!found) {
    showToast('⚠️ Чекпоинт не найден.');
    return;
  }

  // Поддержка как новой структуры (found.players / found.tournaments / found.draws), так и found.state
  const snapshotToApply = found.players && found.tournaments ? found : found.state;
  if (!snapshotToApply) {
    showToast('⚠️ Данные чекпоинта повреждены.');
    return;
  }

  applyStateSnapshot({
    ...snapshotToApply,
    currentTourYear: found.year || snapshotToApply.currentTourYear || 2024,
    currentTourDateStr: found.dateStr || snapshotToApply.currentTourDateStr || '2024-01-02',
    activeTourneyId: found.activeTourneyId || snapshotToApply.activeTourneyId || 'm_1'
  });

  // Гарантируем 100% детерминированную синхронизацию очков сразу после отката к любому чекпоинту
  // (чтобы перезагрузка страницы F5 и кнопка «Синхронизировать очки» никогда не меняли места игроков)
  const currentUnivMeta = universesList.find(u => u.id === activeUniverseId);
  const isCustomRandomUniverse = Boolean(currentUnivMeta?.rosterMode === 'random');
  if (!isCustomRandomUniverse) {
    repairCanonicalPlayersAndDraws();
    backfill2023HistoryFromDraws(false);
    repairOvercountedPoints();
    found.players = JSON.parse(JSON.stringify(players));
    if (players[0]) {
      found.worldNo1 = `${players[0].flag} ${players[0].name} (${(players[0].points || 0).toLocaleString()} pts)`;
    }
    memoryCheckpointsByUniverse[activeUniverseId] = list;
    universeStorage.setItem(CHECKPOINTS_STORAGE_KEY, JSON.stringify(list));
  }

  // Если откатились к старту сезона, сохраняем ручные чекпоинты пользователя и мастер-точки канона
  if (found.id === `cp_start_${currentTourYear}`) {
    const filteredCps = list.filter(c => c && (c.id === found.id || c.isManual || String(c.id).startsWith('cp_manual_') || String(c.id).startsWith('cp_finals_') || String(c.id).startsWith('cp_tbsh_')));
    memoryCheckpointsByUniverse[activeUniverseId] = filteredCps;
    universeStorage.setItem(CHECKPOINTS_STORAGE_KEY, JSON.stringify(filteredCps));
  }

  closeModal('checkpointsModal');
  initUI({ preserveSelectedTourney: true });
  renderPlayersTable();
  renderRaceTable();
  renderCalendarTable();
  showToast(`⏪ <b>Состояние тура восстановлено!</b> Точка отката: ${found.name || found.label} (${formatDateDisplay(currentTourDateStr)}).`);
}

// --- ПРОБНАЯ СИМУЛЯЦИЯ СЕЗОНА (ТЕСТ) С ВОЗМОЖНОСТЬЮ ОТКАТА В 1 КЛИК ---
export function runTestSeasonSimulation() {
  if (guardCanonReadOnly()) return;
  // 1) Делаем полный слепок состояния перед симуляцией
  const preSimJson = JSON.stringify(getCurrentState());
  if (typeof window !== 'undefined') {
    window._preSimSnapshot = preSimJson;
  }
  universeStorage.setItem('meta_pre_sim_snapshot_v1', preSimJson);

  viewingYear = currentTourYear;
  const seasonTourneys = getSeasonTournaments(currentTourYear, tournaments);

  // 2) Последовательно симулируем все незавершенные турниры сезона
  seasonTourneys.forEach(t => {
    if (t.completed) return;
    activeTourney = t;
    activeTourneyId = t.id;
    generateRealisticDraw();
    autoSimulateEntireTournament();
    finishTournamentAndAwardPoints({ skipGroq: true });
  });

  // 3) Оцениваем кандидатов на завершение карьеры по итогам тестового сезона (для отчета)
  const potentialRetirees = players
    .filter(p => {
      const age = calculateAgeNum(p.birthDate, `${currentTourYear}-12-01`);
      return age >= 35 || (age >= 32 && p.rank > 100);
    })
    .slice(0, 8)
    .map(p => ({
      name: p.name,
      flag: p.flag,
      age: calculateAgeNum(p.birthDate, `${currentTourYear}-12-01`),
      rank: p.rank,
      bestRank: p.bestRank || p.rank
    }));

  const finalsData = (seasonsHistory[currentTourYear]?.tournamentsData || []).find(t => t.id === 'finals');
  const slamsData = (seasonsHistory[currentTourYear]?.tournamentsData || []).filter(t => t.type === 'ТБШ' || t.id === 'olympics');

  const reportPayload = {
    year: currentTourYear,
    playerOfTheYear: players[0] ? { name: players[0].name, flag: players[0].flag, points: players[0].points, racePoints: players[0].racePoints } : null,
    finalsChampion: finalsData?.winner ? { name: finalsData.winner.name, flag: finalsData.winner.flag, runnerUp: finalsData.runnerUp?.name || '—', score: finalsData.score || '' } : null,
    slamsChampions: slamsData.map(s => ({ name: s.name, winner: s.winner?.name || '—', flag: s.winner?.flag || '', score: s.score || '' })),
    top10: players.slice(0, 10).map(p => ({ rank: p.rank, name: p.name, flag: p.flag, points: p.points, racePoints: p.racePoints })),
    retirees: potentialRetirees
  };

  memoryTestSimReport = reportPayload;
  universeStorage.setItem('meta_test_sim_report_v1', JSON.stringify(reportPayload));
  updateTestSimBannerUI();
  initUI();
  renderPlayersTable();
  renderRaceTable();
  renderCalendarTable();
  openTestSeasonReportModal();
}

export function openTestSeasonReportModal() {
  let report = memoryTestSimReport;
  if (!report) {
    try {
      report = JSON.parse(universeStorage.getItem('meta_test_sim_report_v1'));
    } catch {
      report = null;
    }
  }
  const bodyEl = document.getElementById('testSeasonReportBody');
  if (!bodyEl) return;

  if (!report) {
    bodyEl.innerHTML = `<div style="padding: 16px; color: var(--text-dim);">Отчет тестового сезона пока не сформирован.</div>`;
  } else {
    const poy = report.playerOfTheYear;
    const fc = report.finalsChampion;
    bodyEl.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <div style="background: #111822; border: 1px solid var(--gold); border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; color: var(--gold); text-transform: uppercase; font-weight: 700;">👑 Игрок года (World #1 · ${report.year})</div>
          <div style="font-size: 17px; font-weight: 800; color: var(--text-main); margin-top: 4px;">${poy ? `${poy.flag} ${poy.name}` : '—'}</div>
          <div style="font-size: 12.5px; color: var(--primary); margin-top: 2px;">Рейтинг 52 нед.: <b>${(poy?.points || 0).toLocaleString()} pts</b> · Гонка: <b>${(poy?.racePoints || 0).toLocaleString()} pts</b></div>
        </div>
        <div style="background: #111822; border: 1px solid var(--accent); border-radius: 8px; padding: 12px;">
          <div style="font-size: 11px; color: var(--accent); text-transform: uppercase; font-weight: 700;">🏆 Чемпион Итогового (World Tour Finals)</div>
          <div style="font-size: 17px; font-weight: 800; color: var(--text-main); margin-top: 4px;">${fc ? `${fc.flag} ${fc.name}` : '—'}</div>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">Финал против ${fc?.runnerUp || '—'}: <span class="match-score">${fc?.score ? formatTennisScore(fc.score.split(' ')) : '—'}</span></div>
        </div>
      </div>

      <div style="margin-bottom: 12px; background: #111822; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;">
        <div style="font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 6px;">🎾 Чемпионы Турниров Большого Шлема и Олимпиады (${report.year}):</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${(report.slamsChampions || []).map(s => `
            <span style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 6px; padding: 4px 8px; font-size: 12px;">
              <b>${s.name}:</b> ${s.flag} ${s.winner} (<span class="match-score">${s.score ? formatTennisScore(s.score.split(' ')) : ''}</span>)
            </span>
          `).join('')}
        </div>
      </div>

      <div class="report-columns">
        <div>
          <h4 style="font-size: 13px; color: var(--primary); margin-bottom: 6px;">📊 Итоговый Топ-10 сезона ${report.year}</h4>
          <table class="custom-table" style="font-size: 12px;">
            <thead>
              <tr>
                <th>#</th>
                <th>Игрок</th>
                <th>52 нед.</th>
                <th>Гонка</th>
              </tr>
            </thead>
            <tbody>
              ${(report.top10 || []).map(p => `
                <tr>
                  <td><b>#${p.rank}</b></td>
                  <td>${p.flag} <b>${p.name}</b></td>
                  <td><b>${(p.points || 0).toLocaleString()}</b></td>
                  <td style="color: var(--accent);">${(p.racePoints || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div>
          <h4 style="font-size: 13px; color: var(--gold); margin-bottom: 6px;">🎖️ Кандидаты на завершение карьеры (Ветераны)</h4>
          ${(report.retirees || []).length === 0
            ? `<div style="font-size: 12px; color: var(--text-dim);">Нет возрастных кандидатов на уход в этом году.</div>`
            : `<div style="display: flex; flex-direction: column; gap: 6px;">
                ${report.retirees.map(r => `
                  <div style="background: #111822; border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; font-size: 12px; display: flex; justify-content: space-between;">
                    <span>${r.flag} <b>${r.name}</b> (${r.age} л.)</span>
                    <span style="color: var(--text-dim);">Ранг #${r.rank} · Пик #${r.bestRank}</span>
                  </div>
                `).join('')}
              </div>`
          }
        </div>
      </div>
    `;
  }

  const modal = document.getElementById('testSeasonReportModal');
  if (modal) modal.classList.add('open');
}

export function rollbackTestSeasonSimulation() {
  const rawSnap = (typeof window !== 'undefined' && window._preSimSnapshot)
    ? window._preSimSnapshot
    : universeStorage.getItem('meta_pre_sim_snapshot_v1');

  if (!rawSnap) {
    resetCurrentSeasonToCleanJanuary();
    closeModal('testSeasonReportModal');
    return;
  }

  try {
    const parsedState = JSON.parse(rawSnap);
    applyStateSnapshot(parsedState);
    if (typeof window !== 'undefined') {
      window._preSimSnapshot = null;
    }
    memoryTestSimReport = null;
    delete memoryCheckpointsByUniverse[activeUniverseId];
    universeStorage.removeItem('meta_pre_sim_snapshot_v1');
    universeStorage.removeItem('meta_test_sim_report_v1');
    universeStorage.removeItem(CHECKPOINTS_STORAGE_KEY);
    ensureInitialSeasonCheckpoint();
    closeModal('testSeasonReportModal');
    updateTestSimBannerUI();
    initUI();
    renderPlayersTable();
    renderRaceTable();
    renderCalendarTable();
    showToast(`⏪ <b>Тестовый сезон успешно откачен назад!</b> Восстановлена дата ${formatDateDisplay(currentTourDateStr)} и исходные очки.`);
  } catch {
    resetCurrentSeasonToCleanJanuary();
    closeModal('testSeasonReportModal');
  }
}

export function commitTestSeasonSimulation() {
  if (typeof window !== 'undefined') {
    window._preSimSnapshot = null;
  }
  memoryTestSimReport = null;
  universeStorage.removeItem('meta_pre_sim_snapshot_v1');
  universeStorage.removeItem('meta_test_sim_report_v1');
  closeModal('testSeasonReportModal');
  updateTestSimBannerUI();
  showToast(`✅ <b>Результаты сезона ${currentTourYear} утверждены!</b> Вы можете перейти в следующий год кнопкой «Завершить сезон» во вкладке Рейтинга.`);
}

// Экспорт обработчиков в window для inline-вызовов из index.html
if (typeof window !== 'undefined') {
  window.switchTab = switchTab;
  window.changeDrawYear = changeDrawYear;
  window.loadSelectedTournament = loadSelectedTournament;
  window.handleUniverseChange = handleUniverseChange;
  window.openCreateUniverseModal = openCreateUniverseModal;
  window.confirmCreateNewUniverse = confirmCreateNewUniverse;
  window.promptDeleteCurrentUniverse = promptDeleteCurrentUniverse;
  window.confirmDeleteCurrentUniverse = confirmDeleteCurrentUniverse;
  window.resetCurrentSeasonToCleanJanuary = resetCurrentSeasonToCleanJanuary;
  window.hardResetUniverseTo2024 = hardResetUniverseTo2024;
  window.exportCurrentUniverse = exportCurrentUniverse;
  window.triggerImportUniverse = triggerImportUniverse;
  window.handleImportUniverseFile = handleImportUniverseFile;
  window.triggerImport2023ArchiveOnly = triggerImport2023ArchiveOnly;
  window.handleImport2023ArchiveFile = handleImport2023ArchiveFile;
  window.import2023DrawsOnlyFromObject = import2023DrawsOnlyFromObject;
  window.openApiSettingsModal = openApiSettingsModal;
  window.saveGroqApiSettings = saveGroqApiSettings;
  window.clearGroqApiKeySettings = clearGroqApiKeySettings;
  window.openPointsInfoModal = openPointsInfoModal;
  window.openEditCurrentTourney = openEditCurrentTourney;
  window.openEditTourneyModal = openEditTourneyModal;
  window.saveTourneyEdit = saveTourneyEdit;
  window.generateRealisticDraw = generateRealisticDraw;
  window.autoSimulateRound = autoSimulateRound;
  window.autoSimulateEntireTournament = autoSimulateEntireTournament;
  window.finishTournamentAndAwardPoints = finishTournamentAndAwardPoints;
  window.resetCurrentDraw = resetCurrentDraw;
  window.changeRound = changeRound;
  window.openOlympicTeamsModal = openOlympicTeamsModal;
  window.setOlympicTeamsFilter = setOlympicTeamsFilter;
  window.handleOlympicTeamsSearch = handleOlympicTeamsSearch;
  window.buildOlympicDelegationsData = buildOlympicDelegationsData;
  window.openScoreModal = openScoreModal;
  window.setMatchCommentaryMode = setMatchCommentaryMode;
  window.appendSetScore = appendSetScore;
  window.clearScoreInput = clearScoreInput;
  window.promptResetMatchResult = promptResetMatchResult;
  window.cancelResetMatchResult = cancelResetMatchResult;
  window.confirmResetMatchResult = confirmResetMatchResult;
  window.generateRandomScoreToInput = generateRandomScoreToInput;
  window.generateCommentaryForScoreWithAI = generateCommentaryForScoreWithAI;
  window.simulateMatchWithAI = simulateMatchWithAI;
  window.instantSimulateMatch = instantSimulateMatch;
  window.quickApplyWinner = quickApplyWinner;
  window.saveQuickStringScore = saveQuickStringScore;
  window.saveQuickStringScoreOnly = saveQuickStringScoreOnly;
  window.commitMatchOutcome = commitMatchOutcome;
  window.renderPlayersTable = renderPlayersTable;
  window.quickSaveInlineFlag = quickSaveInlineFlag;
  window.clearPlayerSearch = clearPlayerSearch;
  window.toggleUnknownCountryFilter = toggleUnknownCountryFilter;
  window.updateEditPlayerFlagPreview = updateEditPlayerFlagPreview;
  window.renderFlagBadge = renderFlagBadge;
  window.renderRaceTable = renderRaceTable;
  window.renderCalendarTable = renderCalendarTable;
  window.jumpToTourney = jumpToTourney;
  window.openPlayerProfileModal = openPlayerProfileModal;
  window.openEditFromPlayerProfile = openEditFromPlayerProfile;
  window.openAddPlayerModal = openAddPlayerModal;
  window.confirmAddPlayer = confirmAddPlayer;
  window.openEditPlayerModal = openEditPlayerModal;
  window.savePlayerEdit = savePlayerEdit;
  window.generateSinglePlayerStyleWithGroq = generateSinglePlayerStyleWithGroq;
  window.manualRepairPoints = manualRepairPoints;
  window.endSeasonAndDecayPoints = endSeasonAndDecayPoints;
  window.initHistoryUI = initHistoryUI;
  window.renderHistoryYear = renderHistoryYear;
  window.regeneratePressColumnForTourney = regeneratePressColumnForTourney;
  window.setSnapshotKey = setSnapshotKey;
  window.setCompareMode = setCompareMode;
  window.switchHallSubtab = switchHallSubtab;
  window.closeModal = closeModal;
  window.getCurrentState = getCurrentState;
  window.getAllCurrentDrawsMap = getAllCurrentDrawsMap;
  window.runTestSeasonSimulation = runTestSeasonSimulation;
  window.openTestSeasonReportModal = openTestSeasonReportModal;
  window.rollbackTestSeasonSimulation = rollbackTestSeasonSimulation;
  window.commitTestSeasonSimulation = commitTestSeasonSimulation;
  window.openCheckpointsModal = openCheckpointsModal;
  window.createManualCheckpoint = createManualCheckpoint;
  window.restoreSeasonCheckpoint = restoreSeasonCheckpoint;
  window.handleUtCardMouseMove = handleUtCardMouseMove;
  window.handleUtCardMouseLeave = handleUtCardMouseLeave;
  window.renderUltimateTeamCardHtml = renderUltimateTeamCardHtml;
  window.renderSpiderChartSvg = renderSpiderChartSvg;
  window.getPlayerLiveCardAnalytics = getPlayerLiveCardAnalytics;
  window.invalidatePlayerCardAnalyticsCache = invalidatePlayerCardAnalyticsCache;
  window.handleLiveScoreInputForMomentum = handleLiveScoreInputForMomentum;
  window.updateMomentumBarUI = updateMomentumBarUI;
  window.renderTennisFeed = renderTennisFeed;
  window.setTennisFeedFilter = setTennisFeedFilter;
  window.toggleFeedPostLike = toggleFeedPostLike;
  window.isCanonReadOnly = isCanonReadOnly;
  window.isAuthorOwnerMode = isAuthorOwnerMode;
  window.openAuthorUnlockModal = openAuthorUnlockModal;
  window.confirmAuthorUnlock = confirmAuthorUnlock;
  window.toggleGuestReadOnlyPreview = toggleGuestReadOnlyPreview;
  window.openWeeklyATP250BracketModal = openWeeklyATP250BracketModal;
  window.changeATP250ModalTourney = changeATP250ModalTourney;
  window.switchATP250ModalRound = switchATP250ModalRound;
  window.openFinalsDefendingModal = openFinalsDefendingModal;

  const syncLiveCanonSnapshotToLocalServer = () => {
    try {
      if (typeof window === 'undefined' || !window.location) return;
      const host = String(window.location.hostname || '').toLowerCase();
      if (host !== 'localhost' && host !== '127.0.0.1') return;
      if (activeUniverseId !== '1') return;
      const completedCount = Array.isArray(tournaments) ? tournaments.filter(t => t && t.completed).length : 0;
      if (completedCount < 26) return; // Защита: никогда не отправляем на сервер регрессировавшее состояние!

      const drawsBackup = {};
      const withdrawalsBackup = {};
      const bg250Backup = {};
      for (let y = 2023; y <= currentTourYear + 1; y++) {
        const yearTourneys = getSeasonTournaments(y, tournaments);
        yearTourneys.forEach(t => {
          const d = readSavedDraw(t.id, y);
          if (d && d.length > 0) drawsBackup[`draw_${t.id}_${y}`] = d;
          const w = universeStorage.getItem(`withdrawals_${t.id}_${y}`);
          if (w) {
            try { withdrawalsBackup[`withdrawals_${t.id}_${y}`] = JSON.parse(w); } catch { /* ignore */ }
          }
          const bg = universeStorage.getItem(`bg250_${t.id}_${y}`);
          if (bg) bg250Backup[`bg250_${t.id}_${y}`] = bg;
        });
      }
      const payload = {
        metaTennisTourSaveVersion: 8,
        exportedAt: new Date().toISOString(),
        universe: {
          id: '1',
          name: 'Вселенная Автора (Канон)',
          currentTourYear,
          currentTourDateStr,
          activeTourneyId: activeTourney ? activeTourney.id : activeTourneyId
        },
        players,
        tournaments,
        seasonsHistory,
        retiredLegends,
        draws: drawsBackup,
        withdrawals: withdrawalsBackup,
        bg250: bg250Backup,
        checkpoints: getSavedCheckpointsList()
      };
      fetch('/api/canon-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  window.syncLiveCanonSnapshotToLocalServer = syncLiveCanonSnapshotToLocalServer;

  const restoreAuthorCanonPositionsOnce = async () => {
    try {
      await ensureMasterArchivesLoaded();
      if (typeof window === 'undefined' || !window.location || typeof localStorage === 'undefined') return;
      const host = String(window.location.hostname || '').toLowerCase();
      if (host !== 'localhost' && host !== '127.0.0.1') return;

      const canonData = CANON_MASTER_SNAPSHOT;
      if (!canonData) return;

      // 0. Очищаем раздутые дубликаты сеток из localStorage, освобождая место
      try {
        runStorageGarbageCollector();
      } catch {}

      // 1. СНАЧАЛА гарантируем турниры (только если локальный прогресс автора не новее):
      const savedYear = parseInt(
        localStorage.getItem('universe_1_meta_tour_year_v8') ||
        localStorage.getItem('universe_1_meta_tour_year') ||
        localStorage.getItem('meta_tour_year_v8') ||
        localStorage.getItem('meta_tour_year'),
        10
      );
      const savedDate =
        localStorage.getItem('universe_1_meta_tour_date_v8') ||
        localStorage.getItem('universe_1_meta_tour_date') ||
        localStorage.getItem('meta_tour_date_v8') ||
        localStorage.getItem('meta_tour_date');
      const savedActiveTourney =
        localStorage.getItem('universe_1_meta_active_tourney_v8') ||
        localStorage.getItem('universe_1_meta_active_tourney') ||
        localStorage.getItem('meta_active_tourney_v8');

      const canonYear = Number(canonData.universe?.currentTourYear || 2025);
      const canonDate = String(canonData.universe?.currentTourDateStr || `${canonYear}-01-02`);
      const canonTourneyId = canonData.universe?.activeTourneyId || 'm_1';

      // Прогресс автора в localStorage НИКОГДА не деградирует назад:
      const hasLocalPlayers = Boolean(
        localStorage.getItem('universe_1_meta_players_v8') ||
        localStorage.getItem('universe_1_meta_players')
      );
      let isSavedProgressNewer = false;
      if (savedYear && savedYear > canonYear) {
        isSavedProgressNewer = true;
      } else if (
        savedYear === canonYear &&
        savedDate &&
        (savedDate > canonDate || (hasLocalPlayers && savedDate === canonDate))
      ) {
        isSavedProgressNewer = true;
      }

      const targetYear = isSavedProgressNewer ? savedYear : canonYear;
      const targetDate = isSavedProgressNewer ? savedDate : canonDate;
      const targetTourneyId = isSavedProgressNewer
        ? (savedActiveTourney || canonTourneyId)
        : canonTourneyId;

      if (!isSavedProgressNewer && Array.isArray(canonData.tournaments) && canonData.tournaments.length >= 26) {
        const str = JSON.stringify(canonData.tournaments);
        try {
          localStorage.setItem('universe_1_meta_tournaments', str);
          localStorage.setItem('universe_1_meta_tournaments_v8', str);
        } catch {}
        memoryUniverseStore['universe_1_meta_tournaments'] = str;
        memoryUniverseStore['universe_1_meta_tournaments_v8'] = str;
        tournaments = JSON.parse(str);
      }

      // 2. Гарантируем базу игроков (только если локальный прогресс автора не новее):
      if (!isSavedProgressNewer && Array.isArray(canonData.players) && canonData.players.length >= 250) {
        const str = JSON.stringify(canonData.players);
        try {
          localStorage.setItem('universe_1_meta_players', str);
          localStorage.setItem('universe_1_meta_players_v8', str);
        } catch {}
        memoryUniverseStore['universe_1_meta_players'] = str;
        memoryUniverseStore['universe_1_meta_players_v8'] = str;
        players = JSON.parse(str);
      }

      // 3. Синхронизируем дату и активный турнир строго по targetYear/targetDate в ОБА варианта ключей:
      try {
        localStorage.setItem('universe_1_meta_tour_year_v8', String(targetYear));
        localStorage.setItem('universe_1_meta_tour_date_v8', targetDate);
        localStorage.setItem('universe_1_meta_active_tourney_v8', targetTourneyId);
        localStorage.setItem('universe_1_meta_tour_year', String(targetYear));
        localStorage.setItem('universe_1_meta_tour_date', targetDate);
        localStorage.setItem('universe_1_meta_active_tourney', targetTourneyId);
      } catch {}
      memoryUniverseStore['universe_1_meta_tour_year'] = String(targetYear);
      memoryUniverseStore['universe_1_meta_tour_date'] = targetDate;
      memoryUniverseStore['universe_1_meta_active_tourney'] = targetTourneyId;
      memoryUniverseStore['universe_1_meta_tour_year_v8'] = String(targetYear);
      memoryUniverseStore['universe_1_meta_tour_date_v8'] = targetDate;
      memoryUniverseStore['universe_1_meta_active_tourney_v8'] = targetTourneyId;
      currentTourYear = targetYear;
      currentTourDateStr = targetDate;
      activeTourneyId = targetTourneyId;
      viewingYear = targetYear;

      // Синхронизируем историю сезонов (включая 2023 и завершенный 2024):
      if (canonData.seasonsHistory && typeof canonData.seasonsHistory === 'object') {
        const strHist = JSON.stringify(canonData.seasonsHistory);
        try {
          localStorage.setItem('universe_1_meta_seasons_history', strHist);
          localStorage.setItem('meta_seasons_history', strHist);
        } catch {}
        memoryUniverseStore['universe_1_meta_seasons_history'] = strHist;
        memoryUniverseStore['meta_seasons_history'] = strHist;
        seasonsHistory = JSON.parse(strHist);
      }

      // Синхронизируем ветеранов, завершивших карьеру:
      if (Array.isArray(canonData.retiredLegends)) {
        const strRet = JSON.stringify(canonData.retiredLegends);
        try {
          localStorage.setItem('universe_1_meta_retired_legends', strRet);
          localStorage.setItem('meta_retired_legends', strRet);
        } catch {}
        memoryUniverseStore['universe_1_meta_retired_legends'] = strRet;
        memoryUniverseStore['meta_retired_legends'] = strRet;
        retiredLegends = JSON.parse(strRet);
      }

      // 4. Синхронизируем чекпоинты (включая ручной чекпоинт от 15 ноября и чекпоинт после Океанского шлема):
      if (Array.isArray(canonData.checkpoints) && canonData.checkpoints.length > 0) {
        const rawCps = localStorage.getItem('universe_1_meta_checkpoints') || localStorage.getItem('meta_checkpoints') || localStorage.getItem('universe_1_meta_checkpoints_v2') || localStorage.getItem('meta_checkpoints_v2');
        let currentCps = [];
        try { if (rawCps) currentCps = JSON.parse(rawCps); } catch {}
        if (!Array.isArray(currentCps)) currentCps = [];
        const map = new Map();
        canonData.checkpoints.forEach(cp => { if (cp?.id) map.set(cp.id, cp); });
        currentCps.forEach(cp => { if (cp?.id && !map.has(cp.id)) map.set(cp.id, cp); });
        const merged = Array.from(map.values())
          .map(cp => {
            if (cp && cp.draws) {
              const c = { ...cp };
              delete c.draws;
              return c;
            }
            return cp;
          })
          .sort((a, b) => String(b.dateStr || '').localeCompare(String(a.dateStr || '')));
        const str = JSON.stringify(merged);
        try {
          localStorage.setItem('universe_1_meta_checkpoints', str);
          localStorage.setItem('meta_checkpoints', str);
        } catch {}
        memoryUniverseStore['universe_1_meta_checkpoints'] = str;
        memoryUniverseStore['meta_checkpoints'] = str;
        memoryUniverseStore['universe_1_meta_checkpoints_v2'] = str;
        memoryUniverseStore['meta_checkpoints_v2'] = str;
        memoryCheckpointsByUniverse['1'] = merged;
      }

      // 5. Загружаем ВСЕ 53 сетки в память memoryUniverseStore (без квоты localStorage):
      const allDrawSources = {
        ...(RESTORED_2024_DRAWS || {}),
        ...(canonData.draws || {})
      };

      Object.entries(allDrawSources).forEach(([drawKey, canonDraw]) => {
        if (!canonDraw || !Array.isArray(canonDraw) || canonDraw.length === 0) return;
        const rest = String(drawKey).startsWith('draw_') ? String(drawKey).slice(5) : String(drawKey);
        const fullKey = `draw_1_${rest}`;
        const existingLocalDraw = localStorage.getItem(fullKey) || localStorage.getItem(`universe_1_${drawKey}`) || localStorage.getItem(drawKey);

        if (isSavedProgressNewer && existingLocalDraw) {
          memoryUniverseStore[fullKey] = existingLocalDraw;
          memoryUniverseStore[`universe_1_${drawKey}`] = existingLocalDraw;
          memoryUniverseStore[drawKey] = existingLocalDraw;
          return;
        }

        const str = typeof canonDraw === 'string' ? canonDraw : JSON.stringify(canonDraw);
        memoryUniverseStore[fullKey] = str;
        memoryUniverseStore[`universe_1_${drawKey}`] = str;
        memoryUniverseStore[drawKey] = str;

        // В localStorage сохраняем сетки активного и прошлого сезона (динамически targetYear и targetYear - 1):
        if (rest.endsWith(`_${targetYear}`) || rest.endsWith(`_${targetYear - 1}`)) {
          try {
            localStorage.setItem(fullKey, str);
          } catch {}
        }
      });
    } catch {
      // ignore
    }
  };

  const bootstrapApp = async () => {
    runStorageGarbageCollector();
    await ensureMasterArchivesLoaded();
    await fetchOverridesFromLocalServer();
    await restoreAuthorCanonPositionsOnce();
    await loadPublishedCanonSnapshot();
    initData();
    initUI();
    syncLiveCanonSnapshotToLocalServer();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
  } else {
    bootstrapApp();
  }
}
