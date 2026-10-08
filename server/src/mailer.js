import nodemailer from 'nodemailer'
import db from './db.js'

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env

let transporter = null
if (SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  })
  console.log(`[mail] SMTP enabled -> ${SMTP_HOST}:${SMTP_PORT || 587}`)
} else {
  console.log('[mail] No SMTP configured — emails will be stored in the admin "Mailbox" tab (demo mode)')
}

const FROM =
  SMTP_FROM || 'MiraKilousE Beats <no-reply@mirakilousbeats.com>'

/**
 * Sends an email. Every email is always recorded in the `emails` table so it
 * can be viewed in the admin Mailbox tab. If SMTP is configured the message is
 * also delivered for real.
 */
export async function sendMail({ to, subject, html, text }) {
  const status = transporter ? 'sending' : 'demo (not sent — configure SMTP to deliver)'
  const info = db
    .prepare(
      'INSERT INTO emails (to_email, subject, html, text, status) VALUES (?, ?, ?, ?, ?)'
    )
    .run(to, subject, html || '', text || '', status)

  if (!transporter) {
    console.log(`[mail:demo] -> ${to} | ${subject}`)
    return { demo: true, id: info.lastInsertRowid }
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html, text })
    db.prepare("UPDATE emails SET status = 'sent' WHERE id = ?").run(info.lastInsertRowid)
    console.log(`[mail:sent] -> ${to} | ${subject}`)
    return { demo: false, id: info.lastInsertRowid }
  } catch (err) {
    db.prepare("UPDATE emails SET status = ? WHERE id = ?").run(`failed: ${err.message}`, info.lastInsertRowid)
    console.error(`[mail:failed] -> ${to} | ${subject}: ${err.message}`)
    return { demo: false, id: info.lastInsertRowid, error: err.message }
  }
}
