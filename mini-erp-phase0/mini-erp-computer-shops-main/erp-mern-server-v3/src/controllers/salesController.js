import mongoose from 'mongoose';
import SalesInvoice from '../models/SalesInvoice.js';
import CompanySettings from '../models/CompanySettings.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Treasury from '../models/Treasury.js';
import Notification from '../models/Notification.js';
import { generateInvoiceNumber, formatInvoicePrefix, getInvoiceCounterName, getHighestInvoiceSequence } from '../services/counterService.js';
import { deductStockBulk } from '../services/stockService.js';
import { validateStockForCheckout, preparePhysicalDeductions } from '../services/bundleService.js';
import { createIncomeTransaction } from '../services/transactionService.js';
import { postJournalEntry, reverseJournalEntriesByReference } from '../services/journalEntryService.js';
import Account from '../models/Account.js';
import { getOrgTaxRate } from '../services/settingService.js';
import { add, sub, mul } from '../utils/mathUtils.js';
import { sendNotification, getIO } from '../socket.js';
import logger from '../config/logger.js';
import { auditCreate, auditUpdate } from '../services/auditService.js';
import { runPostingTransaction } from '../services/postingService.js';
import { startOfDay, endOfDay } from '../utils/dateUtils.js';
import { useCredit } from './walletController.js';
import { applyFiscalDateFilter } from '../middleware/fiscalPeriod.js';
// === REFACTORED: Import from salesService instead of duplicating ===
import {
  getSalesSystemAccounts,
  clearSalesAccountsCache,
  createSalesJournalEntry,
} from '../services/salesService.js';

// NOTE: getSalesSystemAccounts, clearSalesAccountsCache, and createSalesJournalEntry
// are now imported from salesService.js to eliminate code duplication.
// The controller's export of clearSalesAccountsCache is delegated to the service.
export { clearSalesAccountsCache };

/**
 * Create Sales Invoice with Atomic Transaction
 */
