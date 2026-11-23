/**
 * PaymentVoucher Controller — سندات الدفع
 *
 * يدعم:
 * - دفع للعميل (رد رصيد دائن / باقي لك)
 * - دفع للمورد (تسديد دين)
 * - مصاريف / دفعات أخرى
 *
 * يُحدّث:
 * - رصيد الخزينة (createExpenseTransaction)
 * - رصيد العميل / المورد إن وجد
 * - قيد محاسبي تلقائي
 */

import PaymentVoucher from '../models/PaymentVoucher.js';
import logger from '../config/logger.js';
import { runPostingTransaction } from '../services/postingService.js';
import { postJournalEntry } from '../services/journalEntryService.js';
import { auditCreate } from '../services/auditService.js';
import { getSystemAccount } from '../services/systemAccountsService.js';
import { applyFiscalDateFilter } from '../middleware/fiscalPeriod.js';

// Dynamic imports to avoid circular deps
const getModels = async () => {
    const Customer = (await import('../models/Customer.js')).default;
    const Supplier  = (await import('../models/Supplier.js')).default;
    return { Customer, Supplier };
};

const getServices = async () => {
    const { createExpenseTransaction } = await import('../services/transactionService.js');
    return { createExpenseTransaction };
};

// ── Helpers ─────────────────────────────────────────────────────────────────

async function _processTreasury(session, { method, amount, splitDetails, treasury, voucherId, date }, createExpenseTransaction) {
    const txIds = [];

    if (method === 'split' && splitDetails?.length) {
        const total = splitDetails.reduce((s, p) => s + Number(p.amount || 0), 0);
        if (Math.abs(total - amount) > 0.1) throw new Error('مجموع الدفعات لا يساوي المبلغ الإجمالي');

        for (const split of splitDetails) {
            if (Number(split.amount) > 0 && split.treasury) {
                const tx = await createExpenseTransaction({
                    amount:       split.amount,
                    treasury:     split.treasury,
                    relatedId:    voucherId,
                    relatedModel: 'PaymentVoucher',
                    description:  `سند دفع #${voucherId.toString().slice(-6)} (${split.method})`,
                    category:     'payment',
                    date,
                }, session);
                if (tx) txIds.push(tx._id);
            }
        }
    } else {
        if (!treasury) throw new Error('الخزينة مطلوبة');
        const tx = await createExpenseTransaction({
            amount,
            treasury,
            relatedId:    voucherId,
            relatedModel: 'PaymentVoucher',
            description:  `سند دفع #${voucherId.toString().slice(-6)}`,
            category:     'payment',
            date,
        }, session);
        if (tx) txIds.push(tx._id);
    }

    return txIds;
}

async function _buildJournalEntry(session, { date, voucherId, method, splitDetails = [], beneficiaryType, beneficiaryLabel, amount, userId }) {
    // Debit depends on beneficiaryType:
    // customer: AR (ذمم العملاء) -> customer credit balance refund
    // supplier: AP (ذمم الموردين) -> supplier debt settlement
    // expense / other: GENERAL_EXPENSES (المصروفات العمومية)
    let debitKey = 'GENERAL_EXPENSES';
    if (beneficiaryType === 'customer') debitKey = 'AR';
    else if (beneficiaryType === 'supplier') debitKey = 'AP';

    const debitAcc = await getSystemAccount(debitKey, session);

    const lines = [
        { accountId: debitAcc._id, debit: amount, credit: 0, memo: `سند دفع — ${beneficiaryLabel}` }
    ];

    if (method === 'split' && Array.isArray(splitDetails) && splitDetails.length > 0) {
        for (const split of splitDetails) {
            const splitAmount = Number(split.amount) || 0;
            if (splitAmount <= 0) continue;
            const creditKey = (split.method === 'bank' || split.method === 'check') ? 'BANK' : 'CASH';
            const creditAcc = await getSystemAccount(creditKey, session);
            lines.push({
                accountId: creditAcc._id,
                debit: 0,
                credit: splitAmount,
                memo: `خروج ${split.method === 'bank' ? 'بنكي' : 'نقدي'} مجزأ — ${beneficiaryLabel}`,
            });
        }
    } else {
        const creditKey = (method === 'bank' || method === 'check') ? 'BANK' : 'CASH';
        const creditAcc = await getSystemAccount(creditKey, session);
        lines.push({
            accountId: creditAcc._id,
            debit: 0,
            credit: amount,
            memo: `خروج ${method === 'bank' ? 'بنكي' : 'نقدي'} — ${beneficiaryLabel}`,
        });
    }

    const je = await postJournalEntry({
        date,
        referenceType: 'PAYMENT_VOUCHER',
        referenceId:   voucherId.toString(),
        ref:           `PV-${voucherId.toString().slice(-6)}`,
        note:          `سند دفع — ${beneficiaryLabel}`,
        createdBy:     userId,
        lines,
    }, session ? { session, updateBalances: true } : { updateBalances: true });

    return je;
}

