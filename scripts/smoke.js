/**
 * End-to-end test against a running server.
 *
 *   npm start                     # in one terminal (after `npm run seed`)
 *   npm run smoke                 # in another
 *
 * Env: SMOKE_URL (default http://localhost:4000),
 *      SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD (default: the ADMIN_* values from .env or the seed).
 */
const BASE = (process.env.SMOKE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'producer@example.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'test-pass-123';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Minimal cookie jar so each "user" keeps its own session. */
function session() {
  let cookie = '';
  return {
    async req(path, { method = 'GET', json, form, raw } = {}) {
      const headers = {};
      if (cookie) headers.cookie = cookie;
      let body;
      if (json !== undefined) {
        headers['content-type'] = 'application/json';
        body = JSON.stringify(json);
      } else if (form) {
        body = form;
      } else if (raw !== undefined) {
        body = raw.body;
        headers['content-type'] = raw.type;
      }
      const res = await fetch(`${BASE}${path}`, { method, headers, body, redirect: 'manual' });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie && setCookie.startsWith('bs_session=')) cookie = setCookie.split(';')[0];
      const type = res.headers.get('content-type') || '';
      const data = type.includes('application/json') ? await res.json() : await res.text();
      return { status: res.status, data, headers: res.headers };
    },
  };
}

