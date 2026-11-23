import SalesReturn from '../models/SalesReturn.js';
import SalesInvoice from '../models/SalesInvoice.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import StockLedger from '../models/StockLedger.js';
import Account from '../models/Account.js';
import { postJournalEntry } from '../services/journalEntryService.js';
import { generateCreditNotePdfHtml, generatePdfFromHtml } from '../services/pdfService.js';
import logger from '../config/logger.js';
import { auditUpdate } from '../services/auditService.js';
import { runPostingTransaction } from '../services/postingService.js';
import { deductStockBulk } from '../services/stockService.js';
import { createExpenseTransaction } from '../services/transactionService.js';
import { preparePhysicalRestorations, preparePhysicalDeductions } from '../services/bundleService.js';
import { getSystemAccount } from '../services/systemAccountsService.js';
import { applyFiscalDateFilter } from '../middleware/fiscalPeriod.js';

// Helper: Logic to approve a return
const executeApproveReturn = async (returnId, user, ip) => {
  return await runPostingTransaction(async (session) => {
    const sr = await SalesReturn.findById(returnId).session(session);
    if (!sr) throw new Error('Return not found');

    if (sr.status === 'returned') throw new Error('Return already posted');
    if (sr.status === 'rejected' || sr.status === 'reversed') throw new Error('Return cannot be posted');
    if (!['draft', 'pending_approval'].includes(sr.status)) throw new Error('Return must be draft or pending');

    const beforeState = sr.toObject();
    const warehouseId = sr.warehouse;
    const stockLedgerIds = [];

    // B. Process Items & Bundle Components (Physical Stock Restoration)
    const itemIds = [];
    for (const rItem of sr.items) {
      if (rItem.item) itemIds.push(rItem.item);
      if (rItem.bundleComponents && rItem.bundleComponents.length) {
        for (const c of rItem.bundleComponents) {
          if (c.item) itemIds.push(c.item);
        }
      }
    }
    const itemDocs = await Item.find({ _id: { $in: itemIds } }).session(session);
    const docMap = new Map(itemDocs.map((d) => [d._id.toString(), d]));

    const returnRef = `RET-SALE#${sr._id.toString().slice(-6)}`;
    const returnNum = sr.returnNumber || sr._id.toString().slice(-6);

    const { restorationItems, ledgerEntries } = preparePhysicalRestorations(
      sr.items,
      docMap,
      warehouseId,
      returnRef,
      returnNum,
      sr.date || new Date()
    );

    // Apply physical restorations to warehouse stock & totalStock
    for (const resItem of restorationItems) {
      const product = docMap.get(resItem.item.toString()) || await Item.findById(resItem.item).session(session);
      if (!product) continue;

      if (!product.stocks) product.stocks = [];
      const stockIdx = product.stocks.findIndex((s) => s.warehouse.toString() === warehouseId.toString());

      if (stockIdx > -1) {
        product.stocks[stockIdx].qty += resItem.qty;
      } else {
        product.stocks.push({ warehouse: warehouseId, qty: resItem.qty });
      }

      product.totalStock += resItem.qty;
      await product.save({ session });
    }

    // Insert ledger entries with user tracking
    for (const entry of ledgerEntries) {
      entry.user = user?._id || user?.id;
      const [ledgerDoc] = await StockLedger.create([entry], { session });
      if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
    }

    // D. Update Customer Balance
    // ONLY if it is NOT a cash/bank refund. If cash or bank refund, customer balance is untouched (Direct payout).
    // If it's "credit" (On Account), we decrease customer balance (Credit Customer).
    if (sr.customer && !['cash', 'bank'].includes(sr.refundMethod)) {
      const CompanySettings = (await import('../models/CompanySettings.js')).default;
      const settings = await CompanySettings.findOne().session(session);
      const usdRate = Number(settings?.usdExchangeRate) || 7.30;
      const refundUSD = usdRate > 0 ? Number((sr.totalAmount / usdRate).toFixed(2)) : 0;

      await Customer.findByIdAndUpdate(
        sr.customer,
        {
          $inc: {
            balance: -sr.totalAmount,
            balanceUSD: -refundUSD,
          },
        },
        { session }
      );
    }

    // E. Update Original Invoice (Record Return) if present
    if (sr.originalInvoice) {
      const returnRecords = sr.items.map((item) => ({
        item: item.item,
        qty: item.qty,
        date: new Date(),
        note: `Return #${sr._id.toString().slice(-6)}`,
        returnId: sr._id,
      }));

      await SalesInvoice.findByIdAndUpdate(
        sr.originalInvoice,
        {
          $push: { returns: { $each: returnRecords } },
        },
        { session }
      );

      // E.2 Update Invoice Status (Partial vs Full Return)
      const freshInvoice = await SalesInvoice.findById(sr.originalInvoice).session(session);
      if (freshInvoice) {
        let totalOriginalQty = 0;
        let totalReturnedQty = 0;

        // Calculate totals
        freshInvoice.items.forEach(item => {
          totalOriginalQty += item.qty;
        });

        if (freshInvoice.returns && freshInvoice.returns.length > 0) {
          freshInvoice.returns.forEach(ret => {
            totalReturnedQty += ret.qty;
          });
        }

        // Determine status
        // Tolerance for floating point (if any)
        const isFullyReturned = totalReturnedQty >= (totalOriginalQty - 0.001);
        const isPartial = totalReturnedQty > 0 && !isFullyReturned;

        if (isFullyReturned) {
          freshInvoice.status = 'returned';
        } else if (isPartial) {
          freshInvoice.status = 'partially_returned';
        }
        // if neither (0 returns), keep original status (posted)

        await freshInvoice.save({ session });
      }
    }

    // F. Double-Entry Journal Entry
    let journalEntryId = null;
    try {
      const [salesReturnAcc, arAcc, cashAcc, bankAcc, walletAcc, invAcc, cogsAcc] = await Promise.all([
        getSystemAccount('SALES_RETURNS', session),
        getSystemAccount('AR', session),
        getSystemAccount('CASH', session),
        getSystemAccount('BANK', session),
        getSystemAccount('CUSTOMER_WALLET', session),
        getSystemAccount('INVENTORY', session),
        getSystemAccount('COGS', session),
      ]);

      const customerName = sr.customer ? `عميل #${sr.customer}` : 'عميل نقدي';
      const isDirectPayout = ['cash', 'bank'].includes(sr.refundMethod);

      // Determine Credit Account (AR, Cash, Bank, or Wallet)
      let creditAccount = arAcc;
      let creditMemo = `تخفيض ذمم العملاء - ${customerName}`;

      if (isDirectPayout && sr.treasury) {
        const Treasury = (await import('../models/Treasury.js')).default;
        const treasuryDoc = await Treasury.findById(sr.treasury).session(session);
        const linkedAccountId = treasuryDoc?.account || treasuryDoc?.accountId || null;

        if (linkedAccountId) {
          creditAccount = { _id: linkedAccountId };
        } else {
          creditAccount = (treasuryDoc?.type === 'bank' || sr.refundMethod === 'bank') ? bankAcc : cashAcc;
        }
        creditMemo = `صرف استرداد (${sr.refundMethod === 'bank' ? 'بنكي' : 'نقدي'}) - خزينة ${treasuryDoc?.name || ''}`.trim();
      } else if (sr.refundMethod === 'bank') {
        creditAccount = bankAcc;
        creditMemo = `استرداد بنكي - ${customerName}`;
      } else if (sr.refundMethod === 'wallet') {
        creditAccount = walletAcc;
        creditMemo = `إيداع في محفظة العميل - ${customerName}`;
      }

      // Calculate total cost of returned items for perpetual inventory reversal
      let returnTotalCost = 0;
      for (const resItem of restorationItems) {
        const product = docMap.get(resItem.item.toString());
        const unitCost = Number(product?.cost || 0);
        returnTotalCost += unitCost * Number(resItem.qty || 0);
      }
      returnTotalCost = Number(returnTotalCost.toFixed(2));

      const lines = [
        // 1. Debit Sales Returns (Revenue reduction)
        {
          accountId: salesReturnAcc._id,
          debit: sr.totalAmount,
          credit: 0,
          memo: `مردودات مبيعات - ${customerName}`,
        },
        // 2. Credit Refund Account (AR / Cash / Bank / Wallet)
        {
          accountId: creditAccount._id,
          debit: 0,
          credit: sr.totalAmount,
          memo: creditMemo,
        },
      ];

      // 3 & 4. Perpetual Inventory Reversal (Debit Inventory, Credit COGS)
      if (returnTotalCost > 0 && invAcc && cogsAcc) {
        lines.push({
          accountId: invAcc._id,
          debit: returnTotalCost,
          credit: 0,
          memo: `استعادة مخزون بضاعة مردودة - إرجاع ${returnNum}`,
        });
        lines.push({
          accountId: cogsAcc._id,
          debit: 0,
          credit: returnTotalCost,
          memo: `تخفيض تكلفة البضاعة المباعة - إرجاع ${returnNum}`,
        });
      }

      const journalEntry = await postJournalEntry(
        {
          date: sr.date || new Date(),
          referenceType: 'SALES_RETURN',
          referenceId: sr._id.toString(),
          ref: `RET-${returnNum}`,
          note: `قيد مردودات مبيعات - ${customerName}`,
          lines,
          createdBy: user?._id || null,
        },
        { session, updateBalances: true }
      );
      journalEntryId = journalEntry?._id || null;
    } catch (jeError) {
      logger.error(`Journal Entry Failed (Sales Return): ${jeError.message}`);
      throw jeError;
    }


    // G. Update Return Status
    sr.status = 'returned';
    sr.approvedBy = user?._id;
    sr.approvedAt = new Date();
    await sr.save({ session });

    await auditUpdate('SALES_RETURN', sr._id, beforeState, sr, user, ip, session, {
      action: 'POST',
      journalEntryId,
      stockLedgerIds,
    });

    // H. Create Cash/Bank Transaction (If Direct Payout)
    if (['cash', 'bank'].includes(sr.refundMethod) && sr.treasury) {
      await createExpenseTransaction({
        amount: sr.totalAmount,
        treasury: sr.treasury,
        relatedId: sr._id,
        relatedModel: 'SalesReturn',
        description: `Refund for Return #${sr._id.toString().slice(-6)} (${sr.refundMethod === 'bank' ? 'Bank' : 'Cash'})`,
        category: 'sales_return',
        date: new Date()
      }, session);
    }

    return sr._id;
  });
};

