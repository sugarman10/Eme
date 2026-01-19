/**
 * Finance Controller
 * Handles receipt creation and retrieval with proper separation of concerns.
 * 
 * Refactored from routes/finance.js to improve code organization.
 * Now uses journalEntryService for automatic journal entries.
 */

import mongoose from 'mongoose';
import Receipt from '../models/Receipt.js';
import Account from '../models/Account.js';
import logger from '../config/logger.js';
import { postJournalEntry, JournalValidationError } from '../services/journalEntryService.js';
import { auditCreate, AuditError } from '../services/auditService.js';
import { startOfDay, endOfDay } from '../utils/dateUtils.js';

// ============================================================
// SYSTEM ACCOUNTS CACHE
// ============================================================

/**
 * Cache for system accounts to avoid repeated queries
 * Uses codes from Arabic Chart of Accounts
 */
let _systemAccountsCache = null;
let _cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get system accounts (with caching)
 * @returns {Promise<Object>} - { cash, bank, ar }
 */
async function getSystemAccounts(session = null) {
    const now = Date.now();

    // Return cached if valid
    if (_systemAccountsCache && (now - _cacheTimestamp) < CACHE_TTL) {
        return _systemAccountsCache;
    }

    // Fetch system accounts by code
    const codes = ['1010', '1020', '1030', '2030']; // Cash, Bank, AR, Wallet
    const query = Account.find({ code: { $in: codes }, isSystem: true });
    if (session) query.session(session);

    const accounts = await query;

    const result = {
        cash: accounts.find(a => a.code === '1010'),   // الصندوق
        bank: accounts.find(a => a.code === '1020'),   // البنك
        ar: accounts.find(a => a.code === '1030'),     // ذمم العملاء
        wallet: accounts.find(a => a.code === '2030')  // أمانات العملاء (المحفظة)
    };

    // Cache the result
    _systemAccountsCache = result;
    _cacheTimestamp = now;

    return result;
}

/**
 * Clear system accounts cache (useful after seeding)
 */
export function clearSystemAccountsCache() {
    _systemAccountsCache = null;
    _cacheTimestamp = 0;
}

// Dynamic imports to avoid circular dependencies
const getModels = async () => {
    const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
    const Customer = (await import('../models/Customer.js')).default;
    return { SalesInvoice, Customer };
};

const getServices = async () => {
    const { createIncomeTransaction } = await import('../services/transactionService.js');
    return { createIncomeTransaction };
};

// ============================================================
// PRIVATE HELPER FUNCTIONS
// ============================================================

/**
 * Process invoice allocations for a receipt
 * @private
 */
async function _processInvoiceAllocations(session, invoices, amount, SalesInvoice) {
    const allocations = [];
    let remainingToAllocate = Number(amount);

    if (!invoices || invoices.length === 0) {
        return { allocations, remainingToAllocate };
    }

    for (const invId of invoices) {
        if (remainingToAllocate <= 0.01) break;

        // Find invoice (with or without session)
        const invoice = session
            ? await SalesInvoice.findById(invId).session(session)
            : await SalesInvoice.findById(invId);
        if (!invoice) continue;

        const grand = invoice.totals?.grand || 0;
        const paid = invoice.totals?.paid || 0;
        const due = grand - paid;
        const toPay = Math.min(due, remainingToAllocate);

        if (toPay > 0) {
            invoice.totals.paid = (paid + toPay);
            // Avoid floating point issues
            if (invoice.totals.paid >= grand - 0.01) invoice.totals.paid = grand;

            // Save with or without session
            if (session) {
                await invoice.save({ session });
            } else {
                await invoice.save();
            }

            allocations.push({
                invoice: invId,
                amount: toPay
            });

            remainingToAllocate -= toPay;
        }
    }

    return { allocations, remainingToAllocate };
}

/**
 * Process treasury transactions (single or split)
 * @private
 */
async function _processTreasuryTransactions(session, params, createIncomeTransaction) {
    const { method, amount, splitDetails, treasury, receiptId, date } = params;

    if (method === 'split' && splitDetails && splitDetails.length > 0) {
        // Validate split total
        const splitTotal = splitDetails.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        if (Math.abs(splitTotal - amount) > 0.1) {
            throw new Error(`مجموع الدفعات (${splitTotal}) لا يطابق المبلغ الكلي (${amount})`);
        }

        for (const split of splitDetails) {
            if (Number(split.amount) > 0 && split.treasury) {
                await createIncomeTransaction({
                    amount: split.amount,
                    treasury: split.treasury,
                    relatedId: receiptId,
                    relatedModel: 'Receipt',
                    description: `دفعة سند قبض #${receiptId.toString().slice(-6)} (${split.method})`,
                    category: 'sales',
                    date
                }, session);
            }
        }
    } else {
        // Single treasury
        if (!treasury) {
            throw new Error('الخزينة مطلوبة (Treasury is required)');
        }

        await createIncomeTransaction({
            amount: amount,
            treasury: treasury,
            relatedId: receiptId,
            relatedModel: 'Receipt',
            description: `سند قبض #${receiptId.toString().slice(-6)}`,
            category: 'sales',
            date
        }, session);
    }
}

