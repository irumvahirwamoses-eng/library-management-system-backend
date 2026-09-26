import express from 'express';
import BorrowedBook from '../models/BorrowedBook.js';
import Book from '../models/Book.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import Notification from '../models/Notification.js';
import School from '../models/School.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';
import { sendBorrowReceipt, sendReturnReceipt } from '../utils/mailer.js';

const router = express.Router();

const LOAN_PERIOD_DAYS = 14;
const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

router.use(verifyToken, extractSchool);

const getBorrower = async (studentId, teacherId) => {
  if (studentId) {
    const s = await Student.findById(studentId).select('studentName email school');
    return s ? { type: 'student', id: s._id, name: s.studentName, email: s.email, school: s.school } : null;
  }
  if (teacherId) {
    const t = await Teacher.findById(teacherId).select('teacherName email school');
    return t ? { type: 'teacher', id: t._id, name: t.teacherName, email: t.email, school: t.school } : null;
  }
  return null;
};

const applyBorrow = async ({ items, studentId, teacherId, schoolId, userRole, userId, dueDate: dueDateInput }) => {
  const ids = items.map((i) => i.bookId);
  const books = await Book.find({ _id: { $in: ids } });
  const byId = new Map(books.map((b) => [String(b._id), b]));

  for (const item of items) {
    const book = byId.get(String(item.bookId));
    if (!book) return { error: `One of the selected books no longer exists` };
    if (item.quantity > book.available) {
      return { error: `Only ${book.available} copy/copies of "${book.title}" available` };
    }
  }

  const school = schoolId;
  const now = new Date();
  const dueDate = dueDateInput
    ? new Date(dueDateInput.length === 10 ? `${dueDateInput}T00:00:00` : dueDateInput)
    : addDays(now, LOAN_PERIOD_DAYS);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (dueDate && Number.isNaN(dueDate.getTime())) return { error: 'Invalid return date' };
  if (dueDate && dueDate.getTime() < startOfToday.getTime()) return { error: 'Return date cannot be in the past' };
  const created = [];
  const notifyItems = [];

  for (const item of items) {
    const book = byId.get(String(item.bookId));
    notifyItems.push({ title: book.title, author: book.author, quantity: item.quantity });
    for (let i = 0; i < item.quantity; i++) {
      created.push(await BorrowedBook.create({
        book: book._id,
        ...(studentId ? { student: studentId } : {}),
        ...(teacherId ? { teacher: teacherId } : {}),
        borrowDate: now,
        dueDate,
        status: 'borrowed',
        school
      }));
    }
    book.available -= item.quantity;
    await book.save();
    await logActivity({ schoolId: school, userRole, user: userId, action: 'BORROW', entity: 'Book', details: { book: book.title, quantity: item.quantity } });
  }

  return { created, notifyItems, dueDate };
};

router.get('/', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  const records = await BorrowedBook.find(filter)
    .populate('book', 'title author isbn')
    .populate('student', 'studentName nesaCode')
    .populate('teacher', 'teacherName identityNumber')
    .sort({ createdAt: -1 });
  res.json(records);
});

