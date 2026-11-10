/**
 * Meta Tennis Tour — Календарь турниров сезона, Олимпийский цикл (раз в 4 года) и фоновые турниры ATP 250
 * Все кастомные названия турниров пользователя из сезона 2023 года и их покрытия полностью сохранены.
 * В високосные олимпийские годы (2024, 2028, 2032...) в конец июля / начало августа добавляется
 * Olympic Tennis Tournament (Олимпийские игры) на 64 игрока с матчем за 3-е место.
 */

export const OLYMPIC_TOURNAMENT_TEMPLATE = {
  id: 'olympics',
  name: 'Olympic Tennis Tournament (Олимпийские игры)',
  type: 'Олимпиада',
  surface: 'Грунт',
  size: 64,
  bestOf: 3,
  startMonth: 6,
  startDay: 27,
  endMonth: 7,
  endDay: 4,
  isOlympics: true
};

export function isOlympicYear(year) {
  const y = Number(year);
  return !isNaN(y) && y >= 2024 && y % 4 === 0;
}

export const OLYMPIC_SURFACE_REGISTRY = {
  2024: 'Грунт', // Париж (Ролан Гаррос)
  2028: 'Хард',  // Лос-Анджелес
  2032: 'Хард'   // Брисбен
};

export const OLYMPIC_DEFAULT_SURFACE_CYCLE = ['Хард', 'Грунт', 'Хард', 'Трава'];

export function getOlympicSurface(year) {
  const y = Number(year) || 2024;
  if (OLYMPIC_SURFACE_REGISTRY[y]) {
    return OLYMPIC_SURFACE_REGISTRY[y];
  }
  const olyIndex = Math.abs(Math.floor((y - 2024) / 4));
  return OLYMPIC_DEFAULT_SURFACE_CYCLE[olyIndex % OLYMPIC_DEFAULT_SURFACE_CYCLE.length];
}

