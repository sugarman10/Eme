/**
 * Sales Service
 *
 * Business logic for sales operations, extracted from salesController
 * for better separation of concerns and testability.
 */

import mongoose from 'mongoose';
import SalesInvoice from '../models/SalesInvoice.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Treasury from '../models/Treasury.js';
import Notification from '../models/Notification.js';
import Account from '../models/Account.js';
import StockLedger from '../models/StockLedger.js';
import { generateInvoiceNumber } from './counterService.js';
import { deductStockBulk } from './stockService.js';
import { createIncomeTransaction } from './transactionService.js';
import { postJournalEntry } from './journalEntryService.js';
import { getOrgTaxRate } from './settingService.js';
import { add, sub, mul, round } from '../utils/mathUtils.js';
import logger from '../config/logger.js';
import { getSystemAccount } from './systemAccountsService.js';

// ============================================================
// SYSTEM ACCOUNTS CACHE FOR SALES
// ============================================================
let _salesAccountsCache = null;
let _salesCacheTimestamp = 0;
const SALES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get sales-related system accounts (with caching)
 * @param {Object|null} session - MongoDB session for transaction
 * @returns {Promise<Object>} - { cash, bank, ar, salesRevenue, vatPayable }
 */
export async function getSalesSystemAccounts(session = null) {
  const now = Date.now();

  if (_salesAccountsCache && now - _salesCacheTimestamp < SALES_CACHE_TTL) {
    return _salesAccountsCache;
  }

  const [cash, bank, ar, salesRevenue, vatPayable, customerDeposits, cogs, inventory] = await Promise.all([
    getSystemAccount('CASH', session),
    getSystemAccount('BANK', session),
    getSystemAccount('AR', session),
    getSystemAccount('SALES_REVENUE', session),
    getSystemAccount('VAT_PAYABLE', session),
    getSystemAccount('CUSTOMER_WALLET', session),
    getSystemAccount('COGS', session),
    getSystemAccount('INVENTORY', session),
  ]);

  const result = {
    cash,
    bank,
    ar,
    salesRevenue,
    vatPayable,
    customerDeposits,
    cogs,
    inventory,
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
 * Resolve invoice items from database (allows negative stock & custom items)
 * @param {Array} items - Invoice items with item, qty
 * @param {string} warehouseId - Warehouse ObjectId
 * @param {Object|null} session - MongoDB session
 * @returns {Promise<Map>} - Map of itemId to product document
 */
export async function validateStockAvailability(items, warehouseId, session = null) {
  const itemIds = (items || [])
    .map((i) => i.item?._id || i.item)
    .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));

  if (itemIds.length === 0) return new Map();

  const itemQuery = Item.find({ _id: { $in: itemIds } });
  if (session) itemQuery.session(session);

  const products = await itemQuery;
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  return productMap;
}

/**
 * Calculate invoice totals
 * @param {Array} items - Invoice items with price, qty
 * @param {number} discountValue - Discount amount
 * @param {number} paidAmount - Amount paid
 * @returns {Promise<Object>} - { subtotal, tax, taxRate, discount, paid, remaining, grand }
 */
export async function calculateInvoiceTotals(items, discountValue = 0, paidAmount = 0) {
  const subtotal = items.reduce((sum, item) => add(sum, mul(item.price, item.qty)), 0);

  // Fetch Tax Rate from Settings (default 0 if not set)
  const taxRate = await getOrgTaxRate();
  const tax = mul(subtotal, taxRate / 100);

  const discount = Number(discountValue || 0);
  const paid = Number(paidAmount || 0);

  // Grand Total = Subtotal - Discount + Tax
  const grand = add(sub(subtotal, discount), tax);
  const remaining = sub(grand, paid);

  return { subtotal, tax, taxRate, discount, paid, remaining, grand };
}

/**
 * Validate customer for sales (credit limits, cash customer rules)
 * @param {string} customerId - Customer ObjectId
 * @param {string} channel - 'retail' or 'wholesale'
 * @param {number} remaining - Remaining unpaid amount
 * @param {Object|null} session - MongoDB session
 * @returns {Promise<Object|null>} - Customer document or null
 * @throws {Error} if validation fails
 */
export async function validateCustomerForSale(customerId, channel, remaining, session = null) {
  if (!customerId) return null;

  const customerQuery = Customer.findById(customerId);
  if (session) customerQuery.session(session);
  const customer = await customerQuery;

  if (!customer) {
    throw new Error('العميل غير موجود (Customer not found)');
  }

  // Cash customer validation
  if (customer.isCashCustomer) {
    if (channel !== 'retail') {
      throw new Error('العميل النقدي للبيع بالتجزئة فقط (Cash customer is retail only)');
    }
    if (remaining > 0.01) {
      throw new Error(`العميل النقدي يجب أن يدفع كامل المبلغ. المتبقي: ${remaining.toFixed(2)} د.ل`);
    }
  }

  return customer;
}

