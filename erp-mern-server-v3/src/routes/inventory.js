import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import Item from '../models/Item.js';
import Warehouse from '../models/Warehouse.js';
import StockLedger from '../models/StockLedger.js';
import { wrap } from '../middleware/asyncHandler.js';
import { upload } from '../middleware/upload.js';
import mongoose from 'mongoose';
import { getStockMovements, addStockMovement, addItem, updateItem, transferStockBetweenWarehouses, bulkUpdatePrices } from '../controllers/inventoryController.js';
const router = express.Router();

// ===== Items =====
router.post('/items/bulk-price',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  body('value').isFloat({ min: 0.01 }),
  body('action').isIn(['increase', 'decrease']),
  body('field').isIn(['price', 'cost', 'wholesalePrice']),
  wrap(bulkUpdatePrices)
);

router.post('/items',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  upload.single('image'),
  body('sku').isString().isLength({ min: 1 }),
  body('name').isString().isLength({ min: 2 }),
  wrap(addItem)
);

router.get('/items',
  requireAuth(),
  query('q').optional().isString(),
  wrap(async (req, res) => {
    const { page = 1, limit = 20, q = '' } = req.query;
    const filter = q ? { $or: [{ sku: { $regex: q, $options: 'i' } }, { name: { $regex: q, $options: 'i' } }] } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Item.find(filter)
        .select(req.user.role === 'cashier' ? '-cost -supplier -wholesalePrice -initialStock' : '')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Item.countDocuments(filter)
    ]);
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  })
);

router.put('/items/:id',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  upload.single('image'),
  param('id').isMongoId(),
  body('sku').optional().isString().isLength({ min: 1 }),
  body('name').optional().isString().isLength({ min: 2 }),
  wrap(updateItem)
);

router.delete('/items/:id',
  requireAuth(['admin']),
  requireRole(['admin']),
  param('id').isMongoId(),
  wrap(async (req, res) => {
    const it = await Item.findByIdAndDelete(req.params.id);
    if (!it) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  })
);

// ===== Warehouses =====
router.post('/warehouses',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  body('code').isString().isLength({ min: 1 }),
  body('name').isString().isLength({ min: 2 }),
  wrap(async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const exists = await Warehouse.findOne({ code: req.body.code });
    if (exists) return res.status(409).json({ message: 'Code already exists' });
    const wh = await Warehouse.create(req.body);
    res.status(201).json(wh);
  }
  ));

router.get('/warehouses',
  requireAuth(),
  wrap(async (req, res) => {
    const data = await Warehouse.find().sort({ name: 1 });
    res.json(data);
  }
  ));

router.put('/warehouses/:id',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  param('id').isMongoId(),
  async (req, res) => {
    const wh = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!wh) return res.status(404).json({ message: 'Not found' });
    res.json(wh);
  }
);

router.delete('/warehouses/:id',
  requireAuth(['admin']),
  requireRole(['admin']),
  param('id').isMongoId(),
  async (req, res) => {
    const wh = await Warehouse.findByIdAndDelete(req.params.id);
    if (!wh) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  }
);

// ===== Stock Operations =====
// إدخال/إخراج (تعديل رصيد)
// إدخال/إخراج (تعديل رصيد) - Refactored to use Atomic Controller
router.post('/stock/adjust',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  body('item').isMongoId(),
  body('warehouse').isMongoId(),
  body('qty').isFloat({ gt: 0 }),
  body('direction').isIn(['IN', 'OUT']),
  wrap(async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const movementData = {
      item: req.body.item,
      warehouse: req.body.warehouse,
      qty: Number(req.body.qty),
      type: req.body.direction, // Maps directly to IN/OUT
      ref: req.body.ref,
      note: req.body.note
    };

    const result = await addStockMovement(movementData, req.user._id);
    res.status(201).json(result);
  })
);

