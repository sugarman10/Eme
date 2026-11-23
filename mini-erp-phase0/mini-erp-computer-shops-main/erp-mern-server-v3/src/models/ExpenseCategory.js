import mongoose from 'mongoose';

/**
 * ExpenseCategory Model - فئات المصروفات
 * 
 * يستخدم لتصنيف المصروفات (إيجار، رواتب، كهرباء، إلخ)
 * كل فئة مرتبطة بحساب مصروفات في شجرة الحسابات
 */
const ExpenseCategorySchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true
        }, // EXP-01, EXP-02

        name: {
            type: String,
            required: true,
            trim: true
        }, // إيجار المحل، الكهرباء

        // رمز الحساب المحاسبي المرتبط (من شجرة الحسابات)
        accountCode: {
            type: String,
            required: true,
            default: '5020' // مصروفات تشغيلية افتراضياً
        },

        description: {
            type: String,
            default: ''
        },

        isActive: {
            type: Boolean,
            default: true
        },

        // فئات النظام لا يمكن حذفها
        isSystem: {
            type: Boolean,
            default: false
        },
    },
    { timestamps: true }
);

// Index for faster lookups

ExpenseCategorySchema.index({ isActive: 1 });

export default mongoose.model('ExpenseCategory', ExpenseCategorySchema);
