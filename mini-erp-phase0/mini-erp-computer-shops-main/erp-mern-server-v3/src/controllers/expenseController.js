import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import Treasury from '../models/Treasury.js';
import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import { createExpenseTransaction } from '../services/transactionService.js';
import { getNextSequence } from '../services/counterService.js';
import { auditCreate, auditUpdate } from '../services/auditService.js';
import { postJournalEntry } from '../services/journalEntryService.js';
import { applyFiscalDateFilter } from '../middleware/fiscalPeriod.js';


// ============================================================
// EXPENSE CATEGORIES
// ============================================================

/**
 * Get all expense categories
 */
export async function getExpenseCategories(req, res) {
    try {
        const { active } = req.query;
        const filter = {};

        if (active === 'true') {
            filter.isActive = true;
        }

        const categories = await ExpenseCategory.find(filter).sort({ code: 1 });
        res.json(categories);
    } catch (error) {
        console.error('getExpenseCategories error:', error);
        res.status(500).json({ message: 'فشل في جلب فئات المصروفات' });
    }
}

/**
 * Create new expense category
 */
export async function createExpenseCategory(req, res) {
    try {
        const { code, name, accountCode, description } = req.body;

        // Check if code already exists
        const existing = await ExpenseCategory.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ message: 'رمز الفئة موجود مسبقاً' });
        }

        // Verify account exists
        if (accountCode) {
            const account = await Account.findOne({ code: accountCode });
            if (!account) {
                return res.status(400).json({ message: 'رمز الحساب المحاسبي غير موجود' });
            }
        }

        const category = await ExpenseCategory.create({
            code: code.toUpperCase(),
            name,
            accountCode: accountCode || '5020',
            description,
        });

        await auditCreate('EXPENSE_CATEGORY', category, req.user, req.ip);

        res.status(201).json(category);
    } catch (error) {
        console.error('createExpenseCategory error:', error);
        res.status(500).json({ message: 'فشل في إنشاء فئة المصروفات' });
    }
}

/**
 * Update expense category
 */
export async function updateExpenseCategory(req, res) {
    try {
        const { id } = req.params;
        const { name, accountCode, description, isActive } = req.body;

        const category = await ExpenseCategory.findById(id);
        if (!category) {
            return res.status(404).json({ message: 'فئة المصروفات غير موجودة' });
        }

        // Don't allow editing system categories
        if (category.isSystem) {
            return res.status(400).json({ message: 'لا يمكن تعديل فئات النظام' });
        }

        const before = category.toObject();

        if (name) category.name = name;
        if (accountCode) category.accountCode = accountCode;
        if (description !== undefined) category.description = description;
        if (isActive !== undefined) category.isActive = isActive;

        await category.save();

        await auditUpdate('EXPENSE_CATEGORY', category._id, before, category.toObject(), req.user, req.ip);

        res.json(category);
    } catch (error) {
        console.error('updateExpenseCategory error:', error);
        res.status(500).json({ message: 'فشل في تحديث فئة المصروفات' });
    }
}

// ============================================================
// EXPENSES
// ============================================================

/**
 * Get all expenses with filtering and pagination
 */
