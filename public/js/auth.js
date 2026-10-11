/**
 * Log in / sign up with smooth animations.
 *
 * One card serves both modes: switching between them morphs the card (FLIP), slides the
 * mode pill, and staggers the fields in. The submit button runs through
 * idle → loading → success (or an error shake), and sign-up finishes with confetti in
 * the site colours. Everything here honours prefers-reduced-motion.
 */
import { celebrate } from './confetti.js';
import { active, buildPalette } from './theme.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Floating colour orbs + a music bar strip behind the auth card. */
function ambient(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;
  let raf = 0;
  let alive = true;
  let colors = null;
  let key = '';

  const orbs = Array.from({ length: 7 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.16 + Math.random() * 0.3,
    sx: (Math.random() - 0.5) * 0.05,
    sy: (Math.random() - 0.5) * 0.04,
    phase: i * 1.3,
    alt: i % 2 === 0,
  }));

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const palette = () => {
    const t = active();
    const next = `${t.accent}|${t.accent2}`;
    if (next === key && colors) return colors;
    key = next;
    const p = buildPalette(t.accent, t.accent2);
    colors = [p.accent, p.accent2, p.light['300'], p.light['700']];
    return colors;
  };

  function draw(time) {
    const c = palette();
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const o of orbs) {
      const x = (o.x + Math.sin(time * 0.12 * o.sx * 6 + o.phase) * 0.09) * w;
      const y = (o.y + Math.cos(time * 0.1 * o.sy * 6 + o.phase) * 0.09) * h;
      const radius = o.r * Math.min(w, h) * (0.9 + 0.12 * Math.sin(time * 0.5 + o.phase));
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const color = o.alt ? c[1] : c[0];
      g.addColorStop(0, `${color}66`);
      g.addColorStop(0.55, `${color}22`);
      g.addColorStop(1, `${color}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Equaliser strip along the bottom of the panel.
    const bars = 44;
    const bw = w / bars;
    for (let i = 0; i < bars; i += 1) {
      const n =
        Math.abs(Math.sin(time * 1.4 + i * 0.42)) * 0.55 +
        Math.abs(Math.sin(time * 0.7 + i * 0.17)) * 0.45;
      const bh = Math.max(3, n * h * 0.16);
      ctx.fillStyle = i % 3 === 0 ? `${c[1]}bb` : `${c[0]}99`;
      ctx.fillRect(i * bw + bw * 0.22, h - bh, bw * 0.56, bh);
    }
  }

  let frame = 0;
  const loop = () => {
    if (!alive) return;
    frame += 1;
    draw(frame / 60);
    raf = requestAnimationFrame(loop);
  };

  resize();
  window.addEventListener('resize', resize);
  if (reduced()) draw(0);
  else loop();

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}

const strengthOf = (pw) => {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const level = pw.length < 6 ? Math.min(score, 1) : Math.min(score, 4);
  const labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'];
  return { level: pw ? Math.max(1, level) : 0, label: pw ? labels[Math.max(1, level)] : '' };
};

const field = (name, label, type, opts = {}) => `
  <div class="field" data-field="${name}" ${opts.hidden ? 'hidden' : ''}>
    <input id="f-${name}" name="${name}" type="${type}" placeholder=" "
      ${opts.autocomplete ? `autocomplete="${opts.autocomplete}"` : ''}
      ${opts.required ? 'required' : ''} ${opts.minlength ? `minlength="${opts.minlength}"` : ''}
      ${opts.maxlength ? `maxlength="${opts.maxlength}"` : ''} />
    <label for="f-${name}">${label}</label>
    <span class="field-line" aria-hidden="true"></span>
    ${type === 'password' ? `<button type="button" class="peek" data-peek="f-${name}" aria-label="Show password">👁</button>` : ''}
  </div>`;

/**
 * @param {HTMLElement} el         page container
 * @param {'login'|'register'} mode
 * @param {URLSearchParams} params query string (?next=/beats)
 * @param {(values:object, mode:string)=>Promise<void>} onSubmit resolves on success
 */
export function renderAuthPage(el, mode, params, onSubmit) {
  const next = params.get('next');
  const qs = next ? `?next=${encodeURIComponent(next)}` : '';
  el.innerHTML = `
    <section class="auth-stage">
      <div class="auth-panel" aria-hidden="true">
        <canvas class="auth-canvas" id="authCanvas"></canvas>
        <div class="auth-panel-inner">
          <span class="auth-badge">Producer studio</span>
          <h2>Buy a beat in <span class="auth-word">minutes</span>.</h2>
          <p>Preview everything, pay with Mobile Money or bank transfer, and the files land in your inbox.</p>
          <ul class="auth-points">
            <li><span>01</span> Instant preview of every beat</li>
            <li><span>02</span> MP3, WAV and exclusive licences</li>
            <li><span>03</span> Download link emailed the moment you pay</li>
            <li><span>04</span> Message the producer any time</li>
          </ul>
          <div class="auth-eq" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => `<i style="animation-delay:${(i * 0.09).toFixed(2)}s"></i>`).join('')}</div>
        </div>
      </div>

      <div class="auth-form-wrap">
        <div class="auth-card card" id="authCard">
          <div class="auth-modes" data-mode="${mode}">
            <span class="auth-modes-pill" aria-hidden="true"></span>
            <a href="#/login${qs}" data-mode-link="login">Log in</a>
            <a href="#/register${qs}" data-mode-link="register">Sign up</a>
          </div>

          <div class="auth-copy">
            <span class="eyebrow" data-copy="eyebrow">${mode === 'login' ? 'Welcome back' : 'Create your account'}</span>
            <h1 data-copy="title">${mode === 'login' ? 'Log in' : 'Sign up'}</h1>
            <p class="muted" data-copy="sub">${mode === 'login'
              ? 'Log in to buy beats and see your downloads and messages.'
              : 'Your receipts and beat files are sent to this email address.'}</p>
          </div>

          <form id="authForm" class="auth-form" novalidate>
            <div class="auth-fields">
              ${field('name', 'Your name', 'text', { autocomplete: 'name', maxlength: 80, required: mode === 'register', hidden: mode === 'login' })}
              ${field('email', 'Email address', 'email', { autocomplete: 'email', required: true })}
              ${field('password', 'Password', 'password', {
                autocomplete: mode === 'login' ? 'current-password' : 'new-password',
                required: true,
                minlength: mode === 'login' ? 1 : 8,
              })}
            </div>

            <div class="pw-meter ${mode === 'login' ? 'hidden' : ''}" id="pwMeter" aria-hidden="true">
              <div class="pw-bars"><i></i><i></i><i></i><i></i></div>
              <span id="pwLabel"></span>
            </div>

            <div class="error" id="authError" role="alert"></div>

            <button class="btn btn-primary btn-block btn-auth" type="submit" id="authSubmit">
              <span class="btn-auth-label">${mode === 'login' ? 'Log in' : 'Create account'}</span>
              <span class="btn-auth-spin" aria-hidden="true"></span>
              <span class="btn-auth-check" aria-hidden="true">✓</span>
            </button>
          </form>

          <p class="muted small center auth-alt" data-copy="alt">${mode === 'login'
            ? `New here? <a href="#/register${qs}">Create an account</a>`
            : `Already have an account? <a href="#/login${qs}">Log in</a>`}</p>
        </div>
      </div>
    </section>`;

  const card = el.querySelector('#authCard');
  const form = el.querySelector('#authForm');
  const submit = el.querySelector('#authSubmit');
  const errorEl = el.querySelector('#authError');
  const nameField = el.querySelector('[data-field=name]');
  const pwInput = el.querySelector('#f-password');
  const meter = el.querySelector('#pwMeter');
  const stopAmbient = ambient(el.querySelector('#authCanvas'));

  // Entrance: card rises, fields stagger in.
  requestAnimationFrame(() => {
    card.classList.add('in');
    el.querySelectorAll('.auth-panel-inner > *').forEach((node, i) => {
      node.style.animation = reduced() ? '' : `fadeUp .7s cubic-bezier(.2,.8,.2,1) ${0.08 + i * 0.09}s both`;
    });
    el.querySelectorAll('.auth-points li').forEach((li, i) => {
      li.style.animation = reduced() ? '' : `authSlideIn .6s cubic-bezier(.2,.8,.2,1) ${0.35 + i * 0.09}s both`;
    });
    staggerFields(el);
    moveModePill(el);
  });

  el.querySelectorAll('[data-peek]').forEach((btn) => {
    btn.onclick = () => {
      const input = el.querySelector(`#${btn.dataset.peek}`);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('on', show);
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus();
    };
  });

  pwInput.addEventListener('input', () => {
    if (meter.classList.contains('hidden')) return;
    const { level, label } = strengthOf(pwInput.value);
    meter.dataset.level = String(level);
    el.querySelector('#pwLabel').textContent = label;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    card.classList.remove('shake');
    const values = Object.fromEntries(new FormData(form));
    if (mode === 'login') delete values.name;
    submit.classList.add('is-loading');
    submit.disabled = true;
    try {
      await onSubmit(values, mode);
      submit.classList.remove('is-loading');
      submit.classList.add('is-success');
      el.querySelector('.btn-auth-label').textContent = mode === 'login' ? 'Welcome back' : 'Account created';
      if (mode === 'register') {
        const r = submit.getBoundingClientRect();
        celebrate({ x: r.left + r.width / 2, y: r.top, count: 130 });
      }
      card.classList.add('out');
    } catch (err) {
      submit.classList.remove('is-loading');
      submit.disabled = false;
      errorEl.textContent = err.message || 'Something went wrong. Try again.';
      void card.offsetWidth;
      card.classList.add('shake');
      pwInput.focus();
      pwInput.select();
    }
  });

  return () => {
    stopAmbient();
  };
}

