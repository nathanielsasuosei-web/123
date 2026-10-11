/**
 * Dynamic glass navbar.
 *
 * The header is rebuilt on every route change, so this module attaches the behaviour
 * each time and returns a teardown function for the router's cleanup list:
 *   • shrinks and thickens its glass as you scroll, with a scroll-progress line
 *   • goes transparent-over-hero at the top of the home page, solid once you scroll
 *   • hides on a fast scroll down, slides back on a scroll up
 *   • a cursor spotlight and a tint picked up from whatever is underneath it
 *   • a pill that slides between nav links instead of jumping
 *   • a springy mobile drawer with staggered links
 */
export function initNavbar(header) {
  if (!header) return () => {};
  const nav = header.querySelector('.nav');
  const progress = header.querySelector('.nav-progress');
  const toggle = header.querySelector('.menu-toggle');
  const inner = header.querySelector('.header-inner');
  let raf = 0;
  let lastY = window.scrollY;
  let hidden = false;
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const down = y > lastY + 4;
    const up = y < lastY - 4;

    header.classList.toggle('is-scrolled', y > 12);
    header.classList.toggle('is-tight', y > 90);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, y / max)})`;

    // Auto-hide only once there is something to scroll back to, never with the drawer open.
    if (y > 240 && down && !nav?.classList.contains('open') && !hidden) {
      hidden = true;
      header.classList.add('is-hidden');
    } else if ((up || y < 120) && hidden) {
      hidden = false;
      header.classList.remove('is-hidden');
    }

    // Over the hero the glass has nothing light behind it, so it goes dark and clear.
    const hero = document.querySelector('.hero');
    const overHero = Boolean(hero) && y < hero.offsetHeight - header.offsetHeight - 24;
    header.classList.toggle('is-over-hero', overHero && y < 60);

    if (y < 60) tintFromPage(header, inner);
    if (down || up) lastY = y;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      raf = requestAnimationFrame(update);
    }
  };

  // Cursor spotlight inside the glass.
  const onPointer = (e) => {
    const r = header.getBoundingClientRect();
    header.style.setProperty('--mx', `${e.clientX - r.left}px`);
    header.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  header.addEventListener('pointermove', onPointer);

  // Mobile drawer.
  if (toggle && nav) {
    toggle.onclick = () => {
      const open = nav.classList.toggle('open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      header.classList.toggle('drawer-open', open);
      if (open) {
        nav.querySelectorAll('a, button').forEach((item, i) => {
          item.style.animation = 'none';
          void item.offsetWidth;
          item.style.animation = `navItemIn .42s cubic-bezier(.2,.8,.2,1) ${i * 0.045}s both`;
        });
      }
    };
    nav.addEventListener('click', (e) => {
      if (!e.target.closest('a')) return;
      nav.classList.remove('open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      header.classList.remove('drawer-open');
    });
    document.addEventListener('keydown', onEsc);
  }

  function onEsc(e) {
    if (e.key === 'Escape' && nav?.classList.contains('open')) toggle?.click();
  }

  const stopPill = initPill(header, nav);
  update();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    header.removeEventListener('pointermove', onPointer);
    document.removeEventListener('keydown', onEsc);
    stopPill();
  };
}

/**
 * Samples the content behind the header so the glass picks up the page's colour.
 * Cheap version of backdrop tinting: dark hero → dark glass, light page → light glass.
 */
function tintFromPage(header, inner) {
  if (typeof document.elementFromPoint !== 'function') return;
  let probe = null;
  try {
    probe = document.elementFromPoint(window.innerWidth / 2, (inner?.offsetHeight || 68) + 26);
  } catch {
    return;
  }
  if (!probe) return;
  let node = probe;
  while (node && node !== document.body) {
    const bg = getComputedStyle(node).backgroundColor;
    const m = bg && bg.match(/rgba?\(([^)]+)\)/);
    if (m) {
      const [r, g, b, a] = m[1].split(',').map((v) => parseFloat(v));
      if (!Number.isFinite(a) || a > 0.65) {
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        header.classList.toggle('over-dark', lum < 0.5);
        header.style.setProperty('--tint', `${r},${g},${b}`);
        return;
      }
    }
    node = node.parentElement;
  }
  header.classList.remove('over-dark');
  header.style.removeProperty('--tint');
}

/** The sliding active-link pill. */
export function initPill(header, nav) {
  const pill = header?.querySelector('.nav-pill');
  if (!pill || !nav) return () => {};
  let frame = 0;

  const move = (animate = true) => {
    const link = nav.querySelector('a.active') || nav.querySelector('a');
    if (!link) {
      pill.style.opacity = '0';
      return;
    }
    pill.style.opacity = '';
    pill.style.transition = animate ? '' : 'none';
    const lr = link.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    pill.style.width = `${lr.width}px`;
    pill.style.height = `${lr.height}px`;
    pill.style.transform = `translate3d(${lr.left - nr.left}px, ${lr.top - nr.top}px, 0)`;
    if (!animate) {
      frame = requestAnimationFrame(() => {
        pill.style.transition = '';
      });
    }
  };

  // Links are still being laid out (fonts, drawer) when the header renders.
  move(false);
  requestAnimationFrame(() => move(false));
  const t = setTimeout(() => move(false), 260);
  const onResize = () => move(false);
  window.addEventListener('resize', onResize);

  nav.addEventListener('pointerover', (e) => {
    const link = e.target.closest('a:not(.btn)');
    if (link) {
      pill.classList.add('hovering');
      const lr = link.getBoundingClientRect();
      const nr = nav.getBoundingClientRect();
      pill.style.width = `${lr.width}px`;
      pill.style.height = `${lr.height}px`;
      pill.style.transform = `translate3d(${lr.left - nr.left}px, ${lr.top - nr.top}px, 0)`;
    }
  });
  nav.addEventListener('pointerleave', () => {
    pill.classList.remove('hovering');
    move();
  });

  return () => {
    clearTimeout(t);
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
  };
}
