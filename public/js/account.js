import { api, esc, money, dateTime, toast } from './api.js';
import { state, renderHeader } from './core.js';

const loginRequired = (el, text) => {
  el.innerHTML = `
    <section class="container section narrow center">
      <h1>Log in required</h1>
      <p class="muted">${esc(text)}</p>
      <a class="btn btn-primary" href="#/login">Log in</a>
      <a class="btn btn-outline" href="#/register">Create account</a>
    </section>`;
};

// ── Log in / sign up ─────────────────────────────────────────────────────────────
export async function renderAuth(el, mode, params) {
  if (state.me) {
    location.hash = state.me.role === 'admin' ? '#/admin' : '#/dashboard';
    return;
  }
  const next = params.get('next');
  const isLogin = mode === 'login';
  const nextQs = next ? `?next=${encodeURIComponent(next)}` : '';
  el.innerHTML = `
    <section class="container section narrow">
      <div class="auth-card card">
        <span class="eyebrow">${isLogin ? 'Welcome back' : 'Create your account'}</span>
        <h1>${isLogin ? 'Log in' : 'Sign up'}</h1>
        <p class="muted">${isLogin ? 'Log in to buy beats and see your downloads and messages.' : 'Your receipts and files are sent to this email address.'}</p>
        <form id="authForm" class="form">
          ${isLogin ? '' : '<label>Your name<input name="name" autocomplete="name" required maxlength="80" /></label>'}
          <label>Email<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" required minlength="${isLogin ? 1 : 8}" autocomplete="${isLogin ? 'current-password' : 'new-password'}" /></label>
          <button class="btn btn-primary btn-block" type="submit">${isLogin ? 'Log in' : 'Create account'}</button>
          <div class="error" id="authError" role="alert"></div>
        </form>
        <p class="muted small center">
          ${isLogin
            ? `New here? <a href="#/register${nextQs}">Create an account</a>`
            : `Already have an account? <a href="#/login${nextQs}">Log in</a>`}
        </p>
      </div>
    </section>`;

  el.querySelector('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const errorEl = el.querySelector('#authError');
    const button = e.target.querySelector('button[type=submit]');
    errorEl.textContent = '';
    button.disabled = true;
    try {
      const { user } = await api(isLogin ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        body: Object.fromEntries(new FormData(e.target)),
      });
      state.me = user;
      renderHeader();
      toast(isLogin ? `Welcome back, ${user.name}!` : 'Account created. Welcome!');
      location.hash = next ? `#${next}` : user.role === 'admin' ? '#/admin' : '#/dashboard';
    } catch (err) {
      errorEl.textContent = err.message;
      button.disabled = false;
    }
  };
}