// Tiny valid WAV (silence, 0.1 s) for uploads.
function tinyWav() {
  const samples = 2205;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(22050, 24); buf.writeUInt32LE(44100, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  console.log(`\nSmoke test against ${BASE}\n`);

  // ── Public site ───────────────────────────────────────────────────────────
  console.log('Public site');
  const anon = session();
  const health = await anon.req('/api/health');
  check('GET /api/health', health.status === 200 && health.data.ok, `payments=${health.data.payments}, email=${health.data.email}`);

  const home = await anon.req('/');
  check('GET / serves the website', home.status === 200 && String(home.data).includes('Beat Store'));
  const css = await anon.req('/css/styles.css');
  check('Stylesheet loads', css.status === 200);
  const app = await anon.req('/js/app.js');
  check('Front-end script loads', app.status === 200);

  const list = await anon.req('/api/beats');
  check('Catalogue lists beats', list.status === 200 && list.data.items.length > 0, `${list.data.items.length} beat(s)`);
  const beat = list.data.items[0];
  if (!beat) throw new Error('No beats found. Run `npm run seed` first.');

  const detail = await anon.req(`/api/beats/${beat.slug}`);
  check('Beat detail page data', detail.status === 200 && detail.data.beat.prices.wav > 0, beat.title);
  check('Preview is public, full file is not', !!beat.previewUrl && !String(beat.previewUrl).includes('audio/'));

  const preview = await anon.req(beat.previewUrl);
  check('Preview audio streams', preview.status === 200);

  const fullAttempt = await anon.req(`/media/audio/${beat.slug}.wav`);
  check('Full beat not reachable via /media', fullAttempt.status === 404);

  const unauthOrder = await anon.req('/api/orders', { method: 'POST', json: { beat: beat.slug, license: 'mp3' } });
  check('Buying requires login', unauthOrder.status === 401);

  // ── Artist account & purchase ─────────────────────────────────────────────
  console.log('\nArtist');
  const artist = session();
  const email = `artist+${Date.now()}@example.com`;
  const reg = await artist.req('/api/auth/register', { method: 'POST', json: { name: 'Test Artist', email, password: 'artist-pass-1' } });
  check('Artist can sign up', reg.status === 201, email);
  const dup = await anon.req('/api/auth/register', { method: 'POST', json: { name: 'X', email, password: 'artist-pass-1' } });
  check('Duplicate email is rejected', dup.status === 409);
  const me = await artist.req('/api/auth/me');
  check('Session is kept', me.data.user?.email === email);

  const order = await artist.req('/api/orders', { method: 'POST', json: { beat: beat.slug, license: 'wav' } });
  check('Create an order (WAV lease)', order.status === 201 && !!order.data.reference, order.data.amountLabel);
  const ref = order.data.reference;
  check('Checkout mode is set', ['test', 'paystack'].includes(order.data.mode), order.data.mode);

  const pending = await artist.req(`/api/orders/${ref}`);
  check('Order starts as pending', pending.data.order.status === 'pending');

  const payOther = session();
  await payOther.req('/api/auth/register', { method: 'POST', json: { name: 'Other', email: `other+${Date.now()}@example.com`, password: 'other-pass-1' } });
  const stolen = await payOther.req(`/api/orders/${ref}`);
  check('Other buyers cannot see the order', stolen.status === 404);

  if (order.data.mode === 'test') {
    const paid = await artist.req(`/api/orders/${ref}/test-pay`, { method: 'POST', json: { method: 'mobile_money' } });
    check('Mobile Money payment confirmed (test mode)', paid.status === 200 && paid.data.order.status === 'paid', paid.data.order?.method || '');

    const again = await artist.req(`/api/orders/${ref}/test-pay`, { method: 'POST', json: { method: 'bank' } });
    check('Paying twice does not double-deliver', again.status === 200 && again.data.order.status === 'paid');
  } else {
    console.log('  ! Paystack is configured; skipping the test-mode payment steps.');
  }

  const mine = await artist.req('/api/orders/mine');
  const mineOrder = mine.data.items.find((o) => o.reference === ref);
  check('Dashboard shows the purchase', !!mineOrder);
  if (mineOrder?.status === 'paid') {
    const download = await anon.req(mineOrder.downloadUrl); // the emailed link works without login
    check('Download link delivers the file', download.status === 200, `${download.headers.get('content-type')}`);
    const unknown = await anon.req(`/api/download/${'0'.repeat(48)}`);
    check('Unknown download token is rejected', unknown.status === 404);
  }

  // Messages
  const msg = await artist.req('/api/messages', { method: 'POST', json: { body: 'Hi! Can you make a custom version of this beat?' } });
  check('Artist can send a message', msg.status === 201 && msg.data.items.length === 1);

  // ── Producer (admin) ──────────────────────────────────────────────────────
  console.log('\nProducer (admin)');
  const producer = session();
  const login = await producer.req('/api/auth/login', { method: 'POST', json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  check('Producer can log in', login.status === 200 && login.data.user?.role === 'admin', login.data.error || '');
  if (login.status !== 200) throw new Error('Cannot continue without producer login. Check ADMIN_EMAIL / ADMIN_PASSWORD.');

  const forbidden = await artist.req('/api/admin/stats');
  check('Artists cannot open the admin API', forbidden.status === 403);
  const forbiddenBeat = await artist.req('/api/admin/beats', { method: 'POST', raw: { body: Buffer.from('x'), type: 'text/plain' } });
  check('Artists cannot upload beats', forbiddenBeat.status === 403);

  const stats = await producer.req('/api/admin/stats');
  check('Overview stats load', stats.status === 200, `revenue ${stats.data.revenue}`);

  const form = new FormData();
  form.set('title', 'Smoke Test Beat');
  form.set('genre', 'Afrobeat');
  form.set('mood', 'Test');
  form.set('bpm', '100');
  form.set('key', 'C major');
  form.set('tags', 'smoke, test');
  form.set('price_mp3', '30');
  form.set('price_wav', '50');
  form.set('price_exclusive', '250');
  form.set('published', 'true');
  form.set('audio', new Blob([tinyWav()], { type: 'audio/wav' }), 'smoke.wav');
  form.set('preview', new Blob([tinyWav()], { type: 'audio/wav' }), 'smoke-preview.wav');
  form.set('cover', new Blob([tinyPng], { type: 'image/png' }), 'cover.png');
  const upload = await producer.req('/api/admin/beats', { method: 'POST', form });
  check('Upload a beat with audio, preview and cover', upload.status === 201 && !!upload.data.beat, upload.data.error || '');

  const badForm = new FormData();
  badForm.set('title', 'Bad');
  badForm.set('price_mp3', '10');
  badForm.set('price_wav', '10');
  badForm.set('price_exclusive', '10');
  badForm.set('audio', new Blob([Buffer.from('nope')], { type: 'text/plain' }), 'notes.txt');
  const badUpload = await producer.req('/api/admin/beats', { method: 'POST', form: badForm });
  check('Unsupported file types are rejected', badUpload.status === 400, badUpload.data.error || '');

  const videoForm = new FormData();
  videoForm.set('title', 'Smoke video');
  videoForm.set('youtube_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  videoForm.set('published', 'true');
  const video = await producer.req('/api/admin/videos', { method: 'POST', form: videoForm });
  check('Add a video (YouTube link)', video.status === 201);
  const videos = await anon.req('/api/videos');
  check('Published videos are public', videos.data.items.some((v) => v.title === 'Smoke video'));

  const threads = await producer.req('/api/admin/threads');
  const thread = threads.data.items.find((t) => t.email === email);
  check('Producer sees the artist message', !!thread && thread.unread >= 1);
  if (thread) {
    const reply = await producer.req(`/api/admin/messages/${thread.id}`, { method: 'POST', json: { body: 'Yes, send me the brief!' } });
    check('Producer replies', reply.status === 201);
    const inbox = await artist.req('/api/messages');
    check('Artist receives the reply', inbox.data.items.some((m) => m.sender === 'producer'));
  }

  const outbox = await producer.req('/api/admin/outbox');
  const subjects = outbox.data.items.map((m) => m.subject);
  check('Mailbox records welcome email', subjects.some((s) => s.startsWith('Welcome to')));
  check('Mailbox records the beat delivery email', subjects.some((s) => s.startsWith('Your beat is ready')));
  check('Mailbox records the new-message notification', subjects.some((s) => s.startsWith('New message from')));
  if (order.data.mode === 'test') {
    const deliveries = outbox.data.items.filter((m) => m.subject === `Your beat is ready: ${beat.title}` && m.to_email === email);
    check('Beat delivered exactly once', deliveries.length === 1, `${deliveries.length} email(s)`);
  }

  const badHook = await anon.req('/api/payments/webhook', { method: 'POST', raw: { body: Buffer.from('{}'), type: 'application/json' } });
  check('Webhook rejects unsigned requests', badHook.status === 401);

  const adminOrders = await producer.req('/api/admin/orders?status=all');
  check('Producer sees orders', adminOrders.status === 200 && adminOrders.data.items.length > 0);

  console.log(`\n${passed} passed, ${failed} failed.\n`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err.message);
  process.exit(1);
});
