import mongoose from 'mongoose';
const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true }, // Optional
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'sales', 'cashier', 'accountant', 'storekeeper'], default: 'cashier' },
    permissions: [{ type: String }],
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    assignedWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);
