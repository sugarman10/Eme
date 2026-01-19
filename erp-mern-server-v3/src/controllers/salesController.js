import mongoose from 'mongoose';
import SalesInvoice from '../models/SalesInvoice.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Treasury from '../models/Treasury.js';
import Notification from '../models/Notification.js';
import { generateInvoiceNumber } from '../services/counterService.js';
import { deductStock, deductStockBulk } from '../services/stockService.js';
import { createIncomeTransaction } from '../services/transactionService.js';
import { postJournalEntry, JournalValidationError } from '../services/journalEntryService.js';
import Account from '../models/Account.js';
import { getOrgTaxRate } from '../services/settingService.js';
import { add, sub, mul, round } from '../utils/mathUtils.js';
import { sendNotification } from '../socket.js';
import logger from '../config/logger.js';
import { auditCreate, AuditError } from '../services/auditService.js';
import { startOfDay, endOfDay } from '../utils/dateUtils.js';
import { useCredit } from './walletController.js';

// ============================================================
// SYSTEM ACCOUNTS CACHE FOR SALES
// ============================================================
let _salesAccountsCache = null;
let _salesCacheTimestamp = 0;
const SALES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get sales-related system accounts (with caching)
 * @returns {Promise<Object>} - { cash, bank, ar, salesRevenue, vatPayable }
 */
async function getSalesSystemAccounts(session = null) {
    const now = Date.now();

    if (_salesAccountsCache && (now - _salesCacheTimestamp) < SALES_CACHE_TTL) {
        return _salesAccountsCache;
    }

    const codes = ['1010', '1020', '1030', '4010', '2020', '2030'];
    const query = Account.find({ code: { $in: codes } });
    if (session) query.session(session);

    const accounts = await query;

    const result = {
        cash: accounts.find(a => a.code === '1010'),        // الصندوق
        bank: accounts.find(a => a.code === '1020'),        // البنك
        ar: accounts.find(a => a.code === '1030'),          // ذمم العملاء
        salesRevenue: accounts.find(a => a.code === '4010'), // إيرادات المبيعات
        salesRevenue: accounts.find(a => a.code === '4010'), // إيرادات المبيعات
        vatPayable: accounts.find(a => a.code === '2020'),    // ض.ق.م المستحقة
        customerDeposits: accounts.find(a => a.code === '2030') // العملاء - دفعات مقدمة (محفظة)
    };

    _salesAccountsCache = result;
    _salesCacheTimestamp = now;

    return result;
}

/**
 * Clear sales accounts cache
 */
export function clearSalesAccountsCache() {
    _salesAccountsCache = null;
    _salesCacheTimestamp = 0;
}

/**
 * Create Journal Entry for Sales Invoice
 * 
 * @param {Object} params - Invoice data
 * @param {Object} session - MongoDB session for transaction
 */
