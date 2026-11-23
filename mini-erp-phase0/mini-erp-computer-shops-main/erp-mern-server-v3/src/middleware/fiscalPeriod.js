import FiscalPeriod from '../models/FiscalPeriod.js';
import { startOfDay, endOfDay } from '../utils/dateUtils.js';

let cachedPeriods = null;
let lastCacheTime = 0;

/**
 * Cache fiscal periods in memory for 30s
 */
export async function getFiscalPeriodsCached() {
  const now = Date.now();
  if (cachedPeriods && now - lastCacheTime < 30000) {
    return cachedPeriods;
  }
  const periods = await FiscalPeriod.find().sort({ startDate: -1 }).lean();
  cachedPeriods = periods;
  lastCacheTime = now;
  return periods;
}

export function clearFiscalPeriodsCache() {
  cachedPeriods = null;
  lastCacheTime = 0;
}

/**
 * Global Express Middleware to attach req.fiscalPeriod
 */
export async function fiscalPeriodMiddleware(req, res, next) {
  try {
    const periodId = req.headers['x-fiscal-period-id'] || req.query.fiscalPeriodId;
    const periods = await getFiscalPeriodsCached();

    let activePeriod = null;
    if (periodId) {
      activePeriod = periods.find((p) => p._id.toString() === periodId.toString());
    }

    // Fallback: headers x-fiscal-start-date and x-fiscal-end-date
    if (!activePeriod && req.headers['x-fiscal-start-date'] && req.headers['x-fiscal-end-date']) {
      activePeriod = {
        _id: periodId || null,
        startDate: new Date(req.headers['x-fiscal-start-date']),
        endDate: new Date(req.headers['x-fiscal-end-date']),
        name: req.headers['x-fiscal-year'] ? decodeURIComponent(req.headers['x-fiscal-year']) : 'السنة المالية',
        isClosed: false,
      };
    }

    // Fallback: currently active open period or latest period
    if (!activePeriod && periods.length > 0) {
      activePeriod = periods.find((p) => !p.isClosed) || periods[0];
    }

    if (activePeriod) {
      req.fiscalPeriod = {
        _id: activePeriod._id,
        name: activePeriod.name,
        startDate: new Date(activePeriod.startDate),
        endDate: new Date(activePeriod.endDate),
        isClosed: Boolean(activePeriod.isClosed),
      };
    }
  } catch (err) {
    console.error('Fiscal period middleware error:', err);
  }
  next();
}

/**
 * Apply fiscal date boundaries to any Mongoose filter
 * Ensures that queries strictly return records for the selected fiscal year
 */
export function applyFiscalDateFilter(req, filter = {}, field = 'date') {
  if (!req.fiscalPeriod) return filter;

  const { startDate, endDate } = req.fiscalPeriod;
  const start = startOfDay(startDate);
  const end = endOfDay(endDate);

  if (!filter[field]) {
    filter[field] = { $gte: start, $lte: end };
  } else if (typeof filter[field] === 'object') {
    // Clamp to fiscal period
    if (!filter[field].$gte) {
      filter[field].$gte = start;
    } else {
      const gteDate = new Date(filter[field].$gte);
      if (gteDate < start) filter[field].$gte = start;
    }

    if (!filter[field].$lte) {
      filter[field].$lte = end;
    } else {
      const lteDate = new Date(filter[field].$lte);
      if (lteDate > end) filter[field].$lte = end;
    }
  }

  return filter;
}
