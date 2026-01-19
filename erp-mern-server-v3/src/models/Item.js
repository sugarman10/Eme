import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const ItemSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  barcode: { type: String, default: '', trim: true },
  category: { type: ObjectId, ref: 'Category', default: null },
  brand: { type: String, default: '', trim: true },
  uom: { type: String, default: 'pcs' }, // Keep for backward compatibility
  unit: { type: String, default: 'pcs' }, // New field as per spec
  cost: { type: Number, default: 0 }, // Weighted average cost
  price: { type: Number, default: 0 }, // Retail price
  wholesalePrice: { type: Number, default: 0 },
  minStock: { type: Number, default: 5 }, // Low stock alert threshold

  // Multi-warehouse stock management
  stocks: [{
    warehouse: { type: ObjectId, ref: 'Warehouse', required: true },
    qty: { type: Number, default: 0, min: 0 }
  }],

  // Stored field for efficient queries (auto-updated by services)
  totalStock: { type: Number, default: 0, min: 0 },

  // Legacy field - keep for backward compatibility with StockLedger
  stock: { type: Number, default: 0 },

  image: { type: String, default: '' }
}, { timestamps: true });

// Index for efficient warehouse stock lookups
ItemSchema.index({ 'stocks.warehouse': 1 });

export default mongoose.model('Item', ItemSchema);

