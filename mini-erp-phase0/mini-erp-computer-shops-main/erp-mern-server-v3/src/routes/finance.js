import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import { wrap } from '../middleware/asyncHandler.js';
import logger from '../config/logger.js';
import '../models/Customer.js'; // Ensure schema registration
import '../models/SalesInvoice.js'; // Ensure schema registration

// Import Receipt Controller
import {
  createReceipt,
  getReceipts,
  voidReceipt,
  reverseReceipt,
  getTrialBalance,
  getAccountStatement,
  getGeneralMovements,
} from '../controllers/financeController.js';
import { postJournalEntry } from '../services/journalEntryService.js';
import {
  createPaymentVoucher,
  getPaymentVouchers,
  voidPaymentVoucher,
} from '../controllers/paymentVoucherController.js';
import { applyFiscalDateFilter } from '../middleware/fiscalPeriod.js';

const router = express.Router();

// ============================================================
// ACCOUNTS
// ============================================================
router.post(
  '/accounts',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  requirePermission(['coa_manage'], ['admin', 'accountant']),
  body('code').isString().isLength({ min: 1 }),
  body('name').isString().isLength({ min: 2 }),
  body('type').isIn(['asset', 'liability', 'equity', 'revenue', 'expense']),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const exists = await Account.findOne({ code: req.body.code.trim() });
    if (exists) return res.status(409).json({ message: 'Account code exists' });

    // Sanitize input: disallow manual balance injection or tampering with isSystem
    const newAccountData = {
      code: req.body.code.trim(),
      name: req.body.name.trim(),
      type: req.body.type,
      parentId: req.body.parentId || null,
      description: req.body.description || '',
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      isSystem: false,
      balance: 0,
    };

    const acc = await Account.create(newAccountData);

    try {
      const { auditCreate } = await import('../services/auditService.js');
      await auditCreate('ACCOUNT', acc, req.user, req.ip);
    } catch (auditErr) {
      console.warn('Audit create failed for account:', auditErr.message);
    }

    res.status(201).json(acc);
  })
);

router.get(
  '/accounts',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  wrap(async (req, res) => {
    const data = await Account.find().sort({ code: 1 });
    res.json(data);
  })
);

/**
 * GET /accounts/movements - General financial log across all accounts
 */
router.get(
  '/accounts/movements',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  wrap(getGeneralMovements)
);

/**
 * GET /accounts/:id/statement - Detailed account ledger with running balance
 */
router.get(
  '/accounts/:id/statement',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  wrap(getAccountStatement)
);

/**
 * PUT /accounts/:id - Update account (name/isActive)
 * AUDIT: Mandatory with rollback on failure
 */
router.put(
  '/accounts/:id',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  requirePermission(['coa_manage'], ['admin', 'accountant']),
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
      const { auditUpdate } = await import('../services/auditService.js');
      await auditUpdate('ACCOUNT', id, beforeState, updatedAccount, req.user, req.ip);
    } catch (auditError) {
      // Rollback
      await Account.findByIdAndUpdate(id, beforeState);
      return res.status(500).json({
        message: 'تعذر حفظ سجل التدقيق، تم إلغاء العملية حفاظًا على سلامة النظام',
      });
    }

    res.json(updatedAccount);
  })
);

/**
 * DELETE /accounts/:id - Delete sub-account (System accounts protected)
 */
router.delete(
  '/accounts/:id',
  requireAuth(['admin']),
  requireRole(['admin']),
  requirePermission(['coa_manage'], ['admin']),
  wrap(async (req, res) => {
    const { id } = req.params;
    const account = await Account.findById(id);
    if (!account) return res.status(404).json({ message: 'الحساب غير موجود' });

    if (account.isSystem) {
      return res.status(403).json({ message: 'لا يمكن حذف حساب نظام أساسي محمي' });
    }

    // Check if account has child accounts
    const hasChildren = await Account.exists({ parentId: id });
    if (hasChildren) {
      return res.status(400).json({ message: 'لا يمكن حذف حساب يمتلك حسابات فرعية، يرجى حذف أو نقل الحسابات الفرعية أولاً' });
    }

    // Check if account has journal entries (corrected field: lines.account)
    const hasEntries = await JournalEntry.exists({ 'lines.account': id });
    if (hasEntries) {
      return res.status(400).json({ message: 'لا يمكن حذف حساب يحتوي على حركات وقيود مالية، يمكنك تعطيله بدلاً من ذلك' });
    }

    await Account.findByIdAndDelete(id);
    res.json({ message: 'تم حذف الحساب بنجاح' });
  })
);

