import express from 'express';
import mongoose from 'mongoose';
import DailyClosure from '../models/DailyClosure.js';
import SalesInvoice from '../models/SalesInvoice.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap } from '../middleware/asyncHandler.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * Helper: Get start and end of a specific date
 * Uses Libya timezone (UTC+2) for accurate date calculations
 */
function getDateBounds(dateStr) {
    // Parse date as Libya local time (UTC+2)
    const [year, month, day] = dateStr.split('-').map(Number);

    // Create date at midnight Libya time (UTC+2)
    // Libya is UTC+2, so midnight Libya = 22:00 UTC previous day
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    startOfDay.setHours(startOfDay.getHours() - 2); // Adjust for Libya UTC+2

    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    endOfDay.setHours(endOfDay.getHours() - 2); // Adjust for Libya UTC+2

    return { startOfDay, endOfDay };
}

/**
 * Helper: Calculate day summary from invoices
 */
async function calculateDaySummary(dateStr) {
    const { startOfDay, endOfDay } = getDateBounds(dateStr);

    // Fetch all invoices for this day - check BOTH date and createdAt fields
    // to handle cases where date field wasn't set correctly
    const invoices = await SalesInvoice.find({
        $or: [
            { date: { $gte: startOfDay, $lte: endOfDay } },
            { createdAt: { $gte: startOfDay, $lte: endOfDay } }
        ],
        status: { $in: ['confirmed', 'posted', 'paid'] }
    }).populate('customer', 'name').lean();

    // Calculate summary
    const summary = {
        invoiceCount: invoices.length,
        totalSales: 0,
        totalPaid: 0,
        totalDue: 0,
        byChannel: { wholesale: 0, retail: 0 },
        byPaymentMethod: { cash: 0, card: 0, bank: 0, split: 0 }
    };

    const invoiceDetails = [];

    for (const inv of invoices) {
        const grand = inv.totals?.grand || 0;
        const paid = inv.totals?.paid || 0;
        const remaining = grand - paid;

        summary.totalSales += grand;
        summary.totalPaid += paid;
        summary.totalDue += remaining;

        // By channel
        if (inv.channel === 'wholesale') {
            summary.byChannel.wholesale += grand;
        } else {
            summary.byChannel.retail += grand;
        }

        // By payment method
        const method = inv.paymentMethod || 'cash';
        if (summary.byPaymentMethod[method] !== undefined) {
            summary.byPaymentMethod[method] += paid;
        }

        invoiceDetails.push({
            _id: inv._id,
            number: inv.number || inv._id.toString().slice(-6),
            customer: inv.customer?.name || 'عميل نقدي',
            total: grand,
            paid: paid,
            remaining: remaining,
            channel: inv.channel,
            paymentMethod: inv.paymentMethod,
            createdAt: inv.createdAt
        });
    }

    return { summary, invoices, invoiceDetails };
}

// ============================================================
// GET /api/daily-closures
// جلب كل الإغلاقات
// ============================================================
router.get('/', requireAuth(), wrap(async (req, res) => {
    const { from, to, status } = req.query;
    const filter = {};

    if (from || to) {
        filter.date = {};
        if (from) filter.date.$gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            filter.date.$lte = toDate;
        }
    }

    if (status) filter.status = status;

    const closures = await DailyClosure.find(filter)
        .sort({ date: -1 })
        .populate('closedBy', 'name')
        .lean();

    res.json(closures);
}));

// ============================================================
// GET /api/daily-closures/summary-today
// ملخص اليوم الحالي (قبل الإغلاق)
// ============================================================
router.get('/summary-today', requireAuth(), wrap(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const { summary, invoiceDetails } = await calculateDaySummary(today);

    // Check if today is already closed
    const { startOfDay, endOfDay } = getDateBounds(today);
    const existingClosure = await DailyClosure.findOne({
        date: { $gte: startOfDay, $lte: endOfDay }
    });

    res.json({
        date: today,
        isClosed: existingClosure?.status === 'closed',
        closedAt: existingClosure?.closedAt,
        isAutomatic: existingClosure?.isAutomatic,
        summary,
        invoices: invoiceDetails
    });
}));