// تحويل بين مستودعين
router.post('/stock/transfer',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  body('item').isMongoId(),
  body('fromWarehouse').isMongoId(),
  body('toWarehouse').isMongoId(),
  body('qty').isFloat({ gt: 0 }),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const transferData = {
      item: req.body.item,
      fromWarehouse: req.body.fromWarehouse,
      toWarehouse: req.body.toWarehouse,
      qty: Number(req.body.qty),
      note: req.body.note,
      ref: req.body.ref,
      user: req.user._id
    };

    const result = await transferStockBetweenWarehouses(transferData);
    res.status(201).json(result);
  })
);

// رصيد عنصر (تجميعي)
router.get('/stock/balance',
  requireAuth(),
  query('item').isMongoId(),
  query('warehouse').optional().isMongoId(),
  wrap(async (req, res) => {
    const { item, warehouse = null } = req.query;
    const match = { item };
    if (warehouse) match.warehouse = warehouse;
    const agg = await StockLedger.aggregate([
      { $match: { ...match } },
      { $group: { _id: '$warehouse', balance: { $sum: '$qty' } } }
    ]);
    res.json(agg);
  }
  ));

router.get('/stock/balances', requireAuth(), async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const q = (req.query.q || '').trim();

  const pipeline = [
    // 1. Filter by Warehouse/Item if provided (Optimization)
    ...((req.query.warehouse || req.query.item) ? [{
      $match: {
        ...(req.query.warehouse ? { warehouse: new mongoose.Types.ObjectId(req.query.warehouse) } : {}),
        ...(req.query.item ? { item: new mongoose.Types.ObjectId(req.query.item) } : {})
      }
    }] : []),
    // 2. Group by Item & Warehouse
    { $group: { _id: { item: '$item', warehouse: '$warehouse' }, balance: { $sum: '$qty' } } },
    // 3. Lookup Item Details
    { $lookup: { from: 'items', localField: '_id.item', foreignField: '_id', as: 'item' } },
    { $unwind: '$item' },
    // 4. Lookup Warehouse Details
    { $lookup: { from: 'warehouses', localField: '_id.warehouse', foreignField: '_id', as: 'warehouse' } },
    { $unwind: '$warehouse' },
    // 5. Search Filter (if query exists)
    ...(q ? [{
      $match: {
        $or: [
          { 'item.sku': { $regex: q, $options: 'i' } },
          { 'item.name': { $regex: q, $options: 'i' } },
          { 'warehouse.code': { $regex: q, $options: 'i' } },
          { 'warehouse.name': { $regex: q, $options: 'i' } },
        ]
      }
    }] : []),
    // 6. Sort
    { $sort: { 'item.sku': 1, 'warehouse.code': 1 } },
    // 7. Pagination Facet
    {
      $facet: {
        rows: [
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ],
        totalCount: [
          { $count: 'count' }
        ]
      }
    }
  ];

  try {
    const agg = await StockLedger.aggregate(pipeline);
    const rows = agg[0]?.rows || [];
    const total = agg[0]?.totalCount?.[0]?.count || 0;
    res.json({ rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Stock Balances Error:', err);
    res.status(500).json({ message: 'Failed to fetch stock balances' });
  }
});

// ===== NEW: Comprehensive Inventory Movements API =====

/**
 * GET /inventory/movements
 * List stock movements with filters
 */
router.get('/movements',
  requireAuth(),
  query('page').optional().isInt(),
  query('limit').optional().isInt(),
  query('warehouse').optional().isMongoId(),
  query('item').optional().isMongoId(),
  query('type').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  wrap(async (req, res) => {
    const filters = {
      warehouse: req.query.warehouse,
      item: req.query.item,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const result = await getStockMovements(filters, pagination);
    res.json(result);
  })
);

/**
 * POST /inventory/movements
 * Manual Stock Adjustment
 */
router.post('/movements',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  body('item').isMongoId(),
  body('warehouse').isMongoId(),
  body('qty').isFloat({ gt: 0 }),
  body('type').isIn(['IN', 'OUT']),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const movementData = {
      item: req.body.item,
      warehouse: req.body.warehouse,
      qty: Number(req.body.qty),
      type: req.body.type,
      note: req.body.note,
      ref: req.body.ref
    };

    const result = await addStockMovement(movementData, req.user._id);
    res.status(201).json(result);
  })
);

export default router;
