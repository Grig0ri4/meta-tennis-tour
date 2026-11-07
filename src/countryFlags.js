/**
 * Meta Tennis Tour — Справочник стран и рендеринг графических флагов (countryFlags.js)
 * Поддерживает 3-буквенные коды IOC/ATP/ISO, 2-буквенные коды ISO-2 и русские названия стран.
 */

export const COUNTRY_CATALOG = [
  { code: 'ARG', iso2: 'ar', nameRu: 'Аргентина', nameEn: 'Argentina' },
  { code: 'ARM', iso2: 'am', nameRu: 'Армения', nameEn: 'Armenia' },
  { code: 'AUS', iso2: 'au', nameRu: 'Австралия', nameEn: 'Australia' },
  { code: 'AUT', iso2: 'at', nameRu: 'Австрия', nameEn: 'Austria' },
  { code: 'AZE', iso2: 'az', nameRu: 'Азербайджан', nameEn: 'Azerbaijan' },
  { code: 'BAH', iso2: 'bs', nameRu: 'Багамы', nameEn: 'Bahamas', aliases: ['BHS'] },
  { code: 'BEL', iso2: 'be', nameRu: 'Бельгия', nameEn: 'Belgium' },
  { code: 'BIH', iso2: 'ba', nameRu: 'Босния и Герцеговина', nameEn: 'Bosnia and Herzegovina', aliases: ['BOS'] },
  { code: 'BLR', iso2: 'by', nameRu: 'Беларусь', nameEn: 'Belarus' },
  { code: 'BOL', iso2: 'bo', nameRu: 'Боливия', nameEn: 'Bolivia' },
  { code: 'BRA', iso2: 'br', nameRu: 'Бразилия', nameEn: 'Brazil' },
  { code: 'BUL', iso2: 'bg', nameRu: 'Болгария', nameEn: 'Bulgaria', aliases: ['BGR'] },
  { code: 'CAN', iso2: 'ca', nameRu: 'Канада', nameEn: 'Canada' },
  { code: 'CHI', iso2: 'cl', nameRu: 'Чили', nameEn: 'Chile', aliases: ['CHL'] },
  { code: 'CHN', iso2: 'cn', nameRu: 'Китай', nameEn: 'China', aliases: ['PRC'] },
  { code: 'CIV', iso2: 'ci', nameRu: 'Кот-д’Ивуар', nameEn: 'Ivory Coast' },
  { code: 'CMR', iso2: 'cm', nameRu: 'Камерун', nameEn: 'Cameroon' },
  { code: 'COL', iso2: 'co', nameRu: 'Колумбия', nameEn: 'Colombia' },
  { code: 'CRC', iso2: 'cr', nameRu: 'Коста-Рика', nameEn: 'Costa Rica', aliases: ['CRI'] },
  { code: 'CRO', iso2: 'hr', nameRu: 'Хорватия', nameEn: 'Croatia', aliases: ['HRV'] },
  { code: 'CUB', iso2: 'cu', nameRu: 'Куба', nameEn: 'Cuba' },
  { code: 'CYP', iso2: 'cy', nameRu: 'Кипр', nameEn: 'Cyprus' },
  { code: 'CZE', iso2: 'cz', nameRu: 'Чехия', nameEn: 'Czechia', aliases: ['CZR'] },
  { code: 'DEN', iso2: 'dk', nameRu: 'Дания', nameEn: 'Denmark', aliases: ['DNK'] },
  { code: 'DOM', iso2: 'do', nameRu: 'Доминикана', nameEn: 'Dominican Republic' },
  { code: 'ALG', iso2: 'dz', nameRu: 'Алжир', nameEn: 'Algeria', aliases: ['DZA'] },
  { code: 'ECU', iso2: 'ec', nameRu: 'Эквадор', nameEn: 'Ecuador' },
  { code: 'EGY', iso2: 'eg', nameRu: 'Египет', nameEn: 'Egypt' },
  { code: 'ESP', iso2: 'es', nameRu: 'Испания', nameEn: 'Spain', aliases: ['SPN', 'SPA'] },
  { code: 'EST', iso2: 'ee', nameRu: 'Эстония', nameEn: 'Estonia' },
  { code: 'FIN', iso2: 'fi', nameRu: 'Финляндия', nameEn: 'Finland' },
  { code: 'FRA', iso2: 'fr', nameRu: 'Франция', nameEn: 'France' },
  { code: 'GBR', iso2: 'gb', nameRu: 'Великобритания', nameEn: 'Great Britain', aliases: ['UK', 'ENG', 'SCO', 'WAL', 'NIR'] },
  { code: 'GEO', iso2: 'ge', nameRu: 'Грузия', nameEn: 'Georgia' },
  { code: 'GER', iso2: 'de', nameRu: 'Германия', nameEn: 'Germany', aliases: ['DEU', 'FRG'] },
  { code: 'GHA', iso2: 'gh', nameRu: 'Гана', nameEn: 'Ghana' },
  { code: 'GRE', iso2: 'gr', nameRu: 'Греция', nameEn: 'Greece', aliases: ['GRC', 'ELL'] },
  { code: 'GUA', iso2: 'gt', nameRu: 'Гватемала', nameEn: 'Guatemala', aliases: ['GTM'] },
  { code: 'HKG', iso2: 'hk', nameRu: 'Гонконг', nameEn: 'Hong Kong' },
  { code: 'HUN', iso2: 'hu', nameRu: 'Венгрия', nameEn: 'Hungary' },
  { code: 'INA', iso2: 'id', nameRu: 'Индонезия', nameEn: 'Indonesia', aliases: ['IDN'] },
  { code: 'IND', iso2: 'in', nameRu: 'Индия', nameEn: 'India' },
  { code: 'IRI', iso2: 'ir', nameRu: 'Иран', nameEn: 'Iran', aliases: ['IRN'] },
  { code: 'IRL', iso2: 'ie', nameRu: 'Ирландия', nameEn: 'Ireland', aliases: ['EIR'] },
  { code: 'ISL', iso2: 'is', nameRu: 'Исландия', nameEn: 'Iceland', aliases: ['ICE'] },
  { code: 'ISR', iso2: 'il', nameRu: 'Израиль', nameEn: 'Israel' },
  { code: 'ITA', iso2: 'it', nameRu: 'Италия', nameEn: 'Italy', aliases: ['IT'] },
  { code: 'JAM', iso2: 'jm', nameRu: 'Ямайка', nameEn: 'Jamaica' },
  { code: 'JOR', iso2: 'jo', nameRu: 'Иордания', nameEn: 'Jordan' },
  { code: 'JPN', iso2: 'jp', nameRu: 'Япония', nameEn: 'Japan', aliases: ['JAP'] },
  { code: 'KAZ', iso2: 'kz', nameRu: 'Казахстан', nameEn: 'Kazakhstan' },
  { code: 'KEN', iso2: 'ke', nameRu: 'Кения', nameEn: 'Kenya' },
  { code: 'KGZ', iso2: 'kg', nameRu: 'Кыргызстан', nameEn: 'Kyrgyzstan', aliases: ['KIR'] },
  { code: 'KOR', iso2: 'kr', nameRu: 'Южная Корея', nameEn: 'South Korea', aliases: ['ROK'] },
  { code: 'KOS', iso2: 'xk', nameRu: 'Косово', nameEn: 'Kosovo', aliases: ['XKX'] },
  { code: 'KSA', iso2: 'sa', nameRu: 'Саудовская Аравия', nameEn: 'Saudi Arabia', aliases: ['SAU'] },
  { code: 'KUW', iso2: 'kw', nameRu: 'Кувейт', nameEn: 'Kuwait', aliases: ['KWT'] },
  { code: 'LAT', iso2: 'lv', nameRu: 'Латвия', nameEn: 'Latvia', aliases: ['LVA'] },
  { code: 'LBN', iso2: 'lb', nameRu: 'Ливан', nameEn: 'Lebanon', aliases: ['LIB'] },
  { code: 'LTU', iso2: 'lt', nameRu: 'Литва', nameEn: 'Lithuania', aliases: ['LIT'] },
  { code: 'LUX', iso2: 'lu', nameRu: 'Люксембург', nameEn: 'Luxembourg' },
  { code: 'MAR', iso2: 'ma', nameRu: 'Марокко', nameEn: 'Morocco', aliases: ['MOR'] },
  { code: 'MAS', iso2: 'my', nameRu: 'Малайзия', nameEn: 'Malaysia', aliases: ['MYS'] },
  { code: 'MDA', iso2: 'md', nameRu: 'Молдова', nameEn: 'Moldova', aliases: ['MOL'] },
  { code: 'MEX', iso2: 'mx', nameRu: 'Мексика', nameEn: 'Mexico' },
  { code: 'MKD', iso2: 'mk', nameRu: 'Северная Македония', nameEn: 'North Macedonia', aliases: ['MAC'] },
  { code: 'MLT', iso2: 'mt', nameRu: 'Мальта', nameEn: 'Malta' },
  { code: 'MNE', iso2: 'me', nameRu: 'Черногория', nameEn: 'Montenegro' },
  { code: 'MON', iso2: 'mc', nameRu: 'Монако', nameEn: 'Monaco', aliases: ['MCO'] },
  { code: 'NED', iso2: 'nl', nameRu: 'Нидерланды', nameEn: 'Netherlands', aliases: ['NLD', 'HOL'] },
  { code: 'NGR', iso2: 'ng', nameRu: 'Нигерия', nameEn: 'Nigeria', aliases: ['NGA'] },
  { code: 'NOR', iso2: 'no', nameRu: 'Норвегия', nameEn: 'Norway' },
  { code: 'NZL', iso2: 'nz', nameRu: 'Новая Зеландия', nameEn: 'New Zealand' },
  { code: 'PAK', iso2: 'pk', nameRu: 'Пакистан', nameEn: 'Pakistan' },
  { code: 'PAN', iso2: 'pa', nameRu: 'Панама', nameEn: 'Panama' },
  { code: 'PAR', iso2: 'py', nameRu: 'Парагвай', nameEn: 'Paraguay', aliases: ['PRY'] },
  { code: 'PER', iso2: 'pe', nameRu: 'Перу', nameEn: 'Peru' },
  { code: 'PHI', iso2: 'ph', nameRu: 'Филиппины', nameEn: 'Philippines', aliases: ['PHL'] },
  { code: 'POL', iso2: 'pl', nameRu: 'Польша', nameEn: 'Poland' },
  { code: 'POR', iso2: 'pt', nameRu: 'Португалия', nameEn: 'Portugal', aliases: ['PRT'] },
  { code: 'PUR', iso2: 'pr', nameRu: 'Пуэрто-Рико', nameEn: 'Puerto Rico', aliases: ['PRI'] },
  { code: 'QAT', iso2: 'qa', nameRu: 'Катар', nameEn: 'Qatar' },
  { code: 'ROU', iso2: 'ro', nameRu: 'Румыния', nameEn: 'Romania', aliases: ['ROM'] },
  { code: 'RSA', iso2: 'za', nameRu: 'ЮАР', nameEn: 'South Africa', aliases: ['ZAF', 'SAF'] },
  { code: 'RUS', iso2: 'ru', nameRu: 'Россия', nameEn: 'Russia' },
  { code: 'SEN', iso2: 'sn', nameRu: 'Сенегал', nameEn: 'Senegal' },
  { code: 'SGP', iso2: 'sg', nameRu: 'Сингапур', nameEn: 'Singapore', aliases: ['SIN'] },
  { code: 'SLO', iso2: 'si', nameRu: 'Словения', nameEn: 'Slovenia', aliases: ['SVN'] },
  { code: 'SMR', iso2: 'sm', nameRu: 'Сан-Марино', nameEn: 'San Marino' },
  { code: 'SRB', iso2: 'rs', nameRu: 'Сербия', nameEn: 'Serbia', aliases: ['SER'] },
  { code: 'SUI', iso2: 'ch', nameRu: 'Швейцария', nameEn: 'Switzerland', aliases: ['CHE', 'SWI'] },
  { code: 'SVK', iso2: 'sk', nameRu: 'Словакия', nameEn: 'Slovakia' },
  { code: 'SWE', iso2: 'se', nameRu: 'Швеция', nameEn: 'Sweden' },
  { code: 'SYR', iso2: 'sy', nameRu: 'Сирия', nameEn: 'Syria' },
  { code: 'THA', iso2: 'th', nameRu: 'Таиланд', nameEn: 'Thailand' },
  { code: 'TJK', iso2: 'tj', nameRu: 'Таджикистан', nameEn: 'Tajikistan', aliases: ['TAD'] },
  { code: 'TKM', iso2: 'tm', nameRu: 'Туркменистан', nameEn: 'Turkmenistan' },
  { code: 'TPE', iso2: 'tw', nameRu: 'Тайвань', nameEn: 'Chinese Taipei', aliases: ['TWN', 'TAI'] },
  { code: 'TUN', iso2: 'tn', nameRu: 'Тунис', nameEn: 'Tunisia' },
  { code: 'TUR', iso2: 'tr', nameRu: 'Турция', nameEn: 'Turkey' },
  { code: 'UAE', iso2: 'ae', nameRu: 'ОАЭ', nameEn: 'United Arab Emirates', aliases: ['ARE'] },
  { code: 'UKR', iso2: 'ua', nameRu: 'Украина', nameEn: 'Ukraine' },
  { code: 'URU', iso2: 'uy', nameRu: 'Уругвай', nameEn: 'Uruguay', aliases: ['URG', 'URY'] },
  { code: 'USA', iso2: 'us', nameRu: 'США', nameEn: 'United States' },
  { code: 'UZB', iso2: 'uz', nameRu: 'Узбекистан', nameEn: 'Uzbekistan' },
  { code: 'VEN', iso2: 've', nameRu: 'Венесуэла', nameEn: 'Venezuela' },
  { code: 'VIE', iso2: 'vn', nameRu: 'Вьетнам', nameEn: 'Vietnam', aliases: ['VNM'] },
  { code: 'ZIM', iso2: 'zw', nameRu: 'Зимбабве', nameEn: 'Zimbabwe', aliases: ['ZWE'] }
];

