import mongoose from 'mongoose';

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['tvet', 'general_education'], required: true },
  district: { type: String, required: true },
  sector: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  adminName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'active' },
  rejectionReason: String
}, { timestamps: true });

export default mongoose.model('School', schoolSchema);
