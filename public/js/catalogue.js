import { api, esc, money, toast } from './api.js';
import { state, playPreview, onLeave } from './core.js';

const LICENSE_INFO = {
  mp3: { label: 'MP3 Lease', format: 'MP3', terms: 'Non-exclusive. Up to 1 song, 5,000 streams, 1 music video. Credit “Prod. by” required.' },
  wav: { label: 'WAV Lease', format: 'WAV', terms: 'Non-exclusive, lossless WAV. Up to 1 song, 50,000 streams, 2 music videos. Credit required.' },
  exclusive: { label: 'Exclusive', format: 'WAV', terms: 'Exclusive rights. The beat is removed from the store after purchase. Unlimited use.' },
};

/** One beat card with a play button that previews the beat. */
export function beatCard(beat) {
  const el = document.createElement('article');
  el.className = 'card beat-card';
  const cover = beat.coverUrl
    ? `<img src="${esc(beat.coverUrl)}" alt="${esc(beat.title)} cover" loading="lazy" />`
    : '<div class="cover-fallback" aria-hidden="true"></div>';
  el.innerHTML = `
    <div class="cover-wrap">
      <a class="cover" href="#/beats/${esc(beat.slug)}" aria-label="View ${esc(beat.title)}">${cover}</a>
      <button class="play-fab" aria-label="Play preview of ${esc(beat.title)}">▶</button>
    </div>
    <div class="card-body">
      <a class="card-title" href="#/beats/${esc(beat.slug)}">${esc(beat.title)}</a>
      <div class="meta">${esc(beat.genre || 'Beat')}${beat.bpm ? ` · ${beat.bpm} BPM` : ''}${beat.key ? ` · ${esc(beat.key)}` : ''}</div>
      <div class="card-foot">
        <span class="price">from ${money(beat.prices.mp3, state.currency)}</span>
        <a class="btn btn-sm btn-outline" href="#/beats/${esc(beat.slug)}">View</a>
      </div>
    </div>`;
  el.querySelector('.play-fab').onclick = () => playPreview(beat);
  return el;
}

export async function renderBeats(el, params) {
  const search = params.get('q') || '';
  const genre = params.get('genre') || '';
  const sort = params.get('sort') || 'new';
  const page = Number(params.get('page') || 1);
  const qs = new URLSearchParams({ q: search, genre, sort, page: String(page) });
  const data = await api(`/api/beats?${qs}`);
  const pageLink = (p) => `#/beats?${new URLSearchParams({ q: search, genre, sort, page: String(p) })}`;

  el.innerHTML = `
    <section class="container section">
      <div class="section-head">
        <div>
          <span class="eyebrow">Catalogue</span>
          <h1>Beats</h1>
          <p class="muted">${data.total} beat${data.total === 1 ? '' : 's'}. Press play to preview any beat.</p>
        </div>
      </div>
      <form class="toolbar" id="beatFilters">
        <input type="search" name="q" value="${esc(search)}" placeholder="Search title, genre, mood, tags…" aria-label="Search beats" />
        <select name="genre" aria-label="Genre">
          <option value="">All genres</option>
          ${data.genres.map((g) => `<option ${g === genre ? 'selected' : ''}>${esc(g)}</option>`).join('')}
        </select>
        <select name="sort" aria-label="Sort">
          <option value="new" ${sort === 'new' ? 'selected' : ''}>Newest</option>
          <option value="popular" ${sort === 'popular' ? 'selected' : ''}>Most played</option>
          <option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>Price: low to high</option>
          <option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>Price: high to low</option>
          <option value="bpm" ${sort === 'bpm' ? 'selected' : ''}>BPM: slow to fast</option>
        </select>
        <button class="btn btn-primary" type="submit">Apply</button>
      </form>
      <div class="grid" id="beatGrid"></div>
      ${data.items.length ? '' : '<p class="empty">No beats match your search.</p>'}
      <div class="pager">
        ${page > 1 ? `<a class="btn btn-outline btn-sm" href="${pageLink(page - 1)}">← Previous</a>` : ''}
        <span class="muted small">Page ${data.page} of ${data.pages}</span>
        ${page < data.pages ? `<a class="btn btn-outline btn-sm" href="${pageLink(page + 1)}">Next →</a>` : ''}
      </div>
    </section>`;

  const grid = el.querySelector('#beatGrid');
  data.items.forEach((beat) => grid.appendChild(beatCard(beat)));
  el.querySelector('#beatFilters').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    location.hash = `#/beats?${new URLSearchParams({ q: f.get('q') || '', genre: f.get('genre') || '', sort: f.get('sort') || 'new' })}`;
  };
}

