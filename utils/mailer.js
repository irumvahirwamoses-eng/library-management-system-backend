import nodemailer from 'nodemailer';

let transporter = null;
let configured = false;

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

export const isEmailEnabled = () => process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';

const getTransporter = () => {
  if (!configured) {
    transporter = buildTransporter();
    configured = true;
  }
  return transporter;
};

export const sendMail = async ({ to, subject, html, text }) => {
  if (!isEmailEnabled() || !to) return null;
  const t = getTransporter();
  if (!t || !process.env.SMTP_FROM) return null;
  const info = await t.sendMail({ from: process.env.SMTP_FROM, to, subject, html, text });
  console.log(`Email sent to ${to}: ${info.messageId}`);
  return info;
};

export const sendBorrowReceipt = async ({ to, borrowerName, items, schoolName }) => {
  if (!to) return null;
  const rows = items
    .map((it) => `<li><strong>${it.title}</strong>${it.author ? ` — ${it.author}` : ''}${it.quantity > 1 ? ` (x${it.quantity})` : ''}</li>`)
    .join('');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(90deg,#2563eb,#4f46e5);padding:20px 28px">
        <h1 style="color:#fff;margin:0;font-size:20px">Library Borrowing Confirmation</h1>
      </div>
      <div style="padding:28px;color:#374151">
        <p style="margin-top:0">Dear <strong>${borrowerName}</strong>,</p>
        <p>You have successfully borrowed the following book(s) from the school library${schoolName ? ` (${schoolName})` : ''}:</p>
        <ul style="padding-left:20px;line-height:1.7">${rows}</ul>
        <p>Please return them on time to avoid inconvenience. In case of loss or damage, please report to the librarian.</p>
        <p style="margin-bottom:0">Regards,<br/>Library Management System</p>
      </div>
    </div>`;
  return sendMail({ to, subject: `Books borrowed from the library (${items.length})`, html });
};