import { api, upload, esc, money, dateTime, toast } from './api.js';
import { state } from './core.js';
import { PRESETS, GLASS_LEVELS, setLocal, setSiteLook, syncDock } from './theme.js';

const NAV = [
  ['/admin', 'Overview'],
  ['/admin/beats', 'Beats'],
  ['/admin/videos', 'Videos'],
  ['/admin/orders', 'Orders'],
  ['/admin/messages', 'Messages'],
  ['/admin/outbox', 'Mailbox'],
  ['/admin/settings', 'Settings'],
];

export async function renderAdmin(el, params, match) {
  if (!state.me || state.me.role !== 'admin') {
    el.innerHTML = `<section class="container section narrow center">
      <h1>Producer login</h1>
      <p class="muted">Log in with the producer account to manage the store.</p>
      <a class="btn btn-primary" href="#/login?next=${encodeURIComponent('/admin')}">Log in</a></section>`;
    return;
  }
  const sub = (match[1] || '').replace(/\/$/, '');
  const section = sub.split('/')[1] || '';
  const current = section ? `/admin/${section}` : '/admin';
  el.innerHTML = `
    <div class="container admin-layout">
      <aside class="admin-nav">
        ${NAV.map(([href, label]) => `<a href="#${href}" class="${current === href ? 'active' : ''}">${label}</a>`).join('')}
      </aside>
      <div class="admin-main" id="adminBody"><div class="loader"></div></div>
    </div>`;
  const body = el.querySelector('#adminBody');

  let m;
  if (sub === '') return overview(body);
  if (sub === '/beats') return beatsList(body);
  if (sub === '/beats/new') return beatForm(body, null);
  if ((m = sub.match(/^\/beats\/(\d+)$/))) return beatForm(body, m[1]);
  if (sub === '/videos') return videos(body);
  if (sub === '/orders') return orders(body, params.get('status') || 'all');
  if (sub === '/messages') return messages(body, null);
  if ((m = sub.match(/^\/messages\/(\d+)$/))) return messages(body, m[1]);
  if (sub === '/outbox') return outbox(body);
  if (sub === '/settings') return settings(body);
  body.innerHTML = '<p class="empty">Page not found.</p>';
}

const progressBar = (bar, p) => {
  bar.querySelector('.bar').style.width = `${Math.round(p * 100)}%`;
  bar.querySelector('span').textContent = `Uploading ${Math.round(p * 100)}%`;
};

// ── Overview ─────────────────────────────────────────────────────────────────────
async function overview(body) {
  const s = await api('/api/admin/stats');
  body.innerHTML = `
    <h1>Overview</h1>
    <div class="stats">
      <div class="stat"><span>Revenue</span><strong>${money(s.revenue, s.currency)}</strong></div>
      <div class="stat"><span>Paid orders</span><strong>${s.paidOrders}</strong></div>
      <div class="stat"><span>Awaiting payment</span><strong>${s.pendingOrders}</strong></div>
      <div class="stat"><span>Artists</span><strong>${s.artists}</strong></div>
      <div class="stat"><span>Beats</span><strong>${s.beats}</strong></div>
      <div class="stat"><span>Plays</span><strong>${s.plays}</strong></div>
      <div class="stat"><span>Videos</span><strong>${s.videos}</strong></div>
      <div class="stat accent"><span>Unread messages</span><strong>${s.unreadMessages}</strong></div>
    </div>
    <div class="quick">
      <a class="btn btn-primary" href="#/admin/beats/new">+ Upload a beat</a>
      <a class="btn btn-outline" href="#/admin/videos">Add a video</a>
      <a class="btn btn-outline" href="#/admin/orders?status=pending">Confirm payments</a>
      <a class="btn btn-outline" href="#/admin/messages">Read messages</a>
    </div>`;
}

