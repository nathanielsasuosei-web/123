import { api, esc, toast } from './api.js';

/** Shared app state. Pages read and update this. */
export const state = { me: null, siteName: 'Beat Store', currency: 'GHS', cleanups: [] };

/** Run `fn` when the user leaves the current page (stop animations, close dialogs). */
export const onLeave = (fn) => state.cleanups.push(fn);

// ── Global preview player ───────────────────────────────────────────────────────
const audio = new Audio();
audio.preload = 'none';
let nowPlaying = null;

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

function drawPlayer() {
  const bar = document.getElementById('playerBar');
  if (!nowPlaying) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');
  const pct = audio.duration ? Math.round((audio.currentTime / audio.duration) * 1000) : 0;
  bar.innerHTML = `
    <button class="icon-btn" id="pbToggle" aria-label="Play or pause">${audio.paused ? '▶' : '❚❚'}</button>
    <div class="pb-meta">
      <div class="pb-title">${esc(nowPlaying.title)}</div>
      <div class="pb-time"><span id="pbCur">${fmt(audio.currentTime)}</span> / <span id="pbDur">${fmt(audio.duration)}</span></div>
    </div>
    <input id="pbSeek" class="pb-seek" type="range" min="0" max="1000" value="${pct}" aria-label="Seek" />
    <button class="icon-btn subtle" id="pbClose" aria-label="Close player">✕</button>`;
  document.getElementById('pbToggle').onclick = () => (audio.paused ? audio.play() : audio.pause());
  document.getElementById('pbClose').onclick = () => {
    audio.pause();
    nowPlaying = null;
    drawPlayer();
  };
  document.getElementById('pbSeek').oninput = (e) => {
    if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration;
  };
}

audio.addEventListener('timeupdate', () => {
  const cur = document.getElementById('pbCur');
  const seek = document.getElementById('pbSeek');
  if (cur) cur.textContent = fmt(audio.currentTime);
  if (seek && audio.duration) seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
});
['play', 'pause', 'loadedmetadata', 'ended'].forEach((ev) => audio.addEventListener(ev, drawPlayer));

/** Plays a beat's preview; clicking the same beat again toggles play/pause. */
export function playPreview(beat) {
  if (!beat.previewUrl) return;
  if (nowPlaying && nowPlaying.slug === beat.slug) {
    if (audio.paused) audio.play();
    else audio.pause();
    return;
  }
  nowPlaying = { slug: beat.slug, title: beat.title };
  audio.src = beat.previewUrl;
  audio.play().catch(() => toast('Your browser blocked playback. Press play again.', 'error'));
  api(`/api/beats/${encodeURIComponent(beat.slug)}/play`, { method: 'POST' }).catch(() => {});
  drawPlayer();
}

// ── Header, footer, router ──────────────────────────────────────────────────────
export function renderHeader() {
  const me = state.me;
  const path = location.hash.replace(/^#/, '').split('?')[0];
  const link = (href, label) =>
    `<a href="#${href}" class="${path === href || (href !== '/' && path.startsWith(`${href}/`)) ? 'active' : ''}">${label}</a>`;
  const right = me
    ? `${me.role === 'admin' ? link('/admin', 'Producer') : link('/dashboard', 'My account')}
       <button class="btn btn-ghost btn-sm" id="logoutBtn">Log out</button>`
    : `${link('/login', 'Log in')}<a href="#/register" class="btn btn-primary btn-sm">Sign up</a>`;

  document.getElementById('siteHeader').innerHTML = `
    <div class="container header-inner">
      <a href="#/" class="brand">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span>${esc(state.siteName)}</span>
      </a>
      <button class="menu-toggle" id="menuToggle" aria-label="Open menu">☰</button>
      <nav class="nav" id="mainNav">
        ${link('/beats', 'Beats')}
        ${link('/videos', 'Videos')}
        ${right}
      </nav>
    </div>`;

  const nav = document.getElementById('mainNav');
  document.getElementById('menuToggle').onclick = () => nav.classList.toggle('open');
  nav.onclick = (e) => e.target.closest('a') && nav.classList.remove('open');
  const logout = document.getElementById('logoutBtn');
  if (logout) {
    logout.onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      state.me = null;
      toast('You are logged out.');
      location.hash = '#/';
      renderHeader();
    };
  }
}

function renderFooter() {
  document.getElementById('siteFooter').innerHTML = `
    <div class="container footer-inner">
      <div><strong>${esc(state.siteName)}</strong><br /><span class="muted">Beats &amp; videos · Pay in GHS by Mobile Money or bank transfer</span></div>
      <div class="muted small">Files are emailed to you and kept in your dashboard.</div>
    </div>`;
}

const routes = [];
export const route = (pattern, handler) => routes.push([pattern, handler]);

export async function render() {
  for (const fn of state.cleanups.splice(0)) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query || '');
  const el = document.getElementById('view');
  renderHeader();
  renderFooter();

  for (const [re, handler] of routes) {
    const match = path.match(re);
    if (!match) continue;
    el.innerHTML = '<div class="loader" aria-label="Loading"></div>';
    window.scrollTo({ top: 0 });
    try {
      await handler(el, params, match);
    } catch (err) {
      el.innerHTML = `<div class="container section"><div class="notice notice-error">${esc(err.message)}</div></div>`;
    }
    return;
  }
  el.innerHTML = `<div class="container section center">
    <h1>Page not found</h1><p class="muted">That page does not exist.</p>
    <a class="btn btn-primary" href="#/">Back to the store</a></div>`;
}