export async function createInvoiceWithTransaction(invoiceData, userId = null) {
  // Helper function to execute the core logic
  // Accepts a session (which might be null if running in standalone mode)
  const executeInvoiceLogic = async (activeSession) => {
    const {
      items,
      customer,
      customerName = 'عميل نقدي',
      channel = 'retail',
      warehouse,
      treasury,
      date = new Date(),
      note = '',
      discountValue = 0,
      paid = 0,
      paymentMethod = 'cash',
      status = 'posted', // Default to posted as we do immediate GL/Stock impact
      splitDetails = [],
      type = 'official', // Default to official
    } = invoiceData;

    // ===== STRICT BRANCH / WAREHOUSE ISOLATION =====
    let effectiveWarehouse = warehouse || null;
    if (userId) {
      const userDoc = await mongoose.model('User').findById(userId).select('role assignedWarehouse').lean();
      if (userDoc && userDoc.role !== 'admin' && userDoc.assignedWarehouse) {
        effectiveWarehouse = userDoc.assignedWarehouse;
      }
    }

    // ===== CRITICAL VALIDATION: Warehouse & Treasury Required (Official Invoices) =====
    if (!effectiveWarehouse && type !== 'proforma') {
      throw new Error('المستودع مطلوب (Warehouse is required)');
    }

    // Check if payment is made (treasury required EXCEPT for wallet/split payments)
    const paidAmountCheck = Number(paid || 0);
    if (type !== 'proforma' && paidAmountCheck > 0 && !treasury && paymentMethod !== 'wallet' && paymentMethod !== 'split') {
      throw new Error('الخزينة مطلوبة (Treasury is required for payments)');
    }

    // ===== CASH CUSTOMER VALIDATION =====
    // العميل النقدي لا يمكن البيع له بالآجل - يجب دفع المبلغ كاملاً
    if (customer && type !== 'proforma') {
      const customerQuery = activeSession
        ? Customer.findById(customer).session(activeSession)
        : Customer.findById(customer);
      const customerDoc = await customerQuery;

      if (customerDoc && customerDoc.isCashCustomer) {
        if (channel !== 'retail') {
          throw new Error('العميل النقدي للبيع بالتجزئة فقط (Cash customer is retail only)');
        }
      }
    }

    // ===== STEP A: RESOLVE ITEMS FOR CHECKOUT =====
    // Supports standalone items, bundle composite products, and custom items (negative stock allowed)
    let physicalCheckResult = null;
    if (type !== 'proforma' && (status === 'confirmed' || status === 'posted')) {
      physicalCheckResult = await validateStockForCheckout(items, effectiveWarehouse, activeSession);

      // Price Safeguard & Boundaries Logic (for registered items only)
      for (const row of items) {
        const rawId = row.item?._id || row.item;
        const idStr = rawId && mongoose.Types.ObjectId.isValid(String(rawId)) ? rawId.toString() : null;
        const product = idStr ? physicalCheckResult?.docMap?.get(idStr) : null;
        if (product) {
          if (!row.price || Number(row.price) <= 0) {
            const priceToUse = channel === 'wholesale' ? product.wholesalePrice || product.price : product.price;
            row.price = priceToUse;
          }
          const rowPrice = Number(row.price);
          const minAllowed = Number(product.minPrice) || 0;
          const maxAllowed = Number(product.maxPrice) || 0;

          if (minAllowed > 0 && rowPrice < minAllowed) {
            throw new Error(`سعر بيع الصنف "${product.name}" (${rowPrice}) أقل من الحد الأدنى المسموح به (${minAllowed})`);
          }
          if (maxAllowed > 0 && rowPrice > maxAllowed) {
            throw new Error(`سعر بيع الصنف "${product.name}" (${rowPrice}) أعلى من الحد الأقصى المسموح به (${maxAllowed})`);
          }
        }
      }
    }

    // ===== STEP B: Validate Treasury Exists (If provided) =====
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
    const settings = await CompanySettings.getSettings();
    const invoiceNumber = await generateInvoiceNumber(settings?.invoicePrefix);

    // ===== STEP D: Calculate Totals =====
    const subtotal = items.reduce((sum, item) => add(sum, mul(item.price, item.qty)), 0);
    const discount = Number(discountValue || 0);
    const taxableAmount = Math.max(0, sub(subtotal, discount));

    // Fetch Tax Rate from Settings (default 0 if not set) - calculated on net taxable amount
    const taxRate = await getOrgTaxRate();
    const tax = mul(taxableAmount, taxRate / 100);

    const paidAmount = Number(paid || 0);

    // Grand Total = Taxable Amount + Tax
    const grand = add(taxableAmount, tax);
    const remaining = sub(grand, paidAmount);

    // Multi-Currency USD calculations
    const exchangeRate = Number(invoiceData.exchangeRate) || Number(settings?.usdExchangeRate) || 1;
    const totalUSD = invoiceData.totalUSD !== undefined
      ? Number(invoiceData.totalUSD)
      : (exchangeRate > 0 ? Number((grand / exchangeRate).toFixed(2)) : 0);
    const paidUSD = invoiceData.paidUSD !== undefined
      ? Number(invoiceData.paidUSD)
      : (exchangeRate > 0 ? Number((paidAmount / exchangeRate).toFixed(2)) : 0);
    const remainingUSD = Math.max(0, Number((totalUSD - paidUSD).toFixed(2)));

    // Validate payment amount
    if (paidAmount > grand) {
      throw new Error(`المبلغ المدفوع (${paidAmount}) أكبر من الإجمالي (${grand})`);
    }

    // ===== CASH CUSTOMER: Must pay full amount =====
    if (customer && type !== 'proforma') {
      const cashCustomerCheck = activeSession
        ? await Customer.findById(customer).session(activeSession)
        : await Customer.findById(customer);

      if (cashCustomerCheck && cashCustomerCheck.isCashCustomer) {
        if (remaining > 0.01) {
          throw new Error(`العميل النقدي يجب أن يدفع كامل المبلغ. المتبقي: ${remaining.toFixed(2)} د.ل`);
        }
      }
    }

    // Get item costs for profit tracking (inside transaction, filtering out custom items without valid ObjectId)
    const validItemIds = items
      .map((i) => i.item?._id || i.item)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));

    let costDocs = [];
    if (validItemIds.length > 0) {
      const costQuery = Item.find({ _id: { $in: validItemIds } }).select('cost name sku');
      if (activeSession) costQuery.session(activeSession);
      costDocs = await costQuery;
    }
    const costMap = new Map(costDocs.map((d) => [d._id.toString(), d.cost || 0]));
    const itemDocFallbackMap = new Map(costDocs.map((d) => [d._id.toString(), d]));

    const itemsWithCost = items.map((item) => {
      const rawId = item.item?._id || item.item;
      const hasValidId = Boolean(rawId && mongoose.Types.ObjectId.isValid(String(rawId)));
      const itemIdStr = hasValidId ? rawId.toString() : null;
      const productDoc = itemIdStr
        ? (physicalCheckResult?.docMap?.get(itemIdStr) || itemDocFallbackMap.get(itemIdStr))
        : null;
      const isBundle = Boolean(productDoc?.isBundle || item.isBundle);

      let bundleComponents = [];
      const incomingComps = productDoc?.bundleComponents?.length
        ? productDoc.bundleComponents
        : (item.bundleComponents || []);

      if (isBundle && incomingComps.length) {
        bundleComponents = incomingComps.map((c) => {
          const compRawId = c.item?._id || c.item;
          const compId = compRawId ? compRawId.toString() : '';
          const compDoc = compId ? physicalCheckResult?.docMap?.get(compId) : null;
          return {
            item: compRawId && mongoose.Types.ObjectId.isValid(String(compRawId)) ? compRawId : null,
            name: compDoc?.name || c.name || '',
            sku: compDoc?.sku || c.sku || '',
            qty: Number(c.qty || 1),
            serials: item.componentSerials?.[compId] || item.serials?.[compId] || c.serials || [],
          };
        });
      }

      const defaultProductCost = itemIdStr
        ? (costMap.get(itemIdStr) || Number(productDoc?.cost) || Number(productDoc?.costPrice) || 0)
        : 0;

      return {
        ...item,
        item: hasValidId ? rawId : null,
        isCustom: Boolean(item.isCustom || !hasValidId),
        name: item.name || productDoc?.name || 'صنف حر',
        sku: item.sku || productDoc?.sku || (hasValidId ? '' : 'حر'),
        priceUSD: Number(item.priceUSD || (exchangeRate > 0 ? (item.price / exchangeRate).toFixed(2) : 0)),
        cost: Number(item.cost) || defaultProductCost,
        isBundle,
        bundleComponents,
      };
    });

    // ===== STEP E: Create Invoice Document =====
    const createOptions = activeSession ? { session: activeSession } : undefined;

    const invoice = await SalesInvoice.create(
      [
        {
          number: invoiceNumber,
          date,
          customer: customer || null,
          customerName: customerName ? customerName.trim() : 'عميل نقدي',
          cashier: userId,
          channel,
          type, // 'official' or 'proforma'
          currency: invoiceData.currency || 'LYD',
          exchangeRate,
          items: itemsWithCost,
          warehouse: effectiveWarehouse || undefined,
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
            grand,
            totalUSD,
            paidUSD,
            remainingUSD,
          },
        },
      ],
      createOptions
    );

    // ✅ EXIT EARLY FOR PROFORMA INVOICE
    // Proforma: No stock deduction, No treasury update, No accounting
    if (type === 'proforma') {
      return invoice[0];
    }

    // ===== STEP F: Deduct Stock from Warehouse (Bulk Atomic, Negative Stock Permitted) =====
    if (status === 'confirmed' || status === 'posted') {
      const StockLedger = (await import('../models/StockLedger.js')).default;

      // Expand bundles into individual physical component deductions (custom unregistered items skipped)
      const { deductionItems, ledgerEntries } = preparePhysicalDeductions(
        itemsWithCost,
        physicalCheckResult?.docMap || itemDocFallbackMap,
        effectiveWarehouse,
        `INV#${invoice[0]._id}`,
        invoiceNumber,
        date
      );

      if (deductionItems.length > 0) {
        // 1. Deduct All Physical Items/Components (Atomic BulkWrite, allows negative stock)
        await deductStockBulk(deductionItems, effectiveWarehouse, activeSession);

        // 2. Create Stock Ledger Entries (Atomic Batch Insert)
        if (ledgerEntries.length > 0) {
          await StockLedger.insertMany(ledgerEntries, createOptions);
        }

        // 3. Low Stock Notifications
        const updatedItemsQuery = Item.find({ _id: { $in: deductionItems.map((i) => i.item) } });
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
              link: `/inventory/items`,
            });
          }
        }
        if (notifications.length > 0) {
          await Notification.insertMany(notifications, createOptions);
        }
      }
    }

    // ===== STEP G: Create Financial Transaction & Update Treasury / Wallet =====
    if (paidAmount > 0) {
      // Helper for Wallet Payment
      const processWalletPayment = async (amount) => {
        if (!customer) throw new Error('الدفع بالمحفظة يتطلب تحديد العميل');
        await useCredit(
          customer,
          amount,
          {
            type: 'SalesInvoice',
            id: invoice[0]._id,
            number: invoiceNumber,
          },
          `سداد فاتورة مبيعات ${invoiceNumber}`,
          userId,
          activeSession
        );
      };

      // Helper for Treasury Payment
      const processTreasuryPayment = async (amount, method, treasuryId) => {
        await createIncomeTransaction(
          {
            amount: amount,
            treasury: treasuryId,
            relatedId: invoice[0]._id,
            relatedModel: 'SalesInvoice',
            description: `دفعة (${method === 'cash' ? 'نقدي' : method === 'card' ? 'بطاقة' : 'حوالة'}) - فاتورة ${invoiceNumber}`,
            category: 'sales',
            date,
          },
          activeSession
        );
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
        if (paymentMethod === 'wallet') {
          await processWalletPayment(paidAmount);
        } else {
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
      customerDoc.balanceUSD = (customerDoc.balanceUSD || 0) + remainingUSD;
      const saveOptions = activeSession ? { session: activeSession } : {};
      await customerDoc.save(saveOptions);

      // 2. Check Credit Limit
      if (customerDoc.creditLimit && customerDoc.creditLimit > 0) {
        const effectiveBalance = customerDoc.balance; // Use stored balance

        if (effectiveBalance > customerDoc.creditLimit) {
          if (invoiceData.allowCreditOverride) {
            // Authorized override by supervisor/manager
            const targetInvoice = Array.isArray(invoice) ? invoice[0] : invoice;
            targetInvoice.note = (targetInvoice.note || '') + ` [تجاوز سقف الائتمان بموافقة مسؤولة - سقف: ${customerDoc.creditLimit.toFixed(2)}, رصيد: ${effectiveBalance.toFixed(2)}]`;
            await targetInvoice.save(saveOptions);
          } else {
            throw new Error(
              `تجاوز سقف الائتمان! ` +
              `الرصيد بعد الفاتورة: ${effectiveBalance.toFixed(2)}, ` +
              `السقف المسموح: ${customerDoc.creditLimit.toFixed(2)} د.ل. يلزم سداد دفعة نقدية أو موافقة المسؤول.`
            );
          }
        }
      }
    }

    // ===== STEP I: Create Journal Entry (MANDATORY) =====
    let customerDoc = null;
    if (customer) {
      const custQuery = Customer.findById(customer);
      if (activeSession) custQuery.session(activeSession);
      customerDoc = await custQuery;
    }

    let totalCost = 0;
    for (const it of itemsWithCost) {
      let unitCost = Number(it.cost || 0);
      if (unitCost === 0 && it.isBundle && it.bundleComponents?.length) {
        unitCost = it.bundleComponents.reduce((cSum, comp) => {
          const compId = (comp.item?._id || comp.item)?.toString();
          const compDoc = compId ? physicalCheckResult?.docMap?.get(compId) : null;
          const cCost = Number(compDoc?.cost || 0);
          return cSum + cCost * Number(comp.qty || 1);
        }, 0);
      }
      totalCost += unitCost * Number(it.qty || 0);
    }

    await createSalesJournalEntry(
      {
        invoiceId: invoice[0]._id,
        invoiceNumber,
        date,
        paidAmount,
        remaining,
        grand,
        tax,
        customerName: customerDoc?.name || 'عميل نقدي',
        paymentMethod,
        splitDetails,
        userId,
        totalCost,
      },
      activeSession
    );

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
      readPreference: 'primary',
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
        link: `/sales/invoices/${result._id}`,
      });
    } catch (e) {
      logger.logWarning('Socket notification failed', { error: e.message });
    }

    // 🔥 REAL-TIME STOCK SYNC: Emit Delta Updates to all POS clients
    try {
      const io = getIO();
      if (io && result.type !== 'proforma') {
        const stockUpdates = (invoiceData.items || [])
          .filter((item) => item.item && mongoose.Types.ObjectId.isValid(String(item.item?._id || item.item)))
          .map((item) => ({
            productId: (item.item?._id || item.item)?.toString(),
            deductedQty: Number(item.qty) || 0,
          }));

        if (stockUpdates.length > 0) {
          io.emit('stock:update', {
            updates: stockUpdates,
            warehouseId: invoiceData.warehouse?.toString() || invoiceData.warehouse,
            invoiceId: result._id?.toString(),
            timestamp: new Date().toISOString(),
          });
        }

        io.emit('invoice:created', {
          invoiceId: result._id?.toString(),
          number: invoiceData.number,
          warehouseId: invoiceData.warehouse?.toString() || invoiceData.warehouse,
          timestamp: new Date().toISOString(),
        });

        logger.info('📡 Stock & Invoice update broadcasted', { itemCount: stockUpdates.length, invoiceNumber: invoiceData.number });
      }
    } catch (e) {
      // Silent fail - don't break invoice flow for notification failure
      logger.logWarning('Stock sync broadcast failed', { error: e.message });
    }

    return result;
  } catch (error) {
    // Check if error is due to standalone MongoDB (no replica set)
    const isReplicaSetError =
      error.message?.includes('Transaction numbers are only allowed on a replica set') ||
      (error.message?.includes('transaction') && error.message?.includes('replica'));

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
            link: `/sales/invoices/${result._id}`,
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
    if (error.message.includes('تجاوز سقف الائتمان')) {
      try {
        if (invoiceData.customer) {
          const custId = invoiceData.customer;
          Notification.create({
            recipient: 'admin',
            title: 'تجاوز سقف الائتمان (Process Failure)',
            message: `محاولة بيع فاشلة للعميل بسبب تجاوز الحد: ${error.message}`,
            type: 'error',
            link: `/customers/${custId}`,
          })
            .then(() => {
              sendNotification('admin', {
                title: 'تجاوز سقف الائتمان',
                message: `محاولة بيع فاشلة: ${error.message}`,
                type: 'error',
              });
            })
            .catch((e) => console.error('Failed to create error notification', e));
        }
      } catch (e) {
        // ignore
      }
    }

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

import StockLedger from '../models/StockLedger.js';

export async function getInvoices(req, res) {
  const { from, to, status, channel, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDay(new Date(from));
    if (to) filter.date.$lte = endOfDay(new Date(to));
  }

  applyFiscalDateFilter(req, filter, 'date');

  if (status) {
    if (status.includes(',')) {
      filter.status = { $in: status.split(',') };
    } else {
      filter.status = status;
    }
  }
  if (channel) filter.channel = channel;
  if (req.query.type) {
    if (req.query.type === 'proforma') {
      filter.type = 'proforma';
    } else if (req.query.type === 'official') {
      filter.type = { $ne: 'proforma' };
    } else {
      filter.type = req.query.type;
    }
  }
  if (req.query.customer) filter.customer = req.query.customer;
  if (req.query.number) {
    filter.number = { $regex: req.query.number, $options: 'i' };
  }

  // Strict Access Control
  const role = (req.user.role || '').toLowerCase().trim();
  if (role !== 'admin') {
    if (!req.query.number) {
      const currentUserId = req.user._id || req.user.id;
      filter.cashier = mongoose.Types.ObjectId.isValid(currentUserId)
        ? new mongoose.Types.ObjectId(currentUserId)
        : currentUserId;
    }
    if (req.user.assignedWarehouse) {
      filter.warehouse = req.user.assignedWarehouse;
    }
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
      .populate('items.bundleComponents.item', 'name sku price')
      .lean(),
    SalesInvoice.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalDocs / limitNum);

  res.json({
    docs,
    totalDocs,
    totalPages,
    currentPage: pageNum,
  });
}

export async function getInvoiceById(req, res) {
  const invoice = await SalesInvoice.findById(req.params.id)
    .populate('customer', 'name code phone')
    .populate('items.item', 'name sku')
    .populate('items.bundleComponents.item', 'name sku price')
    .populate('returns.item', 'name sku')
    .lean();

  if (!invoice) {
    return res.status(404).json({ message: 'Invoice not found' });
  }

  res.json(invoice);
}

export async function updateInvoiceStatus(req, res) {
  const { status } = req.body;
  const allowedStatuses = ['draft', 'pending'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: 'Direct status changes are restricted. Use /post, /void, or /reverse.',
    });
  }

  const invoice = await SalesInvoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

  const editableStatuses = ['draft', 'pending'];
  if (!editableStatuses.includes(invoice.status)) {
    return res.status(409).json({
      message: 'Invoice status is locked. Use /post, /void, or /reverse.',
    });
  }

  invoice.status = status;
  await invoice.save();

  const updated = await SalesInvoice.findById(invoice._id)
    .populate('customer', 'name code phone')
    .populate('items.item', 'name sku')
    .populate('returns.item', 'name sku')
    .lean();

  res.json(updated);
}

