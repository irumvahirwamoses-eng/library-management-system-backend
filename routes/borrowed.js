import express from 'express';
import BorrowedBook from '../models/BorrowedBook.js';
import Book from '../models/Book.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

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
    const { book: bookId, ...rest } = req.body;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (book.available < 1) return res.status(400).json({ error: 'No copies available' });

    const data = { ...rest, book: bookId, school: req.schoolId || req.body.school, borrowDate: new Date() };
    const record = await BorrowedBook.create(data);

    book.available -= 1;
    await book.save();

    await logActivity({ schoolId: data.school, userRole: req.user.role, user: req.user.id, action: 'BORROW', entity: 'Book', details: { book: book.title } });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/return', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const record = await BorrowedBook.findById(req.params.id);
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
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
