import mongoose from 'mongoose';

const schoolApplicationSchema = new mongoose.Schema({
  schoolName: { type: String, required: true },
  schoolType: { type: String, enum: ['tvet', 'general_education'], required: true },
  district: { type: String, required: true },
  sector: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  adminName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: String
}, { timestamps: true });

export default mongoose.model('SchoolApplication', schoolApplicationSchema);