export async function postInvoice(req, res) {
  const resultId = await runPostingTransaction(async (session) => {
    const invoice = await SalesInvoice.findById(req.params.id).session(session);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.status = 404;
      throw err;
    }

    if (invoice.status === 'posted') {
      return invoice._id;
    }

    const beforeState = invoice.toObject();

    if (invoice.status === 'confirmed') {
      invoice.status = 'posted';
      await invoice.save({ session });
      await auditUpdate('INVOICE', invoice._id, beforeState, invoice, req.user, req.ip, session, {
        action: 'POST',
        mode: 'confirmed',
      });
      return invoice._id;
    }

    if (invoice.status !== 'draft') {
      const err = new Error('Only draft or confirmed invoices can be posted');
      err.status = 409;
      throw err;
    }

    if (invoice.type === 'proforma') {
      const err = new Error('Proforma invoices cannot be posted');
      err.status = 400;
      throw err;
    }

    const paidAmount = Number(invoice.totals?.paid || 0);
    if (paidAmount > 0) {
      const err = new Error('Draft invoices with payments must be re-issued');
      err.status = 400;
      throw err;
    }

    if (!invoice.warehouse) {
      const err = new Error('Warehouse is required to post invoice');
      err.status = 400;
      throw err;
    }

    // Deduct stock and create ledger entries (only for items with valid Item ID)
    const physicalItems = (invoice.items || []).filter(
      (row) => row.item && mongoose.Types.ObjectId.isValid(String(row.item?._id || row.item))
    );

    let stockLedgerIds = [];
    if (physicalItems.length > 0) {
      await deductStockBulk(physicalItems, invoice.warehouse, session);

      const ledgerEntries = physicalItems.map((row) => ({
        item: row.item?._id || row.item,
        warehouse: invoice.warehouse,
        type: 'OUT',
        qty: -Math.abs(Number(row.qty || 0)),
        ref: `INV#${invoice._id}`,
        note: `Sales invoice ${invoice.number || invoice._id.toString().slice(-6)}`,
        date: invoice.date,
      }));

      const ledgerDocs = await StockLedger.insertMany(ledgerEntries, { session });
      stockLedgerIds = ledgerDocs.map((doc) => doc._id);
    }

    const grand = Number(invoice.totals?.grand || 0);
    const tax = Number(invoice.totals?.tax || 0);
    let remaining = Number(invoice.totals?.remaining);
    if (!Number.isFinite(remaining) || remaining < 0) {
      remaining = grand - paidAmount;
    }
    if (paidAmount === 0 && remaining === 0 && grand > 0) {
      remaining = grand;
    }

    let customerDoc = null;
    if (invoice.customer) {
      customerDoc = await Customer.findById(invoice.customer).session(session);
      if (!customerDoc) {
        const err = new Error('Customer not found');
        err.status = 400;
        throw err;
      }
    }

    if (customerDoc && remaining > 0) {
      customerDoc.balance = (customerDoc.balance || 0) + remaining;
      await customerDoc.save({ session });
    }

    const totalCost = (invoice.items || []).reduce(
      (sum, it) => sum + Number(it.cost || 0) * Number(it.qty || 0),
      0
    );

    const journalEntry = await createSalesJournalEntry(
      {
        invoiceId: invoice._id,
        invoiceNumber: invoice.number || invoice._id.toString().slice(-6),
        date: invoice.date,
        paidAmount: 0,
        remaining: remaining,
        grand: grand,
        tax: tax,
        customerName: customerDoc?.name || 'Customer',
        paymentMethod: invoice.paymentMethod || 'cash',
        splitDetails: [],
        userId: req.user?._id || req.user?.id,
        totalCost,
      },
      session
    );

    invoice.status = 'posted';
    await invoice.save({ session });

    await auditUpdate('INVOICE', invoice._id, beforeState, invoice, req.user, req.ip, session, {
      action: 'POST',
      journalEntryId: journalEntry?._id,
      stockLedgerIds,
    });

    return invoice._id;
  });

  const updated = await SalesInvoice.findById(resultId)
    .populate('customer', 'name code phone')
    .populate('items.item', 'name sku')
    .populate('returns.item', 'name sku')
    .lean();

  res.json(updated);
}

