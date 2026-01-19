import mongoose from 'mongoose'

const CustomerSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  phone: String,
  email: String,
  address: String,
  // accountId removed - no longer needed, using parent accounts (1030, 2030) directly
  type: { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
  creditLimit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },  // الرصيد المستحق (الدين)
  walletBalance: { type: Number, default: 0, min: 0 },  // رصيد المحفظة (Store Credit)

  // System flags for Cash Customer
  isCashCustomer: { type: Boolean, default: false },  // العميل النقدي - لا يمكن البيع له بالآجل
  isSystem: { type: Boolean, default: false }         // حساب نظام لا يمكن حذفه أو تعديله
}, { timestamps: true })

// Prevent deletion of system customers
CustomerSchema.pre('deleteOne', async function (next) {
  const doc = await this.model.findOne(this.getFilter());
  if (doc && doc.isSystem) {
    throw new Error('لا يمكن حذف عميل النظام');
  }
  next();
});

// Static method to get cash customer
CustomerSchema.statics.getCashCustomer = async function () {
  return this.findOne({ isCashCustomer: true, isSystem: true });
};

// Static method to ensure cash customer exists
CustomerSchema.statics.ensureCashCustomer = async function () {
  const existing = await this.findOne({ code: 'CASH' });
  if (existing) {
    // Update existing to be cash customer
    if (!existing.isCashCustomer) {
      existing.isCashCustomer = true;
      existing.isSystem = true;
      await existing.save();
    }
    return existing;
  }

  // Create new cash customer
  return this.create({
    code: 'CASH',
    name: 'عميل نقدي',
    phone: '',
    email: '',
    address: '',
    type: 'retail',
    creditLimit: 0,
    balance: 0,
    isCashCustomer: true,
    isSystem: true
  });
};

export default mongoose.model('Customer', CustomerSchema)
