import express from 'express';
import School from '../models/School.js';
import Librarian from '../models/Librarian.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import Book from '../models/Book.js';
import BorrowedBook from '../models/BorrowedBook.js';
import ActivityLog from '../models/ActivityLog.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken, requireRole('superadmin'));

router.get('/stats', async (req, res) => {
  try {
    const [schools, activeSchools, disabledSchools, libraries, students, teachers, books, borrowed, returned, logs] = await Promise.all([
      School.countDocuments(),
      School.countDocuments({ status: 'active' }),
      School.countDocuments({ status: 'disabled' }),
      Librarian.countDocuments(),
      Student.countDocuments(),
      Teacher.countDocuments(),
      Book.countDocuments(),
      BorrowedBook.countDocuments({ status: 'borrowed' }),
      BorrowedBook.countDocuments({ status: 'returned' }),
      ActivityLog.countDocuments()
    ]);
    res.json({ schools, activeSchools, disabledSchools, libraries, students, teachers, books, borrowed, returned, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const logs = await ActivityLog.find().populate('school', 'name').sort({ createdAt: -1 }).limit(500);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
