import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { q } from './db.js';
import { sendEmail, emailLayout } from './mail.js';
import { escapeHtml, formatMoney } from './util.js';

export const LICENSES = {
  mp3: {
    label: 'MP3 Lease',
    priceField: 'price_mp3',
    terms: 'Non-exclusive. Up to 1 song, 5,000 streams, 1 music video. Credit "Prod. by" required. The beat stays on sale.',
  },
  wav: {
    label: 'WAV Lease',
    priceField: 'price_wav',
    terms: 'Non-exclusive, lossless WAV. Up to 1 song, 50,000 streams, 2 music videos. Credit required. The beat stays on sale.',
  },
  exclusive: {
    label: 'Exclusive',
    priceField: 'price_exclusive',
    terms: 'Exclusive rights. The beat is removed from the store after purchase. Unlimited use.',
  },
};

const ORDER_SQL = `
  SELECT o.*, b.title AS beat_title, b.slug AS beat_slug, b.audio_path, b.audio_name, b.audio_size, b.cover_path,
         u.email AS buyer_email, u.name AS buyer_name
  FROM orders o JOIN beats b ON b.id = o.beat_id JOIN users u ON u.id = o.user_id`;

export const getOrder = (reference) => q.get(`${ORDER_SQL} WHERE o.reference = ?`, reference) || null;

/**
 * Marks an order paid and delivers the beat. Exactly once: only the call that flips
 * pending → paid sends the email, so the webhook, the return page and the producer can all call it.
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
  if (result.changes === 0) return getOrder(reference);

  if (order.license === 'exclusive') q.run('UPDATE beats SET published = 0 WHERE id = ?', order.beat_id);
  await deliver(getOrder(reference));
  return getOrder(reference);
}

async function deliver(order) {
  const link = `${config.siteUrl}/api/download/${order.download_token}`;
  const license = LICENSES[order.license];
  const file = path.join(config.dataDir, 'private', order.audio_path);

  const attachments = [];
  if (fs.existsSync(file) && order.audio_size <= config.attachMaxBytes) {
    attachments.push({
      filename: `${order.beat_slug}-${order.license}${path.extname(order.audio_name) || '.wav'}`,
      path: file,
    });
  }
  const note = attachments.length
    ? 'Your beat is attached. You can also download it again with the button below.'
    : 'The file is too large to attach, so use the button below to download it.';

  await sendEmail({
    to: order.buyer_email,
    subject: `Your beat is ready: ${order.beat_title}`,
    text: `Hi ${order.buyer_name},\n\nYour payment for "${order.beat_title}" (${license.label}) is confirmed.\n${note}\nDownload: ${link}\n\nLicence: ${license.terms}\nOrder: ${order.reference}`,
    html: emailLayout({
      title: 'Your beat is ready',
      bodyHtml: `<p>Hi ${escapeHtml(order.buyer_name)},</p>
        <p>Thank you! Your payment for <strong>${escapeHtml(order.beat_title)}</strong> (${escapeHtml(license.label)}) of
        <strong>${escapeHtml(formatMoney(order.amount, order.currency))}</strong> is confirmed.</p>
        <p>${escapeHtml(note)}</p>
        <p style="font-size:13px;color:#475569"><strong>Licence:</strong> ${escapeHtml(license.terms)}</p>
        <p style="font-size:13px;color:#475569">Order reference: ${escapeHtml(order.reference)}</p>`,
      buttonText: 'Download your beat',
      buttonUrl: link,
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
