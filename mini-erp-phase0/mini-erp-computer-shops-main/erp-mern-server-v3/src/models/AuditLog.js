import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

/**
 * AuditLog Model - سجل التدقيق
 *
 * Tracks all important operations on business entities.
 * MVP version with essential fields.
 */
const AuditLogSchema = new mongoose.Schema(
  {
    // Entity being audited
    entityType: {
      type: String,
      enum: [
        'INVOICE',
        'RECEIPT',
        'PRODUCT',
        'ACCOUNT',
        'JOURNAL',
        'PURCHASE_ORDER',
        'SALES_RETURN',
        'PURCHASE_RETURN',
        'TREASURY',
        'SUPPLIER_PAYMENT',
        'PAYMENT_VOUCHER',
        'PAYMENT',
      ],
      required: true,
      index: true,
    },
    entityId: {
      type: String, // Can be ObjectId string or custom ID
      required: true,
      index: true,
    },

    // Action performed
    action: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE'],
      required: true,
      index: true,
    },

    // State before and after the change
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Who performed the action
    userId: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },
    userName: {
      type: String,
      default: '',
    },

    // Request metadata
    ip: {
      type: String,
      default: '',
    },

    // Optional description
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only createdAt needed
  }
);

// Compound indexes for efficient querying
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('AuditLog', AuditLogSchema);