// ── Beats ───────────────────────────────────────────────────────────────────────
async function beatsList(body) {
  const { items } = await api('/api/admin/beats');
  body.innerHTML = `
    <div class="page-head"><h1>Beats</h1><a class="btn btn-primary" href="#/admin/beats/new">+ Upload a beat</a></div>
    ${items.length ? `
    <div class="table-wrap"><table class="table">
      <thead><tr><th></th><th>Title</th><th>Genre</th><th>BPM</th><th>Prices (GHS)</th><th>Plays</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map((b) => `
        <tr>
          <td>${b.coverUrl ? `<img class="thumb" src="${esc(b.coverUrl)}" alt="" />` : '<div class="thumb cover-fallback"></div>'}</td>
          <td><strong>${esc(b.title)}</strong><div class="muted small">${esc(b.audioName)}</div></td>
          <td>${esc(b.genre)}</td>
          <td>${b.bpm || '–'}</td>
          <td class="small">MP3 ${(b.prices.mp3 / 100).toFixed(2)} · WAV ${(b.prices.wav / 100).toFixed(2)} · Excl ${(b.prices.exclusive / 100).toFixed(2)}</td>
          <td>${b.plays}</td>
          <td><span class="pill ${b.published ? 'pill-ok' : 'pill-wait'}">${b.published ? 'Live' : 'Hidden'}</span></td>
          <td class="actions">
            <a class="btn btn-sm btn-outline" href="#/admin/beats/${b.id}">Edit</a>
            <button class="btn btn-sm btn-danger" data-del="${b.id}" data-title="${esc(b.title)}">Delete</button>
          </td>
        </tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-box"><p>No beats yet.</p><a class="btn btn-primary" href="#/admin/beats/new">Upload your first beat</a></div>'}`;

  body.querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm(`Delete "${btn.dataset.title}"? Beats with sales are hidden instead.`)) return;
      try {
        const res = await api(`/api/admin/beats/${btn.dataset.del}`, { method: 'DELETE' });
        toast(res.archived ? res.message : 'Beat deleted.');
        beatsList(body);
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  });
}

