/**
 * PurchaseReturn Model
 * 
 * Tracks returned items to suppliers.
 * Links to original PurchaseOrder for traceability.
 */

import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const PurchaseReturnSchema = new mongoose.Schema({
    // ============ RELATIONSHIPS ============
    supplier: {
        type: ObjectId,
        ref: 'Supplier',
        required: true
    },
    originalPO: {
        type: ObjectId,
        ref: 'PurchaseOrder',
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
        unitCost: { type: Number, required: true, min: 0 }, // Cost at time of purchase
        refundAmount: { type: Number, default: 0 }, // Auto-calculated: qty * unitCost
        reason: {
            type: String,
            enum: ['damaged', 'expired', 'wrong_item', 'quality_issue', 'excess_stock', 'other'],
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
    isRefunded: { type: Boolean, default: false }, // Track if cash received back

    // ============ METADATA ============
    date: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    createdBy: { type: ObjectId, ref: 'User' },
    approvedBy: { type: ObjectId, ref: 'User' },
    approvedAt: { type: Date }
}, { timestamps: true });

// Performance Indexes
PurchaseReturnSchema.index({ supplier: 1 });
PurchaseReturnSchema.index({ originalPO: 1 });
PurchaseReturnSchema.index({ status: 1 });
PurchaseReturnSchema.index({ date: -1 });

// Pre-save: Calculate totals
PurchaseReturnSchema.pre('save', function (next) {
    if (this.items && this.items.length > 0) {
        this.totalAmount = this.items.reduce((sum, item) => {
            item.refundAmount = (item.qty || 0) * (item.unitCost || 0);
            return sum + item.refundAmount;
        }, 0);
    }
    next();
});

export default mongoose.model('PurchaseReturn', PurchaseReturnSchema);
