import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: String, required: true }, // e.g., 'admin', or specific userId
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'warning', 'error', 'success'], default: 'info' },
    read: { type: Boolean, default: false },
    link: { type: String }, // Optional link to resource
    metadata: { type: Object }, // Optional extra data
  },
  { timestamps: true }
);

export default mongoose.model('Notification', NotificationSchema);
