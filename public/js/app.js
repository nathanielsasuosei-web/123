import { api } from './api.js';
import { state, route, render, renderHeader } from './core.js';
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

async function boot() {
  const [me, health] = await Promise.all([
    api('/api/auth/me').catch(() => ({ user: null })),
    api('/api/health').catch(() => null),
  ]);
  state.me = me.user || null;
  if (health) {
    state.siteName = health.site || state.siteName;
    state.currency = health.currency || state.currency;
  }
  document.title = state.siteName;
  renderHeader();
  window.addEventListener('hashchange', render);
  await render();
}

boot();
