import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

router.get('/', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const filter = req.schoolId ? { school: req.schoolId } : {};
    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
