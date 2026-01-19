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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        // A. Get the Return
        const sr = await SalesReturn.findById(id).session(session);
        if (!sr) throw new Error('مرتجع مبيعات غير موجود');

        if (sr.status === 'returned') {
            throw new Error('تمت الموافقة على هذا المرتجع مسبقاً');
        }

        if (sr.status === 'rejected') {
            throw new Error('المرتجع مرفوض');
        }

        const warehouseId = sr.warehouse;

        // B. Process Each Item (Stock Increase)
        for (const rItem of sr.items) {
            const product = await Item.findById(rItem.item).session(session);
            if (!product) {
                throw new Error(`الصنف غير موجود: ${rItem.item}`);
            }

            // Ensure stocks array exists
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

            // C. Create Stock Ledger Entry (SALES_RETURN)
            await StockLedger.create([{
                item: product._id,
                warehouse: warehouseId,
                type: 'SALES_RETURN',
                qty: rItem.qty, // Positive because it comes back IN
                ref: `RET-SALE#${sr._id.toString().slice(-6)}`,
                note: `مرتجع مبيعات - ${rItem.reason || 'غير محدد'}`,
                user: req.user?._id,
                date: new Date()
            }], { session });
        }

        // D. Update Customer Balance (Credit Customer - Reduce Balance)
        if (sr.customer) {
            await Customer.findByIdAndUpdate(sr.customer, {
                $inc: { balance: -sr.totalAmount }
            }, { session });
        }

        // E. Update Original Invoice (Record Return)
        // Store return history in the original invoice for validation of future returns
        const returnRecords = sr.items.map(item => ({
            item: item.item,
            qty: item.qty,
            date: new Date(),
            note: `Return #${sr._id.toString().slice(-6)}`
        }));

        await SalesInvoice.findByIdAndUpdate(sr.originalInvoice, {
            $push: { returns: { $each: returnRecords } }
        }, { session });

        // F. Double-Entry Journal Entry
        try {
            // Debit: Sales Returns (40102) OR Revenue Reduction
            // Credit: Customer Control (10105) (Accounts Receivable)

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
                // If customer exists, credit AR. If walking customer (null), what do we credit?
                // Usually Walking Customers paid Cash, so we should Credit Cash (Refund) or Liability?
                // For now, assuming Credit Note logic -> Credit AR implies we owe them OR we reduce what they owe.
                // If they have no account, we can't reduce what they owe. 
                // We should probably just log the return revenue reduction. 
                // BUT double entry requires balance.
                // Assuming for now we still credit AR (or a Cash Customer clearing account).
                // If sr.customer is null, we might need to skip AR part of JE or use a generic one.
                // For safety to avoid breakage:

                const customerName = sr.customer ? `عميل ${sr.customer}` : 'زبوون عام (نقدي)';

                await createJournalEntry(session, {
                    date: new Date(),
                    reference: `RET-SALE#${sr._id.toString().slice(-6)}`,
                    description: `مرتجع مبيعات - ${customerName}`,
                    entries: [
                        // Debit: Sales Returns (Revenue Contra)
                        {
                            accountId: salesReturnAcc,
                            debit: sr.totalAmount,
                            credit: 0,
                            note: 'مردودات مبيعات'
                        },
                        // Credit: AR (Reduce Asset) - This reduces the "Balance" we expect to collect.
                        // For cash customer, this balance doesn't exist technically, but accounting-wise
                        // the initial sale debited AR/Cash. If it was Cash sale, it debited Cash.
                        // So here we should probably Credit CASH if it was a Cash Sale?
                        // Complexity: We don't know if original was Cash/Credit easily here without checking invoice payment method.
                        // Sticking to AR for consistency with "Credit Note" model, can be adjusted later.
                        {
                            accountId: arAccount,
                            debit: 0,
                            credit: sr.totalAmount,
                            note: `تخفيض رصيد ${customerName}`
                        }
                    ]
                });
                // Log removed for production
            } else {
                console.warn('⚠️ Accounting Sync Skipped: Missing 40102 or AR account');
            }
        } catch (jeError) {
            console.error('❌ Journal Entry Failed (Sales Return):', jeError.message);
        }

        // G. Update Return Status
        sr.status = 'returned';
        sr.approvedBy = req.user?._id;
        sr.approvedAt = new Date();
        await sr.save({ session });

        await session.commitTransaction();

        const populated = await SalesReturn.findById(sr._id)
            .populate('customer', 'name')
            .populate('warehouse', 'name')
            .populate('approvedBy', 'name');

        res.status(200).json({
            message: 'تمت الموافقة على المرتجع بنجاح',
            return: populated
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Approve Sales Return Error:', error);
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
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

        sr.status = status;
        if (status === 'rejected' && rejectionReason) {
            sr.note = (sr.note || '') + `\n[رفض]: ${rejectionReason}`;
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

