import express from 'express';
import { body, query, param } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { checkPermission } from '../middleware/roleMiddleware.js';
import {
    getExpenseCategories,
    createExpenseCategory,
    updateExpenseCategory,
    getExpenses,
    getExpenseById,
    createExpense,
    getExpenseStats,
} from '../controllers/expenseController.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth());

// ============================================================
// EXPENSE CATEGORIES
// ============================================================

// GET /api/expenses/categories - Get all categories
router.get('/categories', getExpenseCategories);

// POST /api/expenses/categories - Create category
router.post(
    '/categories',
    checkPermission('expense_create'),
    [
        body('code').notEmpty().withMessage('رمز الفئة مطلوب'),
        body('name').notEmpty().withMessage('اسم الفئة مطلوب'),
        body('accountCode').optional().isString(),
    ],
    createExpenseCategory
);

// PUT /api/expenses/categories/:id - Update category
router.put(
    '/categories/:id',
    checkPermission('expense_update'),
    [
        param('id').isMongoId().withMessage('معرف الفئة غير صالح'),
        body('name').optional().notEmpty(),
        body('accountCode').optional().isString(),
    ],
    updateExpenseCategory
);

// ============================================================
// EXPENSES
// ============================================================

// GET /api/expenses/stats - Get expense statistics
router.get('/stats', getExpenseStats);

// GET /api/expenses - Get all expenses with filtering
router.get(
    '/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('category').optional().isMongoId(),
        query('treasury').optional().isMongoId(),
        query('startDate').optional().isISO8601(),
        query('endDate').optional().isISO8601(),
    ],
    getExpenses
);

// GET /api/expenses/:id - Get single expense
router.get(
    '/:id',
    [param('id').isMongoId().withMessage('معرف المصروف غير صالح')],
    getExpenseById
);

// POST /api/expenses - Create new expense
router.post(
    '/',
    checkPermission('expense_create'),
    [
        body('categoryId').isMongoId().withMessage('فئة المصروف مطلوبة'),
        body('treasuryId').isMongoId().withMessage('الخزينة مطلوبة'),
        body('amount').isFloat({ min: 0.01 }).withMessage('المبلغ يجب أن يكون أكبر من صفر'),
        body('description').optional().isString(),
        body('beneficiary').optional().isString(),
        body('date').optional().isISO8601(),
    ],
    createExpense
);

export default router;
