import express from 'express';
import Report from '../models/Report.js';
import BorrowedBook from '../models/BorrowedBook.js';
import Book from '../models/Book.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

router.get('/', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  const reports = await Report.find(filter).sort({ createdAt: -1 }).limit(30);
  res.json(reports);
});

router.get('/stats', async (req, res) => {
  const sid = req.schoolId;
  const schoolFilter = sid ? { school: sid } : {};

  const [totalBooks, totalStudents, totalTeachers, borrowed, returned] = await Promise.all([
    Book.countDocuments(schoolFilter),
    Student.countDocuments(schoolFilter),
    Teacher.countDocuments(schoolFilter),
    BorrowedBook.countDocuments({ ...schoolFilter, status: 'borrowed' }),
    BorrowedBook.countDocuments({ ...schoolFilter, status: 'returned' })
  ]);

  res.json({ totalBooks, totalStudents, totalTeachers, borrowed, returned });
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
