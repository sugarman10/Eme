import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Item from '../models/Item.js';
import Supplier from '../models/Supplier.js';
import StockLedger from '../models/StockLedger.js';
import Treasury from '../models/Treasury.js';
import Transaction from '../models/Transaction.js';
import { createJournalEntry } from '../services/accountingService.js';
import Account from '../models/Account.js';

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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { warehouse } = req.body; // The ACTUAL target warehouse

        if (!warehouse) {
            throw new Error('Target warehouse is required for receiving');
        }

        // A. Get the PO
        const po = await PurchaseOrder.findById(id).session(session);
        if (!po) throw new Error('Order not found');
        if (po.status === 'received') throw new Error('Order already received');

        // B. Process Each Item (Costing & Stock)
        for (const lineItem of po.items) {
            const product = await Item.findById(lineItem.item).session(session);

            if (product) {
                // 1. Calculate Weighted Average Cost
                const currentTotalQty = product.totalStock || 0;
                const currentCost = product.cost || 0;
                const newQty = lineItem.qty;
                const newCost = lineItem.cost;

                const totalValue = (currentTotalQty * currentCost) + (newQty * newCost);
                const totalQty = currentTotalQty + newQty;

                // Avoid division by zero
                const weightedAvgCost = totalQty > 0 ? (totalValue / totalQty) : newCost;

                // 2. Update Product (Global Cost + Specific Warehouse Stock)
                // Check if warehouse exists in stocks array
                // Ensure stocks array exists
                if (!product.stocks) product.stocks = [];

                const stockIndex = product.stocks.findIndex(
                    s => s.warehouse.toString() === warehouse.toString()
                );

                if (stockIndex > -1) {
                    // Warehouse exists, increment
                    product.stocks[stockIndex].qty += newQty;
                } else {
                    // New warehouse entry
                    product.stocks.push({ warehouse, qty: newQty });
                }

                product.cost = weightedAvgCost; // Update global cost
                product.totalStock += newQty;   // Update total

                await product.save({ session });

                // 3. Create Stock Ledger Entry
                await StockLedger.create([{
                    item: product._id,
                    warehouse: warehouse,
                    type: 'IN', // Purchase
                    qty: newQty,
                    ref: `PO#${po.number || po._id}`,
                    note: 'Purchase Order Receive',
                    date: new Date()
                }], { session });
            }
        }

        // C. Update Supplier Balance (Credit)
        // We owe the supplier money now
        await Supplier.findByIdAndUpdate(po.supplier, {
            $inc: { balance: po.totalAmount }
        }, { session });

        // D. Mark PO as Received
        po.status = 'received';
        po.warehouse = warehouse; // Record where it actually went
        po.receivedAt = new Date();
        await po.save({ session });

        // ===== AUTO-ACCOUNTING (Journal Entry) =====
        try {
            // 1. Fetch Accounts (Inventory Asset: 10103, AP: 20101)
            const accounts = await Account.find({ code: { $in: ['10103', '20101'] } }).session(session);
            const accMap = accounts.reduce((map, acc) => { map[acc.code] = acc._id; return map; }, {});

            if (accMap['10103'] && accMap['20101']) {
                await createJournalEntry(session, {
                    date: new Date(),
                    reference: `PO#${po.number || po._id}`,
                    description: `استلام طلب شراء - مورد ${po.supplier}`,
                    entries: [
                        // Dr Inventory (10103)
                        { accountId: accMap['10103'], debit: po.totalAmount, credit: 0, note: 'استلام مخزني' },
                        // Cr AP (20101)
                        { accountId: accMap['20101'], debit: 0, credit: po.totalAmount, note: 'استحقاق مورد' }
                    ]
                });
            } else {
                console.warn('⚠️ Accounting Sync Skipped: Missing Accounts 10103 or 20101');
            }
        } catch (jeError) {
            console.error('❌ Accounting Sync Failed (Procurement):', jeError.message);
        }

        await session.commitTransaction();
        res.status(200).json({ message: 'Received successfully', po });

    } catch (error) {
        await session.abortTransaction();
        console.error('Receive Error:', error);
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
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
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Handle input: req.params.id (Express) or req (Service direct ID)
        const id = (req.params && req.params.id) ? req.params.id : req;

        const po = await PurchaseOrder.findById(id).session(session);
        if (!po) throw new Error('Order not found');
        if (po.status !== 'received') throw new Error('Order is not received, cannot return');

        // Reverse Stock Logic
        for (const lineItem of po.items) {
            const product = await Item.findById(lineItem.item).session(session);
            if (product) {
                // Determine warehouse from PO
                const warehouseId = po.warehouse;

                // Remove form specific warehouse stock
                if (product.stocks) {
                    const stockIndex = product.stocks.findIndex(s => s.warehouse.toString() === warehouseId.toString());
                    if (stockIndex > -1) {
                        product.stocks[stockIndex].qty = Math.max(0, product.stocks[stockIndex].qty - lineItem.qty);
                    }
                }

                // Remove from total stock
                product.totalStock = Math.max(0, product.totalStock - lineItem.qty);

                await product.save({ session });

                // Add Stock Ledger OUT
                await StockLedger.create([{
                    item: product._id,
                    warehouse: warehouseId,
                    type: 'OUT',
                    qty: -lineItem.qty, // Negative for OUT? Or Positive with type OUT?
                    ref: `PO#${po.number || po._id}`,
                    note: 'Purchase Order Return',
                    date: new Date()
                }], { session });
            }
        }

        // Reverse Balance (Debit Supplier)
        await Supplier.findByIdAndUpdate(po.supplier, {
            $inc: { balance: -po.totalAmount }
        }, { session });

        // Update PO Status
        po.status = 'returned';
        await po.save({ session });

        await session.commitTransaction();

        if (res && res.json) return res.json({ message: 'Returned successfully', po });
        return po; // Service Usage

    } catch (e) {
        await session.abortTransaction();
        if (res && res.status) return res.status(400).json({ message: e.message });
        throw e;
    } finally {
        session.endSession();
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        // A. Get the Return
        const pr = await PurchaseReturn.findById(id).session(session);
        if (!pr) throw new Error('مرتجع غير موجود');

        if (pr.status === 'returned') {
            throw new Error('هذا المرتجع تمت الموافقة عليه مسبقاً');
        }

        if (pr.status === 'rejected') {
            throw new Error('هذا المرتجع مرفوض ولا يمكن الموافقة عليه');
        }

        const warehouseId = pr.warehouse;

        // B. Process Each Item (Stock Deduction)
        for (const rItem of pr.items) {
            const product = await Item.findById(rItem.item).session(session);
            if (!product) {
                throw new Error(`الصنف غير موجود: ${rItem.item}`);
            }

            // Check stock availability
            const stockIdx = product.stocks?.findIndex(
                s => s.warehouse.toString() === warehouseId.toString()
            ) ?? -1;

            if (stockIdx === -1) {
                throw new Error(`الصنف ${product.name} غير موجود في المستودع المحدد`);
            }

            if (product.stocks[stockIdx].qty < rItem.qty) {
                throw new Error(
                    `رصيد غير كافٍ للصنف: ${product.name}. ` +
                    `المتوفر: ${product.stocks[stockIdx].qty}, ` +
                    `المطلوب: ${rItem.qty}`
                );
            }

            // Deduct stock
            product.stocks[stockIdx].qty -= rItem.qty;
            product.totalStock = Math.max(0, product.totalStock - rItem.qty);
            await product.save({ session });

            // C. Create Stock Ledger Entry (PURCHASE_RETURN type)
            await StockLedger.create([{
                item: product._id,
                warehouse: warehouseId,
                type: 'PURCHASE_RETURN',
                qty: -rItem.qty,
                ref: `RET#${pr._id.toString().slice(-6)}`,
                note: `مرتجع مشتريات - ${rItem.reason || 'غير محدد'}`,
                user: req.user?._id,
                date: new Date()
            }], { session });
        }

        // D. Update Supplier Balance (Reduce debt - we're owed money back)
        await Supplier.findByIdAndUpdate(pr.supplier, {
            $inc: { balance: -pr.totalAmount }
        }, { session });

        // E. Double-Entry Journal Entry (Critical for Accounting)
        // Debit: Accounts Payable (Liability ↓) - we owe less
        // Credit: Inventory Asset (Asset ↓) - we have less inventory
        try {
            const accounts = await Account.find({
                code: { $in: ['10103', '20101'] }
            }).session(session);

            const accMap = accounts.reduce((map, acc) => {
                map[acc.code] = acc._id;
                return map;
            }, {});

            const inventoryAccount = accMap['10103']; // المخزون (Inventory Asset)
            const apAccount = accMap['20101'];        // ذمم الموردين (Accounts Payable)

            if (inventoryAccount && apAccount) {
                await createJournalEntry(session, {
                    date: new Date(),
                    reference: `RET#${pr._id.toString().slice(-6)}`,
                    description: `مرتجع مشتريات - المورد: ${pr.supplier}`,
                    entries: [
                        // Debit: Accounts Payable (reduce liability)
                        {
                            accountId: apAccount,
                            debit: pr.totalAmount,
                            credit: 0,
                            note: 'تخفيض ذمم الموردين - مرتجع'
                        },
                        // Credit: Inventory (reduce asset)
                        {
                            accountId: inventoryAccount,
                            debit: 0,
                            credit: pr.totalAmount,
                            note: 'نقص المخزون - مرتجع مشتريات'
                        }
                    ]
                });
                // Log removed for production
            } else {
                console.warn('⚠️ Accounting Sync Skipped: Missing Account 10103 or 20101');
            }
        } catch (jeError) {
            console.error('❌ Journal Entry Failed (Purchase Return):', jeError.message);
            // Don't fail the transaction, just log - accounting can be fixed later
        }

        // F. Update Return Status
        pr.status = 'returned';
        pr.approvedBy = req.user?._id;
        pr.approvedAt = new Date();
        await pr.save({ session });

        await session.commitTransaction();

        const populated = await PurchaseReturn.findById(pr._id)
            .populate('supplier', 'name code')
            .populate('warehouse', 'name')
            .populate('approvedBy', 'name');

        res.status(200).json({
            message: 'تمت الموافقة على المرتجع بنجاح',
            return: populated
        });

    } catch (error) {
        await session.abortTransaction();
        console.error('Approve Return Error:', error);
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
};

// 9. Update Return Status (Reject or other transitions)
export const updateReturnStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        const pr = await PurchaseReturn.findById(id);
        if (!pr) {
            return res.status(404).json({ message: 'مرتجع غير موجود' });
        }

        // Validate status transition
        const validTransitions = {
            'draft': ['pending_approval', 'rejected'],
            'pending_approval': ['returned', 'rejected'],
            'returned': [], // Final state
            'rejected': ['draft'] // Can revert to draft
        };

        if (!validTransitions[pr.status]?.includes(status)) {
            return res.status(400).json({
                message: `لا يمكن تغيير الحالة من ${pr.status} إلى ${status}`
            });
        }

        // If approving, use the atomic function
        if (status === 'returned') {
            return approvePurchaseReturn(req, res);
        }

        // Otherwise, simple status update
        pr.status = status;
        if (status === 'rejected' && rejectionReason) {
            pr.note = (pr.note || '') + `\n[رفض]: ${rejectionReason}`;
        }
        await pr.save();

        res.json({ message: 'تم تحديث الحالة', return: pr });

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
