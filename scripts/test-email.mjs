import 'dotenv/config';
import { sendBorrowReceipt } from '../utils/mailer.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/test-email.mjs you@example.com');
  process.exit(1);
}

console.log('EMAIL_NOTIFICATIONS_ENABLED =', JSON.stringify(process.env.EMAIL_NOTIFICATIONS_ENABLED));
console.log('SMTP_HOST =', process.env.SMTP_HOST, '| SMTP_PORT =', process.env.SMTP_PORT);
console.log('SMTP_USER =', process.env.SMTP_USER);
console.log('SMTP_FROM =', process.env.SMTP_FROM);
console.log('SMTP_PASS set =', !!process.env.SMTP_PASS, '| length =', (process.env.SMTP_PASS || '').length, '| starts with xkeysib =', (process.env.SMTP_PASS || '').startsWith('xkeysib-'));

try {
  const info = await sendBorrowReceipt({
    to,
    borrowerName: 'Test User',
    items: [{ title: 'Test Book', author: 'Author', quantity: 1 }]
  });
  if (info) console.log('SUCCESS -> messageId:', info.messageId);
  else console.log('NOT SENT (skipped silently). Check EMAIL_NOTIFICATIONS_ENABLED=true, SMTP_FROM, and SMTP credentials.');
} catch (e) {
  const resp = e.response ? ` (server response: ${JSON.stringify(e.response).slice(0, 300)})` : '';
  console.log('FAILED ->', e.code, e.message, resp);
} finally {
  process.exit(0);
}