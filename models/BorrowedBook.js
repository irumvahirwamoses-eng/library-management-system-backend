import mongoose from 'mongoose';

const borrowedBookSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  borrowDate: Date,
  dueDate: Date,
  returnDate: Date,
  lastReminderAt: Date,
  status: { type: String, enum: ['borrowed', 'returned'], default: 'borrowed' },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }
}, { timestamps: true });

export default mongoose.model('BorrowedBook', borrowedBookSchema);