export const FULL_CALENDAR_TEMPLATE = [
  { id: 'm_1', name: 'Хьюстон Masters', type: 'Мастерс', surface: 'Хард', size: 64, bestOf: 3, startMonth: 0, startDay: 2, endMonth: 0, endDay: 11 },
  { id: 'tbsh_1', name: 'Cartom Calamb (ТБШ)', type: 'ТБШ', surface: 'Хард', size: 128, bestOf: 5, startMonth: 0, startDay: 16, endMonth: 0, endDay: 29 },
  { id: '500_1', name: 'Роттердам Open 500', type: 'ATP 500', surface: 'Зал', size: 32, bestOf: 3, startMonth: 1, startDay: 6, endMonth: 1, endDay: 12 },
  { id: '500_2', name: 'Рио-де-Жанейро 500', type: 'ATP 500', surface: 'Грунт', size: 32, bestOf: 3, startMonth: 1, startDay: 15, endMonth: 1, endDay: 21 },
  { id: '500_3', name: 'Дубай Чемпионат 500', type: 'ATP 500', surface: 'Хард', size: 32, bestOf: 3, startMonth: 1, startDay: 24, endMonth: 2, endDay: 2 },
  { id: 'm_2', name: 'Александрия Masters', type: 'Мастерс', surface: 'Хард', size: 64, bestOf: 3, startMonth: 2, startDay: 6, endMonth: 2, endDay: 16 },
  { id: 'm_3', name: 'Дубай Masters', type: 'Мастерс', surface: 'Хард', size: 64, bestOf: 3, startMonth: 2, startDay: 20, endMonth: 2, endDay: 30 },
  { id: 'm_4', name: 'Мадрид Masters', type: 'Мастерс', surface: 'Грунт', size: 64, bestOf: 3, startMonth: 3, startDay: 14, endMonth: 3, endDay: 23 },
  { id: '500_4', name: 'Барселона Open 500', type: 'ATP 500', surface: 'Грунт', size: 32, bestOf: 3, startMonth: 3, startDay: 25, endMonth: 4, endDay: 1 },
  { id: 'm_5', name: 'Милан Masters', type: 'Мастерс', surface: 'Грунт', size: 64, bestOf: 3, startMonth: 4, startDay: 3, endMonth: 4, endDay: 13 },
  { id: 'tbsh_2', name: 'Poland Open (ТБШ)', type: 'ТБШ', surface: 'Грунт', size: 128, bestOf: 5, startMonth: 4, startDay: 28, endMonth: 5, endDay: 11 },
  { id: '500_5', name: 'Галле Trophy 500', type: 'ATP 500', surface: 'Трава', size: 32, bestOf: 3, startMonth: 5, startDay: 14, endMonth: 5, endDay: 20 },
  { id: '500_6', name: "Queen's Club 500", type: 'ATP 500', surface: 'Трава', size: 32, bestOf: 3, startMonth: 5, startDay: 21, endMonth: 5, endDay: 27 },
  { id: 'm_6', name: 'Дублин Masters', type: 'Мастерс', surface: 'Трава', size: 64, bestOf: 3, startMonth: 5, startDay: 28, endMonth: 6, endDay: 5 },
  { id: 'tbsh_3', name: 'Polovchis (ТБШ)', type: 'ТБШ', surface: 'Трава', size: 128, bestOf: 5, startMonth: 6, startDay: 8, endMonth: 6, endDay: 21 },
  { id: '500_7', name: 'Гамбург Open 500', type: 'ATP 500', surface: 'Грунт', size: 32, bestOf: 3, startMonth: 6, startDay: 24, endMonth: 6, endDay: 30 },
  { id: '500_8', name: 'Вашингтон Classic 500', type: 'ATP 500', surface: 'Хард', size: 32, bestOf: 3, startMonth: 7, startDay: 1, endMonth: 7, endDay: 7 },
  { id: 'm_7', name: 'Сидней Masters', type: 'Мастерс', surface: 'Хард', size: 64, bestOf: 3, startMonth: 7, startDay: 9, endMonth: 7, endDay: 18 },
  { id: 'tbsh_4', name: 'Okeanskiy Open (ТБШ)', type: 'ТБШ', surface: 'Хард', size: 128, bestOf: 5, startMonth: 7, startDay: 28, endMonth: 8, endDay: 10 },
  { id: '500_9', name: 'Пекин China Open 500', type: 'ATP 500', surface: 'Хард', size: 32, bestOf: 3, startMonth: 8, startDay: 20, endMonth: 8, endDay: 26 },
  { id: '500_10', name: 'Токио Japan Open 500', type: 'ATP 500', surface: 'Хард', size: 32, bestOf: 3, startMonth: 8, startDay: 28, endMonth: 9, endDay: 4 },
  { id: 'm_8', name: 'Берлин Masters', type: 'Мастерс', surface: 'Зал', size: 64, bestOf: 3, startMonth: 9, startDay: 8, endMonth: 9, endDay: 17 },
  { id: '500_11', name: 'Вена Open 500', type: 'ATP 500', surface: 'Зал', size: 32, bestOf: 3, startMonth: 9, startDay: 20, endMonth: 9, endDay: 26 },
  { id: '500_12', name: 'Базель Indoor 500', type: 'ATP 500', surface: 'Зал', size: 32, bestOf: 3, startMonth: 9, startDay: 27, endMonth: 10, endDay: 2 },
  { id: 'm_9', name: 'Хельсинки Masters', type: 'Мастерс', surface: 'Зал', size: 64, bestOf: 3, startMonth: 10, startDay: 4, endMonth: 10, endDay: 12 },
  { id: 'finals', name: 'World Tour Finals - Стокгольм (Топ-8)', type: 'Итоговый', surface: 'Зал', size: 8, bestOf: 3, startMonth: 10, startDay: 15, endMonth: 10, endDay: 22 }
];

/**
 * Возвращает список турниров для указанного года.
 * В невисокосные годы (2023, 2025, 2026...) — 26 турниров (без Олимпиады).
 * В олимпийские годы (2024, 2028, 2032...) — 27 турниров (включая Олимпийские игры в конце июля / начале августа).
 */
