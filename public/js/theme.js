/**
 * Adjustable colour for the whole site.
 *
 * Everything is driven by one accent (plus a second accent for gradients): a ramp of
 * shades and the light/dark surfaces are generated here and written to CSS custom
 * properties on <html>. `public/css/styles.css` only ever reads those variables, so a
 * colour change repaints the navbar, hero, buttons, forms, admin and emails at once.
 *
 * Two layers:
 *   • the producer's saved look, fetched from GET /api/theme (site default for everyone)
 *   • the visitor's own tweaks from the theme dock, kept in localStorage on top of it
 */
import { api } from './api.js';

const KEY = 'bs.look.v1';

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

export const GLASS_LEVELS = [
  { value: 0, name: 'Solid' },
  { value: 1, name: 'Soft' },
  { value: 2, name: 'Glass' },
  { value: 3, name: 'Frosted' },
];

const BASE = { preset: 'blue', accent: PRESETS[0].accent, accent2: PRESETS[0].accent2, dark: false, glass: 2, heroMotion: true };

/** Live look: `site` is what the producer saved, `local` is this visitor's override. */
export const theme = { site: { ...BASE }, local: null, dark: false, ready: false, version: 0 };

const listeners = new Set();
export const onThemeChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** What is on screen right now (the visitor's tweaks win over the site default). */
export const active = () => ({ ...(theme.local ? { ...theme.site, ...theme.local } : theme.site) });

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const pad = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

export function hexToRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export const isHex = (v) => Boolean(hexToRgb(v));
export const toHex = ({ r, g, b }) => `#${pad(r)}${pad(g)}${pad(b)}`;
export const rgbOf = (hex) => {
  const c = hexToRgb(hex) || { r: 37, g: 99, b: 235 };
  return `${c.r},${c.g},${c.b}`;
};

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
  const hn = (((h % 360) + 360) % 360) / 360;
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

export function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  return toHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t });
}

const readableOn = (hex) => {
  const c = hexToRgb(hex);
  if (!c) return '#ffffff';
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.62 ? '#10151f' : '#ffffff';
};

const STEPS = [
  ['50', 96], ['100', 92], ['200', 84], ['300', 72], ['400', 60],
  ['500', 50], ['600', 43], ['700', 36], ['800', 28], ['900', 18], ['950', 11],
];

/** Mirrors server/theme.js so the browser can preview a colour before it is saved. */
export function buildPalette(accent, accent2) {
  const base = isHex(accent) ? accent : BASE.accent;
  const second = isHex(accent2) ? accent2 : mix(base, '#ffffff', 0.4);
  const { h, s } = rgbToHsl(hexToRgb(base));
  const light = {};
  const dark = {};
  for (const [step, target] of STEPS) {
    const sat = clamp(s * (target > 80 ? 1.05 : target < 25 ? 0.82 : 1), 14, 96);
    light[step] = toHex(hslToRgb(h, sat, target));
    dark[step] = toHex(hslToRgb(h, clamp(sat * 1.1, 22, 100), target < 20 ? target + 9 : target));
  }
  light['500'] = base;
  light['600'] = mix(base, '#000000', 0.12);
  light['700'] = mix(base, '#000000', 0.24);
  light['800'] = mix(base, '#000000', 0.38);
  light['900'] = mix(base, '#000000', 0.58);
  light['950'] = mix(base, '#000000', 0.74);
  dark['300'] = mix(base, '#ffffff', 0.34);
  dark['400'] = mix(base, '#ffffff', 0.2);
  dark['500'] = base;
  dark['600'] = mix(base, '#ffffff', 0.08);
  dark['700'] = mix(base, '#000000', 0.14);
  dark['800'] = mix(base, '#000000', 0.34);
  dark['900'] = mix(base, '#000000', 0.6);
  dark['950'] = mix(base, '#000000', 0.78);
  return { accent: base, accent2: second, light, dark, onAccent: readableOn(base) };
}