async function _createSalesJournalEntry(params, session) {
    const {
        invoiceId,
        invoiceNumber,
        date,
        paidAmount,
        remaining,
        grand,
        tax,
        customerName,
        paymentMethod,
        userId,
        splitDetails
    } = params;

    logger.info('🔄 Creating Sales Invoice Journal Entry...');

    // Get system accounts (cached)
    const accounts = await getSalesSystemAccounts(session);

    // Validate required accounts
    if (!accounts.salesRevenue) {
        throw new Error('حساب إيرادات المبيعات (4010) غير موجود. نفّذ seed-coa-arabic.js أولاً.');
    }

    const lines = [];
    const netSales = sub(grand, tax); // صافي المبيعات = الإجمالي - الضريبة

    // ===== DEBIT SIDE =====

    // If paid amount > 0, debit Cash or Bank or Wallet
    if (paidAmount > 0) {

        // Helper to add debit line
        const addDebitLine = (amount, type) => {
            let debitAccount;
            let debitMemo;

            if (type === 'bank' || type === 'transfer' || type === 'card') {
                if (!accounts.bank) throw new Error('حساب البنك (1020) غير موجود');
                debitAccount = accounts.bank;
                debitMemo = `تحصيل بنكي/بطاقة - فاتورة مبيعات`;
            } else if (type === 'wallet') {
                if (!accounts.customerDeposits) throw new Error('حساب أمانات العملاء/المحفظة (2030) غير موجود');
                debitAccount = accounts.customerDeposits;
                debitMemo = `خصم من المحفظة - فاتورة مبيعات`;
            } else {
                if (!accounts.cash) throw new Error('حساب الصندوق (1010) غير موجود');
                debitAccount = accounts.cash;
                debitMemo = `تحصيل نقدي - فاتورة مبيعات`;
            }

            lines.push({
                accountId: debitAccount._id,
                debit: amount,
                credit: 0,
                memo: debitMemo
            });
        };

        if (paymentMethod === 'split' && splitDetails && splitDetails.length > 0) {
            // Handle Split Payment Debits
            for (const split of splitDetails) {
                if (Number(split.amount) > 0) {
                    addDebitLine(Number(split.amount), split.method);
                }
            }
        } else {
            // Handle Single Payment
            addDebitLine(paidAmount, paymentMethod);
        }
    }

    // If remaining > 0 (credit sale), debit AR
    if (remaining > 0) {
        if (!accounts.ar) {
            throw new Error('حساب ذمم العملاء (1030) غير موجود. نفّذ seed-coa-arabic.js أولاً.');
        }
        lines.push({
            accountId: accounts.ar._id,
            debit: remaining,
            credit: 0,
            memo: `آجل - ${customerName || 'عميل نقدي'}`
        });
    }

    // ===== CREDIT SIDE =====

    // Credit Sales Revenue (net of tax)
    lines.push({
        accountId: accounts.salesRevenue._id,
        debit: 0,
        credit: netSales,
        memo: 'إيرادات مبيعات'
    });

    // Credit VAT Payable (if tax > 0)
    if (tax > 0) {
        if (!accounts.vatPayable) {
            throw new Error('حساب ض.ق.م المستحقة (2020) غير موجود. نفّذ seed-coa-arabic.js أولاً.');
        }
        lines.push({
            accountId: accounts.vatPayable._id,
            debit: 0,
            credit: tax,
            memo: 'ضريبة القيمة المضافة'
        });
    }

    // Create journal entry using journalEntryService
    const journalEntry = await postJournalEntry({
        date,
        referenceType: 'SALE_INVOICE',
        referenceId: invoiceId.toString(),
        ref: `INV-${invoiceNumber}`,
        note: `فاتورة مبيعات - ${customerName || 'نقدي'}`,
        createdBy: userId,
        lines
    }, { session, updateBalances: true });

    logger.logSuccess(`Sales JE Created: ${journalEntry._id}`);
    return journalEntry;
}

/**
 * Create Sales Invoice with Atomic Transaction
 * 
 * ✅ FIXED: Race Condition Prevention
 * - Stock validation now happens INSIDE the transaction
 * - Uses .session(session) to lock documents during read
 * - Prevents overselling even with concurrent requests
 * 
 * ✅ UPDATED: Mandatory Journal Entry
 * - Uses journalEntryService with Arabic account codes
 * - Rollback entire invoice if JE fails
 * 
 * Flow:
 * 1. Start MongoDB Session & Transaction
 * 2. ✅ CRITICAL: Validate stock INSIDE transaction with document locking
 * 3. Generate invoice number
 * 4. Create invoice
 * 5. Deduct stock from warehouse (atomic)
 * 6. Create financial transaction
 * 7. Update treasury balance
 * 8. Update customer balance (if applicable) & Check Credit
 * 9. ✅ Create Journal Entry (MANDATORY - rollback if fails)
 * 10. Commit or Rollback
 */
