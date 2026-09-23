import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  readAt: Date
}, { timestamps: true, versionKey: false });

export const Notification = mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema);