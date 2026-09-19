import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  nesaCode: {
    type: String,
    required: true,
    match: [/^\d{12}$/, 'NESA code must be exactly 12 digits']
  },
  studentName: { type: String, required: true },
  class: String,
  email: String,
  phonenumber: String,
  birthDate: Date,
  level: { type: String, enum: ['level3', 'level4', 'level5', ''] },
  password: { type: String, required: true },
  mustChangePassword: { type: Boolean, default: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }
}, { timestamps: true });

studentSchema.index({ nesaCode: 1, school: 1 }, { unique: true });

export default mongoose.model('Student', studentSchema);
