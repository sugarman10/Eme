import express from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import {
    getWalletBalance,
    getWalletTransactions,
    depositToWallet,
    useWalletForPayment,
    adjustWalletBalance,
    withdrawFromWallet
} from '../controllers/walletController.js';

const router = express.Router();

/**
 * Wallet Routes
 * 
 * Endpoints for customer wallet (store credit) management
 */

// ============================================================
// GET BALANCE
// ============================================================

/**
 * GET /api/wallet/:customerId/balance
 * Get customer's current wallet balance
 */
router.get('/:customerId/balance',
    requireAuth(),
    param('customerId').isMongoId(),
    wrap(getWalletBalance)
);

// ============================================================
// GET TRANSACTIONS
// ============================================================

/**
 * GET /api/wallet/:customerId/transactions
 * Get wallet transaction history
 * 
 * Query params:
 * - limit: number of records (default 50)
 * - skip: offset for pagination
 * - type: filter by transaction type
 */
router.get('/:customerId/transactions',
    requireAuth(),
    param('customerId').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('skip').optional().isInt({ min: 0 }),
    query('type').optional().isIn(['deposit', 'refund', 'payment_usage', 'adjustment', 'transfer_in', 'transfer_out']),
    wrap(getWalletTransactions)
);

// ============================================================
// DEPOSIT
// ============================================================

/**
 * POST /api/wallet/:customerId/deposit
 * Add credit to customer wallet
 * 
 * Body:
 * - amount: number (required, positive)
 * - note: string (optional)
 */
router.post('/:customerId/deposit',
    requireAuth(['admin', 'manager', 'cashier']),
    requireRole(['admin', 'manager', 'cashier']),
    param('customerId').isMongoId(),
    body('amount').isFloat({ gt: 0 }).withMessage('المبلغ يجب أن يكون موجباً'),
    body('note').optional().isString().isLength({ max: 500 }),
    wrap(depositToWallet)
);

// ============================================================
// USE FOR PAYMENT
// ============================================================

/**
 * POST /api/wallet/:customerId/use
 * Use wallet balance for payment
 * 
 * Body:
 * - amount: number (required, positive)
 * - invoiceId: ObjectId (optional)
 * - invoiceNumber: string (optional)
 * - note: string (optional)
 */
router.post('/:customerId/use',
    requireAuth(['admin', 'manager', 'sales', 'cashier']),
    requireRole(['admin', 'manager', 'sales', 'cashier']),
    param('customerId').isMongoId(),
    body('amount').isFloat({ gt: 0 }).withMessage('المبلغ يجب أن يكون موجباً'),
    body('invoiceId').optional().isMongoId(),
    body('invoiceNumber').optional().isString(),
    body('note').optional().isString().isLength({ max: 500 }),
    wrap(useWalletForPayment)
);

// ============================================================
// ADJUST (Admin Only)
// ============================================================

/**
 * POST /api/wallet/:customerId/adjust
 * Manual adjustment of wallet balance
 * 
 * Body:
 * - amount: number (required, positive or negative)
 * - note: string (required for audit)
 */
router.post('/:customerId/adjust',
    requireAuth(['admin']),
    requireRole(['admin']),
    param('customerId').isMongoId(),
    body('amount').isFloat().withMessage('المبلغ مطلوب').custom(val => val !== 0).withMessage('المبلغ لا يمكن أن يكون صفراً'),
    body('note').isString().isLength({ min: 5, max: 500 }).withMessage('السبب مطلوب (5 أحرف على الأقل)'),
    wrap(adjustWalletBalance)
);

// ============================================================
// WITHDRAW (Cash Out - Manager Only)
// ============================================================

/**
 * POST /api/wallet/:customerId/withdraw
 * Withdraw cash from wallet (customer gets money back)
 * 
 * Body:
 * - amount: number (required, positive)
 * - treasuryId: ObjectId (required)
 * - note: string (optional)
 */
router.post('/:customerId/withdraw',
    requireAuth(['admin', 'manager']),
    requireRole(['admin', 'manager']),
    param('customerId').isMongoId(),
    body('amount').isFloat({ gt: 0 }).withMessage('المبلغ يجب أن يكون موجباً'),
    body('treasuryId').isMongoId().withMessage('يجب تحديد الخزينة'),
    body('note').optional().isString().isLength({ max: 500 }),
    wrap(withdrawFromWallet)
);

export default router;
