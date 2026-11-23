import express from 'express';
import mongoose from 'mongoose';
import DailyClosure from '../models/DailyClosure.js';
import SalesInvoice from '../models/SalesInvoice.js';
import SalesReturn from '../models/SalesReturn.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap } from '../middleware/asyncHandler.js';
import logger from '../config/logger.js';
import { applyFiscalDateFilter } from '../middleware/fiscalPeriod.js';

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
    $or: [{ date: { $gte: startOfDay, $lte: endOfDay } }, { createdAt: { $gte: startOfDay, $lte: endOfDay } }],
    status: { $in: ['confirmed', 'posted', 'paid'] },
  })
    .populate('customer', 'name')
    .lean();

  // Calculate summary
  const summary = {
    invoiceCount: invoices.length,
    totalSales: 0,
    totalPaid: 0,
    totalDue: 0,
    byChannel: { wholesale: 0, retail: 0 },
    byPaymentMethod: { cash: 0, card: 0, bank: 0, split: 0 },
    totalRefunds: 0,
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
      createdAt: inv.createdAt,
    });
  }

  // Fetch Cash & Bank Returns for this day
  const returns = await SalesReturn.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
    refundMethod: { $in: ['cash', 'bank'] },
    status: 'returned'
  }).lean();

  const totalRefunds = returns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const cashRefunds = returns.filter(r => r.refundMethod === 'cash').reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const bankRefunds = returns.filter(r => r.refundMethod === 'bank').reduce((sum, r) => sum + (r.totalAmount || 0), 0);

  // Adjust Summary for Refunds
  summary.totalRefunds = totalRefunds;
  summary.totalPaid -= totalRefunds;
  if (!summary.byPaymentMethod) summary.byPaymentMethod = { cash: 0, card: 0, bank: 0, split: 0 };

  summary.byPaymentMethod.cash = Math.max(0, (summary.byPaymentMethod.cash || 0) - cashRefunds);
  summary.byPaymentMethod.bank = Math.max(0, (summary.byPaymentMethod.bank || 0) - bankRefunds);

  return { summary, invoices, invoiceDetails, returns };
}

// ============================================================
// GET /api/daily-closures (Admin Only)
// جلب كل الإغلاقات
// ============================================================
router.get(
  '/',
  requireAuth(['admin']),
  wrap(async (req, res) => {
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

    applyFiscalDateFilter(req, filter, 'date');

    const closures = await DailyClosure.find(filter).sort({ date: -1 }).populate('closedBy', 'name').lean();

    res.json(closures);
  })
);

// ============================================================
// GET /api/daily-closures/summary-today (Admin Only)
// ملخص اليوم الحالي (قبل الإغلاق)
// ============================================================
router.get(
  '/summary-today',
  requireAuth(['admin']),
  wrap(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const { summary, invoiceDetails } = await calculateDaySummary(today);

    // Check if today is already closed
    const { startOfDay, endOfDay } = getDateBounds(today);
    const existingClosure = await DailyClosure.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    res.json({
      date: today,
      isClosed: existingClosure?.status === 'closed',
      closedAt: existingClosure?.closedAt,
      isAutomatic: existingClosure?.isAutomatic,
      summary,
      invoices: invoiceDetails,
    });
  })
);

// ============================================================
// GET /api/daily-closures/:date (Admin Only)
// جلب إغلاق يوم محدد
// ============================================================
router.get(
  '/:date',
  requireAuth(['admin']),
  wrap(async (req, res) => {
    const { date } = req.params;
    const { startOfDay, endOfDay } = getDateBounds(date);

    let closure = await DailyClosure.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate('closedBy', 'name')
      .lean();

    // If no closure exists, calculate live summary
    if (!closure) {
      const { summary, invoiceDetails } = await calculateDaySummary(date);
      return res.json({
        date,
        status: 'open',
        summary,
        invoices: invoiceDetails,
      });
    }

    // If closed, get invoice details
    const invoiceDetails = [];
    if (closure.invoices?.length > 0) {
      const invoices = await SalesInvoice.find({
        _id: { $in: closure.invoices },
      })
        .populate('customer', 'name')
        .lean();

      for (const inv of invoices) {
        invoiceDetails.push({
          _id: inv._id,
          number: inv.number || inv._id.toString().slice(-6),
          customer: inv.customer?.name || 'عميل نقدي',
          total: inv.totals?.grand || 0,
          paid: inv.totals?.paid || 0,
          createdAt: inv.createdAt,
        });
      }
    }

    res.json({
      ...closure,
      invoiceDetails,
    });
  })
);

