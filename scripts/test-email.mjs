import 'dotenv/config';
import { getSenderName, sendBorrowReceipt, sendReturnReceipt, sendDueReminder } from '../utils/mailer.js';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/test-email.mjs you@example.com');
  process.exit(1);
}

console.log('EMAIL_NOTIFICATIONS_ENABLED =', JSON.stringify(process.env.EMAIL_NOTIFICATIONS_ENABLED));
console.log('MAIL_SENDER_NAME =', JSON.stringify(getSenderName()));
console.log('BREVO_API_KEY set =', !!process.env.BREVO_API_KEY);
console.log('SMTP_HOST =', process.env.SMTP_HOST, '| SMTP_PORT =', process.env.SMTP_PORT);
console.log('SMTP_USER =', process.env.SMTP_USER);
console.log('SMTP_FROM =', process.env.SMTP_FROM);
console.log('SMTP_PASS set =', !!process.env.SMTP_PASS, '| length =', (process.env.SMTP_PASS || '').length, '| starts with xkeysib =', (process.env.SMTP_PASS || '').startsWith('xkeysib-'));
console.log('');

const sent = async (label, info) => {
  if (info) console.log(`${label}: SUCCESS ->`, info.messageId);
  else console.log(`${label}: NOT SENT (skipped silently). Check EMAIL_NOTIFICATIONS_ENABLED=true, SMTP_FROM, and credentials/API key.`);
};

const items = [
  { title: 'Test Book', author: 'Author', quantity: 1 },
  { title: 'Another Test Book', author: 'Author 2', quantity: 2 }
];

try {
  const borrow = await sendBorrowReceipt({
    to,
    borrowerName: 'Test User',
    items,
    schoolName: 'Test School',
    returnDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  });
  await sent('BORROW', borrow);
} catch (e) {
  const resp = e.response ? ` (server response: ${JSON.stringify(e.response).slice(0, 300)})` : '';
  console.log('BORROW: FAILED ->', e.code, e.message, resp);
}

try {
  const ret = await sendReturnReceipt({
    to,
    borrowerName: 'Test User',
    items,
    schoolName: 'Test School'
  });
  await sent('RETURN', ret);
} catch (e) {
  const resp = e.response ? ` (server response: ${JSON.stringify(e.response).slice(0, 300)})` : '';
  console.log('RETURN: FAILED ->', e.code, e.message, resp);
}

try {
  const reminder = await sendDueReminder({
    to,
    borrowerName: 'Test User',
    items: [
      { title: 'Overdue Book', author: 'Author', quantity: 1, note: 'Due: Sep 20, 2026' },
      { title: 'Due Today', author: 'Author 2', quantity: 1, note: 'Due: Sep 26, 2026' }
    ],
    schoolName: 'Test School'
  });
  await sent('REMINDER', reminder);
} catch (e) {
  const resp = e.response ? ` (server response: ${JSON.stringify(e.response).slice(0, 300)})` : '';
  console.log('REMINDER: FAILED ->', e.code, e.message, resp);
} finally {
  process.exit(0);
}