/**
 * Site look: one accent colour drives the whole palette.
 *
 * The producer picks a colour (or a preset) in the dashboard and it is stored in the
 * `settings` table. The same palette is served to the browser at GET /api/theme, which
 * turns it into CSS custom properties, and is used to brand the outgoing emails.
 */
import { config } from './config.js';

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export const PRESETS = [
  { id: 'blue', name: 'Studio Blue', accent: '#2563eb', accent2: '#38bdf8' },
  { id: 'violet', name: 'Neon Violet', accent: '#7c3aed', accent2: '#f472b6' },
  { id: 'sunset', name: 'Sunset', accent: '#f97316', accent2: '#ef4444' },
  { id: 'emerald', name: 'Emerald', accent: '#059669', accent2: '#84cc16' },
  { id: 'rose', name: 'Rose Gold', accent: '#e11d48', accent2: '#fb7185' },
  { id: 'teal', name: 'Deep Teal', accent: '#0d9488', accent2: '#22d3ee' },
  { id: 'gold', name: 'Gold Rush', accent: '#b45309', accent2: '#facc15' },
  { id: 'midnight', name: 'Midnight', accent: '#4f46e5', accent2: '#06b6d4' },
];

const DEFAULTS = {
  preset: 'blue',
  accent: PRESETS[0].accent,
  accent2: PRESETS[0].accent2,
  dark: false,
  glass: 2, // 0 = solid, 1 = soft, 2 = full, 3 = frosted
  heroMotion: true,
};

// ── Colour helpers ────────────────────────────────────────────────────────────────
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export const isHex = (value) => Boolean(hexToRgb(value));
export const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const hue = (p, qq, t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (qq - p) * 6 * x;
    if (x < 1 / 2) return qq;
    if (x < 2 / 3) return p + (qq - p) * (2 / 3 - x) * 6;
    return p;
  };
  const qq = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - qq;
  return {
    r: Math.round(hue(p, qq, hn + 1 / 3) * 255),
    g: Math.round(hue(p, qq, hn) * 255),
    b: Math.round(hue(p, qq, hn - 1 / 3) * 255),
  };
}

export const mixHex = (a, b, t) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
};

/** Readable text colour for a background (white or near-black). */
export function readableOn(hex) {
  const c = hexToRgb(hex);
  if (!c) return '#ffffff';
  const luminance = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
  return luminance > 0.62 ? '#10151f' : '#ffffff';
}

export const rgba = (hex, alpha) => {
  const c = hexToRgb(hex);
  return c ? `rgba(${c.r},${c.g},${c.b},${alpha})` : `rgba(37,99,235,${alpha})`;
};

/** Lightness curve for the 50 → 950 steps, tuned so any accent stays usable. */
const STEPS = [
  ['50', 96],
  ['100', 92],
  ['200', 84],
  ['300', 72],
  ['400', 60],
  ['500', 50],
  ['600', 43],
  ['700', 36],
  ['800', 28],
  ['900', 18],
  ['950', 11],
];

