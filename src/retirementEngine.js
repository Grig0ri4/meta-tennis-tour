/**
 * Meta Tennis Tour — Система завершения карьеры и генерации молодых новичков (retirementEngine.js)
 * Срабатывает раз в год при завершении сезона:
 * - Возрастной ценз: 37–42 года (43+ также уходят со 100% вероятностью).
 * - Защита элиты: если возрастной игрок входит в Топ-50 мирового рейтинга, шанс ухода минимален — 7% (5–10%).
 * - Шкала ухода вне Топ-50: 37 л — 25%, 38 л — 50%, 39 л — 70%, 40 л — 85%, 41–42+ г — 98%.
 * - На место каждого завершившего карьеру генерируется ровно 1 молодой ньюген (17–23 года, 20–45 очков, уникальное латинское имя без цифр).
 * - Ротация нижнего рейтинга: 20 игроков №233–300 покидают тур (приоритет — возраст 25–35 лет),
 *   вместо них приходят 10 юниоров 16–19 лет и 10 игроков 20–27 лет.
 */

import { calculateAgeNum, generatePlayerPotential, POTENTIAL_MODEL_VERSION } from './rankingEngine.js';

export const NEWGEN_FIRST_NAMES = [
  "Lucas", "Mateo", "Enzo", "Leo", "Hugo", "Gabriel", "Adrian", "Julian", "Tomas", "Nico",
  "Kaito", "Soren", "Casper", "Liam", "Noah", "Elias", "Maxime", "Lorenzo", "Diego", "Marco",
  "Sebastian", "Damian", "Filippo", "Aleksei", "Milan", "Stefan", "Luka", "Viktor", "Roman", "Oscar",
  "Arthur", "Theo", "Raphael", "Valentin", "Gael", "Bastien", "Corentin", "Quentin", "Mathis", "Clement",
  "Alvaro", "Javier", "Iker", "Gonzalo", "Ruben", "Sergio", "Alejandro", "Pablo", "Dario", "Giacomo",
  "Pietro", "Edoardo", "Federico", "Andrea", "Leonardo", "Dante", "Moritz", "Florian", "Tobias", "Benedikt",
  "Lennart", "Fabian", "Henrik", "Rasmus", "Arvid", "Jesper", "Niels", "Bram", "Sven", "Kacper",
  "Szymon", "Ondrej", "Vojtech", "Milos", "Petar", "Dusan", "Tadej", "Marin", "Karlo", "Thiago",
  "Caio", "Rodrigo", "Facundo", "Bautista", "Joaquin", "Santiago", "Matias", "Cristian", "Harrison", "Colton",
  "Preston", "Tyler", "Brandon", "Lachlan", "Cooper", "Flynn", "Callum", "Alistair", "Declan", "Haruto",
  "Takumi", "Daiki", "Shohei", "Kenji", "Ren", "Akira", "Timur", "Denis", "Maxim", "Ilya"
];

