import { Router } from 'express';
import express from 'express';
import { config, paymentMode } from '../config.js';
import { q } from '../db.js';
import { randomToken, formatMoney } from '../lib/util.js';
import { LICENSES, LICENSE_KEYS } from '../lib/licenses.js';
import { fulfilOrder, getOrder } from '../lib/orders.js';
import { startPayment, verifyPaystack, isValidWebhook } from '../payments.js';
import { wrap, str, paymentDetails, toBeatDto } from '../lib/http.js';
import { publicUrl } from '../uploads.js';

export const ordersRouter = Router();
/** Paystack webhook (needs the raw body to check its signature). */
export const webhookRouter = Router();
/** Browser return page after Paystack checkout. */
export const callbackRouter = Router();

function orderDto(o, { includeDownload = true } = {}) {
  return {
    reference: o.reference,
    status: o.status,
    method: o.method,
    license: o.license,
    licenseLabel: LICENSES[o.license]?.label || o.license,
    amount: o.amount,
    currency: o.currency,
    amountLabel: formatMoney(o.amount, o.currency),
    createdAt: o.created_at,
    paidAt: o.paid_at,
    beat: { title: o.beat_title, slug: o.beat_slug, coverUrl: publicUrl(o.cover_path) },
    buyer: o.buyer_email ? { name: o.buyer_name, email: o.buyer_email } : undefined,
    downloadUrl: includeDownload && o.status === 'paid' ? `/api/download/${o.download_token}` : null,
  };
}

/** Confirms the amount and currency Paystack actually charged match the order. */
function matchesOrder(order, verified) {
  return verified.success && verified.amount === order.amount && verified.currency === order.currency;
}

ordersRouter.post('/', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in to buy a beat.' });
  const slug = str(req.body.beat, 100);
  const license = str(req.body.license, 20);
  if (!LICENSE_KEYS.includes(license)) return res.status(400).json({ error: 'Choose a licence.' });

  const beat = q.get('SELECT * FROM beats WHERE slug = ? AND published = 1', slug);
  if (!beat) return res.status(404).json({ error: 'This beat is not available.' });

  const amount = beat[LICENSES[license].priceField];
  const reference = `BS-${Date.now().toString(36).toUpperCase()}-${randomToken(3).toUpperCase()}`;
  q.run(
    'INSERT INTO orders (reference, user_id, beat_id, license, amount, currency, download_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
    reference,
    req.user.id,
    beat.id,
    license,
    amount,
    config.currency,
    randomToken(24),
  );

  let payment;
  try {
    payment = await startPayment({ reference, amountPesewas: amount, email: req.user.email });
  } catch (err) {
    q.run('DELETE FROM orders WHERE reference = ?', reference);
    console.error('[payments] could not start payment:', err.message);
    return res.status(502).json({ error: 'Payment could not be started. Please try again in a moment.' });
  }

  res.status(201).json({
    reference,
    mode: payment.mode,
    checkoutUrl: payment.url,
    amount,
    amountLabel: formatMoney(amount, config.currency),
    beat: toBeatDto(beat),
  });
}));

ordersRouter.get('/mine', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  const rows = q.all(
    `SELECT o.*, b.title AS beat_title, b.slug AS beat_slug, b.cover_path, b.audio_path, b.audio_name, b.audio_size,
            u.email AS buyer_email, u.name AS buyer_name
     FROM orders o JOIN beats b ON b.id = o.beat_id JOIN users u ON u.id = o.user_id
     WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC`,
    req.user.id,
  );
  res.json({ items: rows.map((o) => orderDto(o, { includeDownload: true })) });
}));

ordersRouter.get('/:reference', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  const order = getOrder(req.params.reference);
  if (!order || (order.user_id !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  res.json({
    order: orderDto(order),
    paymentMode: paymentMode(),
    paymentDetails: paymentDetails(),
  });
}));

/** Test mode only: simulates a Mobile Money or bank payment so the whole flow can be tried. */
ordersRouter.post('/:reference/test-pay', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  if (paymentMode() !== 'test') return res.status(400).json({ error: 'Test payments are disabled.' });
  const order = getOrder(req.params.reference);
  if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  const method = req.body.method === 'bank' ? 'bank' : 'mobile_money';
  const paid = await fulfilOrder(order.reference, `test-${method}`);
  res.json({ order: orderDto(paid) });
}));

/** Checks with Paystack that a pending order was paid (used by the dashboard). */
ordersRouter.post('/:reference/verify', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  const order = getOrder(req.params.reference);
  if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === 'paid' || paymentMode() !== 'paystack') {
    return res.json({ order: orderDto(order) });
  }
  const verified = await verifyPaystack(order.reference).catch(() => null);
  if (verified && matchesOrder(order, verified)) {
    const paid = await fulfilOrder(order.reference, `paystack-${verified.channel || 'checkout'}`);
    return res.json({ order: orderDto(paid) });
  }
  res.json({ order: orderDto(order) });
}));

// Paystack → our site after the hosted checkout. Verify, deliver, then show the dashboard.
callbackRouter.get('/callback', wrap(async (req, res) => {
  const reference = str(req.query.reference || req.query.trxref, 100);
  const order = reference ? getOrder(reference) : null;
  if (order && order.status !== 'paid' && paymentMode() === 'paystack') {
    const verified = await verifyPaystack(reference).catch(() => null);
    if (verified && matchesOrder(order, verified)) {
      await fulfilOrder(reference, `paystack-${verified.channel || 'checkout'}`);
    }
  }
  res.redirect(`/#/dashboard${reference ? `?order=${encodeURIComponent(reference)}` : ''}`);
}));

// Paystack webhook: the reliable confirmation, even if the buyer closes the tab.
webhookRouter.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), wrap(async (req, res) => {
  const signature = req.get('x-paystack-signature');
  if (!isValidWebhook(req.body, signature)) return res.status(401).end();

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).end();
  }
  if (event.event === 'charge.success' && event.data?.reference) {
    const order = getOrder(event.data.reference);
    if (order && order.status !== 'paid') {
      const verified = await verifyPaystack(order.reference).catch(() => null);
      if (verified && matchesOrder(order, verified)) {
        await fulfilOrder(order.reference, `paystack-${verified.channel || 'webhook'}`);
      }
    }
  }
  res.status(200).end();
}));
