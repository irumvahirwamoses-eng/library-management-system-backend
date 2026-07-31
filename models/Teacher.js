import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema({
  teacherName: { type: String, required: true },
  subject: { type: String, required: true },
  phone: String,
  birthDate: Date,
  identityNumber: {
    type: String,
    required: true,
    match: [/^\d{16}$/, 'National ID must be exactly 16 digits']
  },
  password: { type: String, required: true },
  mustChangePassword: { type: Boolean, default: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }
}, { timestamps: true });

teacherSchema.index({ identityNumber: 1, school: 1 }, { unique: true });

export default mongoose.model('Teacher', teacherSchema);