export async function voidInvoice(req, res) {
  const resultId = await runPostingTransaction(async (session) => {
    const invoice = await SalesInvoice.findById(req.params.id).session(session);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.status = 404;
      throw err;
    }

    const allowed = ['draft', 'pending'];
    if (!allowed.includes(invoice.status)) {
      const err = new Error('Only draft or pending invoices can be voided');
      err.status = 409;
      throw err;
    }

    const beforeState = invoice.toObject();

    // ===== RESTORE CUSTOMER BALANCE =====
    const remaining = Number(invoice.totals?.remaining || 0);
    if (invoice.customer && remaining > 0) {
      await Customer.findByIdAndUpdate(
        invoice.customer,
        { $inc: { balance: -remaining } },
        { session }
      );
    }

    invoice.status = 'void';
    await invoice.save({ session });

    await auditUpdate('INVOICE', invoice._id, beforeState, invoice, req.user, req.ip, session, {
      action: 'VOID',
    });

    return invoice._id;
  });

  const updated = await SalesInvoice.findById(resultId)
    .populate('customer', 'name code phone')
    .populate('items.item', 'name sku')
    .populate('returns.item', 'name sku')
    .lean();

  res.json(updated);
}

export async function reverseInvoice(req, res) {
  const resultId = await runPostingTransaction(async (session) => {
    const invoice = await SalesInvoice.findById(req.params.id).session(session);
    if (!invoice) {
      const err = new Error('Invoice not found');
      err.status = 404;
      throw err;
    }

    if (!['confirmed', 'posted'].includes(invoice.status)) {
      const err = new Error('Only confirmed or posted invoices can be reversed');
      err.status = 409;
      throw err;
    }

    const soldMap = new Map();
    invoice.items.forEach((it) => {
      if (!it.item) return;
      const key = String(it.item);
      soldMap.set(key, (soldMap.get(key) || 0) + Number(it.qty || 0));
    });

    const returnedMap = new Map();
    (invoice.returns || []).forEach((r) => {
      if (!r.item) return;
      const key = String(r.item);
      returnedMap.set(key, (returnedMap.get(key) || 0) + Number(r.qty || 0));
    });

    for (const [key, soldQty] of soldMap.entries()) {
      const returnedQty = returnedMap.get(key) || 0;
      if (returnedQty + 1e-9 < soldQty) {
        const err = new Error('Invoice must be fully returned before reversal');
        err.status = 400;
        throw err;
      }
    }

    const beforeState = invoice.toObject();
    invoice.status = 'refund';
    await invoice.save({ session });

    await auditUpdate('INVOICE', invoice._id, beforeState, invoice, req.user, req.ip, session, {
      action: 'REVERSE',
    });

    return invoice._id;
  });

  const updated = await SalesInvoice.findById(resultId)
    .populate('customer', 'name code phone')
    .populate('items.item', 'name sku')
    .populate('returns.item', 'name sku')
    .lean();

  res.json(updated);
}