/** Builds the full accent ramp plus the neutral surfaces for light and dark mode. */
export function buildPalette(accent, accent2) {
  const base = hexToRgb(accent) ? accent : DEFAULTS.accent;
  const second = hexToRgb(accent2) ? accent2 : mixHex(base, '#ffffff', 0.35);
  const { h, s } = rgbToHsl(hexToRgb(base));
  const { h: h2 } = rgbToHsl(hexToRgb(second));

  const light = {};
  const dark = {};
  for (const [step, target] of STEPS) {
    const sat = clamp(s * (target > 80 ? 1.05 : target < 25 ? 0.8 : 1), 12, 96);
    light[step] = rgbToHex(hslToRgb(h, sat, target));
    dark[step] = rgbToHex(hslToRgb(h, clamp(sat * 1.12, 20, 100), target < 20 ? target + 8 : target));
  }
  // The chosen accent stays the accent: keep 500/600 close to what was picked.
  light['500'] = base;
  light['600'] = mixHex(base, '#000000', 0.12);
  light['700'] = mixHex(base, '#000000', 0.24);
  light['800'] = mixHex(base, '#000000', 0.38);
  light['900'] = mixHex(base, '#000000', 0.58);
  light['950'] = mixHex(base, '#000000', 0.74);
  dark['400'] = mixHex(base, '#ffffff', 0.18);
  dark['500'] = base;
  dark['600'] = mixHex(base, '#ffffff', 0.08);
  dark['900'] = mixHex(base, '#000000', 0.62);
  dark['950'] = mixHex(base, '#000000', 0.78);

  return {
    accent: base,
    accent2: second,
    hue: Math.round(h),
    hue2: Math.round(h2),
    onAccent: readableOn(base),
    light,
    dark,
    surfaces: {
      light: {
        bg: mixHex(light['50'], '#ffffff', 0.45),
        bg2: '#ffffff',
        card: '#ffffff',
        card2: mixHex(light['50'], '#ffffff', 0.6),
        ink: mixHex(light['950'], '#0b1020', 0.55),
        ink2: mixHex(light['900'], '#26303f', 0.45),
        muted: mixHex(light['700'], '#6b7280', 0.55),
        line: mixHex(light['200'], '#ffffff', 0.25),
        lineSoft: mixHex(light['100'], '#ffffff', 0.4),
      },
      dark: {
        bg: mixHex(dark['950'], '#05070d', 0.45),
        bg2: mixHex(dark['950'], '#0a0e18', 0.25),
        card: mixHex(dark['900'], '#0d1220', 0.45),
        card2: mixHex(dark['900'], '#131a2b', 0.3),
        ink: '#f4f7ff',
        ink2: mixHex(dark['100'], '#ffffff', 0.25),
        muted: mixHex(dark['200'], '#93a0b8', 0.45),
        line: mixHex(dark['700'], '#ffffff', 0.12),
        lineSoft: mixHex(dark['800'], '#ffffff', 0.06),
      },
    },
  };
}

// ── Stored theme ──────────────────────────────────────────────────────────────────
let current = { ...DEFAULTS };

export function setTheme(next = {}) {
  const preset = PRESETS.find((p) => p.id === next.preset) ? next.preset : 'custom';
  const accent = isHex(next.accent) ? `#${next.accent.replace(/^#/, '').toLowerCase()}` : DEFAULTS.accent;
  const accent2 = isHex(next.accent2) ? `#${next.accent2.replace(/^#/, '').toLowerCase()}` : mixHex(accent, '#ffffff', 0.35);
  current = {
    preset,
    accent,
    accent2,
    dark: Boolean(next.dark),
    glass: clamp(Number.parseInt(next.glass, 10) || 0, 0, 3),
    heroMotion: next.heroMotion !== false && next.heroMotion !== 'false',
  };
  return getTheme();
}

export function getTheme() {
  const palette = buildPalette(current.accent, current.accent2);
  return {
    ...current,
    presetName: PRESETS.find((p) => p.id === current.preset)?.name || 'Custom',
    palette,
    presets: PRESETS,
    siteName: config.siteName,
    currency: config.currency,
  };
}

/** Compact colour set for the email template (email clients need plain hex). */
export function emailColors() {
  const palette = buildPalette(current.accent, current.accent2);
  return {
    accent: palette.accent,
    accentDark: palette.light['800'],
    accentDeep: palette.light['950'],
    onAccent: palette.onAccent,
    page: palette.light['50'],
    ink: palette.surfaces.light.ink,
    muted: palette.surfaces.light.muted,
    line: palette.light['100'],
  };
}

/** Environment defaults, applied before anything is stored. */
export function themeFromEnv() {
  const accent = str(process.env.THEME_ACCENT) && isHex(process.env.THEME_ACCENT) ? process.env.THEME_ACCENT : '';
  const accent2 = str(process.env.THEME_ACCENT_2) && isHex(process.env.THEME_ACCENT_2) ? process.env.THEME_ACCENT_2 : '';
  const preset = PRESETS.find((p) => p.accent.toLowerCase() === accent.toLowerCase());
  const glass = Number.parseInt(process.env.THEME_GLASS, 10);
  return setTheme({
    preset: preset ? preset.id : DEFAULTS.preset,
    accent: accent || DEFAULTS.accent,
    accent2: accent2 || DEFAULTS.accent2,
    dark: str(process.env.THEME_DARK) === '1',
    glass: Number.isFinite(glass) ? glass : DEFAULTS.glass,
    heroMotion: str(process.env.THEME_HERO_MOTION) !== '0',
  });
}