async function beatForm(body, id) {
  let beat = null;
  if (id) {
    beat = (await api('/api/admin/beats')).items.find((b) => String(b.id) === String(id));
    if (!beat) {
      body.innerHTML = '<p class="empty">Beat not found.</p>';
      return;
    }
  }
  const v = beat || { title: '', genre: '', mood: '', bpm: '', key: '', tags: [], description: '', prices: { mp3: 3000, wav: 5000, exclusive: 25000 }, published: true };
  const tags = Array.isArray(v.tags) ? v.tags.join(', ') : v.tags;
  const fileNote = (exists) => (beat ? `<small class="muted">${exists ? 'Keep empty to leave it unchanged' : ''}</small>` : '');
  body.innerHTML = `
    <div class="page-head"><h1>${beat ? 'Edit beat' : 'Upload a beat'}</h1><a class="btn btn-outline" href="#/admin/beats">← Back to beats</a></div>
    <form id="beatForm" class="admin-form card pad">
      <div class="grid-2">
        <label>Title *<input name="title" required maxlength="120" value="${esc(v.title)}" /></label>
        <label>Genre<input name="genre" list="genres" maxlength="60" value="${esc(v.genre)}" placeholder="Afrobeat, Drill, R&amp;B…" /></label>
        <label>Mood<input name="mood" maxlength="60" value="${esc(v.mood)}" placeholder="Dark, Chill, Energetic" /></label>
        <label>BPM<input name="bpm" type="number" min="30" max="300" value="${esc(v.bpm || '')}" /></label>
        <label>Key<input name="key" maxlength="30" value="${esc(v.key)}" placeholder="C minor" /></label>
        <label>Tags (comma separated)<input name="tags" maxlength="300" value="${esc(tags)}" /></label>
      </div>
      <datalist id="genres"><option>Afrobeat</option><option>Amapiano</option><option>Highlife</option><option>Hip hop</option><option>Drill</option><option>R&amp;B</option><option>Trap</option><option>Dancehall</option></datalist>
      <label>Description<textarea name="description" rows="3" maxlength="2000">${esc(v.description)}</textarea></label>

      <h3 class="h4">Prices (GHS)</h3>
      <div class="grid-3">
        <label>MP3 lease *<input name="price_mp3" type="number" min="1" step="0.01" required value="${(v.prices.mp3 / 100).toFixed(2)}" /></label>
        <label>WAV lease *<input name="price_wav" type="number" min="1" step="0.01" required value="${(v.prices.wav / 100).toFixed(2)}" /></label>
        <label>Exclusive *<input name="price_exclusive" type="number" min="1" step="0.01" required value="${(v.prices.exclusive / 100).toFixed(2)}" /></label>
      </div>

      <h3 class="h4">Files</h3>
      <div class="grid-3">
        <label class="file-field">Full beat (WAV or MP3)
          ${beat ? `<small class="muted">Current: ${esc(beat.audioName)}. Keep empty to leave it.</small>` : '<small class="muted">Required. Sent only to buyers.</small>'}
          <input name="audio" type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.flac" ${beat ? '' : 'required'} /></label>
        <label class="file-field">Preview (short MP3 recommended)
          ${beat ? '<small class="muted">Keep empty to leave it.</small>' : '<small class="muted">Required. Plays on the site.</small>'}
          <input name="preview" type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.flac" ${beat ? '' : 'required'} /></label>
        <label class="file-field">Cover art (JPG, PNG or WebP)
          ${fileNote(beat?.coverUrl)}
          <input name="cover" type="file" accept=".jpg,.jpeg,.png,.webp,.gif" /></label>
      </div>
      <label class="check"><input type="checkbox" name="published" ${v.published ? 'checked' : ''} /> Show this beat in the store</label>

      <div class="progress hidden" id="upProgress"><div class="bar"></div><span></span></div>
      <div class="error" id="formError" role="alert"></div>
      <button class="btn btn-primary btn-lg" type="submit">${beat ? 'Save changes' : 'Publish beat'}</button>
    </form>`;

  const form = body.querySelector('#beatForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    fd.set('published', form.querySelector('input[name=published]').checked ? 'true' : 'false');
    for (const name of ['audio', 'preview', 'cover']) {
      const f = fd.get(name);
      if (!f || !f.name) fd.delete(name);
    }
    const bar = body.querySelector('#upProgress');
    const btn = form.querySelector('button[type=submit]');
    bar.classList.remove('hidden');
    btn.disabled = true;
    try {
      await upload(beat ? 'PUT' : 'POST', beat ? `/api/admin/beats/${beat.id}` : '/api/admin/beats', fd, (p) => progressBar(bar, p));
      toast(beat ? 'Beat saved.' : 'Beat published!');
      location.hash = '#/admin/beats';
    } catch (err) {
      form.querySelector('#formError').textContent = err.message;
      bar.classList.add('hidden');
      btn.disabled = false;
    }
  };
}

