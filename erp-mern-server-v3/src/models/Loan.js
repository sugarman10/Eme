import mongoose from 'mongoose';

const LoanSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    amount: { type: Number, required: true, min: 0 },
    requestDate: { type: Date, default: Date.now },
    repaymentMonth: { type: String, required: true }, // Format: "YYYY-MM"

    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'DEDUCTED'],
        default: 'PENDING'
    },

    // Approval Details
    approvalDate: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Auto-filled if rejected
    rejectionReason: { type: String }
}, { timestamps: true });

// Optional: Prevent multiple loans for same month if business logic requires
// LoanSchema.index({ employee: 1, repaymentMonth: 1 }, { unique: true });

export default mongoose.model('Loan', LoanSchema);
