/**
 * SalesReturn Model
 * 
 * Tracks returned items from customers (Credit Note).
 * Links to original SalesInvoice for traceability.
 */

import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const SalesReturnSchema = new mongoose.Schema({
    // ============ RELATIONSHIPS ============
    customer: {
        type: ObjectId,
        ref: 'Customer',
        default: null
    },
    originalInvoice: {
        type: ObjectId,
        ref: 'SalesInvoice',
        required: true
    },
    warehouse: {
        type: ObjectId,
        ref: 'Warehouse',
        required: true
    },

    // ============ ITEMS ARRAY ============
    items: [{
        item: { type: ObjectId, ref: 'Item', required: true },
        qty: { type: Number, required: true, min: 0.01 },
        unitPrice: { type: Number, required: true, min: 0 }, // Price at time of sale
        refundAmount: { type: Number, default: 0 }, // Auto-calculated: qty * unitPrice
        reason: {
            type: String,
            enum: ['damaged', 'expired', 'wrong_item', 'customer_preference', 'other'],
            default: 'other'
        }
    }],

    // ============ STATUS WORKFLOW ============
    status: {
        type: String,
        enum: ['draft', 'pending_approval', 'returned', 'rejected', 'reversed'],
        default: 'draft'
    },

    // ============ FINANCIAL ============
    totalAmount: { type: Number, required: true, default: 0 },
    isRefunded: { type: Boolean, default: false }, // Track if cash paid back to customer

    // ============ METADATA ============
    date: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    createdBy: { type: ObjectId, ref: 'User' },
    approvedBy: { type: ObjectId, ref: 'User' },
    approvedAt: { type: Date }
}, { timestamps: true });

// Performance Indexes
SalesReturnSchema.index({ customer: 1 });
SalesReturnSchema.index({ originalInvoice: 1 });
SalesReturnSchema.index({ status: 1 });
SalesReturnSchema.index({ date: -1 });

// Pre-save: Calculate totals
SalesReturnSchema.pre('save', function (next) {
    if (this.items && this.items.length > 0) {
        this.totalAmount = this.items.reduce((sum, item) => {
            item.refundAmount = (item.qty || 0) * (item.unitPrice || 0);
            return sum + item.refundAmount;
        }, 0);
    }
    next();
});

export default mongoose.model('SalesReturn', SalesReturnSchema);
