import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import { runDueReminders } from './utils/reminders.js';

import authRoutes from './routes/auth.js';
import applicationRoutes from './routes/applications.js';
import schoolRoutes from './routes/schools.js';
import bookRoutes from './routes/books.js';
import studentRoutes from './routes/students.js';
import teacherRoutes from './routes/teachers.js';
import allocationRoutes from './routes/allocations.js';
import borrowedRoutes from './routes/borrowed.js';
import requestRoutes from './routes/requests.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import activityRoutes from './routes/activity.js';
import systemRoutes from './routes/system.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/borrowed', borrowedRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/system', systemRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  runDueReminders();
  setInterval(runDueReminders, 6 * 60 * 60 * 1000);
});
