import BorrowedBook from '../models/BorrowedBook.js';
import Notification from '../models/Notification.js';
import School from '../models/School.js';
import { sendDueReminder } from './mailer.js';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const fmtDay = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

// Sends due-date reminders (in-app notification + email) for every borrowed book
// whose due date has arrived. Runs once per borrower per day thanks to lastReminderAt.
export const runDueReminders = async () => {
  try {
    const todayStart = startOfToday();
    const records = await BorrowedBook.find({
      status: 'borrowed',
      dueDate: { $exists: true, $lte: new Date() }
    })
      .populate('book', 'title author')
      .populate('student', 'studentName email school')
      .populate('teacher', 'teacherName email school');

    if (records.length === 0) return { checked: 0, notified: 0 };

    const groups = new Map();
    const keyOf = (r) => (r.student ? `s:${r.student._id}` : r.teacher ? `t:${r.teacher._id}` : null);

    for (const r of records) {
      const key = keyOf(r);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    let notified = 0;
    for (const list of groups.values()) {
      const first = list[0];
      const borrower = first.student || first.teacher;
      if (!borrower) continue;
      const type = first.student ? 'student' : 'teacher';
      const name = first.student ? first.student.studentName : first.teacher.teacherName;

      if (list.some((r) => r.lastReminderAt && r.lastReminderAt >= todayStart)) continue;

      const agg = new Map();
      for (const r of list) {
        const bk = r.book;
        if (!bk) continue;
        const key = `${String(bk._id)}|${r.dueDate ? r.dueDate.toISOString() : ''}`;
        const entry = agg.get(key) || {
          title: bk.title,
          author: bk.author,
          note: r.dueDate ? `Due: ${fmtDay(r.dueDate)}` : '',
          quantity: 0
        };
        entry.quantity += 1;
        agg.set(key, entry);
      }
      const items = [...agg.values()];
      if (items.length === 0) continue;

      await Notification.create({
        userType: type,
        user: borrower._id,
        message: `Return reminder: ${items.reduce((s, it) => s + it.quantity, 0)} book(s) are due. Please return them to the library.`,
        school: borrower.school || list[0]?.school
      });

      const school = borrower.school ? await School.findById(borrower.school).select('name') : null;
      if (borrower.email) {
        await sendDueReminder({ to: borrower.email, borrowerName: name, items, schoolName: school?.name });
      }

      await BorrowedBook.updateMany(
        { _id: { $in: list.map((r) => r._id) } },
        { $set: { lastReminderAt: new Date() } }
      );
      notified += 1;
    }

    console.log(`Due reminders: checked ${records.length} borrowed book(s), notified ${notified} borrower(s)`);
    return { checked: records.length, notified };
  } catch (err) {
    console.log('Due reminders failed:', err.message);
    return { checked: 0, notified: 0, error: err.message };
  }
};