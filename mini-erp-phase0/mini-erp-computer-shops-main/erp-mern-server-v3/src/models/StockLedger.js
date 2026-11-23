import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const StockLedgerSchema = new mongoose.Schema(
  {
    item: { type: ObjectId, ref: 'Item', required: true, index: true },
    warehouse: { type: ObjectId, ref: 'Warehouse', required: true, index: true },
    type: {
      type: String,
      enum: ['IN', 'OUT', 'MOVE', 'ADJ_IN', 'ADJ_OUT', 'SALE', 'PURCHASE', 'PURCHASE_RETURN', 'SALES_RETURN'],
      required: true,
    },
    qty: { type: Number, required: true }, // +IN, -OUT
    ref: { type: String, default: '' }, // مرجع العملية (PO/SO/Adj…)
    note: { type: String, default: '' },
    user: { type: ObjectId, ref: 'User' }, // User performing the action
  },
  { timestamps: true }
);

export default mongoose.model('StockLedger', StockLedgerSchema);