// 1. Create Sales Return DRAFT
export const createSalesReturn = async (req, res) => {
  try {
    const { invoiceId, items, note, warehouse, autoApprove, refundMethod, treasury, customer } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: 'يرجى إضافة أصناف للإرجاع' });
    }

    const returnItemsPayload = [];
    let totalAmount = 0;
    let targetCustomer = customer || null;
    let targetWarehouse = warehouse;

    if (invoiceId) {
      // Validate Invoice
      const invoice = await SalesInvoice.findById(invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: 'الفاتورة الأصلية غير موجودة' });
      }

      if (invoice.status !== 'confirmed' && invoice.status !== 'posted') {
        return res.status(400).json({ message: 'لا يمكن الإرجاع إلا من فاتورة مؤكدة' });
      }

      targetCustomer = invoice.customer || targetCustomer;
      targetWarehouse = warehouse || invoice.warehouse;

      for (const rItem of items) {
        const itemIdStr = (rItem.item?._id || rItem.item || rItem.id)?.toString();
        // Look for exact item line OR component of a bundle in the original invoice
        let originalItem = invoice.items.find((i) => (i.item?._id || i.item)?.toString() === itemIdStr);
        let isBundleComp = false;
        let compSoldQty = 0;

        if (!originalItem) {
          // Check if it's a single component from an invoice bundle
          for (const invItem of invoice.items) {
            if (invItem.bundleComponents && invItem.bundleComponents.length) {
              const compMatch = invItem.bundleComponents.find(
                (c) => (c.item?._id || c.item)?.toString() === itemIdStr
              );
              if (compMatch) {
                originalItem = invItem;
                isBundleComp = true;
                compSoldQty = Number(invItem.qty || 1) * Number(compMatch.qty || 1);
                break;
              }
            }
          }
        }

        if (!originalItem) {
          return res.status(400).json({
            message: `الصنف غير موجود في الفاتورة الأصلية`,
          });
        }

        // Calculate previously returned quantity
        const prevReturnedQty = invoice.returns
          ? invoice.returns.filter((r) => (r.item?._id || r.item)?.toString() === itemIdStr).reduce((sum, r) => sum + r.qty, 0)
          : 0;

        const maxAvailableQty = isBundleComp ? compSoldQty : originalItem.qty;
        const remainingQty = maxAvailableQty - prevReturnedQty;

        if (rItem.qty > remainingQty) {
          return res.status(400).json({
            message: `الكمية المرجعة (${rItem.qty}) أكبر من الكمية المتبقية القابلة للإرجاع (${remainingQty}) للصنف`,
          });
        }

        const unitPrice = rItem.unitPrice !== undefined ? Number(rItem.unitPrice) : originalItem.price;
        const refundAmount = unitPrice * Number(rItem.qty);
        totalAmount += refundAmount;

        returnItemsPayload.push({
          item: rItem.item?._id || rItem.item || rItem.id,
          name: rItem.name || originalItem.name,
          qty: Number(rItem.qty),
          unitPrice,
          refundAmount,
          reason: rItem.reason || 'other',
          isBundle: Boolean(rItem.isBundle || (!isBundleComp && originalItem.isBundle)),
          bundleComponents: rItem.bundleComponents || (!isBundleComp ? originalItem.bundleComponents : []),
          parentBundle: rItem.parentBundle || (isBundleComp ? originalItem.item : null),
          serials: rItem.serials || [],
        });
      }
    } else {
      // Direct POS Return without prior invoice
      if (!targetWarehouse) {
        return res.status(400).json({ message: 'يرجى تحديد المخزن لاستلام البضاعة المرجعة' });
      }

      for (const rItem of items) {
        const itemId = rItem.item?._id || rItem.item || rItem.id;
        const product = await Item.findById(itemId);
        if (!product) {
          return res.status(404).json({ message: `الصنف غير موجود في النظام: ${itemId}` });
        }

        const unitPrice = Number(rItem.unitPrice ?? rItem.price ?? product.price ?? 0);
        const qty = Number(rItem.qty) || 1;
        const refundAmount = unitPrice * qty;
        totalAmount += refundAmount;

        returnItemsPayload.push({
          item: product._id,
          name: rItem.name || product.name,
          qty,
          unitPrice,
          refundAmount,
          reason: ['damaged', 'expired', 'wrong_item', 'customer_preference', 'customer_return', 'other'].includes(rItem.reason)
            ? rItem.reason
            : 'other',
          isBundle: Boolean(rItem.isBundle || product.isBundle),
          bundleComponents: rItem.bundleComponents || product.bundleComponents || [],
          parentBundle: rItem.parentBundle || null,
          serials: rItem.serials || [],
        });
      }
    }

    // Create DRAFT or POSTED Return
    const sr = await SalesReturn.create({
      originalInvoice: invoiceId || null,
      customer: targetCustomer,
      warehouse: targetWarehouse,
      items: returnItemsPayload,
      totalAmount,
      status: 'draft',
      // Store Refund method
      refundMethod: refundMethod || 'credit',
      treasury: treasury || null,
      isRefunded: ['cash', 'bank'].includes(refundMethod), // Mark as refunded immediately if cash or bank
      note,
      createdBy: req.user?._id,
    });

    // If auto-approve is requested (and maybe check permissions here if needed)
    if (autoApprove) {
      // Execute the approval logic immediately
      await executeApproveReturn(sr._id, req.user, req.ip);

      // Re-fetch the updated return
      const fullyApproved = await SalesReturn.findById(sr._id)
        .populate('customer', 'name phone')
        .populate('warehouse', 'name')
        .populate('items.item', 'name sku')
        .populate('approvedBy', 'name'); // Populate approver info

      return res.status(201).json(fullyApproved);
    }

    const populated = await SalesReturn.findById(sr._id)
      .populate('customer', 'name phone')
      .populate('warehouse', 'name')
      .populate('items.item', 'name sku');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Create Sales Return Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// 2. Approve Sales Return (Atomic Transaction)
