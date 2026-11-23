import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Item from '../models/Item.js';
import Supplier from '../models/Supplier.js';
import StockLedger from '../models/StockLedger.js';
import Treasury from '../models/Treasury.js';
import Transaction from '../models/Transaction.js';
import { postJournalEntry, reverseJournalEntriesByReference } from '../services/journalEntryService.js';
import JournalEntry from '../models/JournalEntry.js';
import Account from '../models/Account.js';
import { auditUpdate } from '../services/auditService.js';
import { runPostingTransaction } from '../services/postingService.js';
import { getSystemAccount } from '../services/systemAccountsService.js';
import { applyFiscalDateFilter } from '../middleware/fiscalPeriod.js';

// Account Resolution Helpers
async function getAPAccount(session) {
  return await getSystemAccount('AP', session);
}

async function getInventoryAccount(session) {
  return await getSystemAccount('INVENTORY', session);
}

async function getTreasuryAccount(treasuryDoc, session) {
  if (treasuryDoc?.accountId) {
    const acc = await Account.findById(treasuryDoc.accountId).session(session);
    if (acc) return acc;
  }
  const key = treasuryDoc?.type === 'bank' ? 'BANK' : 'CASH';
  return await getSystemAccount(key, session);
}

// 0. Create Direct Purchase Invoice (Fast POS Purchase)
export const createDirectPurchaseInvoice = async (req, res) => {
  try {
    const {
      supplier,
      items,
      warehouse,
      paymentMethod = 'credit',
      treasuryId,
      invoiceNumber,
      note,
      discount = 0,
      date = new Date(),
      exchangeRate: clientRate,
      currency: invoiceCurrency = 'LYD',
    } = req.body;

    if (!supplier) throw new Error('المورد مطلوب');
    if (!warehouse) throw new Error('المستودع المستهدف مطلوب');
    if (!items || !items.length) throw new Error('يجب إضافة صنف واحد على الأقل');
    if (paymentMethod === 'cash' && !treasuryId) throw new Error('الخزينة مطلوبة للدفع النقدي');

    const resultId = await runPostingTransaction(async (session) => {
      let exchangeRate = Number(clientRate);
      if (!exchangeRate || exchangeRate <= 0) {
        const CompanySettings = (await import('../models/CompanySettings.js')).default;
        const settings = await CompanySettings.findOne().session(session);
        exchangeRate = Number(settings?.usdExchangeRate) || 7.30;
      }

      // Process items: ensure both cost (LYD) and costUSD are calculated
      const processedItems = items.map((i) => {
        let costLYD = Number(i.cost || 0);
        let costUSD = Number(i.costUSD || 0);
        const itemCurrency = i.currency || invoiceCurrency || 'LYD';

        if (itemCurrency === 'USD' || (costUSD > 0 && costLYD <= 0)) {
          costLYD = Number((costUSD * exchangeRate).toFixed(2));
        } else if (costUSD <= 0 && costLYD > 0) {
          costUSD = exchangeRate > 0 ? Number((costLYD / exchangeRate).toFixed(2)) : 0;
        }

        return {
          item: i.item,
          qty: Number(i.qty),
          cost: costLYD,
          costUSD: costUSD,
          currency: itemCurrency,
        };
      });

      const subtotalAmount = processedItems.reduce((sum, i) => sum + (Number(i.qty || 0) * Number(i.cost || 0)), 0);
      const safeDiscount = Math.max(0, Number(discount || 0));
      const totalAmount = Math.max(0, Number((subtotalAmount - safeDiscount).toFixed(2)));
      if (totalAmount <= 0) throw new Error('إجمالي الفاتورة بعد الخصم يجب أن يكون أكبر من صفر');
      const totalAmountUSD = exchangeRate > 0 ? Number((totalAmount / exchangeRate).toFixed(2)) : 0;

      const supplierDoc = await Supplier.findById(supplier).session(session);
      if (!supplierDoc) throw new Error('المورد غير موجود');

      let number = (invoiceNumber || '').trim();
      if (!number) {
        const count = await PurchaseOrder.countDocuments().session(session);
        number = `PO-${String(count + 1).padStart(5, '0')}`;
      }

      const [po] = await PurchaseOrder.create(
        [
          {
            number,
            supplier,
            currency: invoiceCurrency,
            exchangeRate,
            items: processedItems,
            warehouse,
            status: 'received',
            paymentMethod,
            discount: safeDiscount,
            totalAmount,
            totalAmountUSD,
            paidAmount: paymentMethod === 'cash' ? totalAmount : 0,
            paidAmountUSD: paymentMethod === 'cash' ? totalAmountUSD : 0,
            note: note || '',
            receivedAt: date,
          },
        ],
        { session }
      );

      const stockLedgerIds = [];

      for (const lineItem of po.items) {
        const product = await Item.findById(lineItem.item).session(session);
        if (!product) throw new Error(`الصنف غير موجود: ${lineItem.item}`);

        const currentTotalQty = Math.max(0, product.totalStock || 0);
        const currentCost = product.cost || 0;
        const currentCostUSD = product.costUSD || (exchangeRate > 0 ? Number((currentCost / exchangeRate).toFixed(2)) : 0);
        const newQty = Number(lineItem.qty);
        const newCost = Number(lineItem.cost);
        const newCostUSD = Number(lineItem.costUSD || (exchangeRate > 0 ? (newCost / exchangeRate).toFixed(2) : 0));

        const totalValue = currentTotalQty * currentCost + newQty * newCost;
        const totalValueUSD = currentTotalQty * currentCostUSD + newQty * newCostUSD;
        const totalQty = currentTotalQty + newQty;

        const weightedAvgCost = totalQty > 0 ? totalValue / totalQty : newCost;
        const weightedAvgCostUSD = totalQty > 0 ? totalValueUSD / totalQty : newCostUSD;

        if (!product.stocks) product.stocks = [];
        const stockIndex = product.stocks.findIndex(
          (s) => s.warehouse.toString() === warehouse.toString()
        );

        if (stockIndex > -1) {
          product.stocks[stockIndex].qty += newQty;
        } else {
          product.stocks.push({ warehouse, qty: newQty });
        }

        product.cost = Number(weightedAvgCost.toFixed(2));
        product.costUSD = Number(weightedAvgCostUSD.toFixed(2));
        product.totalStock = (product.totalStock || 0) + newQty;
        await product.save({ session });

        const [ledgerDoc] = await StockLedger.create(
          [
            {
              item: product._id,
              warehouse,
              type: 'IN',
              qty: newQty,
              ref: `PO#${po.number || po._id}`,
              note: `شراء مباشر - ${po.number || ''}`,
              user: req.user?._id,
              date: date || new Date(),
            },
          ],
          { session }
        );
        if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
      }

      const invAcc = await getInventoryAccount(session);
      const apAcc = await getAPAccount(session);
      let journalEntryId = null;

      if (paymentMethod === 'cash') {
        const treasury = await Treasury.findById(treasuryId).session(session);
        if (!treasury) throw new Error('الخزينة المحددة غير موجودة');
        if (treasury.balance < totalAmount) {
          throw new Error(`رصيد الخزينة (${treasury.balance}) لا يكفي لسداد (${totalAmount})`);
        }

        treasury.balance -= totalAmount;
        await treasury.save({ session });

        await Transaction.create(
          [
            {
              type: 'expense',
              flow: 'out',
              category: 'purchase_payment',
              amount: totalAmount,
              treasury: treasuryId,
              relatedModel: 'PurchaseOrder',
              relatedId: po._id,
              description: `سداد فاتورة مشتريات #${po.number} للمورد: ${supplierDoc.name}`,
              date: date || new Date(),
            },
          ],
          { session }
        );

        const treasuryAcc = await getTreasuryAccount(treasury, session);
        if (invAcc && treasuryAcc) {
          const je = await postJournalEntry(
            {
              date: date || new Date(),
              referenceType: 'PURCHASE',
              referenceId: po._id,
              description: `فاتورة شراء نقدية #${po.number} - ${supplierDoc.name}`,
              lines: [
                { accountId: invAcc._id, debit: totalAmount, credit: 0, note: 'Inventory received (Cash)' },
                { accountId: treasuryAcc._id, debit: 0, credit: totalAmount, note: `Treasury paid (${treasury.name})` },
              ],
              userId: req.user?._id,
              createdBy: req.user?._id,
            },
            { session }
          );
          journalEntryId = je?._id || null;
        }
      } else {
        supplierDoc.balance = (supplierDoc.balance || 0) + totalAmount;
        supplierDoc.balanceUSD = Number(((supplierDoc.balanceUSD || 0) + totalAmountUSD).toFixed(2));
        await supplierDoc.save({ session });

        if (invAcc && apAcc) {
          const je = await postJournalEntry(
            {
              date: date || new Date(),
              referenceType: 'PURCHASE',
              referenceId: po._id,
              description: `فاتورة شراء آجلة #${po.number} - ${supplierDoc.name}`,
              lines: [
                { accountId: invAcc._id, debit: totalAmount, credit: 0, note: 'Inventory received' },
                { accountId: apAcc._id, debit: 0, credit: totalAmount, note: 'AP accrued' },
              ],
              userId: req.user?._id,
              createdBy: req.user?._id,
            },
            { session }
          );
          journalEntryId = je?._id || null;
        }
      }

      await auditUpdate('PURCHASE_ORDER', po._id, null, po, req.user, req.ip, session, {
        action: 'POST',
        journalEntryId,
        stockLedgerIds,
      });

      return po._id;
    });

    const populated = await PurchaseOrder.findById(resultId)
      .populate('supplier', 'name code phone balance')
      .populate('warehouse', 'name code')
      .populate('items.item', 'name sku barcode cost price');

    res.status(201).json({
      message: 'تم حفظ وترحيل فاتورة المشتريات بنجاح',
      invoice: populated,
    });
  } catch (error) {
    console.error('Direct Purchase Invoice Error:', error);
    res.status(400).json({ message: error.message });
  }
};

