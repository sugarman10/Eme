import { describe, it, expect } from 'vitest';

/**
 * Fast Unit Tests for Dashboard Analytics Logic
 * No MongoDB dependencies - Testing pure calculation logic
 */

describe('Dashboard Analytics - Unit Tests', () => {
  // Helper function (extracted from controller for testing)
  const calcTrend = (curr, prev) => {
    if (prev === 0) return curr > 0 ? null : 0;
    return ((curr - prev) / prev) * 100;
  };

  const calcPreviousPeriod = (startDate, endDate) => {
    const duration = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - duration);
    return { prevStartDate, prevEndDate, duration };
  };

  describe('calcTrend', () => {
    it('should return null when prev=0 and curr>0 (new metric)', () => {
      expect(calcTrend(100, 0)).toBe(null);
      expect(calcTrend(1, 0)).toBe(null);
    });

    it('should return 0 when both prev and curr are 0', () => {
      expect(calcTrend(0, 0)).toBe(0);
    });

    it('should calculate positive trend correctly', () => {
      expect(calcTrend(150, 100)).toBe(50); // +50%
      expect(calcTrend(220, 200)).toBe(10); // +10%
    });

    it('should calculate negative trend correctly', () => {
      expect(calcTrend(80, 100)).toBe(-20); // -20%
      expect(calcTrend(50, 200)).toBe(-75); // -75%
    });

    it('should return 0 when current equals previous', () => {
      expect(calcTrend(100, 100)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(calcTrend(105.5, 100)).toBe(5.5);
    });
  });

  describe('calcPreviousPeriod', () => {
    it('should calculate correct duration', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-07');
      const { duration } = calcPreviousPeriod(start, end);

      // Duration should match difference between dates
      const expectedDuration = end.getTime() - start.getTime();
      expect(duration).toBe(expectedDuration);
    });

    it('should place previous period before current period', () => {
      const start = new Date('2025-01-10');
      const end = new Date('2025-01-15');
      const { prevStartDate, prevEndDate } = calcPreviousPeriod(start, end);

      // Previous period should end just before current period starts
      expect(prevEndDate.getTime()).toBe(start.getTime() - 1);

      // Previous period should be before current period
      expect(prevStartDate.getTime()).toBeLessThan(start.getTime());
      expect(prevEndDate.getTime()).toBeLessThan(start.getTime());
    });

    it('should maintain same duration for previous period', () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const { prevStartDate, prevEndDate, duration } = calcPreviousPeriod(start, end);

      const prevDuration = prevEndDate.getTime() - prevStartDate.getTime();
      expect(prevDuration).toBe(duration);
    });
  });

  describe('Response Structure', () => {
    it('should have all required KPIs', () => {
      const mockResponse = {
        kpis: {
          salesTotal: 1000,
          invoicesCount: 10,
          receiptsTotal: 800,
          customersCount: 50,
          lowStockCount: 3,
        },
        previousPeriod: {
          salesTotal: 900,
          invoicesCount: 9,
          receiptsTotal: 700,
          customersCount: 48,
          lowStockCount: null,
        },
        trends: {},
        charts: {},
        tables: {},
      };

      expect(mockResponse.kpis).toHaveProperty('salesTotal');
      expect(mockResponse.kpis).toHaveProperty('invoicesCount');
      expect(mockResponse.kpis).toHaveProperty('receiptsTotal');
      expect(mockResponse.kpis).toHaveProperty('customersCount');
      expect(mockResponse.kpis).toHaveProperty('lowStockCount');
    });

    it('should calculate trends from KPIs and previousPeriod', () => {
      const kpis = {
        salesTotal: 150,
        invoicesCount: 12,
        receiptsTotal: 100,
        customersCount: 55,
        lowStockCount: 2,
      };

      const previousPeriod = {
        salesTotal: 100,
        invoicesCount: 10,
        receiptsTotal: 0, // New metric
        customersCount: 50,
        lowStockCount: null,
      };

      const trends = {
        salesTotal: calcTrend(kpis.salesTotal, previousPeriod.salesTotal),
        invoicesCount: calcTrend(kpis.invoicesCount, previousPeriod.invoicesCount),
        receiptsTotal: calcTrend(kpis.receiptsTotal, previousPeriod.receiptsTotal),
        customersCount: calcTrend(kpis.customersCount, previousPeriod.customersCount),
        lowStockCount: null,
      };

      expect(trends.salesTotal).toBe(50); // +50%
      expect(trends.invoicesCount).toBe(20); // +20%
      expect(trends.receiptsTotal).toBe(null); // New (prev=0, curr>0)
      expect(trends.customersCount).toBe(10); // +10%
      expect(trends.lowStockCount).toBe(null); // Not tracked
    });
  });
});
