import express from 'express';
import BookAllocation from '../models/BookAllocation.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

router.get('/', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  const allocations = await BookAllocation.find(filter).populate('book').sort({ createdAt: -1 });
  res.json(allocations);
});

router.post('/', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const data = { ...req.body, school: req.schoolId || req.body.school };
    if (data.tableName) {
      data.tableName = String(data.tableName).trim().toLowerCase().split(/\s+/).filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    const allocation = await BookAllocation.create(data);
    await logActivity({ schoolId: data.school, userRole: req.user.role, user: req.user.id, action: 'CREATE', entity: 'Allocation', details: { tableName: allocation.tableName } });
    res.status(201).json(allocation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('librarian', 'superadmin'), async (req, res) => {
  const allocation = await BookAllocation.findById(req.params.id);
  await BookAllocation.findByIdAndDelete(req.params.id);
  await logActivity({ schoolId: allocation?.school, userRole: req.user.role, user: req.user.id, action: 'DELETE', entity: 'Allocation', details: { tableName: allocation?.tableName } });
  res.json({ message: 'Allocation deleted' });
});

export default router;
