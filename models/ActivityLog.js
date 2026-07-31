import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  user: { type: String },
  userRole: { type: String, enum: ['superadmin', 'librarian', 'student', 'teacher', 'system'] },
  action: { type: String, required: true },
  entity: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

activityLogSchema.index({ school: 1 });
activityLogSchema.index({ createdAt: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);
