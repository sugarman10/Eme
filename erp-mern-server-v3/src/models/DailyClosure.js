import mongoose from 'mongoose';

/**
 * DailyClosure - نموذج الإغلاق اليومي
 * 
 * يحفظ تقرير إغلاق كل يوم مع:
 * - ملخص المبيعات والتحصيلات
 * - قائمة الفواتير
 * - حالة الإغلاق (يدوي/تلقائي)
 */
const dailyClosureSchema = new mongoose.Schema({
    // تاريخ اليوم المغلق (بدون وقت)
    date: {
        type: Date,
        required: true,
        unique: true
    },

    // وقت الإغلاق
    closedAt: {
        type: Date,
        default: null
    },

    // من قام بالإغلاق (null للإغلاق التلقائي)
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    // هل تم الإغلاق تلقائياً؟
    isAutomatic: {
        type: Boolean,
        default: false
    },

    // ملخص اليوم
    summary: {
        invoiceCount: { type: Number, default: 0 },
        totalSales: { type: Number, default: 0 },
        totalPaid: { type: Number, default: 0 },
        totalDue: { type: Number, default: 0 },
        byChannel: {
            wholesale: { type: Number, default: 0 },
            retail: { type: Number, default: 0 }
        },
        byPaymentMethod: {
            cash: { type: Number, default: 0 },
            card: { type: Number, default: 0 },
            bank: { type: Number, default: 0 },
            split: { type: Number, default: 0 }
        }
    },

    // قائمة الفواتير المرتبطة بهذا الإغلاق
    invoices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesInvoice'
    }],

    // حالة الإغلاق
    status: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open'
    },

    // ملاحظات
    note: {
        type: String,
        default: ''
    }

}, {
    timestamps: true
});

// Index for fast date lookups
dailyClosureSchema.index({ date: 1 });
dailyClosureSchema.index({ status: 1 });

const DailyClosure = mongoose.model('DailyClosure', dailyClosureSchema);

export default DailyClosure;
