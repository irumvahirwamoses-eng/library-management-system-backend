import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }
}, { timestamps: true });

export default mongoose.model('Request', requestSchema);
