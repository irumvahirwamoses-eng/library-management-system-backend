import express from 'express';
import bcrypt from 'bcryptjs';
import Teacher from '../models/Teacher.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

router.get('/', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  const teachers = await Teacher.find(filter).select('-password').sort({ createdAt: -1 });
  res.json(teachers);
});

router.get('/:id', async (req, res) => {
  const teacher = await Teacher.findById(req.params.id).select('-password');
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  res.json(teacher);
});

router.post('/', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const data = { ...req.body, school: req.schoolId || req.body.school };
    data.password = await bcrypt.hash('changeme', 10);
    const teacher = await Teacher.create(data);
    await logActivity({ schoolId: data.school, userRole: req.user.role, user: req.user.id, action: 'CREATE', entity: 'Teacher', details: { name: teacher.teacherName } });
    const { password, ...rest } = teacher.toObject();
    res.status(201).json(rest);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    if (req.body.password) delete req.body.password;
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    await logActivity({ schoolId: teacher?.school, userRole: req.user.role, user: req.user.id, action: 'UPDATE', entity: 'Teacher', details: { name: teacher?.teacherName } });
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('librarian', 'superadmin'), async (req, res) => {
  const teacher = await Teacher.findById(req.params.id);
  await Teacher.findByIdAndDelete(req.params.id);
  await logActivity({ schoolId: teacher?.school, userRole: req.user.role, user: req.user.id, action: 'DELETE', entity: 'Teacher', details: { name: teacher?.teacherName } });
  res.json({ message: 'Teacher deleted' });
});

export default router;
