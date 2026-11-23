import mongoose from 'mongoose';
const SupplierSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    company: { type: String, default: '', trim: true },
    taxNumber: { type: String, trim: true },
    phone: String,
    email: String,
    address: String,
    openingBalance: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    balanceUSD: { type: Number, default: 0 }, // المستحق للمورد بالدولار
    currency: { type: String, enum: ['LYD', 'USD'], default: 'LYD' },
  },
  { timestamps: true }
);

export default mongoose.model('Supplier', SupplierSchema);