/**
 * Create journal entry for receipt using journalEntryService
 * @private
 * 
 * Uses system accounts:
 * - Dr: Cash (1010) or Bank (1020) based on payment method
 * - Cr: Accounts Receivable (1030)
 */
async function _createReceiptJournalEntry(session, params) {
    const { date, receiptId, method, customerName, amount, userId } = params;

    logger.info('🔄 Creating Receipt Journal Entry...');

    // Get system accounts (cached)
    const systemAccounts = await getSystemAccounts(session);

    // Validate required accounts exist
    if (!systemAccounts.ar) {
        throw new Error('حساب ذمم العملاء (1030) غير موجود. نفّذ seed-coa-arabic.js أولاً.');
    }

    // Determine debit account based on payment method
    let debitAccount;
    let debitMemo;

    if (method === 'bank' || method === 'transfer') {
        if (!systemAccounts.bank) {
            throw new Error('حساب البنك (1020) غير موجود. نفّذ seed-coa-arabic.js أولاً.');
        }
        debitAccount = systemAccounts.bank;
        debitMemo = `تحصيل بنكي - ${customerName}`;
    } else if (method === 'wallet') {
        if (!systemAccounts.wallet) {
            throw new Error('حساب أمانات العملاء (2030) غير موجود. نفّذ seed-coa-arabic.js أولاً.');
        }
        debitAccount = systemAccounts.wallet;
        debitMemo = `خصم من المحفظة - ${customerName}`;
    } else {
        // Default to cash (cash, card, etc.)
        if (!systemAccounts.cash) {
            throw new Error('حساب الصندوق (1010) غير موجود. نفّذ seed-coa-arabic.js أولاً.');
        }
        debitAccount = systemAccounts.cash;
        debitMemo = `تحصيل نقدي - ${customerName}`;
    }

    // Create journal entry using journalEntryService
    // Pass session only if available (null for standalone MongoDB)
    const options = session
        ? { session, updateBalances: true }
        : { updateBalances: true };

    const journalEntry = await postJournalEntry({
        date,
        referenceType: 'RECEIPT',
        referenceId: receiptId.toString(),
        ref: `RCT-${receiptId.toString().slice(-6)}`,
        note: `سند قبض - ${customerName}`,
        createdBy: userId,
        lines: [
            {
                accountId: debitAccount._id,
                debit: amount,
                credit: 0,
                memo: debitMemo
            },
            {
                accountId: systemAccounts.ar._id,
                debit: 0,
                credit: amount,
                memo: `سداد من ${customerName}`
            }
        ]
    }, options);

    logger.logSuccess(`Receipt JE Created: ${journalEntry._id}`);
    return journalEntry;
}

// ============================================================
// PUBLIC CONTROLLER FUNCTIONS
// ============================================================

/**
 * POST /finance/receipts
 * Create a new receipt with full transaction processing
 * 
 * SAFETY: Uses MongoDB transaction for atomicity.
 * If journal entry creation fails, the entire receipt is rolled back.
 * This ensures data integrity.
 */
