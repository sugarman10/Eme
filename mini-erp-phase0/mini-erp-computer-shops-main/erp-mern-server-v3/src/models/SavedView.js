import mongoose from 'mongoose';

const savedViewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['DASHBOARD'],
      default: 'DASHBOARD',
    },
    params: {
      from: String,
      to: String,
      warehouseId: String,
      comparePrevious: Boolean,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast user queries
savedViewSchema.index({ userId: 1, type: 1 });

export default mongoose.model('SavedView', savedViewSchema);