export async function returnInvoiceItems(req, res) {
  return res.status(410).json({
    message: 'This endpoint is deprecated. Use /api/sales/returns.',
  });
}

/**
 * GET /api/sales/invoice/next-number
 * Retrieve next invoice sequence number without incrementing
 */
export async function getNextInvoiceNumber(req, res) {
  try {
    const settings = await CompanySettings.getSettings();
    const prefix = formatInvoicePrefix(settings?.invoicePrefix);
    const counterName = getInvoiceCounterName(prefix);

    const Counter = (await import('../models/Counter.js')).default;
    let counter = await Counter.findOne({ name: counterName });
    if (!counter && prefix === 'INV-') {
      counter = await Counter.findOne({ name: 'invoice' });
    }
    let nextSeq = (counter?.seq || 0) + 1;

    // Check with true maximum existing invoice in DB
    const maxExisting = await getHighestInvoiceSequence(prefix);
    if (maxExisting >= nextSeq) {
      nextSeq = maxExisting + 1;
    }

    const nextInvoiceNumber = `${prefix}${String(nextSeq).padStart(5, '0')}`;
    res.status(200).json({ nextInvoiceNumber, seq: nextSeq, prefix });
  } catch (error) {
    logger.logError('Failed to get next invoice number', { error: error.message });
    res.status(500).json({ message: 'فشل في استرجاع رقم الفاتورة التالي', error: error.message });
  }
}

/**
 * PUT /api/sales/invoice/:id
 * Update Same-Day Cash Invoice (تعديل الفاتورة النقدية في نفس اليوم)
 */