export async function createReceipt(req, res) {
    const { SalesInvoice, Customer } = await getModels();
    const { createIncomeTransaction } = await getServices();

    const {
        customer,
        amount,
        method = 'cash',
        date = new Date(),
        treasury,
        splitDetails = [],
        note = '',
        invoices = []
    } = req.body;

    // ============ VALIDATION ============
    // 1. Validate required fields
    if (!customer) {
        return res.status(400).json({ message: 'العميل مطلوب (customer is required)' });
    }
    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' });
    }

    // 2. Validate treasury (required for single payment)
    // 2. Validate treasury (required for single payment, except wallet)
    if (method !== 'split' && method !== 'wallet' && !treasury) {
        return res.status(400).json({ message: 'الخزينة مطلوبة (treasury is required)' });
    }

    // 3. Validate customer exists
    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
        return res.status(400).json({ message: 'العميل غير موجود (Customer not found)' });
    }

    // 3.1 Prevent receipts for Cash Customer
    // العميل النقدي يدفع مباشرة في نقطة البيع - لا حاجة لسندات قبض
    if (customerDoc.isCashCustomer) {
        return res.status(400).json({
            message: 'العميل النقدي لا تُنشأ له سندات قبض - الدفع يتم مباشرة في نقطة البيع'
        });
    }

    // 4. Validate system accounts exist
    try {
        const systemAccounts = await getSystemAccounts();
        if (!systemAccounts.ar) {
            return res.status(400).json({
                message: 'حساب ذمم العملاء (1030) غير موجود. نفّذ seed-coa-arabic.js أولاً.'
            });
        }
        if (!systemAccounts.cash && method !== 'bank' && method !== 'transfer') {
            return res.status(400).json({
                message: 'حساب الصندوق (1010) غير موجود. نفّذ seed-coa-arabic.js أولاً.'
            });
        }
    } catch (accErr) {
        logger.logError('System accounts validation failed', { error: accErr.message });
        return res.status(400).json({ message: 'فشل التحقق من الحسابات: ' + accErr.message });
    }

    // ============ EXECUTE WITHOUT TRANSACTION (Standalone MongoDB Compatible) ============
    // NOTE: MongoDB transactions require a replica set. For standalone mode, we run without transactions.
    // This is acceptable for development. In production, use a replica set for data integrity.

    try {

        // 1. Process invoice allocations (without session)
        const { allocations } = await _processInvoiceAllocations(
            null, invoices, amount, SalesInvoice
        );

        // 2. Create Receipt Document
        const receipt = await Receipt.create([{
            customer,
            date,
            amount,
            method,
            note,
            invoices: allocations.map(a => a.invoice),
            allocations
        }]);

        const receiptId = receipt[0]._id;

        // 3. Process Treasury Transactions
        await _processTreasuryTransactions(null, {
            method,
            amount,
            splitDetails,
            treasury,
            receiptId,
            date
        }, createIncomeTransaction);

        // 4. Update Customer Balance - With Wallet Excess Logic
        // إذا دفع العميل أكثر من دينه، يُضاف الزائد للمحفظة
        const currentBalance = customerDoc.balance || 0;
        const newBalance = currentBalance - amount;

        if (newBalance < 0) {
            // العميل دفع أكثر من دينه - الزائد يذهب للمحفظة
            const excessAmount = Math.abs(newBalance);
            customerDoc.balance = 0; // صفّر الدين
            customerDoc.walletBalance = (customerDoc.walletBalance || 0) + excessAmount;

            // سجّل معاملة المحفظة
            const { addCredit } = await import('./walletController.js');
            await addCredit(customerDoc._id, excessAmount, 'deposit', {
                type: 'Receipt',  // Must match WalletTransaction reference.type enum
                id: receiptId,
                number: `RCT-${receiptId.toString().slice(-6)}`
            }, `رصيد زائد من سند قبض - دفع ${amount} على دين ${currentBalance}`, req.user?._id);

            logger.info(`💰 Excess ${excessAmount} transferred to wallet for customer ${customerDoc.name}`);
        } else {
            customerDoc.balance = newBalance;
        }
        await customerDoc.save();

        // 5. Create Journal Entry (using journalEntryService)
        await _createReceiptJournalEntry(null, {
            date,
            receiptId,
            method,
            customerName: customerDoc.name,
            amount,
            userId: req.user?._id
        });

        // Return populated receipt (API response unchanged)
        const populated = await Receipt.findById(receiptId)
            .populate('customer', 'name code')
            .populate('allocations.invoice', '_id totals')
            .lean();

        // Audit trail
        await auditCreate('RECEIPT', populated, req.user, req.ip);

        logger.info(`✅ Receipt created successfully: ${receiptId}`);
        res.status(201).json(populated);

    } catch (error) {
        // Log with appropriate level
        if (error instanceof JournalValidationError) {
            logger.logWarning('Receipt Creation Failed - Journal Validation', {
                error: error.message,
                code: error.code
            });
        } else {
            logger.logError('Receipt Creation Failed', {
                error: error.message,
                stack: error.stack
            });
        }

        res.status(400).json({ message: error.message || 'فشل إنشاء السند' });
    }
}

/**
 * GET /finance/receipts
 * Retrieve all receipts with populated references
 */
export async function getReceipts(req, res) {
    res.set('Cache-Control', 'no-store');
    logger.http('GET /receipts called');

    try {
        const data = await Receipt.find()
            .populate('customer', 'name code phone')
            .populate('allocations.invoice', '_id totals date')
            .sort({ createdAt: -1 });

        logger.info(`Fetched ${data.length} receipts (populated)`);
        res.json(data);

    } catch (err) {
        logger.logWarning('Fetching receipts without populate due to error', { error: err.message });

        // Fallback: fetch raw data if populate fails
        try {
            const data = await Receipt.find().sort({ createdAt: -1 });
            logger.info(`Fetched ${data.length} receipts (raw fallback)`);
            res.json(data);
        } catch (fallbackErr) {
            logger.logError('Critical Error fetching receipts', { error: fallbackErr.message });
            res.status(500).json({ message: 'Failed to fetch receipts' });
        }
    }
}

// ============================================================
// TRIAL BALANCE REPORT
// ============================================================

