import mongoose from 'mongoose'

const receiptSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    date: { type: Date, required: true, default: Date.now },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'bank', 'check', 'split', 'wallet'], default: 'cash' },
    note: { type: String },
    // Changed from SalesOrder to SalesInvoice
    invoices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SalesInvoice' }],
    // New field: detailed allocation of payment to invoices
    allocations: [{
        invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesInvoice', required: true },
        amount: { type: Number, required: true, min: 0 }
    }]
}, {
    timestamps: true
})

// Performance Indexes
receiptSchema.index({ customer: 1 });  // Customer receipt lookups
receiptSchema.index({ date: -1 });  // Date range queries
receiptSchema.index({ customer: 1, date: -1 });  // Combined customer + date queries

export default mongoose.model('Receipt', receiptSchema)

