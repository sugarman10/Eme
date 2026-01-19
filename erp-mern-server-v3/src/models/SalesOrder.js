import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const SalesOrderSchema = new mongoose.Schema({
  customer: { type: ObjectId, ref: 'Customer', required: true },
  items: [{
    item: { type: ObjectId, ref: 'Item', required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  status: { type: String, enum: ['draft', 'confirmed', 'fulfilled', 'cancelled'], default: 'draft' },
  note: { type: String, default: '' },
  paid: { type: Number, default: 0 },
  totals: {
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    grand: { type: Number, default: 0 }
  }
}, { timestamps: true });


export default mongoose.model('SalesOrder', SalesOrderSchema);