export async function updateSameDayCashInvoice(req, res) {
  const { id } = req.params;
  const { items, discountValue = 0, note, warehouse: reqWarehouse, treasury: reqTreasury } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'يجب أن تحتوي الفاتورة على صنف واحد على الأقل' });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });

    const invoice = await SalesInvoice.findById(id).session(session);
    if (!invoice) {
      throw new Error('الفاتورة غير موجودة');
    }

    // 1. Validate status
    if (['void', 'refund', 'cancelled'].includes(invoice.status)) {
      throw new Error('لا يمكن تعديل فاتورة ملغاة أو مستردة');
    }

    // 2. Validate same-day (نفس اليوم)
    const invoiceDate = new Date(invoice.date || invoice.createdAt);
    const now = new Date();
    const isSameDay =
      invoiceDate.getFullYear() === now.getFullYear() &&
      invoiceDate.getMonth() === now.getMonth() &&
      invoiceDate.getDate() === now.getDate();

    if (!isSameDay) {
      throw new Error('لا يمكن تعديل إلا الفواتير الصادرة في نفس اليوم (تاريخ اليوم فقط)');
    }

    // 3. Validate Cash Sale (عميل نقدي / نقداً)
    let isCash = !invoice.customer || invoice.paymentMethod === 'cash' || !invoice.paymentMethod;
    if (!isCash && invoice.customer) {
      const custDoc = await Customer.findById(invoice.customer?._id || invoice.customer).session(session);
      if (custDoc && (custDoc.name?.includes('نقدي') || custDoc.isCashCustomer)) {
        isCash = true;
      }
    }
    if (!isCash) {
      throw new Error('التعديل السريع متاح فقط للفواتير النقدية');
    }

    // 4. Validate that today is not closed
    const DailyClosure = (await import('../models/DailyClosure.js')).default;
    const closure = await DailyClosure.findOne({
      date: { $gte: startOfDay(invoiceDate), $lte: endOfDay(invoiceDate) },
      status: 'closed',
    }).session(session);

    if (closure) {
      throw new Error('لا يمكن تعديل الفاتورة لأن الوردية / اليوم قد تم إغلاقه مالياً');
    }

    const beforeState = invoice.toObject();
    const warehouseId = reqWarehouse || invoice.warehouse;
    const treasuryId = reqTreasury || invoice.treasury;

    // 5. Restore old stock to warehouse (Reverse old items)
    const { addStock } = await import('../services/stockService.js');
    for (const oldItem of invoice.items) {
      const oldItemId = oldItem.item?._id || oldItem.item;
      const oldQty = Number(oldItem.qty) || 0;
      if (oldItemId && mongoose.Types.ObjectId.isValid(String(oldItemId)) && oldQty > 0 && invoice.warehouse) {
        await addStock(oldItemId, invoice.warehouse, oldQty, session);
      }
    }

    // 6. Fetch costs for new items
    const validNewIds = items
      .map((i) => i.item?._id || i.item)
      .filter((itemId) => itemId && mongoose.Types.ObjectId.isValid(String(itemId)));

    let costDocs = [];
    if (validNewIds.length > 0) {
      costDocs = await Item.find({ _id: { $in: validNewIds } }).select('cost name sku').session(session);
    }
    const costMap = new Map(costDocs.map((d) => [d._id.toString(), d.cost || 0]));
    const docMap = new Map(costDocs.map((d) => [d._id.toString(), d]));

    const formattedNewItems = items.map((item) => {
      const rawId = item.item?._id || item.item;
      const hasValidId = Boolean(rawId && mongoose.Types.ObjectId.isValid(String(rawId)));
      const idStr = hasValidId ? rawId.toString() : null;
      const doc = idStr ? docMap.get(idStr) : null;
      return {
        item: hasValidId ? rawId : null,
        isCustom: Boolean(item.isCustom || !hasValidId),
        name: item.name || doc?.name || 'صنف حر',
        sku: item.sku || doc?.sku || (hasValidId ? '' : 'حر'),
        qty: Number(item.qty) || 1,
        price: Number(item.price) || 0,
        cost: Number(item.cost) || (idStr ? costMap.get(idStr) || 0 : 0),
      };
    });

    // 7. Deduct new stock from warehouse (only for registered items)
    const physicalNewItems = formattedNewItems.filter((row) => row.item);
    if (physicalNewItems.length > 0 && warehouseId) {
      await deductStockBulk(physicalNewItems, warehouseId, session);
    }

    // 8. Update Stock Ledger entries
    const StockLedger = (await import('../models/StockLedger.js')).default;
    await StockLedger.deleteMany({ ref: `INV#${invoice._id}` }).session(session);

    if (physicalNewItems.length > 0 && warehouseId) {
      const newLedgerEntries = physicalNewItems.map((row) => ({
        item: row.item,
        warehouse: warehouseId,
        type: 'OUT',
        qty: -Math.abs(row.qty),
        ref: `INV#${invoice._id}`,
        note: `Sales invoice ${invoice.number} (تعديل)`,
        date: new Date(),
      }));
      await StockLedger.insertMany(newLedgerEntries, { session });
    }

    // 9. Recalculate totals
    const subtotal = formattedNewItems.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const discount = Number(discountValue || 0);
    const grand = Math.max(0, subtotal - discount);
    const tax = 0; // POS cash retail

    const oldPaid = Number(invoice.totals?.paid || invoice.totals?.grand || 0);
    const delta = grand - oldPaid; // > 0 customer pays more, < 0 customer refunded

    // 10. Adjust Treasury if delta != 0
    if (treasuryId && Math.abs(delta) > 0.001) {
      if (delta > 0) {
        await createIncomeTransaction(
          {
            amount: delta,
            treasury: treasuryId,
            relatedId: invoice._id,
            relatedModel: 'SalesInvoice',
            description: `فارق تعديل فاتورة مبيعات ${invoice.number} (إيداع)`,
            category: 'sales',
            date: new Date(),
          },
          session
        );
      } else {
        const { createExpenseTransaction } = await import('../services/transactionService.js');
        await createExpenseTransaction(
          {
            amount: Math.abs(delta),
            treasury: treasuryId,
            relatedId: invoice._id,
            relatedModel: 'SalesInvoice',
            description: `فارق تعديل فاتورة مبيعات ${invoice.number} (استرداد)`,
            category: 'sales',
            date: new Date(),
          },
          session
        );
      }
    }

    // 11. Update Journal Entry (Reverse old Account.balance & entry, then post updated JE with COGS)
    try {
      await reverseJournalEntriesByReference(
        {
          $or: [
            { referenceType: 'SALE_INVOICE', referenceId: invoice._id.toString() },
            { referenceType: 'SALE_INVOICE', referenceId: invoice._id },
          ],
        },
        session,
        {
          deleteEntries: true,
          userId: req.user?._id || req.user?.id || invoice.cashier,
          reason: `تعديل فاتورة مبيعات ${invoice.number}`,
        }
      );

      const newTotalCost = formattedNewItems.reduce(
        (sum, it) => sum + Number(it.cost || 0) * Number(it.qty || 0),
        0
      );

      await createSalesJournalEntry(
        {
          invoiceId: invoice._id,
          invoiceNumber: invoice.number,
          date: invoice.date,
          paidAmount: grand,
          remaining: 0,
          grand,
          tax,
          customerName: req.body.customerName ? req.body.customerName.trim() : (invoice.customerName || 'عميل نقدي'),
          paymentMethod: 'cash',
          userId: req.user?._id || req.user?.id || invoice.cashier,
          totalCost: newTotalCost,
        },
        session
      );
    } catch (jeErr) {
      logger.warn('Failed to recreate journal entry on invoice update:', jeErr.message);
      throw jeErr;
    }

    // 12. Save Invoice with new items and totals
    invoice.items = formattedNewItems;
    invoice.totals = {
      subtotal,
      tax,
      discount,
      paid: grand,
      remaining: 0,
      grand,
    };
    invoice.discountValue = discount;
    if (note !== undefined) {
      invoice.note = note;
    }
    if (req.body.customerName !== undefined) {
      invoice.customerName = req.body.customerName.trim() || 'عميل نقدي';
    }
    if (warehouseId) invoice.warehouse = warehouseId;
    if (treasuryId) invoice.treasury = treasuryId;

    await invoice.save({ session });

    // 13. Audit Update
    await auditUpdate('INVOICE', invoice._id, beforeState, invoice, req.user, req.ip, session, {
      action: 'UPDATE_SAME_DAY_CASH',
      delta,
      previousTotal: oldPaid,
      newTotal: grand,
    });

    await session.commitTransaction();

    const populated = await SalesInvoice.findById(invoice._id)
      .populate('customer', 'name code phone')
      .populate('items.item', 'name sku')
      .populate('warehouse', 'name code')
      .populate('treasury', 'name')
      .populate('cashier', 'name email');

    res.json({
      success: true,
      message: `تم تعديل الفاتورة ${invoice.number} بنجاح`,
      invoice: populated,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    logger.error('Error updating same-day cash invoice:', error);
    res.status(400).json({
      message: error.message || 'فشل تعديل الفاتورة',
      code: 'INVOICE_UPDATE_FAILED',
    });
  } finally {
    session.endSession();
  }
}

