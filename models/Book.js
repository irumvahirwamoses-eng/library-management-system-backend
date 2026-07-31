import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: String,
  category: String,
  isbn: String,
  quantity: { type: Number, default: 0 },
  available: { type: Number, default: 0 },
  location: { type: String, default: '' },
  archived: { type: Boolean, default: false },
  archivedAt: Date,
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }
}, { timestamps: true });

bookSchema.index({ title: 'text', author: 'text', isbn: 'text' });
bookSchema.index({ school: 1 });
bookSchema.index({ archived: 1 });

export default mongoose.model('Book', bookSchema);
