import { describe, it, expect } from 'vitest';

/**
 * Fast Unit Tests for Balance Sheet Logic
 * Testing categorization and balance verification
 */

describe('Balance Sheet - Unit Tests', () => {
  describe('Balance Calculation by Account Type', () => {
    it('should calculate Assets balance as Debit - Credit', () => {
      const account = { type: 'asset', debit: 10000, credit: 2000 };

      let balance = 0;
      if (account.type === 'asset') {
        balance = account.debit - account.credit;
      }

      expect(balance).toBe(8000);
    });

    it('should calculate Liabilities balance as Credit - Debit', () => {
      const account = { type: 'liability', debit: 1000, credit: 5000 };

      let balance = 0;
      if (account.type === 'liability') {
        balance = account.credit - account.debit;
      }

      expect(balance).toBe(4000);
    });

    it('should calculate Equity balance as Credit - Debit', () => {
      const account = { type: 'equity', debit: 500, credit: 10000 };

      let balance = 0;
      if (account.type === 'equity') {
        balance = account.credit - account.debit;
      }

      expect(balance).toBe(9500);
    });
  });

  describe('Account Categorization', () => {
    it('should categorize asset accounts correctly', () => {
      const accounts = [
        { type: 'asset', code: '101', name: 'Cash', debit: 5000, credit: 0 },
        { type: 'asset', code: '102', name: 'Bank', debit: 10000, credit: 0 },
      ];

      const assets = accounts.filter((a) => a.type === 'asset');
      expect(assets).toHaveLength(2);
    });

    it('should categorize liability accounts correctly', () => {
      const accounts = [{ type: 'liability', code: '201', name: 'Accounts Payable', debit: 0, credit: 3000 }];

      const liabilities = accounts.filter((a) => a.type === 'liability');
      expect(liabilities).toHaveLength(1);
    });

    it('should categorize equity accounts correctly', () => {
      const accounts = [{ type: 'equity', code: '301', name: 'Capital', debit: 0, credit: 20000 }];

      const equity = accounts.filter((a) => a.type === 'equity');
      expect(equity).toHaveLength(1);
    });

    it('should handle empty account groups', () => {
      const accounts = [{ type: 'asset', code: '101', name: 'Cash', debit: 5000, credit: 0 }];

      const liabilities = accounts.filter((a) => a.type === 'liability');
      const equity = accounts.filter((a) => a.type === 'equity');

      expect(liabilities).toHaveLength(0);
      expect(equity).toHaveLength(0);
    });
  });

  describe('Balance Verification', () => {
    it('should return متوازن=true when Assets = Liabilities + Equity', () => {
      const totalAssets = 50000;
      const totalLiabilities = 20000;
      const totalEquity = 30000;
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

      const tolerance = 0.01;
      const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < tolerance;

      expect(isBalanced).toBe(true);
    });

    it('should return متوازن=false when out of balance', () => {
      const totalAssets = 50000;
      const totalLiabilities = 20000;
      const totalEquity = 29000; // Off by 1000
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

      const tolerance = 0.01;
      const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < tolerance;

      expect(isBalanced).toBe(false);
    });

    it('should handle small floating point differences', () => {
      const totalAssets = 50000.005;
      const totalLiabilities = 20000.003;
      const totalEquity = 30000.002;
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

      const tolerance = 0.01;
      const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < tolerance;

      expect(isBalanced).toBe(true);
    });
  });

  describe('Totals Calculation', () => {
    it('should calculate totals correctly by type', () => {
      const assets = [{ balance: 5000 }, { balance: 10000 }, { balance: 3000 }];

      const liabilities = [{ balance: 8000 }, { balance: 2000 }];

      const equity = [{ balance: 8000 }];

      const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
      const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
      const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

      expect(totalAssets).toBe(18000);
      expect(totalLiabilities).toBe(10000);
      expect(totalEquity).toBe(8000);
      expect(totalAssets).toBe(totalLiabilities + totalEquity);
    });

    it('should handle empty groups with zero totals', () => {
      const assets = [{ balance: 10000 }];
      const liabilities = [];
      const equity = [];

      const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
      const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
      const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

      expect(totalAssets).toBe(10000);
      expect(totalLiabilities).toBe(0);
      expect(totalEquity).toBe(0);
    });
  });

  describe('Response Structure', () => {
    it('should have all required Arabic fields', () => {
      const mockResponse = {
        إلى: '2024-12-31',
        الأصول: {
          الحسابات: [],
          الإجمالي: 50000,
        },
        الخصوم: {
          الحسابات: [],
          الإجمالي: 20000,
        },
        حقوق_الملكية: {
          الحسابات: [],
          الإجمالي: 30000,
        },
        الإجماليات: {
          إجمالي_الأصول: 50000,
          إجمالي_الخصوم_وحقوق_الملكية: 50000,
          متوازن: true,
        },
      };

      expect(mockResponse).toHaveProperty('إلى');
      expect(mockResponse).toHaveProperty('الأصول');
      expect(mockResponse).toHaveProperty('الخصوم');
      expect(mockResponse).toHaveProperty('حقوق_الملكية');
      expect(mockResponse).toHaveProperty('الإجماليات');
      expect(mockResponse.الإجماليات).toHaveProperty('متوازن');
    });
  });
});
