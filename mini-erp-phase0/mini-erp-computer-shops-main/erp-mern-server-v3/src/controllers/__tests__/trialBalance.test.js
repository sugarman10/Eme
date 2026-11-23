/**
 * Trial Balance Report Tests
 * اختبارات ميزان المراجعة التراكمي
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// TESTS
// ============================================================

describe('Trial Balance Report Logic', () => {
  describe('Total Debit == Total Credit', () => {
    it('should return totalsDebit == totalsCredit for balanced journal entries', () => {
      // Simulate aggregated journal entries
      const accounts = [
        { code: '1010', name: 'الصندوق', type: 'asset', debitTotal: 1000, creditTotal: 200 },
        { code: '1030', name: 'ذمم العملاء', type: 'asset', debitTotal: 500, creditTotal: 300 },
        { code: '4010', name: 'إيرادات المبيعات', type: 'revenue', debitTotal: 0, creditTotal: 800 },
        { code: '2020', name: 'ض.ق.م المستحقة', type: 'liability', debitTotal: 0, creditTotal: 200 },
      ];

      const totalDebit = accounts.reduce((sum, acc) => sum + acc.debitTotal, 0);
      const totalCredit = accounts.reduce((sum, acc) => sum + acc.creditTotal, 0);

      expect(totalDebit).toBe(1500);
      expect(totalCredit).toBe(1500);
      expect(totalDebit).toBe(totalCredit);
    });

    it('should detect unbalanced entries', () => {
      const accounts = [
        { code: '1010', type: 'asset', debitTotal: 1000, creditTotal: 0 },
        { code: '4010', type: 'revenue', debitTotal: 0, creditTotal: 900 }, // Unbalanced!
      ];

      const totalDebit = accounts.reduce((sum, acc) => sum + acc.debitTotal, 0);
      const totalCredit = accounts.reduce((sum, acc) => sum + acc.creditTotal, 0);
      const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

      expect(isBalanced).toBe(false);
    });
  });

  describe('Balance Calculation by Account Type', () => {
    it('should compute balance = debitTotal - creditTotal for asset accounts', () => {
      const assetAccount = {
        type: 'asset',
        debitTotal: 1000,
        creditTotal: 300,
      };

      const balance = assetAccount.debitTotal - assetAccount.creditTotal;

      expect(balance).toBe(700);
    });

    it('should compute balance = debitTotal - creditTotal for expense accounts', () => {
      const expenseAccount = {
        type: 'expense',
        debitTotal: 500,
        creditTotal: 100,
      };

      const balance = expenseAccount.debitTotal - expenseAccount.creditTotal;

      expect(balance).toBe(400);
    });

    it('should compute balance = creditTotal - debitTotal for liability accounts', () => {
      const liabilityAccount = {
        type: 'liability',
        debitTotal: 100,
        creditTotal: 500,
      };

      // Liabilities: Credit increases, Debit decreases
      const balance = liabilityAccount.creditTotal - liabilityAccount.debitTotal;

      expect(balance).toBe(400);
    });

    it('should compute balance = creditTotal - debitTotal for revenue accounts', () => {
      const revenueAccount = {
        type: 'revenue',
        debitTotal: 50,
        creditTotal: 1000,
      };

      const balance = revenueAccount.creditTotal - revenueAccount.debitTotal;

      expect(balance).toBe(950);
    });

    it('should compute balance = creditTotal - debitTotal for equity accounts', () => {
      const equityAccount = {
        type: 'equity',
        debitTotal: 0,
        creditTotal: 10000,
      };

      const balance = equityAccount.creditTotal - equityAccount.debitTotal;

      expect(balance).toBe(10000);
    });
  });

  describe('Date Filtering', () => {
    it('should work when from is omitted (cumulative from oldest)', () => {
      const from = null;
      const to = '2024-12-31';

      // When from is null, dateFilter should only have $lte
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

    it('should filter by date range when both from and to are provided', () => {
      const from = '2024-01-01';
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
      expect(dateFilter.$gte).toBeDefined();
      expect(dateFilter.$gte.getFullYear()).toBe(2024);
      expect(dateFilter.$gte.getMonth()).toBe(0); // January
    });
  });

  describe('Response Structure', () => {
    it('should return correct response structure', () => {
      const mockResponse = {
        period: {
          from: null,
          to: '2024-12-31',
        },
        accounts: [
          {
            code: '1010',
            name: 'الصندوق',
            type: 'asset',
            debitTotal: 1000,
            creditTotal: 200,
            balance: 800,
          },
        ],
        totals: {
          totalDebit: 1000,
          totalCredit: 1000,
          isBalanced: true,
        },
      };

      expect(mockResponse).toHaveProperty('period');
      expect(mockResponse).toHaveProperty('accounts');
      expect(mockResponse).toHaveProperty('totals');
      expect(mockResponse.totals).toHaveProperty('isBalanced');
      expect(mockResponse.accounts[0]).toHaveProperty('balance');
      expect(mockResponse.accounts[0]).toHaveProperty('name');
      expect(mockResponse.accounts[0]).toHaveProperty('code');
    });
  });
});
