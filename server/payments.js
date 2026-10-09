import crypto from 'node:crypto';
import { config, paymentMode } from './config.js';

const API = 'https://api.paystack.co';

async function paystack(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${config.paystackKey}`, 'Content-Type': 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) throw new Error(json.message || `Paystack error (${res.status})`);
  return json;
}

/**
 * Starts a payment. Live: Paystack hosted checkout with Mobile Money and bank.
 * Test: the store's own checkout page simulates the payment.
 */
export async function startPayment({ reference, amountPesewas, email }) {
  if (paymentMode() === 'test') return { mode: 'test' };
  const json = await paystack('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: amountPesewas,
      currency: config.currency,
      reference,
      callback_url: `${config.siteUrl}/payments/callback`,
      channels: ['mobile_money', 'bank'],
    }),
  });
  return { mode: 'paystack', url: json.data.authorization_url };
}

/** Asks Paystack whether a reference was really paid. Never trust the browser. */
export async function verifyPaystack(reference) {
  const json = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    success: json.data?.status === 'success',
    amount: Number(json.data?.amount || 0),
    currency: json.data?.currency || '',
    channel: json.data?.channel || '',
  };
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body. */
export function isValidWebhook(rawBody, signature) {
  if (!config.paystackKey || !signature) return false;
  const expected = crypto.createHmac('sha512', config.paystackKey).update(rawBody).digest('hex');
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
