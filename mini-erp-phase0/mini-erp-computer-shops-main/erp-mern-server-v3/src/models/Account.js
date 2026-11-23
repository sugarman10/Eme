import mongoose from 'mongoose';

const AccountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['asset', 'liability', 'equity', 'revenue', 'expense'], required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    balance: { type: Number, default: 0 },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for faster lookups
AccountSchema.index({ parentId: 1 });

export default mongoose.model('Account', AccountSchema);