// 1. Create Draft PO
export const createPurchaseOrder = async (req, res) => {
  try {
    const { supplier, items, warehouse, currency = 'LYD', exchangeRate: clientRate } = req.body;

    if (!supplier) {
      return res.status(400).json({ message: 'المورد مطلوب' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'يجب إضافة صنف واحد على الأقل' });
    }

    let exchangeRate = Number(clientRate);
    if (!exchangeRate || exchangeRate <= 0) {
      const CompanySettings = (await import('../models/CompanySettings.js')).default;
      const settings = await CompanySettings.findOne();
      exchangeRate = Number(settings?.usdExchangeRate) || 7.30;
    }

    // Calculate totals
    const totalAmount = items.reduce((sum, i) => sum + (Number(i.qty || 0) * Number(i.cost || 0)), 0);
    const totalAmountUSD = exchangeRate > 0 ? Number((totalAmount / exchangeRate).toFixed(2)) : 0;

    const count = await PurchaseOrder.countDocuments();
    const number = `PO-${String(count + 1).padStart(5, '0')}`;

    const po = await PurchaseOrder.create({
      number,
      supplier,
      currency,
      exchangeRate,
      items,
      warehouse, // Optional preference
      totalAmount,
      totalAmountUSD,
      status: 'pending',
    });

    res.status(201).json(po);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Receive PO (Atomic Transaction)
export const receivePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { warehouse } = req.body;

    if (!warehouse) {
      throw new Error('Target warehouse is required for receiving');
    }

    const poId = await runPostingTransaction(async (session) => {
      const po = await PurchaseOrder.findById(id).session(session);
      if (!po) throw new Error('Order not found');
      if (po.status === 'received' || po.status === 'returned') throw new Error('Order already received');
      if (po.status === 'cancelled') throw new Error('Order is cancelled');

      const beforeState = po.toObject();
      const stockLedgerIds = [];

      // B. Process Each Item (Costing & Stock)
      for (const lineItem of po.items) {
        const product = await Item.findById(lineItem.item).session(session);

        if (product) {
          const exchangeRate = Number(po.exchangeRate) || 7.30;
          const currentTotalQty = product.totalStock || 0;
          const currentCost = product.cost || 0;
          const currentCostUSD = product.costUSD || (exchangeRate > 0 ? Number((currentCost / exchangeRate).toFixed(2)) : 0);
          const newQty = lineItem.qty;
          const newCost = lineItem.cost;
          const newCostUSD = Number(lineItem.costUSD || (exchangeRate > 0 ? (newCost / exchangeRate).toFixed(2) : 0));

          const totalValue = currentTotalQty * currentCost + newQty * newCost;
          const totalValueUSD = currentTotalQty * currentCostUSD + newQty * newCostUSD;
          const totalQty = currentTotalQty + newQty;

          const weightedAvgCost = totalQty > 0 ? totalValue / totalQty : newCost;
          const weightedAvgCostUSD = totalQty > 0 ? totalValueUSD / totalQty : newCostUSD;

          if (!product.stocks) product.stocks = [];

          const stockIndex = product.stocks.findIndex((s) => s.warehouse.toString() === warehouse.toString());

          if (stockIndex > -1) {
            product.stocks[stockIndex].qty += newQty;
          } else {
            product.stocks.push({ warehouse, qty: newQty });
          }

          product.cost = Number(weightedAvgCost.toFixed(2));
          product.costUSD = Number(weightedAvgCostUSD.toFixed(2));
          product.totalStock = (product.totalStock || 0) + newQty;

          await product.save({ session });

          const [ledgerDoc] = await StockLedger.create(
            [
              {
                item: product._id,
                warehouse: warehouse,
                type: 'IN',
                qty: newQty,
                ref: `PO#${po.number || po._id}`,
                note: 'Purchase Order Receive',
                date: new Date(),
              },
            ],
            { session }
          );
          if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
        }
      }

      // C. Update Supplier Balance (Credit)
      await Supplier.findByIdAndUpdate(
        po.supplier,
        {
          $inc: { balance: po.totalAmount },
        },
        { session }
      );

      // D. Mark PO as Received
      po.status = 'received';
      po.warehouse = warehouse;
      po.receivedAt = new Date();
      await po.save({ session });

      // E. Auto-Accounting (Journal Entry)
      let journalEntryId = null;
      try {
        const invAcc = await getInventoryAccount(session);
        const apAcc = await getAPAccount(session);

        if (invAcc && apAcc) {
          const journalEntry = await postJournalEntry(
            {
              date: new Date(),
              referenceType: 'PURCHASE',
              referenceId: po._id.toString(),
              ref: `PO-${po.number || po._id.toString().slice(-6)}`,
              note: `استلام أمر شراء #${po.number || ''} - مورد #${po.supplier}`,
              lines: [
                { accountId: invAcc._id, debit: po.totalAmount, credit: 0, memo: 'إثبات استلام بضاعة بالمخزون' },
                { accountId: apAcc._id, debit: 0, credit: po.totalAmount, memo: 'استحقاق ذمم موردين' },
              ],
              createdBy: req.user?._id || null,
            },
            { session, updateBalances: true }
          );
          journalEntryId = journalEntry?._id || null;
        }
      } catch (jeError) {
        logger.error(`Accounting Sync Failed (Procurement): ${jeError.message}`);
        throw jeError;
      }

      await auditUpdate('PURCHASE_ORDER', po._id, beforeState, po, req.user, req.ip, session, {
        action: 'POST',
        journalEntryId,
        stockLedgerIds,
      });

      return po._id;
    });

    const po = await PurchaseOrder.findById(poId);
    res.status(200).json({ message: 'Received successfully', po });
  } catch (error) {
    console.error('Receive Error:', error);
    res.status(400).json({ message: error.message });
  }
};