const BY_CODE = new Map();
const BY_NAME = new Map();

COUNTRY_CATALOG.forEach(entry => {
  entry.ru = entry.nameRu;
  entry.en = entry.nameEn;
  BY_CODE.set(entry.code.toUpperCase(), entry);
  BY_CODE.set(entry.iso2.toUpperCase(), entry);
  (entry.aliases || []).forEach(al => BY_CODE.set(al.toUpperCase(), entry));
  BY_NAME.set(entry.nameRu.toLowerCase(), entry);
  BY_NAME.set(entry.nameEn.toLowerCase(), entry);
});

/**
 * Возвращает метаданные страны по коду или названию
 */
export function getCountryMeta(rawFlag) {
  const clean = String(rawFlag || '').trim();
  if (!clean || clean === '?' || clean === '—') {
    return {
      code: '?',
      iso2: null,
      nameRu: 'Страна не указана',
      nameEn: 'Unknown',
      ru: 'Страна не указана',
      en: 'Unknown',
      isUnknown: true
    };
  }
  const upper = clean.toUpperCase();
  const byCode = BY_CODE.get(upper);
  if (byCode) {
    return { ...byCode, ru: byCode.nameRu, en: byCode.nameEn, displayCode: upper.length === 3 ? upper : byCode.code, isUnknown: false };
  }
  const byName = BY_NAME.get(clean.toLowerCase());
  if (byName) {
    return { ...byName, ru: byName.nameRu, en: byName.nameEn, displayCode: byName.code, isUnknown: false };
  }
  // Если введён нестандартный 2-буквенный код, пробуем использовать как iso2
  if (/^[A-Z]{2}$/.test(upper)) {
    return {
      code: upper,
      displayCode: upper,
      iso2: upper.toLowerCase(),
      nameRu: upper,
      nameEn: upper,
      ru: upper,
      en: upper,
      isUnknown: false
    };
  }
  return {
    code: upper,
    displayCode: upper,
    iso2: null,
    nameRu: upper,
    nameEn: upper,
    ru: upper,
    en: upper,
    isUnknown: false
  };
}