// ── Checkout ─────────────────────────────────────────────────────────────────────
export async function renderCheckout(el, params, match) {
  if (!state.me) return loginRequired(el, 'Log in to complete your purchase.');
  const reference = decodeURIComponent(match[1]);
  const { order, paymentMode, paymentDetails } = await api(`/api/orders/${encodeURIComponent(reference)}`);

  const showPaid = () => {
    el.innerHTML = `
      <section class="container section narrow center">
        <div class="success-mark" aria-hidden="true">✓</div>
        <h1>Payment confirmed</h1>
        <p class="lead-small">Thank you! <strong>${esc(order.beat.title)}</strong> (${esc(order.licenseLabel)}) is ready. We also emailed your download link.</p>
        <div class="cta" style="justify-content:center">
          ${order.downloadUrl ? `<a class="btn btn-primary btn-lg" href="${esc(order.downloadUrl)}">Download now</a>` : ''}
          <a class="btn btn-outline btn-lg" href="#/dashboard">My purchases</a>
        </div>
        <p class="muted small">Order ${esc(order.reference)}</p>
      </section>`;
  };
  if (order.status === 'paid') return showPaid();

  const summary = `
    <div class="summary card">
      <div class="summary-row"><span>Beat</span><strong>${esc(order.beat.title)}</strong></div>
      <div class="summary-row"><span>Licence</span><span>${esc(order.licenseLabel)}</span></div>
      <div class="summary-row total"><span>Total</span><strong>${esc(order.amountLabel)}</strong></div>
      <div class="summary-row small muted"><span>Reference</span><span>${esc(order.reference)}</span></div>
    </div>`;

  if (paymentMode !== 'test') {
    el.innerHTML = `
      <section class="container section narrow">
        <h1>Complete your payment</h1>
        ${summary}
        <div class="card pad">
          <p>Payment is processed securely by Paystack. If you closed the payment window, check the payment below once you have paid.</p>
          <div class="cta"><button class="btn btn-primary btn-lg" id="checkBtn">I have paid, check now</button></div>
        </div>
      </section>`;
    el.querySelector('#checkBtn').onclick = async (e) => {
      e.currentTarget.disabled = true;
      const { order: updated } = await api(`/api/orders/${encodeURIComponent(reference)}/verify`, { method: 'POST' });
      if (updated.status === 'paid') {
        toast('Payment received. Your beat is on its way!');
        Object.assign(order, updated);
        showPaid();
      } else {
        toast('We have not received the payment yet. It can take a minute.', 'error');
        e.currentTarget.disabled = false;
      }
    };
    return;
  }

  // Test mode: simulate Mobile Money or bank transfer.
  el.innerHTML = `
    <section class="container section narrow">
      <span class="pill pill-test">Test mode: no real money is charged</span>
      <h1>Pay for ${esc(order.beat.title)}</h1>
      ${summary}
      <div class="card pad">
        <div class="tabs" role="tablist">
          <button class="tab active" data-method="mobile_money" role="tab">Mobile Money</button>
          <button class="tab" data-method="bank" role="tab">Bank transfer</button>
        </div>
        <div id="methodBody"></div>
        <button class="btn btn-primary btn-lg btn-block" id="payBtn">Confirm payment</button>
      </div>
    </section>`;

  const momo = paymentDetails.momo;
  const bank = paymentDetails.bank;
  let method = 'mobile_money';
  const body = el.querySelector('#methodBody');
  const drawMethod = () => {
    body.innerHTML = method === 'mobile_money'
      ? `<div class="pay-box">
           <p>Send <strong>${esc(order.amountLabel)}</strong> via MTN, Vodafone or AirtelTigo Mobile Money to:</p>
           <div class="big-number">${esc(momo?.number || 'Not set')}</div>
           <p class="muted small">Name: ${esc(momo?.name || '')}</p>
           <p class="muted small">Use reference <strong>${esc(order.reference)}</strong> as the payment note.</p>
         </div>`
      : `<div class="pay-box">
           <p>Transfer <strong>${esc(order.amountLabel)}</strong> to this bank account:</p>
           <ul class="details">
             <li><span>Bank</span><strong>${esc(bank?.name || '')}</strong></li>
             <li><span>Account name</span><strong>${esc(bank?.accountName || '')}</strong></li>
             <li><span>Account number</span><strong>${esc(bank?.accountNumber || 'Not set')}</strong></li>
             <li><span>Reference</span><strong>${esc(order.reference)}</strong></li>
           </ul>
         </div>`;
  };
  drawMethod();
  el.querySelectorAll('.tab').forEach((tab) => {
    tab.onclick = () => {
      method = tab.dataset.method;
      el.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      drawMethod();
    };
  });

  el.querySelector('#payBtn').onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const { order: paid } = await api(`/api/orders/${encodeURIComponent(reference)}/test-pay`, { method: 'POST', body: { method } });
      Object.assign(order, paid);
      toast('Payment confirmed. Check your email for the download link.');
      showPaid();
    } catch (err) {
      toast(err.message, 'error');
      e.currentTarget.disabled = false;
    }
  };
}

