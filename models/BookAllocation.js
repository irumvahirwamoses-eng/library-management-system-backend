import mongoose from 'mongoose';

const bookAllocationSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  tableName: { type: String, required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }
}, { timestamps: true });

export default mongoose.model('BookAllocation', bookAllocationSchema);
