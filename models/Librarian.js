import mongoose from 'mongoose';

const librarianSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  profilePic: { type: String, default: 'default.png' },
  mustChangePassword: { type: Boolean, default: false }
}, { timestamps: true });

librarianSchema.index({ email: 1, school: 1 }, { unique: true });

export default mongoose.model('Librarian', librarianSchema);
