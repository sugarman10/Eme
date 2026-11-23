import SalesOrder from '../models/SalesOrder.js';
import StockLedger from '../models/StockLedger.js';
import mongoose from 'mongoose';
import Item from '../models/Item.js'; // Ensure correct import for stock updates
import { applyFiscalDateFilter } from '../middleware/fiscalPeriod.js';

export async function createSalesOrder(req, res) {
  const { items } = req.body;
  const subtotal = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
  const tax = 0;
  const discount = 0;
  const grand = subtotal - discount + tax;

  const so = await SalesOrder.create({ ...req.body, totals: { subtotal, tax, discount, grand } });
  res.status(201).json(so);
}

export async function updateSalesOrderStatus(req, res) {
  const so = await SalesOrder.findById(req.params.id);
  if (!so) return res.status(404).json({ message: 'Not found' });

  so.status = req.body.status;
  await so.save();

  // When fulfilled: Deduct stock
  if (req.body.status === 'fulfilled' && req.body.warehouse) {
    // NOTE: Ideally this should be an atomic transaction like in salesController.
    // For now, porting logic as-is to preserve behavior during refactor.
    for (const row of so.items) {
      await StockLedger.create({
        item: row.item,
        warehouse: req.body.warehouse,
        type: 'OUT',
        qty: -row.qty,
        ref: `SO#${so._id}`,
        note: 'SO shipped',
      });
    }

    // Update cached stock
    const affectedItemIds = [...new Set(so.items.map((i) => i.item))];
    for (const itemId of affectedItemIds) {
      const totalStock = await StockLedger.aggregate([
        { $match: { item: new mongoose.Types.ObjectId(itemId) } },
        { $group: { _id: null, total: { $sum: '$qty' } } },
      ]);
      const newStock = totalStock[0]?.total || 0;
      // Assuming Item is imported as default or named. Checking legacy usage:
      // await import('../models/Item.js').then(m => m.default.findByIdAndUpdate(...))
      // We imported Item at top, so use it directly.
      await Item.findByIdAndUpdate(itemId, { stock: newStock });
    }
  }
  res.json(so);
}

export async function getSalesOrders(req, res) {
  const filter = {};
  if (req.query.customer) filter.customer = req.query.customer;

  applyFiscalDateFilter(req, filter, 'createdAt');

  const data = await SalesOrder.find(filter)
    .populate('customer', 'code name')
    .populate('items.item', 'sku name')
    .sort({ createdAt: -1 });
  res.json(data);
}
