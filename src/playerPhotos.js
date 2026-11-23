/**
 * Meta Tennis Tour — портреты игроков (playerPhotos.js)
 * Главные игроки тура получают авторские фотопортреты из public/players/,
 * любой остальной игрок — детерминированную портретную карточку в палитре его страны,
 * а загруженное пользователем фото всегда имеет приоритет над обоими вариантами.
 */
import { getCountryMeta } from './countryFlags.js';

export const BUNDLED_PLAYER_PHOTOS = {
  p_22: { slug: 'ussistian-shifter', name: 'Ussistian Shifter' },
  p_2: { slug: 'will-wentra', name: 'Will Wentra' },
  p_3: { slug: 'max-kyupan', name: 'Max Kyupan' },
  p_6: { slug: 'gary-riffay', name: 'Gary Riffay' },
  p_28: { slug: 'francolin-memso-gul', name: 'Francolin Memso Gul' },
  p_12: { slug: 'pen-klak', name: 'Pen Klak' },
  p_63: { slug: 'garry-cokalsa', name: 'Garry Cokalsa' },
  p_292: { slug: 'preston-vance', name: 'Preston Vance' },
  p_45: { slug: 'chen-cnang', name: 'Chen Cnang' },
  p_1: { slug: 'istep-fofol', name: 'Istep Fofol' }
};

const PHOTO_BY_NAME = new Map(
  Object.entries(BUNDLED_PLAYER_PHOTOS).map(([id, meta]) => [
    String(meta.name).trim().toLowerCase().replace(/\s+/g, ' '),
    { id, ...meta }
  ])
);

