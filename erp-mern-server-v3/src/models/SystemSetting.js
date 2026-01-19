import mongoose from 'mongoose';

const SystemSettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // e.g., 'tax_rate', 'default_cash_account'
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be string, number, or object
    description: { type: String, default: '' },
    group: { type: String, default: 'general' } // 'accounting', 'inventory', etc.
}, { timestamps: true });

export default mongoose.model('SystemSetting', SystemSettingSchema);
