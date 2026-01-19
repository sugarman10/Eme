import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { wrap } from '../middleware/asyncHandler.js';
import { createPurchaseOrder, receivePurchaseOrder, voidPurchaseOrder, createSupplierPayment, getSupplierUnpaidOrders, returnPurchaseOrder, getSupplierStatement, createPurchaseReturn, getPurchaseReturns } from '../controllers/procurementController.js';

const router = express.Router();

// ===== Suppliers =====
router.post('/suppliers',
  requireAuth(['admin', 'manager', 'accountant']),
  requireRole(['admin', 'manager', 'accountant']),
  body('code').isString().isLength({ min: 1 }),
  body('name').isString().isLength({ min: 2 }),
  body('openingBalance').optional().isFloat(),
  wrap(async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Check code existence
    const exists = await Supplier.findOne({ code: req.body.code });
    if (exists) return res.status(409).json({ message: 'Supplier code exists' });

    // Handle Opening Balance
    if (req.body.openingBalance) {
      req.body.balance = req.body.openingBalance;
    }

    const sup = await Supplier.create(req.body);
    res.status(201).json(sup);
  }
  ));

router.put('/suppliers/:id',
  requireAuth(['admin', 'manager', 'accountant']),
  requireRole(['admin', 'manager', 'accountant']),
  param('id').isMongoId(),
  wrap(async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Prevent updating balance directly via PUT (only via transactions)
    delete req.body.balance;
    delete req.body.openingBalance;

    const sup = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sup) return res.status(404).json({ message: 'Supplier not found' });
    res.json(sup);
  })
);

router.delete('/suppliers/:id',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  param('id').isMongoId(),
  wrap(async (req, res) => {
    const sup = await Supplier.findByIdAndDelete(req.params.id);
    if (!sup) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Deleted successfully' });
  })
);

router.get('/suppliers', requireAuth(), wrap(async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = q ? {
    $or: [
      { code: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { company: { $regex: q, $options: 'i' } },
    ]
  } : {};
  const data = await Supplier.find(filter).sort({ name: 1 });
  res.json(data);
}));

// ===== Purchase Orders (Controller Based) =====

// 1. Create Purchase Order
router.post('/orders',
  requireAuth(['admin', 'manager', 'storekeeper']),
  wrap(createPurchaseOrder)
);

// 2. Receive Purchase Order (Atomic)
router.post('/orders/:id/receive',
  requireAuth(['admin', 'manager', 'storekeeper']),
  wrap(receivePurchaseOrder)
);

// 2.1 Post Purchase Order (alias)
router.post('/orders/:id/post',
  requireAuth(['admin', 'manager', 'storekeeper']),
  wrap(receivePurchaseOrder)
);

// 2.2 Void Purchase Order
router.post('/orders/:id/void',
  requireAuth(['admin', 'manager']),
  wrap(voidPurchaseOrder)
);

// 3. Supplier Payment
router.post('/orders/payments',
  requireAuth(['admin', 'manager', 'accountant']),
  wrap(createSupplierPayment)
);

// 4. Return Purchase Order
router.post('/orders/:id/return',
  requireAuth(['admin', 'manager']),
  wrap(returnPurchaseOrder)
);

// 4.1 Reverse Purchase Order (alias)
router.post('/orders/:id/reverse',
  requireAuth(['admin', 'manager']),
  wrap(returnPurchaseOrder)
);

router.get('/suppliers/:id/unpaid-orders',
  requireAuth(['admin', 'manager', 'accountant']),
  wrap(getSupplierUnpaidOrders)
);

// 5. Supplier Statement
router.get('/suppliers/:id/statement',
  requireAuth(['admin', 'manager', 'accountant']),
  wrap(getSupplierStatement)
);

// 6. Create Purchase Return (Partial/Full)
router.post('/returns',
  requireAuth(['admin', 'manager']),
  wrap(createPurchaseReturn)
);

router.get('/returns',
  requireAuth(['admin', 'manager']),
  wrap(getPurchaseReturns)
);

// Import new controller functions
import { approvePurchaseReturn, voidPurchaseReturn, reversePurchaseReturn, updateReturnStatus, markReturnRefunded, getPurchaseReturnById } from '../controllers/procurementController.js';

// 7. Get Single Return
router.get('/returns/:id',
  requireAuth(['admin', 'manager']),
  wrap(getPurchaseReturnById)
);

// 8. Approve Return (Atomic with stock/supplier/journal)
router.post('/returns/:id/approve',
  requireAuth(['admin', 'manager']),
  wrap(approvePurchaseReturn)
);

// 8.1 Post Return
router.post('/returns/:id/post',
  requireAuth(['admin', 'manager']),
  wrap(approvePurchaseReturn)
);

// 8.2 Void Return
router.post('/returns/:id/void',
  requireAuth(['admin', 'manager']),
  wrap(voidPurchaseReturn)
);

// 8.3 Reverse Return
router.post('/returns/:id/reverse',
  requireAuth(['admin', 'manager']),
  wrap(reversePurchaseReturn)
);

// 9. Update Return Status (reject, pending, etc.)
router.patch('/returns/:id/status',
  requireAuth(['admin', 'manager']),
  wrap(updateReturnStatus)
);

// 10. Mark Return as Refunded (cash received)
router.post('/returns/:id/refund',
  requireAuth(['admin', 'manager']),
  wrap(markReturnRefunded)
);

// Get Orders (Existing)
router.get('/orders', requireAuth(), wrap(async (req, res) => {
  const data = await PurchaseOrder.find()
    .populate('supplier', 'code name')
    .populate('items.item', 'sku name')
    .populate('warehouse', 'name')
    .sort({ createdAt: -1 });
  res.json(data);
}));

// Keeping legacy /po route just in case, but redirecting to same controller or logic if needed.
// For now, I'll remove the inline logic to avoid duplication, as the user requested "Divide into two files".
// But I'll leave the GET /po as alias if needed or just use /orders as requested.
// The user strictly asked for /orders routes.
// I will ensure GET /procurement/orders works as well.

export default router;