export const NEWGEN_LAST_NAMES = [
  "Alcantara", "Bellini", "Moretti", "Lemaire", "Chevalier", "Garnier", "Ferretti", "Conti", "Lombardo", "Marchetti",
  "Galli", "Santoro", "Castiglione", "Barone", "De Angelis", "Vianello", "Delgado", "Herrera", "Mendoza", "Castellanos",
  "Dominguez", "Salgado", "Benitez", "Morales", "Roldan", "Navarro", "Ibarra", "Caceres", "Quiroga", "Gutierrez",
  "Montalbano", "Del Valle", "Villarroel", "Fonseca", "Rios", "Monteiro", "Silveira", "Azevedo", "Santana", "Pacheco",
  "Barbosa", "Fernandes", "Hartmann", "Vogel", "Richter", "Schultheiss", "Becker", "Sommer", "Althaus", "Bruns",
  "Baumann", "Zeiler", "Fontana", "Schuler", "Gruber", "Weber", "Holzer", "Hofbauer", "Van Der Meer", "De Jong",
  "Van Den Berg", "Hendriks", "Van Dijk", "Visser", "Mercier", "Bouchard", "Tremblay", "Gauthier", "Lind", "Mikkelsen",
  "Vestergaard", "Pedersen", "Holm", "Sjoborg", "Dahl", "Solberg", "Lindgren", "Lindholm", "Nygard", "Lindqvist",
  "Ekstrom", "Berglund", "Haapala", "Makinen", "Wolski", "Kowalczyk", "Kaminski", "Vanecek", "Novak", "Sedlak",
  "Cech", "Pospisil", "Kolar", "Jovanovic", "Lazic", "Petrovic", "Zoric", "Milosevic", "Horvat", "Simunic",
  "Radic", "Vodopivec", "Dimitrov", "Kovacs", "Ionescu", "Stanciu", "Volkov", "Orlov", "Turgenev", "Voronov",
  "Zakharov", "Morozov", "Takahashi", "Watanabe", "Morita", "Nishimura", "Saito", "Hayashi", "Fujimoto", "Thorne",
  "Crawford", "Beaumont", "Fraser", "MacLeod", "Kensington", "Campbell", "O'Sullivan", "Byrne", "Gallagher", "Vance",
  "Pendleton", "Henderson", "Brooks", "Sterling", "Wheeler", "MacIntyre", "Montgomery", "Mitchell", "Reid", "O'Connor"
];

export const TENNIS_NATIONS = [
  "ESP", "USA", "FRA", "ITA", "GER", "AUS", "JPN", "ARG", "SRB", "GBR",
  "SUI", "NOR", "SWE", "DEN", "NED", "CAN", "CRO", "CZE", "POL", "BRA",
  "CHI", "AUT", "BEL", "RUS", "KAZ", "BUL", "POR", "FIN", "HUN", "SLO",
  "GRE", "GEO", "UKR", "CHN", "KOR", "TPE", "RSA", "MEX", "COL", "ROU"
];

export const NEWGEN_NICKNAMES = [
  "Молния корта", "Грунтовый Принц", "Железный Бэкхенд", "Северная Ракета", "Маэстро Укороченных",
  "Призрак Задней Линии", "Король Тайбрейков", "Пушечный Эйс", "Неутомимый Марафонец", "Хирург Косых Ударов",
  "Шторм на Приеме", "Снайпер Линий", "Стальной Нерв", "Вихрь У Сетки", "Титан Обороны",
  "Матадор Корта", "Ледяной Импульс", "Гений Вращения", "Огненный Форхенд", "Феномен Новой Волны"
];

export const NEWGEN_PLAY_STYLES = [
  "Агрессивный бейслайнер с мощной подачей",
  "Контратакующий мастер затяжных розыгрышей",
  "Тактический универсал с вариативным резаным ударом",
  "Атакующий сеточник новой волны (Serve & Volley)",
  "Темповик с тяжелым топ-спином и плотным бэкхендом",
  "Взрывной панчер с сокрушительным форхендом навылет",
  "Непробиваемый защитник со сверхбыстрой работой ног",
  "Специалист быстрых покрытий с плоской подачей за 225 км/ч",
  "Грунтовый стратег с высоким отскоком и скрытыми дроп-шотами",
  "Интеллектуальный плеймейкер, читающий игру на два удара вперед"
];

/**
 * Вычисляет вероятность завершения карьеры (0..1) для игрока.
 */
export function getRetirementProbability(age, rank) {
  if (age < 37) return 0;

  // Условие защиты элиты: если возрастной игрок входит в Топ-50 мирового рейтинга,
  // вероятность ухода минимальна (5–10%, берем 0.075)
  if (rank <= 50) {
    return 0.075;
  }

  // Шкала вероятности ухода для игроков вне Топ-50:
  if (age === 37) return 0.25;
  if (age === 38) return 0.50;
  if (age === 39) return 0.70;
  if (age === 40) return 0.85;
  return 0.98; // 41-42+ года — 95-100% шанс
}

/**
 * Генерирует уникальное имя на латинице БЕЗ цифр, не пересекающееся с existingNamesSet.
 */
