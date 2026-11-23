import mongoose from 'mongoose';

/**
 * WalletTransaction Schema
 *
 * Logs all wallet balance changes for audit trail and history.
 * Each transaction records the before/after balance for integrity.
 */
const WalletTransactionSchema = new mongoose.Schema(
  {
    // Customer reference
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },

    // Transaction type
    type: {
      type: String,
      required: true,
      enum: [
        'deposit', // إيداع نقدي
        'refund', // مرتجع مبيعات
        'payment_usage', // استخدام في الدفع
        'adjustment', // تعديل يدوي
        'transfer_in', // تحويل من عميل آخر
        'transfer_out', // تحويل لعميل آخر
      ],
    },

    // Amount (positive for credit, negative for debit)
    amount: {
      type: Number,
      required: true,
    },

    // Balance tracking for verification
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },

    // Reference to related document (invoice, return, etc.)
    reference: {
      type: {
        type: String,
        enum: ['SalesInvoice', 'SalesReturn', 'Receipt', 'Manual', 'Transfer'],
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
      },
      number: String, // Invoice/Return number for display
    },

    // Optional note
    note: {
      type: String,
      trim: true,
      maxLength: 500,
    },

    // User who performed the action
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
WalletTransactionSchema.index({ customer: 1, createdAt: -1 });
WalletTransactionSchema.index({ 'reference.type': 1, 'reference.id': 1 });
WalletTransactionSchema.index({ type: 1 });

// Virtual for formatted amount (with sign)
WalletTransactionSchema.virtual('formattedAmount').get(function () {
  const sign = this.amount >= 0 ? '+' : '';
  return `${sign}${this.amount.toLocaleString()}`;
});

// Static method to log a transaction
WalletTransactionSchema.statics.logTransaction = async function (data, session = null) {
  const options = session ? { session } : {};
  const transaction = new this(data);
  return transaction.save(options);
};

// Static method to get customer transaction history
WalletTransactionSchema.statics.getCustomerHistory = async function (customerId, options = {}) {
  const { limit = 50, skip = 0, type = null } = options;

  const query = { customer: customerId };
  if (type) query.type = type;

  return this.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('createdBy', 'name email').lean();
};

export default mongoose.model('WalletTransaction', WalletTransactionSchema);