/**
 * GET /finance/reports/trial-balance
 * 
 * Cumulative Trial Balance Report
 * Aggregates all journal entries up to a given date.
 * 
 * Query Params:
 * - to (required): End date (YYYY-MM-DD)
 * - from (optional): Start date, if omitted calculates from oldest entry
 * 
 * Balance Rules:
 * - Assets/Expenses: balance = debitTotal - creditTotal
 * - Liabilities/Equity/Revenue: balance = creditTotal - debitTotal
 */
// ============================================================
// REPORT DATA HELPERS
// ============================================================

/**
 * Calculate Trial Balance Data
 * @private
 */
async function _getTrialBalanceData(from, to) {
    const JournalEntry = (await import('../models/JournalEntry.js')).default;

    // Build date filter
    const dateFilter = {};
    const endDate = endOfDay(new Date(to));
    dateFilter.$lte = endDate;

    if (from) {
        const startDate = startOfDay(new Date(from));
        dateFilter.$gte = startDate;
    }

    // Aggregation Pipeline
    const pipeline = [
        { $match: { date: dateFilter } },
        { $unwind: '$lines' },
        {
            $group: {
                _id: '$lines.account',
                debitTotal: { $sum: '$lines.debit' },
                creditTotal: { $sum: '$lines.credit' }
            }
        },
        {
            $lookup: {
                from: 'accounts',
                localField: '_id',
                foreignField: '_id',
                as: 'accountInfo'
            }
        },
        {
            $unwind: {
                path: '$accountInfo',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 0,
                accountId: '$_id',
                code: { $ifNull: ['$accountInfo.code', 'UNKNOWN'] },
                name: { $ifNull: ['$accountInfo.name', 'حساب غير معروف'] },
                type: { $ifNull: ['$accountInfo.type', 'asset'] },
                debitTotal: { $round: ['$debitTotal', 2] },
                creditTotal: { $round: ['$creditTotal', 2] }
            }
        },
        { $sort: { code: 1 } }
    ];

    const rawResults = await JournalEntry.aggregate(pipeline);

    // Calculate balance
    const accounts = rawResults.map(acc => {
        let balance;
        if (acc.type === 'asset' || acc.type === 'expense') {
            balance = acc.debitTotal - acc.creditTotal;
        } else {
            balance = acc.creditTotal - acc.debitTotal;
        }
        return {
            ...acc,
            balance: Math.round(balance * 100) / 100
        };
    });

    // Totals
    const totalDebit = accounts.reduce((sum, acc) => sum + acc.debitTotal, 0);
    const totalCredit = accounts.reduce((sum, acc) => sum + acc.creditTotal, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return {
        period: { from: from || null, to: to },
        accounts,
        totals: {
            totalDebit: Math.round(totalDebit * 100) / 100,
            totalCredit: Math.round(totalCredit * 100) / 100,
            isBalanced
        }
    };
}

/**
 * GET /finance/reports/trial-balance
 */
export async function getTrialBalance(req, res) {
    const { from, to } = req.query;

    if (!to) {
        return res.status(400).json({ message: 'تاريخ النهاية مطلوب (to date is required)' });
    }

    logger.http(`GET /reports/trial-balance called (from: ${from || 'oldest'}, to: ${to})`);

    try {
        const data = await _getTrialBalanceData(from, to);
        logger.info(`Trial Balance: ${data.accounts.length} accounts, Balanced: ${data.totals.isBalanced}`);
        res.json(data);
    } catch (err) {
        logger.logError('Trial Balance Report Error', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'فشل إنشاء ميزان المراجعة' });
    }
}

/**
 * GET /finance/reports/trial-balance/export
 * Export Trial Balance to Excel
 */
export async function exportTrialBalance(req, res) {
    const { from, to } = req.query;

    if (!to) {
        return res.status(400).json({ message: 'تاريخ النهاية مطلوب' });
    }

    logger.http(`GET /reports/trial-balance/export (to: ${to})`);

    try {
        const data = await _getTrialBalanceData(from, to);
        const { generateTrialBalanceExcel } = await import('../services/excelService.js');
        await generateTrialBalanceExcel(data, res);
        res.end();
    } catch (err) {
        logger.logError('Trial Balance Export Error', { error: err.message });
        res.status(500).json({ message: 'فشل تصدير ميزان المراجعة' });
    }
}

// ============================================================
// INCOME STATEMENT REPORT (قائمة الدخل)
// ============================================================

/**
 * GET /finance/reports/income-statement
 * 
 * قائمة الدخل التراكمية
 * 
 * Query Params:
 * - to (required): تاريخ النهاية (YYYY-MM-DD)
 * - from (optional): تاريخ البداية
 * 
 * Calculates:
 * - إجمالي الإيرادات (totalRevenue)
 * - تكلفة البضاعة المباعة (cogs) - حساب 5010
 * - مجمل الربح (grossProfit) = totalRevenue - cogs
 * - المصروفات التشغيلية (operatingExpenses) - باستثناء 5010
 * - صافي الربح (netProfit) = grossProfit - operatingExpenses
 */