const COUNTRY_PALETTES = {
  USA: ['#27408b', '#b31942'],
  NOR: ['#ba0c2f', '#00205b'],
  GEO: ['#d0342c', '#8f1d16'],
  SVK: ['#0b4ea2', '#ee1c25'],
  SLO: ['#005da4', '#ed1c24'],
  GBR: ['#012169', '#c8102e'],
  ESP: ['#aa151b', '#f1bf00'],
  BRA: ['#009c3b', '#ffdf00'],
  KOR: ['#cd2e3a', '#0047a0'],
  FRA: ['#002395', '#ed2939'],
  ITA: ['#0066cc', '#008c45'],
  GER: ['#151515', '#dd0000'],
  ARG: ['#74acdf', '#f6b40e'],
  AUS: ['#00843d', '#ffcd00'],
  CAN: ['#d80621', '#8f001a'],
  JPN: ['#bc002d', '#5c0015'],
  CHN: ['#de2910', '#ffde00'],
  RUS: ['#0039a6', '#d52b1e'],
  UKR: ['#0057b7', '#ffd700'],
  POL: ['#dc143c', '#8f0f28'],
  CRO: ['#ff0000', '#171796'],
  SRB: ['#c6363c', '#0c4076'],
  SUI: ['#da291c', '#8f1a12'],
  NED: ['#ae1c28', '#21468b'],
  BEL: ['#fdda24', '#ef3340'],
  AUT: ['#ed2939', '#7a1520'],
  DEN: ['#c60c30', '#7a071e'],
  SWE: ['#006aa7', '#fecc00'],
  FIN: ['#003580', '#00224f'],
  CZE: ['#11457e', '#d7141a'],
  HUN: ['#436f4d', '#cd2a3e'],
  GRE: ['#0d5eaf', '#08386b'],
  POR: ['#046a38', '#da291c'],
  BUL: ['#00966e', '#d62612'],
  ROU: ['#002b7f', '#fcd116'],
  KAZ: ['#00afca', '#fec50c'],
  UZB: ['#0099b5', '#1eb53a'],
  IND: ['#ff9933', '#138808'],
  RSA: ['#007749', '#ffb81c'],
  MEX: ['#006847', '#ce1126'],
  COL: ['#fcd116', '#003893'],
  CHI: ['#d52b1e', '#0039a6'],
  PER: ['#d91023', '#8f0a16'],
  ECU: ['#ffdd00', '#034ea2'],
  URU: ['#7b9fd4', '#fcd116'],
  NZL: ['#00247d', '#cc142b'],
  IRL: ['#169b62', '#ff883e'],
  ISL: ['#02529c', '#dc1e35'],
  LAT: ['#9e3039', '#6b1f26'],
  LTU: ['#006a44', '#fdb913'],
  EST: ['#0072ce', '#1a1a1a'],
  BLR: ['#ce1720', '#007c30'],
  MDA: ['#0046ae', '#ffd200'],
  ARM: ['#d90012', '#0033a0'],
  AZE: ['#0098c3', '#ef3340'],
  TUR: ['#e30a17', '#8f0610'],
  ISR: ['#0038b8', '#002269'],
  EGY: ['#ce1126', '#c09300'],
  MAR: ['#c1272d', '#006233'],
  TUN: ['#e70013', '#8f000c'],
  ALG: ['#006233', '#d21034'],
  GHA: ['#ce1126', '#fcd116'],
  CMR: ['#007a5e', '#ce1126'],
  CIV: ['#f77f00', '#009e60'],
  KEN: ['#006600', '#bb0000'],
  JAM: ['#009b3a', '#fed100'],
  CUB: ['#002a8f', '#cb1515'],
  DOM: ['#002d62', '#ce1126'],
  CRC: ['#002b7f', '#ce1126'],
  GUA: ['#4997d0', '#436f4d'],
  HKG: ['#de2910', '#8f1a10'],
  MAS: ['#010066', '#cc0001'],
  INA: ['#ce1126', '#8f0b1c'],
  IRI: ['#239f40', '#da0000'],
  IRQ: ['#ce1126', '#007a3d'],
  KSA: ['#006c35', '#004522'],
  KUW: ['#007a3d', '#ce1126'],
  LBN: ['#ed1c24', '#00a651'],
  LUX: ['#ed2939', '#00a1de'],
  MON: ['#ce1126', '#8f0b1c'],
  MKD: ['#d20000', '#ffe600'],
  MNE: ['#c40308', '#d4af3a'],
  BIH: ['#002395', '#fecb00'],
  KOS: ['#244aa5', '#d0a650'],
  QAT: ['#8a1538', '#5c0e24'],
  UAE: ['#00732f', '#ff0000'],
  PAK: ['#01411c', '#002810'],
  BAN: ['#006a4e', '#f42a41'],
  SRI: ['#8d2029', '#eb7400'],
  THA: ['#a51931', '#2d2a4a'],
  VIE: ['#da251d', '#ffcd00'],
  PHI: ['#0038a8', '#ce1126'],
  TPE: ['#000095', '#fe0000'],
  PRK: ['#024fa2', '#ed1c27'],
  MGL: ['#c4272f', '#015197'],
  TJK: ['#006600', '#cc0000'],
  TKM: ['#00843d', '#d22630'],
  KGZ: ['#e8112d', '#ffef00'],
  AFG: ['#000000', '#d32011'],
  NEP: ['#dc143c', '#003893'],
  MYA: ['#fecb00', '#34b233'],
  CAM: ['#032ea1', '#e00025'],
  LAO: ['#ce1126', '#002868'],
  SIN: ['#ed2939', '#8f1a20'],
  BRU: ['#f7e017', '#cf1126'],
  FIJ: ['#68bfe5', '#002868'],
  PNG: ['#ce1126', '#000000'],
  SAM: ['#ce1126', '#002b7f'],
  TGA: ['#c10000', '#8f0000'],
  VAN: ['#009543', '#d21034'],
  SOL: ['#0051ba', '#215b33'],
  GUM: ['#002868', '#ce1126'],
  ASA: ['#002868', '#ce1126'],
  COK: ['#00247d', '#cc142b'],
  NRU: ['#002b7f', '#ffc61e'],
  TUV: ['#009fde', '#ffcd00'],
  KIR: ['#ce1126', '#fcd116'],
  MHL: ['#003893', '#dd7500'],
  FSM: ['#75b2dd', '#4a86c8'],
  PLW: ['#4aadd6', '#ffde00'],
  TLS: ['#dc241f', '#ffc726'],
  BHU: ['#ff4e12', '#ffd520'],
  MDV: ['#d21034', '#007e3a'],
  SEY: ['#003f87', '#fcd856'],
  MRI: ['#ea2839', '#1a206d'],
  MAD: ['#fc3d32', '#007e3a'],
  MOZ: ['#007168', '#fce100'],
  ZIM: ['#006400', '#ffd200'],
  ZAM: ['#198a00', '#ef7d00'],
  MWI: ['#000000', '#ce1126'],
  BOT: ['#75aadb', '#000000'],
  NAM: ['#003580', '#009543'],
  ANG: ['#cc092f', '#000000'],
  COD: ['#007fff', '#ce1021'],
  CGO: ['#009543', '#fbde4a'],
  GAB: ['#009e60', '#fcd116'],
  GEQ: ['#3e9a00', '#e32118'],
  STP: ['#12ad2b', '#ffce00'],
  CPV: ['#003893', '#cf2027'],
  GNB: ['#ce1126', '#fcd116'],
  GUI: ['#ce1126', '#009460'],
  SLE: ['#1eb53a', '#0072c6'],
  LBR: ['#bf0a30', '#002868'],
  TOG: ['#006a4e', '#ffce00'],
  BEN: ['#008751', '#fcd116'],
  NIG: ['#e05206', '#0db02b'],
  NGA: ['#008751', '#005c37'],
  CHA: ['#002664', '#fecb00'],
  CTA: ['#003082', '#289728'],
  SUD: ['#d21034', '#007229'],
  SSD: ['#0f47af', '#da121a'],
  ETH: ['#078930', '#fcdd09'],
  ERI: ['#ea0437', '#12ad2b'],
  DJI: ['#6ab2e7', '#12ad2b'],
  SOM: ['#4189dd', '#2b6cb0'],
  RWA: ['#00a1de', '#fad201'],
  BDI: ['#ce1126', '#1eb53a'],
  UGA: ['#000000', '#fcdc04'],
  TAN: ['#1eb53a', '#00a3dd'],
  COM: ['#3a75c4', '#ce1126'],
  LES: ['#00209f', '#009543'],
  SWZ: ['#3e5eb9', '#b10c0c'],
  LBA: ['#000000', '#239e46'],
  MTN: ['#006233', '#ffc400'],
  SEN: ['#00853f', '#fdef42'],
  MLI: ['#14b53a', '#fcd116'],
  BFA: ['#ef2b2d', '#009e49'],
  GMB: ['#ce1126', '#0c1c8c'],
  LIB: ['#002868', '#bf0a30'],
  SAA: ['#006233', '#ce1126'],
  YEM: ['#ce1126', '#000000'],
  OMA: ['#db161b', '#008000'],
  JOR: ['#007a3d', '#ce1126'],
  SYR: ['#ce1126', '#007a3d'],
  PLE: ['#000000', '#007a3d'],
  BHR: ['#ce1126', '#8f0b1c'],
  KUW_: ['#007a3d', '#ce1126']
};

