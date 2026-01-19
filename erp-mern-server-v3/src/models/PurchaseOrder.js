import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const PurchaseOrderSchema = new mongoose.Schema({
  supplier: { type: ObjectId, ref: 'Supplier', required: true },
  items: [{
    item: { type: ObjectId, ref: 'Item', required: true },
    qty: { type: Number, required: true },
    cost: { type: Number, required: true }
  }],
  warehouse: { type: ObjectId, ref: 'Warehouse', default: null }, // Target warehouse for stock
  status: { type: String, enum: ['pending', 'approved', 'received', 'cancelled'], default: 'pending' },
  totalAmount: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  note: { type: String, default: '' },
  receivedAt: { type: Date }
}, { timestamps: true });


export default mongoose.model('PurchaseOrder', PurchaseOrderSchema);
