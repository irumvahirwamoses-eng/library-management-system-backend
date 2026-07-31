import express from 'express';
import bcrypt from 'bcryptjs';
import Student from '../models/Student.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

router.get('/', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  if (req.query.search) {
    filter.$or = [
      { nesaCode: { $regex: req.query.search, $options: 'i' } },
      { studentName: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  const students = await Student.find(filter).select('-password').sort({ createdAt: -1 });
  res.json(students);
});

router.get('/:id', async (req, res) => {
  const student = await Student.findById(req.params.id).select('-password');
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

router.post('/', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const data = { ...req.body, school: req.schoolId || req.body.school };
    data.password = await bcrypt.hash('changeme', 10);
    const student = await Student.create(data);
    await logActivity({ schoolId: data.school, userRole: req.user.role, user: req.user.id, action: 'CREATE', entity: 'Student', details: { name: student.studentName } });
    const { password, ...rest } = student.toObject();
    res.status(201).json(rest);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    if (req.body.password) delete req.body.password;
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    await logActivity({ schoolId: student?.school, userRole: req.user.role, user: req.user.id, action: 'UPDATE', entity: 'Student', details: { name: student?.studentName } });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('librarian', 'superadmin'), async (req, res) => {
  const student = await Student.findById(req.params.id);
  await Student.findByIdAndDelete(req.params.id);
  await logActivity({ schoolId: student?.school, userRole: req.user.role, user: req.user.id, action: 'DELETE', entity: 'Student', details: { name: student?.studentName } });
  res.json({ message: 'Student deleted' });
});

export default router;
