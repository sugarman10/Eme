import mongoose from 'mongoose';
import { getNextSequence } from '../services/counterService.js';

/**
 * PaymentVoucher - سند الدفع
 *
 * يغطي كل حالات الدفع الخارج:
 * - دفع للعميل (رد دفعة زيادة / رصيد دائن)
 * - دفع للمورد
 * - مصاريف تشغيلية
 * - دفعات أخرى
 */
const paymentVoucherSchema = new mongoose.Schema(
    {
        // رقم السند التسلسلي
        number: { type: String, unique: true },

        date: { type: Date, required: true, default: Date.now, index: true },

        // نوع المستفيد
        beneficiaryType: {
            type: String,
            enum: ['customer', 'supplier', 'expense', 'other'],
            required: true,
        },

        // مرجع المستفيد (حسب النوع)
        customer:    { type: mongoose.Schema.Types.ObjectId, ref: 'Customer'  },
        supplier:    { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier'  },
        beneficiary: { type: String }, // للمصاريف أو غير المحددين (اسم حر)

        // المبلغ
        amount: { type: Number, required: true, min: 0.01 },

        // طريقة الدفع
        method: {
            type: String,
            enum: ['cash', 'bank', 'check', 'split'],
            default: 'cash',
        },

        // الخزينة (مصدر الأموال)
        treasury: { type: mongoose.Schema.Types.ObjectId, ref: 'Treasury' },

        // للدفع المختلط
        splitDetails: [
            {
                method:   { type: String },
                amount:   { type: Number },
                treasury: { type: mongoose.Schema.Types.ObjectId, ref: 'Treasury' },
            },
        ],

        // البيان / الوصف
        note: { type: String, default: '' },

        // الحالة
        status: {
            type: String,
            enum: ['posted', 'void', 'reversed'],
            default: 'posted',
        },

        // ربط محاسبي
        journalEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry' },

        // المنشئ
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

// Indexes
paymentVoucherSchema.index({ date: -1 });
paymentVoucherSchema.index({ beneficiaryType: 1, date: -1 });
paymentVoucherSchema.index({ customer: 1, date: -1 });
paymentVoucherSchema.index({ supplier: 1, date: -1 });

// Auto-generate sequential number (Atomic counter)
paymentVoucherSchema.pre('save', async function () {
    if (!this.number) {
        let seq = await getNextSequence('payment_voucher');
        let candidate = `PV-${String(seq).padStart(5, '0')}`;
        const exists = await this.constructor.findOne({ number: candidate });
        if (exists) {
            const allVouchers = await this.constructor.find({}, { number: 1 }).lean();
            let maxSeq = 0;
            for (const v of allVouchers) {
                if (v.number) {
                    const parsed = parseInt(v.number.replace(/\D/g, ''), 10);
                    if (!isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
                }
            }
            if (maxSeq >= seq) {
                const Counter = (await import('./Counter.js')).default;
                seq = maxSeq + 1;
                await Counter.findOneAndUpdate({ name: 'payment_voucher' }, { seq }, { upsert: true });
                candidate = `PV-${String(seq).padStart(5, '0')}`;
            }
        }
        this.number = candidate;
    }
});

export default mongoose.model('PaymentVoucher', paymentVoucherSchema);
