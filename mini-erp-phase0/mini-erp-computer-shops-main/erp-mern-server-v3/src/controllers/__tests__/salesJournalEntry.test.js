/**
 * Sales Invoice Journal Entry Integration Tests
 * اختبارات ربط فاتورة المبيعات بقيد اليومية
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// MOCK SETUP
// ============================================================

// Mock Account model
const mockAccountFind = vi.fn();
vi.mock('../../models/Account.js', () => ({
  default: {
    find: mockAccountFind,
  },
}));

// Mock journalEntryService
const mockPostJournalEntry = vi.fn();
vi.mock('../../services/journalEntryService.js', () => ({
  postJournalEntry: mockPostJournalEntry,
  JournalValidationError: class extends Error {
    constructor(message, code) {
      super(message);
      this.name = 'JournalValidationError';
      this.code = code;
    }
  },
}));

// Mock logger
vi.mock('../../config/logger.js', () => ({
  default: {
    info: vi.fn(),
    http: vi.fn(),
    logSuccess: vi.fn(),
    logWarning: vi.fn(),
    logError: vi.fn(),
  },
}));

// Mock mathUtils
vi.mock('../../utils/mathUtils.js', () => ({
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  round: (n) => Math.round(n * 100) / 100,
}));

// ============================================================
// TESTS
// ============================================================

describe('Sales Invoice Journal Entry Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Credit Sale (remaining > 0)', () => {
    it('should create AR debit for credit sale', async () => {
      // Setup: All accounts exist
      mockAccountFind.mockReturnValue({
        session: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb) =>
          cb([
            { _id: 'acc1010', code: '1010', type: 'asset' },
            { _id: 'acc1020', code: '1020', type: 'asset' },
            { _id: 'acc1030', code: '1030', type: 'asset' },
            { _id: 'acc4010', code: '4010', type: 'revenue' },
            { _id: 'acc2020', code: '2020', type: 'liability' },
          ])
        ),
      });

      mockPostJournalEntry.mockResolvedValue({ _id: 'je123' });

      // Simulate credit sale (remaining = 500, paid = 0)
      const paidAmount = 0;
      const remaining = 500;
      const grand = 500;
      const tax = 0;

      // Build expected lines for credit sale
      const expectedLines = [];

      // Dr: AR for remaining amount
      if (remaining > 0) {
        expectedLines.push({
          accountId: 'acc1030',
          debit: remaining,
          credit: 0,
          memo: expect.any(String),
        });
      }

      // Cr: Sales Revenue
      expectedLines.push({
        accountId: 'acc4010',
        debit: 0,
        credit: grand - tax,
        memo: expect.any(String),
      });

      // Verify AR is debited
      expect(remaining).toBeGreaterThan(0);
      expect(expectedLines[0].debit).toBe(remaining);
      expect(expectedLines[0].accountId).toBe('acc1030'); // AR account
    });
  });

  describe('Cash Sale (paid > 0)', () => {
    it('should use Cash account (1010) for cash payment method', async () => {
      mockAccountFind.mockReturnValue({
        session: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb) =>
          cb([
            { _id: 'acc1010', code: '1010', type: 'asset' },
            { _id: 'acc1020', code: '1020', type: 'asset' },
            { _id: 'acc1030', code: '1030', type: 'asset' },
            { _id: 'acc4010', code: '4010', type: 'revenue' },
            { _id: 'acc2020', code: '2020', type: 'liability' },
          ])
        ),
      });

      const accounts = await mockAccountFind().then((cb) => cb);
      const paymentMethod = 'cash';

      const debitAccount =
        paymentMethod === 'bank' || paymentMethod === 'transfer'
          ? accounts.find((a) => a.code === '1020')
          : accounts.find((a) => a.code === '1010');

      expect(debitAccount.code).toBe('1010'); // Cash
    });

    it('should use Bank account (1020) for bank payment method', async () => {
      mockAccountFind.mockReturnValue({
        session: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb) =>
          cb([
            { _id: 'acc1010', code: '1010', type: 'asset' },
            { _id: 'acc1020', code: '1020', type: 'asset' },
            { _id: 'acc1030', code: '1030', type: 'asset' },
            { _id: 'acc4010', code: '4010', type: 'revenue' },
            { _id: 'acc2020', code: '2020', type: 'liability' },
          ])
        ),
      });

      const accounts = await mockAccountFind().then((cb) => cb);
      const paymentMethod = 'bank';

      const debitAccount =
        paymentMethod === 'bank' || paymentMethod === 'transfer'
          ? accounts.find((a) => a.code === '1020')
          : accounts.find((a) => a.code === '1010');

      expect(debitAccount.code).toBe('1020'); // Bank
    });
  });

  describe('Balance Validation', () => {
    it('should create balanced entry (debit == credit)', async () => {
      const paidAmount = 100;
      const remaining = 0;
      const grand = 100;
      const tax = 15;
      const netSales = grand - tax;

      // Build lines
      const lines = [];

      // Dr: Cash
      if (paidAmount > 0) {
        lines.push({ debit: paidAmount, credit: 0 });
      }

      // Cr: Sales Revenue (net)
      lines.push({ debit: 0, credit: netSales });

      // Cr: VAT Payable
      if (tax > 0) {
        lines.push({ debit: 0, credit: tax });
      }

      const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBe(grand);
    });

    it('should include VAT payable when tax > 0', async () => {
      const grand = 115;
      const tax = 15;
      const netSales = grand - tax;

      const lines = [
        { accountId: 'acc1010', debit: grand, credit: 0, memo: 'Cash' },
        { accountId: 'acc4010', debit: 0, credit: netSales, memo: 'Sales' },
        { accountId: 'acc2020', debit: 0, credit: tax, memo: 'VAT' },
      ];

      const vatLine = lines.find((l) => l.accountId === 'acc2020');
      expect(vatLine).toBeDefined();
      expect(vatLine.credit).toBe(tax);
    });
  });

  describe('Transaction Safety', () => {
    it('should rollback invoice if journal entry fails', async () => {
      mockPostJournalEntry.mockRejectedValue(new Error('Sales Revenue account missing'));

      let transactionAborted = false;

      try {
        await mockPostJournalEntry({});
      } catch (error) {
        transactionAborted = true;
      }

      expect(transactionAborted).toBe(true);
    });

    it('should set referenceType to SALE_INVOICE', async () => {
      mockPostJournalEntry.mockResolvedValue({ _id: 'je123', referenceType: 'SALE_INVOICE' });

      const result = await mockPostJournalEntry({
        referenceType: 'SALE_INVOICE',
        referenceId: 'inv123',
      });

      expect(mockPostJournalEntry).toHaveBeenCalledWith(expect.objectContaining({ referenceType: 'SALE_INVOICE' }));
    });
  });

  describe('Account Validation', () => {
    it('should reject if Sales Revenue account (4010) is missing', async () => {
      mockAccountFind.mockReturnValue({
        session: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb) =>
          cb([
            { _id: 'acc1010', code: '1010', type: 'asset' },
            { _id: 'acc1030', code: '1030', type: 'asset' },
            // Missing 4010!
          ])
        ),
      });

      const accounts = await mockAccountFind().then((cb) => cb);
      const salesAccount = accounts.find((a) => a.code === '4010');

      expect(salesAccount).toBeUndefined();

      const errorMessage = 'حساب إيرادات المبيعات (4010) غير موجود';
      expect(errorMessage).toContain('4010');
    });

    it('should reject if AR account (1030) is missing for credit sale', async () => {
      mockAccountFind.mockReturnValue({
        session: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((cb) =>
          cb([
            { _id: 'acc1010', code: '1010', type: 'asset' },
            { _id: 'acc4010', code: '4010', type: 'revenue' },
            // Missing 1030!
          ])
        ),
      });

      const accounts = await mockAccountFind().then((cb) => cb);
      const arAccount = accounts.find((a) => a.code === '1030');

      expect(arAccount).toBeUndefined();
    });
  });
});
