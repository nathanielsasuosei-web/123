import { api, esc } from './api.js';
import { onLeave } from './core.js';
import { beatCard } from './catalogue.js';
import { active, buildPalette } from './theme.js';

/**
 * Animated hero: layered waves, drifting particles and a glow, all painted in the
 * site colours. The pointer nudges the layers (parallax), and the palette is re-read
 * while it runs so changing the accent recolours the hero without a reload.
 */
function startHero(canvas) {
  const ctx = canvas.getContext('2d');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || active().heroMotion === false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;
  let frame = 0;
  let raf = 0;
  let alive = true;
  let colors = null;
  let colorKey = '';
  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  const particles = Array.from({ length: 52 }, () => ({
    x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2.4,
    s: 0.00012 + Math.random() * 0.00038, d: Math.random() * Math.PI * 2, depth: 0.4 + Math.random(),
  }));
  const waves = [
    { amp: 0.09, freq: 1.3, speed: 0.6, y: 0.62, alpha: 0.34, tint: 0 },
    { amp: 0.12, freq: 0.9, speed: 0.45, y: 0.7, alpha: 0.3, tint: 1 },
    { amp: 0.07, freq: 1.9, speed: 0.9, y: 0.78, alpha: 0.22, tint: 2 },
    { amp: 0.15, freq: 0.6, speed: 0.3, y: 0.86, alpha: 0.44, tint: 3 },
  ];

  /** Reads the live accent colours; rebuilds only when they actually change. */
  const palette = () => {
    const t = active();
    const key = `${t.accent}|${t.accent2}|${t.dark ? 1 : 0}`;
    if (colors && key === colorKey) return colors;
    colorKey = key;
    const p = buildPalette(t.accent, t.accent2);
    const hex = (c) => {
      const n = parseInt(c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    colors = {
      glow: hex(p.accent2),
      waves: [hex(p.light['400']), hex(p.accent), hex(p.light['300']), hex(p.light['700'])],
      dust: hex(p.light['200']),
    };
    return colors;
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    const c = palette();
    const px = (pointer.x - 0.5) * 2;
    const py = (pointer.y - 0.5) * 2;
    ctx.clearRect(0, 0, w, h);

    const gx = w * (0.75 + px * 0.05);
    const gy = h * (0.3 + py * 0.06);
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.62);
    glow.addColorStop(0, `rgba(${c.glow[0]},${c.glow[1]},${c.glow[2]},${0.3 + 0.07 * Math.sin(t * 0.8)})`);
    glow.addColorStop(1, `rgba(${c.glow[0]},${c.glow[1]},${c.glow[2]},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    waves.forEach((wave, i) => {
      const shift = px * (6 + i * 5);
      const lift = py * (3 + i * 2.5);
      const [r, g, b] = c.waves[wave.tint % c.waves.length];
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const k = x / w;
        const y =
          h * wave.y + lift +
          Math.sin(k * Math.PI * 2 * wave.freq + t * wave.speed) * h * wave.amp +
          Math.sin(k * Math.PI * 5 + t * wave.speed * 1.7) * h * wave.amp * 0.25;
        if (x === 0) ctx.moveTo(x + shift, y);
        else ctx.lineTo(x + shift, y);
      }
      ctx.lineTo(w + 40, h);
      ctx.lineTo(-40, h);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},${wave.alpha})`;
      ctx.fill();
    });

    for (const p of particles) {
      const drift = (p.y - t * p.s * 60) % 1;
      const y = drift < 0 ? drift + 1 : drift;
      const x = p.x + Math.sin(t * 0.5 + p.d) * 0.02 + px * 0.012 * p.depth;
      ctx.beginPath();
      ctx.arc(x * w, (y + py * 0.01 * p.depth) * h, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c.dust[0]},${c.dust[1]},${c.dust[2]},${0.3 + 0.45 * Math.abs(Math.sin(t + p.d))})`;
      ctx.fill();
    }
  }

  const loop = () => {
    if (!alive) return;
    frame += 1;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    draw(frame / 60);
    raf = requestAnimationFrame(loop);
  };

  const onPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.tx = (e.clientX - r.left) / r.width;
    pointer.ty = (e.clientY - r.top) / r.height;
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  if (still) draw(0);
  else loop();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointer);
  };
}

/** Cycles the second line of the hero headline. */
function startHeroWords(scope) {
  const box = scope.querySelector('.hero-words');
  if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const words = ['move the room.', 'fuel the dancefloor.', 'carry the hook.', 'sound like you.'];
  let i = 0;
  let timer = 0;
  const nodes = [box.querySelector('[data-w="0"]'), box.querySelector('[data-w="1"]')];
  const tick = () => {
    i = (i + 1) % words.length;
    const show = nodes[i % 2];
    const hide = nodes[(i + 1) % 2];
    show.textContent = words[i];
    show.setAttribute('aria-hidden', 'false');
    hide.setAttribute('aria-hidden', 'true');
    timer = setTimeout(tick, 2800);
  };
  timer = setTimeout(tick, 2800);
  return () => clearTimeout(timer);
}

export async function renderHome(el) {
  el.innerHTML = `
    <section class="hero">
      <canvas class="hero-canvas" id="heroCanvas" aria-hidden="true"></canvas>
      <div class="container hero-content">
        <span class="eyebrow fade-up d1">New beats every week</span>
        <h1 class="hero-title">
          <span class="fade-up d2">Beats that</span>
          <span class="fade-up d3 grad-text hero-words">
            <span data-w="0">move the room.</span>
            <span data-w="1" aria-hidden="true">fuel the dancefloor.</span>
          </span>
        </h1>
        <p class="lead fade-up d4">Hard-hitting afro, highlife, amapiano and drill beats from a working producer. Preview any beat, pick a licence, and get your files by email.</p>
        <div class="cta fade-up d5">
          <a class="btn btn-primary btn-lg" href="#/beats">Browse beats</a>
          <a class="btn btn-glass btn-lg" href="#/videos">Watch videos</a>
        </div>
        <div class="hero-stats fade-up d5" id="heroStats">
          <div class="hero-stat"><strong id="statBeats">–</strong><span>Beats ready</span></div>
          <div class="hero-stat"><strong id="statPlays">–</strong><span>Previews played</span></div>
          <div class="hero-stat"><strong id="statVideos">–</strong><span>Videos</span></div>
          <div class="hero-stat"><strong>MoMo</strong><span>&amp; bank transfer</span></div>
        </div>
        <div class="eq fade-up d5" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<span style="animation-delay:${(i * 0.07).toFixed(2)}s"></span>`).join('')}</div>
      </div>
      <div class="hero-scroll" aria-hidden="true"><i></i>Scroll</div>
    </section>

    <section class="container section">
      <div class="section-head">
        <div><span class="eyebrow">Fresh drops</span><h2>Latest beats</h2></div>
        <a class="btn btn-outline" href="#/beats">See all beats</a>
      </div>
      <div class="grid" id="homeBeats"></div>
    </section>

    <section class="steps-band">
      <div class="container">
        <span class="eyebrow">How it works</span>
        <h2>From preview to your files in minutes</h2>
        <div class="steps">
          <div class="step"><span>1</span><h3>Preview</h3><p>Play any beat and find the sound you want.</p></div>
          <div class="step"><span>2</span><h3>Pay</h3><p>Pay in GHS with MTN, Vodafone or AirtelTigo Mobile Money, or by bank transfer.</p></div>
          <div class="step"><span>3</span><h3>Receive</h3><p>Your licence and download link arrive by email and in your dashboard.</p></div>
        </div>
      </div>
    </section>

    <section class="container section">
      <div class="section-head">
        <div><span class="eyebrow">Videos</span><h2>Latest videos</h2></div>
        <a class="btn btn-outline" href="#/videos">All videos</a>
      </div>
      <div class="grid grid-3" id="homeVideos"></div>
    </section>

    <section class="container section">
      <div class="cta-banner">
        <div>
          <h2>Need something custom?</h2>
          <p>Message the producer from your dashboard. You get an email when they reply.</p>
        </div>
        <a class="btn btn-light btn-lg" href="#/register">Create a free account</a>
      </div>
    </section>`;

  onLeave(startHero(el.querySelector('#heroCanvas')));
  onLeave(startHeroWords(el));

  try {
    const { items, total } = await api('/api/beats?sort=new');
    const grid = el.querySelector('#homeBeats');
    if (!items.length) grid.innerHTML = '<p class="empty">No beats yet. Check back soon.</p>';
    items.slice(0, 6).forEach((b) => grid.appendChild(beatCard(b)));
    const statBeats = el.querySelector('#statBeats');
    if (statBeats) statBeats.textContent = String(total ?? items.length);
    const plays = items.reduce((sum, b) => sum + (b.plays || 0), 0);
    const statPlays = el.querySelector('#statPlays');
    if (statPlays) statPlays.textContent = plays > 999 ? `${(plays / 1000).toFixed(1)}k` : String(plays);
  } catch {
    el.querySelector('#homeBeats').innerHTML = '<p class="empty">Could not load beats right now.</p>';
  }

  try {
    const { items } = await api('/api/videos');
    const grid = el.querySelector('#homeVideos');
    const statVideos = el.querySelector('#statVideos');
    if (statVideos) statVideos.textContent = String(items.length);
    if (!items.length) grid.innerHTML = '<p class="empty">No videos yet.</p>';
    items.slice(0, 3).forEach((v) => {
      const a = document.createElement('a');
      a.className = 'card video-card';
      a.href = '#/videos';
      a.innerHTML = `<div class="video-thumb">${v.coverUrl ? `<img src="${esc(v.coverUrl)}" alt="" loading="lazy" />` : '<div class="cover-fallback"></div>'}<span class="play-badge">▶</span></div>
        <div class="card-body"><div class="card-title">${esc(v.title)}</div></div>`;
      grid.appendChild(a);
    });
  } catch {
    /* leave empty */
  }
}