// ── Videos ─────────────────────────────────────────────────────────────────────
async function videos(body) {
  const { items } = await api('/api/admin/videos');
  body.innerHTML = `
    <h1>Videos</h1>
    <form id="videoForm" class="admin-form card pad">
      <h3 class="h4">Add a video</h3>
      <label>Title *<input name="title" required maxlength="120" /></label>
      <label>Description<textarea name="description" rows="2" maxlength="2000"></textarea></label>
      <div class="grid-3">
        <label class="file-field">Video file (MP4, WebM, MOV)<input name="video" type="file" accept=".mp4,.webm,.mov,.m4v" /><small class="muted">Or paste a link instead</small></label>
        <label>…or YouTube / Vimeo link<input name="youtube_url" type="url" placeholder="https://youtube.com/watch?v=…" /></label>
        <label class="file-field">Thumbnail (optional)<input name="cover" type="file" accept=".jpg,.jpeg,.png,.webp" /></label>
      </div>
      <label class="check"><input type="checkbox" name="published" checked /> Publish now</label>
      <div class="progress hidden" id="upProgress"><div class="bar"></div><span></span></div>
      <div class="error" id="formError" role="alert"></div>
      <button class="btn btn-primary" type="submit">Add video</button>
    </form>

    <h2 class="h3 mt">Videos</h2>
    ${items.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th></th><th>Title</th><th>Source</th><th>Views</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map((v) => `<tr>
        <td>${v.coverUrl ? `<img class="thumb" src="${esc(v.coverUrl)}" alt="" />` : '<div class="thumb cover-fallback"></div>'}</td>
        <td><strong>${esc(v.title)}</strong></td>
        <td class="small">${v.videoUrl ? 'Uploaded file' : 'Link'}</td>
        <td>${v.views}</td>
        <td><span class="pill ${v.published ? 'pill-ok' : 'pill-wait'}">${v.published ? 'Live' : 'Hidden'}</span></td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" data-toggle="${v.id}" data-pub="${v.published ? 0 : 1}">${v.published ? 'Hide' : 'Publish'}</button>
          <button class="btn btn-sm btn-danger" data-del="${v.id}">Delete</button>
        </td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No videos yet.</p>'}`;

  const form = body.querySelector('#videoForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    fd.set('published', form.querySelector('input[name=published]').checked ? 'true' : 'false');
    for (const name of ['video', 'cover']) {
      const f = fd.get(name);
      if (!f || !f.name) fd.delete(name);
    }
    const bar = body.querySelector('#upProgress');
    bar.classList.remove('hidden');
    try {
      await upload('POST', '/api/admin/videos', fd, (p) => progressBar(bar, p));
      toast('Video added.');
      videos(body);
    } catch (err) {
      form.querySelector('#formError').textContent = err.message;
      bar.classList.add('hidden');
    }
  };
  body.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.onclick = async () => {
      await api(`/api/admin/videos/${btn.dataset.toggle}`, { method: 'PATCH', body: { published: btn.dataset.pub === '1' } });
      videos(body);
    };
  });
  body.querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Delete this video?')) return;
      await api(`/api/admin/videos/${btn.dataset.del}`, { method: 'DELETE' });
      videos(body);
    };
  });
}

// ── Orders ──────────────────────────────────────────────────────────────────────
async function orders(body, status) {
  const { items } = await api(`/api/admin/orders?status=${status === 'all' ? '' : status}`);
  body.innerHTML = `
    <h1>Orders</h1>
    <div class="tabs">
      ${[['pending', 'Awaiting payment'], ['paid', 'Paid'], ['all', 'All']].map(([k, label]) => `<a class="tab ${k === status ? 'active' : ''}" href="#/admin/orders?status=${k}">${label}</a>`).join('')}
    </div>
    ${items.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Reference</th><th>Buyer</th><th>Beat</th><th>Licence</th><th>Amount</th><th>Method</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map((o) => `<tr>
        <td class="small mono">${esc(o.reference)}<div class="muted">${dateTime(o.createdAt)}</div></td>
        <td>${esc(o.buyer.name)}<div class="muted small">${esc(o.buyer.email)}</div></td>
        <td>${esc(o.beat)}</td>
        <td>${esc(o.license)}</td>
        <td>${esc(o.amountLabel)}</td>
        <td class="small">${esc(o.method || '–')}</td>
        <td><span class="pill ${o.status === 'paid' ? 'pill-ok' : 'pill-wait'}">${o.status === 'paid' ? 'Paid' : 'Awaiting'}</span></td>
        <td class="actions">${o.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-confirm="${esc(o.reference)}">Mark paid</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="empty">No orders here.</p>'}`;

  body.querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Mark this order as paid and email the beat to the buyer?')) return;
      btn.disabled = true;
      try {
        await api(`/api/admin/orders/${btn.dataset.confirm}/confirm`, { method: 'POST' });
        toast('Order confirmed. The buyer has been emailed.');
        orders(body, status);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
      }
    };
  });
}

