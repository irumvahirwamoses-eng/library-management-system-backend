import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import SuperAdmin from '../models/SuperAdmin.js';
import Librarian from '../models/Librarian.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

const createToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    let user = null;
    let payload = null;

    user = await SuperAdmin.findOne({ email: identifier });
    if (user) {
      if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
      payload = { id: user._id, role: 'superadmin' };
    } else {
      user = await Librarian.findOne({ email: identifier }).populate('school');
      if (user) {
        if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
        payload = { id: user._id, role: 'librarian', schoolId: user.school._id };
      } else {
        user = await Student.findOne({ nesaCode: identifier }).populate('school');
        if (user) {
          if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
          payload = { id: user._id, role: 'student', schoolId: user.school._id };
        } else {
          user = await Teacher.findOne({ identityNumber: identifier }).populate('school');
          if (user) {
            if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });
            payload = { id: user._id, role: 'teacher', schoolId: user.school._id };
          } else {
            return res.status(401).json({ error: 'Invalid credentials' });
          }
        }
      }
    }

    const token = createToken(payload);
    res.json({ token, mustChangePassword: user.mustChangePassword || false, role: payload.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { id, role } = req.user;
    let user;

    if (role === 'superadmin') user = await SuperAdmin.findById(id);
    else if (role === 'librarian') user = await Librarian.findById(id);
    else if (role === 'student') user = await Student.findById(id);
    else if (role === 'teacher') user = await Teacher.findById(id);
    else return res.status(400).json({ error: 'Invalid role' });

    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/change-email', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;
    const { id, role } = req.user;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    let user;
    if (role === 'superadmin') {
      const existing = await SuperAdmin.findOne({ email, _id: { $ne: id } });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
      user = await SuperAdmin.findByIdAndUpdate(id, { email }, { new: true }).select('-password');
    } else if (role === 'librarian') {
      const existing = await Librarian.findOne({ email, _id: { $ne: id } });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
      user = await Librarian.findByIdAndUpdate(id, { email }, { new: true }).select('-password').populate('school');
    } else {
      return res.status(400).json({ error: 'Email change not available for this role' });
    }

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ...user.toObject(), role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const { id, role } = req.user;
    let user;
    if (role === 'superadmin') user = await SuperAdmin.findById(id).select('-password');
    else if (role === 'librarian') user = await Librarian.findById(id).select('-password').populate('school');
    else if (role === 'student') user = await Student.findById(id).select('-password').populate('school');
    else if (role === 'teacher') user = await Teacher.findById(id).select('-password').populate('school');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ...user.toObject(), role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
