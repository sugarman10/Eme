/**
 * Date Utilities for ERP System
 *
 * Centralized date calculation functions to avoid code duplication
 * across controllers and services.
 */

/**
 * Normalize a date to the start of day (00:00:00.000)
 * @param {Date|string} date - Date to normalize
 * @returns {Date} Date at start of day
 */
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Normalize a date to the end of day (23:59:59.999)
 * @param {Date|string} date - Date to normalize
 * @returns {Date} Date at end of day
 */
export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get a date range for the current and previous periods
 * Used for trend calculations in dashboard and reports
 *
 * @param {string|null} from - Start date string (YYYY-MM-DD) or null for default
 * @param {string|null} to - End date string (YYYY-MM-DD) or null for default
 * @returns {Object} Object containing current and previous period dates
 */
export function getDateRangeWithPrevious(from, to) {
  // Default to current month if not provided
  const endDate = to ? endOfDay(new Date(to)) : endOfDay(new Date());
  const startDate = from ? startOfDay(new Date(from)) : startOfDay(new Date(new Date().setDate(1))); // Start of month default

  const duration = endDate.getTime() - startDate.getTime();

  // Previous Period: End of prev is 1ms before start of current
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - duration);

  return {
    current: {
      start: startDate,
      end: endDate,
    },
    previous: {
      start: prevStartDate,
      end: prevEndDate,
    },
    duration,
  };
}

/**
 * Get date range based on preset period (today, week, month, quarter, year)
 * @param {string} period - Period preset: 'today', 'week', 'month', 'quarter', 'year'
 * @returns {Object} Object containing start and end dates
 */
export function getPresetDateRange(period) {
  const today = new Date();
  const end = endOfDay(today);
  let start;

  switch (period) {
    case 'today':
      start = startOfDay(today);
      break;
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 7);
      start = startOfDay(weekStart);
      break;
    case 'month':
      const monthStart = new Date(today);
      monthStart.setDate(today.getDate() - 30);
      start = startOfDay(monthStart);
      break;
    case 'quarter':
      const quarterStart = new Date(today);
      quarterStart.setMonth(today.getMonth() - 3);
      start = startOfDay(quarterStart);
      break;
    case 'year':
      const yearStart = new Date(today);
      yearStart.setFullYear(today.getFullYear() - 1);
      start = startOfDay(yearStart);
      break;
    default:
      // Default to current month
      start = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return { start, end };
}

/**
 * Convert a date to YYYY-MM-DD string format
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function toDateString(date) {
  return new Date(date).toISOString().split('T')[0];
}

/**
 * Check if a date string is in valid YYYY-MM-DD format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid format
 */
export function isValidDateFormat(dateString) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateString);
}

/**
 * Calculate the number of days between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Number of days between dates (absolute value)
 */
export function daysBetween(date1, date2) {
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.abs(Math.floor((new Date(date2) - new Date(date1)) / oneDay));
}

/**
 * Get the start and end of current month
 * @returns {Object} Object containing start and end dates of current month
 */
export function getCurrentMonthRange() {
  const now = new Date();
  const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  return { start, end };
}

/**
 * Calculate trend percentage between current and previous values
 * @param {number} current - Current period value
 * @param {number} previous - Previous period value
 * @returns {number|null} Trend percentage or null if previous is 0 and current > 0
 */
export function calculateTrend(current, previous) {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

export default {
  startOfDay,
  endOfDay,
  getDateRangeWithPrevious,
  getPresetDateRange,
  toDateString,
  isValidDateFormat,
  daysBetween,
  getCurrentMonthRange,
  calculateTrend,
};
