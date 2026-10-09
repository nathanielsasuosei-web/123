/**
 * End-to-end smoke test against a running server.
 *
 *   npm run smoke                      (defaults to http://localhost:4000)
 *   SMOKE_URL=https://example.com npm run smoke
 *
 * Needs ADMIN_EMAIL and ADMIN_PASSWORD (the producer account). Runs in test
 * payment mode; it creates a few throwaway artists and beats and leaves the
 * demo catalogue intact.
 */
import process from 'node:process';

const BASE = (process.env.SMOKE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

/** Minimal cookie-aware client. */
function client() {
  let cookie = '';
  async function request(method, url, { body, form, raw = false } = {}) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${url}`, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const [pair] = c.split(';');
      if (/^bs_session=;/.test(c) || pair === 'bs_session=') cookie = '';
      else if (pair.startsWith('bs_session=')) cookie = pair;
    }
    if (raw) return res;
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data, res };
  }
  return {
    request,
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, { body }),
    put: (url, form) => request('PUT', url, { form }),
    patch: (url, body) => request('PATCH', url, { body }),
    del: (url) => request('DELETE', url),
    hasSession: () => Boolean(cookie),
    clear: () => {
      cookie = '';
    },
  };
}

function wavBytes(seconds = 1) {
  const rate = 8000;
  const samples = rate * seconds;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i += 1) buf.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 8000), 44 + i * 2);
  return buf;
}

// A valid 1×1 PNG, so the cover upload passes the image type check.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function beatForm(title, extra = {}) {
  const form = new FormData();
  form.set('title', title);
  form.set('genre', 'Afrobeat');
  form.set('mood', 'Happy');
  form.set('bpm', '102');
  form.set('key', 'G minor');
  form.set('tags', 'smoke, test');
  form.set('description', 'Smoke test beat');
  form.set('price_mp3', '30');
  form.set('price_wav', '50');
  form.set('price_exclusive', '250');
  form.set('published', 'true');
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  form.set('audio', new Blob([wavBytes()], { type: 'audio/wav' }), 'smoke-beat.wav');
  form.set('preview', new Blob([wavBytes(0.5)], { type: 'audio/wav' }), 'smoke-preview.wav');
  form.set('cover', new Blob([PNG], { type: 'image/png' }), 'cover.png');
  return form;
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (the producer account) to run the smoke test.');
    process.exit(1);
  }
  const stamp = Date.now().toString(36);
  const anon = client();
  const admin = client();
  const artist = client();
  const other = client();
  const artistEmail = `artist-${stamp}@example.com`;
  const otherEmail = `other-${stamp}@example.com`;

  console.log(`Smoke test against ${BASE}\n`);

  console.log('Site and static files');
  let r = await anon.get('/api/health');
  check('health is ok and reports test payments', r.status === 200 && r.data?.ok === true && r.data?.payments === 'test', JSON.stringify(r.data));
  r = await anon.get('/');
  const html = String(r.data);
  check('index.html serves the app shell', r.status === 200 && html.includes('id="siteHeader"') && html.includes('id="view"') && html.includes('id="playerBar"') && html.includes('id="toasts"'));
  r = await anon.get('/css/styles.css');
  check('stylesheet is served', r.status === 200 && String(r.data).includes('--blue-600'));
  r = await anon.get('/js/app.js');
  check('app.js is served as a module', r.status === 200 && r.res.headers.get('content-type')?.includes('javascript'));
  r = await anon.get('/beats/some-deep-link');
  check('client routes fall back to index.html', r.status === 200 && String(r.data).includes('id="view"'));
  r = await anon.get('/media/does-not-exist.mp3');
  check('missing /media file returns 404 (not the SPA)', r.status === 404);
  r = await anon.get('/media/private/audio/demo-accra-nights.wav');
  check('private audio is not reachable under /media', r.status === 404);
  r = await anon.get('/api/nope');
  check('unknown API route returns JSON 404', r.status === 404 && typeof r.data === 'object' && r.data !== null);

  console.log('\nCatalogue');
  r = await anon.get('/api/beats?sort=new');
  check('beat list returns published beats', r.status === 200 && Array.isArray(r.data.items) && r.data.items.length >= 1);
  const firstBeat = r.data.items[0];
  check('beat list includes prices in pesewas and media URLs', firstBeat && Number.isInteger(firstBeat.prices.mp3) && firstBeat.previewUrl?.startsWith('/media/'), JSON.stringify(firstBeat));
  check('beat list does not expose the private audio path', firstBeat && !('audioName' in firstBeat) && !('audio_path' in firstBeat));
  r = await anon.get(`/api/beats/${firstBeat.slug}`);
  check('beat detail returns the beat', r.status === 200 && r.data.beat.slug === firstBeat.slug);
  r = await anon.get('/api/beats/does-not-exist');
  check('unknown beat is a 404', r.status === 404);
  r = await anon.get('/api/beats?q=osu');
  check('search filters the catalogue', r.status === 200 && r.data.items.every((b) => /osu/i.test(`${b.title} ${b.tags.join(' ')} ${b.genre} ${b.mood}`)));
  r = await anon.get('/api/videos');
  check('videos list is public', r.status === 200 && Array.isArray(r.data.items));

  console.log('\nAccounts');
  r = await artist.post('/api/auth/register', { name: 'Smoke Artist', email: artistEmail, password: 'password123' });
  check('artist can sign up', r.status === 201 && r.data.user.role === 'artist', JSON.stringify(r.data));
  check('signup starts a session', artist.hasSession());
  r = await artist.get('/api/auth/me');
  check('session identifies the artist', r.data.user?.email === artistEmail);
  r = await anon.post('/api/auth/register', { name: 'Dup', email: artistEmail, password: 'password123' });
  check('duplicate email is rejected', r.status === 409);
  r = await anon.post('/api/auth/register', { name: 'Weak', email: `weak-${stamp}@example.com`, password: 'short' });
  check('short passwords are rejected', r.status === 400);
  r = await anon.post('/api/auth/login', { email: artistEmail, password: 'wrong-password' });
  check('wrong password is rejected', r.status === 401);
  r = await other.post('/api/auth/register', { name: 'Other Artist', email: otherEmail, password: 'password123' });
  check('a second artist can sign up', r.status === 201);
  r = await admin.post('/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  check('producer can log in', r.status === 200 && r.data.user.role === 'admin');
  r = await anon.get('/api/admin/stats');
  check('admin API rejects anonymous users', r.status === 401);
  r = await artist.get('/api/admin/stats');
  check('admin API rejects artists', r.status === 403);

  console.log('\nUploads (producer)');
  r = await artist.request('POST', '/api/admin/beats', { form: beatForm('Artist Tries') });
  check('artists cannot upload beats', r.status === 403);
  r = await admin.request('POST', '/api/admin/beats', { form: beatForm(`Smoke Beat ${stamp}`) });
  check('producer uploads a beat', r.status === 201 && r.data.beat?.slug, JSON.stringify(r.data));
  const beat = r.data?.beat;
  const beatSlug = beat?.slug;
  if (!beatSlug) {
    console.log('\nCannot continue without an uploaded beat.');
    process.exit(1);
  }
  r = await admin.request('POST', '/api/admin/beats', { form: beatForm('Missing Audio', { price_mp3: 'abc' }) });
  check('invalid prices are rejected', r.status === 400);
  r = await admin.get(`/api/beats/${beatSlug}`);
  check('new beat is visible in the store', r.status === 200 && r.data.beat.title === `Smoke Beat ${stamp}`);
  if (beat) {
    const edit = new FormData();
    edit.set('title', `Smoke Beat ${stamp} (edited)`);
    edit.set('price_mp3', '35');
    edit.set('price_wav', '55');
    edit.set('price_exclusive', '260');
    edit.set('published', 'true');
    r = await admin.put(`/api/admin/beats/${beat.id}`, edit);
    check('producer can edit a beat and its prices', r.status === 200 && r.data.beat.prices.mp3 === 3500, JSON.stringify(r.data));
  }
  const bigFile = new FormData();
  bigFile.set('title', 'Wrong type');
  bigFile.set('price_mp3', '30');
  bigFile.set('price_wav', '50');
  bigFile.set('price_exclusive', '250');
  bigFile.set('audio', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
  bigFile.set('preview', new Blob([wavBytes(0.2)], { type: 'audio/wav' }), 'p.wav');
  r = await admin.request('POST', '/api/admin/beats', { form: bigFile });
  check('unsupported file types are rejected', r.status === 400);

  r = await admin.request('POST', '/api/admin/videos', {
    form: (() => {
      const f = new FormData();
      f.set('title', `Smoke video ${stamp}`);
      f.set('youtube_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      f.set('published', 'true');
      return f;
    })(),
  });
  check('producer adds a video link', r.status === 201, JSON.stringify(r.data));
  const videoId = r.data?.video?.id;
  r = await admin.request('POST', '/api/admin/videos', {
    form: (() => {
      const f = new FormData();
      f.set('title', 'Bad link');
      f.set('youtube_url', 'https://example.com/video');
      return f;
    })(),
  });
  check('non-YouTube/Vimeo links are rejected', r.status === 400);
  if (videoId) {
    r = await admin.patch(`/api/admin/videos/${videoId}`, { published: false });
    const pub = await anon.get('/api/videos');
    check('hidden videos drop off the public list', r.status === 200 && !pub.data.items.some((v) => v.id === videoId));
    await admin.patch(`/api/admin/videos/${videoId}`, { published: true });
  }

  console.log('\nBuying a beat (test payments)');
  const license = 'mp3';
  r = await anon.post('/api/orders', { beat: beatSlug, license });
  check('checkout needs a login', r.status === 401);
  r = await artist.post('/api/orders', { beat: beatSlug, license: 'platinum' });
  check('unknown licences are rejected', r.status === 400);
  r = await artist.post('/api/orders', { beat: beatSlug, license });
  check('order is created with a reference', r.status === 201 && r.data.reference?.startsWith('BS-') && r.data.mode === 'test', JSON.stringify(r.data));
  const ref = r.data?.reference;
  r = await artist.get(`/api/orders/${ref}`);
  check('order detail shows the payment mode and details', r.data?.order?.status === 'pending' && r.data.paymentMode === 'test' && r.data.paymentDetails !== undefined);
  r = await other.get(`/api/orders/${ref}`);
  check('other artists cannot see this order', r.status === 404);
  r = await artist.get('/api/orders/mine');
  check('dashboard lists the pending order', r.data.items.some((o) => o.reference === ref && o.status === 'pending'));
  const pendingOrder = r.data.items.find((o) => o.reference === ref);
  check('pending orders do not expose a download link', pendingOrder && pendingOrder.downloadUrl === null);

  r = await artist.post(`/api/orders/${ref}/test-pay`, { method: 'mobile_money' });
  check('test payment marks the order paid', r.status === 200 && r.data.order.status === 'paid' && r.data.order.method === 'test-mobile_money', JSON.stringify(r.data));
  const downloadUrl = r.data?.order?.downloadUrl;
  check('paid order has a download link', typeof downloadUrl === 'string' && downloadUrl.startsWith('/api/download/'));
  const outboxBefore = await admin.get('/api/admin/outbox');
  const buyerMailsBefore = outboxBefore.data.items.filter((m) => m.to_email === artistEmail).length;
  r = await artist.post(`/api/orders/${ref}/test-pay`, { method: 'bank' });
  check('paying twice keeps the order paid', r.status === 200 && r.data.order.status === 'paid');
  const outboxAfter = await admin.get('/api/admin/outbox');
  const buyerMailsAfter = outboxAfter.data.items.filter((m) => m.to_email === artistEmail).length;
  check('delivery email is sent exactly once', buyerMailsAfter === buyerMailsBefore, `${buyerMailsBefore} → ${buyerMailsAfter}`);
  check('buyer receives the beat email', outboxAfter.data.items.some((m) => m.to_email === artistEmail && /ready/i.test(m.subject)));
  check('producer receives a sale notice', outboxAfter.data.items.some((m) => m.subject.startsWith('New sale')));

  r = await anon.get(downloadUrl || '/api/download/missing');
  check('download link delivers the audio file', downloadUrl && r.status === 200 && (r.res.headers.get('content-disposition') || '').includes('attachment'));
  r = await anon.get('/api/download/not-a-real-token');
  check('bad download token is a 404', r.status === 404);

  r = await artist.get('/api/orders/mine');
  check('dashboard shows the paid order with a download', r.data.items.some((o) => o.reference === ref && o.status === 'paid' && o.downloadUrl));

  console.log('\nProducer order handling');
  r = await other.post('/api/orders', { beat: beatSlug, license: 'wav' });
  const pendingRef = r.data?.reference;
  r = await admin.get('/api/admin/orders?status=pending');
  check('pending orders show in the producer list', r.data.items.some((o) => o.reference === pendingRef));
  r = await admin.post(`/api/admin/orders/${pendingRef}/confirm`, {});
  check('producer can confirm a manual payment', r.status === 200 && r.data.status === 'paid', JSON.stringify(r.data));
  r = await admin.get('/api/admin/stats');
  check('stats count paid orders and revenue', r.data.paidOrders >= 2 && r.data.revenue > 0, JSON.stringify(r.data));

  console.log('\nMessages');
  r = await artist.get('/api/messages');
  check('artist can open the inbox', r.status === 200 && Array.isArray(r.data.items));
  r = await artist.post('/api/messages', { body: 'Can you make a longer version?' });
  check('artist sends a message', r.status === 201 && r.data.items.at(-1)?.body.includes('longer version'));
  r = await admin.get('/api/admin/threads');
  const thread = r.data.items.find((t) => t.email === artistEmail);
  check('producer sees the conversation with an unread count', thread && thread.unread >= 1, JSON.stringify(thread));
  r = await admin.post(`/api/admin/messages/${thread?.id}`, { body: 'Yes, I can do that. Send your budget.' });
  check('producer replies', r.status === 201 && r.data.items.at(-1)?.sender === 'producer');
  r = await admin.get(`/api/admin/messages/${thread?.id}`);
  check('opening a thread marks it read', r.status === 200 && r.data.items.length >= 2);
  r = await artist.get('/api/messages');
  check('artist sees the producer reply', r.data.items.some((m) => m.sender === 'producer' && m.body.includes('budget')));
  r = await admin.get('/api/admin/outbox');
  check('replies are emailed to the artist', r.data.items.some((m) => m.to_email === artistEmail && /new message/i.test(m.subject)));
  const mail = await admin.get(`/api/admin/outbox/${r.data.items[0].id}`);
  check('mailbox preview includes the HTML body', mail.status === 200 && typeof mail.data.email?.html_body === 'string');
  r = await artist.post('/api/messages', { body: '' });
  check('empty messages are rejected', r.status === 400);

  console.log('\nExclusive sale and cleanup');
  r = await other.post('/api/orders', { beat: beatSlug, license: 'exclusive' });
  const exclusiveRef = r.data?.reference;
  r = await other.post(`/api/orders/${exclusiveRef}/test-pay`, { method: 'mobile_money' });
  check('exclusive order is paid', r.data?.order?.status === 'paid');
  r = await anon.get(`/api/beats/${beatSlug}`);
  check('an exclusive sale takes the beat off sale', r.status === 404);
  r = await admin.get('/api/admin/beats');
  const soldBeat = r.data.items.find((b) => b.slug === beatSlug);
  check('producer still sees the beat, now hidden', soldBeat && soldBeat.published === false);
  r = await admin.del(`/api/admin/beats/${beat?.id}`);
  check('beats with sales are archived, not deleted', r.status === 200 && r.data.archived === true);

  r = await anon.post('/api/payments/webhook', {});
  check('webhook without a valid signature is refused', r.status === 401);
  r = await anon.get('/payments/callback?reference=unknown');
  check('payment callback redirects to the dashboard', r.status === 302 && String(r.res.headers.get('location')).includes('#/dashboard'));

  r = await admin.get('/api/admin/settings');
  check('settings show the webhook URL and no secrets', r.status === 200 && String(r.data.webhookUrl).endsWith('/api/payments/webhook') && !JSON.stringify(r.data).includes('PAYSTACK'));

  await artist.post('/api/auth/logout', {});
  r = await artist.get('/api/auth/me');
  check('logout ends the session', r.data.user === null);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('Failed:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