// ── POST /finance/payments ───────────────────────────────────────────────────
export async function createPaymentVoucher(req, res) {
    const { Customer, Supplier } = await getModels();
    const { createExpenseTransaction } = await getServices();

    const {
        beneficiaryType,
        customer:    customerId,
        supplier:    supplierId,
        beneficiary,
        amount,
        method = 'cash',
        treasury,
        splitDetails = [],
        note = '',
        date = new Date(),
    } = req.body;

    if (!beneficiaryType) return res.status(400).json({ message: 'نوع المستفيد مطلوب' });
    if (!amount || amount <= 0) return res.status(400).json({ message: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' });
    if (method !== 'split' && !treasury) return res.status(400).json({ message: 'الخزينة مطلوبة' });

    try {
        const populated = await runPostingTransaction(async (session) => {
            let beneficiaryLabel = beneficiary || 'مستفيد';
            let customerDoc = null;
            let supplierDoc = null;
            let previousBalance = null;
            let remainingBalance = null;

            if (beneficiaryType === 'customer' && customerId) {
                customerDoc = await Customer.findById(customerId).session(session);
                if (!customerDoc) throw new Error('العميل غير موجود');
                beneficiaryLabel = customerDoc.name;
                previousBalance = Number(customerDoc.balance || 0);

                // Increase customer balance (we're paying them → balance goes more negative or reduces)
                // When we pay a customer back: their balance increases (less debt on our side = more credit to them)
                // But since customer.balance < 0 means we owe them: paying them → balance goes toward 0 or more negative
                // Actually: paying customer means they no longer have credit with us → balance += amount (toward 0)
                customerDoc.balance = Math.round(((customerDoc.balance || 0) + Number(amount)) * 1000) / 1000;
                remainingBalance = customerDoc.balance;
                await customerDoc.save({ session });
            }

            if (beneficiaryType === 'supplier' && supplierId) {
                supplierDoc = await Supplier.findById(supplierId).session(session);
                if (!supplierDoc) throw new Error('المورد غير موجود');
                beneficiaryLabel = supplierDoc.name;
                previousBalance = Number(supplierDoc.balance || 0);

                // Reduce supplier balance (we're paying them)
                supplierDoc.balance = Math.round(((supplierDoc.balance || 0) - Number(amount)) * 1000) / 1000;
                remainingBalance = supplierDoc.balance;
                await supplierDoc.save({ session });
            }

            // Create voucher doc
            const [voucher] = await PaymentVoucher.create([{
                beneficiaryType,
                customer:    customerId || undefined,
                supplier:    supplierId || undefined,
                beneficiary: beneficiaryLabel,
                amount,
                method,
                treasury:    method === 'split' ? (splitDetails.find(s => s.method === 'cash')?.treasury || splitDetails[0]?.treasury) : treasury,
                splitDetails: method === 'split' ? splitDetails : [],
                note,
                date,
                status: 'posted',
                createdBy: req.user?._id,
            }], { session });

            // Process treasury (deduct from cash/bank)
            await _processTreasury(session, { method, amount, splitDetails, treasury, voucherId: voucher._id, date }, createExpenseTransaction);

            // Journal entry
            const je = await _buildJournalEntry(session, {
                date,
                voucherId: voucher._id,
                method,
                splitDetails: method === 'split' ? splitDetails : [],
                beneficiaryType,
                beneficiaryLabel,
                amount,
                userId: req.user?._id,
            });

            voucher.journalEntry = je._id;
            await voucher.save({ session });

            await auditCreate('PAYMENT_VOUCHER', voucher, req.user, req.ip, session, { action: 'POST' });

            const resultDoc = await PaymentVoucher.findById(voucher._id)
                .session(session)
                .populate('customer', 'name code phone balance')
                .populate('supplier', 'name code phone balance')
                .populate('treasury', 'name type')
                .lean();

            if (resultDoc && remainingBalance !== null) {
                resultDoc.previousBalance = previousBalance;
                resultDoc.remainingBalance = remainingBalance;
            }

            return resultDoc;
        });

        logger.info(`PaymentVoucher created: ${populated?._id}`);
        res.status(201).json(populated);
    } catch (err) {
        logger.logError('PaymentVoucher creation failed', { error: err.message });
        res.status(400).json({ message: err.message || 'فشل إنشاء سند الدفع' });
    }
}

// ── GET /finance/payments ────────────────────────────────────────────────────
export async function getPaymentVouchers(req, res) {
    try {
        const filter = {};
        if (req.query.beneficiaryType) filter.beneficiaryType = req.query.beneficiaryType;
        if (req.query.customer)        filter.customer        = req.query.customer;
        if (req.query.supplier)        filter.supplier        = req.query.supplier;
        if (req.query.status)          filter.status          = req.query.status;

        applyFiscalDateFilter(req, filter, 'date');

        const data = await PaymentVoucher.find(filter)
            .populate('customer', 'name code phone balance')
            .populate('supplier', 'name code phone balance')
            .populate('treasury', 'name type')
            .sort({ date: -1, createdAt: -1 });

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: 'فشل جلب سندات الدفع' });
    }
}