// 2.1 Void Purchase Order (Pending/Approved only)
export const voidPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const poId = await runPostingTransaction(async (session) => {
      const po = await PurchaseOrder.findById(id).session(session);
      if (!po) throw new Error('Order not found');

      if (!['pending', 'approved'].includes(po.status)) {
        throw new Error('Only pending or approved orders can be voided');
      }

      const beforeState = po.toObject();
      po.status = 'cancelled';
      await po.save({ session });

      await auditUpdate('PURCHASE_ORDER', po._id, beforeState, po, req.user, req.ip, session, {
        action: 'VOID',
      });

      return po._id;
    });

    const po = await PurchaseOrder.findById(poId);
    res.json({ message: 'Order voided', po });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 3. Supplier Payment
export const createSupplierPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { supplierId, treasuryId, amount, note, date, orderId, purchaseOrderId } = req.body;
    const targetOrderId = orderId || purchaseOrderId;

    const payAmount = Number(amount);
    if (payAmount <= 0) throw new Error('المبلغ غير صحيح');

    // 1. Check Supplier
    const supplier = await Supplier.findById(supplierId).session(session);
    if (!supplier) throw new Error('المورد غير موجود');

    // 2. Check Treasury Funds
    const treasury = await Treasury.findById(treasuryId).session(session);
    if (!treasury) throw new Error('الخزينة غير موجودة');

    if (treasury.balance < payAmount) {
      throw new Error(`رصيد الخزينة (${treasury.balance}) لا يكفي لسداد (${payAmount})`);
    }

    // 3. Deduct from Treasury
    treasury.balance -= payAmount;
    await treasury.save({ session });

    // 4. Deduct from Supplier (Debt Reduced or Advance Payment)
    const previousBalance = Number(supplier.balance || 0);
    supplier.balance = Math.round((previousBalance - payAmount) * 1000) / 1000;
    await supplier.save({ session });

    // 4.1 Update target PurchaseOrder paidAmount if provided
    if (targetOrderId) {
      await PurchaseOrder.findByIdAndUpdate(
        targetOrderId,
        { $inc: { paidAmount: payAmount } },
        { session }
      );
    }

    // 5. Create Transaction
    const [txDoc] = await Transaction.create(
      [
        {
          type: 'expense',
          flow: 'out',
          category: 'pay_supplier',
          amount: payAmount,
          treasury: treasuryId,
          relatedModel: 'Supplier',
          relatedId: supplierId,
          description: note || `سداد للمورد: ${supplier.name}${targetOrderId ? ' (سداد فاتورة)' : ''}`,
          date: date || new Date(),
        },
      ],
      { session }
    );

    // 6. Journal Entry (Dr AP / Cr Cash or Bank)
    const apAcc = await getAPAccount(session);
    const treasuryAcc = await getTreasuryAccount(treasury, session);

    if (!apAcc || !treasuryAcc) {
      throw new Error('حساب المورد أو الخزينة غير موجود في شجرة الحسابات');
    }

    await postJournalEntry({
      date: date || new Date(),
      referenceType: 'PAYMENT_VOUCHER',
      referenceId: supplier._id,
      description: `سداد مورد - ${supplier.name}`,
      lines: [
        { accountId: apAcc._id, debit: payAmount, credit: 0, note: 'AP settlement' },
        { accountId: treasuryAcc._id, debit: 0, credit: payAmount, note: `Treasury payment (${treasury.name})` },
      ],
      userId: req.user?._id,
      createdBy: req.user?._id
    }, { session });

    await session.commitTransaction();
    res.status(200).json({
      message: 'تم سداد الدفعة بنجاح',
      newBalance: supplier.balance,
      voucher: {
        _id: txDoc?._id,
        voucherType: 'payment',
        beneficiaryType: 'supplier',
        supplier: {
          _id: supplier._id,
          name: supplier.name,
          code: supplier.code,
          phone: supplier.phone,
          balance: supplier.balance,
        },
        previousBalance,
        remainingBalance: supplier.balance,
        amount: payAmount,
        method: treasury.type === 'bank' ? 'bank' : 'cash',
        treasury: {
          _id: treasury._id,
          name: treasury.name,
          type: treasury.type,
        },
        note: note || `سداد للمورد: ${supplier.name}${targetOrderId ? ' (سداد فاتورة)' : ''}`,
        date: date || new Date(),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// 4. Return PO logic
export const returnPurchaseOrder = async (req, res) => {
  try {
    const id = req.params && req.params.id ? req.params.id : req;

    const poId = await runPostingTransaction(async (session) => {
      const po = await PurchaseOrder.findById(id).session(session);
      if (!po) throw new Error('Order not found');
      if (po.status !== 'received') throw new Error('Order is not received, cannot return');

      const beforeState = po.toObject();
      const warehouseId = po.warehouse;
      const stockLedgerIds = [];

      // Reverse Stock Logic
      for (const lineItem of po.items) {
        const product = await Item.findById(lineItem.item).session(session);
        if (!product) continue;

        if (!product.stocks) product.stocks = [];
        const stockIndex = product.stocks.findIndex((s) => s.warehouse.toString() === warehouseId.toString());
        if (stockIndex === -1) {
          throw new Error(`Item not found in warehouse: ${lineItem.item}`);
        }
        if (product.stocks[stockIndex].qty < lineItem.qty) {
          throw new Error(`Insufficient stock for return: ${product.name}`);
        }

        product.stocks[stockIndex].qty -= lineItem.qty;
        product.totalStock = Math.max(0, (product.totalStock || 0) - lineItem.qty);
        await product.save({ session });

        const [ledgerDoc] = await StockLedger.create(
          [
            {
              item: product._id,
              warehouse: warehouseId,
              type: 'OUT',
              qty: -lineItem.qty,
              ref: `PO#${po.number || po._id}`,
              note: 'Purchase Order Return',
              date: new Date(),
            },
          ],
          { session }
        );
        if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
      }

      // Reverse Balance (Debit Supplier)
      await Supplier.findByIdAndUpdate(
        po.supplier,
        {
          $inc: { balance: -po.totalAmount },
        },
        { session }
      );

      // Journal Entry (Reverse PO)
      let journalEntryId = null;
      try {
        const inventoryAccount = await getInventoryAccount(session);
        const apAccount = await getAPAccount(session);

        if (inventoryAccount && apAccount) {
          const journalEntry = await postJournalEntry(
            {
              date: new Date(),
              referenceType: 'PURCHASE_RETURN',
              referenceId: po._id.toString(),
              ref: `PRET-${po.number || po._id.toString().slice(-6)}`,
              note: `إرجاع أمر شراء #${po.number || ''} - مورد #${po.supplier}`,
              lines: [
                { accountId: apAccount._id, debit: po.totalAmount, credit: 0, memo: 'تخفيض ذمم الموردين (إرجاع أمر شراء)' },
                { accountId: inventoryAccount._id, debit: 0, credit: po.totalAmount, memo: 'تخفيض المخزون (إرجاع أمر شراء)' },
              ],
              createdBy: req.user?._id || null,
            },
            { session, updateBalances: true }
          );
          journalEntryId = journalEntry?._id || null;
        }
      } catch (jeError) {
        logger.error(`Journal Entry Failed (PO Return): ${jeError.message}`);
        throw jeError;
      }

      // Update PO Status
      po.status = 'returned';
      await po.save({ session });

      await auditUpdate('PURCHASE_ORDER', po._id, beforeState, po, req.user, req.ip, session, {
        action: 'REVERSE',
        journalEntryId,
        stockLedgerIds,
      });

      return po._id;
    });

    if (res && res.json) {
      const po = await PurchaseOrder.findById(poId);
      return res.json({ message: 'Returned successfully', po });
    }
    return poId;
  } catch (e) {
    if (res && res.status) return res.status(400).json({ message: e.message });
    throw e;
  }
};

// 5. Get Unpaid Orders for Supplier
export const getSupplierUnpaidOrders = async (req, res) => {
  try {
    const { id } = req.params;

    // Find POs that are received AND (Total > Paid)
    // Note: 'paidAmount' field might not exist on older schemas or if defaults aren't set.
    // Assuming paidAmount exists. If not, we treat 0.

    const orders = await PurchaseOrder.find({
      supplier: id,
      status: 'received',
      $expr: { $gt: ['$totalAmount', '$paidAmount'] },
    }).select('number totalAmount paidAmount createdAt');

    // Map to add "remainingBalance" virtual field for the UI
    const mappedOrders = orders.map((o) => ({
      _id: o._id,
      number: o.number || o._id.toString().slice(-6),
      date: o.createdAt,
      totalAmount: o.totalAmount,
      paidAmount: o.paidAmount || 0,
      remainingBalance: o.totalAmount - (o.paidAmount || 0),
    }));

    res.json(mappedOrders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// NEW FEATURES (Enterprise Upgrade)
// ==========================================

import PurchaseReturn from '../models/PurchaseReturn.js';

// 6. Get Supplier Statement (Timeline)
export const getSupplierStatement = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findById(id);
    if (!supplier) throw new Error('Supplier not found');

    // 1. Fetch Purchase Orders (Debits) - Only Received
    const orders = await PurchaseOrder.find({
      supplier: id,
      status: 'received',
    }).lean();

    // 2. Fetch Payments (Credits) - From Transactions
    const payments = await Transaction.find({
      relatedModel: 'Supplier',
      relatedId: id,
      type: 'expense', // We paid them
    })
      .populate('treasury', 'name type')
      .lean();

    // 3. Fetch Returns (Credits)
    const returns = await PurchaseReturn.find({
      supplier: id,
    }).lean();

    // 4. Merge & Sort
    const timeline = [
      ...orders.map((o) => ({
        id: o._id,
        date: o.receivedAt || o.createdAt,
        type: 'INVOICE',
        ref: `PO#${o.number || o._id.toString().slice(-6)}`,
        debit: o.totalAmount, // We owe this
        credit: 0,
      })),
      ...payments.map((p) => ({
        id: p._id,
        date: p.date,
        type: 'PAYMENT',
        ref: `PV-${p._id.toString().slice(-6).toUpperCase()}`,
        debit: 0,
        credit: p.amount, // We paid this
        note: p.description || '',
        treasury: p.treasury || null,
        method: p.treasury?.type === 'bank' ? 'bank' : 'cash',
      })),
      ...returns.map((r) => ({
        id: r._id,
        date: r.date,
        type: 'RETURN',
        ref: `RET#${r._id.toString().slice(-6)}`,
        debit: 0,
        credit: r.totalRefundAmount, // We are owed this back (reduces debt)
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // 5. Calculate Running Balance
    let balance = supplier.openingBalance || 0;
    const statement = timeline.map((entry) => {
      const previousBalance = balance;
      balance += entry.debit - entry.credit;
      return { ...entry, previousBalance, balance };
    });

    res.json({
      supplier: {
        _id: supplier._id,
        name: supplier.name,
        code: supplier.code,
        phone: supplier.phone,
        currentBalance: supplier.balance,
      },
      statement,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 7. Create Purchase Return DRAFT (No stock/supplier changes yet)
export const createPurchaseReturn = async (req, res) => {
  try {
    const { purchaseOrderId, items, note, warehouse } = req.body;

    // Validate original PO exists
    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po) {
      return res.status(404).json({ message: 'طلب الشراء الأصلي غير موجود' });
    }

    if (po.status !== 'received') {
      return res.status(400).json({ message: 'لا يمكن الإرجاع إلا من طلب مستلم' });
    }

    // Validate items exist in original PO
    const returnItemsPayload = [];
    let totalAmount = 0;

    for (const rItem of items) {
      const originalItem = po.items.find((i) => i.item.toString() === rItem.item);
      if (!originalItem) {
        return res.status(400).json({
          message: `الصنف ${rItem.item} غير موجود في طلب الشراء الأصلي`,
        });
      }

      const unitCost = originalItem.cost;
      const refundAmount = unitCost * rItem.qty;
      totalAmount += refundAmount;

      returnItemsPayload.push({
        item: rItem.item,
        qty: rItem.qty,
        unitCost,
        refundAmount,
        reason: rItem.reason || 'other',
      });
    }

    // Create DRAFT (no stock/supplier changes)
    const pr = await PurchaseReturn.create({
      originalPO: po._id,
      supplier: po.supplier,
      warehouse: warehouse || po.warehouse,
      items: returnItemsPayload,
      totalAmount,
      status: 'draft',
      isRefunded: false,
      note,
      createdBy: req.user?._id,
    });

    const populated = await PurchaseReturn.findById(pr._id)
      .populate('supplier', 'name code')
      .populate('warehouse', 'name')
      .populate('items.item', 'name sku');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Create Return Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// 8. Approve Purchase Return (Atomic Transaction)
export const approvePurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;

    const resultId = await runPostingTransaction(async (session) => {
      const pr = await PurchaseReturn.findById(id).session(session);
      if (!pr) throw new Error('Return not found');

      if (pr.status === 'returned') throw new Error('Return already posted');
      if (pr.status === 'rejected' || pr.status === 'reversed') throw new Error('Return cannot be posted');
      if (!['draft', 'pending_approval'].includes(pr.status)) throw new Error('Return must be draft or pending');

      const beforeState = pr.toObject();
      const warehouseId = pr.warehouse;
      const stockLedgerIds = [];

      // B. Process Each Item (Stock Deduction)
      for (const rItem of pr.items) {
        const product = await Item.findById(rItem.item).session(session);
        if (!product) {
          throw new Error(`Product not found: ${rItem.item}`);
        }

        const stockIdx = product.stocks?.findIndex((s) => s.warehouse.toString() === warehouseId.toString()) ?? -1;

        if (stockIdx === -1) {
          throw new Error(`Item not found in warehouse: ${product.name}`);
        }

        if (product.stocks[stockIdx].qty < rItem.qty) {
          throw new Error(`Insufficient stock for return: ${product.name}`);
        }

        product.stocks[stockIdx].qty -= rItem.qty;
        product.totalStock = Math.max(0, (product.totalStock || 0) - rItem.qty);
        await product.save({ session });

        const [ledgerDoc] = await StockLedger.create(
          [
            {
              item: product._id,
              warehouse: warehouseId,
              type: 'PURCHASE_RETURN',
              qty: -rItem.qty,
              ref: `RET#${pr._id.toString().slice(-6)}`,
              note: `Purchase return - ${rItem.reason || 'other'}`,
              user: req.user?._id,
              date: new Date(),
            },
          ],
          { session }
        );
        if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
      }

      // D. Update Supplier Balance (Reduce debt in both LYD and USD)
      const returnAmountUSD = pr.totalAmountUSD || (pr.exchangeRate > 0 ? Number((pr.totalAmount / pr.exchangeRate).toFixed(2)) : 0);
      await Supplier.findByIdAndUpdate(
        pr.supplier,
        {
          $inc: {
            balance: -pr.totalAmount,
            balanceUSD: -returnAmountUSD,
          },
        },
        { session }
      );

      // E. Double-Entry Journal Entry
      let journalEntryId = null;
      try {
        const inventoryAccount = await getInventoryAccount(session);
        const apAccount = await getAPAccount(session);

        if (inventoryAccount && apAccount) {
          const journalEntry = await postJournalEntry(
            {
              date: new Date(),
              referenceType: 'PURCHASE_RETURN',
              referenceId: pr._id.toString(),
              ref: `PRET-${pr.returnNumber || pr._id.toString().slice(-6)}`,
              note: `إرجاع مشتريات - مورد #${pr.supplier}`,
              lines: [
                {
                  accountId: apAccount._id,
                  debit: pr.totalAmount,
                  credit: 0,
                  memo: 'تخفيض ذمم الموردين (إرجاع مشتريات)',
                },
                {
                  accountId: inventoryAccount._id,
                  debit: 0,
                  credit: pr.totalAmount,
                  memo: 'تخفيض قيمة المخزون (إرجاع مشتريات)',
                },
              ],
              createdBy: req.user?._id || null,
            },
            { session, updateBalances: true }
          );
          journalEntryId = journalEntry?._id || null;
        }
      } catch (jeError) {
        logger.error(`Journal Entry Failed (Purchase Return): ${jeError.message}`);
        throw jeError;
      }

      // F. Update Return Status
      pr.status = 'returned';
      pr.approvedBy = req.user?._id;
      pr.approvedAt = new Date();
      await pr.save({ session });

      await auditUpdate('PURCHASE_RETURN', pr._id, beforeState, pr, req.user, req.ip, session, {
        action: 'POST',
        journalEntryId,
        stockLedgerIds,
      });

      return pr._id;
    });

    const populated = await PurchaseReturn.findById(resultId)
      .populate('supplier', 'name code')
      .populate('warehouse', 'name')
      .populate('approvedBy', 'name');

    res.status(200).json({
      message: 'Return posted successfully',
      return: populated,
    });
  } catch (error) {
    console.error('Approve Return Error:', error);
    res.status(400).json({ message: error.message });
  }
};

// 8.1 Void Purchase Return (Draft/Pending only)
export const voidPurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const resultId = await runPostingTransaction(async (session) => {
      const pr = await PurchaseReturn.findById(id).session(session);
      if (!pr) throw new Error('Return not found');

      if (!['draft', 'pending_approval'].includes(pr.status)) {
        throw new Error('Only draft or pending returns can be voided');
      }

      const beforeState = pr.toObject();
      pr.status = 'rejected';
      if (req.body?.note) {
        pr.note = (pr.note || '') + `\n[Void]: ${req.body.note}`;
      }
      await pr.save({ session });

      await auditUpdate('PURCHASE_RETURN', pr._id, beforeState, pr, req.user, req.ip, session, {
        action: 'VOID',
      });

      return pr._id;
    });

    const populated = await PurchaseReturn.findById(resultId)
      .populate('supplier', 'name code')
      .populate('warehouse', 'name')
      .populate('approvedBy', 'name');

    res.json({ message: 'Return voided', return: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 8.2 Reverse Purchase Return (Undo posted return)
export const reversePurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const resultId = await runPostingTransaction(async (session) => {
      const pr = await PurchaseReturn.findById(id).session(session);
      if (!pr) throw new Error('Return not found');

      if (pr.status !== 'returned') {
        throw new Error('Only returned purchase returns can be reversed');
      }

      if (pr.isRefunded) {
        throw new Error('Refunded returns cannot be reversed');
      }

      const beforeState = pr.toObject();
      const warehouseId = pr.warehouse;
      const stockLedgerIds = [];

      // Re-add stock
      for (const rItem of pr.items) {
        const product = await Item.findById(rItem.item).session(session);
        if (!product) throw new Error(`Product not found: ${rItem.item}`);

        if (!product.stocks) product.stocks = [];
        const stockIdx = product.stocks.findIndex((s) => s.warehouse.toString() === warehouseId.toString());

        if (stockIdx > -1) {
          product.stocks[stockIdx].qty += rItem.qty;
        } else {
          product.stocks.push({ warehouse: warehouseId, qty: rItem.qty });
        }

        product.totalStock = (product.totalStock || 0) + rItem.qty;
        await product.save({ session });

        const [ledgerDoc] = await StockLedger.create(
          [
            {
              item: product._id,
              warehouse: warehouseId,
              type: 'IN',
              qty: rItem.qty,
              ref: `RET-REV#${pr._id.toString().slice(-6)}`,
              note: 'Purchase return reversal',
              user: req.user?._id,
              date: new Date(),
            },
          ],
          { session }
        );
        if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
      }

      // Restore Supplier Balance (Both LYD and USD)
      const revAmountUSD = pr.totalAmountUSD || (pr.exchangeRate > 0 ? Number((pr.totalAmount / pr.exchangeRate).toFixed(2)) : 0);
      await Supplier.findByIdAndUpdate(
        pr.supplier,
        {
          $inc: {
            balance: pr.totalAmount,
            balanceUSD: revAmountUSD,
          },
        },
        { session }
      );

      // Reverse Journal Entry (Dr Inventory / Cr AP)
      let journalEntryId = null;
      try {
        const inventoryAccount = await getInventoryAccount(session);
        const apAccount = await getAPAccount(session);

        if (inventoryAccount && apAccount) {
          const journalEntry = await postJournalEntry(
            {
              date: new Date(),
              ref: `RET-REV#${pr._id.toString().slice(-6)}`,
              note: `إلغاء إرجاع مشتريات - مورد #${pr.supplier}`,
              referenceType: 'PURCHASE_RETURN_REVERSAL',
              referenceId: pr._id.toString(),
              createdBy: req.user?._id || null,
              lines: [
                { accountId: inventoryAccount._id, debit: pr.totalAmount, credit: 0, memo: 'إعادة إثبات المخزون (إلغاء إرجاع)' },
                { accountId: apAccount._id, debit: 0, credit: pr.totalAmount, memo: 'إعادة إثبات ذمم الموردين (إلغاء إرجاع)' },
              ],
            },
            { session, updateBalances: true }
          );
          journalEntryId = journalEntry?._id || null;
        }
      } catch (jeError) {
        logger.error(`Journal Entry Failed (Purchase Return Reverse): ${jeError.message}`);
        throw jeError;
      }

      pr.status = 'reversed';
      await pr.save({ session });

      await auditUpdate('PURCHASE_RETURN', pr._id, beforeState, pr, req.user, req.ip, session, {
        action: 'REVERSE',
        journalEntryId,
        stockLedgerIds,
      });

      return pr._id;
    });

    const populated = await PurchaseReturn.findById(resultId)
      .populate('supplier', 'name code')
      .populate('warehouse', 'name')
      .populate('approvedBy', 'name');

    res.json({ message: 'Return reversed', return: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 9. Update Return Status (Reject or other transitions)
export const updateReturnStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const pr = await PurchaseReturn.findById(id);
    if (!pr) {
      return res.status(404).json({ message: 'Return not found' });
    }

    if (status === 'returned') {
      return approvePurchaseReturn(req, res);
    }
    if (status === 'rejected') {
      if (rejectionReason) req.body.note = rejectionReason;
      return voidPurchaseReturn(req, res);
    }

    const validTransitions = {
      draft: ['pending_approval', 'rejected'],
      pending_approval: ['returned', 'rejected'],
      returned: [],
      rejected: ['draft'],
      reversed: [],
    };

    if (!validTransitions[pr.status] || !validTransitions[pr.status].includes(status)) {
      return res.status(400).json({ message: 'Invalid status transition' });
    }

    pr.status = status;
    if (status === 'rejected' && rejectionReason) {
      pr.note = (pr.note || '') + `\n[Reason]: ${rejectionReason}`;
    }
    await pr.save();

    res.json({ message: 'Status updated', return: pr });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 10. Mark Return as Refunded (Cash received back)
export const markReturnRefunded = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { treasuryId } = req.body;

    const pr = await PurchaseReturn.findById(id).session(session);
    if (!pr) throw new Error('مرتجع غير موجود');

    if (pr.status !== 'returned') {
      throw new Error('يجب أن يكون المرتجع في حالة "returned" للتحصيل');
    }

    if (pr.isRefunded) {
      throw new Error('تم تحصيل المبلغ مسبقاً');
    }

    // Credit Treasury & Journal Entry
    if (treasuryId) {
      const treasury = await Treasury.findById(treasuryId).session(session);
      if (!treasury) throw new Error('الخزينة غير موجودة');

      treasury.balance += pr.totalAmount;
      await treasury.save({ session });

      // Restore supplier balance (supplier gave cash, so their on-account debt reduction is cancelled out)
      await Supplier.findByIdAndUpdate(
        pr.supplier,
        { $inc: { balance: pr.totalAmount } },
        { session }
      );

      // Create Transaction
      await Transaction.create(
        [
          {
            type: 'income',
            flow: 'in',
            category: 'purchase_return_refund',
            amount: pr.totalAmount,
            treasury: treasuryId,
            relatedModel: 'PurchaseReturn',
            relatedId: pr._id,
            description: `استرداد نقدي لمرتجع مشتريات #${pr._id.toString().slice(-6)}`,
            date: new Date(),
          },
        ],
        { session }
      );

      // Post Journal Entry: Dr Treasury / Cr AP
      const apAcc = await getAPAccount(session);
      const treasuryAcc = await getTreasuryAccount(treasury, session);
      if (apAcc && treasuryAcc) {
        await postJournalEntry({
          date: new Date(),
          referenceType: 'PURCHASE_RETURN_REFUND',
          referenceId: pr._id,
          description: `استرداد نقدي لمرتجع مشتريات #${pr._id.toString().slice(-6)}`,
          lines: [
            { accountId: treasuryAcc._id, debit: pr.totalAmount, credit: 0, note: 'Cash refund received from supplier' },
            { accountId: apAcc._id, debit: 0, credit: pr.totalAmount, note: 'AP offset for cash refund' },
          ],
          userId: req.user?._id,
          createdBy: req.user?._id,
        }, { session });
      }
    }

    pr.isRefunded = true;
    await pr.save({ session });

    await session.commitTransaction();
    res.json({ message: 'تم تسجيل استرداد المبلغ بنجاح', return: pr });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// 11. Get Purchase Returns List
export const getPurchaseReturns = async (req, res) => {
  try {
    const { status, supplierId } = req.query;
    const filter = {};

    if (status && status !== 'all') filter.status = status;
    if (supplierId) filter.supplier = supplierId;

    applyFiscalDateFilter(req, filter, 'date');

    const returns = await PurchaseReturn.find(filter)
      .populate('supplier', 'name code')
      .populate('warehouse', 'name')
      .populate('originalPO', 'number totalAmount')
      .populate('items.item', 'name sku')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 12. Get Single Purchase Return
export const getPurchaseReturnById = async (req, res) => {
  try {
    const { id } = req.params;

    const pr = await PurchaseReturn.findById(id)
      .populate('supplier', 'name code phone')
      .populate('warehouse', 'name code')
      .populate('originalPO', 'number status totalAmount items')
      .populate('items.item', 'name sku barcode')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');

    if (!pr) {
      return res.status(404).json({ message: 'مرتجع غير موجود' });
    }

    res.json(pr);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 13. Get Single Purchase Order / Invoice
export const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const po = await PurchaseOrder.findById(id)
      .populate('supplier', 'name code phone balance balanceUSD')
      .populate('warehouse', 'name code')
      .populate('items.item', 'name sku barcode cost costUSD price stocks totalStock');

    if (!po) {
      return res.status(404).json({ message: 'فاتورة المشتريات غير موجودة' });
    }

    res.json(po);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 14. Update Purchase Invoice (Atomic with inventory and accounting reversal & re-posting)
export const updatePurchaseInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplier,
      items,
      warehouse,
      paymentMethod = 'credit',
      treasuryId,
      invoiceNumber,
      note,
      discount = 0,
      date,
      exchangeRate: clientRate,
      currency: invoiceCurrency = 'LYD',
    } = req.body;

    if (!supplier) throw new Error('المورد مطلوب');
    if (!warehouse) throw new Error('المستودع المستهدف مطلوب');
    if (!items || !items.length) throw new Error('يجب إضافة صنف واحد على الأقل');
    if (paymentMethod === 'cash' && !treasuryId) throw new Error('الخزينة مطلوبة للدفع النقدي');

    const resultId = await runPostingTransaction(async (session) => {
      const po = await PurchaseOrder.findById(id).session(session);
      if (!po) throw new Error('فاتورة المشتريات غير موجودة');

      const oldState = po.toObject();

      let exchangeRate = Number(clientRate);
      if (!exchangeRate || exchangeRate <= 0) {
        const CompanySettings = (await import('../models/CompanySettings.js')).default;
        const settings = await CompanySettings.findOne().session(session);
        exchangeRate = Number(settings?.usdExchangeRate) || 7.30;
      }

      // Process new items
      const processedItems = items.map((i) => {
        let costLYD = Number(i.cost || 0);
        let costUSD = Number(i.costUSD || 0);
        const itemCurrency = i.currency || invoiceCurrency || 'LYD';

        if (itemCurrency === 'USD' || (costUSD > 0 && costLYD <= 0)) {
          costLYD = Number((costUSD * exchangeRate).toFixed(2));
        } else if (costUSD <= 0 && costLYD > 0) {
          costUSD = exchangeRate > 0 ? Number((costLYD / exchangeRate).toFixed(2)) : 0;
        }

        return {
          item: i.item?._id || i.item,
          qty: Number(i.qty),
          cost: costLYD,
          costUSD: costUSD,
          currency: itemCurrency,
        };
      });

      const subtotalAmount = processedItems.reduce(
        (sum, i) => sum + Number(i.qty || 0) * Number(i.cost || 0),
        0
      );
      const safeDiscount = Math.max(0, Number(discount || 0));
      const totalAmount = Math.max(0, Number((subtotalAmount - safeDiscount).toFixed(2)));
      if (totalAmount <= 0) throw new Error('إجمالي الفاتورة بعد الخصم يجب أن يكون أكبر من صفر');
      const totalAmountUSD = exchangeRate > 0 ? Number((totalAmount / exchangeRate).toFixed(2)) : 0;

      const newSupplierDoc = await Supplier.findById(supplier).session(session);
      if (!newSupplierDoc) throw new Error('المورد المحدد غير موجود');

      // IF PO WAS RECEIVED, FULL REVERSAL & RE-APPLICATION NEEDED
      if (po.status === 'received') {
        const oldWarehouse = po.warehouse;

        // A. REVERSE OLD INVENTORY ADDITIONS & WEIGHTED AVERAGE COST (WAC)
        const oldExchangeRate = Number(po.exchangeRate) || exchangeRate || 1;
        for (const oldLine of po.items) {
          const oldProd = await Item.findById(oldLine.item).session(session);
          if (oldProd) {
            const oldLineQty = Number(oldLine.qty) || 0;
            const oldLineCost = Number(oldLine.cost) || 0;
            const oldLineCostUSD = Number(
              oldLine.costUSD || (oldExchangeRate > 0 ? (oldLineCost / oldExchangeRate).toFixed(2) : 0)
            );

            const currentTotalStock = Math.max(0, Number(oldProd.totalStock) || 0);
            const remainingStock = Math.max(0, currentTotalStock - oldLineQty);

            if (remainingStock > 0) {
              const reversedTotalVal =
                currentTotalStock * (Number(oldProd.cost) || 0) - oldLineQty * oldLineCost;
              const currentCostUSD =
                Number(oldProd.costUSD) ||
                (oldExchangeRate > 0 ? Number(((oldProd.cost || 0) / oldExchangeRate).toFixed(2)) : 0);
              const reversedTotalValUSD =
                currentTotalStock * currentCostUSD - oldLineQty * oldLineCostUSD;

              if (reversedTotalVal > 0) {
                oldProd.cost = Number((reversedTotalVal / remainingStock).toFixed(2));
              }
              if (reversedTotalValUSD > 0) {
                oldProd.costUSD = Number((reversedTotalValUSD / remainingStock).toFixed(2));
              }
            }

            if (oldProd.stocks && oldWarehouse) {
              const sIdx = oldProd.stocks.findIndex(
                (s) => s.warehouse.toString() === oldWarehouse.toString()
              );
              if (sIdx > -1) {
                oldProd.stocks[sIdx].qty = Math.max(0, oldProd.stocks[sIdx].qty - oldLineQty);
              }
            }
            oldProd.totalStock = remainingStock;
            await oldProd.save({ session });
          }
        }

        // Delete old StockLedger entries for this PO
        await StockLedger.deleteMany({ ref: `PO#${po.number || po._id}` }).session(session);

        // B. REVERSE OLD FINANCIALS
        if (po.paymentMethod === 'cash') {
          // Find and revert cash transaction
          const oldTx = await Transaction.findOne({
            relatedModel: 'PurchaseOrder',
            relatedId: po._id,
          }).session(session);

          if (oldTx && oldTx.treasury) {
            const oldTreasury = await Treasury.findById(oldTx.treasury).session(session);
            if (oldTreasury) {
              oldTreasury.balance += oldTx.amount || po.totalAmount;
              await oldTreasury.save({ session });
            }
            await Transaction.findByIdAndDelete(oldTx._id).session(session);
          }
        } else {
          // Revert old credit balance from old supplier (preserve debit/advance balances if negative)
          const oldSupplier = await Supplier.findById(po.supplier).session(session);
          if (oldSupplier) {
            oldSupplier.balance = Number(
              ((oldSupplier.balance || 0) - (po.totalAmount || 0)).toFixed(2)
            );
            oldSupplier.balanceUSD = Number(
              ((oldSupplier.balanceUSD || 0) - (po.totalAmountUSD || 0)).toFixed(2)
            );
            await oldSupplier.save({ session });
          }
        }

        // Reverse old Journal Entry & restore Account.balance before replacing
        await reverseJournalEntriesByReference(
          {
            $or: [
              { referenceType: 'PURCHASE', referenceId: po._id.toString() },
              { referenceType: 'PURCHASE', referenceId: po._id },
            ],
          },
          session,
          {
            deleteEntries: true,
            userId: req.user?._id,
            reason: `تعديل فاتورة مشتريات #${po.number || po._id}`,
          }
        );

        // C. APPLY NEW INVENTORY ADDITIONS
        const stockLedgerIds = [];
        const effectiveDate = date ? new Date(date) : po.receivedAt || new Date();

        for (const newLine of processedItems) {
          const product = await Item.findById(newLine.item).session(session);
          if (!product) throw new Error(`الصنف غير موجود: ${newLine.item}`);

          const currentTotalQty = Math.max(0, product.totalStock || 0);
          const currentCost = product.cost || 0;
          const currentCostUSD =
            product.costUSD ||
            (exchangeRate > 0 ? Number((currentCost / exchangeRate).toFixed(2)) : 0);
          const newQty = Number(newLine.qty);
          const newCost = Number(newLine.cost);
          const newCostUSD = Number(
            newLine.costUSD || (exchangeRate > 0 ? (newCost / exchangeRate).toFixed(2) : 0)
          );

          const totalValue = currentTotalQty * currentCost + newQty * newCost;
          const totalValueUSD = currentTotalQty * currentCostUSD + newQty * newCostUSD;
          const totalQty = currentTotalQty + newQty;

          const weightedAvgCost = totalQty > 0 ? totalValue / totalQty : newCost;
          const weightedAvgCostUSD = totalQty > 0 ? totalValueUSD / totalQty : newCostUSD;

          if (!product.stocks) product.stocks = [];
          const stockIndex = product.stocks.findIndex(
            (s) => s.warehouse.toString() === warehouse.toString()
          );

          if (stockIndex > -1) {
            product.stocks[stockIndex].qty += newQty;
          } else {
            product.stocks.push({ warehouse, qty: newQty });
          }

          product.cost = Number(weightedAvgCost.toFixed(2));
          product.costUSD = Number(weightedAvgCostUSD.toFixed(2));
          product.totalStock = (product.totalStock || 0) + newQty;
          await product.save({ session });

          const [ledgerDoc] = await StockLedger.create(
            [
              {
                item: product._id,
                warehouse,
                type: 'IN',
                qty: newQty,
                ref: `PO#${invoiceNumber || po.number || po._id}`,
                note: `تعديل شراء - ${invoiceNumber || po.number || ''}`,
                user: req.user?._id,
                date: effectiveDate,
              },
            ],
            { session }
          );
          if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
        }

        // D. APPLY NEW FINANCIALS
        const invAcc = await getInventoryAccount(session);
        const apAcc = await getAPAccount(session);
        let journalEntryId = null;

        if (paymentMethod === 'cash') {
          const treasury = await Treasury.findById(treasuryId).session(session);
          if (!treasury) throw new Error('الخزينة المحددة غير موجودة');
          if (treasury.balance < totalAmount) {
            throw new Error(`رصيد الخزينة (${treasury.balance}) لا يكفي لسداد (${totalAmount})`);
          }

          treasury.balance -= totalAmount;
          await treasury.save({ session });

          await Transaction.create(
            [
              {
                type: 'expense',
                flow: 'out',
                category: 'purchase_payment',
                amount: totalAmount,
                treasury: treasuryId,
                relatedModel: 'PurchaseOrder',
                relatedId: po._id,
                description: `سداد فاتورة مشتريات معدلة #${po.number} للمورد: ${newSupplierDoc.name}`,
                date: effectiveDate,
              },
            ],
            { session }
          );

          const treasuryAcc = await getTreasuryAccount(treasury, session);
          if (invAcc && treasuryAcc) {
            const je = await postJournalEntry(
              {
                date: effectiveDate,
                referenceType: 'PURCHASE',
                referenceId: po._id,
                description: `فاتورة شراء نقدية معدلة #${po.number} - ${newSupplierDoc.name}`,
                lines: [
                  { accountId: invAcc._id, debit: totalAmount, credit: 0, note: 'Inventory received (Cash - Edited)' },
                  { accountId: treasuryAcc._id, debit: 0, credit: totalAmount, note: `Treasury paid (${treasury.name})` },
                ],
                userId: req.user?._id,
                createdBy: req.user?._id,
              },
              { session }
            );
            journalEntryId = je?._id || null;
          }
        } else {
          newSupplierDoc.balance = (newSupplierDoc.balance || 0) + totalAmount;
          newSupplierDoc.balanceUSD = Number(
            ((newSupplierDoc.balanceUSD || 0) + totalAmountUSD).toFixed(2)
          );
          await newSupplierDoc.save({ session });

          if (invAcc && apAcc) {
            const je = await postJournalEntry(
              {
                date: effectiveDate,
                referenceType: 'PURCHASE',
                referenceId: po._id,
                description: `فاتورة شراء آجلة معدلة #${po.number} - ${newSupplierDoc.name}`,
                lines: [
                  { accountId: invAcc._id, debit: totalAmount, credit: 0, note: 'Inventory received (Edited)' },
                  { accountId: apAcc._id, debit: 0, credit: totalAmount, note: 'AP accrued (Edited)' },
                ],
                userId: req.user?._id,
                createdBy: req.user?._id,
              },
              { session }
            );
            journalEntryId = je?._id || null;
          }
        }
      }

      // UPDATE PURCHASE ORDER RECORD
      if (invoiceNumber && invoiceNumber.trim()) {
        po.number = invoiceNumber.trim();
      }
      po.supplier = supplier;
      po.warehouse = warehouse;
      po.items = processedItems;
      po.paymentMethod = paymentMethod;
      po.discount = safeDiscount;
      po.currency = invoiceCurrency;
      po.exchangeRate = exchangeRate;
      po.totalAmount = totalAmount;
      po.totalAmountUSD = totalAmountUSD;
      po.paidAmount = paymentMethod === 'cash' ? totalAmount : 0;
      po.paidAmountUSD = paymentMethod === 'cash' ? totalAmountUSD : 0;
      po.note = note || '';
      if (date) po.receivedAt = new Date(date);

      await po.save({ session });

      await auditUpdate('PURCHASE_ORDER', po._id, oldState, po.toObject(), req.user, req.ip, session, {
        action: 'UPDATE',
      });

      return po._id;
    });

    const populated = await PurchaseOrder.findById(resultId)
      .populate('supplier', 'name code phone balance')
      .populate('warehouse', 'name code')
      .populate('items.item', 'name sku barcode cost price');

    res.json({
      message: 'تم تعديل وتحديث فاتورة المشتريات بنجاح',
      invoice: populated,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
