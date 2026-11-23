import mongoose from 'mongoose';

const FiscalPeriodSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true }, // e.g., "January 2025" or "Q1 2025"
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        isClosed: { type: Boolean, default: false },
        closedAt: { type: Date },
        closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reopenedAt: { type: Date },
        reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: { type: String },
    },
    { timestamps: true }
);

// Indexes for fast lookup
FiscalPeriodSchema.index({ startDate: 1, endDate: 1 });
FiscalPeriodSchema.index({ isClosed: 1 });

// Validate date range
FiscalPeriodSchema.pre('save', function (next) {
    if (this.startDate > this.endDate) {
        next(new Error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية'));
    } else {
        next();
    }
});

export default mongoose.model('FiscalPeriod', FiscalPeriodSchema);
