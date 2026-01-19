import mongoose from 'mongoose'
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true, trim: true }, // Optional for backward compatibility
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'cashier'], default: 'cashier' },
  permissions: [{ type: String }],
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  assignedWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }
}, { timestamps: true })

export default mongoose.model('User', UserSchema)