export async function createInvoiceWithTransaction(invoiceData, userId = null) {

    // Helper function to execute the core logic
    // Accepts a session (which might be null if running in standalone mode)
    const executeInvoiceLogic = async (activeSession) => {
        const {
            items,
            customer,
            channel = 'retail',
            warehouse,
            treasury,
            date = new Date(),
            note = '',
            discountValue = 0,
            paid = 0,
            paymentMethod = 'cash',
            status = 'confirmed',
            splitDetails = [],
            type = 'official' // Default to official
        } = invoiceData;

        // ===== CRITICAL VALIDATION: Warehouse & Treasury Required =====
        if (!warehouse) {
            throw new Error('المستودع مطلوب (Warehouse is required)');
        }

        // Check if payment is made (treasury required EXCEPT for wallet/split payments)
        // For split payments, treasury is validated per-split in the payment processing loop
        const paidAmountCheck = Number(paid || 0);
        if (paidAmountCheck > 0 && !treasury && paymentMethod !== 'wallet' && paymentMethod !== 'split') {
            throw new Error('الخزينة مطلوبة (Treasury is required for payments)');
        }

        // ===== CASH CUSTOMER VALIDATION =====
        // العميل النقدي لا يمكن البيع له بالآجل - يجب دفع المبلغ كاملاً
        if (customer) {
            const customerQuery = activeSession
                ? Customer.findById(customer).session(activeSession)
                : Customer.findById(customer);
            const customerDoc = await customerQuery;

            if (customerDoc && customerDoc.isCashCustomer) {
                // For cash customer: Calculate what the total should be
                // We need to check this AFTER calculating totals, but we can do a preliminary check
                // Force channel to 'retail' for cash customer
                if (channel !== 'retail') {
                    throw new Error('العميل النقدي للبيع بالتجزئة فقط (Cash customer is retail only)');
                }
            }
        }

        // ===== STEP A: STRICT SERVER-SIDE STOCK VALIDATION =====
        // ✅ FIX: This now happens INSIDE the transaction with document locking
        if (status === 'confirmed' || status === 'posted') {
            // ===== OPTIMIZATION: Bulk Read Items (1 Query) =====
            const itemIds = items.map(i => i.item);
            // Only apply session if it exists
            const itemQuery = Item.find({ _id: { $in: itemIds } });
            if (activeSession) itemQuery.session(activeSession);
            const products = await itemQuery;
            const productMap = new Map(products.map(p => [p._id.toString(), p]));

            // Strict Validation Loop (Memory Only)
            for (const row of items) {
                const product = productMap.get(row.item.toString());

                if (!product) {
                    throw new Error(`المنتج غير موجود (Product not found): ${row.item}`);
                }

                // Price Safeguard Logic
                if (!row.price || Number(row.price) <= 0) {
                    const priceToUse = channel === 'wholesale'
                        ? (product.wholesalePrice || product.price)
                        : product.price;
                    row.price = priceToUse;
                }

                // Initial Stock Check (Memory) - Note: The real check is in bulkWrite later
                // But we check here to give a specific error message about WHICH item failed
                // because bulkWrite just says "failed".
                const warehouseStock = product.stocks.find(
                    s => s.warehouse.toString() === warehouse.toString()
                );
                const availableQty = warehouseStock ? warehouseStock.qty : 0;

                if (!warehouseStock || availableQty < row.qty) {
                    throw new Error(
                        `رصيد غير كافٍ للصنف: ${product.name}. ` +
                        `المتوفر في ${warehouse}: ${availableQty}, ` +
                        `المطلوب: ${row.qty}`
                    );
                }
            }
        }

        // ===== STEP B: Validate Treasury Exists (If provided) =====
        // SKIP for Proforma if no payment is supposedly involved, though proforma usually has no payment.
        if (type === 'official' && treasury) {
            const treasuryQuery = Treasury.findById(treasury);
            if (activeSession) treasuryQuery.session(activeSession);
            const treasuryDoc = await treasuryQuery;
            if (!treasuryDoc) {
                throw new Error('الخزينة غير موجودة (Treasury not found)');
            }

            if (!treasuryDoc.isActive) {
                throw new Error('الخزينة غير نشطة (Treasury is inactive)');
            }
        }

        // ===== STEP C: Generate Invoice Number =====
        const invoiceNumber = await generateInvoiceNumber('INV');

        // ===== STEP D: Calculate Totals =====
        const subtotal = items.reduce((sum, item) => add(sum, mul(item.price, item.qty)), 0);

        // Fetch Tax Rate from Settings (default 0 if not set)
        const taxRate = await getOrgTaxRate();
        const tax = mul(subtotal, taxRate / 100);

        const discount = Number(discountValue || 0);
        const paidAmount = Number(paid || 0);

        // Grand Total = Subtotal - Discount + Tax
        const grand = add(sub(subtotal, discount), tax);
        const remaining = sub(grand, paidAmount);

        // Validate payment amount
        if (paidAmount > grand) {
            throw new Error(
                `المبلغ المدفوع (${paidAmount}) أكبر من الإجمالي (${grand})`
            );
        }

        // ===== CASH CUSTOMER: Must pay full amount =====
        // العميل النقدي يجب أن يدفع كامل المبلغ
        if (customer) {
            const cashCustomerCheck = activeSession
                ? await Customer.findById(customer).session(activeSession)
                : await Customer.findById(customer);

            if (cashCustomerCheck && cashCustomerCheck.isCashCustomer) {
                if (remaining > 0.01) {
                    throw new Error(
                        `العميل النقدي يجب أن يدفع كامل المبلغ. المتبقي: ${remaining.toFixed(2)} د.ل`
                    );
                }
            }
        }

        // Get item costs for profit tracking (inside transaction)
        // Get item costs for profit tracking (inside transaction)
        const allItemIds = items.map(i => i.item);
        const costQuery = Item.find({ _id: { $in: allItemIds } }).select('cost');
        if (activeSession) costQuery.session(activeSession);
        const costDocs = await costQuery;
        const costMap = new Map(costDocs.map(d => [d._id.toString(), d.cost || 0]));

        const itemsWithCost = items.map(item => ({
            ...item,
            cost: costMap.get(item.item.toString()) || 0
        }));

        // ===== STEP E: Create Invoice Document =====
        // Note: Model.create requires array for session option in some mongoose versions, or options object
        // If activeSession is null, we pass undefined to options
        const createOptions = activeSession ? { session: activeSession } : undefined;

        const invoice = await SalesInvoice.create([{
            number: invoiceNumber,
            date,
            customer: customer || null,
            cashier: userId,
            channel,
            type, // 'official' or 'proforma'
            items: itemsWithCost,
            warehouse,
            treasury,
            note,
            paymentMethod,
            status,
            discountValue: discount,
            totals: {
                subtotal,
                tax,
                discount,
                paid: paidAmount,
                remaining,
                remaining,
                grand
            }
        }], createOptions);

        // ✅ EXIT EARLY FOR PROFORMA INVOICE
        // Proforma: No stock deduction, No treasury update, No accounting
        if (type === 'proforma') {
            return invoice[0];
        }

        // ===== STEP F: Deduct Stock from Warehouse =====
        // ✅ deductStock already validates again inside transaction
        // ===== STEP F: Deduct Stock from Warehouse (Bulk Atomic) =====
        if (status === 'confirmed' || status === 'posted') {
            // 1. Deduct All (Atomic BulkWrite)
            await deductStockBulk(items, warehouse, activeSession);

            // 2. Create Stock Ledger Entries (Parallel Promise)
            // Cannot easy bulkInsert with 'create' inside loop? 
            // Model.insertMany avoids loop.
            const StockLedger = (await import('../models/StockLedger.js')).default;

            const ledgerEntries = items.map(row => ({
                item: row.item,
                warehouse,
                type: 'OUT',
                qty: -Math.abs(row.qty),
                ref: `INV#${invoice[0]._id}`,
                note: `Sales invoice ${invoiceNumber}`,
                date
            }));

            await StockLedger.insertMany(ledgerEntries, createOptions);

            // 3. Low Stock Notifications (Optimization: Check in memory vs re-query?)
            // We need NEW stock values. 
            // Efficient way: Fetch items again ? Or rely on "It's fine, let's just check crucial ones?"
            // For rigorous correctness, we should re-fetch.
            // Bulk Fetch again
            const updatedItemsQuery = Item.find({ _id: { $in: items.map(i => i.item) } });
            if (activeSession) updatedItemsQuery.session(activeSession);
            const updatedItems = await updatedItemsQuery;

            const notifications = [];
            for (const itemDoc of updatedItems) {
                const threshold = itemDoc.minStock || 5;
                if (itemDoc.totalStock <= threshold) {
                    notifications.push({
                        recipient: 'admin',
                        title: 'تنبيه نقص مخزون',
                        message: `رصيد المنتج ${itemDoc.name} وصل للحد الأدنى (${itemDoc.totalStock} قطع).`,
                        type: 'warning',
                        link: `/inventory/items`
                    });
                }
            }
            if (notifications.length > 0) {
                await Notification.insertMany(notifications, createOptions);
            }
        }

        // ===== STEP G: Create Financial Transaction & Update Treasury / Wallet =====
        // ===== STEP G: Create Financial Transaction & Update Treasury / Wallet =====
        if (paidAmount > 0) {
            console.log('DEBUG: Processing Payment. Method:', paymentMethod, 'Amount:', paidAmount, 'Customer:', customer);

            // Helper for Wallet Payment
            const processWalletPayment = async (amount) => {
                if (!customer) throw new Error('الدفع بالمحفظة يتطلب تحديد العميل');
                await useCredit(
                    customer,
                    amount,
                    {
                        type: 'SalesInvoice',
                        id: invoice[0]._id,
                        number: invoiceNumber
                    },
                    `سداد فاتورة مبيعات ${invoiceNumber}`,
                    userId,
                    activeSession
                );
            };

            // Helper for Treasury Payment
            const processTreasuryPayment = async (amount, method, treasuryId) => {
                await createIncomeTransaction({
                    amount: amount,
                    treasury: treasuryId,
                    relatedId: invoice[0]._id,
                    relatedModel: 'SalesInvoice',
                    description: `دفعة (${method === 'cash' ? 'نقدي' : method === 'card' ? 'بطاقة' : 'حوالة'}) - فاتورة ${invoiceNumber}`,
                    category: 'sales',
                    date
                }, activeSession);
            };

            // Handle Split Payment (Multi-Method)
            if (paymentMethod === 'split' && splitDetails && splitDetails.length > 0) {
                for (const split of splitDetails) {
                    const amt = Number(split.amount);
                    if (amt > 0) {
                        if (split.method === 'wallet') {
                            await processWalletPayment(amt);
                        } else if (split.treasury) {
                            await processTreasuryPayment(amt, split.method, split.treasury);
                        }
                    }
                }
            }
            // Handle Single Payment
            else {
                console.log('DEBUG: Single Payment Handling. Method:', paymentMethod);
                if (paymentMethod === 'wallet') {
                    console.log('DEBUG: Executing Wallet Payment...');
                    await processWalletPayment(paidAmount);
                } else {
                    console.log('DEBUG: Executing Treasury Payment...');
                    await processTreasuryPayment(paidAmount, paymentMethod, treasury);
                }
            }
        }

        // ===== STEP H: Update Customer Balance & Credit Limit Check =====
        if (customer && remaining > 0) {
            const customerQuery = Customer.findById(customer);
            if (activeSession) customerQuery.session(activeSession);
            const customerDoc = await customerQuery;

            if (!customerDoc) {
                throw new Error('العميل غير موجود (Customer not found)');
            }

            // 1. Update Customer Ledger (Balance)
            customerDoc.balance = (customerDoc.balance || 0) + remaining;
            const saveOptions = activeSession ? { session: activeSession } : {};
            await customerDoc.save(saveOptions);

            // 2. Check Credit Limit
            if (customerDoc.creditLimit && customerDoc.creditLimit > 0) {
                const effectiveBalance = customerDoc.balance; // Use stored balance

                if (effectiveBalance > customerDoc.creditLimit) {
                    throw new Error(
                        `تجاوز سقف الائتمان! ` +
                        `الرصيد الحالي: ${effectiveBalance.toFixed(2)}, ` +
                        `السقف المسموح: ${customerDoc.creditLimit.toFixed(2)}`
                    );
                }
            }
        }

        // ===== STEP I: Create Journal Entry (MANDATORY) =====
        // If this fails, the entire transaction is rolled back
        let customerDoc = null;
        if (customer) {
            const custQuery = Customer.findById(customer);
            if (activeSession) custQuery.session(activeSession);
            customerDoc = await custQuery;
        }

        await _createSalesJournalEntry({
            invoiceId: invoice[0]._id,
            invoiceNumber,
            date,
            paidAmount,
            remaining,
            grand,
            tax,
            customerName: customerDoc?.name || 'عميل نقدي',
            paymentMethod,
            splitDetails, // Pass split details to JE
            userId
        }, activeSession);

        return invoice[0];
    };

    // =================================================================
    // MAIN EXECUTION FLOW
    // =================================================================

    // Check if replica set is available (for transactions)
    let useTransaction = true;
    const session = await mongoose.startSession();

    try {
        // Attempt to run with transaction
        session.startTransaction({
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
            readPreference: 'primary'
        });


        const result = await executeInvoiceLogic(session);

        // ✅ Audit Trail (MANDATORY - blocks transaction if fails)
        await auditCreate('INVOICE', result, { _id: userId });

        await session.commitTransaction();

        // ✅ Notify Admin/Manager of new Sale (Real-time)
        try {
            sendNotification(['admin', 'manager'], {
                title: 'فاتورة مبيعات جديدة',
                message: `تم إنشاء فاتورة بقيمة ${result.totals?.grand} د.ل للعميل ${result.customer?.name || 'نقدي'}`,
                type: 'success',
                link: `/sales/invoices/${result._id}`
            });
        } catch (e) {
            logger.logWarning('Socket notification failed', { error: e.message });
        }

        return result;

    } catch (error) {
        // Check if error is due to standalone MongoDB (no replica set)
        const isReplicaSetError = error.message?.includes('Transaction numbers are only allowed on a replica set') ||
            error.message?.includes('transaction') && error.message?.includes('replica');

        if (isReplicaSetError && useTransaction) {
            // Abort the failed transaction attempt
            try {
                await session.abortTransaction();
            } catch (e) {
                // Ignore abort errors
            }
            session.endSession();

            // ===== FALLBACK: Execute without transaction (Standalone MongoDB) =====
            logger.logWarning('MongoDB Standalone detected - running without transaction (not recommended for production)');

            try {
                const result = await executeInvoiceLogic(null); // null session = no transaction

                // ✅ Audit Trail
                await auditCreate('INVOICE', result, { _id: userId });

                // ✅ Notify Admin/Manager of new Sale (Real-time)
                try {
                    sendNotification(['admin', 'manager'], {
                        title: 'فاتورة مبيعات جديدة',
                        message: `تم إنشاء فاتورة بقيمة ${result.totals?.grand} د.ل للعميل ${result.customer?.name || 'نقدي'}`,
                        type: 'success',
                        link: `/sales/invoices/${result._id}`
                    });
                } catch (e) {
                    logger.logWarning('Socket notification failed', { error: e.message });
                }

                return result;

            } catch (fallbackError) {
                logger.logError('Invoice creation failed (No Transaction Mode)', { error: fallbackError.message });
                throw new Error(fallbackError.message || 'فشل إنشاء الفاتورة');
            }
        }

        // Abort the transaction for other errors
        await session.abortTransaction();

        logger.logError('Invoice creation failed (Transaction Aborted)', { error: error.message });

        // ===== PORTING LOGIC: Handle Credit Limit Notification persistence on Error =====
        // If error message indicates credit limit, we can create a notification here OUTSIDE transaction
        if (error.message.includes('تجاوز سقف الائتمان')) {
            try {
                // Attempt to parse balance/limit from message or just use generic
                if (invoiceData.customer) {
                    const custId = invoiceData.customer;
                    // Fire and forget notification
                    Notification.create({
                        recipient: 'admin',
                        title: 'تجاوز سقف الائتمان (Process Failure)',
                        message: `محاولة بيع فاشلة للعميل بسبب تجاوز الحد: ${error.message}`,
                        type: 'error',
                        link: `/customers/${custId}`
                    }).then(note => {
                        // Real-time alert for credit failure
                        sendNotification('admin', {
                            title: 'تجاوز سقف الائتمان',
                            message: `محاولة بيع فاشلة: ${error.message}`,
                            type: 'error'
                        });
                    }).catch(e => console.error('Failed to create error notification', e));
                }
            } catch (e) {
                // ignore
            }
        }

        // STRICT FAIL: Do not retry without transaction.
        // Data integrity is more important than availability in this case.
        throw new Error(error.message || 'فشل إنشاء الفاتورة');

    } finally {
        if (session.inTransaction()) {
            try {
                await session.abortTransaction();
            } catch (e) {
                // Ignore
            }
        }
        session.endSession();
    }
}

