import mongoose from 'mongoose';

const superAdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('SuperAdmin', superAdminSchema);
