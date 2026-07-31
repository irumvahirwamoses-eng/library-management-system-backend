import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  totalBorrowed: { type: Number, default: 0 },
  totalReturned: { type: Number, default: 0 },
  note: String,
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }
}, { timestamps: true });

export default mongoose.model('Report', reportSchema);