// ── Messages ───────────────────────────────────────────────────────────────────
async function messages(body, userId) {
  const { items: threads } = await api('/api/admin/threads');
  const list = threads.length
    ? threads.map((t) => `
      <a class="thread ${String(t.id) === String(userId) ? 'active' : ''}" href="#/admin/messages/${t.id}">
        <div class="thread-top"><strong>${esc(t.name)}</strong>${t.unread ? `<span class="badge">${t.unread}</span>` : ''}</div>
        <div class="muted small">${esc((t.last_body || '').slice(0, 60))}</div>
        <div class="muted small">${dateTime(t.last_at)}</div>
      </a>`).join('')
    : '<p class="empty">No conversations yet.</p>';

  body.innerHTML = `
    <h1>Messages</h1>
    <div class="inbox">
      <div class="thread-list">${list}</div>
      <div class="thread-view" id="threadView">
        ${userId ? '<div class="loader"></div>' : '<p class="empty">Pick a conversation to read and reply.</p>'}
      </div>
    </div>`;
  if (!userId) return;

  const view = body.querySelector('#threadView');
  let data;
  try {
    data = await api(`/api/admin/messages/${userId}`);
  } catch (err) {
    view.innerHTML = `<p class="empty">${esc(err.message)}</p>`;
    return;
  }
  const draw = (items) => {
    view.innerHTML = `
      <div class="thread-head"><strong>${esc(data.user.name)}</strong> <span class="muted small">${esc(data.user.email)}</span></div>
      <div class="chat-log" id="chatLog">${items.map((m) => `
        <div class="bubble ${m.sender === 'producer' ? 'mine' : 'theirs'}">
          <div class="bubble-text">${esc(m.body).replace(/\n/g, '<br>')}</div>
          <div class="bubble-time">${m.sender === 'producer' ? 'You' : esc(data.user.name)} · ${dateTime(m.created_at)}</div>
        </div>`).join('')}</div>
      <form class="chat-form" id="replyForm">
        <textarea name="body" rows="2" maxlength="2000" placeholder="Reply to ${esc(data.user.name)}. They get an email." required></textarea>
        <button class="btn btn-primary" type="submit">Send reply</button>
      </form>`;
    const log = view.querySelector('#chatLog');
    log.scrollTop = log.scrollHeight;
    const replyForm = view.querySelector('#replyForm');
    const replyInput = replyForm.querySelector('textarea[name=body]');
    replyForm.onsubmit = async (e) => {
      e.preventDefault();
      const text = replyInput.value.trim();
      if (!text) return;
      const send = e.currentTarget.querySelector('button[type=submit]');
      send.disabled = true;
      try {
        const res = await api(`/api/admin/messages/${userId}`, { method: 'POST', body: { body: text } });
        replyInput.value = '';
        draw(res.items);
        toast('Reply sent. The artist has been emailed.');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        send.disabled = false;
      }
    };
  };
  draw(data.items);
}