/**
 * POST /api/sales/proforma/:id/convert
 * Convert a proforma invoice (quotation) into an official posted sales invoice
 */
export async function convertProformaToOfficial(req, res) {
  try {
    const { id } = req.params;
    const proforma = await SalesInvoice.findById(id);

    if (!proforma) {
      return res.status(404).json({ message: 'فاتورة العرض (عرض السعر) غير موجودة' });
    }

    if (proforma.type !== 'proforma') {
      return res.status(400).json({ message: 'هذه الفاتورة ليست فاتورة عرض' });
    }

    if (proforma.isConverted || proforma.status === 'converted') {
      return res.status(400).json({
        message: `تم تحويل عرض السعر هذا مسبقاً إلى الفاتورة رقم ${proforma.convertedInvoiceNumber || ''}`,
      });
    }

    const {
      warehouse = proforma.warehouse,
      paymentMethod = 'cash',
      treasury,
      paid,
      splitDetails = [],
    } = req.body;

    if (!warehouse) {
      return res.status(400).json({ message: 'يجب تحديد المستودع لخصم البضاعة' });
    }

    // Build the payload for createInvoiceWithTransaction
    const grand = proforma.totals?.grand || 0;
    const effectivePaid = paid !== undefined ? Number(paid) : (paymentMethod === 'credit' ? 0 : grand);

    const invoicePayload = {
      customer: proforma.customer,
      customerName: proforma.customerName,
      items: proforma.items.map((i) => ({
        item: i.item || null,
        name: i.name || '',
        sku: i.sku || '',
        isCustom: Boolean(i.isCustom || !i.item),
        qty: i.qty,
        price: i.price,
        cost: i.cost,
        isBundle: i.isBundle,
        bundleComponents: i.bundleComponents,
      })),
      warehouse,
      treasury: treasury || undefined,
      paymentMethod,
      paid: effectivePaid,
      discountValue: proforma.totals?.discount || 0,
      currency: proforma.currency || 'LYD',
      exchangeRate: proforma.exchangeRate || 1,
      channel: proforma.channel || 'retail',
      note: `تحويل من عرض السعر ${proforma.number || ''} ${proforma.note ? `- ${proforma.note}` : ''}`.trim(),
      splitDetails,
      type: 'official',
    };

    const officialInvoice = await createInvoiceWithTransaction(
      invoicePayload,
      req.user?._id || req.user?.id
    );

    // Update proforma record
    proforma.isConverted = true;
    proforma.status = 'converted';
    proforma.convertedTo = officialInvoice._id;
    proforma.convertedInvoiceNumber = officialInvoice.number;
    await proforma.save();

    const populated = await officialInvoice.populate([
      { path: 'customer', select: 'name code phone' },
      { path: 'items.item', select: 'name sku' },
      { path: 'warehouse', select: 'name code' },
      { path: 'treasury', select: 'name' },
      { path: 'cashier', select: 'name email' },
    ]);

    res.status(200).json({
      success: true,
      message: `تم تحويل عرض السعر إلى فاتورة مبيعات معتمدة رقم ${officialInvoice.number} بنجاح`,
      officialInvoice: populated,
      proforma,
    });
  } catch (error) {
    logger.logError('convertProformaToOfficial error', { error: error.message, stack: error.stack });
    res.status(400).json({
      message: error.message || 'فشل تحويل عرض السعر إلى فاتورة مبيعات',
      code: 'CONVERT_PROFORMA_FAILED',
    });
  }
}

/**
 * DELETE /api/sales/proforma/:id
 * Delete a proforma invoice (quotation) safely
 */
export async function deleteProformaInvoice(req, res) {
  try {
    const { id } = req.params;
    const proforma = await SalesInvoice.findById(id);

    if (!proforma) {
      return res.status(404).json({ message: 'عرض السعر غير موجود' });
    }

    if (proforma.type !== 'proforma') {
      return res.status(400).json({ message: 'لا يمكن حذف إلا عروض الأسعار وفواتير العرض فقط' });
    }

    await SalesInvoice.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'تم حذف عرض السعر بنجاح',
    });
  } catch (error) {
    logger.logError('deleteProformaInvoice error', { error: error.message });
    res.status(400).json({
      message: error.message || 'فشل حذف عرض السعر',
    });
  }
}

/**
 * POST /api/sales/proforma/:id/revert
 * Revert proforma conversion, cancel the generated official invoice, restore stock & treasury, and reopen quote for editing
 */