const FALLBACK_PALETTES = [
  ['#0f6f6c', '#e0a437'],
  ['#7a3b8f', '#38bdf8'],
  ['#b4532a', '#2dd4bf'],
  ['#1d4ed8', '#f59e0b'],
  ['#be185d', '#34d399'],
  ['#4d7c0f', '#facc15'],
  ['#0e7490', '#fb7185'],
  ['#9f1239', '#7dd3fc']
];

function hashString(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ch = (shift) => {
    const av = (a >> shift) & 255;
    const bv = (b >> shift) & 255;
    return Math.round(av + (bv - av) * t);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

export function getPlayerCountryPalette(flag) {
  const meta = getCountryMeta(flag);
  const code = meta.isUnknown ? null : meta.code;
  if (code && COUNTRY_PALETTES[code]) return COUNTRY_PALETTES[code];
  return FALLBACK_PALETTES[hashString(code || String(flag || '?')) % FALLBACK_PALETTES.length];
}

export function findBundledPhoto(player) {
  if (!player) return null;
  const byId = BUNDLED_PLAYER_PHOTOS[String(player.id)];
  if (byId) return { id: String(player.id), ...byId };
  const key = String(player.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return PHOTO_BY_NAME.get(key) || null;
}

export function resolvePlayerPhoto(player, customDataUrl) {
  const name = String(player?.name || 'Игрок');
  const id = String(player?.id || 'unknown');
  if (typeof customDataUrl === 'string' && customDataUrl.startsWith('data:image/')) {
    return {
      kind: 'custom',
      panel: customDataUrl,
      full: customDataUrl,
      downloadName: `${id}-photo.jpg`,
      alt: `Фото игрока ${name}`
    };
  }
  const bundled = findBundledPhoto(player);
  if (bundled) {
    return {
      kind: 'bundled',
      panel: `players/${bundled.slug}.webp`,
      full: `players/full/${bundled.slug}.png`,
      downloadName: `${bundled.slug}.png`,
      alt: `Портрет игрока ${name}`
    };
  }
  const svg = renderGeneratedPortraitDataUri(player);
  return {
    kind: 'generated',
    panel: svg,
    full: svg,
    downloadName: `${id}-portrait.svg`,
    alt: `Портретная карточка игрока ${name}`
  };
}

const svgCache = new Map();

export function renderGeneratedPortraitDataUri(player) {
  const id = String(player?.id || '?');
  const rank = Number(player?.rank) || 0;
  const cacheKey = `${id}|${rank}|${player?.flag || ''}`;
  if (svgCache.has(cacheKey)) return svgCache.get(cacheKey);

  const name = String(player?.name || 'Player');
  const meta = getCountryMeta(player?.flag);
  const code = meta.isUnknown ? 'MTT' : meta.code;
  const [hueA, hueB] = getPlayerCountryPalette(player?.flag);
  const h = hashString(`${id}:${name}`);
  const variant = h % 3;
  const tilt = (h % 9) - 4;
  const words = name.split(/\s+/).filter(w => /[A-Za-zА-Яа-яЁё]/.test(w));
  const initials = (words.length > 1
    ? words.map(w => (w.match(/[A-Za-zА-Яа-яЁё]/) || [''])[0]).join('')
    : (name.match(/[A-Za-zА-Яа-яЁё]/g) || []).slice(0, 2).join('')
  ).slice(0, 3).toUpperCase() || 'MT';

  const bgTop = mix('#0a1120', hueA, 0.34);
  const bgBottom = mix('#05080f', hueB, 0.22);
  const jersey = mix(hueA, '#0b1220', 0.25);
  const jerseyDark = shade(jersey, 0.55);
  const rim = mix(hueB, '#ffffff', 0.55);
  const skin = ['#e8b98d', '#c98d5e', '#8d5a3b', '#f0c9a4', '#a86a42'][h % 5];
  const skinDark = shade(skin, 0.72);
  const hair = ['#171310', '#2b1d12', '#4a3620', '#6b4a2a', '#0d0b09'][h % 5];

  const headCx = variant === 1 ? 322 : variant === 2 ? 286 : 300;
  const headCy = 316 + (h % 7) - 3;
  const headRx = 78 + (h % 5);
  const headRy = 92 + (h % 4);

  const bust = variant === 1
    ? 'M118 800 C132 606 208 482 302 474 C402 468 470 592 486 800 Z'
    : variant === 2
      ? 'M132 800 C150 618 224 488 300 482 C376 488 452 618 470 800 Z'
      : 'M112 800 C130 600 214 470 300 470 C386 470 470 600 488 800 Z';

  const racket = variant === 1 ? `
    <g transform="rotate(${18 + tilt} 470 620)" opacity="0.9">
      <ellipse cx="470" cy="560" rx="62" ry="80" fill="none" stroke="${rim}" stroke-width="9"/>
      <ellipse cx="470" cy="560" rx="48" ry="66" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2"/>
      <path d="M470 640 L470 760" stroke="${rim}" stroke-width="12" stroke-linecap="round"/>
      <path d="M432 520 L508 600 M508 520 L432 600 M470 494 L470 626 M424 560 L516 560" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
    </g>` : '';

  const cap = variant === 2 ? `
    <g transform="rotate(${tilt} ${headCx} ${headCy})">
      <path d="M${headCx - headRx - 4} ${headCy - 26} A${headRx + 4} ${headRy - 22} 0 0 1 ${headCx + headRx + 4} ${headCy - 26} L${headCx + headRx + 4} ${headCy - 12} L${headCx - headRx - 4} ${headCy - 12} Z" fill="${jerseyDark}"/>
      <path d="M${headCx - headRx - 4} ${headCy - 14} L${headCx - headRx - 52} ${headCy - 4} L${headCx - headRx - 40} ${headCy + 8} L${headCx - headRx + 6} ${headCy - 2} Z" fill="${jerseyDark}"/>
      <path d="M${headCx - headRx - 4} ${headCy - 26} A${headRx + 4} ${headRy - 22} 0 0 1 ${headCx + headRx + 4} ${headCy - 26}" fill="none" stroke="${rim}" stroke-width="3" opacity="0.7"/>
    </g>` : `
    <g transform="rotate(${tilt} ${headCx} ${headCy})">
      <path d="M${headCx - headRx} ${headCy - 18} A${headRx} ${headRy - 30} 0 0 1 ${headCx + headRx} ${headCy - 18} L${headCx + headRx - 6} ${headCy - 40} A${headRx - 10} ${headRy - 44} 0 0 0 ${headCx - headRx + 6} ${headCy - 40} Z" fill="${hair}"/>
    </g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" role="img" aria-label="${esc(name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${bgTop}"/>
      <stop offset="0.55" stop-color="${mix(bgTop, bgBottom, 0.6)}"/>
      <stop offset="1" stop-color="${bgBottom}"/>
    </linearGradient>
    <radialGradient id="spot" cx="0.5" cy="0.16" r="0.75">
      <stop offset="0" stop-color="${rim}" stop-opacity="0.30"/>
      <stop offset="0.5" stop-color="${rim}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${rim}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="jersey" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${mix(jersey, '#ffffff', 0.16)}"/>
      <stop offset="0.5" stop-color="${jersey}"/>
      <stop offset="1" stop-color="${jerseyDark}"/>
    </linearGradient>
    <linearGradient id="skinG" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0" stop-color="${mix(skin, '#ffffff', 0.18)}"/>
      <stop offset="0.62" stop-color="${skin}"/>
      <stop offset="1" stop-color="${skinDark}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#04060c" stop-opacity="0"/>
      <stop offset="1" stop-color="#04060c" stop-opacity="0.88"/>
    </linearGradient>
    <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" fill="rgba(255,255,255,0.05)"/>
    </pattern>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.05 0"/></filter>
  </defs>
  <rect width="600" height="800" fill="url(#bg)"/>
  <g stroke="rgba(255,255,255,0.06)" fill="none" stroke-width="2">
    <circle cx="${80 + (h % 60)}" cy="${700 - (h % 40)}" r="290"/>
    <circle cx="${520 - (h % 50)}" cy="${120 + (h % 30)}" r="210"/>
    <path d="M-40 ${520 + tilt * 6} L640 ${430 + tilt * 6}"/>
    <path d="M-40 ${560 + tilt * 6} L640 ${470 + tilt * 6}"/>
  </g>
  <rect width="600" height="800" fill="url(#dots)"/>
  <rect width="600" height="800" fill="url(#spot)"/>
  <text x="300" y="760" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="300" font-weight="900" fill="rgba(255,255,255,0.055)">${rank > 0 ? rank : '•'}</text>
  ${racket}
  <g transform="rotate(${tilt * 0.4} 300 620)">
    <path d="${bust}" fill="url(#jersey)"/>
    <path d="${bust}" fill="none" stroke="${rim}" stroke-width="2.5" opacity="0.35"/>
    <path d="M262 478 L300 528 L338 478 L322 470 L300 496 L278 470 Z" fill="${mix(hueB, '#ffffff', 0.7)}" opacity="0.9"/>
    <path d="M150 690 C210 660 390 660 452 690 L452 712 C390 682 210 682 150 712 Z" fill="${hueB}" opacity="0.55"/>
    <rect x="272" y="360" width="56" height="140" rx="24" fill="url(#skinG)"/>
    <ellipse cx="${headCx}" cy="${headCy}" rx="${headRx}" ry="${headRy}" fill="url(#skinG)"/>
    <ellipse cx="${headCx}" cy="${headCy}" rx="${headRx}" ry="${headRy}" fill="none" stroke="${rim}" stroke-width="2" opacity="0.4"/>
    <path d="M${headCx - 30} ${headCy + 8} q10 6 20 0 M${headCx + 12} ${headCy + 8} q10 6 20 0" stroke="${skinDark}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>
    <path d="M${headCx - 12} ${headCy + 44} q12 8 26 0" stroke="${skinDark}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.7"/>
    ${cap}
    <text x="300" y="700" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="76" font-weight="900" letter-spacing="6" fill="rgba(255,255,255,0.92)">${esc(initials)}</text>
  </g>
  <rect y="620" width="600" height="180" fill="url(#scrim)"/>
  <rect x="0" y="744" width="600" height="56" fill="rgba(4,6,12,0.72)"/>
  <rect x="0" y="744" width="6" height="56" fill="${hueB}"/>
  <text x="300" y="772" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="800" letter-spacing="6" fill="${mix(hueB, '#ffffff', 0.6)}">${esc(code)}</text>
  <text x="300" y="792" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="600" letter-spacing="3" fill="rgba(255,255,255,0.5)">META TENNIS TOUR</text>
  <rect width="600" height="800" filter="url(#grain)" opacity="0.5"/>
</svg>`;

  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (svgCache.size > 600) svgCache.clear();
  svgCache.set(cacheKey, uri);
  return uri;
}

const KIND_LABELS = {
  bundled: { chip: 'Фото тура', sub: 'Авторский портрет игрока' },
  custom: { chip: 'Ваше фото', sub: 'Загружено локально на этом устройстве' },
  generated: { chip: 'Авто-портрет', sub: 'Карточка в палитре страны · фото не загружено' }
};

export function renderPlayerPortraitHtml(player, opts = {}) {
  const photo = resolvePlayerPhoto(player, opts.custom);
  const id = String(player?.id || '');
  const name = String(player?.name || 'Игрок');
  const meta = getCountryMeta(player?.flag);
  const country = meta.isUnknown ? 'Страна не указана' : meta.ru;
  const rankLabel = opts.rankLabel || (Number(player?.rank) > 0 ? `ATP #${player.rank}` : 'Без ранга');
  const labels = KIND_LABELS[photo.kind];
  const uploadLabel = photo.kind === 'custom' ? 'Заменить фото' : 'Загрузить фото';
  return `
    <figure class="player-portrait" data-photo-kind="${photo.kind}">
      <button type="button" class="player-portrait-frame" onclick="openPlayerPhotoLightbox('${esc(id)}')"
        title="Открыть портрет крупно" aria-label="Открыть портрет игрока ${esc(name)} крупно">
        <img class="player-portrait-img" src="${esc(photo.panel)}" alt="${esc(photo.alt)}" decoding="async">
        <span class="player-portrait-scrim" aria-hidden="true"></span>
        <span class="player-portrait-top" aria-hidden="true">
          <span class="player-portrait-chip rank">${esc(rankLabel)}</span>
          <span class="player-portrait-chip kind">${labels.chip}</span>
        </span>
        <span class="player-portrait-caption">
          <span class="player-portrait-name">${esc(name)}</span>
          <span class="player-portrait-sub">${esc(country)} · ${labels.sub}</span>
        </span>
        <span class="player-portrait-zoom" aria-hidden="true">🔍</span>
      </button>
      <figcaption class="player-portrait-actions">
        <button type="button" class="portrait-action-btn" onclick="triggerPlayerPhotoUpload('${esc(id)}')" title="Сохранить своё фото этого игрока на устройстве">📷 ${uploadLabel}</button>
        ${photo.kind === 'custom' ? `<button type="button" class="portrait-action-btn ghost" onclick="resetPlayerPhoto('${esc(id)}')" title="Убрать загруженное фото">↺ Сброс</button>` : ''}
        <a class="portrait-action-btn ghost" href="${esc(photo.full)}" download="${esc(photo.downloadName)}" title="Скачать портрет в текущем виде">⬇</a>
      </figcaption>
    </figure>
  `;
}