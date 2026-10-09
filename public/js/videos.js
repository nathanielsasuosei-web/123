import { api, esc } from './api.js';
import { onLeave } from './app.js';

/** Turns a YouTube or Vimeo link into an embeddable URL. */
export function embedUrl(url) {
  const yt = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

function openPlayer(video) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const media = video.videoUrl
    ? `<video src="${esc(video.videoUrl)}" controls autoplay playsinline></video>`
    : `<iframe src="${esc(embedUrl(video.youtubeUrl) || '')}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${esc(video.title)}"></iframe>`;
  overlay.innerHTML = `
    <div class="modal modal-video" role="dialog" aria-modal="true" aria-label="${esc(video.title)}">
      <button class="modal-close" aria-label="Close">✕</button>
      <div class="video-frame">${media}</div>
      <div class="modal-caption"><strong>${esc(video.title)}</strong>${video.description ? `<p class="muted small">${esc(video.description)}</p>` : ''}</div>
    </div>`;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.modal-close')) close();
  });
  document.addEventListener('keydown', onKey);
  onLeave(close);
  document.body.appendChild(overlay);
  api(`/api/videos/${video.id}/view`, { method: 'POST' }).catch(() => {});
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
  for (const v of items) {
    const card = document.createElement('button');
    card.className = 'card video-card';
    card.type = 'button';
    card.innerHTML = `
      <div class="video-thumb">${v.coverUrl ? `<img src="${esc(v.coverUrl)}" alt="" loading="lazy" />` : '<div class="cover-fallback"></div>'}<span class="play-badge">▶</span></div>
      <div class="card-body">
        <div class="card-title">${esc(v.title)}</div>
        ${v.description ? `<div class="meta">${esc(v.description).slice(0, 110)}</div>` : ''}
      </div>`;
    card.onclick = () => openPlayer(v);
    grid.appendChild(card);
  }
}
