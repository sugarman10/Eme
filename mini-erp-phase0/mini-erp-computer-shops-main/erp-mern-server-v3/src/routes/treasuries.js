import express from 'express';
import { body, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import Treasury from '../models/Treasury.js';
import Transaction from '../models/Transaction.js';
import { wrap } from '../middleware/asyncHandler.js';

const router = express.Router();

// Get All Treasury Transactions (Financial Operations Log)
router.get(
  '/transactions/all',
  requireAuth(),
  wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const filter = {};
    if (req.query.treasury) {
      filter.treasury = req.query.treasury;
    }
    if (req.query.type) {
      filter.type = req.query.type;
    }
    const txs = await Transaction.find(filter)
      .populate('treasury', 'name type accountNumber')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(txs);
  })
);

// Get Transactions for a Specific Treasury
router.get(
  '/:id/transactions',
  requireAuth(),
  wrap(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const txs = await Transaction.find({ treasury: req.params.id })
      .populate('treasury', 'name type accountNumber')
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(txs);
  })
);

// Create Treasury
router.post(
  '/',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  requirePermission(['treasury_manage'], ['admin', 'manager']),
  body('name').isString().isLength({ min: 2 }),
  body('type').isIn(['safe', 'bank']),
  body('balance').optional().isFloat({ min: 0 }),
  body('accountNumber').optional().isString(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const exists = await Treasury.findOne({ name: req.body.name });
    if (exists) {
      return res.status(409).json({ message: 'Treasury name already exists' });
    }

    // Auto-generate code if not provided
    if (!req.body.code) {
      const prefix = req.body.type === 'bank' ? 'BANK' : 'SAFE';
      const count = await Treasury.countDocuments({ type: req.body.type });
      req.body.code = `${prefix}-${String(count + 1).padStart(3, '0')}`;
    }

    const treasury = await Treasury.create(req.body);
    res.status(201).json(treasury);
  })
);

// Get All Treasuries
router.get(
  '/',
  requireAuth(),
  wrap(async (req, res) => {
    const role = (req.user.role || '').toLowerCase();
    let query = Treasury.find().sort({ name: 1 });

    // Hide sensitive data (balance) for non-financial roles
    if (!['admin', 'manager', 'accountant'].includes(role)) {
      query = query.select('name type _id');
    }

    const treasuries = await query;
    res.json(treasuries);
  })
);

// Get Single Treasury
router.get(
  '/:id',
  requireAuth(),
  wrap(async (req, res) => {
    const treasury = await Treasury.findById(req.params.id);
    if (!treasury) {
      return res.status(404).json({ message: 'Treasury not found' });
    }
    res.json(treasury);
  })
);

// Update Treasury
router.put(
  '/:id',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  requirePermission(['treasury_manage'], ['admin', 'manager']),
  body('name').optional().isString().isLength({ min: 2 }),
  body('type').optional().isIn(['safe', 'bank']),
  body('balance').optional().isFloat({ min: 0 }),
  body('accountNumber').optional().isString(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const treasury = await Treasury.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    if (!treasury) {
      return res.status(404).json({ message: 'Treasury not found' });
    }

    res.json(treasury);
  })
);

// Delete Treasury
router.delete(
  '/:id',
  requireAuth(['admin']),
  requireRole(['admin']),
  requirePermission(['treasury_manage'], ['admin']),
  wrap(async (req, res) => {
    const treasury = await Treasury.findByIdAndDelete(req.params.id);
    if (!treasury) {
      return res.status(404).json({ message: 'Treasury not found' });
    }
    res.json({ message: 'Treasury deleted successfully' });
  })
);

export default router;
