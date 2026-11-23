import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

/**
 * JournalEntry Model - Double-Entry Accounting Ledger
 *
 * Each entry must have balanced debits and credits (validated in service layer).
 * Links to source documents via referenceType + referenceId.
 */
const JournalEntrySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },

    // Reference to source document
    referenceType: {
      type: String,
      enum: [
        'SALE_INVOICE',
        'RECEIPT',
        'PURCHASE',
        'PURCHASE_INVOICE',
        'PURCHASE_RETURN',
        'PURCHASE_RETURN_REVERSAL',
        'SALES_RETURN',
        'SALES_RETURN_REVERSAL',
        'PAYMENT',
        'PAYMENT_VOUCHER',
        'EXPENSE',
        'ADJUSTMENT',
        'OPENING',
        'MANUAL',
        'DAILY_CLOSURE',
        'WALLET_WITHDRAWAL',
        'WALLET_DEPOSIT',
        'SALES',
        'INCOME',
        'SALARY',
        'PAYROLL',
        'DEPOSIT',
      ],
      default: 'MANUAL',
    },
    referenceId: { type: String, default: '' }, // Can be ObjectId string or custom reference

    // Journal lines (minimum 2 required)
    lines: [
      {
        account: { type: ObjectId, ref: 'Account', required: true },
        debit: { type: Number, default: 0, min: 0 },
        credit: { type: Number, default: 0, min: 0 },
        memo: { type: String, default: '' }, // Renamed from 'note' for clarity
      },
    ],

    // Legacy fields (kept for backward compatibility)
    ref: { type: String, default: '' },
    note: { type: String, default: '' },

    // Status & Immutability
    status: {
      type: String,
      enum: ['POSTED', 'REVERSED'],
      default: 'POSTED',
      required: true,
    },

    // Serial Numbering (JE-YYYY-XXXX)
    serialNumber: { type: String, unique: true, sparse: true }, // e.g., JE-2025-000001
    year: { type: Number },
    sequence: { type: Number },

    // Reversal Linkage
    reversalOf: { type: ObjectId, ref: 'JournalEntry' }, // The original entry this reverses
    reversedBy: { type: ObjectId, ref: 'JournalEntry' }, // The entry that reversed this one

    // Audit trail
    user: { type: ObjectId, ref: 'User' },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Indexes
JournalEntrySchema.index({ referenceType: 1, referenceId: 1 });
JournalEntrySchema.index({ 'lines.account': 1 });

JournalEntrySchema.index({ year: 1, sequence: 1 }, { unique: true, sparse: true });

export default mongoose.model('JournalEntry', JournalEntrySchema);