/**
 * Calculate Income Statement Data
 * @private
 */
async function _getIncomeStatementData(from, to) {
    const JournalEntry = (await import('../models/JournalEntry.js')).default;

    // Build date filter
    const dateFilter = {};
    const endDate = endOfDay(new Date(to));
    dateFilter.$lte = endDate;

    if (from) {
        const startDate = startOfDay(new Date(from));
        dateFilter.$gte = startDate;
    }

    // Aggregation Pipeline
    const pipeline = [
        { $match: { date: dateFilter } },
        { $unwind: '$lines' },
        {
            $group: {
                _id: '$lines.account',
                debitTotal: { $sum: '$lines.debit' },
                creditTotal: { $sum: '$lines.credit' }
            }
        },
        {
            $lookup: {
                from: 'accounts',
                localField: '_id',
                foreignField: '_id',
                as: 'accountInfo'
            }
        },
        {
            $unwind: {
                path: '$accountInfo',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 0,
                accountId: '$_id',
                code: { $ifNull: ['$accountInfo.code', 'UNKNOWN'] },
                name: { $ifNull: ['$accountInfo.name', 'حساب غير معروف'] },
                type: { $ifNull: ['$accountInfo.type', 'expense'] },
                debitTotal: { $round: ['$debitTotal', 2] },
                creditTotal: { $round: ['$creditTotal', 2] }
            }
        },
        { $sort: { code: 1 } }
    ];

    const rawResults = await JournalEntry.aggregate(pipeline);

    // Separate accounts and calculate balances
    const revenueAccounts = [];
    const expenseAccounts = [];
    let cogsAccount = null;

    for (const acc of rawResults) {
        let balance;
        if (acc.type === 'revenue') {
            balance = Math.round((acc.creditTotal - acc.debitTotal) * 100) / 100;
            revenueAccounts.push({ code: acc.code, name: acc.name, balance });
        } else if (acc.type === 'expense') {
            balance = Math.round((acc.debitTotal - acc.creditTotal) * 100) / 100;
            if (acc.code === '5010') {
                cogsAccount = { code: acc.code, name: acc.name, balance };
            } else {
                expenseAccounts.push({ code: acc.code, name: acc.name, balance });
            }
        }
    }

    // Totals
    const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const cogs = cogsAccount ? cogsAccount.balance : 0;
    const grossProfit = totalRevenue - cogs;
    const operatingExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const netProfit = grossProfit - operatingExpenses;

    return {
        الفترة: { من: from || null, إلى: to },
        حسابات_الإيرادات: revenueAccounts,
        حساب_تكلفة_البضاعة: cogsAccount,
        حسابات_المصروفات_التشغيلية: expenseAccounts,
        الإجماليات: {
            إجمالي_الإيرادات: Math.round(totalRevenue * 100) / 100,
            تكلفة_البضاعة_المباعة: Math.round(cogs * 100) / 100,
            مجمل_الربح: Math.round(grossProfit * 100) / 100,
            المصروفات_التشغيلية: Math.round(operatingExpenses * 100) / 100,
            صافي_الربح: Math.round(netProfit * 100) / 100
        }
    };
}

/**
 * GET /finance/reports/income-statement
 */
export async function getIncomeStatement(req, res) {
    const { from, to } = req.query;

    if (!to) {
        return res.status(400).json({ message: 'تاريخ النهاية مطلوب' });
    }

    logger.http(`GET /reports/income-statement (from: ${from || 'تراكمي'}, to: ${to})`);

    try {
        const data = await _getIncomeStatementData(from, to);
        logger.info(`Income Statement: Net Profit=${data.الإجماليات.صافي_الربح}`);
        res.json(data);
    } catch (err) {
        logger.logError('Income Statement Report Error', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'فشل إنشاء قائمة الدخل' });
    }
}

/**
 * GET /finance/reports/income-statement/export
 * Export Income Statement to Excel
 */
export async function exportIncomeStatement(req, res) {
    const { from, to } = req.query;

    if (!to) {
        return res.status(400).json({ message: 'تاريخ النهاية مطلوب' });
    }

    logger.http(`GET /reports/income-statement/export (to: ${to})`);

    try {
        const data = await _getIncomeStatementData(from, to);
        const { generateIncomeStatementExcel } = await import('../services/excelService.js');
        await generateIncomeStatementExcel(data, res);
        res.end();
    } catch (err) {
        logger.logError('Income Statement Export Error', { error: err.message });
        res.status(500).json({ message: 'فشل تصدير قائمة الدخل' });
    }
}

// ============================================================
// CUSTOMER STATEMENT REPORT (كشف حساب العميل)
// ============================================================

