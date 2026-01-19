import mongoose from 'mongoose';
import SalesReturn from '../models/SalesReturn.js';
import SalesInvoice from '../models/SalesInvoice.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import StockLedger from '../models/StockLedger.js';
import Treasury from '../models/Treasury.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { createJournalEntry } from '../services/accountingService.js';
import { generateCreditNotePdfHtml, generatePdfFromHtml } from '../services/pdfService.js';
import logger from '../config/logger.js';
import { auditUpdate } from '../services/auditService.js';
import { runPostingTransaction } from '../services/postingService.js';
import { deductStockBulk } from '../services/stockService.js';

// 1. Create Sales Return DRAFT
export const createSalesReturn = async (req, res) => {
    try {
        const { invoiceId, items, note, warehouse } = req.body;

        // Validate Invoice
        const invoice = await SalesInvoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({ message: 'الفاتورة الأصلية غير موجودة' });
        }

        if (invoice.status !== 'confirmed' && invoice.status !== 'posted') {
            return res.status(400).json({ message: 'لا يمكن الإرجاع إلا من فاتورة مؤكدة' });
        }

        // Validate items exist in original Invoice
        const returnItemsPayload = [];
        let totalAmount = 0;

        for (const rItem of items) {
            const originalItem = invoice.items.find(i => i.item.toString() === rItem.item);
            if (!originalItem) {
                return res.status(400).json({
                    message: `الصنف ${rItem.item} غير موجود في الفاتورة الأصلية`
                });
            }

            // Calculate previously returned quantity
            const prevReturnedQty = invoice.returns
                ? invoice.returns
                    .filter(r => r.item.toString() === rItem.item)
                    .reduce((sum, r) => sum + r.qty, 0)
                : 0;

            const remainingQty = originalItem.qty - prevReturnedQty;

            if (rItem.qty > remainingQty) {
                return res.status(400).json({
                    message: `الكمية المرجعة (${rItem.qty}) أكبر من الكمية المتبقية القابلة للإرجاع (${remainingQty}) للصنف`
                });
            }

            const unitPrice = originalItem.price;
            const refundAmount = unitPrice * rItem.qty;
            totalAmount += refundAmount;

            returnItemsPayload.push({
                item: rItem.item,
                qty: rItem.qty,
                unitPrice,
                refundAmount,
                reason: rItem.reason || 'other'
            });
        }

        // Create DRAFT
        const sr = await SalesReturn.create({
            originalInvoice: invoice._id,
            customer: invoice.customer,
            warehouse: warehouse || invoice.warehouse,
            items: returnItemsPayload,
            totalAmount,
            status: 'draft',
            isRefunded: false,
            note,
            createdBy: req.user?._id
        });

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

        const resultId = await runPostingTransaction(async (session) => {
            const sr = await SalesReturn.findById(id).session(session);
            if (!sr) throw new Error('Return not found');

            if (sr.status === 'returned') throw new Error('Return already posted');
            if (sr.status === 'rejected' || sr.status === 'reversed') throw new Error('Return cannot be posted');
            if (!['draft', 'pending_approval'].includes(sr.status)) throw new Error('Return must be draft or pending');

            const beforeState = sr.toObject();
            const warehouseId = sr.warehouse;
            const stockLedgerIds = [];

            // B. Process Each Item (Stock Increase)
            for (const rItem of sr.items) {
                const product = await Item.findById(rItem.item).session(session);
                if (!product) throw new Error(`Product not found: ${rItem.item}`);

                if (!product.stocks) product.stocks = [];
                const stockIdx = product.stocks.findIndex(
                    s => s.warehouse.toString() === warehouseId.toString()
                );

                if (stockIdx > -1) {
                    product.stocks[stockIdx].qty += rItem.qty;
                } else {
                    product.stocks.push({ warehouse: warehouseId, qty: rItem.qty });
                }

                product.totalStock += rItem.qty;
                await product.save({ session });

                const [ledgerDoc] = await StockLedger.create([{
                    item: product._id,
                    warehouse: warehouseId,
                    type: 'SALES_RETURN',
                    qty: rItem.qty,
                    ref: `RET-SALE#${sr._id.toString().slice(-6)}`,
                    note: `Sales return - ${rItem.reason || 'other'}`,
                    user: req.user?._id,
                    date: new Date()
                }], { session });
                if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
            }

            // D. Update Customer Balance
            if (sr.customer) {
                await Customer.findByIdAndUpdate(sr.customer, {
                    $inc: { balance: -sr.totalAmount }
                }, { session });
            }

            // E. Update Original Invoice (Record Return)
            const returnRecords = sr.items.map(item => ({
                item: item.item,
                qty: item.qty,
                date: new Date(),
                note: `Return #${sr._id.toString().slice(-6)}`,
                returnId: sr._id
            }));

            await SalesInvoice.findByIdAndUpdate(sr.originalInvoice, {
                $push: { returns: { $each: returnRecords } }
            }, { session });

            // F. Double-Entry Journal Entry
            let journalEntryId = null;
            try {
                const accounts = await Account.find({
                    code: { $in: ['40102', '10105', '11101'] }
                }).session(session);

                const accMap = accounts.reduce((map, acc) => {
                    map[acc.code] = acc._id;
                    return map;
                }, {});

                const salesReturnAcc = accMap['40102'];
                const arAccount = accMap['10105'] || accMap['11101'];

                if (salesReturnAcc && arAccount) {
                    const customerName = sr.customer ? `Customer ${sr.customer}` : 'Walk-in Customer';

                    const journalEntry = await createJournalEntry(session, {
                        date: new Date(),
                        reference: `RET-SALE#${sr._id.toString().slice(-6)}`,
                        description: `Sales return - ${customerName}`,
                        entries: [
                            {
                                accountId: salesReturnAcc,
                                debit: sr.totalAmount,
                                credit: 0,
                                note: 'Sales return'
                            },
                            {
                                accountId: arAccount,
                                debit: 0,
                                credit: sr.totalAmount,
                                note: `AR reduction - ${customerName}`
                            }
                        ]
                    });
                    journalEntryId = journalEntry?._id || null;
                } else {
                    console.warn('Accounting Sync Skipped: Missing 40102 or AR account');
                }
            } catch (jeError) {
                console.error('Journal Entry Failed (Sales Return):', jeError.message);
            }

            // G. Update Return Status
            sr.status = 'returned';
            sr.approvedBy = req.user?._id;
            sr.approvedAt = new Date();
            await sr.save({ session });

            await auditUpdate('SALES_RETURN', sr._id, beforeState, sr, req.user, req.ip, session, {
                action: 'POST',
                journalEntryId,
                stockLedgerIds
            });

            return sr._id;
        });

        const populated = await SalesReturn.findById(resultId)
            .populate('customer', 'name')
            .populate('warehouse', 'name')
            .populate('approvedBy', 'name');

        res.status(200).json({
            message: 'Return posted successfully',
            return: populated
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
                action: 'VOID'
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

            const deductItems = sr.items.map(item => ({
                item: item.item,
                qty: item.qty
            }));

            await deductStockBulk(deductItems, warehouseId, session);

            const ledgerDocs = await StockLedger.insertMany(sr.items.map(item => ({
                item: item.item,
                warehouse: warehouseId,
                type: 'OUT',
                qty: -Math.abs(Number(item.qty || 0)),
                ref: `RET-SALE-REV#${sr._id.toString().slice(-6)}`,
                note: 'Sales return reversal',
                user: req.user?._id,
                date: new Date()
            })), { session });

            ledgerDocs.forEach(doc => {
                if (doc?._id) stockLedgerIds.push(doc._id);
            });

            if (sr.customer) {
                await Customer.findByIdAndUpdate(sr.customer, {
                    $inc: { balance: sr.totalAmount }
                }, { session });
            }

            const invoice = await SalesInvoice.findById(sr.originalInvoice).session(session);
            if (invoice) {
                const retId = sr._id.toString();
                const shortId = retId.slice(-6);
                invoice.returns = (invoice.returns || []).filter(r => {
                    if (r.returnId && r.returnId.toString() === retId) return false;
                    const note = r.note || '';
                    if (note.includes(shortId) && note.includes('Return #')) return false;
                    return true;
                });
                await invoice.save({ session });
            }

            let journalEntryId = null;
            try {
                const accounts = await Account.find({
                    code: { $in: ['40102', '10105', '11101'] }
                }).session(session);

                const accMap = accounts.reduce((map, acc) => {
                    map[acc.code] = acc._id;
                    return map;
                }, {});

                const salesReturnAcc = accMap['40102'];
                const arAccount = accMap['10105'] || accMap['11101'];

                if (salesReturnAcc && arAccount) {
                    const customerName = sr.customer ? `Customer ${sr.customer}` : 'Walk-in Customer';
                    const journalEntry = await createJournalEntry(session, {
                        date: new Date(),
                        reference: `RET-SALE-REV#${sr._id.toString().slice(-6)}`,
                        description: `Sales return reversal - ${customerName}`,
                        entries: [
                            {
                                accountId: arAccount,
                                debit: sr.totalAmount,
                                credit: 0,
                                note: 'Reversal of sales return'
                            },
                            {
                                accountId: salesReturnAcc,
                                debit: 0,
                                credit: sr.totalAmount,
                                note: 'Reversal of sales return'
                            }
                        ]
                    });
                    journalEntryId = journalEntry?._id || null;
                } else {
                    console.warn('Accounting Sync Skipped: Missing 40102 or AR account');
                }
            } catch (jeError) {
                console.error('Journal Entry Failed (Sales Return Reverse):', jeError.message);
            }

            sr.status = 'reversed';
            await sr.save({ session });

            await auditUpdate('SALES_RETURN', sr._id, beforeState, sr, req.user, req.ip, session, {
                action: 'REVERSE',
                journalEntryId,
                stockLedgerIds
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
            'draft': ['pending_approval', 'rejected'],
            'pending_approval': ['rejected', 'returned'],
            'rejected': ['draft'],
            'returned': [],
            'reversed': []
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
                message: 'يمكن طباعة الإشعار الدائن فقط للمرتجعات المعتمدة'
            });
        }

        // Generate HTML
        const html = generateCreditNotePdfHtml(
            sr,
            sr.customer,
            sr.originalInvoice
        );

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
            'Cache-Control': 'no-cache'
        });

        logger.info(`[PDF] Credit Note generated successfully: ${filename}`);

        // Send PDF as binary using res.end() for raw buffer
        res.end(pdfBuffer, 'binary');

    } catch (error) {
        logger.error('[PDF] Credit Note generation failed:', {
            message: error.message,
            stack: error.stack,
            returnId: req.params.id
        });
        console.error('[PDF ERROR FULL]:', error);
        res.status(500).json({
            message: 'فشل إنشاء ملف PDF',
            error: error.message
        });
    }
};

