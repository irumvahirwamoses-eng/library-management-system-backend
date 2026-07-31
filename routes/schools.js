import express from 'express';
import School from '../models/School.js';
import Librarian from '../models/Librarian.js';
import bcrypt from 'bcryptjs';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.get('/', verifyToken, requireRole('superadmin'), async (req, res) => {
  const schools = await School.find().sort({ createdAt: -1 });
  res.json(schools);
});

router.get('/:id', verifyToken, async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) return res.status(404).json({ error: 'School not found' });
  res.json(school);
});

router.put('/:id', verifyToken, requireRole('superadmin'), async (req, res) => {
  const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await logActivity({ userRole: req.user.role, user: req.user.id, action: 'UPDATE', entity: 'School', details: { name: school?.name } });
  res.json(school);
});

router.put('/:id/password', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: 'School not found' });
    const librarian = await Librarian.findOne({ school: school._id });
    if (librarian) {
      librarian.password = await bcrypt.hash(password, 10);
      librarian.mustChangePassword = true;
      await librarian.save();
    }
    await logActivity({ userRole: req.user.role, user: req.user.id, action: 'RESET_PASSWORD', entity: 'School', details: { name: school.name } });
    res.json({ message: 'School admin password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const school = await School.findByIdAndUpdate(req.params.id, { status }, { new: true });
    await logActivity({ userRole: req.user.role, user: req.user.id, action: status === 'disabled' ? 'DISABLE' : 'ENABLE', entity: 'School', details: { name: school?.name } });
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', verifyToken, requireRole('superadmin'), async (req, res) => {
  const school = await School.findById(req.params.id);
  await School.findByIdAndDelete(req.params.id);
  await logActivity({ userRole: req.user.role, user: req.user.id, action: 'DELETE', entity: 'School', details: { name: school?.name } });
  res.json({ message: 'School deleted' });
});

export default router;
