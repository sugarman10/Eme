import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Item from '../models/Item.js';
import Supplier from '../models/Supplier.js';
import StockLedger from '../models/StockLedger.js';
import Treasury from '../models/Treasury.js';
import Transaction from '../models/Transaction.js';
import { createJournalEntry } from '../services/accountingService.js';
import Account from '../models/Account.js';
import { auditUpdate } from '../services/auditService.js';
import { runPostingTransaction } from '../services/postingService.js';

// 1. Create Draft PO
export const createPurchaseOrder = async (req, res) => {
    try {
        const { supplier, items, warehouse } = req.body;

        // Calculate totals
        const totalAmount = items.reduce((sum, i) => sum + (i.qty * i.cost), 0);

        const po = await PurchaseOrder.create({
            supplier,
            items,
            warehouse, // Optional preference
            totalAmount,
            status: 'pending'
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
                    const currentTotalQty = product.totalStock || 0;
                    const currentCost = product.cost || 0;
                    const newQty = lineItem.qty;
                    const newCost = lineItem.cost;

                    const totalValue = (currentTotalQty * currentCost) + (newQty * newCost);
                    const totalQty = currentTotalQty + newQty;

                    const weightedAvgCost = totalQty > 0 ? (totalValue / totalQty) : newCost;

                    if (!product.stocks) product.stocks = [];

                    const stockIndex = product.stocks.findIndex(
                        s => s.warehouse.toString() === warehouse.toString()
                    );

                    if (stockIndex > -1) {
                        product.stocks[stockIndex].qty += newQty;
                    } else {
                        product.stocks.push({ warehouse, qty: newQty });
                    }

                    product.cost = weightedAvgCost;
                    product.totalStock = (product.totalStock || 0) + newQty;

                    await product.save({ session });

                    const [ledgerDoc] = await StockLedger.create([{
                        item: product._id,
                        warehouse: warehouse,
                        type: 'IN',
                        qty: newQty,
                        ref: `PO#${po.number || po._id}`,
                        note: 'Purchase Order Receive',
                        date: new Date()
                    }], { session });
                    if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
                }
            }

            // C. Update Supplier Balance (Credit)
            await Supplier.findByIdAndUpdate(po.supplier, {
                $inc: { balance: po.totalAmount }
            }, { session });

            // D. Mark PO as Received
            po.status = 'received';
            po.warehouse = warehouse;
            po.receivedAt = new Date();
            await po.save({ session });

            // E. Auto-Accounting (Journal Entry)
            let journalEntryId = null;
            try {
                const accounts = await Account.find({ code: { $in: ['10103', '20101'] } }).session(session);
                const accMap = accounts.reduce((map, acc) => { map[acc.code] = acc._id; return map; }, {});

                if (accMap['10103'] && accMap['20101']) {
                    const journalEntry = await createJournalEntry(session, {
                        date: new Date(),
                        reference: `PO#${po.number || po._id}`,
                        description: `Purchase Order Receive - ${po.supplier}`,
                        entries: [
                            { accountId: accMap['10103'], debit: po.totalAmount, credit: 0, note: 'Inventory received' },
                            { accountId: accMap['20101'], debit: 0, credit: po.totalAmount, note: 'AP accrued' }
                        ]
                    });
                    journalEntryId = journalEntry?._id || null;
                } else {
                    console.warn('Accounting Sync Skipped: Missing Accounts 10103 or 20101');
                }
            } catch (jeError) {
                console.error('Accounting Sync Failed (Procurement):', jeError.message);
            }

            await auditUpdate('PURCHASE_ORDER', po._id, beforeState, po, req.user, req.ip, session, {
                action: 'POST',
                journalEntryId,
                stockLedgerIds
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
                action: 'VOID'
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
        const { supplierId, treasuryId, amount, note } = req.body;

        const payAmount = Number(amount);
        if (payAmount <= 0) throw new Error('Invalid amount');

        // 1. Check Supplier Balance
        const supplier = await Supplier.findById(supplierId).session(session);
        if (!supplier) throw new Error('Supplier not found');

        if (supplier.balance < payAmount) {
            throw new Error(`Amount exceeds supplier balance (${supplier.balance})`);
        }

        // 2. Check Treasury Funds
        const treasury = await Treasury.findById(treasuryId).session(session);
        if (!treasury) throw new Error('Treasury not found');

        if (treasury.balance < payAmount) {
            throw new Error(`Insufficient funds in treasury (${treasury.balance})`);
        }

        // 3. Deduct from Treasury
        treasury.balance -= payAmount;
        await treasury.save({ session });

        // 4. Deduct from Supplier (Debt Reduced)
        supplier.balance -= payAmount;
        await supplier.save({ session });

        // 5. Create Transaction
        await Transaction.create([{
            type: 'expense',
            flow: 'out',
            category: 'pay_supplier',
            amount: payAmount,
            treasury: treasuryId,
            relatedModel: 'Supplier',
            relatedId: supplierId,
            description: note || `Payment to Supplier: ${supplier.name}`
        }], { session });

        // 6. Journal Entry (Dr AP / Cr Cash or Bank)
        const cashCode = treasury.type === 'bank' ? '1020' : '1010';
        const accounts = await Account.find({ code: { $in: ['20101', cashCode] } }).session(session);
        const apAcc = accounts.find(a => a.code === '20101');
        const cashAcc = accounts.find(a => a.code === cashCode);

        if (!apAcc || !cashAcc) {
            throw new Error('Missing AP or treasury account for supplier payment');
        }

        await createJournalEntry(session, {
            date: new Date(),
            reference: `SUPPAY#${supplier._id.toString().slice(-6)}`,
            description: `Supplier payment - ${supplier.name}`,
            entries: [
                { accountId: apAcc._id, debit: payAmount, credit: 0, note: 'AP settlement' },
                { accountId: cashAcc._id, debit: 0, credit: payAmount, note: 'Treasury payment' }
            ]
        });

        await session.commitTransaction();
        res.status(200).json({ message: 'Payment successful', newBalance: supplier.balance });

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
        const id = (req.params && req.params.id) ? req.params.id : req;

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
                const stockIndex = product.stocks.findIndex(s => s.warehouse.toString() === warehouseId.toString());
                if (stockIndex === -1) {
                    throw new Error(`Item not found in warehouse: ${lineItem.item}`);
                }
                if (product.stocks[stockIndex].qty < lineItem.qty) {
                    throw new Error(`Insufficient stock for return: ${product.name}`);
                }

                product.stocks[stockIndex].qty -= lineItem.qty;
                product.totalStock = Math.max(0, (product.totalStock || 0) - lineItem.qty);
                await product.save({ session });

                const [ledgerDoc] = await StockLedger.create([{
                    item: product._id,
                    warehouse: warehouseId,
                    type: 'OUT',
                    qty: -lineItem.qty,
                    ref: `PO#${po.number || po._id}`,
                    note: 'Purchase Order Return',
                    date: new Date()
                }], { session });
                if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
            }

            // Reverse Balance (Debit Supplier)
            await Supplier.findByIdAndUpdate(po.supplier, {
                $inc: { balance: -po.totalAmount }
            }, { session });

            // Journal Entry (Reverse PO)
            let journalEntryId = null;
            try {
                const accounts = await Account.find({
                    code: { $in: ['10103', '20101'] }
                }).session(session);

                const accMap = accounts.reduce((map, acc) => {
                    map[acc.code] = acc._id;
                    return map;
                }, {});

                const inventoryAccount = accMap['10103'];
                const apAccount = accMap['20101'];

                if (inventoryAccount && apAccount) {
                    const journalEntry = await createJournalEntry(session, {
                        date: new Date(),
                        reference: `PO-RET#${po.number || po._id}`,
                        description: `Purchase Order Return - ${po.supplier}`,
                        entries: [
                            { accountId: apAccount, debit: po.totalAmount, credit: 0, note: 'AP reversal' },
                            { accountId: inventoryAccount, debit: 0, credit: po.totalAmount, note: 'Inventory reversal' }
                        ]
                    });
                    journalEntryId = journalEntry?._id || null;
                } else {
                    console.warn('Accounting Sync Skipped: Missing Account 10103 or 20101');
                }
            } catch (jeError) {
                console.error('Journal Entry Failed (PO Return):', jeError.message);
            }

            // Update PO Status
            po.status = 'returned';
            await po.save({ session });

            await auditUpdate('PURCHASE_ORDER', po._id, beforeState, po, req.user, req.ip, session, {
                action: 'REVERSE',
                journalEntryId,
                stockLedgerIds
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
            $expr: { $gt: ['$totalAmount', '$paidAmount'] }
        }).select('number totalAmount paidAmount createdAt');

        // Map to add "remainingBalance" virtual field for the UI
        const mappedOrders = orders.map(o => ({
            _id: o._id,
            number: o.number || o._id.toString().slice(-6),
            date: o.createdAt,
            totalAmount: o.totalAmount,
            paidAmount: o.paidAmount || 0,
            remainingBalance: o.totalAmount - (o.paidAmount || 0)
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
            status: 'received'
        }).lean();

        // 2. Fetch Payments (Credits) - From Transactions
        const payments = await Transaction.find({
            relatedModel: 'Supplier',
            relatedId: id,
            type: 'expense' // We paid them
        }).lean();

        // 3. Fetch Returns (Credits)
        const returns = await PurchaseReturn.find({
            supplier: id
        }).lean();

        // 4. Merge & Sort
        const timeline = [
            ...orders.map(o => ({
                id: o._id,
                date: o.receivedAt || o.createdAt,
                type: 'INVOICE',
                ref: `PO#${o.number || o._id.toString().slice(-6)}`,
                debit: o.totalAmount, // We owe this
                credit: 0
            })),
            ...payments.map(p => ({
                id: p._id,
                date: p.date,
                type: 'PAYMENT',
                ref: `RCPT#${p._id.toString().slice(-6)}`,
                debit: 0,
                credit: p.amount // We paid this
            })),
            ...returns.map(r => ({
                id: r._id,
                date: r.date,
                type: 'RETURN',
                ref: `RET#${r._id.toString().slice(-6)}`,
                debit: 0,
                credit: r.totalRefundAmount // We are owed this back (reduces debt)
            }))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        // 5. Calculate Running Balance
        let balance = supplier.openingBalance || 0;
        const statement = timeline.map(entry => {
            balance += (entry.debit - entry.credit);
            return { ...entry, balance };
        });

        res.json({
            supplier: {
                name: supplier.name,
                currentBalance: supplier.balance
            },
            statement
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
            const originalItem = po.items.find(i => i.item.toString() === rItem.item);
            if (!originalItem) {
                return res.status(400).json({
                    message: `الصنف ${rItem.item} غير موجود في طلب الشراء الأصلي`
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
                reason: rItem.reason || 'other'
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
            createdBy: req.user?._id
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

                const stockIdx = product.stocks?.findIndex(
                    s => s.warehouse.toString() === warehouseId.toString()
                ) ?? -1;

                if (stockIdx === -1) {
                    throw new Error(`Item not found in warehouse: ${product.name}`);
                }

                if (product.stocks[stockIdx].qty < rItem.qty) {
                    throw new Error(`Insufficient stock for return: ${product.name}`);
                }

                product.stocks[stockIdx].qty -= rItem.qty;
                product.totalStock = Math.max(0, (product.totalStock || 0) - rItem.qty);
                await product.save({ session });

                const [ledgerDoc] = await StockLedger.create([{
                    item: product._id,
                    warehouse: warehouseId,
                    type: 'PURCHASE_RETURN',
                    qty: -rItem.qty,
                    ref: `RET#${pr._id.toString().slice(-6)}`,
                    note: `Purchase return - ${rItem.reason || 'other'}`,
                    user: req.user?._id,
                    date: new Date()
                }], { session });
                if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
            }

            // D. Update Supplier Balance (Reduce debt)
            await Supplier.findByIdAndUpdate(pr.supplier, {
                $inc: { balance: -pr.totalAmount }
            }, { session });

            // E. Double-Entry Journal Entry
            let journalEntryId = null;
            try {
                const accounts = await Account.find({
                    code: { $in: ['10103', '20101'] }
                }).session(session);

                const accMap = accounts.reduce((map, acc) => {
                    map[acc.code] = acc._id;
                    return map;
                }, {});

                const inventoryAccount = accMap['10103'];
                const apAccount = accMap['20101'];

                if (inventoryAccount && apAccount) {
                    const journalEntry = await createJournalEntry(session, {
                        date: new Date(),
                        reference: `RET#${pr._id.toString().slice(-6)}`,
                        description: `Purchase return - ${pr.supplier}`,
                        entries: [
                            {
                                accountId: apAccount,
                                debit: pr.totalAmount,
                                credit: 0,
                                note: 'AP reversal'
                            },
                            {
                                accountId: inventoryAccount,
                                debit: 0,
                                credit: pr.totalAmount,
                                note: 'Inventory reduction'
                            }
                        ]
                    });
                    journalEntryId = journalEntry?._id || null;
                } else {
                    console.warn('Accounting Sync Skipped: Missing Account 10103 or 20101');
                }
            } catch (jeError) {
                console.error('Journal Entry Failed (Purchase Return):', jeError.message);
            }

            // F. Update Return Status
            pr.status = 'returned';
            pr.approvedBy = req.user?._id;
            pr.approvedAt = new Date();
            await pr.save({ session });

            await auditUpdate('PURCHASE_RETURN', pr._id, beforeState, pr, req.user, req.ip, session, {
                action: 'POST',
                journalEntryId,
                stockLedgerIds
            });

            return pr._id;
        });

        const populated = await PurchaseReturn.findById(resultId)
            .populate('supplier', 'name code')
            .populate('warehouse', 'name')
            .populate('approvedBy', 'name');

        res.status(200).json({
            message: 'Return posted successfully',
            return: populated
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
                action: 'VOID'
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
                const stockIdx = product.stocks.findIndex(
                    s => s.warehouse.toString() === warehouseId.toString()
                );

                if (stockIdx > -1) {
                    product.stocks[stockIdx].qty += rItem.qty;
                } else {
                    product.stocks.push({ warehouse: warehouseId, qty: rItem.qty });
                }

                product.totalStock = (product.totalStock || 0) + rItem.qty;
                await product.save({ session });

                const [ledgerDoc] = await StockLedger.create([{
                    item: product._id,
                    warehouse: warehouseId,
                    type: 'IN',
                    qty: rItem.qty,
                    ref: `RET-REV#${pr._id.toString().slice(-6)}`,
                    note: 'Purchase return reversal',
                    user: req.user?._id,
                    date: new Date()
                }], { session });
                if (ledgerDoc?._id) stockLedgerIds.push(ledgerDoc._id);
            }

            // Restore Supplier Balance
            await Supplier.findByIdAndUpdate(pr.supplier, {
                $inc: { balance: pr.totalAmount }
            }, { session });

            // Reverse Journal Entry (Dr Inventory / Cr AP)
            let journalEntryId = null;
            try {
                const accounts = await Account.find({
                    code: { $in: ['10103', '20101'] }
                }).session(session);

                const accMap = accounts.reduce((map, acc) => {
                    map[acc.code] = acc._id;
                    return map;
                }, {});

                const inventoryAccount = accMap['10103'];
                const apAccount = accMap['20101'];

                if (inventoryAccount && apAccount) {
                    const journalEntry = await createJournalEntry(session, {
                        date: new Date(),
                        reference: `RET-REV#${pr._id.toString().slice(-6)}`,
                        description: `Purchase return reversal - ${pr.supplier}`,
                        entries: [
                            { accountId: inventoryAccount, debit: pr.totalAmount, credit: 0, note: 'Inventory restore' },
                            { accountId: apAccount, debit: 0, credit: pr.totalAmount, note: 'AP restore' }
                        ]
                    });
                    journalEntryId = journalEntry?._id || null;
                } else {
                    console.warn('Accounting Sync Skipped: Missing Account 10103 or 20101');
                }
            } catch (jeError) {
                console.error('Journal Entry Failed (Purchase Return Reverse):', jeError.message);
            }

            pr.status = 'reversed';
            await pr.save({ session });

            await auditUpdate('PURCHASE_RETURN', pr._id, beforeState, pr, req.user, req.ip, session, {
                action: 'REVERSE',
                journalEntryId,
                stockLedgerIds
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
            'draft': ['pending_approval', 'rejected'],
            'pending_approval': ['returned', 'rejected'],
            'returned': [],
            'rejected': ['draft'],
            'reversed': []
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

        // Credit Treasury
        if (treasuryId) {
            const treasury = await Treasury.findById(treasuryId).session(session);
            if (!treasury) throw new Error('الخزينة غير موجودة');

            treasury.balance += pr.totalAmount;
            await treasury.save({ session });

            // Create Transaction
            await Transaction.create([{
                type: 'income',
                flow: 'in',
                category: 'purchase_return_refund',
                amount: pr.totalAmount,
                treasury: treasuryId,
                relatedModel: 'PurchaseReturn',
                relatedId: pr._id,
                description: `استرداد مرتجع مشتريات #${pr._id.toString().slice(-6)}`,
                date: new Date()
            }], { session });
        }

        pr.isRefunded = true;
        await pr.save({ session });

        await session.commitTransaction();
        res.json({ message: 'تم تسجيل استرداد المبلغ', return: pr });

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