// ============================================================
// POST /api/daily-closures (Admin Only)
// إغلاق يوم (يدوي)
// ============================================================
router.post(
  '/',
  requireAuth(['admin']),
  wrap(async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { date, note, actualCash, variance } = req.body;
      const targetDate = date || new Date().toISOString().split('T')[0];
      const { startOfDay, endOfDay } = getDateBounds(targetDate);

      // Check if already closed
      const existing = await DailyClosure.findOne({
        date: { $gte: startOfDay, $lte: endOfDay },
        status: 'closed',
      }).session(session);

      if (existing) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'هذا اليوم مغلق بالفعل' });
      }

      // Calculate summary
      const { summary, invoices } = await calculateDaySummary(targetDate);

      // Add Variance Data
      summary.actualCash = Number(actualCash || 0);
      summary.variance = Number(variance || 0);

      // Create or update closure
      const closure = await DailyClosure.findOneAndUpdate(
        { date: { $gte: startOfDay, $lte: endOfDay } },
        {
          date: startOfDay,
          closedAt: new Date(),
          closedBy: req.user?._id,
          isAutomatic: false,
          summary,
          invoices: invoices.map((inv) => inv._id),
          status: 'closed',
          note: note || '',
        },
        { upsert: true, new: true, session }
      ).populate('closedBy', 'name');

      // ============================================================
      // 🧠 Accounting: Handle Variance (Journal Entry)
      // ============================================================
      const varianceAmount = Number(variance || 0);

      if (Math.abs(varianceAmount) > 0.01) {
        try {
          // Treasury Account (الصندوق) - Asset
          const treasuryAccount = await import('../models/Account.js').then(m => m.default.findOne({ code: '1010' }).session(session));

          // Shortage Account (عجز وخسائر نقدية) - Expense
          const shortageAccount = await import('../models/Account.js').then(m => m.default.findOne({ code: '5030' }).session(session));

          // Overage Account (إيرادات فروقات نقدية) - Revenue
          const overageAccount = await import('../models/Account.js').then(m => m.default.findOne({ code: '4030' }).session(session));

          if (treasuryAccount && (shortageAccount || overageAccount)) {
            const { postJournalEntry } = await import('../services/journalEntryService.js');

            let debitAccountId, creditAccountId, description;

            if (varianceAmount < 0) {
              // Shortage: Dr Expense (5030), Cr Treasury (1010)
              debitAccountId = shortageAccount?._id;
              creditAccountId = treasuryAccount._id;
              description = `عجز صندوق يوم ${targetDate}`;
              if (!debitAccountId) logger.warn('Missing Shortage Account 5030');
            } else {
              // Overage: Dr Treasury (1010), Cr Revenue (4030)
              debitAccountId = treasuryAccount._id;
              creditAccountId = overageAccount?._id;
              description = `زيادة صندوق يوم ${targetDate}`;
              if (!creditAccountId) logger.warn('Missing Overage Account 4030');
            }

            if (debitAccountId && creditAccountId) {
              await postJournalEntry({
                date: new Date(),
                referenceType: 'DAILY_CLOSURE',
                referenceId: closure._id,
                description: description,
                lines: [
                  { accountId: debitAccountId, debit: Math.abs(varianceAmount), credit: 0 },
                  { accountId: creditAccountId, debit: 0, credit: Math.abs(varianceAmount) }
                ],
                userId: req.user?._id,
                createdBy: req.user?._id
              }, { session });
              logger.info(`✅ Variance Journal Entry created: ${description} (${Math.abs(varianceAmount)})`);
            }
          } else {
            logger.warn('⚠️ Cannot create variance entry: Missing Account 1010, 5030, or 4030');
          }
        } catch (accError) {
          logger.error(`❌ Accounting Error for Closure ${targetDate}:`, accError);
          // Throwing here will abort the transaction
          throw accError;
        }
      }

      await session.commitTransaction();
      logger.info(`✅ Daily closure created for ${targetDate} by ${req.user?.name || 'user'}`);

      res.status(201).json({
        message: `تم إغلاق يوم ${targetDate} بنجاح`,
        closure,
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  })
);

// ============================================================
// DELETE /api/daily-closures/:id
// حذف إغلاق (للمدير فقط) مع عكس قيد الفروقات وتسجيل التدقيق
// ============================================================
router.delete(
  '/:id',
  requireAuth(['admin', 'manager']),
  wrap(async (req, res) => {
    const { id } = req.params;

    const closure = await DailyClosure.findById(id);
    if (!closure) {
      return res.status(404).json({ message: 'الإغلاق غير موجود' });
    }

    // 1. Reverse any variance Journal Entry associated with this closure
    try {
      const JournalEntry = (await import('../models/JournalEntry.js')).default;
      const varianceEntry = await JournalEntry.findOne({
        referenceType: 'DAILY_CLOSURE',
        referenceId: closure._id.toString(),
        status: 'POSTED',
      });

      if (varianceEntry) {
        const { reverseJournalEntry } = await import('../services/journalEntryService.js');
        await reverseJournalEntry(varianceEntry._id, req.user?._id, 'عكس قيد الفروقات بسبب حذف الإغلاق اليومي');
        logger.info(`🔄 Reversed variance JE ${varianceEntry._id} for deleted closure ${closure._id}`);
      }
    } catch (jeErr) {
      logger.warn('Could not reverse variance journal entry for closure:', jeErr.message);
    }

    // 2. Delete closure document
    await DailyClosure.findByIdAndDelete(id);

    // 3. Mandatory Audit Log
    try {
      const { auditDelete } = await import('../services/auditService.js');
      await auditDelete('DAILY_CLOSURE', closure, req.user, req.ip);
    } catch (auditErr) {
      logger.warn('Audit logging failed for daily closure deletion:', auditErr.message);
    }

    logger.info(`🗑️ Daily closure deleted: ${closure.date}`);
    res.json({ message: 'تم حذف الإغلاق وعكس قيوده المحاسبية بنجاح' });
  })
);

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
      status: 'closed',
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
      invoices: invoices.map((inv) => inv._id),
      status: 'closed',
      note: 'إغلاق تلقائي',
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
        status: 'closed',
      });

      if (!existing) {
        // Check if there were any invoices
        const invoiceCount = await SalesInvoice.countDocuments({
          date: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['confirmed', 'posted', 'paid'] },
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
            invoices: invoices.map((inv) => inv._id),
            status: 'closed',
            note: 'إغلاق تلقائي (تأخير)',
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