function staggerFields(scope) {
  scope.querySelectorAll('.field').forEach((f, i) => {
    if (f.hidden) return;
    f.style.animation = reduced() ? '' : `fieldIn .5s cubic-bezier(.2,.8,.2,1) ${0.12 + i * 0.07}s both`;
  });
}

/** Slides the segmented pill behind the active mode link. */
export function moveModePill(scope) {
  const wrap = scope.querySelector('.auth-modes');
  if (!wrap) return;
  const link = wrap.querySelector(`[data-mode-link="${wrap.dataset.mode}"]`);
  const pill = wrap.querySelector('.auth-modes-pill');
  if (!link || !pill) return;
  const lr = link.getBoundingClientRect();
  const wr = wrap.getBoundingClientRect();
  pill.style.width = `${lr.width}px`;
  pill.style.transform = `translate3d(${lr.left - wr.left - 4}px,0,0)`;
}

/**
 * Morphs the card between login and sign-up: measures the height, swaps the copy and
 * the name field, then animates the difference so nothing snaps.
 */
export function switchAuthMode(el, nextMode, onSubmit) {
  const card = el.querySelector('#authCard');
  if (!card) return;
  const first = card.getBoundingClientRect();
  const nameField = el.querySelector('[data-field=name]');
  const modes = el.querySelector('.auth-modes');
  const copy = {
    login: {
      eyebrow: 'Welcome back',
      title: 'Log in',
      sub: 'Log in to buy beats and see your downloads and messages.',
      cta: 'Log in',
      alt: 'New here? <a href="#/register">Create an account</a>',
    },
    register: {
      eyebrow: 'Create your account',
      title: 'Sign up',
      sub: 'Your receipts and beat files are sent to this email address.',
      cta: 'Create account',
      alt: 'Already have an account? <a href="#/login">Log in</a>',
    },
  }[nextMode];

  modes.dataset.mode = nextMode;
  el.querySelector('[data-copy=eyebrow]').textContent = copy.eyebrow;
  el.querySelector('[data-copy=title]').textContent = copy.title;
  el.querySelector('[data-copy=sub]').textContent = copy.sub;
  el.querySelector('[data-copy=alt]').innerHTML = copy.alt;
  el.querySelector('.btn-auth-label').textContent = copy.cta;

  const showName = nextMode === 'register';
  nameField.hidden = !showName;
  nameField.querySelector('input').required = showName;
  const pw = el.querySelector('#f-password');
  pw.minLength = showName ? 8 : 1;
  pw.autocomplete = showName ? 'new-password' : 'current-password';
  el.querySelector('#pwMeter').classList.toggle('hidden', !showName);

  moveModePill(el);
  staggerFields(el);
  card.classList.add('morphing');
  setTimeout(() => card.classList.remove('morphing'), 360);

  if (!reduced()) {
    const last = card.getBoundingClientRect();
    const dy = last.height - first.height;
    if (Math.abs(dy) > 2) {
      card.animate(
        [
          { transform: `translateY(${dy > 0 ? -dy * 0.35 : dy * 0.2}px) scale(${dy > 0 ? 0.985 : 1.012})` },
          { transform: 'none' },
        ],
        { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
    }
  }
  if (showName) setTimeout(() => nameField.querySelector('input').focus(), 220);
  else el.querySelector('#f-email').focus();
  return onSubmit;
}
