import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import SalesInvoice from '../models/SalesInvoice.js';
import StockLedger from '../models/StockLedger.js';
import Item from '../models/Item.js';
import { wrap } from '../middleware/asyncHandler.js';

const router = express.Router();

// ==================================================
// PROFITABILITY REPORT
import mongoose from 'mongoose';
// ==================================================
/**
 * GET /reports/profitability
 * 
 * Calculate profitability by product category
 * Query: from, to (ISO dates)
 */
router.get('/profitability',
    requireAuth(),
    wrap(async (req, res) => {
        const { from, to } = req.query;
        const dateFilter = {};

        if (from) dateFilter.$gte = new Date(from);
        if (to) {
            const endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
            dateFilter.$lte = endDate;
        }

        const match = {};
        if (from || to) match.date = dateFilter;
        if (req.query.warehouse) match.warehouse = new mongoose.Types.ObjectId(req.query.warehouse);

        // Aggregate sales by category
        const salesData = await SalesInvoice.aggregate([
            { $match: match },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'items',
                    localField: 'items.item',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            { $unwind: '$itemDetails' },
            {
                $group: {
                    _id: '$itemDetails.category',
                    revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
                    cost: { $sum: { $multiply: ['$itemDetails.cost', '$items.qty'] } },
                    quantity: { $sum: '$items.qty' },
                    transactions: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    category: '$_id',
                    revenue: { $round: ['$revenue', 2] },
                    cost: { $round: ['$cost', 2] },
                    grossProfit: { $round: [{ $subtract: ['$revenue', '$cost'] }, 2] },
                    margin: {
                        $round: [
                            { $multiply: [{ $divide: [{ $subtract: ['$revenue', '$cost'] }, '$revenue'] }, 100] },
                            2
                        ]
                    },
                    quantity: 1,
                    transactions: 1
                }
            },
            { $sort: { grossProfit: -1 } }
        ]);

        // Calculate totals
        const totals = salesData.reduce((acc, item) => ({
            revenue: acc.revenue + item.revenue,
            cost: acc.cost + item.cost,
            grossProfit: acc.grossProfit + item.grossProfit,
            quantity: acc.quantity + item.quantity,
            transactions: acc.transactions + item.transactions
        }), { revenue: 0, cost: 0, grossProfit: 0, quantity: 0, transactions: 0 });

        res.json({
            period: { from: from || 'beginning', to: to || 'now' },
            byCategory: salesData,
            totals: {
                ...totals,
                margin: totals.revenue > 0 ? ((totals.grossProfit / totals.revenue) * 100).toFixed(2) : 0
            }
        });
    })
);

// ==================================================
// TOP PRODUCTS REPORT
// ==================================================
/**
 * GET /reports/top-products
 * 
 * Get top selling products
 * Query: from, to, limit (default 10), sortBy (revenue|quantity)
 */
router.get('/top-products',
    requireAuth(),
    wrap(async (req, res) => {
        const { from, to, limit = 10, sortBy = 'revenue' } = req.query;
        const dateFilter = {};

        if (from) dateFilter.$gte = new Date(from);
        if (to) {
            const endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
            dateFilter.$lte = endDate;
        }

        const match = {};
        if (from || to) match.date = dateFilter;
        if (req.query.warehouse) match.warehouse = new mongoose.Types.ObjectId(req.query.warehouse);

        const sortField = sortBy === 'quantity' ? 'quantity' : 'revenue';

        const topProducts = await SalesInvoice.aggregate([
            { $match: match },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'items',
                    localField: 'items.item',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            { $unwind: '$itemDetails' },
            {
                $group: {
                    _id: '$items.item',
                    productName: { $first: '$itemDetails.name' },
                    sku: { $first: '$itemDetails.sku' },
                    category: { $first: '$itemDetails.category' },
                    revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
                    cost: { $sum: { $multiply: ['$itemDetails.cost', '$items.qty'] } },
                    quantity: { $sum: '$items.qty' },
                    transactions: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    productId: '$_id',
                    productName: 1,
                    sku: 1,
                    category: 1,
                    revenue: { $round: ['$revenue', 2] },
                    cost: { $round: ['$cost', 2] },
                    profit: { $round: [{ $subtract: ['$revenue', '$cost'] }, 2] },
                    quantity: 1,
                    transactions: 1
                }
            },
            { $sort: { [sortField]: -1 } },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            period: { from: from || 'beginning', to: to || 'now' },
            sortedBy: sortBy,
            products: topProducts
        });
    })
);