function surfaces(p, dark) {
  return dark
    ? {
        bg: mix(p.dark['950'], '#05070d', 0.5),
        bg2: mix(p.dark['950'], '#0a0e18', 0.3),
        card: mix(p.dark['900'], '#0d1220', 0.42),
        card2: mix(p.dark['900'], '#151d31', 0.2),
        ink: '#f4f7ff',
        ink2: mix(p.dark['100'], '#ffffff', 0.2),
        muted: mix(p.dark['200'], '#93a0b8', 0.42),
        line: mix(p.dark['700'], '#ffffff', 0.1),
        lineSoft: mix(p.dark['800'], '#ffffff', 0.05),
      }
    : {
        bg: mix(p.light['50'], '#ffffff', 0.45),
        bg2: '#ffffff',
        card: '#ffffff',
        card2: mix(p.light['50'], '#ffffff', 0.6),
        ink: mix(p.light['950'], '#0b1020', 0.55),
        ink2: mix(p.light['900'], '#26303f', 0.45),
        muted: mix(p.light['700'], '#6b7280', 0.55),
        line: mix(p.light['200'], '#ffffff', 0.25),
        lineSoft: mix(p.light['100'], '#ffffff', 0.4),
      };
}

/** Writes the palette to CSS custom properties. Also the theme dock's live preview. */
export function applyTheme(opts = active()) {
  const root = document.documentElement;
  const p = buildPalette(opts.accent, opts.accent2);
  const dark = opts.dark === 'auto' ? window.matchMedia('(prefers-color-scheme: dark)').matches : Boolean(opts.dark);
  const ramp = dark ? p.dark : p.light;
  const s = surfaces(p, dark);
  const glass = clamp(Number(opts.glass) || 0, 0, 3);

  theme.dark = dark;
  theme.version += 1;
  root.dataset.mode = dark ? 'dark' : 'light';
  root.dataset.glass = String(glass);
  root.dataset.motion = opts.heroMotion === false ? 'calm' : 'full';

  const v = {
    '--accent': p.accent,
    '--accent-2': p.accent2,
    '--accent-rgb': rgbOf(p.accent),
    '--accent2-rgb': rgbOf(p.accent2),
    '--on-accent': p.onAccent,
    '--bg': s.bg,
    '--bg-2': s.bg2,
    '--card': s.card,
    '--card-2': s.card2,
    '--ink': s.ink,
    '--ink-2': s.ink2,
    '--muted': s.muted,
    '--line': s.line,
    '--line-soft': s.lineSoft,
    '--grad': `linear-gradient(135deg, ${p.accent} 0%, ${mix(p.accent, p.accent2, 0.55)} 52%, ${mix(p.accent, '#000000', dark ? 0.3 : 0.42)} 100%)`,
    '--grad-soft': `linear-gradient(135deg, ${mix(p.accent, '#ffffff', 0.72)}, ${mix(p.accent2, '#ffffff', 0.6)})`,
    '--hero-1': mix(p.accent, '#000000', dark ? 0.5 : 0.42),
    '--hero-2': p.accent,
    '--hero-3': mix(p.accent, '#000000', dark ? 0.72 : 0.7),
    '--hero-glow': p.accent2,
    '--glass-bg': dark ? `rgba(11,16,28,${[0.96, 0.8, 0.6, 0.42][glass]})` : `rgba(255,255,255,${[0.98, 0.88, 0.66, 0.44][glass]})`,
    '--glass-border': dark ? `rgba(255,255,255,${[0.06, 0.09, 0.13, 0.17][glass]})` : `rgba(255,255,255,${[0.5, 0.6, 0.7, 0.8][glass]})`,
    '--glass-blur': `${[2, 8, 16, 24][glass]}px`,
    '--glass-shadow': dark ? '0 18px 40px -24px rgba(0,0,0,.9)' : `0 18px 40px -26px rgba(${rgbOf(p.light['900'])},.55)`,
    '--nav-ink': dark ? '#eef3ff' : s.ink,
    '--nav-muted': dark ? 'rgba(238,243,255,.7)' : s.muted,
  };
  for (const [step, value] of Object.entries(ramp)) v[`--blue-${step}`] = value;

  for (const [name, value] of Object.entries(v)) root.style.setProperty(name, value);

  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', dark ? v['--hero-3'] : p.accent);
  const icon = document.querySelector('link[rel=icon]');
  if (icon) icon.href = `/favicon.svg?c=${p.accent.slice(1)}&d=${p.accent2.slice(1)}`;

  for (const fn of listeners) {
    try {
      fn(active(), dark);
    } catch {
      /* a listener should never break the paint */
    }
  }
  return active();
}

// ── Persistence ──────────────────────────────────────────────────────────────────
function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    if (isHex(raw.accent)) out.accent = raw.accent;
    if (isHex(raw.accent2)) out.accent2 = raw.accent2;
    if (raw.dark !== undefined) out.dark = Boolean(raw.dark);
    if (raw.glass !== undefined) out.glass = clamp(Number(raw.glass) || 0, 0, 3);
    if (raw.heroMotion !== undefined) out.heroMotion = Boolean(raw.heroMotion);
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/** Paints the stored look immediately, before the first fetch resolves (no flash). */
export function bootTheme() {
  theme.local = readLocal();
  applyTheme();
  theme.ready = true;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (active().dark === 'auto') applyTheme();
  });
}

