import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import { wrap } from '../middleware/asyncHandler.js';
import logger from '../config/logger.js';
import '../models/Customer.js'; // Ensure schema registration
import '../models/SalesInvoice.js'; // Ensure schema registration

// Import Receipt Controller
import { createReceipt, getReceipts, getTrialBalance } from '../controllers/financeController.js';

const router = express.Router();

// ============================================================
// ACCOUNTS
// ============================================================
router.post('/accounts',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  body('code').isString().isLength({ min: 1 }),
  body('name').isString().isLength({ min: 2 }),
  body('type').isIn(['asset', 'liability', 'equity', 'revenue', 'expense']),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const exists = await Account.findOne({ code: req.body.code });
    if (exists) return res.status(409).json({ message: 'Account code exists' });
    const acc = await Account.create(req.body);
    res.status(201).json(acc);
  })
);

router.get('/accounts',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  wrap(async (req, res) => {
    const data = await Account.find().sort({ code: 1 });
    res.json(data);
  })
);

/**
 * PUT /accounts/:id - Update account (name/isActive)
 * AUDIT: Mandatory with rollback on failure
 */
router.put('/accounts/:id',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  wrap(async (req, res) => {
    const { id } = req.params;
    const { name, isActive } = req.body;

    // Get before state
    const beforeAccount = await Account.findById(id);
    if (!beforeAccount) {
      return res.status(404).json({ message: 'الحساب غير موجود' });
    }

    const beforeState = beforeAccount.toObject();

    // Only allow updating name and isActive
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedAccount = await Account.findByIdAndUpdate(id, updateData, { new: true });

    // Mandatory Audit Trail
    try {
      const { auditUpdate } = await import('../controllers/financeController.js').then(() =>
        import('../services/auditService.js')
      );
      await auditUpdate('ACCOUNT', id, beforeState, updatedAccount, req.user, req.ip);
    } catch (auditError) {
      // Rollback
      await Account.findByIdAndUpdate(id, beforeState);
      return res.status(500).json({
        message: 'تعذر حفظ سجل التدقيق، تم إلغاء العملية حفاظًا على سلامة النظام'
      });
    }

    res.json(updatedAccount);
  })
);

// ============================================================
// JOURNAL ENTRIES
// ============================================================
router.post('/journals',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  body('date').isISO8601().toDate(),
  body('lines').isArray({ min: 2 }),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { lines = [] } = req.body;
    const sumDebit = lines.reduce((a, l) => a + (l.debit || 0), 0);
    const sumCredit = lines.reduce((a, l) => a + (l.credit || 0), 0);
    if (Number(sumDebit.toFixed(2)) !== Number(sumCredit.toFixed(2))) {
      return res.status(400).json({ message: 'Unbalanced entry' });
    }
    const jv = await JournalEntry.create(req.body);
    res.status(201).json(jv);
  })
);

router.get('/journals',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  wrap(async (req, res) => {
    const { from = null, to = null } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const data = await JournalEntry.find(filter)
      .sort({ date: -1 })
      .populate('lines.account', 'code name')
      .populate('user', 'name');
    res.json(data);
  })
);

// ============================================================
// RECEIPTS (Delegated to Controller)
// ============================================================
router.post('/receipts',
  requireAuth(['admin', 'accountant', 'sales']),
  requireRole(['admin', 'accountant', 'sales']),
  body('customer').isMongoId(),
  body('amount').isFloat({ gt: 0 }),
  body('date').optional().isISO8601(),
  wrap(createReceipt)
);

router.get('/receipts',
  requireAuth(['admin', 'accountant', 'sales']),
  requireRole(['admin', 'accountant', 'sales']),
  wrap(getReceipts)
);

// ============================================================
// REPORTS
// ============================================================

/**
 * GET /api/finance/reports/trial-balance
 * 
 * Cumulative Trial Balance Report
 * 
 * Query Params:
 * - to (required): End date (YYYY-MM-DD)
 * - from (optional): Start date, if omitted calculates from oldest entry
 */
/**
 * GET /api/finance/reports/trial-balance
 * 
 * Cumulative Trial Balance Report
 * 
 * Query Params:
 * - to (required): End date (YYYY-MM-DD)
 * - from (optional): Start date, if omitted calculates from oldest entry
 */
router.get('/reports/trial-balance',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  query('to').isISO8601().withMessage('تاريخ النهاية مطلوب بصيغة YYYY-MM-DD'),
  query('from').optional().isISO8601(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return getTrialBalance(req, res);
  })
);

