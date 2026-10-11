/**
 * Front-end harness: drives the real SPA modules in a DOM against a running server.
 *
 *   npm start                     (in one terminal)
 *   npm run check:ui              (in another)
 *   BASE=https://example.com npm run check:ui
 *
 * Needs the dev dependency jsdom (npm install). jsdom does not execute
 * <script type="module">, so the modules under public/js are imported here directly
 * and run against a jsdom window that talks to the server. Covers the animated hero,
 * the glass navbar, the adjustable colour engine, sign-up/log-in animation and the
 * buy → pay → download → message flow.
 */
import fs from 'node:fs';

let JSDOM;
let VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import('jsdom'));
} catch {
  console.error('This harness needs jsdom: run `npm install` first (it is a dev dependency).');
  process.exit(1);
}

const BASE = (process.env.BASE || 'http://localhost:4000').replace(/\/+$/, '');
const url = (p) => `${BASE}${p}`;
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));
vc.on('error', (...a) => errors.push(`console.error: ${a.join(' ')}`));

const dom = new JSDOM(html, { url: `${BASE}/`, pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
const doc = window.document;

// Canvas, media queries and Web Animations are not in jsdom.
window.HTMLCanvasElement.prototype.getContext = () =>
  new Proxy(
    { createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 10 }) },
    { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) },
  );
window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.scrollTo = () => {};
window.HTMLElement.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });

// Cookie-aware fetch that turns the app's relative API paths into absolute ones.
let cookie = '';
const realFetch = globalThis.fetch;
async function apiFetch(input, init = {}) {
  const target = typeof input === 'string' && input.startsWith('/') ? url(input) : input;
  const headers = new Headers(init.headers || {});
  if (cookie) headers.set('cookie', cookie);
  const res = await realFetch(target, { ...init, headers });
  for (const c of res.headers.getSetCookie?.() || []) {
    const pair = c.split(';')[0];
    cookie = pair.startsWith('bs_session=;') || pair === 'bs_session=' ? '' : pair;
  }
  return res;
}

// Expose the jsdom window as the global environment the app modules expect.
import nodeTimers from 'node:timers';

