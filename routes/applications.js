import express from 'express';
import bcrypt from 'bcryptjs';
import SchoolApplication from '../models/SchoolApplication.js';
import School from '../models/School.js';
import Librarian from '../models/Librarian.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const application = await SchoolApplication.create(req.body);
    res.status(201).json(application);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', verifyToken, requireRole('superadmin'), async (req, res) => {
  const apps = await SchoolApplication.find().sort({ createdAt: -1 });
  res.json(apps);
});

router.put('/:id/approve', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const app = await SchoolApplication.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const school = await School.create({
      name: app.schoolName, type: app.schoolType,
      district: app.district, sector: app.sector,
      phone: app.phone, email: app.email,
      adminName: app.adminName, status: 'active'
    });

    await Librarian.create({
      name: app.adminName, email: app.email,
      password: await bcrypt.hash('admin@2026', 10),
      school: school._id, mustChangePassword: true
    });

    res.json({ message: 'School approved and created', school });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/reject', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const app = await SchoolApplication.findByIdAndUpdate(req.params.id,
      { status: 'rejected', rejectionReason: req.body.reason }, { new: true });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    res.json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