// ============================================================
// GET /api/daily-closures/:date
// جلب إغلاق يوم محدد
// ============================================================
router.get('/:date', requireAuth(), wrap(async (req, res) => {
    const { date } = req.params;
    const { startOfDay, endOfDay } = getDateBounds(date);

    let closure = await DailyClosure.findOne({
        date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('closedBy', 'name').lean();

    // If no closure exists, calculate live summary
    if (!closure) {
        const { summary, invoiceDetails } = await calculateDaySummary(date);
        return res.json({
            date,
            status: 'open',
            summary,
            invoices: invoiceDetails
        });
    }

    // If closed, get invoice details
    const invoiceDetails = [];
    if (closure.invoices?.length > 0) {
        const invoices = await SalesInvoice.find({
            _id: { $in: closure.invoices }
        }).populate('customer', 'name').lean();

        for (const inv of invoices) {
            invoiceDetails.push({
                _id: inv._id,
                number: inv.number || inv._id.toString().slice(-6),
                customer: inv.customer?.name || 'عميل نقدي',
                total: inv.totals?.grand || 0,
                paid: inv.totals?.paid || 0,
                createdAt: inv.createdAt
            });
        }
    }

    res.json({
        ...closure,
        invoiceDetails
    });
}));

// ============================================================
// POST /api/daily-closures
// إغلاق يوم (يدوي)
// ============================================================
router.post('/', requireAuth(), wrap(async (req, res) => {
    const { date, note } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const { startOfDay, endOfDay } = getDateBounds(targetDate);

    // Check if already closed
    const existing = await DailyClosure.findOne({
        date: { $gte: startOfDay, $lte: endOfDay },
        status: 'closed'
    });

    if (existing) {
        return res.status(400).json({ message: 'هذا اليوم مغلق بالفعل' });
    }

    // Calculate summary
    const { summary, invoices } = await calculateDaySummary(targetDate);

    // Create or update closure
    const closure = await DailyClosure.findOneAndUpdate(
        { date: { $gte: startOfDay, $lte: endOfDay } },
        {
            date: startOfDay,
            closedAt: new Date(),
            closedBy: req.user?._id,
            isAutomatic: false,
            summary,
            invoices: invoices.map(inv => inv._id),
            status: 'closed',
            note: note || ''
        },
        { upsert: true, new: true }
    ).populate('closedBy', 'name');

    logger.info(`✅ Daily closure created for ${targetDate} by ${req.user?.name || 'user'}`);

    res.status(201).json({
        message: `تم إغلاق يوم ${targetDate} بنجاح`,
        closure
    });
}));

// ============================================================
// DELETE /api/daily-closures/:id
// حذف إغلاق (للمدير فقط)
// ============================================================
router.delete('/:id', requireAuth(['admin', 'manager']), wrap(async (req, res) => {
    const { id } = req.params;

    const closure = await DailyClosure.findByIdAndDelete(id);
    if (!closure) {
        return res.status(404).json({ message: 'الإغلاق غير موجود' });
    }

    logger.info(`🗑️ Daily closure deleted: ${closure.date}`);
    res.json({ message: 'تم حذف الإغلاق بنجاح' });
}));

// ============================================================
// Auto-Close Function (Called by Cron or on Server Start)
// ============================================================
export async function autoClosePreviousDay() {
    try {
        // Get yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const { startOfDay, endOfDay } = getDateBounds(yesterdayStr);

        // Check if already closed
        const existing = await DailyClosure.findOne({
            date: { $gte: startOfDay, $lte: endOfDay },
            status: 'closed'
        });

        if (existing) {
            logger.info(`⏭️ Auto-close skipped: ${yesterdayStr} already closed`);
            return null;
        }

        // Calculate summary
        const { summary, invoices } = await calculateDaySummary(yesterdayStr);

        // Skip if no invoices
        if (invoices.length === 0) {
            logger.info(`⏭️ Auto-close skipped: No invoices on ${yesterdayStr}`);
            return null;
        }

        // Create closure
        const closure = await DailyClosure.create({
            date: startOfDay,
            closedAt: new Date(),
            closedBy: null,
            isAutomatic: true,
            summary,
            invoices: invoices.map(inv => inv._id),
            status: 'closed',
            note: 'إغلاق تلقائي'
        });

        logger.logSuccess(`🔒 Auto-closed ${yesterdayStr}: ${summary.invoiceCount} invoices, ${summary.totalSales} LYD`);
        return closure;

    } catch (error) {
        logger.logError('❌ Auto-close failed:', error.message);
        return null;
    }
}

// ============================================================
// Check and close any unclosed previous days
// ============================================================
export async function closeUnclosedDays() {
    try {
        // Get last 7 days
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];
            const { startOfDay, endOfDay } = getDateBounds(dateStr);

            // Check if closed
            const existing = await DailyClosure.findOne({
                date: { $gte: startOfDay, $lte: endOfDay },
                status: 'closed'
            });

            if (!existing) {
                // Check if there were any invoices
                const invoiceCount = await SalesInvoice.countDocuments({
                    date: { $gte: startOfDay, $lte: endOfDay },
                    status: { $in: ['confirmed', 'posted', 'paid'] }
                });

                if (invoiceCount > 0) {
                    // Auto-close this day
                    const { summary, invoices } = await calculateDaySummary(dateStr);

                    await DailyClosure.create({
                        date: startOfDay,
                        closedAt: new Date(),
                        closedBy: null,
                        isAutomatic: true,
                        summary,
                        invoices: invoices.map(inv => inv._id),
                        status: 'closed',
                        note: 'إغلاق تلقائي (تأخير)'
                    });

                    logger.logSuccess(`🔒 Auto-closed missed day ${dateStr}: ${invoiceCount} invoices`);
                }
            }
        }
    } catch (error) {
        logger.logError('❌ closeUnclosedDays failed:', error.message);
    }
}

export default router;