export function generateUniqueLatinName(existingNamesSet, rng = Math.random) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const first = NEWGEN_FIRST_NAMES[Math.floor(rng() * NEWGEN_FIRST_NAMES.length)];
    const last = NEWGEN_LAST_NAMES[Math.floor(rng() * NEWGEN_LAST_NAMES.length)];
    const fullName = `${first} ${last}`;
    if (!/\d/.test(fullName) && !existingNamesSet.has(fullName.toLowerCase())) {
      existingNamesSet.add(fullName.toLowerCase());
      return fullName;
    }
  }
  // Fallback compound Latin surname without digits
  const f = NEWGEN_FIRST_NAMES[Math.floor(rng() * NEWGEN_FIRST_NAMES.length)];
  const l1 = NEWGEN_LAST_NAMES[Math.floor(rng() * NEWGEN_LAST_NAMES.length)];
  const l2 = NEWGEN_LAST_NAMES[Math.floor(rng() * NEWGEN_LAST_NAMES.length)];
  const fallback = `${f} ${l1}-${l2}`;
  existingNamesSet.add(fallback.toLowerCase());
  return fallback;
}

/**
 * Генерирует одного молодого новичка (Ньюгена) на смену ушедшему игроку.
 * options: ageMin/ageMax, pointsMin/pointsMax (кратно 5), idPrefix.
 */
export function createNewgenPlayer(nextSeasonYear, existingNamesSet, nextIdNumber, rng = Math.random, options = {}) {
  const ageMin = Number.isFinite(options.ageMin) ? Math.floor(options.ageMin) : 17;
  const ageMax = Number.isFinite(options.ageMax) ? Math.floor(options.ageMax) : 23;
  const ageSpan = Math.max(1, ageMax - ageMin + 1);
  const age = ageMin + Math.floor(rng() * ageSpan); // по умолчанию строго от 17 до 23 лет
  const birthYear = nextSeasonYear - age;
  const birthMonth = String(1 + Math.floor(rng() * 12)).padStart(2, '0');
  const birthDay = String(1 + Math.floor(rng() * 28)).padStart(2, '0');
  const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

  const name = generateUniqueLatinName(existingNamesSet, rng);
  const flag = TENNIS_NATIONS[Math.floor(rng() * TENNIS_NATIONS.length)];
  const pointsMin = Number.isFinite(options.pointsMin) ? Math.floor(options.pointsMin) : 20;
  const pointsMax = Number.isFinite(options.pointsMax) ? Math.floor(options.pointsMax) : 45;
  const pointsSteps = Math.max(1, Math.floor((pointsMax - pointsMin) / 5) + 1);
  const startPoints = pointsMin + Math.floor(rng() * pointsSteps) * 5; // по умолчанию 20..45 очков
  const nickname = NEWGEN_NICKNAMES[(nextIdNumber - 1 + Math.floor(rng() * NEWGEN_NICKNAMES.length)) % NEWGEN_NICKNAMES.length];
  const playStyle = NEWGEN_PLAY_STYLES[(nextIdNumber - 1 + Math.floor(rng() * NEWGEN_PLAY_STYLES.length)) % NEWGEN_PLAY_STYLES.length];
  const prevYear = nextSeasonYear - 1;
  const p1 = Math.min(10, startPoints);
  const p2 = Math.min(10, Math.max(0, startPoints - p1));
  const p3 = Math.max(0, startPoints - p1 - p2);
  const tournamentPoints = { '500_1': { [prevYear]: p1 } };
  if (p2 > 0) tournamentPoints['500_2'] = { [prevYear]: p2 };
  if (p3 > 0) tournamentPoints['500_3'] = { [prevYear]: p3 };
  const idPrefix = options.idPrefix || 'p_new';

  return {
    id: `${idPrefix}_${nextSeasonYear}_${nextIdNumber}`,
    rank: 300,
    name,
    flag,
    points: startPoints,
    basePoints: startPoints,
    start2023Points: startPoints,
    racePoints: 0,
    finalsPoints: 0,
    remainingDefending: startPoints,
    defendedSoFar: 0,
    birthDate,
    ageAtEntry: age,
    tournamentPoints,
    rankChange: 0,
    bestRank: 300,
    seasonsPlayed: 0,
    isNewgen: true,
    debutYear: nextSeasonYear,
    nickname,
    playStyle,
    // POT генерируется после всех полей, чтобы не сдвигать детерминированную последовательность rng
    potential: generatePlayerPotential(rng, { age }),
    potentialModel: POTENTIAL_MODEL_VERSION
  };
}