// ==================================================
// INVENTORY VALUATION REPORT
// ==================================================
/**
 * GET /reports/inventory-value
 * 
 * Calculate current inventory value by warehouse
 */
router.get('/inventory-value',
    requireAuth(),
    wrap(async (req, res) => {
        const match = {};
        if (req.query.warehouse) match.warehouse = new mongoose.Types.ObjectId(req.query.warehouse);

        // Get current stock balances with item details
        const stockData = await StockLedger.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { item: '$item', warehouse: '$warehouse' },
                    balance: { $sum: '$qty' }
                }
            },
            {
                $match: { balance: { $gt: 0 } } // Only positive balances
            },
            {
                $lookup: {
                    from: 'items',
                    localField: '_id.item',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            { $unwind: '$itemDetails' },
            {
                $lookup: {
                    from: 'warehouses',
                    localField: '_id.warehouse',
                    foreignField: '_id',
                    as: 'warehouseDetails'
                }
            },
            { $unwind: '$warehouseDetails' },
            {
                $project: {
                    _id: 0,
                    warehouse: '$warehouseDetails.name',
                    warehouseCode: '$warehouseDetails.code',
                    itemName: '$itemDetails.name',
                    sku: '$itemDetails.sku',
                    category: '$itemDetails.category',
                    quantity: '$balance',
                    unitCost: '$itemDetails.cost',
                    totalValue: { $multiply: ['$balance', '$itemDetails.cost'] }
                }
            }
        ]);

        // Group by warehouse
        const byWarehouse = stockData.reduce((acc, item) => {
            const wh = item.warehouse;
            if (!acc[wh]) {
                acc[wh] = { warehouse: wh, code: item.warehouseCode, items: [], totalValue: 0 };
            }
            acc[wh].items.push(item);
            acc[wh].totalValue += item.totalValue;
            return acc;
        }, {});

        // Calculate totals
        const totalInventoryValue = Object.values(byWarehouse).reduce((sum, wh) => sum + wh.totalValue, 0);

        res.json({
            byWarehouse: Object.values(byWarehouse).map(wh => ({
                warehouse: wh.warehouse,
                code: wh.code,
                itemCount: wh.items.length,
                totalValue: wh.totalValue.toFixed(2),
                items: wh.items.map(i => ({
                    ...i,
                    totalValue: i.totalValue.toFixed(2),
                    unitCost: i.unitCost.toFixed(2)
                }))
            })),
            totals: {
                totalInventoryValue: totalInventoryValue.toFixed(2),
                totalItems: stockData.length
            }
        });
    })
);

// ==================================================
// CASH FLOW REPORT  
// ==================================================
/**
 * GET /reports/cash-flow
 * 
 * Simple cash flow: sales - expenses
 * Query: from, to
 */
router.get('/cash-flow',
    requireAuth(),
    wrap(async (req, res) => {
        const { from, to } = req.query;
        const dateFilter = {};

        if (from) dateFilter.$gte = new Date(from);
        if (to) {
            const endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
            dateFilter.$lte = endDate;
        }

        const match = {};
        if (from || to) match.date = dateFilter;
        if (req.query.warehouse) match.warehouse = new mongoose.Types.ObjectId(req.query.warehouse);

        // Get sales (cash receipts)
        const salesInflow = await SalesInvoice.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: '$totals.grand' },
                    cashReceived: { $sum: '$totals.paid' }
                }
            }
        ]);

        const sales = salesInflow[0] || { totalSales: 0, cashReceived: 0 };

        // Note: Expenses would come from a separate expenses collection if exists
        // For now, we'll return sales data

        res.json({
            period: { from: from || 'beginning', to: to || 'now' },
            inflows: {
                cashSales: sales.cashReceived.toFixed(2),
                totalSales: sales.totalSales.toFixed(2),
                creditSales: (sales.totalSales - sales.cashReceived).toFixed(2)
            },
            // outflows would be from expenses/purchases
            outflows: {
                note: 'Implement expenses tracking for full cash flow'
            },
            netCashFlow: sales.cashReceived.toFixed(2)
        });
    })
);

