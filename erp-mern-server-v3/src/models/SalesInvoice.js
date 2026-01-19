import mongoose from 'mongoose'
const { ObjectId } = mongoose.Schema.Types

const SalesInvoiceSchema = new mongoose.Schema({
  number: { type: String, unique: true, sparse: true }, // Auto-generated invoice number
  date: { type: Date, required: true },
  customer: { type: ObjectId, ref: 'Customer' },
  cashier: { type: ObjectId, ref: 'User', default: null }, // User who created the invoice
  channel: { type: String, enum: ['wholesale', 'retail'], required: true }, // Keep for compatibility
  type: { type: String, enum: ['official', 'proforma', 'retail', 'wholesale'], default: 'official' },
  items: [{
    item: { type: ObjectId, ref: 'Item', required: true },
    qty: { type: Number, required: true, min: 0.0001 },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0 } // Track cost for profit calculation
  }],
  warehouse: { type: ObjectId, ref: 'Warehouse', default: null }, // Source warehouse for stock
  treasury: { type: ObjectId, ref: 'Treasury', default: null }, // Target treasury for payment
  note: { type: String, default: '' },
  paymentMethod: { type: String, enum: ['cash', 'card', 'bank', 'check', 'credit', 'split', 'wallet'], default: 'cash' },
  status: { type: String, enum: ['draft', 'confirmed', 'posted', 'pending', 'returned', 'void', 'refund', 'cancelled'], default: 'confirmed' },
  returns: [{
    item: { type: ObjectId, ref: 'Item' },
    qty: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    returnId: { type: ObjectId, ref: 'SalesReturn', default: null }
  }],
  discountValue: { type: Number, default: 0 },
  totals: {
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 }, // Unpaid amount
    grand: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Performance Indexes
SalesInvoiceSchema.index({ date: -1 });  // Recent invoices first
SalesInvoiceSchema.index({ customer: 1 });  // Customer history lookups
SalesInvoiceSchema.index({ status: 1 });  // Status filtering
SalesInvoiceSchema.index({ warehouse: 1 });  // Warehouse reports
SalesInvoiceSchema.index({ status: 1, date: -1 });  // Common combined query

export default mongoose.model('SalesInvoice', SalesInvoiceSchema)
