import express from 'express';
import Notification from '../models/Notification.js';
import { verifyToken, extractSchool } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

router.get('/', async (req, res) => {
  const filter = { school: req.schoolId };
  if (req.user.role === 'student') {
    filter.userType = 'student';
    filter.user = req.user.id;
  } else if (req.user.role === 'teacher') {
    filter.userType = 'teacher';
    filter.user = req.user.id;
  } else {
    filter.userType = 'librarian';
  }
  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json(notifications);
});

router.put('/:id/read', async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ message: 'Marked as read' });
});

export default router;