export async function renderBeat(el, params, match) {
  const slug = decodeURIComponent(match[1]);
  const { beat, related } = await api(`/api/beats/${encodeURIComponent(slug)}`);
  let selected = 'mp3';
  const priceLabel = () => money(beat.prices[selected], state.currency);

  el.innerHTML = `
    <section class="container section">
      <a href="#/beats" class="back-link">← All beats</a>
      <div class="beat-detail">
        <div class="beat-art">
          ${beat.coverUrl ? `<img src="${esc(beat.coverUrl)}" alt="${esc(beat.title)} cover" />` : '<div class="cover-fallback big" aria-hidden="true"></div>'}
        </div>
        <div class="beat-info">
          <span class="eyebrow">${esc(beat.genre || 'Beat')}</span>
          <h1>${esc(beat.title)}</h1>
          <div class="tags">
            ${beat.bpm ? `<span class="chip">${beat.bpm} BPM</span>` : ''}
            ${beat.key ? `<span class="chip">${esc(beat.key)}</span>` : ''}
            ${beat.mood ? `<span class="chip">${esc(beat.mood)}</span>` : ''}
            ${beat.tags.map((t) => `<span class="chip subtle">${esc(t)}</span>`).join('')}
          </div>
          ${beat.description ? `<p class="lead-small">${esc(beat.description)}</p>` : ''}
          <button class="btn btn-outline" id="previewBtn">▶ Play preview</button>

          <h2 class="h3">Choose a licence</h2>
          <div class="licenses" role="radiogroup" aria-label="Licence">
            ${Object.keys(LICENSE_INFO).map((key) => `
              <label class="license ${key === selected ? 'selected' : ''}" data-key="${key}">
                <input type="radio" name="license" value="${key}" ${key === selected ? 'checked' : ''} />
                <div class="license-head">
                  <strong>${LICENSE_INFO[key].label}</strong>
                  <span class="price">${money(beat.prices[key], state.currency)}</span>
                </div>
                <div class="muted small">${LICENSE_INFO[key].format} · ${LICENSE_INFO[key].terms}</div>
              </label>`).join('')}
          </div>
          <div class="buy-row">
            <button class="btn btn-primary btn-lg" id="buyBtn">Buy now · <span id="buyPrice">${priceLabel()}</span></button>
            <p class="muted small">Pay by Mobile Money or bank transfer. Your files arrive by email right after payment.</p>
          </div>
        </div>
      </div>
      ${related.length ? `<h2 class="h3 mt">More ${esc(beat.genre)}</h2><div class="grid" id="related"></div>` : ''}
    </section>`;

  el.querySelector('#previewBtn').onclick = () => playPreview(beat);
  el.querySelectorAll('.license').forEach((label) => {
    label.onclick = () => {
      selected = label.dataset.key;
      el.querySelectorAll('.license').forEach((l) => l.classList.toggle('selected', l === label));
      el.querySelector('#buyPrice').textContent = priceLabel();
    };
  });

  el.querySelector('#buyBtn').onclick = async (e) => {
    if (!state.me) {
      toast('Log in or create an account to buy this beat.');
      location.hash = `#/login?next=${encodeURIComponent(`/beats/${beat.slug}`)}`;
      return;
    }
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Starting payment…';
    try {
      const order = await api('/api/orders', { method: 'POST', body: { beat: beat.slug, license: selected } });
      if (order.mode === 'test') location.hash = `#/checkout/${order.reference}`;
      else window.location.href = order.checkoutUrl;
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `Buy now · <span id="buyPrice">${priceLabel()}</span>`;
    }
  };

  const relatedEl = el.querySelector('#related');
  if (relatedEl) related.forEach((b) => relatedEl.appendChild(beatCard(b)));
}

export async function renderVideos(el) {
  const { items } = await api('/api/videos');
  el.innerHTML = `
    <section class="container section">
      <div class="section-head">
        <div><span class="eyebrow">Watch</span><h1>Videos</h1><p class="muted">Studio sessions, beat visuals and music videos.</p></div>
      </div>
      <div class="grid grid-3" id="videoGrid"></div>
      ${items.length ? '' : '<p class="empty">No videos have been published yet.</p>'}
    </section>`;
  const grid = el.querySelector('#videoGrid');
  items.forEach((v) => {
    const card = document.createElement('button');
    card.className = 'card video-card';
    card.type = 'button';
    card.innerHTML = `
      <div class="video-thumb">${v.coverUrl ? `<img src="${esc(v.coverUrl)}" alt="" loading="lazy" />` : '<div class="cover-fallback"></div>'}<span class="play-badge">▶</span></div>
      <div class="card-body"><div class="card-title">${esc(v.title)}</div>${v.description ? `<div class="meta">${esc(v.description).slice(0, 110)}</div>` : ''}</div>`;
    card.onclick = () => openVideo(v);
    grid.appendChild(card);
  });
}

/** Turns a YouTube or Vimeo link into an embeddable URL. */
function embedUrl(url) {
  const yt = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  return vm ? `https://player.vimeo.com/video/${vm[1]}?autoplay=1` : '';
}

function openVideo(v) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const media = v.videoUrl
    ? `<video src="${esc(v.videoUrl)}" controls autoplay playsinline></video>`
    : `<iframe src="${esc(embedUrl(v.youtubeUrl))}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${esc(v.title)}"></iframe>`;
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(v.title)}">
      <button class="modal-close" aria-label="Close">✕</button>
      <div class="video-frame">${media}</div>
      <div class="modal-caption"><strong>${esc(v.title)}</strong>${v.description ? `<p class="small">${esc(v.description)}</p>` : ''}</div>
    </div>`;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  overlay.addEventListener('click', (e) => (e.target === overlay || e.target.closest('.modal-close')) && close());
  document.addEventListener('keydown', onKey);
  onLeave(close);
  document.body.appendChild(overlay);
  api(`/api/videos/${v.id}/view`, { method: 'POST' }).catch(() => {});
}
