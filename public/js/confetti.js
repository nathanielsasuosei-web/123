/**
 * A short confetti burst in the site colours, used after sign-up and payment.
 * Creates its own canvas, removes it again, and stays out of the way for
 * reduced-motion users.
 */
import { active, mix } from './theme.js';

export function celebrate({ x = window.innerWidth / 2, y = window.innerHeight / 3, count = 110, spread = Math.PI } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const t = active();
  const colors = [t.accent, t.accent2, mix(t.accent, '#ffffff', 0.45), mix(t.accent, '#000000', 0.25), '#ffffff'];
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);

  const bits = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const speed = 5 + Math.random() * 11;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 5 + Math.random() * 7,
      h: 7 + Math.random() * 10,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.34,
      color: colors[(Math.random() * colors.length) | 0],
      round: Math.random() > 0.72,
    };
  });

  let raf = 0;
  let alive = true;
  const started = performance.now();

  const frame = (now) => {
    if (!alive) return;
    const age = (now - started) / 1000;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const b of bits) {
      b.vy += 0.36;
      b.vx *= 0.992;
      b.vy *= 0.995;
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.spin;
      const fade = Math.max(0, Math.min(1, (3.1 - age) / 0.8));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      if (b.round) {
        ctx.beginPath();
        ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      }
      ctx.restore();
    }
    if (age < 3.2) raf = requestAnimationFrame(frame);
    else stop();
  };

  const stop = () => {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    canvas.remove();
  };

  raf = requestAnimationFrame(frame);
  return stop;
}
