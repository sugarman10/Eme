import SalesInvoice from '../models/SalesInvoice.js';
import Receipt from '../models/Receipt.js';
import Item from '../models/Item.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import { startOfDay, endOfDay } from '../utils/dateUtils.js';

/**
 * Drill-down endpoints for Dashboard KPIs
 * Provides detailed data listings with pagination and filtering
 */

export const getDrilldownInvoices = async (req, res) => {
  try {
    const { from, to, warehouseId, search, page = 1, limit = 10 } = req.query;

    // Build filter (same logic as dashboard summary)
    const filter = {
      status: { $nin: ['cancelled', 'void', 'draft'] },
    };

    if (from && to) {
      const startDate = startOfDay(new Date(from));
      const endDate = endOfDay(new Date(to));
      filter.date = { $gte: startDate, $lte: endDate };
    }

    if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
      filter.warehouse = new mongoose.Types.ObjectId(warehouseId);
    }

    if (search) {
      filter.$or = [
        { number: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [items, total] = await Promise.all([
      SalesInvoice.find(filter)
        .populate('customer', 'name code')
        .populate('warehouse', 'name')
        .select('number date customer warehouse totals status')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      SalesInvoice.countDocuments(filter),
    ]);

    res.json({
      items,
      page: parseInt(page),
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error('Drilldown invoices error:', error);
    res.status(500).json({ message: 'خطأ في تحميل الفواتير', error: error.message });
  }
};

export const getDrilldownReceipts = async (req, res) => {
  try {
    const { from, to, search, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (from && to) {
      const startDate = startOfDay(new Date(from));
      const endDate = endOfDay(new Date(to));
      filter.date = { $gte: startDate, $lte: endDate };
    }

    if (search) {
      filter.$or = [{ 'customer.name': { $regex: search, $options: 'i' } }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const [items, total] = await Promise.all([
      Receipt.find(filter)
        .populate('customer', 'name code')
        .select('customer date amount method note')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Receipt.countDocuments(filter),
    ]);

    res.json({
      items,
      page: parseInt(page),
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error('Drilldown receipts error:', error);
    res.status(500).json({ message: 'خطأ في تحميل سندات القبض', error: error.message });
  }
};

export const getDrilldownLowStock = async (req, res) => {
  try {
    const { warehouseId, search, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build aggregation pipeline for proper filtering
    const pipeline = [];

    // Match: Low stock items (totalStock <= minStock)
    const matchStage = {
      $expr: { $lte: ['$totalStock', '$minStock'] },
    };
    pipeline.push({ $match: matchStage });

    // Filter by warehouse if specified
    if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
      pipeline.push({
        $match: {
          'stocks.warehouse': new mongoose.Types.ObjectId(warehouseId),
        },
      });
    }

    // Search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }],
        },
      });
    }

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Item.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add sorting and pagination
    pipeline.push({ $sort: { totalStock: 1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    // Lookup category
    pipeline.push({
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryData',
      },
    });
    pipeline.push({
      $addFields: {
        category: { $arrayElemAt: ['$categoryData', 0] },
      },
    });

    // Project final fields
    pipeline.push({
      $project: {
        name: 1,
        sku: 1,
        totalStock: 1,
        minStock: 1,
        stocks: 1,
        price: 1,
        'category.name': 1,
      },
    });

    const items = await Item.aggregate(pipeline);

    res.json({
      items,
      page: parseInt(page),
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    logger.error('Drilldown low stock error:', error);
    res.status(500).json({ message: 'خطأ في تحميل المخزون المنخفض', error: error.message });
  }
};

/**
 * Financial Alerts Drilldown
 * Returns overdue receivables and high-debt customers
 */
export const getDrilldownAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const alerts = [];

    // 1. Overdue Receivables (90+ days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const overdueInvoices = await SalesInvoice.aggregate([
      {
        $match: {
          status: { $in: ['confirmed', 'posted'] },
          date: { $lt: ninetyDaysAgo },
          $expr: { $gt: [{ $subtract: ['$totals.grand', '$totals.paid'] }, 0.01] },
        },
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer',
          foreignField: '_id',
          as: 'customerData',
        },
      },
      {
        $unwind: { path: '$customerData', preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          number: 1,
          date: 1,
          customerName: { $ifNull: ['$customerData.name', 'عميل نقدي'] },
          remaining: { $subtract: ['$totals.grand', '$totals.paid'] },
        },
      },
      {
        $sort: { remaining: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.remaining, 0);

    if (overdueInvoices.length > 0) {
      alerts.push({
        id: 'overdue-90',
        title: 'مديونيات متأخرة +90 يوم',
        message: `إجمالي المديونيات المتأخرة أكثر من 90 يوماً: ${totalOverdue.toLocaleString('ar-LY')} د.ل`,
        severity: 'high',
        details: overdueInvoices.slice(0, 5).map((inv) => ({
          name: `فاتورة #${inv.number || inv._id?.toString().slice(-6)} - ${inv.customerName}`,
          amount: inv.remaining,
        })),
      });
    }

    // 2. High-debt customers (balance > 5000)
    const Customer = mongoose.model('Customer');
    const highDebtCustomers = await Customer.find({
      balance: { $gt: 5000 },
      isCashCustomer: { $ne: true },
    })
      .select('name code balance creditLimit')
      .sort({ balance: -1 })
      .limit(10);

    const totalHighDebt = highDebtCustomers.reduce((sum, c) => sum + (c.balance || 0), 0);

    if (highDebtCustomers.length > 0) {
      alerts.push({
        id: 'high-debt',
        title: 'عملاء بمديونية عالية',
        message: `${highDebtCustomers.length} عملاء بمديونيات كبيرة، الأعلى: ${highDebtCustomers[0]?.name} (${highDebtCustomers[0]?.balance?.toLocaleString('ar-LY')} د.ل)`,
        severity: 'medium',
        details: highDebtCustomers.slice(0, 5).map((c) => ({
          name: c.name,
          amount: c.balance,
        })),
      });
    }

    // 3. Customers exceeding credit limit
    const overLimitCustomers = await Customer.find({
      $expr: { $gt: ['$balance', '$creditLimit'] },
      creditLimit: { $gt: 0 },
      isCashCustomer: { $ne: true },
    })
      .select('name balance creditLimit')
      .sort({ balance: -1 })
      .limit(10);

    if (overLimitCustomers.length > 0) {
      alerts.push({
        id: 'over-credit-limit',
        title: 'تجاوز الحد الائتماني',
        message: `${overLimitCustomers.length} عملاء تجاوزوا الحد الائتماني المسموح`,
        severity: 'high',
        details: overLimitCustomers.slice(0, 5).map((c) => ({
          name: `${c.name} (حد: ${c.creditLimit?.toLocaleString('ar-LY')})`,
          amount: c.balance,
        })),
      });
    }

    // If no alerts, add a positive message
    if (alerts.length === 0) {
      alerts.push({
        id: 'all-good',
        title: 'لا توجد تنبيهات',
        message: 'جميع المؤشرات المالية في المستوى الطبيعي',
        severity: 'low',
        details: [],
      });
    }

    // Pagination simulation (alerts are few, so we just return all)
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedAlerts = alerts.slice(skip, skip + parseInt(limit));

    res.json({
      items: paginatedAlerts,
      page: parseInt(page),
      limit: parseInt(limit),
      total: alerts.length,
      totalPages: Math.ceil(alerts.length / parseInt(limit)),
    });
  } catch (error) {
    logger.error('Drilldown alerts error:', error);
    res.status(500).json({ message: 'خطأ في تحميل التنبيهات', error: error.message });
  }
};
