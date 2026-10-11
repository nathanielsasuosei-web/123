import { api } from './api.js';
import { state, route, render, renderHeader } from './core.js';
import { bootTheme, loadSiteTheme, mountThemeDock, syncDock } from './theme.js';
import { switchAuthMode } from './auth.js';
import { renderHome } from './home.js';
import { renderBeats, renderBeat, renderVideos } from './catalogue.js';
import { renderAuth, renderCheckout, renderDashboard } from './account.js';
import { renderAdmin } from './admin.js';

route(/^\/$/, (el) => renderHome(el));
route(/^\/beats$/, renderBeats);
route(/^\/beats\/([^/]+)$/, renderBeat);
route(/^\/videos$/, renderVideos);
route(/^\/login$/, (el, params) => renderAuth(el, 'login', params));
route(/^\/register$/, (el, params) => renderAuth(el, 'register', params));
route(/^\/checkout\/([^/]+)$/, renderCheckout);
route(/^\/dashboard$/, renderDashboard);
route(/^\/admin(\/.*)?$/, renderAdmin);

/** Log in ↔ sign up morphs the card in place instead of rebuilding the page. */
let authMode = null;
function morphAuth(next) {
  const el = document.getElementById('view');
  if (el.querySelector('#authCard') && authMode && authMode !== next && !el.querySelector('#authSubmit')?.disabled) {
    authMode = next;
    switchAuthMode(el, next);
    return true;
  }
  authMode = next;
  return false;
}

async function boot() {
  // Colours first: paint the saved look, then pull the producer's site default.
  bootTheme();
  mountThemeDock();

  const [me, health] = await Promise.all([
    api('/api/auth/me').catch(() => ({ user: null })),
    api('/api/health').catch(() => null),
    loadSiteTheme(),
  ]);
  state.me = me.user || null;
  if (health) {
    state.siteName = health.site || state.siteName;
    state.currency = health.currency || state.currency;
  }
  document.title = state.siteName;
  if (state.me?.role === 'admin') syncDock();
  renderHeader();
  window.addEventListener('hashchange', () => {
    const path = location.hash.replace(/^#/, '').split('?')[0];
    const next = path === '/login' ? 'login' : path === '/register' ? 'register' : null;
    if (next && morphAuth(next)) return;
    if (!next) authMode = null;
    render();
  });
  await render();
}

boot();
