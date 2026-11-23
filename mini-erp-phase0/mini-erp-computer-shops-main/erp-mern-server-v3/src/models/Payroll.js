import mongoose from 'mongoose';

const PayrollSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true }, // Format: "YYYY-MM"

    // Snapshot of Salary Details at time of generation
    basics: {
      baseSalary: { type: Number, default: 0 },
      housingAllowance: { type: Number, default: 0 },
      transportAllowance: { type: Number, default: 0 },
    },

    deductions: {
      absenceDays: { type: Number, default: 0 },
      absenceAmount: { type: Number, default: 0 },
      loans: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
    },

    totals: {
      grossSalary: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      netSalary: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ['DRAFT', 'APPROVED', 'PAID'],
      default: 'DRAFT',
    },

    note: { type: String },
    paymentDate: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Unique compound index: One payroll per employee per month
PayrollSchema.index({ employee: 1, month: 1 }, { unique: true });

export default mongoose.model('Payroll', PayrollSchema);