// ============================================================
// JOURNAL ENTRIES
// ============================================================
router.post(
  '/journals',
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

    // Refactored to use centralized service (Fiscal Locking + Serial Numbering)
    const jv = await postJournalEntry({
      date: req.body.date,
      referenceType: 'MANUAL',
      description: req.body.note || req.body.description || 'قيود يدوية',
      lines: lines.map(l => ({
        accountId: l.account, // Map 'account' from frontend to 'accountId' for service
        debit: l.debit,
        credit: l.credit,
        note: l.note || ''
      })),
      userId: req.user._id,
      createdBy: req.user._id
    });

    res.status(201).json(jv);
  })
);

router.get(
  '/journals',
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
    applyFiscalDateFilter(req, filter, 'date');
    const data = await JournalEntry.find(filter)
      .sort({ date: -1 })
      .populate('lines.account', 'code name')
      .populate('user', 'name');
    res.json(data);
  })
);

router.post(
  '/journals/:id/reverse',
  requireAuth(['admin', 'accountant']),
  requireRole(['admin', 'accountant']),
  body('reason').optional().isString(),
  wrap(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const { reverseJournalEntry } = await import('../services/journalEntryService.js');
    const newEntry = await reverseJournalEntry(id, req.user._id, reason);
    res.json(newEntry);
  })
);


// ============================================================
// RECEIPTS (Delegated to Controller)
// ============================================================
router.post(
  '/receipts',
  requireAuth(['admin', 'accountant', 'sales']),
  requireRole(['admin', 'accountant', 'sales']),
  body('customer').isMongoId(),
  body('amount').isFloat({ gt: 0 }),
  body('date').optional().isISO8601(),
  wrap(createReceipt)
);

router.get(
  '/receipts',
  requireAuth(['admin', 'accountant', 'sales']),
  requireRole(['admin', 'accountant', 'sales']),
  wrap(getReceipts)
);

// Receipt void/reverse
router.post(
  '/receipts/:id/void',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  wrap(voidReceipt)
);

router.post(
  '/receipts/:id/reverse',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  wrap(reverseReceipt)
);

// ============================================================
// PAYMENT VOUCHERS — سندات الدفع
// ============================================================
router.post(
  '/payments',
  requireAuth(['admin', 'accountant', 'sales', 'manager']),
  body('beneficiaryType').isIn(['customer', 'supplier', 'expense', 'other']),
  body('amount').isFloat({ gt: 0 }),
  body('date').optional().isISO8601(),
  wrap(createPaymentVoucher)
);

router.get(
  '/payments',
  requireAuth(['admin', 'accountant', 'sales', 'manager']),
  wrap(getPaymentVouchers)
);

router.post(
  '/payments/:id/void',
  requireAuth(['admin', 'accountant', 'manager']),
  wrap(voidPaymentVoucher)
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
const defaultFiscalDates = (req, res, next) => {
  if (req.fiscalPeriod) {
    if (!req.query.to) req.query.to = req.fiscalPeriod.endDate.toISOString().split('T')[0];
    if (!req.query.from) req.query.from = req.fiscalPeriod.startDate.toISOString().split('T')[0];
  }
  next();
};

/**
 * GET /api/finance/reports/trial-balance
 *
 * Cumulative Trial Balance Report
 *
 * Query Params:
 * - to (required): End date (YYYY-MM-DD)
 * - from (optional): Start date, if omitted calculates from oldest entry
 */
router.get(
  '/reports/trial-balance',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  defaultFiscalDates,
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
router.get(
  '/reports/trial-balance/export',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  defaultFiscalDates,
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
router.get(
  '/reports/income-statement',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  defaultFiscalDates,
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
router.get(
  '/reports/income-statement/export',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  defaultFiscalDates,
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
router.get(
  '/reports/customer-statement',
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
router.get(
  '/reports/customer-statement/export',
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
router.get(
  '/reports/aging',
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
router.get(
  '/reports/aging/export',
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
router.get(
  '/reports/balance-sheet',
  requireAuth(['admin', 'accountant', 'manager']),
  requireRole(['admin', 'accountant', 'manager']),
  wrap(async (req, res) => {
    const { getBalanceSheet } = await import('../controllers/financeController.js');
    return getBalanceSheet(req, res);
  })
);

export default router;