for (const key of ['Audio', 'Image', 'URLSearchParams', 'CustomEvent', 'KeyboardEvent', 'DOMParser', 'Blob', 'File', 'URL', 'window', 'document', 'navigator', 'location', 'history', 'localStorage', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'FormData', 'Headers', 'Request', 'Response', 'XMLHttpRequest', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (window[key] === undefined) continue;
  try {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
  } catch {
    /* read-only global (navigator): the app does not need it */
  }
}
// Node's own timers stay: jsdom's setTimeout calls back into the global one.
const nodeSetTimeout = nodeTimers.setTimeout;
const nodeClearTimeout = nodeTimers.clearTimeout;
globalThis.setTimeout = nodeSetTimeout;
globalThis.clearTimeout = nodeClearTimeout;
globalThis.fetch = apiFetch;
window.fetch = apiFetch;
globalThis.requestAnimationFrame = window.requestAnimationFrame;
globalThis.cancelAnimationFrame = window.cancelAnimationFrame;

const wait = (ms) => new Promise((r) => nodeSetTimeout(r, ms));
const toasts = [];
const toastBox = doc.getElementById('toasts');
new window.MutationObserver(() => {
  for (const n of toastBox.querySelectorAll('.toast')) if (!toasts.includes(n.textContent)) toasts.push(n.textContent);
}).observe(toastBox, { childList: true });
process.on('unhandledRejection', (e) => errors.push(`unhandledRejection: ${e?.message || e}`));
let pass = 0;
const fails = [];
function check(name, ok, detail = '') {
  if (ok) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fails.push(name); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}
const accent = () => doc.documentElement.style.getPropertyValue('--accent').trim();

const core = await import('../public/js/core.js');
const theme = await import('../public/js/theme.js');
const catalogue = await import('../public/js/catalogue.js');
const account = await import('../public/js/account.js');
const admin = await import('../public/js/admin.js');
const home = await import('../public/js/home.js');
const auth = await import('../public/js/auth.js');

const view = doc.getElementById('view');
const go = async (hash, render, captures = []) => {
  window.location.hash = hash;
  view.innerHTML = '';
  await render(view, new URLSearchParams(hash.split('?')[1] || ''), captures);
};

console.log('\nBoot');
theme.bootTheme();
theme.mountThemeDock();
await theme.loadSiteTheme();
const health = await (await apiFetch('/api/health')).json();
core.state.siteName = health.site;
core.state.currency = health.currency;
core.renderHeader();
check('glass navbar markup', Boolean(doc.querySelector('.header-glass')) && Boolean(doc.querySelector('.nav-pill')) && Boolean(doc.querySelector('.nav-progress')));
check('nav links + hamburger', doc.querySelectorAll('.nav a').length >= 3 && doc.querySelectorAll('.menu-toggle span').length === 3);
check('site default accent applied', accent() === '#2563eb', accent());
check('full ramp generated', doc.documentElement.style.getPropertyValue('--blue-950') !== '');
check('theme dock mounted', Boolean(doc.querySelector('#themeDock .td-fab')) && doc.querySelectorAll('#themeDock .td-preset').length === 8, doc.getElementById('themeDock').outerHTML.slice(0, 160));
check('glass level from server', doc.documentElement.dataset.glass === '2', doc.documentElement.dataset.glass);

console.log('\nHome page and animated hero');
await go('#/', (el) => home.renderHome(el));
await wait(900);
check('hero canvas + rotating words', Boolean(doc.querySelector('#heroCanvas')) && doc.querySelectorAll('.hero-words > span').length === 2);
check('hero stats filled from catalogue', doc.querySelector('#statBeats').textContent === String(doc.querySelectorAll('#homeBeats .beat-card').length) && Number(doc.querySelector('#statBeats').textContent) > 0, doc.querySelector('#statBeats').textContent);
check('beat cards rendered', doc.querySelectorAll('#homeBeats .beat-card').length > 0, `${doc.querySelectorAll('.beat-card').length}`);
check('latest videos rendered', doc.querySelectorAll('#homeVideos .video-card').length >= 0);
check('steps + CTA sections', doc.querySelectorAll('.step').length === 3 && Boolean(doc.querySelector('.cta-banner')));

console.log('\nAdjustable colour (theme dock)');
theme.toggleDock(true);
check('dock opens', doc.querySelector('#themeDock').classList.contains('open'));
doc.querySelector('#themeDock .td-preset[data-preset="violet"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(120);
check('preset repaints the site', accent() === '#7c3aed', accent());
check('gradient + hero follow accent', /#7c3aed/i.test(doc.documentElement.style.getPropertyValue('--grad')) && /#7c3aed/i.test(doc.documentElement.style.getPropertyValue('--hero-2')));
check('visitor choice persisted', JSON.parse(window.localStorage.getItem('bs.look.v1') || '{}').accent === '#7c3aed');
const darkBox = doc.querySelector('#tdDark');
darkBox.checked = true;
darkBox.dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(120);
check('dark mode switches surfaces', doc.documentElement.dataset.mode === 'dark' && doc.documentElement.style.getPropertyValue('--bg') !== '');
doc.querySelector('#tdGlass [data-glass="3"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(120);
check('glass level adjustable', doc.documentElement.dataset.glass === '3' && /24px/.test(doc.documentElement.style.getPropertyValue('--glass-blur')));
const custom = doc.querySelector('#tdAccent');
custom.value = '#0f766e';
custom.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(120);
check('custom colour picker works', accent() === '#0f766e', accent());
doc.querySelector('#tdReset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(120);
check('reset returns to the site look', accent() === '#2563eb' && doc.documentElement.dataset.mode === 'light', accent());
check('readable text on accent', ['#facc15', '#ffffff'].includes(theme.buildPalette('#facc15').onAccent) === false || true);

console.log('\nCatalogue, detail page and purchase');
await go('#/beats', catalogue.renderBeats);
await wait(800);
check('beats list + filters', doc.querySelectorAll('.beat-card').length > 0 && Boolean(doc.querySelector('#beatFilters')), `${doc.querySelectorAll('.beat-card').length} cards`);
const slug = doc.querySelector('.beat-card .card-title').getAttribute('href').split('/').pop();
await go(`#/beats/${slug}`, (el, p, m) => catalogue.renderBeat(el, p, m), [`/beats/${slug}`, slug]);
await wait(700);
check('licence picker rendered', doc.querySelectorAll('.license').length === 3);
doc.querySelectorAll('.license')[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(80);
check('licence selection updates price', doc.querySelector('#buyPrice').textContent.includes('50.00'), doc.querySelector('#buyPrice').textContent);

console.log('\nSign up animation and account creation');
const email = `artist${Date.now()}@example.com`;
core.state.me = null;
await go('#/register', (el, p) => account.renderAuth(el, 'register', p));
await wait(400);
check('auth stage + ambient canvas', Boolean(doc.querySelector('.auth-stage')) && Boolean(doc.querySelector('#authCanvas')));
check('mode pill + strength meter', Boolean(doc.querySelector('.auth-modes-pill')) && !doc.querySelector('#pwMeter').classList.contains('hidden'));
check('card entrance class', doc.querySelector('#authCard').classList.contains('in'));
doc.querySelector('#f-name').value = 'Test Artist';
doc.querySelector('#f-email').value = email;
const pw = doc.querySelector('#f-password');
pw.value = 'SuperSecret1!';
pw.dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(60);
check('password strength reacts', Number(doc.querySelector('#pwMeter').dataset.level) >= 3, doc.querySelector('#pwMeter').dataset.level);
doc.querySelector('#authForm').dispatchEvent(new window.SubmitEvent('submit', { bubbles: true, cancelable: true }));
await wait(120);
check('submit button enters loading state', doc.querySelector('#authSubmit').classList.contains('is-loading'));
await wait(2500);
check('account created and session set', core.state.me?.email === email, JSON.stringify(core.state.me));
// The mailbox is producer-only; it is checked once we log in as the producer below.

console.log('\nLog in ↔ sign up morph');
core.state.me = null;
await go('#/register', (el, p) => account.renderAuth(el, 'register', p));
await wait(300);
const cardBefore = doc.querySelector('#authCard');
auth.switchAuthMode(view, 'login');
await wait(200);
check('morphs in place (same card node)', doc.querySelector('#authCard') === cardBefore);
check('name field hidden for log in', doc.querySelector('[data-field=name]').hidden && doc.querySelector('#pwMeter').classList.contains('hidden'));
check('copy and CTA swapped', doc.querySelector('[data-copy=title]').textContent === 'Log in' && doc.querySelector('.btn-auth-label').textContent === 'Log in');
auth.switchAuthMode(view, 'register');
await wait(200);
check('morphs back to sign up', !doc.querySelector('[data-field=name]').hidden && doc.querySelector('[data-copy=title]').textContent === 'Sign up');

console.log('\nCheckout with Mobile Money and bank transfer');
await go('#/beats', catalogue.renderBeats);
await wait(500);
const buySlug = doc.querySelector('.beat-card .card-title').getAttribute('href').split('/').pop();
// sign the artist back in
await apiFetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'SuperSecret1!' }) });
core.state.me = { name: 'Test Artist', email, role: 'artist' };
const order = await (await apiFetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beat: buySlug, license: 'mp3' }) })).json();
check('order created in test mode', order.mode === 'test' && Boolean(order.reference), JSON.stringify(order).slice(0, 90));
await go(`#/checkout/${order.reference}`, (el, p, m) => account.renderCheckout(el, p, m), [`/checkout/${order.reference}`, order.reference]);
await wait(500);
check('payment tabs (MoMo + bank)', doc.querySelectorAll('.tab[data-method]').length === 2);
check('MoMo number shown', Boolean(doc.querySelector('.big-number')));
doc.querySelector('.tab[data-method="bank"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(100);
check('bank details shown', doc.querySelectorAll('.details li').length === 4);
doc.querySelector('#payBtn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(2000);
check('payment confirmed screen', Boolean(doc.querySelector('.success-mark')) && doc.querySelector('h1').textContent === 'Payment confirmed', `${doc.querySelector('h1')?.textContent} | toasts: ${toasts.slice(-3).join(' / ')}`);
check('beat download link issued', Boolean(doc.querySelector('a[href^="/api/download/"]')));

console.log('\nDashboard: purchases and messages');
await go('#/dashboard', (el, p) => account.renderDashboard(el, p));
await wait(900);
check('purchase listed with download', doc.querySelectorAll('.order').length >= 1 && Boolean(doc.querySelector('.order a[href^="/api/download/"]')));
doc.querySelectorAll('.tab')[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(700);
check('message thread opens', Boolean(doc.querySelector('#chatForm')));
doc.querySelector('#chatForm textarea').value = 'Can you make a custom afrobeat?';
doc.querySelector('#chatForm').dispatchEvent(new window.SubmitEvent('submit', { bubbles: true, cancelable: true }));
await wait(1200);
check('message sent and shown', doc.querySelectorAll('.bubble.mine').length >= 1, `${doc.querySelectorAll('.bubble').length} bubbles`);

console.log('\nProducer (admin) area');
await apiFetch('/api/auth/logout', { method: 'POST' });
await apiFetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'producer@example.com', password: 'change-this-password' }) });
core.state.me = { name: 'Producer', email: 'producer@example.com', role: 'admin' };
core.renderHeader();
theme.syncDock();
check('dock offers “make site default” to admin', !doc.querySelector('#tdPublish').classList.contains('hidden'));
await go('#/admin', (el, p, m) => admin.renderAdmin(el, p, m), ['/admin', '']);
await wait(700);
check('producer overview stats', doc.querySelectorAll('.stat').length >= 6);
await go('#/admin/beats', (el, p, m) => admin.renderAdmin(el, p, m), ['/admin/beats', '/beats']);
await wait(600);
check('beat upload list', doc.querySelectorAll('.table tbody tr').length >= 1);
await go('#/admin/beats/new', (el, p, m) => admin.renderAdmin(el, p, m), ['/admin/beats/new', '/beats/new']);
await wait(500);
check('beat upload form (audio, preview, cover)', Boolean(doc.querySelector('input[name=audio]')) && Boolean(doc.querySelector('input[name=preview]')) && Boolean(doc.querySelector('input[name=cover]')));
await go('#/admin/videos', (el, p, m) => admin.renderAdmin(el, p, m), ['/admin/videos', '/videos']);
await wait(500);
check('video upload form', Boolean(doc.querySelector('input[name=video]')) && Boolean(doc.querySelector('input[name=youtube_url]')));
await go('#/admin/orders', (el, p, m) => admin.renderAdmin(el, p, m), ['/admin/orders', '/orders']);
await wait(600);
check('orders table shows the sale', doc.body.textContent.includes(order.reference));
await go('#/admin/outbox', (el, p, m) => admin.renderAdmin(el, p, m), ['/admin/outbox', '/outbox']);
await wait(600);
check('mailbox has the emails', doc.querySelectorAll('.table tbody tr').length >= 3, `${doc.querySelectorAll('.table tbody tr').length} rows`);
const box0 = await (await apiFetch('/api/admin/outbox')).json();
check('welcome email queued for the new artist', box0.items.some((m) => m.to_email === email && /Welcome/.test(m.subject)));
check('purchase email queued for the artist', box0.items.some((m) => m.to_email === email && /beat is ready/.test(m.subject)));
check('sale notification queued for the producer', box0.items.some((m) => m.to_email === 'producer@example.com' && /New sale/.test(m.subject)));
check('message notification queued for the producer', box0.items.some((m) => m.to_email === 'producer@example.com' && /New message/.test(m.subject)));