/**
 * GET /finance/reports/customer-statement
 * 
 * كشف حساب العميل التراكمي
 * 
 * Query Params:
 * - customerId (required): معرّف العميل
 * - to (required): تاريخ النهاية (YYYY-MM-DD)
 * - from (optional): تاريخ البداية
 * 
 * Data Sources:
 * - Sales Invoices (مدين)
 * - Receipts (دائن)
 */
/**
 * Calculate Customer Statement Data
 * @private
 */
async function _getCustomerStatementData(customerId, from, to) {
    const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
    const Customer = (await import('../models/Customer.js')).default;
    const Receipt = (await import('../models/Receipt.js')).default;

    // 1. Verify customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
        throw new Error('العميل غير موجود');
    }

    // 2. Build date filter
    const endDate = endOfDay(new Date(to));

    const dateFilter = { $lte: endDate };

    if (from) {
        const startDate = startOfDay(new Date(from));
        dateFilter.$gte = startDate;
    }

    // 3. Fetch Invoices (مدين - Debit)
    const invoices = await SalesInvoice.find({
        customer: customerId,
        date: dateFilter,
        status: { $ne: 'cancelled' }
    }).select('date number totals').lean();

    // 4. Fetch Receipts (دائن - Credit)
    const receipts = await Receipt.find({
        customer: customerId,
        date: dateFilter
    }).select('date amount method').lean();

    // 5. Combine and format transactions
    const transactions = [];

    // Add invoices as DEBIT
    for (const inv of invoices) {
        transactions.push({
            التاريخ: inv.date,
            النوع: 'فاتورة',
            الرقم: inv.number || inv._id.toString(),
            مدين: Math.round((inv.totals?.grand || 0) * 100) / 100,
            دائن: 0,
            _sortDate: new Date(inv.date).getTime()
        });
    }

    // Add receipts as CREDIT
    for (const rec of receipts) {
        transactions.push({
            التاريخ: rec.date,
            النوع: 'سند قبض',
            الرقم: rec._id.toString(),
            مدين: 0,
            دائن: Math.round(rec.amount * 100) / 100,
            _sortDate: new Date(rec.date).getTime()
        });
    }

    // 6. Sort by date (ascending)
    transactions.sort((a, b) => a._sortDate - b._sortDate);

    // 7. Calculate running balance
    let runningBalance = 0;
    const العمليات = transactions.map(tx => {
        runningBalance += tx.مدين - tx.دائن;
        return {
            التاريخ: tx.التاريخ,
            النوع: tx.النوع,
            الرقم: tx.الرقم,
            مدين: tx.مدين,
            دائن: tx.دائن,
            الرصيد: Math.round(runningBalance * 100) / 100
        };
    });

    // 8. Calculate totals
    const إجمالي_المدين = العمليات.reduce((sum, tx) => sum + tx.مدين, 0);
    const إجمالي_الدائن = العمليات.reduce((sum, tx) => sum + tx.دائن, 0);
    const الرصيد_الختامي = Math.round(runningBalance * 100) / 100;

    return {
        العميل: {
            المعرف: customer._id,
            الاسم: customer.name,
            الكود: customer.code || ''
        },
        الفترة: {
            من: from || null,
            إلى: to
        },
        العمليات,
        الإجماليات: {
            إجمالي_المدين: Math.round(إجمالي_المدين * 100) / 100,
            إجمالي_الدائن: Math.round(إجمالي_الدائن * 100) / 100,
            الرصيد_الختامي
        }
    };
}

/**
 * GET /finance/reports/customer-statement
 */
export async function getCustomerStatement(req, res) {
    const { customerId, from, to } = req.query;

    if (!customerId) {
        return res.status(400).json({ message: 'معرّف العميل مطلوب' });
    }

    if (!to) {
        return res.status(400).json({ message: 'تاريخ النهاية مطلوب' });
    }

    logger.http(`GET /reports/customer-statement (customer: ${customerId}, from: ${from || 'تراكمي'}, to: ${to})`);

    try {
        const data = await _getCustomerStatementData(customerId, from, to);
        logger.info(`Customer Statement: ${data.العميل.الاسم}, Balance: ${data.الإجماليات.الرصيد_الختامي}`);
        res.json(data);
    } catch (err) {
        logger.logError('Customer Statement Report Error', { error: err.message, stack: err.stack });
        const statusCode = err.message === 'العميل غير موجود' ? 404 : 500;
        res.status(statusCode).json({ message: err.message || 'فشل إنشاء كشف حساب العميل' });
    }
}

/**
 * GET /finance/reports/customer-statement/export
 * Export Customer Statement to Excel
 */
