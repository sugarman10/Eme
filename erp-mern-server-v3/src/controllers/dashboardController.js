import SalesInvoice from '../models/SalesInvoice.js';
import SalesReturn from '../models/SalesReturn.js';
import Receipt from '../models/Receipt.js';
import Customer from '../models/Customer.js';
import Item from '../models/Item.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import { getDateRangeWithPrevious, calculateTrend } from '../utils/dateUtils.js';

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export const getDashboardSummary = async (req, res) => {
    try {
        const { from, to, warehouseId, fastMode } = req.query;



        // FAST MODE: Return minimal data for debugging
        if (fastMode === 'true') {

            return res.json({
                kpis: {
                    totalSales: { value: '0.00', trend: 0 },
                    totalReceipts: { value: '0.00', trend: 0 },
                    invoiceCount: { value: 0, trend: 0 },
                    customersCount: { value: 0, trend: 0 },
                    lowStockCount: { value: 0, trend: null }
                },
                charts: { salesByDay: [], topProducts: [], categoryShare: [] },
                tables: { recentInvoices: [], lowStockAlerts: [] },
                alerts: [],
                meta: { from, to, warehouseId, fastMode: true }
            });
        }

        // Cache Key
        const cacheKey = `summary_${from}_${to}_${warehouseId || 'all'}`;
        if (cache.has(cacheKey)) {
            const cachedData = cache.get(cacheKey);
            if (Date.now() - cachedData.timestamp < CACHE_TTL_MS) {

                return res.json(cachedData.data);
            } else {
                cache.delete(cacheKey);
            }
        }



        // 1. Calculate Periods using dateUtils
        const dateRange = getDateRangeWithPrevious(from, to);
        const { start: startDate, end: endDate } = dateRange.current;
        const { start: prevStartDate, end: prevEndDate } = dateRange.previous;

        logger.debug('📅 Date range:', {
            current: { start: startDate, end: endDate },
            previous: { start: prevStartDate, end: prevEndDate }
        });

        // 2. Build Match Filters
        const currentMatch = {
            date: { $gte: startDate, $lte: endDate },
            status: { $nin: ['cancelled', 'void', 'draft'] } // Only confirmed/posted
        };
        const prevMatch = {
            date: { $gte: prevStartDate, $lte: prevEndDate },
            status: { $nin: ['cancelled', 'void', 'draft'] }
        };

        if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
            currentMatch.warehouse = new mongoose.Types.ObjectId(warehouseId);
            prevMatch.warehouse = new mongoose.Types.ObjectId(warehouseId);
        }

        // 3. Simple Aggregations with 10s timeout

        const QUERY_TIMEOUT = 10000; // 10 seconds max per query

        // Helper function for safe queries
        const safeQuery = async (name, queryFn, fallback = null) => {
            try {
                const result = await queryFn();
                return result;
            } catch (err) {
                return fallback;
            }
        };

        // Run essential queries only (simplified)
        const [
            currSales,
            currReceipts,
            customersCount,
            lowStockItems,
            recentInvoices,
            // V2.0: New aggregations for financial health
            currReturns,
            grossProfit,
            profitReversal
        ] = await Promise.all([
            // Sales Total & Count (with timeout)
            safeQuery('Sales', () =>
                SalesInvoice.aggregate([
                    { $match: currentMatch },
                    { $group: { _id: null, total: { $sum: '$totals.grand' }, count: { $sum: 1 } } }
                ]).option({ maxTimeMS: QUERY_TIMEOUT })
                , []),

            // Receipts Total
            safeQuery('Receipts', () =>
                Receipt.aggregate([
                    { $match: { date: { $gte: startDate, $lte: endDate } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]).option({ maxTimeMS: QUERY_TIMEOUT })
                , []),

            // Total Customers
            safeQuery('Customers', () =>
                Customer.countDocuments({}).maxTimeMS(QUERY_TIMEOUT)
                , 0),

            // Low Stock Items
            safeQuery('LowStock', () =>
                Item.countDocuments({ $expr: { $lte: ['$totalStock', '$minStock'] } }).maxTimeMS(QUERY_TIMEOUT)
                , 0),

            // Recent Invoices (limit 5 for speed)
            safeQuery('RecentInvoices', () =>
                SalesInvoice.find(currentMatch)
                    .sort({ date: -1 })
                    .limit(5)
                    .select('number date totals.grand status')
                    .maxTimeMS(QUERY_TIMEOUT)
                    .lean()
                , []),

            // V2.0: Total Returns (status: 'returned')
            safeQuery('Returns', () =>
                SalesReturn.aggregate([
                    { $match: { status: 'returned', date: { $gte: startDate, $lte: endDate } } },
                    { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
                ]).option({ maxTimeMS: QUERY_TIMEOUT })
                , []),

            // V2.0: Gross Profit from Invoices = SUM((price - cost) * qty)
            safeQuery('GrossProfit', () =>
                SalesInvoice.aggregate([
                    { $match: currentMatch },
                    { $unwind: '$items' },
                    {
                        $group: {
                            _id: null,
                            profit: {
                                $sum: {
                                    $multiply: [
                                        { $subtract: [{ $ifNull: ['$items.price', 0] }, { $ifNull: ['$items.cost', 0] }] },
                                        { $ifNull: ['$items.qty', 0] }
                                    ]
                                }
                            }
                        }
                    }
                ]).option({ maxTimeMS: QUERY_TIMEOUT })
                , []),

            // V2.0: Profit Reversal from Returns = SUM((unitPrice - cost) * qty)
            safeQuery('ProfitReversal', () =>
                SalesReturn.aggregate([
                    { $match: { status: 'returned', date: { $gte: startDate, $lte: endDate } } },
                    { $unwind: '$items' },
                    { $lookup: { from: 'items', localField: 'items.item', foreignField: '_id', as: 'itemDoc' } },
                    { $unwind: { path: '$itemDoc', preserveNullAndEmptyArrays: true } },
                    {
                        $group: {
                            _id: null,
                            reversal: {
                                $sum: {
                                    $multiply: [
                                        { $subtract: [{ $ifNull: ['$items.unitPrice', 0] }, { $ifNull: ['$itemDoc.cost', 0] }] },
                                        { $ifNull: ['$items.qty', 0] }
                                    ]
                                }
                            }
                        }
                    }
                ]).option({ maxTimeMS: QUERY_TIMEOUT })
                , [])
        ]);

        // Previous period values (default to 0 for simplicity)
        const prevSales = [{ total: 0, count: 0 }];
        const prevReceipts = [{ total: 0 }];
        const prevCustomers = 0;

        // Charts data - Load actual chart data IN PARALLEL for performance
        // Using Promise.allSettled to handle partial failures gracefully
        const chartResults = await Promise.allSettled([
            // 4a. Sales by Day (for Area Chart)
            SalesInvoice.aggregate([
                { $match: currentMatch },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                        total: { $sum: '$totals.grand' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $limit: 31 } // Max 31 days
            ]).option({ maxTimeMS: 5000 }),

            // 4b. Top Products (for Bar Chart)
            SalesInvoice.aggregate([
                { $match: currentMatch },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: '$items.item',
                        totalQty: { $sum: '$items.qty' },
                        totalRevenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } }
                    }
                },
                { $sort: { totalRevenue: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: 'items',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'item'
                    }
                },
                { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        name: { $ifNull: ['$item.name', 'منتج محذوف'] },
                        qty: '$totalQty',
                        revenue: '$totalRevenue'
                    }
                }
            ]).option({ maxTimeMS: 5000 }),

            // 4c. Category Share (for Pie Chart)
            SalesInvoice.aggregate([
                { $match: currentMatch },
                { $unwind: '$items' },
                {
                    $lookup: {
                        from: 'items',
                        localField: 'items.item',
                        foreignField: '_id',
                        as: 'itemDoc'
                    }
                },
                { $unwind: { path: '$itemDoc', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'itemDoc.category',
                        foreignField: '_id',
                        as: 'categoryDoc'
                    }
                },
                { $unwind: { path: '$categoryDoc', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: { $ifNull: ['$categoryDoc.name', 'بدون تصنيف'] },
                        value: { $sum: { $multiply: ['$items.qty', '$items.price'] } }
                    }
                },
                { $sort: { value: -1 } },
                { $limit: 6 }
            ]).option({ maxTimeMS: 5000 }),

            // V2.0: 4d. Returns by Day (for dual-line chart)
            SalesReturn.aggregate([
                { $match: { status: 'returned', date: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                        total: { $sum: '$totalAmount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $limit: 31 }
            ]).option({ maxTimeMS: 5000 })
        ]);

        // Extract results with fallbacks for failed queries
        const salesByDay = chartResults[0].status === 'fulfilled' ? chartResults[0].value : [];
        const topProducts = chartResults[1].status === 'fulfilled' ? chartResults[1].value : [];
        const categoryShare = chartResults[2].status === 'fulfilled' ? chartResults[2].value : [];
        const returnsByDay = chartResults[3].status === 'fulfilled' ? chartResults[3].value : []; // V2.0

        // Log any chart query failures
        chartResults.forEach((result, idx) => {
            if (result.status === 'rejected') {
                const names = ['salesByDay', 'topProducts', 'categoryShare', 'returnsByDay'];
                logger.warn(`Failed to fetch ${names[idx]}:`, result.reason?.message);
            }
        });

        // 4. Low Stock Alerts Table - Fetch actual items with low stock
        let lowStockList = [];
        if (lowStockItems > 0) {
            try {
                lowStockList = await Item.find({
                    $expr: { $lte: ['$totalStock', '$minStock'] }
                })
                    .select('name sku totalStock minStock')
                    .limit(10)
                    .lean()
                    .maxTimeMS(5000);
            } catch (err) {
                logger.warn('Failed to fetch low stock list:', err.message);
            }
        }

        logger.info('✅ Dashboard queries completed', { lowStockCount: lowStockList.length });

        // 5. Structure Response
        const formatMoney = (n) => Number(n || 0).toFixed(2);

        const cSalesVal = currSales[0]?.total || 0;
        const pSalesVal = prevSales[0]?.total || 0;

        const cInvCount = currSales[0]?.count || 0;
        const pInvCount = prevSales[0]?.count || 0;

        const cRcptVal = currReceipts[0]?.total || 0;
        const pRcptVal = prevReceipts[0]?.total || 0;

        // Low stock is a snapshot, trend is tricky. Compare to 0 or just show count? 
        // We can't easily know "Low Stock Count" in the past without audit logs.
        // We'll set previous low stock to null or 0 (no trend).

        // Customers Count Trend: Total Now vs Total Start of Period
        const pCustCount = prevCustomers;
        const cCustCount = customersCount;

        // V2.0: Extract Returns and Profit values
        const cReturnsVal = currReturns[0]?.total || 0;
        const cReturnsCount = currReturns[0]?.count || 0;
        const cGrossProfit = grossProfit[0]?.profit || 0;
        const cProfitReversal = profitReversal[0]?.reversal || 0;
        const cNetSales = cSalesVal - cReturnsVal;
        const cFinalProfit = cGrossProfit - cProfitReversal;

        const calcTrend = (curr, prev) => {
            if (prev === 0) return curr > 0 ? null : 0;
            return ((curr - prev) / prev) * 100;
        };

        const trends = {
            salesTotal: calcTrend(cSalesVal, pSalesVal),
            invoicesCount: calcTrend(cInvCount, pInvCount),
            receiptsTotal: calcTrend(cRcptVal, pRcptVal),
            customersCount: calcTrend(cCustCount, pCustCount),
            lowStockCount: null
        };

        // 6. Generate Smart Alerts
        const alerts = [];

        // Alert 1: Sales Drop
        const salesTrend = trends.salesTotal;
        if (salesTrend !== null && salesTrend !== undefined && salesTrend <= -10 && pSalesVal > 0) {
            const severity = salesTrend <= -20 ? 'high' : 'medium';
            alerts.push({
                id: 'sales_drop',
                title: 'هبوط في المبيعات',
                severity,
                message: `انخفضت المبيعات بنسبة ${Math.abs(salesTrend).toFixed(1)}٪ مقارنة بالفترة السابقة`,
                metric: { current: cSalesVal, previous: pSalesVal, trend: salesTrend },
                action: { type: 'drilldown', tab: 'invoices' }
            });
        }

        // Alert 2: Aging 90+ (Calculate from invoices with remaining > 0)
        const agingInvoices = await SalesInvoice.find({
            'totals.remaining': { $gt: 0 },
            status: { $nin: ['cancelled', 'void', 'draft'] }
        }).select('customer totals date');

        let aging90Plus = 0;
        const now = endDate;
        agingInvoices.forEach(inv => {
            const daysSince = Math.floor((now - new Date(inv.date)) / (1000 * 60 * 60 * 24));
            if (daysSince >= 90) {
                aging90Plus += inv.totals.remaining || 0;
            }
        });

        if (aging90Plus > 0) {
            const severity = aging90Plus > 10000 ? 'high' : 'medium';
            alerts.push({
                id: 'aging_90_plus',
                title: 'مديونيات متأخرة +90 يوم',
                severity,
                message: `إجمالي المديونيات المتأخرة أكثر من 90 يوم: ${aging90Plus.toLocaleString('ar-LY')} د.ل`,
                metric: { total: aging90Plus, threshold: 90 },
                action: { type: 'drilldown', tab: 'receipts' }
            });
        }

        // Alert 3: Low Stock
        if (lowStockItems > 0) {
            alerts.push({
                id: 'low_stock',
                title: 'مخزون منخفض',
                severity: 'medium',
                message: `يوجد ${lowStockItems} صنف أقل من الحد الأدنى`,
                metric: { count: lowStockItems, items: lowStockList.slice(0, 5).map(i => ({ name: i.name, sku: i.sku, stock: i.totalStock, min: i.minStock })) },
                action: { type: 'drilldown', tab: 'lowStock' }
            });
        }

        // Alert 4: Customer Risk (Top 5 by remaining balance)
        const customerRisks = await SalesInvoice.aggregate([
            { $match: { 'totals.remaining': { $gt: 0 }, status: { $nin: ['cancelled', 'void', 'draft'] } } },
            { $group: { _id: '$customer', totalRemaining: { $sum: '$totals.remaining' } } },
            { $sort: { totalRemaining: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
            { $unwind: '$customer' },
            { $project: { customerId: '$_id', name: '$customer.name', code: '$customer.code', totalRemaining: 1 } }
        ]);

        if (customerRisks.length > 0) {
            const topRisk = customerRisks[0];
            const severity = topRisk.totalRemaining > 5000 ? 'medium' : 'low';
            alerts.push({
                id: 'customer_risk',
                title: 'عملاء بمديونية عالية',
                severity,
                message: `${customerRisks.length} عملاء بمديونيات كبيرة، الأعلى: ${topRisk.name} (${topRisk.totalRemaining.toLocaleString('ar-LY')} د.ل)`,
                metric: { topCustomers: customerRisks.map(c => ({ name: c.name, code: c.code, remaining: c.totalRemaining })) },
                action: { type: 'drilldown', tab: 'invoices' }
            });
        }

        // V2.0: Merge Sales and Returns by Day for dual-line chart
        const allDates = new Set([...salesByDay.map(d => d._id), ...returnsByDay.map(d => d._id)]);
        const salesMap = new Map(salesByDay.map(d => [d._id, d.total]));
        const returnsMap = new Map(returnsByDay.map(d => [d._id, d.total]));
        const mergedChartData = [...allDates].sort().map(date => ({
            date,
            sales: salesMap.get(date) || 0,
            returns: returnsMap.get(date) || 0
        }));

        const response = {
            kpis: {
                salesTotal: cSalesVal,
                // V2.0: New financial health metrics
                returnsTotal: cReturnsVal,
                netSales: cNetSales,
                grossProfit: cFinalProfit,
                // Legacy metrics (still available)
                invoicesCount: cInvCount,
                receiptsTotal: cRcptVal,
                customersCount: cCustCount,
                lowStockCount: lowStockItems
            },
            previousPeriod: {
                salesTotal: pSalesVal,
                invoicesCount: pInvCount,
                receiptsTotal: pRcptVal,
                customersCount: pCustCount,
                lowStockCount: null // Not tracked
            },
            trends,
            charts: {
                // V2.0: Dual-line chart data (sales + returns per day)
                salesByDay: mergedChartData,
                topProducts,
                categoryShare: categoryShare.map(c => ({ name: c._id, value: c.value }))
            },
            tables: {
                recentInvoices,
                lowStockAlerts: lowStockList
            },
            alerts // NEW: Smart Alerts
        };

        // Update Cache
        cache.set(cacheKey, { timestamp: Date.now(), data: response });

        res.json(response);
    } catch (error) {
        logger.error('Dashboard Error:', error);
        res.status(500).json({ message: 'Error loading dashboard', error: error.message });
    }
};

/**
 * Export Dashboard as PDF with charts as images
 * POST /api/dashboard/export/pdf
 */
export const exportDashboardPdf = async (req, res) => {
    try {
        const { from, to, warehouseId, includeAlerts = true, chartImages = {} } = req.body;

        // 1. Validate date params
        if (!from || !to) {
            return res.status(400).json({ message: 'يجب تحديد تاريخ البداية والنهاية' });
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from) || !dateRegex.test(to)) {
            return res.status(400).json({ message: 'صيغة التاريخ غير صحيحة. استخدم YYYY-MM-DD' });
        }

        if (warehouseId && !mongoose.isValidObjectId(warehouseId)) {
            return res.status(400).json({ message: 'معرف المستودع غير صحيح' });
        }

        // 2. Validate chartImages (base64 + size limits)
        const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image
        const MAX_TOTAL_SIZE = 12 * 1024 * 1024; // 12MB total

        let totalSize = 0;
        const validatedChartImages = {};

        for (const [key, base64Data] of Object.entries(chartImages)) {
            if (!base64Data) continue;

            const base64Regex = /^[A-Za-z0-9+/=]+$/;
            if (!base64Regex.test(base64Data)) {
                return res.status(400).json({
                    message: `صورة الرسم البياني "${key}" بصيغة غير صحيحة`
                });
            }

            const sizeBytes = Math.ceil((base64Data.length * 3) / 4);

            if (sizeBytes > MAX_IMAGE_SIZE) {
                return res.status(400).json({
                    message: `صورة الرسم البياني "${key}" تتجاوز الحد الأقصى (5 ميجابايت)`
                });
            }

            totalSize += sizeBytes;
            validatedChartImages[key] = base64Data;
        }

        if (totalSize > MAX_TOTAL_SIZE) {
            return res.status(400).json({
                message: `حجم الصور الإجمالي يتجاوز الحد الأقصى (12 ميجابايت)`
            });
        }

        // 3. Get dashboard data
        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date(from);
        startDate.setHours(0, 0, 0, 0);
        const duration = endDate.getTime() - startDate.getTime();
        const prevEndDate = new Date(startDate.getTime() - 1);
        const prevStartDate = new Date(prevEndDate.getTime() - duration);

        const currentMatch = {
            date: { $gte: startDate, $lte: endDate },
            status: { $nin: ['cancelled', 'void', 'draft'] }
        };
        const prevMatch = {
            date: { $gte: prevStartDate, $lte: prevEndDate },
            status: { $nin: ['cancelled', 'void', 'draft'] }
        };

        if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
            currentMatch.warehouse = new mongoose.Types.ObjectId(warehouseId);
            prevMatch.warehouse = new mongoose.Types.ObjectId(warehouseId);
        }

        const [currentSales, prevSales] = await Promise.all([
            SalesInvoice.aggregate([
                { $match: currentMatch },
                { $group: { _id: null, total: { $sum: '$totals.grand' }, count: { $sum: 1 } } }
            ]),
            SalesInvoice.aggregate([
                { $match: prevMatch },
                { $group: { _id: null, total: { $sum: '$totals.grand' }, count: { $sum: 1 } } }
            ])
        ]);

        const salesCurr = currentSales[0] || { total: 0, count: 0 };
        const salesPrev = prevSales[0] || { total: 0, count: 0 };
        const salesTrend = salesPrev.total > 0
            ? ((salesCurr.total - salesPrev.total) / salesPrev.total) * 100
            : 0;

        const receiptsAgg = await Receipt.aggregate([
            { $match: currentMatch },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const receiptsTotal = receiptsAgg[0]?.total || 0;

        const lowStockCount = await Item.countDocuments({
            $expr: { $lte: ['$totalStock', '$reorderLevel'] },
            reorderLevel: { $gt: 0 }
        });

        const kpis = {
            salesRevenue: salesCurr.total,
            salesCount: salesCurr.count,
            receiptsTotal,
            lowStockCount
        };

        const trends = { sales: salesTrend };

        const alerts = [];
        if (includeAlerts) {
            if (salesTrend < -15) {
                alerts.push({
                    severity: 'high',
                    title: 'انخفاض المبيعات',
                    message: `انخفضت المبيعات بنسبة ${Math.abs(salesTrend).toFixed(1)}% مقارنة بالفترة السابقة`
                });
            }
            if (lowStockCount > 0) {
                alerts.push({
                    severity: 'medium',
                    title: 'مخزون منخفض',
                    message: `${lowStockCount} منتج تحت حد إعادة الطلب`
                });
            }
        }

        // 4. Prepare metadata
        let warehouseName = 'كل المستودعات';
        if (warehouseId) {
            const Warehouse = mongoose.model('Warehouse');
            const wh = await Warehouse.findById(warehouseId);
            warehouseName = wh?.name || warehouseName;
        }

        const meta = {
            from,
            to,
            warehouseName,
            exportDate: new Date().toLocaleDateString('ar-LY', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            includeAlerts
        };

        const data = { kpis, trends, alerts };

        // 5. Generate PDF
        const { generateDashboardPdfHtml, generatePdfFromHtml } = await import('../services/pdfService.js');
        const html = generateDashboardPdfHtml(data, meta, validatedChartImages);

        const pdfBuffer = await generatePdfFromHtml(html);

        if (!pdfBuffer || pdfBuffer.length === 0) {
            return res.status(500).json({ message: 'فشل إنشاء PDF' });
        }

        // 6. Stream PDF response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', `attachment; filename="dashboard-${from}.pdf"`);
        res.end(pdfBuffer);

    } catch (error) {
        logger.error('PDF Export Error:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير PDF' });
    }
};
