import nodemailer from 'nodemailer';
import { config, emailMode } from './config.js';
import { q } from './db.js';
import { escapeHtml } from './util.js';

const transport =
  emailMode() === 'smtp'
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      })
    : null;

/** Branded HTML wrapper for every email the store sends. */
export function emailLayout({ title, bodyHtml, buttonText, buttonUrl }) {
  const button =
    buttonText && buttonUrl
      ? `<p style="margin:28px 0"><a href="${escapeHtml(buttonUrl)}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(buttonText)}</a></p>`
      : '';
  return `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);border-radius:16px 16px 0 0;padding:22px 28px;color:#fff">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.85">${escapeHtml(config.siteName)}</div>
    <div style="font-size:22px;font-weight:700;margin-top:6px">${escapeHtml(title)}</div>
  </div>
  <div style="background:#fff;border-radius:0 0 16px 16px;padding:26px 28px;line-height:1.55;font-size:15px">
    ${bodyHtml}
    ${button}
    <p style="color:#64748b;font-size:12px;margin-top:28px">You receive this because you have an account at ${escapeHtml(config.siteName)}.</p>
  </div>
</div></body></html>`;
}

/** Sends the email (if SMTP is set) and always keeps a copy in the outbox. */
export async function sendEmail({ to, subject, text, html, attachments = [] }) {
  const finalHtml = html || `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
  let status = 'recorded';
  let error = null;
  if (transport) {
    try {
      await transport.sendMail({ from: config.mailFrom, to, subject, text, html: finalHtml, attachments });
      status = 'sent';
    } catch (err) {
      status = 'failed';
      error = err.message;
      console.error('[mail] failed to send:', err.message);
    }
  }
  q.run(
    'INSERT INTO outbox (to_email, subject, text_body, html_body, status, error) VALUES (?, ?, ?, ?, ?, ?)',
    to,
    subject,
    text,
    finalHtml,
    status,
    error,
  );
  return status;
}
