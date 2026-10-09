import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { q } from '../db.js';
import { sendEmail, emailLayout } from '../mailer.js';
import { escapeHtml, formatMoney } from './util.js';
import { LICENSES } from './licenses.js';

const orderSelect = `
  SELECT o.*, b.title AS beat_title, b.slug AS beat_slug, b.audio_path, b.audio_name, b.audio_size,
         b.cover_path, u.email AS buyer_email, u.name AS buyer_name
  FROM orders o
  JOIN beats b ON b.id = o.beat_id
  JOIN users u ON u.id = o.user_id`;

export function getOrder(reference) {
  return q.get(`${orderSelect} WHERE o.reference = ?`, reference) || null;
}

/**
 * Marks an order as paid and delivers the beat, exactly once.
 * Safe to call from the browser return page, the webhook and the admin at the same time:
 * only the call that flips status from pending → paid sends the delivery email.
 */
export async function fulfilOrder(reference, method) {
  const order = getOrder(reference);
  if (!order) return null;
  if (order.status === 'paid') return order;

  const result = q.run(
    "UPDATE orders SET status = 'paid', method = ?, paid_at = datetime('now') WHERE id = ? AND status = 'pending'",
    method,
    order.id,
  );
  if (result.changes === 0) return getOrder(reference); // someone else just paid it

  if (order.license === 'exclusive') {
    q.run('UPDATE beats SET published = 0 WHERE id = ?', order.beat_id);
  }
  await deliverOrder(getOrder(reference));
  return getOrder(reference);
}

async function deliverOrder(order) {
  const downloadUrl = `${config.siteUrl}/api/download/${order.download_token}`;
  const license = LICENSES[order.license];
  const audioFile = path.join(config.dataDir, 'private', order.audio_path);

  const attachments = [];
  if (fs.existsSync(audioFile) && order.audio_size <= config.attachMaxBytes) {
    const ext = path.extname(order.audio_name) || '.wav';
    attachments.push({ filename: `${order.beat_slug}-${order.license}${ext}`, path: audioFile });
  }

  const linkText = attachments.length
    ? 'Your beat is attached to this email. You can also download it again any time with the button below.'
    : 'Your file is too large to attach, so use the button below to download it.';

  const bodyHtml = `
    <p>Hi ${escapeHtml(order.buyer_name)},</p>
    <p>Thank you for your purchase. Your payment for <strong>${escapeHtml(order.beat_title)}</strong>
    (${escapeHtml(license.label)}) of <strong>${escapeHtml(formatMoney(order.amount, order.currency))}</strong>
    is confirmed.</p>
    <p>${escapeHtml(linkText)}</p>
    <p style="font-size:13px;color:#475569"><strong>License:</strong> ${escapeHtml(license.terms)}</p>
    <p style="font-size:13px;color:#475569">Order reference: ${escapeHtml(order.reference)}</p>`;

  const text =
    `Hi ${order.buyer_name},\n\nYour payment for "${order.beat_title}" (${license.label}) is confirmed.\n` +
    `Download: ${downloadUrl}\n\nLicense: ${license.terms}\nOrder: ${order.reference}`;

  await sendEmail({
    to: order.buyer_email,
    subject: `Your beat is ready: ${order.beat_title}`,
    text,
    html: emailLayout({
      title: 'Your beat is ready',
      bodyHtml,
      buttonText: 'Download your beat',
      buttonUrl: downloadUrl,
    }),
    attachments,
  });

  q.run("UPDATE orders SET delivered_at = datetime('now') WHERE id = ?", order.id);

  if (config.adminEmail) {
    await sendEmail({
      to: config.adminEmail,
      subject: `New sale: ${order.beat_title} (${formatMoney(order.amount, order.currency)})`,
      text: `${order.buyer_name} <${order.buyer_email}> bought "${order.beat_title}" (${license.label}).\nOrder ${order.reference}`,
    });
  }
}