// =================================================================
// NEW: READ & UPDATE Operations (Extracted from Legacy sales.js)
// =================================================================

import StockLedger from '../models/StockLedger.js'; // Ensure this model is available

export async function getInvoices(req, res) {
    const { from, to, status, channel, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = startOfDay(new Date(from));
        if (to) filter.date.$lte = endOfDay(new Date(to));
    }

    if (status) {
        // Support comma-separated statuses
        if (status.includes(',')) {
            filter.status = { $in: status.split(',') };
        } else {
            filter.status = status;
        }
    }
    if (channel) filter.channel = channel;
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.number) {
        // Regex search for number (supports partial match)
        filter.number = { $regex: req.query.number, $options: 'i' };
    }

    // Strict Access Control: Only admins and managers see all invoices
    // Everyone else (cashiers, sales, etc.) sees ONLY their own.
    const role = (req.user.role || '').toLowerCase().trim();
    if (!['admin', 'manager'].includes(role)) {
        // Token payload usually has 'id', not '_id'. Handle both.
        filter.cashier = req.user._id || req.user.id;
    }

    // Pagination Logic
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [docs, totalDocs] = await Promise.all([
        SalesInvoice.find(filter)
            .sort({ date: -1, _id: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('customer', 'name code phone')
            .populate('items.item', 'name sku')
            .lean(),
        SalesInvoice.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalDocs / limitNum);

    res.json({
        docs,
        totalDocs,
        totalPages,
        currentPage: pageNum
    });
}

export async function getInvoiceById(req, res) {
    const invoice = await SalesInvoice.findById(req.params.id)
        .populate('customer', 'name code phone')
        .populate('items.item', 'name sku')
        .populate('returns.item', 'name sku')
        .lean();

    if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
}

export async function updateInvoiceStatus(req, res) {
    const { status } = req.body;
    const invoice = await SalesInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    invoice.status = status;
    await invoice.save();

    const updated = await SalesInvoice.findById(invoice._id)
        .populate('customer', 'name code phone')
        .populate('items.item', 'name sku')
        .populate('returns.item', 'name sku')
        .lean();

    res.json(updated);
}

export async function returnInvoiceItems(req, res) {
    const { items, warehouse, note = '' } = req.body;

    const invoice = await SalesInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    // Map sold items
    const soldMap = new Map();
    invoice.items.forEach(it => {
        const key = String(it.item);
        soldMap.set(key, (soldMap.get(key) || 0) + Number(it.qty || 0));
    });

    // Map already returned items
    const returnedMap = new Map();
    (invoice.returns || []).forEach(r => {
        const key = String(r.item);
        returnedMap.set(key, (returnedMap.get(key) || 0) + Number(r.qty || 0));
    });

    const now = new Date();

    // Verify quantities
    for (const row of items) {
        const key = String(row.item);
        const sold = soldMap.get(key) || 0;
        const already = returnedMap.get(key) || 0;
        const qty = Number(row.qty || 0);

        if (qty <= 0) continue;

        if (already + qty > sold + 1e-9) {
            return res.status(400).json({
                message: 'كمية الإرجاع أكبر من الكمية المباعة لأحد الأصناف.'
            });
        }
    }

    // Apply returns
    let refundTotal = 0;
    for (const row of items) {
        const qty = Number(row.qty || 0);
        if (qty <= 0) continue;

        const orig = invoice.items.find(i => String(i.item) === String(row.item));
        const price = Number(orig?.price || 0);
        const lineAmount = price * qty;
        refundTotal += lineAmount;

        invoice.returns.push({
            item: row.item,
            qty,
            date: now,
            note
        });

        if (warehouse) {
            await StockLedger.create({
                item: row.item,
                warehouse,
                type: 'IN',
                qty: Math.abs(qty),
                ref: `RET#${invoice._id}`,
                note: 'Sales return'
            });
        }
    }

    invoice.totals.subtotal = Math.max(0, Number(invoice.totals.subtotal || 0) - refundTotal);
    invoice.totals.paid = Math.max(0, Number(invoice.totals.paid || 0) - refundTotal);
    const tax = Number(invoice.totals.tax || 0);
    const discount = Number(invoice.totals.discount || 0);
    invoice.totals.grand = Math.max(0, invoice.totals.subtotal - discount + tax);

    invoice.status = 'refund';
    await invoice.save();

    const updated = await SalesInvoice.findById(invoice._id)
        .populate('customer', 'name code phone')
        .populate('items.item', 'name sku')
        .populate('returns.item', 'name sku')
        .lean();

    res.json(updated);
}