// ── Mailbox ───────────────────────────────────────────────────────────────────
async function outbox(body) {
  const { items } = await api('/api/admin/outbox');
  body.innerHTML = `
    <h1>Mailbox</h1>
    <p class="muted">Every email the store sent or recorded. Click one to preview it.</p>
    ${items.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
      <tbody>${items.map((m) => `<tr class="clickable" data-id="${m.id}">
        <td class="small">${dateTime(m.created_at)}</td><td class="small">${esc(m.to_email)}</td><td>${esc(m.subject)}</td>
        <td><span class="pill ${m.status === 'failed' ? 'pill-bad' : m.status === 'sent' ? 'pill-ok' : 'pill-wait'}">${esc(m.status)}</span></td>
      </tr>`).join('')}</tbody></table></div>
      <div id="mailPreview"></div>` : '<p class="empty">No emails yet. Buy a beat or send a message to see them here.</p>'}`;

  body.querySelectorAll('tr[data-id]').forEach((row) => {
    row.onclick = async () => {
      const { email } = await api(`/api/admin/outbox/${row.dataset.id}`);
      body.querySelector('#mailPreview').innerHTML = `
        <div class="card pad mail-preview">
          <div class="muted small">To: ${esc(email.to_email)}${email.error ? ` · <span class="error">${esc(email.error)}</span>` : ''}</div>
          <h3 class="h4">${esc(email.subject)}</h3>
          <iframe sandbox="" title="Email preview" srcdoc="${esc(email.html_body)}"></iframe>
        </div>`;
    };
  });
}

// ── Settings ────────────────────────────────────────────────────────────────────
async function settings(body) {
  const s = await api('/api/admin/settings');
  const t = s.theme;
  const row = (label, value) => `<li><span>${esc(label)}</span><strong>${esc(value || 'Not set')}</strong></li>`;
  body.innerHTML = `
    <h1>Settings</h1>

    <div class="admin-form card pad" id="lookForm">
      <h3 class="h4">Site look</h3>
      <p class="muted small">One accent colour drives the whole site — navbar, hero, buttons, admin and the emails your artists receive. Changes preview instantly; <strong>Save look</strong> publishes them to every visitor.</p>
      <div class="look-grid">
        <div>
          <p class="td-label">Presets</p>
          <div class="look-presets">
            ${PRESETS.map((p) => `<button type="button" class="td-preset ${p.accent.toLowerCase() === t.accent.toLowerCase() ? 'on' : ''}" data-accent="${p.accent}" data-accent2="${p.accent2}" data-preset="${p.id}"><i style="background:linear-gradient(135deg,${p.accent},${p.accent2})"></i><span>${esc(p.name)}</span></button>`).join('')}
          </div>
          <div class="td-row mt">
            <label class="td-field"><span>Accent</span><input type="color" name="accent" value="${esc(t.accent)}" /></label>
            <label class="td-field"><span>Second colour</span><input type="color" name="accent2" value="${esc(t.accent2)}" /></label>
          </div>
        </div>
        <div>
          <p class="td-label">Glass navbar</p>
          <div class="td-seg" data-seg="glass">
            ${GLASS_LEVELS.map((g) => `<button type="button" data-glass="${g.value}" class="${Number(t.glass) === g.value ? 'on' : ''}">${g.name}</button>`).join('')}
          </div>
          <div class="td-checks mt">
            <label class="td-check"><input type="checkbox" name="dark" ${t.dark ? 'checked' : ''} /><span>Start visitors in dark mode</span></label>
            <label class="td-check"><input type="checkbox" name="heroMotion" ${t.heroMotion !== false ? 'checked' : ''} /><span>Animated hero</span></label>
          </div>
          <div class="look-preview" aria-hidden="true">
            <span class="lp-bar"></span><span class="lp-bar"></span><span class="lp-bar"></span>
            <em>Preview</em>
          </div>
          <div class="cta">
            <button class="btn btn-primary" type="button" id="lookSave">Save look</button>
            <button class="btn btn-outline" type="button" id="lookReset">Back to saved</button>
          </div>
          <div class="error" id="lookError" role="alert"></div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card pad">
        <h3 class="h4">Payments</h3>
        <p><span class="pill ${s.paymentMode === 'paystack' ? 'pill-ok' : 'pill-test'}">${s.paymentMode === 'paystack' ? 'Live (Paystack)' : 'Test mode'}</span></p>
        <p class="muted small">${s.paymentMode === 'paystack'
          ? 'Paystack takes Mobile Money and bank payments. The webhook below confirms each order.'
          : 'Add PAYSTACK_SECRET_KEY to take real payments. In test mode buyers confirm the payment themselves.'}</p>
        <p class="small">Webhook URL for the Paystack dashboard:<br /><code class="mono">${esc(s.webhookUrl)}</code></p>
        <ul class="details">
          ${row('MoMo number', s.paymentDetails.momo?.number)}
          ${row('MoMo name', s.paymentDetails.momo?.name)}
          ${row('Bank', s.paymentDetails.bank?.name)}
          ${row('Account name', s.paymentDetails.bank?.accountName)}
          ${row('Account number', s.paymentDetails.bank?.accountNumber)}
        </ul>
      </div>
      <div class="card pad">
        <h3 class="h4">Email</h3>
        <p><span class="pill ${s.emailMode === 'smtp' ? 'pill-ok' : 'pill-test'}">${s.emailMode === 'smtp' ? 'Sending via SMTP' : 'Mailbox only'}</span></p>
        <p class="muted small">${s.emailMode === 'smtp'
          ? 'Emails go to buyers and artists and are also kept in the Mailbox.'
          : 'No SMTP server is set, so emails are only kept in the Mailbox. Set SMTP_HOST to send them.'}</p>
        <ul class="details">
          ${row('Notifications to', s.adminEmail)}
          ${row('Site URL', s.siteUrl)}
          ${row('Email branding', `${t.presetName} · ${t.accent}`)}
        </ul>
      </div>
    </div>
    <p class="muted small mt">Payments, email and account settings come from environment variables (see .env.example). Change them there and restart the server.</p>`;

  // Live preview: the producer's tweaks apply to their own screen until saved.
  const form = body.querySelector('#lookForm');
  const accentInput = form.querySelector('input[name=accent]');
  const accent2Input = form.querySelector('input[name=accent2]');
  const darkInput = form.querySelector('input[name=dark]');
  const motionInput = form.querySelector('input[name=heroMotion]');
  const draft = { accent: t.accent, accent2: t.accent2, dark: t.dark, glass: t.glass, heroMotion: t.heroMotion !== false, preset: t.preset };
  const preview = () => {
    setLocal(draft);
    syncDock();
    form.querySelector('.look-preview').style.setProperty('--lp', draft.accent);
  };
  form.querySelectorAll('.td-preset').forEach((btn) => {
    btn.onclick = () => {
      draft.preset = btn.dataset.preset;
      draft.accent = btn.dataset.accent;
      draft.accent2 = btn.dataset.accent2;
      accentInput.value = draft.accent;
      accent2Input.value = draft.accent2;
      form.querySelectorAll('.td-preset').forEach((b) => b.classList.toggle('on', b === btn));
      preview();
    };
  });
  accentInput.oninput = () => {
    draft.accent = accentInput.value;
    draft.preset = 'custom';
    form.querySelectorAll('.td-preset').forEach((b) => b.classList.remove('on'));
    preview();
  };
  accent2Input.oninput = () => {
    draft.accent2 = accent2Input.value;
    draft.preset = 'custom';
    preview();
  };
  form.querySelector('[data-seg=glass]').onclick = (e) => {
    const btn = e.target.closest('[data-glass]');
    if (!btn) return;
    draft.glass = Number(btn.dataset.glass);
    form.querySelectorAll('[data-glass]').forEach((b) => b.classList.toggle('on', b === btn));
    preview();
  };
  darkInput.onchange = () => {
    draft.dark = darkInput.checked;
    preview();
  };
  motionInput.onchange = () => {
    draft.heroMotion = motionInput.checked;
    preview();
  };
  form.querySelector('#lookReset').onclick = () => {
    Object.assign(draft, { accent: t.accent, accent2: t.accent2, dark: t.dark, glass: t.glass, heroMotion: t.heroMotion !== false, preset: t.preset });
    accentInput.value = t.accent;
    accent2Input.value = t.accent2;
    darkInput.checked = t.dark;
    motionInput.checked = t.heroMotion !== false;
    form.querySelectorAll('[data-glass]').forEach((b) => b.classList.toggle('on', Number(b.dataset.glass) === t.glass));
    preview();
  };
  form.querySelector('#lookSave').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    form.querySelector('#lookError').textContent = '';
    try {
      const { theme: saved } = await api('/api/admin/theme', { method: 'PUT', body: draft });
      // The saved look is now the site default, so this device no longer needs an override.
      setSiteLook(saved);
      syncDock();
      Object.assign(t, { accent: saved.accent, accent2: saved.accent2, dark: saved.dark, glass: saved.glass, heroMotion: saved.heroMotion !== false, preset: saved.preset, presetName: saved.presetName });
      btn.textContent = 'Saved ✓';
      toast(`Site look saved (${saved.presetName} ${saved.accent}). Visitors and emails now use these colours.`);
      setTimeout(() => {
        btn.textContent = 'Save look';
        btn.disabled = false;
      }, 1800);
    } catch (err) {
      form.querySelector('#lookError').textContent = err.message;
      btn.disabled = false;
    }
  };
  preview();
}