/**
 * Create journal entry for sales invoice
 * @param {Object} params - Journal entry parameters
 * @param {Object|null} session - MongoDB session
 * @returns {Promise<Object>} - Created journal entry
 */
export async function createSalesJournalEntry(params, session = null) {
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
    splitDetails = [], // Support for split payments
    totalCost = 0, // Total cost for perpetual inventory
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
  if (paidAmount > 0) {
    // Helper to add debit line based on payment type
    const addDebitLine = (amount, type) => {
      let debitAccount;
      let debitMemo;

      if (type === 'bank' || type === 'transfer' || type === 'card') {
        if (!accounts.bank) throw new Error('حساب البنك (1020) غير موجود');
        debitAccount = accounts.bank;
        debitMemo = 'تحصيل بنكي/بطاقة - فاتورة مبيعات';
      } else if (type === 'wallet') {
        if (!accounts.customerDeposits) throw new Error('حساب أمانات العملاء/المحفظة (2030) غير موجود');
        debitAccount = accounts.customerDeposits;
        debitMemo = 'خصم من المحفظة - فاتورة مبيعات';
      } else {
        if (!accounts.cash) throw new Error('حساب الصندوق (1010) غير موجود');
        debitAccount = accounts.cash;
        debitMemo = 'تحصيل نقدي - فاتورة مبيعات';
      }

      lines.push({
        accountId: debitAccount._id,
        debit: amount,
        credit: 0,
        memo: debitMemo,
      });
    };

    // Handle Split Payment (Multi-Method)
    if (paymentMethod === 'split' && splitDetails && splitDetails.length > 0) {
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
      memo: `آجل - ${customerName || 'عميل نقدي'}`,
    });
  }

  // ===== CREDIT SIDE =====
  lines.push({
    accountId: accounts.salesRevenue._id,
    debit: 0,
    credit: netSales,
    memo: 'إيرادات مبيعات',
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
      memo: 'ضريبة القيمة المضافة',
    });
  }

  // ===== PERPETUAL INVENTORY ENTRIES (COGS & Inventory) =====
  if (totalCost > 0 && accounts.cogs && accounts.inventory) {
    const costAmount = round(totalCost, 2);
    lines.push({
      accountId: accounts.cogs._id,
      debit: costAmount,
      credit: 0,
      memo: `تكلفة البضاعة المباعة - فاتورة مبيعات ${invoiceNumber || ''}`,
    });
    lines.push({
      accountId: accounts.inventory._id,
      debit: 0,
      credit: costAmount,
      memo: `صرف مخزون بضاعة مباعة - فاتورة مبيعات ${invoiceNumber || ''}`,
    });
  }

  // Create journal entry using journalEntryService
  const journalEntry = await postJournalEntry(
    {
      date,
      referenceType: 'SALE_INVOICE',
      referenceId: invoiceId.toString(),
      ref: `INV-${invoiceNumber}`,
      note: `فاتورة مبيعات - ${customerName || 'نقدي'}`,
      createdBy: userId,
      lines,
    },
    { session, updateBalances: true }
  );

  logger.logSuccess(`Sales JE Created: ${journalEntry._id}`);
  return journalEntry;
}

/**
 * Process stock deduction and create ledger entries
 * @param {Array} items - Invoice items
 * @param {string} warehouseId - Warehouse ObjectId
 * @param {Object} invoice - Created invoice document
 * @param {Date} date - Transaction date
 * @param {Object|null} session - MongoDB session
 */
export async function processStockDeduction(items, warehouseId, invoice, date, session = null) {
  const validItems = (items || []).filter(
    (row) => row?.item && mongoose.Types.ObjectId.isValid(String(row.item?._id || row.item))
  );
  if (validItems.length === 0) {
    return { ledgerEntries: [], notifications: [] };
  }

  // 1. Deduct All (Atomic BulkWrite)
  await deductStockBulk(validItems, warehouseId, session);

  // 2. Create Stock Ledger Entries
  const ledgerEntries = validItems.map((row) => ({
    item: row.item?._id || row.item,
    warehouse: warehouseId,
    type: 'OUT',
    qty: -Math.abs(row.qty),
    ref: `INV#${invoice._id}`,
    note: `Sales invoice ${invoice.number}`,
    date,
  }));

  const createOptions = session ? { session } : undefined;
  await StockLedger.insertMany(ledgerEntries, createOptions);

  // 3. Check for Low Stock Notifications
  const updatedItemsQuery = Item.find({ _id: { $in: validItems.map((i) => i.item?._id || i.item) } });
  if (session) updatedItemsQuery.session(session);
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
        link: `/inventory/items`,
      });
    }
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications, createOptions);
  }

  return { ledgerEntries, notifications };
}