export const approveSalesReturn = async (req, res) => {
  try {
    const { id } = req.params;

    const resultId = await executeApproveReturn(id, req.user, req.ip);

    const populated = await SalesReturn.findById(resultId)
      .populate('customer', 'name')
      .populate('warehouse', 'name')
      .populate('approvedBy', 'name');

    res.status(200).json({
      message: 'Return posted successfully',
      return: populated,
    });
  } catch (error) {
    console.error('Approve Sales Return Error:', error);
    res.status(400).json({ message: error.message });
  }
};

// 2.1 Void Sales Return (Draft/Pending only)
export const voidSalesReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const resultId = await runPostingTransaction(async (session) => {
      const sr = await SalesReturn.findById(id).session(session);
      if (!sr) throw new Error('Return not found');

      if (!['draft', 'pending_approval'].includes(sr.status)) {
        throw new Error('Only draft or pending returns can be voided');
      }

      const beforeState = sr.toObject();
      sr.status = 'rejected';
      if (req.body?.note) {
        sr.note = (sr.note || '') + `\n[Void]: ${req.body.note}`;
      }
      await sr.save({ session });

      await auditUpdate('SALES_RETURN', sr._id, beforeState, sr, req.user, req.ip, session, {
        action: 'VOID',
      });

      return sr._id;
    });

    const populated = await SalesReturn.findById(resultId)
      .populate('customer', 'name')
      .populate('warehouse', 'name')
      .populate('approvedBy', 'name');

    res.json({ message: 'Return voided', return: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 2.2 Reverse Sales Return (Undo posted return)
export const reverseSalesReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const resultId = await runPostingTransaction(async (session) => {
      const sr = await SalesReturn.findById(id).session(session);
      if (!sr) throw new Error('Return not found');

      if (sr.status !== 'returned') {
        throw new Error('Only returned sales returns can be reversed');
      }

      if (sr.isRefunded) {
        throw new Error('Refunded returns cannot be reversed');
      }

      const beforeState = sr.toObject();
      const warehouseId = sr.warehouse;
      const stockLedgerIds = [];

      // Fetch item & bundle component docs for physical deduction and cost calculation
      const itemIds = [];
      for (const rItem of sr.items) {
        if (rItem.item) itemIds.push(rItem.item);
        if (rItem.bundleComponents && rItem.bundleComponents.length) {
          for (const c of rItem.bundleComponents) {
            if (c.item) itemIds.push(c.item);
          }
        }
      }
      const itemDocs = await Item.find({ _id: { $in: itemIds } }).session(session);
      const docMap = new Map(itemDocs.map((d) => [d._id.toString(), d]));

      const returnRevRef = `RET-SALE-REV#${sr._id.toString().slice(-6)}`;
      const returnNum = sr.returnNumber || sr._id.toString().slice(-6);

      const { deductionItems, ledgerEntries } = preparePhysicalDeductions(
        sr.items,
        docMap,
        warehouseId,
        returnRevRef,
        returnNum,
        new Date()
      );

      await deductStockBulk(deductionItems, warehouseId, session);

      const ledgerDocs = await StockLedger.insertMany(
        ledgerEntries.map((entry) => ({
          ...entry,
          note: `عكس مرتجع مبيعات ${returnNum}`,
          user: req.user?._id,
        })),
        { session }
      );

      ledgerDocs.forEach((doc) => {
        if (doc?._id) stockLedgerIds.push(doc._id);
      });

      // ===== RESTORE CUSTOMER BALANCE =====
      // Only restore balance if the original return was a credit (on-account) refund.
      // Cash and bank refunds never touched customer.balance, so reversing them should not either.
      if (sr.customer && sr.refundMethod === 'credit') {
        const CompanySettings = (await import('../models/CompanySettings.js')).default;
        const settings = await CompanySettings.findOne().session(session);
        const usdRate = Number(settings?.usdExchangeRate) || 7.30;
        const refundUSD = usdRate > 0 ? Number((sr.totalAmount / usdRate).toFixed(2)) : 0;

        await Customer.findByIdAndUpdate(
          sr.customer,
          {
            $inc: {
              balance: sr.totalAmount, // Re-add the debt (the credit note is cancelled)
              balanceUSD: refundUSD,
            },
          },
          { session }
        );
      }

      const invoice = await SalesInvoice.findById(sr.originalInvoice).session(session);
      if (invoice) {
        const retId = sr._id.toString();
        const shortId = retId.slice(-6);
        invoice.returns = (invoice.returns || []).filter((r) => {
          if (r.returnId && r.returnId.toString() === retId) return false;
          const note = r.note || '';
          if (note.includes(shortId) && note.includes('Return #')) return false;
          return true;
        });
        await invoice.save({ session });

        // Re-calculate status after reversal
        const freshInvoiceRev = await SalesInvoice.findById(sr.originalInvoice).session(session);
        if (freshInvoiceRev) {
          let totalOriginalQty = 0;
          let totalReturnedQty = 0;

          freshInvoiceRev.items.forEach(item => {
            totalOriginalQty += item.qty;
          });

          if (freshInvoiceRev.returns && freshInvoiceRev.returns.length > 0) {
            freshInvoiceRev.returns.forEach(ret => {
              totalReturnedQty += ret.qty;
            });
          }

          if (totalReturnedQty <= 0.001) {
            freshInvoiceRev.status = 'posted'; // Revert to posted if no returns left
          } else if (totalReturnedQty >= (totalOriginalQty - 0.001)) {
            freshInvoiceRev.status = 'returned';
          } else {
            freshInvoiceRev.status = 'partially_returned';
          }
          await freshInvoiceRev.save({ session });
        }
      }

      let journalEntryId = null;
      try {
        const [salesReturnAcc, arAcc, invAcc, cogsAcc] = await Promise.all([
          getSystemAccount('SALES_RETURNS', session),
          getSystemAccount('AR', session),
          getSystemAccount('INVENTORY', session),
          getSystemAccount('COGS', session),
        ]);

        if (salesReturnAcc && arAcc) {
          const customerName = sr.customer ? `عميل #${sr.customer}` : 'عميل نقدي';

          // Calculate total cost of reversed return items for perpetual inventory
          let reversalTotalCost = 0;
          for (const dedItem of deductionItems) {
            const product = docMap.get(dedItem.item.toString());
            const unitCost = Number(product?.cost || 0);
            reversalTotalCost += unitCost * Number(dedItem.qty || 0);
          }
          reversalTotalCost = Number(reversalTotalCost.toFixed(2));

          const lines = [
            {
              accountId: arAcc._id,
              debit: sr.totalAmount,
              credit: 0,
              memo: `عكس مردودات مبيعات - ${customerName}`,
            },
            {
              accountId: salesReturnAcc._id,
              debit: 0,
              credit: sr.totalAmount,
              memo: `إلغاء مردودات مبيعات - ${customerName}`,
            },
          ];

          if (reversalTotalCost > 0 && cogsAcc && invAcc) {
            lines.push({
              accountId: cogsAcc._id,
              debit: reversalTotalCost,
              credit: 0,
              memo: `إعادة إثبات تكلفة البضاعة المباعة - عكس إرجاع ${returnNum}`,
            });
            lines.push({
              accountId: invAcc._id,
              debit: 0,
              credit: reversalTotalCost,
              memo: `خصم مخزون بضاعة مردودة ملغاة - عكس إرجاع ${returnNum}`,
            });
          }

          const journalEntry = await postJournalEntry(
            {
              date: new Date(),
              referenceType: 'SALES_RETURN_REVERSAL',
              referenceId: sr._id.toString(),
              ref: `REV-RET-${returnNum}`,
              note: `قيد عكس مردودات مبيعات - ${customerName}`,
              lines,
              userId: req.user?._id,
              createdBy: req.user?._id,
            },
            { session, updateBalances: true }
          );
          journalEntryId = journalEntry?._id || null;
        } else {
          throw new Error('حساب مردودات المبيعات (4020) أو ذمم العملاء (1030) غير موجود');
        }
      } catch (jeError) {
        logger.error(`Journal Entry Failed (Sales Return Reverse): ${jeError.message}`);
        throw jeError;
      }

      sr.status = 'reversed';
      await sr.save({ session });

      await auditUpdate('SALES_RETURN', sr._id, beforeState, sr, req.user, req.ip, session, {
        action: 'REVERSE',
        journalEntryId,
        stockLedgerIds,
      });

      return sr._id;
    });

    const populated = await SalesReturn.findById(resultId)
      .populate('customer', 'name')
      .populate('warehouse', 'name')
      .populate('approvedBy', 'name');

    res.json({ message: 'Return reversed', return: populated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 3. Update Status (Reject)
export const updateReturnStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const sr = await SalesReturn.findById(id);
    if (!sr) return res.status(404).json({ message: 'Not found' });

    if (status === 'returned') {
      return approveSalesReturn(req, res);
    }
    if (status === 'rejected') {
      if (rejectionReason) req.body.note = rejectionReason;
      return voidSalesReturn(req, res);
    }

    const validTransitions = {
      draft: ['pending_approval', 'rejected'],
      pending_approval: ['rejected', 'returned'],
      rejected: ['draft'],
      returned: [],
      reversed: [],
    };

    if (!validTransitions[sr.status] || !validTransitions[sr.status].includes(status)) {
      return res.status(400).json({ message: 'Invalid status transition' });
    }

    sr.status = status;
    if (status === 'rejected' && rejectionReason) {
      sr.note = (sr.note || '') + `\n[Reason]: ${rejectionReason}`;
    }
    await sr.save();
    res.json({ message: 'Status updated', return: sr });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Get List
export const getSalesReturns = async (req, res) => {
  try {
    const { status, customerId } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (customerId) filter.customer = customerId;

    applyFiscalDateFilter(req, filter, 'date');

    const returns = await SalesReturn.find(filter)
      .populate('customer', 'name code')
      .populate('originalInvoice', 'number')
      .populate('warehouse', 'name')
      .populate('items.item', 'name sku')
      .sort({ createdAt: -1 });

    res.json(returns);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Get Single
export const getSalesReturnById = async (req, res) => {
  try {
    const { id } = req.params;
    const sr = await SalesReturn.findById(id)
      .populate('customer')
      .populate('originalInvoice')
      .populate('warehouse')
      .populate('items.item')
      .populate('approvedBy', 'name');

    if (!sr) return res.status(404).json({ message: 'Not found' });
    res.json(sr);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 6. Generate Credit Note PDF
export const getCreditNotePdf = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`[PDF] Generating Credit Note for Sales Return: ${id}`);

    // Fetch fully populated sales return
    const sr = await SalesReturn.findById(id)
      .populate('customer', 'name phone code')
      .populate('originalInvoice', 'number date')
      .populate('warehouse', 'name')
      .populate('items.item', 'name sku')
      .populate('approvedBy', 'name');

    if (!sr) {
      return res.status(404).json({ message: 'مرتجع المبيعات غير موجود' });
    }

    // Optional: Only allow PDF for approved returns
    if (sr.status !== 'returned') {
      return res.status(400).json({
        message: 'يمكن طباعة الإشعار الدائن فقط للمرتجعات المعتمدة',
      });
    }

    // Generate HTML
    const html = generateCreditNotePdfHtml(sr, sr.customer, sr.originalInvoice);

    // Log HTML size for debugging
    logger.info(`[PDF] HTML size: ${(html.length / 1024).toFixed(2)} KB`);

    // Generate PDF buffer
    const pdfBuffer = await generatePdfFromHtml(html);

    // Log PDF size
    logger.info(`[PDF] PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // Generate filename
    const returnNumber = sr.returnNumber || `RET-${sr._id.toString().slice(-6).toUpperCase()}`;
    const filename = `CreditNote_${returnNumber}_${Date.now()}.pdf`;

    // Set headers for PDF download - important: binary data
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-cache',
    });

    logger.info(`[PDF] Credit Note generated successfully: ${filename}`);

    // Send PDF as binary using res.end() for raw buffer
    res.end(pdfBuffer, 'binary');
  } catch (error) {
    logger.error('[PDF] Credit Note generation failed:', {
      message: error.message,
      stack: error.stack,
      returnId: req.params.id,
    });
    console.error('[PDF ERROR FULL]:', error);
    res.status(500).json({
      message: 'فشل إنشاء ملف PDF',
      error: error.message,
    });
  }
};

/**
 * GET /api/sales/returns/next-number
 * Retrieve next return sequence number
 */
export async function getNextReturnNumber(req, res) {
  try {
    const count = await SalesReturn.countDocuments();
    const nextSeq = count + 1;
    const nextReturnNumber = `RET-${String(nextSeq).padStart(5, '0')}`;
    res.status(200).json({ nextReturnNumber, seq: nextSeq });
  } catch (error) {
    res.status(500).json({ message: 'فشل في استرجاع رقم المرتجع التالي', error: error.message });
  }
}