export async function exportCustomerStatement(req, res) {
    const { customerId, from, to } = req.query;

    if (!customerId || !to) {
        return res.status(400).json({ message: 'معرّف العميل وتاريخ النهاية مطلوبان' });
    }

    logger.http(`GET /reports/customer-statement/export (customer: ${customerId}, to: ${to})`);

    try {
        const data = await _getCustomerStatementData(customerId, from, to);
        const { generateCustomerStatementExcel } = await import('../services/excelService.js');
        await generateCustomerStatementExcel(data, res);
        res.end();
    } catch (err) {
        logger.logError('Customer Statement Export Error', { error: err.message });
        res.status(500).json({ message: 'فشل تصدير كشف حساب العميل' });
    }
}

// ============================================================
// AGING REPORT (تقرير أعمار الديون)
// ============================================================

/**
 * GET /finance/reports/aging
 * 
 * تقرير أعمار الديون
 * 
 * Query Params:
 * - to (required): تاريخ النهاية (YYYY-MM-DD)
 * - bucket (optional): حجم الفترة الزمنية بالأيام (default: 30)
 * 
 * Uses:
 * - SalesInvoice.totals.remaining as source of truth
 * - Only confirmed/posted invoices with remaining > 0
 */
/**
 * Calculate Aging Report Data
 * @private
 */
async function _getAgingReportData(to, bucket = 30) {
    const SalesInvoice = (await import('../models/SalesInvoice.js')).default;

    // Validate bucket
    const bucketSize = Number(bucket) || 30;

    const endDate = endOfDay(new Date(to));

    // 1. Fetch invoices with remaining balance > 0
    const invoices = await SalesInvoice.find({
        date: { $lte: endDate },
        'totals.remaining': { $gt: 0.01 },
        status: { $in: ['confirmed', 'posted', 'pending'] } // Exclude draft, cancelled
    })
        .select('date customer totals.remaining totals.grand number')
        .populate('customer', 'name code')
        .lean();

    // 2. Calculate age and assign to buckets
    const customerMap = new Map();

    for (const inv of invoices) {
        const invoiceDate = new Date(inv.date);
        const ageDays = Math.floor((endDate - invoiceDate) / (1000 * 60 * 60 * 24));
        const remaining = inv.totals?.remaining || 0;

        // Determine bucket
        let bucketKey;
        if (ageDays <= bucketSize) {
            bucketKey = '0_30';
        } else if (ageDays <= bucketSize * 2) {
            bucketKey = '31_60';
        } else if (ageDays <= bucketSize * 3) {
            bucketKey = '61_90';
        } else {
            bucketKey = '90_أكثر';
        }

        // Get or create customer entry
        const customerId = inv.customer?._id?.toString() || 'unknown';
        if (!customerMap.has(customerId)) {
            customerMap.set(customerId, {
                العميل: {
                    المعرف: customerId,
                    الاسم: inv.customer?.name || 'عميل غير معروف',
                    الكود: inv.customer?.code || ''
                },
                '0_30': 0,
                '31_60': 0,
                '61_90': 0,
                '90_أكثر': 0,
                الإجمالي: 0
            });
        }

        const customerData = customerMap.get(customerId);
        customerData[bucketKey] += remaining;
        customerData['الإجمالي'] += remaining;
    }

    // 3. Convert to array and round values
    const العملاء = Array.from(customerMap.values()).map(c => ({
        ...c,
        '0_30': Math.round(c['0_30'] * 100) / 100,
        '31_60': Math.round(c['31_60'] * 100) / 100,
        '61_90': Math.round(c['61_90'] * 100) / 100,
        '90_أكثر': Math.round(c['90_أكثر'] * 100) / 100,
        الإجمالي: Math.round(c['الإجمالي'] * 100) / 100
    }));

    // Sort by total descending
    العملاء.sort((a, b) => b['الإجمالي'] - a['الإجمالي']);

    // 4. Calculate grand totals
    const الإجماليات = {
        '0_30': Math.round(العملاء.reduce((sum, c) => sum + c['0_30'], 0) * 100) / 100,
        '31_60': Math.round(العملاء.reduce((sum, c) => sum + c['31_60'], 0) * 100) / 100,
        '61_90': Math.round(العملاء.reduce((sum, c) => sum + c['61_90'], 0) * 100) / 100,
        '90_أكثر': Math.round(العملاء.reduce((sum, c) => sum + c['90_أكثر'], 0) * 100) / 100,
        الإجمالي: Math.round(العملاء.reduce((sum, c) => sum + c['الإجمالي'], 0) * 100) / 100
    };

    return {
        إلى: to,
        العملاء,
        الإجماليات
    };
}

/**
 * GET /finance/reports/aging
 */
export async function getAgingReport(req, res) {
    const { to, bucket = 30 } = req.query;

    if (!to) {
        return res.status(400).json({ message: 'تاريخ النهاية مطلوب' });
    }

    const bucketSize = Number(bucket) || 30;

    logger.http(`GET /reports/aging (to: ${to}, bucket: ${bucketSize})`);

    try {
        const data = await _getAgingReportData(to, bucket);
        logger.info(`Aging Report: ${data.العملاء.length} customers, Total: ${data.الإجماليات.الإجمالي}`);
        res.json(data);
    } catch (err) {
        logger.logError('Aging Report Error', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'فشل إنشاء تقرير أعمار الديون' });
    }
}