export function getSeasonTournaments(year, currentTournaments = null) {
  const source = Array.isArray(currentTournaments) && currentTournaments.length > 0
    ? currentTournaments
    : FULL_CALENDAR_TEMPLATE;

  const withoutOlympics = source.filter(t => t && t.id !== 'olympics');
  if (!isOlympicYear(year)) {
    return withoutOlympics;
  }

  const existingOlympics = source.find(t => t && t.id === 'olympics');
  const olympicEntry = existingOlympics
    ? { ...OLYMPIC_TOURNAMENT_TEMPLATE, ...existingOlympics, surface: getOlympicSurface(year) }
    : { ...OLYMPIC_TOURNAMENT_TEMPLATE, surface: getOlympicSurface(year) };

  const result = [];
  let inserted = false;
  for (const t of withoutOlympics) {
    result.push(t);
    if (t.id === '500_7') {
      result.push(olympicEntry);
      inserted = true;
    }
  }
  if (!inserted) {
    result.splice(Math.min(16, result.length), 0, olympicEntry);
  }
  return result;
}

export const BG_250_NAMES = [
  "Окленд 250", "Аделаида 250", "Монпелье 250", "Кордоба 250", "Делрей-Бич 250",
  "Доха 250", "Марсель 250", "Сантьяго 250", "Хьюстон 250", "Марракеш 250",
  "Бухарест 250", "Мюнхен 250", "Эшторил 250", "Женева 250", "Лион 250",
  "Штутгарт 250", "Хертогенбос 250", "Мальорка 250", "Истборн 250", "Ньюпорт 250",
  "Бостад 250", "Гштаад 250", "Умаг 250", "Китцбюэль 250", "Атланта 250",
  "Лос-Кабос 250", "Уинстон-Сейлем 250", "Чэнду 250", "Чжухай 250", "Астана 250",
  "Антверпен 250", "Стокгольм 250", "Мец 250", "София 250"
];

export const rNames128 = ["1/64 финала", "1/32 финала", "1/16 финала", "1/8 финала", "1/4 финала", "Полуфинал", "ФИНАЛ 🏆"];
export const rNames64 = ["1/32 финала", "1/16 финала", "1/8 финала", "1/4 финала", "Полуфинал", "ФИНАЛ 🏆"];
export const rNamesOlympics = ["1/32 финала", "1/16 финала", "1/8 финала", "1/4 финала", "Полуфинал", "Матч за 3-е место и Финал 🏅"];
export const rNames32 = ["1/16 финала", "1/8 финала", "1/4 финала", "Полуфинал", "ФИНАЛ 🏆"];
export const rNamesFinals = ["Группа А (6)", "Группа Б (6)", "Полуфинал (2)", "ФИНАЛ 🏆 (1)"];

export function getTourneyDateRange(t, year) {
  if (!t) return `01.01 - 07.01.${year || 2024}`;
  const y = Number(year) || 2024;
  const startD = new Date(y, t.startMonth || 0, t.startDay || 1);
  const endD = new Date(y, t.endMonth || 0, t.endDay || 7);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(startD.getDate())}.${pad(startD.getMonth() + 1)} - ${pad(endD.getDate())}.${pad(endD.getMonth() + 1)}.${y}`;
}

if (typeof window !== 'undefined') {
  window.OLYMPIC_SURFACE_REGISTRY = OLYMPIC_SURFACE_REGISTRY;
  window.OLYMPIC_DEFAULT_SURFACE_CYCLE = OLYMPIC_DEFAULT_SURFACE_CYCLE;
  window.OLYMPIC_TOURNAMENT_TEMPLATE = OLYMPIC_TOURNAMENT_TEMPLATE;
  window.isOlympicYear = isOlympicYear;
  window.getOlympicSurface = getOlympicSurface;
  window.getSeasonTournaments = getSeasonTournaments;
  window.FULL_CALENDAR_TEMPLATE = FULL_CALENDAR_TEMPLATE;
  window.BG_250_NAMES = BG_250_NAMES;
  window.rNames128 = rNames128;
  window.rNames64 = rNames64;
  window.rNamesOlympics = rNamesOlympics;
  window.rNames32 = rNames32;
  window.rNamesFinals = rNamesFinals;
  window.getTourneyDateRange = getTourneyDateRange;
}
