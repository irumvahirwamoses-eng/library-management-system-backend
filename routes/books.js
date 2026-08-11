import express from 'express';
import Book from '../models/Book.js';
import BookAllocation from '../models/BookAllocation.js';
import { verifyToken, extractSchool, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.use(verifyToken, extractSchool);

router.get('/', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  const archived = req.query.archived === 'true';
  filter.archived = archived ? true : { $ne: true };
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }
  if (req.query.category) {
    const cat = String(req.query.category).trim();
    filter.category = new RegExp('^' + cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
  }
  if (req.query.location) filter.location = req.query.location;
  if (req.query.availability === 'available') filter.available = { $gt: 0 };
  if (req.query.availability === 'unavailable') filter.available = { $lte: 0 };
  const books = await Book.find(filter).sort({ createdAt: -1 });
  res.json(books);
});

router.get('/locations', async (req, res) => {
  const filter = req.schoolId ? { school: req.schoolId } : {};
  const locations = await Book.distinct('location', { ...filter, location: { $ne: '' } });
  const tableNames = await BookAllocation.distinct('tableName', filter);
  const seen = new Set();
  const result = [];
  for (const loc of [...locations, ...tableNames]) {
    if (loc && !seen.has(String(loc).toLowerCase())) { seen.add(String(loc).toLowerCase()); result.push(loc); }
  }
  res.json(result);
});

router.get('/:id', async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

router.post('/', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const quantity = Number(req.body.quantity ?? 1);
    const available = req.body.available === undefined || req.body.available === '' ? quantity : Number(req.body.available);
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: 'Quantity must be a non-negative number' });
    if (!Number.isFinite(available) || available < 0) return res.status(400).json({ error: 'Available must be a non-negative number' });
    if (available > quantity) return res.status(400).json({ error: 'Available copies cannot be greater than quantity' });
    const data = { ...req.body, quantity, available, school: req.schoolId || req.body.school };
    if (data.category) data.category = String(data.category).trim().toUpperCase();
    const book = await Book.create(data);
    await logActivity({ schoolId: data.school, userRole: req.user.role, user: req.user.id, action: 'CREATE', entity: 'Book', details: { title: book.title, quantity } });
    res.status(201).json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const existing = await Book.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Book not found' });
    const quantity = req.body.quantity === undefined ? existing.quantity : Number(req.body.quantity);
    const available = req.body.available === undefined ? existing.available : Number(req.body.available);
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: 'Quantity must be a non-negative number' });
    if (!Number.isFinite(available) || available < 0) return res.status(400).json({ error: 'Available must be a non-negative number' });
    if (available > quantity) return res.status(400).json({ error: 'Available copies cannot be greater than quantity' });
    const updates = { ...req.body, quantity, available };
    if (updates.category) updates.category = String(updates.category).trim().toUpperCase();
    const book = await Book.findByIdAndUpdate(req.params.id, updates, { new: true });
    await logActivity({ schoolId: book?.school, userRole: req.user.role, user: req.user.id, action: 'UPDATE', entity: 'Book', details: { title: book?.title, quantity } });
    res.json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/archive', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, { archived: true, archivedAt: new Date() }, { new: true });
    await logActivity({ schoolId: book?.school, userRole: req.user.role, user: req.user.id, action: 'ARCHIVE', entity: 'Book', details: { title: book?.title } });
    res.json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id/restore', requireRole('librarian', 'superadmin'), async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, { archived: false, archivedAt: null }, { new: true });
    await logActivity({ schoolId: book?.school, userRole: req.user.role, user: req.user.id, action: 'RESTORE', entity: 'Book', details: { title: book?.title } });
    res.json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireRole('librarian', 'superadmin'), async (req, res) => {
  const book = await Book.findById(req.params.id);
  await Book.findByIdAndDelete(req.params.id);
  await logActivity({ schoolId: book?.school, userRole: req.user.role, user: req.user.id, action: 'DELETE', entity: 'Book', details: { title: book?.title } });
  res.json({ message: 'Book deleted' });
});

export default router;
