import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

/**
 * Expense Model - سجل المصروفات
 * 
 * يسجل جميع مصروفات الشركة مع الربط التلقائي بـ:
 * - الخزينة (لخصم المبلغ)
 * - القيد المحاسبي (Double-Entry)
 * - فئة المصروف
 */
const ExpenseSchema = new mongoose.Schema(
    {
        // رقم المصروف التسلسلي
        number: {
            type: String,
            required: true,
            unique: true
        }, // EXP-00001

        date: {
            type: Date,
            required: true,
            default: Date.now,
            index: true
        },

        // فئة المصروف
        category: {
            type: ObjectId,
            ref: 'ExpenseCategory',
            required: true
        },

        // الخزينة المستخدمة للدفع
        treasury: {
            type: ObjectId,
            ref: 'Treasury',
            required: true
        },

        // المبلغ
        amount: {
            type: Number,
            required: true,
            min: 0.01
        },

        // وصف المصروف
        description: {
            type: String,
            default: ''
        },

        // المستفيد (صاحب المحل، شركة الكهرباء، إلخ)
        beneficiary: {
            type: String,
            default: ''
        },

        // مرفقات (إيصالات، فواتير)
        attachments: [{
            type: String
        }],

        // القيد المحاسبي المرتبط
        journalEntry: {
            type: ObjectId,
            ref: 'JournalEntry'
        },
        journalSerialNumber: { type: String }, // For easy reference

        // المعاملة المالية المرتبطة
        transaction: {
            type: ObjectId,
            ref: 'Transaction'
        },

        // ملاحظات إضافية
        notes: {
            type: String,
            default: ''
        },

        // المستخدم الذي أنشأ المصروف
        createdBy: {
            type: ObjectId,
            ref: 'User'
        },
    },
    { timestamps: true }
);

// Indexes for common queries
ExpenseSchema.index({ category: 1 });
ExpenseSchema.index({ treasury: 1 });
ExpenseSchema.index({ createdBy: 1 });
ExpenseSchema.index({ date: -1, number: -1 });

export default mongoose.model('Expense', ExpenseSchema);