export async function revertProformaConversion(req, res) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });

    const { id } = req.params;
    const proforma = await SalesInvoice.findById(id).session(session);

    if (!proforma) {
      throw new Error('فاتورة العرض (عرض السعر) غير موجودة');
    }

    if (proforma.type !== 'proforma') {
      throw new Error('هذا السجل ليس عرض سعر');
    }

    if (!proforma.isConverted && proforma.status !== 'converted') {
      throw new Error('عرض السعر هذا غير محول بالفعل');
    }

    const officialInvoiceId = proforma.convertedTo;
    if (officialInvoiceId) {
      const officialInvoice = await SalesInvoice.findById(officialInvoiceId).session(session);

      if (officialInvoice && ['posted', 'confirmed', 'draft'].includes(officialInvoice.status)) {
        // 1. Restore stock to warehouse
        if (officialInvoice.warehouse && officialInvoice.items?.length > 0) {
          const { addStock } = await import('../services/stockService.js');
          for (const item of officialInvoice.items) {
            const itemId = item.item?._id || item.item;
            const qty = Number(item.qty) || 0;
            if (itemId && mongoose.Types.ObjectId.isValid(String(itemId)) && qty > 0) {
              await addStock(itemId, officialInvoice.warehouse, qty, session);
            }
          }

          // Remove stock ledger entries
          const StockLedger = (await import('../models/StockLedger.js')).default;
          await StockLedger.deleteMany({ ref: `INV#${officialInvoice._id}` }).session(session);
        }

        // 2. Reverse Treasury transaction if paid
        const paid = Number(officialInvoice.totals?.paid || 0);
        if (officialInvoice.treasury && paid > 0) {
          const { createExpenseTransaction } = await import('../services/transactionService.js');
          await createExpenseTransaction(
            {
              amount: paid,
              treasury: officialInvoice.treasury,
              relatedId: officialInvoice._id,
              relatedModel: 'SalesInvoice',
              description: `استرداد/إلغاء تنزيل عرض السعر ${proforma.number || ''} - فاتورة ${officialInvoice.number || ''}`,
              category: 'sales',
              date: new Date(),
            },
            session
          );
        }

        // 3. Reverse Customer Balance if credit
        const remaining = Number(officialInvoice.totals?.remaining || 0);
        if (officialInvoice.customer && remaining > 0) {
          await Customer.findByIdAndUpdate(
            officialInvoice.customer,
            { $inc: { balance: -remaining } },
            { session }
          );
        }

        // 4. Reverse Journal Entry (and restore Account.balance)
        await reverseJournalEntriesByReference(
          {
            $or: [
              { referenceType: 'SALE_INVOICE', referenceId: officialInvoice._id.toString() },
              { referenceType: 'SALE_INVOICE', referenceId: officialInvoice._id },
            ],
          },
          session,
          {
            deleteEntries: false,
            userId: req.user?._id || req.user?.id,
            reason: `إلغاء تنزيل عرض السعر ${proforma.number || ''} - فاتورة ${officialInvoice.number || ''}`,
          }
        );

        // 5. Mark official invoice as cancelled
        officialInvoice.status = 'cancelled';
        officialInvoice.note = `ملغاة بسبب التراجع عن تنزيل عرض السعر ${proforma.number || ''} - ${officialInvoice.note || ''}`.trim();
        await officialInvoice.save({ session });
      }
    }

    // 6. Reset the proforma quote to draft
    proforma.isConverted = false;
    proforma.status = 'draft';
    proforma.convertedTo = null;
    proforma.convertedInvoiceNumber = null;
    await proforma.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'تم التراجع عن تنزيل عرض السعر وإلغاء الفاتورة المرتبطة وإعادة فتح العرض للتعديل بنجاح',
      proforma,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    logger.logError('revertProformaConversion error', { error: error.message, stack: error.stack });
    res.status(400).json({
      message: error.message || 'فشل التراجع عن تنزيل عرض السعر',
      code: 'REVERT_PROFORMA_FAILED',
    });
  } finally {
    session.endSession();
  }
}

/**
 * PUT /api/sales/proforma/:id
 * Update an existing proforma quotation (only if draft/active)
 */
export async function updateProformaInvoice(req, res) {
  try {
    const { id } = req.params;
    const proforma = await SalesInvoice.findById(id);

    if (!proforma) {
      return res.status(404).json({ message: 'عرض السعر غير موجود' });
    }

    if (proforma.type !== 'proforma') {
      return res.status(400).json({ message: 'لا يمكن تعديل إلا عروض الأسعار وفواتير العرض فقط' });
    }

    if (proforma.isConverted || proforma.status === 'converted') {
      return res.status(400).json({
        message: 'يجب التراجع عن تنزيل الفاتورة أولاً لتتمكن من تعديل بيانات عرض السعر',
      });
    }

    const {
      customer,
      customerName,
      warehouse,
      date,
      items,
      discountValue = 0,
      note,
      currency = 'LYD',
      exchangeRate = 1,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'يجب أن يحتوي عرض السعر على صنف واحد على الأقل' });
    }

    // Recalculate totals
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0);
    const discount = Number(discountValue) || 0;
    const grand = Math.max(0, subtotal - discount);
    const rate = Number(exchangeRate) || 1;
    const totalUSD = Number((grand / rate).toFixed(2));

    proforma.customer = customer || undefined;
    proforma.customerName = customerName ? customerName.trim() : (proforma.customerName || 'عميل نقدي');
    proforma.warehouse = warehouse || undefined;
    if (date) proforma.date = new Date(date);
    proforma.note = note !== undefined ? note : proforma.note;
    proforma.currency = currency;
    proforma.exchangeRate = rate;
    proforma.discountValue = discount;

    proforma.items = items.map((i) => {
      const rawId = i.item?._id || i.item;
      const hasValidId = Boolean(rawId && mongoose.Types.ObjectId.isValid(String(rawId)));
      return {
        item: hasValidId ? rawId : null,
        isCustom: Boolean(i.isCustom || !hasValidId),
        name: i.name || 'صنف حر',
        sku: i.sku || (hasValidId ? '' : 'حر'),
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0,
        priceUSD: (Number(i.price) || 0) / rate,
        cost: Number(i.cost) || 0,
        isBundle: !!i.isBundle,
        bundleComponents: i.bundleComponents || [],
      };
    });

    proforma.totals = {
      subtotal,
      discount,
      grand,
      paid: 0,
      remaining: grand,
      totalUSD,
      paidUSD: 0,
      remainingUSD: totalUSD,
    };

    await proforma.save();

    const populated = await SalesInvoice.findById(proforma._id)
      .populate('customer', 'name code phone')
      .populate('items.item', 'name sku')
      .populate('warehouse', 'name code');

    res.status(200).json({
      success: true,
      message: 'تم حفظ تعديلات عرض السعر بنجاح',
      proforma: populated,
    });
  } catch (error) {
    logger.logError('updateProformaInvoice error', { error: error.message, stack: error.stack });
    res.status(400).json({
      message: error.message || 'فشل حفظ تعديل عرض السعر',
      code: 'UPDATE_PROFORMA_FAILED',
    });
  }
}
