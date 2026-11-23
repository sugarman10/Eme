import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const TransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
    flow: { type: String, enum: ['in', 'out'], required: true },
    category: { type: String, default: '' },
    amount: { type: Number, required: true, min: 0 },
    treasury: { type: ObjectId, ref: 'Treasury', required: true },
    relatedId: { type: ObjectId, default: null }, // Reference to Invoice/PO/etc
    relatedModel: { type: String, default: '' }, // 'SalesInvoice', 'PurchaseOrder', etc
    description: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('Transaction', TransactionSchema);