/**
 * Нормализует введённую пользователем строку страны к стандартному 3-буквенному коду ATP/IOC
 */
export function normalizeCountryCode(rawInput) {
  const clean = String(rawInput || '').trim();
  if (!clean || clean === '?') return '?';
  // Если выбрано из datalist формата "ESP — Испания"
  const prefixMatch = clean.match(/^([A-Za-z]{2,3})\s*[—\-·(]/);
  if (prefixMatch) {
    const meta = getCountryMeta(prefixMatch[1]);
    return meta.code || prefixMatch[1].toUpperCase();
  }
  const upper = clean.toUpperCase();
  if (BY_CODE.has(upper)) {
    return BY_CODE.get(upper).code;
  }
  const lower = clean.toLowerCase();
  if (BY_NAME.has(lower)) {
    return BY_NAME.get(lower).code;
  }
  return upper;
}

/**
 * Генерирует HTML графического флага + кода страны
 * @param {string} rawFlag - Код страны (например, 'NOR', 'USA', '?')
 * @param {object} opts - Опции отображения ({ showCode: true, compact: false, size: 'md' })
 */
export function renderFlagBadge(rawFlag, opts = {}) {
  const { showCode = true, compact = false } = opts;
  const meta = getCountryMeta(rawFlag);

  if (meta.isUnknown) {
    return `<span class="country-flag-chip country-flag-unknown${compact ? ' flag-compact' : ''}" title="Страна не указана (?)"><span class="country-flag-qmark">?</span>${showCode ? '<b class="country-flag-code">?</b>' : ''}</span>`;
  }

  const shownCode = meta.displayCode || meta.code;
  const tooltip = meta.nameRu && meta.nameRu !== shownCode ? `${meta.nameRu} (${shownCode})` : shownCode;

  if (meta.iso2) {
    const imgUrl = `https://flagcdn.com/w40/${meta.iso2}.png`;
    const img2xUrl = `https://flagcdn.com/w80/${meta.iso2}.png`;
    return `<span class="country-flag-chip${compact ? ' flag-compact' : ''}" title="${tooltip}"><img src="${imgUrl}" srcset="${img2xUrl} 2x" alt="${shownCode}" class="country-flag-img" loading="lazy" onerror="this.style.display='none'">${showCode ? `<b class="country-flag-code">${shownCode}</b>` : ''}</span>`;
  }

  return `<span class="country-flag-chip${compact ? ' flag-compact' : ''}" title="${tooltip}"><span class="country-flag-globe">🌐</span>${showCode ? `<b class="country-flag-code">${shownCode}</b>` : ''}</span>`;
}