export async function loadSiteTheme() {
  try {
    const { theme: t } = await api('/api/theme');
    theme.site = {
      preset: t.preset || 'custom',
      presetName: t.presetName,
      accent: t.accent,
      accent2: t.accent2,
      dark: Boolean(t.dark),
      glass: clamp(Number(t.glass) || 0, 0, 3),
      heroMotion: t.heroMotion !== false,
    };
    theme.adminCanEdit = true;
  } catch {
    /* keep the defaults */
  }
  applyTheme();
  return theme.site;
}

/** Records a look the producer just saved, without another round trip. */
export function setSiteLook(saved) {
  theme.site = {
    preset: saved.preset || 'custom',
    presetName: saved.presetName,
    accent: saved.accent,
    accent2: saved.accent2,
    dark: Boolean(saved.dark),
    glass: clamp(Number(saved.glass) || 0, 0, 3),
    heroMotion: saved.heroMotion !== false,
  };
  resetLocal();
  return applyTheme();
}

/** A visitor's tweak: remembered on this device only. */
export function setLocal(patch) {
  const next = { ...active(), ...patch };
  theme.local = {
    accent: next.accent,
    accent2: next.accent2,
    dark: next.dark,
    glass: next.glass,
    heroMotion: next.heroMotion,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(theme.local));
  } catch {
    /* private mode */
  }
  return applyTheme();
}

export function resetLocal() {
  theme.local = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return applyTheme();
}

export const hasLocal = () => Boolean(theme.local);

/** Producer only: makes the current look the site default and brands the emails too. */
export async function publishTheme(patch = {}) {
  const next = { ...active(), ...patch };
  const { theme: saved } = await api('/api/admin/theme', {
    method: 'PUT',
    body: {
      preset: next.preset || 'custom',
      accent: next.accent,
      accent2: next.accent2,
      dark: Boolean(next.dark),
      glass: next.glass,
      heroMotion: next.heroMotion !== false,
    },
  });
  setSiteLook(saved);
  syncDock();
  return theme.site;
}

// ── Theme dock ───────────────────────────────────────────────────────────────────
let dockEl = null;
let dockOpen = localStorage.getItem('bs.dock.open') !== '0';

const swatch = (hex, label) =>
  `<button type="button" class="td-swatch" data-accent="${hex}" style="background:${hex}" title="${label}" aria-label="${label}"></button>`;

function dockMarkup() {
  const t = active();
  return `
    <div class="td-head">
      <span class="td-title">Site colours</span>
      <button type="button" class="td-x" id="tdClose" aria-label="Close colour panel">✕</button>
    </div>
    <div class="td-body">
      <p class="td-label">Presets</p>
      <div class="td-presets">
        ${PRESETS.map((p) => `<button type="button" class="td-preset ${p.accent.toLowerCase() === t.accent.toLowerCase() ? 'on' : ''}" data-preset="${p.id}" data-accent="${p.accent}" data-accent2="${p.accent2}" title="${p.name}"><i style="background:linear-gradient(135deg,${p.accent},${p.accent2})"></i><span>${p.name}</span></button>`).join('')}
      </div>
      <div class="td-row">
        <label class="td-field"><span>Accent</span><input type="color" id="tdAccent" value="${t.accent}" /></label>
        <label class="td-field"><span>Accent 2</span><input type="color" id="tdAccent2" value="${t.accent2}" /></label>
      </div>
      <p class="td-label">Glass navbar</p>
      <div class="td-seg" id="tdGlass">
        ${GLASS_LEVELS.map((g) => `<button type="button" data-glass="${g.value}" class="${Number(t.glass) === g.value ? 'on' : ''}">${g.name}</button>`).join('')}
      </div>
      <div class="td-checks">
        <label class="td-check"><input type="checkbox" id="tdDark" ${t.dark ? 'checked' : ''} /><span>Dark mode</span></label>
        <label class="td-check"><input type="checkbox" id="tdMotion" ${t.heroMotion !== false ? 'checked' : ''} /><span>Hero animation</span></label>
      </div>
      <div class="td-actions">
        <button type="button" class="btn btn-outline btn-sm" id="tdReset">Reset</button>
        <button type="button" class="btn btn-primary btn-sm ${theme.adminCanEdit ? '' : 'hidden'}" id="tdPublish">Make site default</button>
      </div>
      <p class="td-note ${theme.adminCanEdit ? 'hidden' : ''}">Your colours are saved on this device. The producer can set them for everyone.</p>
      <p class="td-note ${theme.adminCanEdit ? '' : 'hidden'}">“Make site default” saves this look for every visitor and brands the emails.</p>
    </div>`;
}

