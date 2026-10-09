import crypto from 'node:crypto';
import { config, paymentMode } from './config.js';

const PAYSTACK = 'https://api.paystack.co';

async function paystack(path, options = {}) {
  const res = await fetch(`${PAYSTACK}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.paystackKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    throw new Error(json.message || `Paystack request failed (${res.status})`);
  }
  return json;
}

/**
 * Starts a payment for an order and returns where the buyer should go next.
 * - Paystack (live): hosted checkout offering Mobile Money and bank transfer.
 * - Test mode: the store's own checkout page simulates the payment.
 */
export async function startPayment({ reference, amountPesewas, email }) {
  if (paymentMode() === 'test') {
    return { mode: 'test', url: `${config.siteUrl}/#/checkout/${reference}` };
  }
  const json = await paystack('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: amountPesewas,
      currency: config.currency,
      reference,
      callback_url: `${config.siteUrl}/payments/callback`,
      channels: ['mobile_money', 'bank'],
      metadata: { reference },
    }),
  });
  return { mode: 'paystack', url: json.data.authorization_url };
}

/** Asks Paystack whether a reference was really paid (never trust the browser). */
export async function verifyPaystack(reference) {
  const json = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    success: json.data?.status === 'success',
    amount: Number(json.data?.amount || 0),
    currency: json.data?.currency || '',
    channel: json.data?.channel || '',
    reference: json.data?.reference || reference,
  };
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function isValidWebhook(rawBody, signature) {
  if (!config.paystackKey || !signature) return false;
  const expected = crypto.createHmac('sha512', config.paystackKey).update(rawBody).digest('hex');
  return expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
