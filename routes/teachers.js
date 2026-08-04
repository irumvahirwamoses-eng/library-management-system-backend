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

router.post('/import-bulk', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const { teachers } = req.body;
    if (!Array.isArray(teachers) || teachers.length === 0) {
      return res.status(400).json({ error: 'No teachers provided' });
    }
    const schoolId = req.schoolId || req.body.school;
    const hashedPassword = await bcrypt.hash('changeme', 10);
    const results = { imported: 0, errors: [] };
    for (let i = 0; i < teachers.length; i++) {
      const row = teachers[i];
      try {
        const teacherName = String(row.teacherName || '').trim();
        const subject = String(row.subject || '').trim();
        const identityNumber = String(row.identityNumber || '').replace(/\s/g, '').trim();
        if (!teacherName) {
          results.errors.push({ row: i + 1, identityNumber, error: 'Teacher name is required' });
          continue;
        }
        if (!identityNumber || !/^\d{16}$/.test(identityNumber)) {
          results.errors.push({ row: i + 1, identityNumber: row.identityNumber, error: 'National ID must be exactly 16 digits' });
          continue;
        }
        const exists = await Teacher.findOne({ identityNumber, school: schoolId });
        if (exists) {
          results.errors.push({ row: i + 1, identityNumber, error: 'Teacher with this ID already exists' });
          continue;
        }
        await Teacher.create({
          teacherName,
          subject,
          identityNumber,
          phone: row.phone || '',
          password: hashedPassword,
          mustChangePassword: true,
          school: schoolId
        });
        results.imported++;
      } catch (err) {
        results.errors.push({ row: i + 1, identityNumber: row.identityNumber, error: err.message });
      }
    }
    if (results.imported > 0) {
      await logActivity({ schoolId, userRole: req.user.role, user: req.user.id, action: 'IMPORT', entity: 'Teacher', details: { count: results.imported } });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
