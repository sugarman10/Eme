import mongoose from 'mongoose';

const TreasurySchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true }, // e.g SAFE-01, BANK-01
    name: { type: String, required: true },
    type: { type: String, enum: ['safe', 'bank'], default: 'safe' },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' }, // Link to Chart of Accounts
}, { timestamps: true });

export default mongoose.model('Treasury', TreasurySchema);
