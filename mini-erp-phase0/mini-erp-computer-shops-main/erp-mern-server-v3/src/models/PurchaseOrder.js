import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const PurchaseOrderSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true },
    supplier: { type: ObjectId, ref: 'Supplier', required: true },
    currency: { type: String, enum: ['LYD', 'USD'], default: 'LYD' },
    exchangeRate: { type: Number, default: 7.30, min: 0.01 },
    items: [
      {
        item: { type: ObjectId, ref: 'Item', required: true },
        qty: { type: Number, required: true },
        cost: { type: Number, required: true }, // Cost in LYD
        costUSD: { type: Number, default: 0 },   // Cost in USD
        currency: { type: String, enum: ['LYD', 'USD'], default: 'LYD' },
      },
    ],
    warehouse: { type: ObjectId, ref: 'Warehouse', default: null }, // Target warehouse for stock
    status: { type: String, enum: ['pending', 'approved', 'received', 'cancelled', 'returned'], default: 'pending' },
    paymentMethod: { type: String, enum: ['cash', 'credit'], default: 'credit' },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0 }, // Total in LYD
    totalAmountUSD: { type: Number, default: 0 }, // Total in USD
    paidAmount: { type: Number, default: 0 },
    paidAmountUSD: { type: Number, default: 0 },
    note: { type: String, default: '' },
    receivedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('PurchaseOrder', PurchaseOrderSchema);
