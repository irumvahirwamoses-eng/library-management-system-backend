import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userType: { type: String, enum: ['student', 'librarian', 'teacher'], required: true },
  user: { type: mongoose.Schema.Types.ObjectId, default: null },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