export async function getExpenses(req, res) {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            treasury,
            startDate,
            endDate,
            search,
        } = req.query;

        const filter = {};

        if (category) {
            filter.category = category;
        }

        if (treasury) {
            filter.treasury = treasury;
        }

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        applyFiscalDateFilter(req, filter, 'date');

        if (search) {
            filter.$or = [
                { number: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { beneficiary: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [expenses, total] = await Promise.all([
            Expense.find(filter)
                .populate('category', 'code name')
                .populate('treasury', 'code name')
                .populate('createdBy', 'username')
                .sort({ date: -1, number: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Expense.countDocuments(filter),
        ]);

        res.json({
            expenses,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error('getExpenses error:', error);
        res.status(500).json({ message: 'فشل في جلب المصروفات' });
    }
}

/**
 * Get single expense by ID
 */
export async function getExpenseById(req, res) {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate('category', 'code name accountCode')
            .populate('treasury', 'code name')
            .populate('journalEntry')
            .populate('createdBy', 'username');

        if (!expense) {
            return res.status(404).json({ message: 'المصروف غير موجود' });
        }

        res.json(expense);
    } catch (error) {
        console.error('getExpenseById error:', error);
        res.status(500).json({ message: 'فشل في جلب تفاصيل المصروف' });
    }
}

/**
 * Create new expense (with automatic journal entry and treasury deduction)
 * 
 * Flow:
 * 1. Validate inputs
 * 2. Check treasury balance
 * 3. Start MongoDB session
 * 4. Create Expense record
 * 5. Deduct from Treasury
 * 6. Create Transaction
 * 7. Create JournalEntry (Dr Expense, Cr Treasury/Cash)
 * 8. Commit
 */
export async function createExpense(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            date,
            categoryId,
            treasuryId,
            amount,
            description,
            beneficiary,
            notes,
        } = req.body;

        const safeAmount = Number(amount);
        if (!safeAmount || safeAmount <= 0) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'المبلغ يجب أن يكون أكبر من صفر' });
        }

        // Validate category
        const category = await ExpenseCategory.findById(categoryId).session(session);
        if (!category) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'فئة المصروف غير موجودة' });
        }

        // Validate treasury and check balance
        const treasury = await Treasury.findById(treasuryId).session(session);
        if (!treasury) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'الخزينة غير موجودة' });
        }

        if (treasury.balance < safeAmount) {
            await session.abortTransaction();
            return res.status(400).json({
                message: `رصيد الخزينة غير كافي. المتاح: ${treasury.balance.toLocaleString()} د.ل`
            });
        }

        // Get expense account
        const expenseAccount = await Account.findOne({ code: category.accountCode }).session(session);
        if (!expenseAccount) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'حساب المصروفات غير موجود في شجرة الحسابات' });
        }

        // Get treasury account (cash/bank)
        const treasuryAccount = await Account.findById(treasury.accountId).session(session);
        if (!treasuryAccount) {
            await session.abortTransaction();
            return res.status(400).json({ message: 'حساب الخزينة غير مرتبط بشجرة الحسابات' });
        }

        // Generate expense number
        const seq = await getNextSequence('expense');
        const expenseNumber = `EXP-${String(seq).padStart(5, '0')}`;

        // Create expense record
        const [expense] = await Expense.create(
            [{
                number: expenseNumber,
                date: date || new Date(),
                category: categoryId,
                treasury: treasuryId,
                amount: safeAmount,
                description,
                beneficiary,
                notes,
                createdBy: req.user._id,
            }],
            { session }
        );

        // Create transaction and deduct from treasury
        const transaction = await createExpenseTransaction(
            {
                amount: safeAmount,
                treasury: treasuryId,
                relatedId: expense._id,
                relatedModel: 'Expense',
                description: `${category.name}: ${description || beneficiary || ''}`.trim(),
                category: category.code,
                date: expense.date,
            },
            session
        );

        // Create journal entry via Service (Enforces Serial No & Fiscal Locking)
        const journalEntry = await postJournalEntry(
            {
                date: expense.date,
                referenceType: 'EXPENSE',
                referenceId: expense._id.toString(),
                lines: [
                    {
                        account: expenseAccount._id,
                        debit: safeAmount,
                        credit: 0,
                        memo: `${category.name} - ${beneficiary || description || ''}`.trim(),
                    },
                    {
                        account: treasuryAccount._id,
                        debit: 0,
                        credit: safeAmount,
                        memo: `صرف من ${treasury.name}`,
                    },
                ],
                note: `مصروف رقم ${expenseNumber}`,
                user: req.user._id,
                createdBy: req.user._id,
                status: 'POSTED',
            },
            { session }
        );

        // Update expense with references
        expense.transaction = transaction._id;
        expense.journalEntry = journalEntry._id;
        expense.journalSerialNumber = journalEntry.serialNumber;
        await expense.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Log action (outside transaction - non-blocking)
        try {
            await auditCreate('EXPENSE', expense, req.user, req.ip);
        } catch (auditError) {
            console.warn('Audit logging failed for expense:', auditError.message);
        }

        // Return populated expense
        const populatedExpense = await Expense.findById(expense._id)
            .populate('category', 'code name')
            .populate('treasury', 'code name')
            .populate('createdBy', 'username');

        res.status(201).json(populatedExpense);
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error('createExpense error:', error);
        res.status(500).json({ message: error.message || 'فشل في إنشاء المصروف' });
    }
}

/**
 * Get expense statistics
 */
export async function getExpenseStats(req, res) {
    try {
        const { startDate, endDate } = req.query;

        const matchStage = {};

        if (startDate || endDate) {
            matchStage.date = {};
            if (startDate) matchStage.date.$gte = new Date(startDate);
            if (endDate) matchStage.date.$lte = new Date(endDate);
        }

        // Today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // This month range
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        // This year range
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59);

        const [todayTotal, monthTotal, yearTotal, byCategory] = await Promise.all([
            // Today's expenses
            Expense.aggregate([
                { $match: { date: { $gte: today, $lt: tomorrow } } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),

            // This month's expenses
            Expense.aggregate([
                { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),

            // This year's expenses
            Expense.aggregate([
                { $match: { date: { $gte: yearStart, $lte: yearEnd } } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),

            // By category (this month)
            Expense.aggregate([
                { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
                {
                    $group: {
                        _id: '$category',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
                {
                    $lookup: {
                        from: 'expensecategories',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'categoryInfo',
                    },
                },
                { $unwind: '$categoryInfo' },
                {
                    $project: {
                        _id: 1,
                        total: 1,
                        count: 1,
                        categoryName: '$categoryInfo.name',
                        categoryCode: '$categoryInfo.code',
                    },
                },
                { $sort: { total: -1 } },
            ]),
        ]);

        res.json({
            today: {
                total: todayTotal[0]?.total || 0,
                count: todayTotal[0]?.count || 0,
            },
            thisMonth: {
                total: monthTotal[0]?.total || 0,
                count: monthTotal[0]?.count || 0,
            },
            thisYear: {
                total: yearTotal[0]?.total || 0,
                count: yearTotal[0]?.count || 0,
            },
            byCategory,
        });
    } catch (error) {
        console.error('getExpenseStats error:', error);
        res.status(500).json({ message: 'فشل في جلب إحصائيات المصروفات' });
    }
}
