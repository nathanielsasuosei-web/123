const BRAND = '#8b5cf6'
const BRAND2 = '#d946ef'

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#14141f;border:1px solid #2a2a3d;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(90deg,${BRAND},${BRAND2});padding:24px 32px;">
          <div style="font-size:24px;font-weight:bold;color:#fff;letter-spacing:1px;">🎧 MiraKilousE Beats</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">Type beats marketplace</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#fff;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#0d0d16;color:#64748b;font-size:12px;">
          © ${new Date().getFullYear()} MiraKilousE Beats · You received this email because you have an account or order with us.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const btn = (url, label) =>
  `<p style="margin:24px 0;">
    <a href="${url}" style="background:linear-gradient(90deg,${BRAND},${BRAND2});color:#fff;text-decoration:none;padding:12px 28px;border-radius:999px;font-weight:bold;display:inline-block;">${label}</a>
  </p>`

const row = (k, v) =>
  `<tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">${k}</td><td style="padding:6px 0;color:#fff;font-size:14px;text-align:right;">${v}</td></tr>`

export function welcomeEmail(user) {
  const subject = 'Welcome to MiraKilousE Beats 🎧'
  const html = layout(
    `Welcome, ${user.name}!`,
    `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;">
      Your artist account is ready. Browse exclusive type beats, pay easily with
      <b>Mobile Money</b> or <b>bank transfer</b>, and receive your downloads instantly by email.
    </p>
    ${btn('/beats', 'Browse Beats')}`
  )
  return { subject, html, text: `Welcome ${user.name}! Browse beats at /beats and buy with Mobile Money or bank transfer.` }
}

export function orderPlacedEmail(order, beat, buyer, settings, baseUrl) {
  const subject = `Order received — ${beat.title} (${order.license_type.toUpperCase()} license)`
  const payLabel =
    order.payment_method === 'mobile_money'
      ? `Pay ${settings.currency_symbol}${order.amount.toFixed(2)} to ${settings.momo_provider} number <b>${settings.momo_number}</b> (your phone: ${order.payer_phone})`
      : `Transfer ${settings.currency_symbol}${order.amount.toFixed(2)} to <b>${settings.bank_name}</b>, account <b>${settings.bank_account_name}</b> — <b>${settings.bank_account_number}</b>. Reference: <b>${order.bank_reference}</b>`
  const html = layout(
    'Order received — complete your payment',
    `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;">
      Hi ${buyer.name}, thanks for your order of <b style="color:#fff;">${beat.title}</b>
      (${order.license_type.toUpperCase()} license).
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">${row('Beat', beat.title)}${row('License', order.license_type.toUpperCase())}${row('Amount', `${settings.currency_symbol}${order.amount.toFixed(2)} ${settings.currency_code}`)}${row('Payment method', order.payment_method === 'mobile_money' ? 'Mobile Money' : 'Bank transfer')}</table>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.6;">${payLabel}</p>
    <p style="color:#94a3b8;font-size:13px;">Once your payment is confirmed, your download link will be emailed to you and will also appear in your dashboard.</p>
    ${btn(`${baseUrl}/dashboard`, 'Open My Dashboard')}`
  )
  return { subject, html, text: subject }
}

export function orderPlacedAdminEmail(order, beat, buyer, settings) {
  const subject = `🛒 New order #${order.id} — ${beat.title} (pending payment)`
  const html = layout(
    `New order #${order.id}`,
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${row('Customer', `${buyer.name} (${buyer.email})`)}
      ${row('Beat', beat.title)}
      ${row('License', order.license_type.toUpperCase())}
      ${row('Amount', `${settings.currency_symbol}${order.amount.toFixed(2)} ${settings.currency_code}`)}
      ${row('Payment', order.payment_method === 'mobile_money' ? `Mobile Money (${order.payer_phone})` : `Bank transfer (ref: ${order.bank_reference})`)}
    </table>
    <p style="color:#94a3b8;font-size:13px;">Status: <b style="color:#fbbf24;">pending payment</b>. Confirm it from the admin dashboard once the money arrives.</p>`
  )
  return { subject, html, text: subject }
}

export function paymentReceivedEmail(order, beat, buyer, settings, baseUrl) {
  const subject = `✅ Payment confirmed — your download of "${beat.title}" is ready!`
  const downloadUrl = `${baseUrl}/api/orders/${order.id}/download?token=${order.download_token}`
  const licenseUrl = `${baseUrl}/api/orders/${order.id}/license?token=${order.download_token}`
  const html = layout(
    'Payment confirmed — here is your beat! 🎉',
    `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;">
      Hi ${buyer.name}, your payment of <b style="color:#fff;">${settings.currency_symbol}${order.amount.toFixed(2)} ${settings.currency_code}</b>
      for <b style="color:#fff;">${beat.title}</b> (${order.license_type.toUpperCase()} license) has been confirmed.
    </p>
    ${btn(downloadUrl, `⬇ Download "${beat.title}" now`)}
    ${btn(licenseUrl, 'View license agreement')}
    <p style="color:#94a3b8;font-size:13px;">You can also download any time from your dashboard. Thank you for supporting ${settings.producer_name}!</p>`
  )
  return { subject, html, text: `${subject}\nDownload: ${downloadUrl}\nLicense: ${licenseUrl}` }
}

export function newSaleEmail(order, beat, buyer, settings) {
  const subject = `💰 Sale! ${beat.title} — ${settings.currency_symbol}${order.amount.toFixed(2)} (${order.license_type.toUpperCase()})`
  const html = layout(
    'New sale! 💰',
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${row('Customer', `${buyer.name} (${buyer.email})`)}
      ${row('Beat', beat.title)}
      ${row('License', order.license_type.toUpperCase())}
      ${row('Amount', `${settings.currency_symbol}${order.amount.toFixed(2)} ${settings.currency_code}`)}
      ${row('Payment', order.payment_method === 'mobile_money' ? `Mobile Money (${order.payer_phone})` : `Bank transfer (ref: ${order.bank_reference})`)}
      ${row('Order', `#${order.id}`)}
    </table>`
  )
  return { subject, html, text: subject }
}

export function newMessageEmail(sender, recipient, body, baseUrl) {
  const subject = `💬 New message from ${sender.name}`
  const preview = body.length > 240 ? body.slice(0, 240) + '…' : body
  const url = sender.role === 'admin' ? `${baseUrl}/dashboard` : `${baseUrl}/admin`
  const html = layout(
    `New message from ${sender.name}`,
    `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;">
      <b style="color:#fff;">${sender.name}</b> (<span style="color:#94a3b8;">${sender.email}</span>) sent you a message:
    </p>
    <blockquote style="margin:16px 0;padding:12px 20px;border-left:4px solid ${BRAND};background:#1c1c2b;color:#e2e8f0;font-size:14px;line-height:1.6;">${preview.replace(/</g, '&lt;')}</blockquote>
    ${btn(url, 'Open the chat box')}`
  )
  return { subject, html, text: `${subject}\n\n${body}\n\nReply in the chat box: ${url}` }
}

export function contactEmail({ name, email, subject, message }, contactEmailTo) {
  const s = `📨 Contact form: ${subject}`
  const html = layout(
    'New contact form message',
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${row('From', `${name} (${email})`)}
      ${row('Subject', subject)}
    </table>
    <p style="color:#cbd5e1;font-size:15px;line-height:1.6;white-space:pre-wrap;">${message.replace(/</g, '&lt;')}</p>`
  )
  return { subject: s, html, text: `${s}\nFrom: ${name} <${email}>\n\n${message}`, to: contactEmailTo }
}
