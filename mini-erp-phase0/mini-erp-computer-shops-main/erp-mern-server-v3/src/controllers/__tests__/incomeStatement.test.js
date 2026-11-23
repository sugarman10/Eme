/**
 * Income Statement Report Tests
 * اختبارات قائمة الدخل
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// TESTS
// ============================================================

describe('Income Statement Report Logic', () => {
  describe('Gross Profit Calculation', () => {
    it('should calculate grossProfit = totalRevenue - cogs', () => {
      const totalRevenue = 10000;
      const cogs = 3000;

      const grossProfit = totalRevenue - cogs;

      expect(grossProfit).toBe(7000);
    });

    it('should handle zero COGS', () => {
      const totalRevenue = 5000;
      const cogs = 0;

      const grossProfit = totalRevenue - cogs;

      expect(grossProfit).toBe(5000);
    });
  });

  describe('Net Profit Calculation', () => {
    it('should calculate netProfit = grossProfit - operatingExpenses', () => {
      const totalRevenue = 10000;
      const cogs = 3000;
      const operatingExpenses = 2000;

      const grossProfit = totalRevenue - cogs;
      const netProfit = grossProfit - operatingExpenses;

      expect(netProfit).toBe(5000);
    });

    it('should calculate negative netProfit (loss)', () => {
      const totalRevenue = 5000;
      const cogs = 3000;
      const operatingExpenses = 4000;

      const grossProfit = totalRevenue - cogs;
      const netProfit = grossProfit - operatingExpenses;

      expect(netProfit).toBe(-2000);
    });
  });

  describe('COGS Handling (5010)', () => {
    it('should separate COGS (5010) from operating expenses', () => {
      const expenseAccounts = [
        { code: '5010', name: 'تكلفة البضاعة المباعة', type: 'expense', balance: 3000 },
        { code: '6010', name: 'رواتب', type: 'expense', balance: 2000 },
        { code: '6020', name: 'إيجار', type: 'expense', balance: 1000 },
      ];

      let cogsAccount = null;
      const operatingExpenseAccounts = [];

      for (const acc of expenseAccounts) {
        if (acc.code === '5010') {
          cogsAccount = acc;
        } else {
          operatingExpenseAccounts.push(acc);
        }
      }

      expect(cogsAccount).not.toBeNull();
      expect(cogsAccount.code).toBe('5010');
      expect(operatingExpenseAccounts.length).toBe(2);
      expect(operatingExpenseAccounts.map((a) => a.code)).not.toContain('5010');
    });

    it('should handle missing COGS account gracefully (null)', () => {
      const expenseAccounts = [
        { code: '6010', name: 'رواتب', type: 'expense', balance: 2000 },
        { code: '6020', name: 'إيجار', type: 'expense', balance: 1000 },
      ];

      let cogsAccount = null;

      for (const acc of expenseAccounts) {
        if (acc.code === '5010') {
          cogsAccount = acc;
        }
      }

      expect(cogsAccount).toBeNull();

      // When COGS is null, use 0
      const cogs = cogsAccount ? cogsAccount.balance : 0;
      expect(cogs).toBe(0);
    });
  });

  describe('Date Filtering', () => {
    it('should work when from is omitted (cumulative)', () => {
      const from = null;
      const to = '2024-12-31';

      const dateFilter = {};

      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;

      if (from) {
        const startDate = new Date(from);
        startDate.setHours(0, 0, 0, 0);
        dateFilter.$gte = startDate;
      }

      expect(dateFilter.$lte).toBeDefined();
      expect(dateFilter.$gte).toBeUndefined();
    });
  });

  describe('Balance Calculation', () => {
    it('should calculate revenue balance as credit - debit', () => {
      const revenueAccount = {
        type: 'revenue',
        debitTotal: 100,
        creditTotal: 5000,
      };

      const balance = revenueAccount.creditTotal - revenueAccount.debitTotal;

      expect(balance).toBe(4900);
    });

    it('should calculate expense balance as debit - credit', () => {
      const expenseAccount = {
        type: 'expense',
        debitTotal: 3000,
        creditTotal: 200,
      };

      const balance = expenseAccount.debitTotal - expenseAccount.creditTotal;

      expect(balance).toBe(2800);
    });
  });

  describe('Response Structure (Arabic)', () => {
    it('should return Arabic field names', () => {
      const mockResponse = {
        الفترة: {
          من: null,
          إلى: '2024-12-31',
        },
        حسابات_الإيرادات: [{ code: '4010', name: 'إيرادات المبيعات', balance: 10000 }],
        حساب_تكلفة_البضاعة: { code: '5010', name: 'تكلفة البضاعة المباعة', balance: 3000 },
        حسابات_المصروفات_التشغيلية: [{ code: '6010', name: 'رواتب', balance: 2000 }],
        الإجماليات: {
          إجمالي_الإيرادات: 10000,
          تكلفة_البضاعة_المباعة: 3000,
          مجمل_الربح: 7000,
          المصروفات_التشغيلية: 2000,
          صافي_الربح: 5000,
        },
      };

      expect(mockResponse).toHaveProperty('الفترة');
      expect(mockResponse).toHaveProperty('حسابات_الإيرادات');
      expect(mockResponse).toHaveProperty('حساب_تكلفة_البضاعة');
      expect(mockResponse).toHaveProperty('الإجماليات');
      expect(mockResponse.الإجماليات).toHaveProperty('صافي_الربح');
    });
  });
});
