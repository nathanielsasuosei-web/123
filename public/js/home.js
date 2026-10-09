import { api, esc } from './api.js';
import { onLeave } from './app.js';
import { beatCard } from './beats.js';

/**
 * Animated hero: layered sine waves drawn on a canvas with floating glow particles.
 * Motion is reduced automatically for people who prefer less animation.
 */
function startHeroCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let frame = 0;
  let raf = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const particles = Array.from({ length: 46 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.6 + Math.random() * 2.2,
    s: 0.00012 + Math.random() * 0.00035,
    d: Math.random() * Math.PI * 2,
  }));

  const waves = [
    { amp: 0.09, freq: 1.3, speed: 0.6, y: 0.62, color: 'rgba(96,165,250,0.35)' },
    { amp: 0.12, freq: 0.9, speed: 0.45, y: 0.7, color: 'rgba(59,130,246,0.30)' },
    { amp: 0.07, freq: 1.9, speed: 0.9, y: 0.78, color: 'rgba(147,197,253,0.22)' },
    { amp: 0.15, freq: 0.6, speed: 0.3, y: 0.86, color: 'rgba(37,99,235,0.45)' },
  ];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, width, height);

    // Soft glow that breathes.
    const glow = ctx.createRadialGradient(width * 0.75, height * 0.3, 0, width * 0.75, height * 0.3, Math.max(width, height) * 0.6);
    glow.addColorStop(0, `rgba(59,130,246,${0.28 + 0.06 * Math.sin(t * 0.8)})`);
    glow.addColorStop(1, 'rgba(59,130,246,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const w of waves) {
      ctx.beginPath();
      for (let x = 0; x <= width; x += 6) {
        const k = x / width;
        const y =
          height * w.y +
          Math.sin(k * Math.PI * 2 * w.freq + t * w.speed) * height * w.amp +
          Math.sin(k * Math.PI * 5 + t * w.speed * 1.7) * height * w.amp * 0.25;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = w.color;
      ctx.fill();
    }

    for (const p of particles) {
      const py = (p.y - t * p.s * 60) % 1;
      const y = py < 0 ? py + 1 : py;
      const x = p.x + Math.sin(t * 0.5 + p.d) * 0.02;
      ctx.beginPath();
      ctx.arc(x * width, y * height, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(191,219,254,${0.35 + 0.4 * Math.abs(Math.sin(t + p.d))})`;
      ctx.fill();
    }
  }

  function loop() {
    frame += 1;
    draw(frame / 60);
    raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  if (reduce) {
    draw(0);
  } else {
    loop();
  }
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}

export async function renderHome(el) {
  el.innerHTML = `
    <section class="hero">
      <canvas class="hero-canvas" id="heroCanvas" aria-hidden="true"></canvas>
      <div class="container hero-content">
        <span class="eyebrow fade-up d1">New beats every week</span>
        <h1 class="hero-title">
          <span class="fade-up d2">Beats that</span>
          <span class="fade-up d3 grad-text">move the room.</span>
        </h1>
        <p class="lead fade-up d4">Hard-hitting type beats, afro, highlife and drill, made by a working producer. Preview any beat, pick a licence and get your files by email.</p>
        <div class="cta fade-up d5">
          <a class="btn btn-primary btn-lg" href="#/beats">Browse beats</a>
          <a class="btn btn-glass btn-lg" href="#/videos">Watch videos</a>
        </div>
        <div class="eq fade-up d5" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<span style="animation-delay:${(i * 0.07).toFixed(2)}s"></span>`).join('')}</div>
      </div>
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
          <div class="step"><span>3</span><h3>Receive</h3><p>Your licence and download link arrive by email, and in your dashboard.</p></div>
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
          <p>Send the producer a message from your dashboard. You will get an email when they reply.</p>
        </div>
        <a class="btn btn-light btn-lg" href="#/register">Create a free account</a>
      </div>
    </section>`;

  const stop = startHeroCanvas(el.querySelector('#heroCanvas'));
  onLeave(stop);

  try {
    const { items } = await api('/api/beats?sort=new');
    const grid = el.querySelector('#homeBeats');
    if (!items.length) grid.innerHTML = '<p class="empty">No beats yet. Check back soon.</p>';
    items.slice(0, 6).forEach((b) => grid.appendChild(beatCard(b)));
  } catch {
    el.querySelector('#homeBeats').innerHTML = '<p class="empty">Could not load beats right now.</p>';
  }

  try {
    const { items } = await api('/api/videos');
    const grid = el.querySelector('#homeVideos');
    if (!items.length) grid.innerHTML = '<p class="empty">No videos yet.</p>';
    items.slice(0, 3).forEach((v) => grid.appendChild(videoCardMini(v)));
  } catch {
    /* keep empty */
  }
}

function videoCardMini(v) {
  const el = document.createElement('a');
  el.className = 'card video-card';
  el.href = '#/videos';
  el.innerHTML = `
    <div class="video-thumb">${v.coverUrl ? `<img src="${esc(v.coverUrl)}" alt="" loading="lazy" />` : '<div class="cover-fallback"></div>'}<span class="play-badge">▶</span></div>
    <div class="card-body"><div class="card-title">${esc(v.title)}</div></div>`;
  return el;
}
