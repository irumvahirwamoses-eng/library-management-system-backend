import nodemailer from 'nodemailer';

let transporter = null;
let configured = false;

export const isEmailEnabled = () => process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';

const APP = 'Library Management System';

const buildTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(SMTP_USER || '')) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    family: 4,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });
};

const getTransporter = () => {
  if (!configured) {
    transporter = buildTransporter();
    configured = true;
  }
  return transporter;
};

// Preferred path: Brevo HTTP API over port 443 (avoids SMTP port/network issues on Render).
const sendViaBrevoApi = async ({ to, subject, html, text }) => {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.SMTP_FROM;
  if (!key) return null;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: from },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json().catch(() => ({}));
  return { messageId: data.messageId || 'sent' };
};

export const sendMail = async ({ to, subject, html, text }) => {
  if (!isEmailEnabled() || !to) return null;
  if (!process.env.SMTP_FROM) return null;

  const apiRef = await sendViaBrevoApi({ to, subject, html, text });
  if (apiRef) {
    console.log(`Email sent to ${to}: ${apiRef.messageId} (Brevo API)`);
    return apiRef;
  }

  const t = getTransporter();
  if (!t) return null;
  const info = await t.sendMail({ from: process.env.SMTP_FROM, to, subject, html, text });
  console.log(`Email sent to ${to}: ${info.messageId} (SMTP)`);
  return info;
};

const buildEmail = ({ subject, heading, intro, items, footer, totalLabel }) => {
  const now = new Date().toLocaleString();
  const rows = items
    .map((it) => `<li><strong>${it.title}</strong>${it.author ? ` — ${it.author}` : ''}${it.quantity > 1 ? ` (x${it.quantity})` : ''}</li>`)
    .join('');
  const total = items.reduce((s, it) => s + (it.quantity || 1), 0);
  return {
    subject,
    html: `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(90deg,#2563eb,#4f46e5);padding:20px 28px">
        <h1 style="color:#fff;margin:0;font-size:20px">${heading}</h1>
      </div>
      <div style="padding:28px;color:#374151">
        <p style="margin-top:0">Dear <strong>${intro.borrowerName}</strong>,</p>
        <p>${intro.line}</p>
        <ul style="padding-left:20px;line-height:1.7">${rows}</ul>
        <p><strong>Total:</strong> ${total} ${total === 1 ? 'book' : 'books'}</p>
        <p class="meta" style="color:#6b7280;font-size:12px">Sent on ${now}${totalLabel ? ` • ${totalLabel}` : ''}</p>
        ${footer ? `<p>${footer}</p>` : ''}
        <p style="margin-bottom:0">Regards,<br/>${APP}</p>
      </div>
    </div>`
  };
};

export const sendBorrowReceipt = async ({ to, borrowerName, items, schoolName }) => {
  if (!to || items.length === 0) return null;
  const library = schoolName ? `${schoolName} ${APP}` : APP;
  const total = items.reduce((s, it) => s + (it.quantity || 1), 0);
  const { subject, html } = buildEmail({
    subject: `You borrowed ${total} book(s) from ${library}`,
    heading: `Library Borrowing Confirmation — ${library}`,
    intro: {
      borrowerName,
      line: `You have successfully borrowed the following ${total} book(s) from ${library}:`
    },
    items,
    footer: 'Please return them on time to avoid inconvenience. In case of loss or damage, please report to the librarian.',
    totalLabel: 'Borrowing confirmation'
  });
  return sendMail({ to, subject, html });
};

export const sendReturnReceipt = async ({ to, borrowerName, items, schoolName }) => {
  if (!to || items.length === 0) return null;
  const library = schoolName ? `${schoolName} ${APP}` : APP;
  const total = items.reduce((s, it) => s + (it.quantity || 1), 0);
  const { subject, html } = buildEmail({
    subject: `You returned ${total} book(s) to ${library}`,
    heading: `Books Returned — Verification — ${library}`,
    intro: {
      borrowerName,
      line: `This is to confirm that the following ${total} book(s) were returned to ${library}:`
    },
    items,
    footer: 'Thank you for returning the books on time.',
    totalLabel: 'Return confirmed'
  });
  return sendMail({ to, subject, html });
};