function wireDock() {
  const q = (id) => dockEl.querySelector(id);
  if (!q('#tdClose')) return;
  q('#tdClose').onclick = () => toggleDock(false);
  q('#tdAccent').oninput = (e) => setLocal({ accent: e.target.value, preset: 'custom' });
  q('#tdAccent2').oninput = (e) => setLocal({ accent2: e.target.value, preset: 'custom' });
  q('#tdDark').onchange = (e) => setLocal({ dark: e.target.checked });
  q('#tdMotion').onchange = (e) => setLocal({ heroMotion: e.target.checked });
  q('#tdGlass').onclick = (e) => {
    const btn = e.target.closest('[data-glass]');
    if (btn) setLocal({ glass: Number(btn.dataset.glass) });
  };
  dockEl.querySelectorAll('.td-preset').forEach((btn) => {
    btn.onclick = () => setLocal({ preset: btn.dataset.preset, accent: btn.dataset.accent, accent2: btn.dataset.accent2 });
  });
  dockEl.querySelectorAll('.td-swatch').forEach((btn) => {
    btn.onclick = () => setLocal({ accent: btn.dataset.accent, preset: 'custom' });
  });
  q('#tdReset').onclick = () => {
    resetLocal();
    syncDock();
  };
  const publish = q('#tdPublish');
  if (publish) {
    publish.onclick = async () => {
      publish.disabled = true;
      try {
        await publishTheme();
        publish.textContent = 'Saved ✓';
        setTimeout(() => {
          publish.textContent = 'Make site default';
          publish.disabled = false;
        }, 1800);
      } catch {
        publish.textContent = 'Make site default';
        publish.disabled = false;
      }
    };
  }
}

/** Re-renders the dock panel so it always shows the look currently on screen. */
export function syncDock() {
  const panel = dockEl?.querySelector('.td-panel');
  if (!panel) return;
  panel.innerHTML = dockMarkup();
  wireDock();
}

export function toggleDock(force) {
  if (!dockEl) return;
  dockOpen = force === undefined ? !dockEl.classList.contains('open') : Boolean(force);
  dockEl.classList.toggle('open', dockOpen);
  dockEl.querySelector('.td-fab')?.setAttribute('aria-expanded', String(dockOpen));
  localStorage.setItem('bs.dock.open', dockOpen ? '1' : '0');
}

/** Mounted once at boot; lives outside the router so it survives page changes. */
export function mountThemeDock() {
  if (dockEl) return dockEl;
  dockEl = document.getElementById('themeDock');
  if (!dockEl) {
    dockEl = document.createElement('div');
    dockEl.id = 'themeDock';
    document.body.appendChild(dockEl);
  }
  dockEl.className = `theme-dock${dockOpen ? ' open' : ''}`;
  dockEl.innerHTML = `
    <div class="td-panel" role="dialog" aria-label="Site colours"></div>
    <button type="button" class="td-fab" aria-expanded="${dockOpen}" aria-label="Adjust site colours">
      <span class="td-fab-ring"></span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" fill="currentColor" opacity=".25"/><circle cx="7.5" cy="11" r="1.5" fill="currentColor"/><circle cx="10" cy="7" r="1.5" fill="currentColor"/><circle cx="14.5" cy="7.2" r="1.5" fill="currentColor"/><circle cx="17" cy="10.6" r="1.5" fill="currentColor"/></svg>
    </button>`;
  dockEl.querySelector('.td-fab').onclick = () => toggleDock();
  const panel = dockEl.querySelector('.td-panel');
  panel.addEventListener('click', (e) => {
    if (e.target.closest('#tdClose')) return;
    // A tweak changes the panel's own colours, so repaint it once the change lands.
    requestAnimationFrame(() => syncDock());
  });
  syncDock();
  dockEl.classList.toggle('open', dockOpen);
  return dockEl;
}

/** Quick accent swatches for the admin panel and the auth page backgrounds. */
export const quickSwatches = () => PRESETS.map((p) => swatch(p.accent, p.name)).join('');
