import express from 'express';
import Request from '../models/Request.js';
import Notification from '../models/Notification.js';
import Book from '../models/Book.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

router.get('/', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  if (req.user.role === 'student') filter.student = req.user.id;
  const requests = await Request.find(filter)
    .populate('student', 'studentName nesaCode class')
    .populate('teacher', 'teacherName')
    .populate('book', 'title author isbn')
    .sort({ createdAt: -1 });
  res.json(requests);
});

router.post('/', requireRole('student', 'teacher'), async (req, res) => {
  try {
    const data = { ...req.body, school: req.schoolId || req.body.school };
    if (req.user.role === 'student') data.student = req.user.id;
    else data.teacher = req.user.id;
    const request = await Request.create(data);

    await Notification.create({
      userType: 'librarian', user: null,
      message: `New book request from ${req.user.role}`,
      school: data.school
    });
    await logActivity({ schoolId: data.school, userRole: req.user.role, user: req.user.id, action: 'REQUEST', entity: 'Book', details: { bookId: req.body.book } });
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/approve', requireRole('librarian', 'superadmin'), async (req, res) => {
  const request = await Request.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true })
    .populate('student', 'studentName')
    .populate('teacher', 'teacherName')
    .populate('book', 'title');

  if (request?.student) {
    await Notification.create({ userType: 'student', user: request.student._id, message: `Your book request for "${request.book?.title}" was approved. The book has arrived.`, school: request.school });
  }
  if (request?.teacher) {
    await Notification.create({ userType: 'teacher', user: request.teacher._id, message: `Your book request for "${request.book?.title}" was approved. The book has arrived.`, school: request.school });
  }
  await logActivity({ schoolId: request?.school, userRole: req.user.role, user: req.user.id, action: 'APPROVE', entity: 'Request', details: { book: request?.book?.title } });
  res.json(request);
});

router.put('/:id/reject', requireRole('librarian', 'superadmin'), async (req, res) => {
  const request = await Request.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true })
    .populate('student', 'studentName')
    .populate('teacher', 'teacherName')
    .populate('book', 'title');

  if (request?.student) {
    await Notification.create({ userType: 'student', user: request.student._id, message: `Your book request for "${request.book?.title}" was rejected. The book was not found.`, school: request.school });
  }
  if (request?.teacher) {
    await Notification.create({ userType: 'teacher', user: request.teacher._id, message: `Your book request for "${request.book?.title}" was rejected. The book was not found.`, school: request.school });
  }
  await logActivity({ schoolId: request?.school, userRole: req.user.role, user: req.user.id, action: 'REJECT', entity: 'Request', details: { book: request?.book?.title } });
  res.json(request);
});

export default router;