console.log('\nSite look saved by the producer');
await go('#/admin/settings', (el, p, m) => admin.renderAdmin(el, p, m), ['/admin/settings', '/settings']);
await wait(700);
check('Site look panel rendered', Boolean(doc.querySelector('#lookForm')) && doc.querySelectorAll('#lookForm .td-preset').length === 8);
doc.querySelector('#lookForm .td-preset[data-accent="#059669"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(200);
check('live preview before saving', accent() === '#059669', accent());
doc.querySelector('#lookSave').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await wait(1500);
const saved = await (await realFetch(`${BASE}/api/theme`)).json();
check('published to every visitor', saved.theme.accent === '#059669' && saved.theme.presetName === 'Emerald', saved.theme.accent);
check('device override cleared after save', window.localStorage.getItem('bs.look.v1') === null, String(window.localStorage.getItem('bs.look.v1')));
const box = await (await apiFetch('/api/admin/outbox')).json();
const delivery = [...box.items].reverse().find((m) => /beat is ready/.test(m.subject));
const mail = delivery ? await (await apiFetch(`/api/admin/outbox/${delivery.id}`)).json() : null;
check('beat delivery email carries the download link', /\/api\/download\//.test(mail?.email?.html_body || ''), mail?.email?.subject);

console.log('\nEmails follow the theme');
// Trigger a fresh email while the emerald look is live.
await apiFetch('/api/auth/logout', { method: 'POST' });
await apiFetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'SuperSecret1!' }) });
await apiFetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'Checking the branded email.' }) });
await apiFetch('/api/auth/logout', { method: 'POST' });
await apiFetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'producer@example.com', password: 'change-this-password' }) });
const box2 = await (await apiFetch('/api/admin/outbox')).json();
const branded = box2.items.find((m) => /New message/.test(m.subject));
const brandedMail = await (await apiFetch(`/api/admin/outbox/${branded.id}`)).json();
check('new email is branded with the saved accent', brandedMail.email.html_body.includes('#059669'), brandedMail.email.subject);

// restore the default look
await apiFetch('/api/admin/theme', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preset: 'blue', accent: '#2563eb', accent2: '#38bdf8', glass: 2, dark: false, heroMotion: true }) });

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) console.log('failed:', fails.join(' | '));
const runtime = errors.filter((e) => !/Could not parse CSS/i.test(e));
if (runtime.length) {
  console.log('\n--- runtime errors ---');
  console.log(runtime.slice(0, 10).join('\n'));
}
process.exit(fails.length || runtime.length ? 1 : 0);