// ── POST /finance/payments/:id/void ─────────────────────────────────────────
export async function voidPaymentVoucher(req, res) {
    const { Customer, Supplier } = await getModels();
    const { createExpenseTransaction } = await getServices();

    try {
        const { id } = req.params;
        await runPostingTransaction(async (session) => {
            const voucher = await PaymentVoucher.findById(id).session(session);
            if (!voucher) throw new Error('السند غير موجود');
            if (voucher.status !== 'posted') throw new Error('لا يمكن إلغاء سند غير مرحّل');

            // 0. Check Fiscal Period
            const FiscalPeriod = (await import('../models/FiscalPeriod.js')).default;
            const closed = await FiscalPeriod.findOne({
                startDate: { $lte: voucher.date },
                endDate: { $gte: voucher.date },
                isClosed: true,
            }).session(session);
            if (closed) throw new Error(`لا يمكن إلغاء السند لأنه يقع ضمن فترة مالية مغلقة (${closed.name})`);

            const beforeState = voucher.toObject();

            // 1. Reverse customer or supplier balance changes
            if (voucher.beneficiaryType === 'customer' && voucher.customer) {
                await Customer.findByIdAndUpdate(voucher.customer,
                    { $inc: { balance: -Number(voucher.amount) } },
                    { session }
                );
            }
            if (voucher.beneficiaryType === 'supplier' && voucher.supplier) {
                await Supplier.findByIdAndUpdate(voucher.supplier,
                    { $inc: { balance: Number(voucher.amount) } },
                    { session }
                );
            }

            // 2. Restore funds to Treasury (reversal transaction)
            const { createIncomeTransaction } = await import('../services/transactionService.js');
            if (voucher.method === 'split' && voucher.splitDetails?.length) {
                for (const split of voucher.splitDetails) {
                    if (Number(split.amount) > 0 && split.treasury) {
                        await createIncomeTransaction({
                            amount: split.amount,
                            treasury: split.treasury,
                            relatedId: voucher._id,
                            relatedModel: 'PaymentVoucher',
                            description: `إلغاء سند دفع #${voucher.number || voucher._id.toString().slice(-6)} (${split.method})`,
                            category: 'payment_reversal',
                            date: new Date(),
                        }, session);
                    }
                }
            } else if (voucher.treasury) {
                await createIncomeTransaction({
                    amount: voucher.amount,
                    treasury: voucher.treasury,
                    relatedId: voucher._id,
                    relatedModel: 'PaymentVoucher',
                    description: `إلغاء سند دفع #${voucher.number || voucher._id.toString().slice(-6)}`,
                    category: 'payment_reversal',
                    date: new Date(),
                }, session);
            }

            // 3. Reverse Journal Entry if exists
            if (voucher.journalEntry) {
                const { reverseJournalEntry } = await import('../services/journalEntryService.js');
                await reverseJournalEntry(voucher.journalEntry, req.user?._id, 'إلغاء سند الدفع');
            }

            voucher.status = 'void';
            await voucher.save({ session });

            // 4. Audit Trail
            const { auditUpdate } = await import('../services/auditService.js');
            await auditUpdate('PAYMENT_VOUCHER', voucher._id, beforeState, voucher, req.user, req.ip, session, { action: 'VOID' });
        });

        const updated = await PaymentVoucher.findById(id)
            .populate('customer', 'name code')
            .populate('supplier', 'name code')
            .lean();

        res.json({ message: 'تم إلغاء السند', voucher: updated });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
}
