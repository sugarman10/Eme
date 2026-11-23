import mongoose from 'mongoose';
const WarehouseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('Warehouse', WarehouseSchema);
