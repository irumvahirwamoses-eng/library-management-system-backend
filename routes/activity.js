import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import SuperAdmin from '../models/SuperAdmin.js';
import Librarian from '../models/Librarian.js';
import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

const NAME_FIELDS = { student: ['studentName', 'nesaCode'], teacher: ['teacherName'], librarian: ['email'], superadmin: ['email'] };

async function resolveUserNames(logs) {
  const entries = logs.filter((l) => l.user && l.user !== 'System').map((l) => ({ id: String(l.user), role: l.userRole }));
  const byRole = (role) => [...new Set(entries.filter((e) => e.role === role).map((e) => e.id))];
  const [supers, libs, students, teachers] = await Promise.all([
    SuperAdmin.find({ _id: { $in: byRole('superadmin') } }).select('email'),
    Librarian.find({ _id: { $in: byRole('librarian') } }).select('email'),
    Student.find({ _id: { $in: byRole('student') } }).select('studentName nesaCode'),
    Teacher.find({ _id: { $in: byRole('teacher') } }).select('teacherName')
  ]);
  const names = new Map();
  supers.forEach((u) => names.set(String(u._id), u.email));
  libs.forEach((u) => names.set(String(u._id), u.email));
  students.forEach((u) => names.set(String(u._id), u.nesaCode ? `${u.studentName} (${u.nesaCode})` : u.studentName));
  teachers.forEach((u) => names.set(String(u._id), u.teacherName));
  return logs.map((l) => {
    const obj = l.toObject();
    if (obj.user && obj.user !== 'System' && names.has(String(obj.user))) obj.user = names.get(String(obj.user));
    return obj;
  });
}

router.get('/', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const filter = req.schoolId ? { school: req.schoolId } : {};
    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json(await resolveUserNames(logs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