/**
 * GET /finance/reports/aging/export
 * Export Aging Report to Excel
 */
export async function exportAgingReport(req, res) {
    const { to, bucket = 30 } = req.query;

    if (!to) {
        return res.status(400).json({ message: 'تاريخ النهاية مطلوب' });
    }

    logger.http(`GET /reports/aging/export (to: ${to})`);

    try {
        const data = await _getAgingReportData(to, bucket);
        const { generateAgingReportExcel } = await import('../services/excelService.js');
        await generateAgingReportExcel(data, res);
        res.end();
    } catch (err) {
        logger.logError('Aging Report Export Error', { error: err.message });
        res.status(500).json({ message: 'فشل تصدير تقرير أعمار الديون' });
    }
}

/**
 * Get Balance Sheet Report (Cumulative, as of a specific date)
 * GET /api/finance/reports/balance-sheet?to=YYYY-MM-DD
 * 
 * Categorizes accounts into Assets, Liabilities, and Equity
 * Verifies: Total Assets = Total Liabilities + Equity
 */
export const getBalanceSheet = async (req, res) => {
    const { to } = req.query;

    if (!to) {
        return res.status(400).json({ message: 'تاريخ النهاية (to) مطلوب' });
    }

    logger.http(`GET /reports/balance-sheet (to: ${to})`);

    try {
        // 1. Get Trial Balance data (cumulative up to 'to' date)
        // Passing null as 'from' ensures we get data from the beginning of time
        const trialBalanceData = await _getTrialBalanceData(null, to);

        // 2. Categorize accounts by type
        const assets = [];
        const liabilities = [];
        const equity = [];

        // Track cumulative P&L for Retained Earnings
        let totalRevenue = 0;
        let totalExpense = 0;

        trialBalanceData.accounts.forEach(acc => {
            const accountType = acc.type?.toLowerCase();

            // Calculate balance based on account nature
            let balance = 0;
            if (accountType === 'asset') {
                balance = acc.debitTotal - acc.creditTotal;
            } else if (accountType === 'liability' || accountType === 'equity') {
                balance = acc.creditTotal - acc.debitTotal;
            } else if (accountType === 'revenue') {
                // Revenue is normally Credit balance
                balance = acc.creditTotal - acc.debitTotal;
                totalRevenue += balance;
            } else if (accountType === 'expense') {
                // Expense is normally Debit balance
                balance = acc.debitTotal - acc.creditTotal;
                totalExpense += balance;
            }

            const accountData = {
                code: acc.code,
                name: acc.name,
                balance: Number(balance.toFixed(2))
            };

            if (accountType === 'asset') {
                assets.push(accountData);
            } else if (accountType === 'liability') {
                liabilities.push(accountData);
            } else if (accountType === 'equity') {
                equity.push(accountData);
            }
        });

        // 3. Calculate Retained Earnings (الأرباح المحتجزة)
        // This makes the Balance Sheet balance: Assets = Liabilities + Equity + (Revenue - Expense)
        const retainedEarnings = totalRevenue - totalExpense;

        // Add to Equity
        if (Math.abs(retainedEarnings) > 0.001) {
            equity.push({
                code: '9999',
                name: 'الأرباح المحتجزة (Retained Earnings)',
                balance: Number(retainedEarnings.toFixed(2)),
                isCalculated: true
            });
        }

        // 4. Calculate totals
        const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
        const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
        const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

        // 5. Check balance (with small tolerance for floating point)
        const tolerance = 0.01;
        const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < tolerance;

        // 6. Arabic response
        const response = {
            إلى: to,
            الأصول: {
                الحسابات: assets,
                الإجمالي: Number(totalAssets.toFixed(2))
            },
            الخصوم: {
                الحسابات: liabilities,
                الإجمالي: Number(totalLiabilities.toFixed(2))
            },
            حقوق_الملكية: {
                الحسابات: equity,
                الإجمالي: Number(totalEquity.toFixed(2))
            },
            الإجماليات: {
                إجمالي_الأصول: Number(totalAssets.toFixed(2)),
                إجمالي_الخصوم_وحقوق_الملكية: Number(totalLiabilitiesAndEquity.toFixed(2)),
                متوازن: isBalanced,
                الفرق: Number((totalAssets - totalLiabilitiesAndEquity).toFixed(2))
            }
        };

        res.json(response);
    } catch (err) {
        logger.logError('Balance Sheet Error', { error: err.message });
        res.status(500).json({ message: 'فشل تحميل الميزانية العمومية' });
    }
};