/**
 * Process payment transactions (single or split)
 * @param {Object} params - Payment parameters
 * @param {Object|null} session - MongoDB session
 */
export async function processPaymentTransactions(params, session = null) {
  const { paidAmount, paymentMethod, treasury, splitDetails, invoice, invoiceNumber, date } = params;

  if (paidAmount <= 0) return;

  // Handle Split Payment (Multi-Treasury)
  if (paymentMethod === 'split' && splitDetails?.length > 0) {
    for (const split of splitDetails) {
      if (Number(split.amount) > 0 && split.treasury) {
        await createIncomeTransaction(
          {
            amount: split.amount,
            treasury: split.treasury,
            relatedId: invoice._id,
            relatedModel: 'SalesInvoice',
            description: `دفعة مجزأة (${split.method === 'cash' ? 'نقدي' : split.method === 'card' ? 'بطاقة' : 'حوالة'}) - فاتورة ${invoiceNumber}`,
            category: 'sales',
            date,
          },
          session
        );
      }
    }
  }
  // Handle Single Payment (Standard)
  else {
    await createIncomeTransaction(
      {
        amount: paidAmount,
        treasury,
        relatedId: invoice._id,
        relatedModel: 'SalesInvoice',
        description: `دفعة من فاتورة ${invoiceNumber}`,
        category: 'sales',
        date,
      },
      session
    );
  }
}

/**
 * Update customer balance for credit sales
 * @param {string} customerId - Customer ObjectId
 * @param {number} remaining - Remaining unpaid amount
 * @param {Object|null} session - MongoDB session
 * @throws {Error} if credit limit exceeded
 */
export async function updateCustomerBalance(customerId, remaining, session = null) {
  if (!customerId || remaining <= 0) return;

  const customerQuery = Customer.findById(customerId);
  if (session) customerQuery.session(session);
  const customerDoc = await customerQuery;

  if (!customerDoc) {
    throw new Error('العميل غير موجود (Customer not found)');
  }

  // Update Customer Ledger (Balance)
  customerDoc.balance = (customerDoc.balance || 0) + remaining;
  const saveOptions = session ? { session } : {};
  await customerDoc.save(saveOptions);

  // Check Credit Limit
  if (customerDoc.creditLimit && customerDoc.creditLimit > 0) {
    if (customerDoc.balance > customerDoc.creditLimit) {
      throw new Error(
        `تجاوز سقف الائتمان! ` +
        `الرصيد الحالي: ${customerDoc.balance.toFixed(2)}, ` +
        `السقف المسموح: ${customerDoc.creditLimit.toFixed(2)}`
      );
    }
  }

  return customerDoc;
}

/**
 * Enrich items with cost data for profit tracking
 * @param {Array} items - Invoice items
 * @param {Object|null} session - MongoDB session
 * @returns {Promise<Array>} - Items with cost field added
 */
export async function enrichItemsWithCost(items, session = null) {
  const allItemIds = (items || [])
    .map((i) => i.item?._id || i.item)
    .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));

  let costMap = new Map();
  if (allItemIds.length > 0) {
    const costQuery = Item.find({ _id: { $in: allItemIds } }).select('cost');
    if (session) costQuery.session(session);
    const costDocs = await costQuery;
    costMap = new Map(costDocs.map((d) => [d._id.toString(), d.cost || 0]));
  }

  return items.map((item) => {
    const rawId = item.item?._id || item.item;
    const idStr = rawId && mongoose.Types.ObjectId.isValid(String(rawId)) ? rawId.toString() : null;
    return {
      ...item,
      cost: Number(item.cost) || (idStr ? costMap.get(idStr) || 0 : 0),
    };
  });
}

/**
 * Apply price from product if not provided
 * @param {Array} items - Invoice items
 * @param {Map} productMap - Map of product documents
 * @param {string} channel - 'retail' or 'wholesale'
 * @returns {Array} - Items with prices applied
 */
export function applyPricesFromProducts(items, productMap, channel) {
  return items.map((row) => {
    const rawId = row.item?._id || row.item;
    if ((!row.price || Number(row.price) <= 0) && rawId) {
      const product = productMap.get(rawId.toString());
      if (product) {
        row.price = channel === 'wholesale' ? product.wholesalePrice || product.price : product.price;
      }
    }
    return row;
  });
}

export default {
  getSalesSystemAccounts,
  clearSalesAccountsCache,
  validateStockAvailability,
  calculateInvoiceTotals,
  validateCustomerForSale,
  createSalesJournalEntry,
  processStockDeduction,
  processPaymentTransactions,
  updateCustomerBalance,
  enrichItemsWithCost,
  applyPricesFromProducts,
};