/**
 * GET /api/finance/reports/trial-balance/export
 * Export Trial Balance to Excel
 */
router.get('/reports/trial-balance/export',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  query('to').isISO8601().withMessage('تاريخ النهاية مطلوب بصيغة YYYY-MM-DD'),
  query('from').optional().isISO8601(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { exportTrialBalance } = await import('../controllers/financeController.js');
    return exportTrialBalance(req, res);
  })
);

/**
 * GET /api/finance/reports/income-statement
 * 
 * قائمة الدخل التراكمية
 * 
 * Query Params:
 * - to (required): تاريخ النهاية (YYYY-MM-DD)
 * - from (optional): تاريخ البداية
 */
router.get('/reports/income-statement',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  query('to').isISO8601().withMessage('تاريخ النهاية مطلوب بصيغة YYYY-MM-DD'),
  query('from').optional().isISO8601(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { getIncomeStatement } = await import('../controllers/financeController.js');
    return getIncomeStatement(req, res);
  })
);

/**
 * GET /api/finance/reports/income-statement/export
 * Export Income Statement to Excel
 */
router.get('/reports/income-statement/export',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  query('to').isISO8601().withMessage('تاريخ النهاية مطلوب بصيغة YYYY-MM-DD'),
  query('from').optional().isISO8601(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { exportIncomeStatement } = await import('../controllers/financeController.js');
    return exportIncomeStatement(req, res);
  })
);

/**
 * GET /api/finance/reports/customer-statement
 * 
 * كشف حساب العميل التراكمي
 * 
 * Query Params:
 * - customerId (required): معرّف العميل
 * - to (required): تاريخ النهاية (YYYY-MM-DD)
 * - from (optional): تاريخ البداية
 */
router.get('/reports/customer-statement',
  requireAuth(['admin', 'accountant', 'manager', 'sales']),
  requireRole(['admin', 'accountant', 'manager', 'sales']),
  query('customerId').isMongoId().withMessage('معرّف العميل مطلوب'),
  query('to').isISO8601().withMessage('تاريخ النهاية مطلوب بصيغة YYYY-MM-DD'),
  query('from').optional().isISO8601(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { getCustomerStatement } = await import('../controllers/financeController.js');
    return getCustomerStatement(req, res);
  })
);

/**
 * GET /api/finance/reports/customer-statement/export
 * Export Customer Statement to Excel
 */
router.get('/reports/customer-statement/export',
  requireAuth(['admin', 'accountant', 'manager', 'sales']),
  requireRole(['admin', 'accountant', 'manager', 'sales']),
  query('customerId').isMongoId().withMessage('معرّف العميل مطلوب'),
  query('to').isISO8601().withMessage('تاريخ النهاية مطلوب بصيغة YYYY-MM-DD'),
  query('from').optional().isISO8601(),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { exportCustomerStatement } = await import('../controllers/financeController.js');
    return exportCustomerStatement(req, res);
  })
);

/**
 * GET /api/finance/reports/aging
 * 
 * تقرير أعمار الديون
 * 
 * Query Params:
 * - to (required): تاريخ النهاية (YYYY-MM-DD)
 * - bucket (optional): حجم الفترة بالأيام (default: 30)
 */
router.get('/reports/aging',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  query('to').isISO8601().withMessage('تاريخ النهاية مطلوب بصيغة YYYY-MM-DD'),
  query('bucket').optional().isInt({ min: 1 }),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { getAgingReport } = await import('../controllers/financeController.js');
    return getAgingReport(req, res);
  })
);

/**
 * GET /api/finance/reports/aging/export
 * Export Aging Report to Excel
 */
router.get('/reports/aging/export',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  query('to').isISO8601().withMessage('تاريخ النهاية مطلوب بصيغة YYYY-MM-DD'),
  query('bucket').optional().isInt({ min: 1 }),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { exportAgingReport } = await import('../controllers/financeController.js');
    return exportAgingReport(req, res);
  })
);

/**
 * GET /api/finance/reports/balance-sheet
 * 
 * الميزانية العمومية (Balance Sheet)
 * 
 * Query Params:
 * - to (required): تاريخ الميزانية (YYYY-MM-DD)
 */
router.get('/reports/balance-sheet',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  wrap(async (req, res) => {
    const { getBalanceSheet } = await import('../controllers/financeController.js');
    return getBalanceSheet(req, res);
  })
);

export default router;