// ==================================================
// DAILY SALES REPORT (Moved from sales.js)
// ==================================================
// GET /reports/daily?from=YYYY-MM-DD&to=YYYY-MM-DD&channel=all|wholesale|retail
router.get('/daily', requireAuth(), wrap(async (req, res) => {
    try {
        const fromStr = req.query.from;
        const toStr = req.query.to;
        const channel = (req.query.channel || 'all');

        const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 6 * 24 * 3600e3);
        const to = toStr ? new Date(toStr) : new Date();
        // make to inclusive: set to end of day
        to.setHours(23, 59, 59, 999);

        const match = {
            date: { $gte: from, $lte: to },
            status: 'posted'
        };
        if (channel === 'wholesale' || channel === 'retail') match.channel = channel;
        if (req.query.warehouse) match.warehouse = new mongoose.Types.ObjectId(req.query.warehouse);

        // aggregate by date and channel
        const agg = await SalesInvoice.aggregate([
            { $match: match },
            { $project: { date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, channel: 1, grand: "$totals.grand" } },
            { $group: { _id: { date: "$date", channel: "$channel" }, total: { $sum: { $ifNull: ["$grand", 0] } } } },
            { $group: { _id: "$_id.date", byChannel: { $push: { k: "$_id.channel", v: "$total" } }, total: { $sum: "$total" } } },
            { $project: { date: "$_id", totals: { $arrayToObject: "$byChannel" }, grand: "$total", _id: 0 } },
            { $sort: { date: 1 } }
        ]).exec();

        // build map for quick lookup
        const map = Object.fromEntries(agg.map(a => [a.date, a]));

        // helper: produce array of dates between from..to inclusive
        const days = [];
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const key = `${yyyy}-${mm}-${dd}`;
            const entry = map[key] || { date: key, totals: {}, grand: 0 };
            days.push({ date: key, wholesale: entry.totals?.wholesale || 0, retail: entry.totals?.retail || 0, grand: entry.grand || 0 });
        }

        res.json(days);
    } catch (err) {
        console.error('Failed to generate daily sales report:', err);
        res.status(500).json({ message: 'Failed to generate report' });
    }
}));

// ==================================================
// DASHBOARD STATS (New V2 Endpoint)
// ==================================================
// GET /reports/stats?warehouse=ID
router.get('/stats', requireAuth(), wrap(async (req, res) => {
    const warehouseId = req.query.warehouse;
    const match = { status: 'posted' };

    if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
        match.warehouse = new mongoose.Types.ObjectId(warehouseId);
    }

    // 1. Total Revenue & Orders
    const salesStats = await SalesInvoice.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$totals.grand' },
                totalOrders: { $sum: 1 }
            }
        }
    ]);

    // 2. Low Stock Count
    // If warehouse selected, check specific pool. If global, check totalStock.
    const stockMatch = { $expr: { $lte: ['$totalStock', '$minLevel'] } };

    // For specific warehouse, we need to inspect the 'stocks' array
    // This is more complex in aggregate, so for MVP V2 we'll use a simplified check or global alert for now
    // Ideally: unwind stocks, match warehouse, check qty <= minLevel
    let lowStockCount = 0;
    if (warehouseId) {
        const lowStockItems = await Item.aggregate([
            { $unwind: '$stocks' },
            {
                $match: {
                    'stocks.warehouse': new mongoose.Types.ObjectId(warehouseId),
                    $expr: { $lte: ['$stocks.qty', '$minLevel'] }
                }
            },
            { $count: 'count' }
        ]);
        lowStockCount = lowStockItems[0]?.count || 0;
    } else {
        lowStockCount = await Item.countDocuments({ $expr: { $lte: ['$totalStock', '$minLevel'] } });
    }

    // 3. Total Customers (Always Global)
    // We need to import Customer model if we want accurate count, or just count distinct customers in invoices
    // Requirement says "Total Customers (Global)". Let's count from Customer model if possible,
    // but we didn't import it at the top. Let's lazily import or assume it's available.
    // Actually, 'import' checks top of file. I see 'Item' imported. 'Customer' is NOT imported in reports.js.
    // I will use mongoose.model('Customer') to avoid top-level import drift if I can't edit top
    const Customer = mongoose.model('Customer');
    const totalCustomers = await Customer.countDocuments({});

    // 4. Recent Transactions
    const recentTransactions = await SalesInvoice.find(match)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('customer', 'name')
        .lean();

    res.json({
        totalRevenue: salesStats[0]?.totalRevenue || 0,
        totalOrders: salesStats[0]?.totalOrders || 0,
        totalCustomers,
        lowStockCount,
        recentTransactions: recentTransactions.map(t => ({
            id: t._id,
            number: t.number || t._id.toString().slice(-6),
            customer: t.customer?.name || 'Walk-in Customer',
            total: t.totals.grand,
            status: t.status,
            date: t.createdAt
        }))
    });
}));

export default router;