// ── Dashboard: purchases and messages ─────────────────────────────────────────────
export async function renderDashboard(el, params) {
  if (!state.me) return loginRequired(el, 'Log in to see your purchases and messages.');
  if (state.me.role === 'admin') {
    location.hash = '#/admin';
    return;
  }
  const highlight = params.get('order');
  el.innerHTML = `
    <section class="container section">
      <div class="section-head"><div><span class="eyebrow">My account</span><h1>Hi, ${esc(state.me.name)}</h1></div></div>
      <div class="tabs" role="tablist">
        <button class="tab active" data-tab="purchases" role="tab">My purchases</button>
        <button class="tab" data-tab="messages" role="tab">Messages</button>
      </div>
      <div id="dashBody"></div>
    </section>`;
  const body = el.querySelector('#dashBody');

  async function showPurchases() {
    const { items } = await api('/api/orders/mine');
    if (highlight) {
      const target = items.find((o) => o.reference === highlight);
      if (target && target.status !== 'paid') {
        const check = await api(`/api/orders/${encodeURIComponent(highlight)}/verify`, { method: 'POST' }).catch(() => null);
        if (check?.order?.status === 'paid') {
          toast('Payment confirmed. Your beat is ready!');
          return showPurchases();
        }
      }
    }
    if (!items.length) {
      body.innerHTML = '<div class="empty-box"><p>You have not bought any beats yet.</p><a class="btn btn-primary" href="#/beats">Browse beats</a></div>';
      return;
    }
    body.innerHTML = `<div class="order-list">${items.map((o) => `
      <article class="order card ${o.reference === highlight ? 'highlight' : ''}">
        ${o.beat.coverUrl ? `<img src="${esc(o.beat.coverUrl)}" alt="" class="order-cover" />` : '<div class="order-cover cover-fallback"></div>'}
        <div class="order-main">
          <strong>${esc(o.beat.title)}</strong>
          <div class="muted small">${esc(o.licenseLabel)} · ${money(o.amount, o.currency)} · ${dateTime(o.createdAt)}</div>
          <div class="muted small">Ref ${esc(o.reference)}${o.method ? ` · ${esc(o.method.replace(/-/g, ' '))}` : ''}</div>
        </div>
        <div class="order-actions">
          <span class="pill ${o.status === 'paid' ? 'pill-ok' : 'pill-wait'}">${o.status === 'paid' ? 'Paid' : 'Awaiting payment'}</span>
          ${o.status === 'paid'
            ? `<a class="btn btn-primary btn-sm" href="${esc(o.downloadUrl)}">Download</a>`
            : `<a class="btn btn-outline btn-sm" href="#/checkout/${esc(o.reference)}">Complete payment</a>`}
        </div>
      </article>`).join('')}</div>`;
  }

  async function showMessages() {
    const { items } = await api('/api/messages');
    body.innerHTML = `
      <div class="chat card">
        <div class="chat-log" id="chatLog"></div>
        <form class="chat-form" id="chatForm">
          <textarea name="body" rows="2" maxlength="2000" placeholder="Write a message to the producer…" required></textarea>
          <button class="btn btn-primary" type="submit">Send</button>
        </form>
        <p class="muted small" style="padding:0 14px 14px">Every reply is also emailed to you.</p>
      </div>`;
    const log = body.querySelector('#chatLog');
    const draw = (list) => {
      log.innerHTML = list.length
        ? list.map((m) => `
          <div class="bubble ${m.sender === 'artist' ? 'mine' : 'theirs'}">
            <div class="bubble-text">${esc(m.body).replace(/\n/g, '<br>')}</div>
            <div class="bubble-time">${m.sender === 'artist' ? 'You' : 'Producer'} · ${dateTime(m.created_at)}</div>
          </div>`).join('')
        : '<p class="empty">No messages yet. Ask about a beat or a custom order.</p>';
      log.scrollTop = log.scrollHeight;
    };
    draw(items);
    body.querySelector('#chatForm').onsubmit = async (e) => {
      e.preventDefault();
      const text = e.target.body.value.trim();
      if (!text) return;
      try {
        const res = await api('/api/messages', { method: 'POST', body: { body: text } });
        e.target.body.value = '';
        draw(res.items);
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  }

  let tab = 'purchases';
  const show = () => (tab === 'purchases' ? showPurchases() : showMessages());
  el.querySelectorAll('.tab').forEach((btn) => {
    btn.onclick = () => {
      tab = btn.dataset.tab;
      el.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
      body.innerHTML = '<div class="loader"></div>';
      show();
    };
  });
  await show();
}
