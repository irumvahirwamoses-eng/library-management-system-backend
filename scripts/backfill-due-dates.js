import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import BorrowedBook from '../models/BorrowedBook.js';

const DAYS = 14;

const run = async () => {
  await connectDB();
  const records = await BorrowedBook.find({ dueDate: { $exists: false } });
  let updated = 0;
  for (const r of records) {
    const base = r.borrowDate || r.createdAt || new Date();
    r.dueDate = new Date(base.getTime() + DAYS * 24 * 60 * 60 * 1000);
    await r.save();
    updated++;
  }
  console.log(`Backfilled dueDate (borrowDate + ${DAYS} days) for ${updated} record(s).`);
  await mongoose.disconnect();
};

run().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});