/**
 * Обрабатывает пересменку поколений в конце сезона:
 * проверяет всех игроков 37..42+ лет, формирует список завершивших карьеру ветеранов
 * и генерирует ровно столько же молодых талантов (сохраняя баланс в 300 игроков).
 */
export function processEndOfSeasonRetirements(players, endingSeasonYear, existingRetiredLegends = [], rng = Math.random) {
  const nextSeasonYear = endingSeasonYear + 1;
  const checkDateStr = `${endingSeasonYear}-12-30`;

  const existingNamesSet = new Set();
  players.forEach(p => existingNamesSet.add(p.name.toLowerCase()));
  existingRetiredLegends.forEach(p => existingNamesSet.add(p.name.toLowerCase()));

  const retiredThisYear = [];
  const remainingPlayers = [];

  players.forEach(p => {
    const age = calculateAgeNum(p.birthDate, checkDateStr);
    const prob = getRetirementProbability(age, p.rank);
    const bestRank = Math.min(p.bestRank || p.rank, p.rank);
    const seasonsPlayed = (p.seasonsPlayed || 1);

    if (prob > 0 && rng() < prob) {
      retiredThisYear.push({
        id: p.id,
        name: p.name,
        flag: p.flag,
        birthDate: p.birthDate,
        retiredAge: age,
        retiredYear: endingSeasonYear,
        finalRank: p.rank,
        bestRank: bestRank,
        finalPoints: p.points,
        seasonsPlayed: seasonsPlayed,
        weeksAtNo1: Math.max(0, Number(p.weeksAtNo1) || 0),
        medals: p.medals ? { ...p.medals } : { gold: 0, silver: 0, bronze: 0 }
      });
    } else {
      remainingPlayers.push({
        ...p,
        bestRank: bestRank,
        seasonsPlayed: seasonsPlayed + 1
      });
    }
  });

  const newgensThisYear = [];
  for (let i = 0; i < retiredThisYear.length; i++) {
    const ng = createNewgenPlayer(nextSeasonYear, existingNamesSet, i + 1, rng);
    newgensThisYear.push(ng);
    remainingPlayers.push(ng);
  }

  return {
    updatedPlayers: remainingPlayers,
    retiredThisYear,
    newgensThisYear
  };
}

export const LOWER_RANK_CHURN_CONFIG = {
  rankMin: 233,
  rankMax: 300,
  ageMin: 25,
  ageMax: 35,
  targetCount: 20,
  youthCount: 10,
  youthAgeMin: 16,
  youthAgeMax: 19,
  seniorAgeMin: 20,
  seniorAgeMax: 27,
  youthPointsMin: 5,
  youthPointsMax: 30,
  seniorPointsMin: 20,
  seniorPointsMax: 55
};

/**
 * Ежегодная ротация нижней части рейтинга: 20 игроков №233–300 покидают тур.
 * Приоритет отдаётся возрасту 25–35 лет; если таких меньше 20, квоту добирают
 * самые возрастные игроки нижней части рейтинга. Их места занимают 10 юниоров
 * (16–19 лет) и 10 игроков (20–27 лет).
 * Ушедшие возвращаются с флагом isJourneyman, чтобы их профили из архивных сеток оставались доступны.
 */
