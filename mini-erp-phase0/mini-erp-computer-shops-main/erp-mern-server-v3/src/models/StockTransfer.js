import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const StockTransferSchema = new mongoose.Schema(
  {
    transferNumber: { type: String, required: true, unique: true, index: true },
    fromWarehouse: { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    toWarehouse: { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    date: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ['completed', 'pending', 'cancelled'],
      default: 'completed',
    },
    items: [
      {
        item: { type: ObjectId, ref: 'Item', required: true },
        name: { type: String, default: '' },
        sku: { type: String, default: '' },
        qty: { type: Number, required: true, min: 1 },
        note: { type: String, default: '' },
      },
    ],
    totalItems: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    note: { type: String, default: '' },
    user: { type: ObjectId, ref: 'User' },
    cancelledBy: { type: ObjectId, ref: 'User' },
    cancelledAt: { type: Date },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('StockTransfer', StockTransferSchema);