router.get('/my-history', async (req, res) => {
  try {
    const filter = { school: req.schoolId };
    if (req.user.role === 'student') filter.student = req.user.id;
    else if (req.user.role === 'teacher') filter.teacher = req.user.id;
    else return res.status(403).json({ error: 'Forbidden' });
    const records = await BorrowedBook.find(filter)
      .populate('book', 'title author isbn')
      .sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const { book: bookId, returnDate, ...rest } = req.body;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.available < 1) return res.status(400).json({ error: 'No copies available' });

    const schoolId = req.schoolId || req.body.school;
    const result = await applyBorrow({
      items: [{ bookId, quantity: 1 }],
      studentId: rest.student,
      teacherId: rest.teacher,
      schoolId,
      userRole: req.user.role,
      userId: req.user.id,
      dueDate: returnDate
    });
    if (result.error) return res.status(400).json({ error: result.error });

    await notifyBorrower(result, schoolId);
    res.status(201).json(result.created[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/bulk', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const { items, student, teacher, school, returnDate } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Provide at least one book to borrow' });
    }
    const normalized = items.map((it) => ({
      bookId: it.bookId || it.book,
      quantity: Math.max(1, parseInt(it.quantity, 10) || 1)
    }));
    const schoolId = req.schoolId || school;
    const result = await applyBorrow({
      items: normalized,
      studentId: student,
      teacherId: teacher,
      schoolId,
      userRole: req.user.role,
      userId: req.user.id,
      dueDate: returnDate
    });
    if (result.error) return res.status(400).json({ error: result.error });

    await notifyBorrower(result, schoolId);
    res.status(201).json({ count: result.created.length, records: result.created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const notifyBorrower = async (result, schoolId) => {
  try {
    const { created, notifyItems, dueDate } = result;
    const record = created[0];
    const borrower = await getBorrower(record.student, record.teacher);
    if (!borrower) return;
    const titles = notifyItems.map((i) => `${i.title}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ');
    await Notification.create({
      userType: borrower.type,
      user: borrower.id,
      message: `You borrowed ${created.length} book(s): ${titles}. Due by ${new Date(dueDate).toLocaleDateString()}`,
      school: schoolId || borrower.school
    });
    const school = await School.findById(schoolId || borrower.school).select('name');
    if (borrower.email) {
      sendBorrowReceipt({
        to: borrower.email,
        borrowerName: borrower.name,
        items: notifyItems,
        schoolName: school?.name,
        returnDate: dueDate
      }).catch((err) => console.log(`Borrow email failed (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}):`, err.message));
    }
  } catch (err) {
    console.log('Borrow notification failed:', err.message);
  }
};

const notifyReturned = async (records) => {
  try {
    const first = records[0];
    const borrower = first?.student
      ? { name: first.student.studentName, email: first.student.email, school: first.school }
      : first?.teacher
      ? { name: first.teacher.teacherName, email: first.teacher.email, school: first.school }
      : null;
    if (!borrower) return;

    const counts = new Map();
    for (const r of records) counts.set(String(r.book?._id), (counts.get(String(r.book?._id)) || 0) + 1);
    const items = [...counts].map(([bookId, quantity]) => {
      const r = records.find((x) => String(x.book?._id) === bookId);
      return { title: r?.book?.title || 'Book', quantity };
    });

    const school = await School.findById(borrower.school).select('name');
    await Notification.create({
      userType: first.student ? 'student' : 'teacher',
      user: first.student ? first.student._id : first.teacher._id,
      message: `You returned ${records.length} book(s) to the library`,
      school: borrower.school
    });
    if (borrower.email) {
      sendReturnReceipt({
        to: borrower.email,
        borrowerName: borrower.name,
        items,
        schoolName: school?.name
      }).catch((err) => console.log(`Return email failed (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}):`, err.message));
    }
  } catch (err) {
    console.log('Return notification failed:', err.message);
  }
};

router.put('/return-all', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const { student, teacher } = req.body;
    if (!student && !teacher) return res.status(400).json({ error: 'Provide either student or teacher' });

    const filter = { status: 'borrowed' };
    if (req.schoolId) filter.school = req.schoolId;
    if (student) filter.student = student;
    if (teacher) filter.teacher = teacher;

    const records = await BorrowedBook.find(filter)
      .populate('book', 'title')
      .populate('student', 'studentName email')
      .populate('teacher', 'teacherName email');
    if (records.length === 0) return res.status(404).json({ error: 'No borrowed books found for this borrower' });

    const counts = {};
    for (const r of records) counts[r.book._id] = (counts[r.book._id] || 0) + 1;

    await BorrowedBook.updateMany({ _id: { $in: records.map((r) => r._id) } }, { $set: { status: 'returned', returnDate: new Date() } });
    for (const [bookId, count] of Object.entries(counts)) {
      await Book.findByIdAndUpdate(bookId, { $inc: { available: count } });
    }
    await logActivity({ schoolId: req.schoolId || records[0]?.school, userRole: req.user.role, user: req.user.id, action: 'RETURN', entity: 'Book', details: { count: records.length } });
    await notifyReturned(records);
    res.json({ updated: records.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/return-book', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const { book, student, teacher } = req.body;
    if (!book) return res.status(400).json({ error: 'Provide the book to return' });
    if (!student && !teacher) return res.status(400).json({ error: 'Provide either student or teacher' });

    const filter = { status: 'borrowed', book };
    if (req.schoolId) filter.school = req.schoolId;
    if (student) filter.student = student;
    if (teacher) filter.teacher = teacher;

    const records = await BorrowedBook.find(filter)
      .populate('book', 'title author')
      .populate('student', 'studentName email')
      .populate('teacher', 'teacherName email');
    if (records.length === 0) return res.status(404).json({ error: 'No borrowed copies found for this book' });

    const count = records.length;
    await BorrowedBook.updateMany({ _id: { $in: records.map((r) => r._id) } }, { $set: { status: 'returned', returnDate: new Date() } });
    await Book.findByIdAndUpdate(book, { $inc: { available: count } });
    await logActivity({ schoolId: req.schoolId || records[0]?.school, userRole: req.user.role, user: req.user.id, action: 'RETURN', entity: 'Book', details: { book: records[0]?.book?.title, count } });
    await notifyReturned(records);
    res.json({ updated: count });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/return', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const record = await BorrowedBook.findById(req.params.id)
      .populate('student', 'studentName email')
      .populate('teacher', 'teacherName email')
      .populate('book', 'title');
    if (!record) return res.status(404).json({ error: 'Record not found' });
    if (record.status === 'returned') return res.status(400).json({ error: 'Already returned' });

    record.status = 'returned';
    record.returnDate = new Date();
    await record.save();

    const book = await Book.findById(record.book);
    if (book) {
      book.available += 1;
      await book.save();
    }

    await logActivity({ schoolId: record.school, userRole: req.user.role, user: req.user.id, action: 'RETURN', entity: 'Book', details: { book: book?.title } });
    await notifyReturned([record]);
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;