export function processLowerRankChurn(players, endingSeasonYear, existingRetiredLegends = [], rng = Math.random) {
  const cfg = LOWER_RANK_CHURN_CONFIG;
  const nextSeasonYear = endingSeasonYear + 1;
  const checkDateStr = `${endingSeasonYear}-12-30`;

  const existingNamesSet = new Set();
  players.forEach(p => { if (p && p.name) existingNamesSet.add(String(p.name).toLowerCase()); });
  existingRetiredLegends.forEach(p => { if (p && p.name) existingNamesSet.add(String(p.name).toLowerCase()); });

  const ageAtSeasonEnd = p => calculateAgeNum(p.birthDate, checkDateStr);
  const inChurnBand = p => {
    const rank = Number(p.rank) || 0;
    return rank >= cfg.rankMin && rank <= cfg.rankMax;
  };
  const eligible = players.filter(p => p && inChurnBand(p) && ageAtSeasonEnd(p) >= cfg.ageMin && ageAtSeasonEnd(p) <= cfg.ageMax);

  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const preferred = shuffled.slice(0, Math.min(cfg.targetCount, shuffled.length));
  const preferredIds = new Set(preferred.map(p => String(p.id)));

  // Если игроков 25–35 лет не хватает, добираем самых возрастных из нижней части рейтинга
  let selected = preferred;
  const fallbackCount = cfg.targetCount - preferred.length;
  if (fallbackCount > 0) {
    const fallback = players
      .filter(p => p && !preferredIds.has(String(p.id)) && inChurnBand(p))
      .map(p => ({ player: p, age: ageAtSeasonEnd(p) }))
      .sort((a, b) => b.age - a.age)
      .slice(0, fallbackCount)
      .map(x => x.player);
    selected = [...preferred, ...fallback];
  }
  const selectedIds = new Set(selected.map(p => String(p.id)));

  const churnedPlayers = selected.map(p => {
    const age = ageAtSeasonEnd(p);
    return {
      id: p.id,
      name: p.name,
      flag: p.flag,
      birthDate: p.birthDate,
      retiredAge: age,
      retiredYear: endingSeasonYear,
      finalRank: p.rank,
      bestRank: Math.min(p.bestRank || p.rank, p.rank),
      finalPoints: p.points,
      seasonsPlayed: p.seasonsPlayed || 1,
      weeksAtNo1: Math.max(0, Number(p.weeksAtNo1) || 0),
      medals: p.medals ? { ...p.medals } : { gold: 0, silver: 0, bronze: 0 },
      isJourneyman: true,
      retiredReason: 'ranking_churn'
    };
  });

  const remainingPlayers = players.filter(p => !p || !selectedIds.has(String(p.id)));
  const churnNewcomers = [];
  // Новички делятся в пропорции 10 юниоров / 10 игроков 20–27 лет
  const youthCount = Math.min(selected.length, Math.round(selected.length * cfg.youthCount / cfg.targetCount));
  for (let i = 0; i < selected.length; i++) {
    const isYouth = i < youthCount;
    const ng = createNewgenPlayer(nextSeasonYear, existingNamesSet, i + 1, rng, isYouth
      ? {
          ageMin: cfg.youthAgeMin,
          ageMax: cfg.youthAgeMax,
          pointsMin: cfg.youthPointsMin,
          pointsMax: cfg.youthPointsMax,
          idPrefix: 'p_churn'
        }
      : {
          ageMin: cfg.seniorAgeMin,
          ageMax: cfg.seniorAgeMax,
          pointsMin: cfg.seniorPointsMin,
          pointsMax: cfg.seniorPointsMax,
          idPrefix: 'p_churn'
        });
    ng.entryGroup = isYouth ? 'youth' : 'senior';
    churnNewcomers.push(ng);
    remainingPlayers.push(ng);
  }

  return {
    updatedPlayers: remainingPlayers,
    churnedPlayers,
    churnNewcomers
  };
}

if (typeof window !== 'undefined') {
  window.getRetirementProbability = getRetirementProbability;
  window.generateUniqueLatinName = generateUniqueLatinName;
  window.createNewgenPlayer = createNewgenPlayer;
  window.processEndOfSeasonRetirements = processEndOfSeasonRetirements;
  window.processLowerRankChurn = processLowerRankChurn;
}
