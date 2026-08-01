import express from 'express';
import mongoose from 'mongoose';
import Report from '../models/Report.js';
import BorrowedBook from '../models/BorrowedBook.js';
import Book from '../models/Book.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

const schoolMatch = (req) => {
  if (!req.schoolId) return {};
  const id = mongoose.Types.ObjectId.isValid(req.schoolId) ? new mongoose.Types.ObjectId(req.schoolId) : req.schoolId;
  return { school: id };
};

router.get('/', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  const reports = await Report.find(filter).sort({ createdAt: -1 }).limit(30);
  res.json(reports);
});

router.get('/stats', async (req, res) => {
  const sid = req.schoolId;
  const schoolFilter = sid ? { school: sid } : {};
  const match = sid ? [{ $match: schoolMatch(req) }] : [];

  const [totalBooks, availableBooks, totalStudents, totalTeachers, borrowed, returned] = await Promise.all([
    Book.aggregate([...match, { $group: { _id: null, t: { $sum: { $convert: { input: { $ifNull: ['$quantity', 1] }, to: 'int', onError: 1, onNull: 1 } } } } }]).then((r) => r[0]?.t || 0),
    Book.aggregate([...match, { $group: { _id: null, t: { $sum: { $convert: { input: { $ifNull: ['$available', 0] }, to: 'int', onError: 0, onNull: 0 } } } } }]).then((r) => r[0]?.t || 0),
    Student.countDocuments(schoolFilter),
    Teacher.countDocuments(schoolFilter),
    BorrowedBook.countDocuments({ ...schoolFilter, status: 'borrowed' }),
    BorrowedBook.countDocuments({ ...schoolFilter, status: 'returned' })
  ]);

  res.json({ totalBooks, availableBooks, totalStudents, totalTeachers, borrowed, returned });
});

router.get('/categories', async (req, res) => {
  try {
    const rows = await Book.aggregate([
      { $match: schoolMatch(req) },
      { $group: { _id: { $ifNull: ['$category', 'Uncategorized'] }, titles: { $sum: 1 }, copies: { $sum: { $convert: { input: { $ifNull: ['$quantity', 0] }, to: 'int', onError: 0, onNull: 0 } } } } },
      { $sort: { copies: -1, _id: 1 } }
    ]);
    res.json(rows.map((r) => ({ category: r._id, titles: r.titles, copies: r.copies })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/top-students', async (req, res) => {
  try {
    const rows = await BorrowedBook.aggregate([
      { $match: { ...schoolMatch(req), student: { $ne: null } } },
      { $group: { _id: '$student', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const students = await Student.find({ _id: { $in: rows.map((r) => r._id) } }).select('studentName nesaCode class level');
    const map = new Map(students.map((s) => [String(s._id), s]));
    res.json(rows.map((r) => {
      const s = map.get(String(r._id));
      return { _id: r._id, count: r.count, studentName: s?.studentName || 'Unknown', nesaCode: s?.nesaCode || '', class: s?.class || '', level: s?.level || '' };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/overdue', async (req, res) => {
  try {
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filter = { status: 'borrowed', borrowDate: { $lte: week } };
    if (req.schoolId) filter.school = req.schoolId;
    const records = await BorrowedBook.find(filter)
      .populate('book', 'title author isbn')
      .populate('student', 'studentName nesaCode class')
      .populate('teacher', 'teacherName')
      .sort({ borrowDate: 1 });
    res.json(records.map((r) => ({
      _id: r._id,
      book: r.book,
      borrowerName: r.student?.studentName || r.teacher?.teacherName || 'Unknown',
      type: r.student ? 'Student' : 'Teacher',
      borrowDate: r.borrowDate,
      daysOverdue: Math.floor((Date.now() - new Date(r.borrowDate)) / 86400000)
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const data = { ...req.body, school: req.schoolId || req.body.school };
    const report = await Report.create(data);
    res.status(201).json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
