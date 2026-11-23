/**
 * JournalEntry Service Tests
 * اختبارات خدمة قيود اليومية
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Account model
vi.mock('../../models/Account.js', () => ({
  default: {
    find: vi.fn().mockReturnValue({
      session: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((cb) =>
        cb([
          { _id: 'acc1', type: 'asset' },
          { _id: 'acc2', type: 'liability' },
        ])
      ),
    }),
    findByIdAndUpdate: vi.fn().mockReturnValue({
      session: vi.fn().mockResolvedValue({}),
    }),
  },
}));

// Mock JournalEntry model
vi.mock('../../models/JournalEntry.js', () => ({
  default: {
    create: vi.fn().mockResolvedValue({ _id: 'je1', lines: [] }),
  },
}));

// Mock FiscalPeriod model
vi.mock('../../models/FiscalPeriod.js', () => ({
  default: {
    findOne: vi.fn().mockReturnValue({
      session: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((cb) => cb(null)),
    }),
  },
}));

// Mock Counter model
vi.mock('../../models/Counter.js', () => ({
  default: {
    findOneAndUpdate: vi.fn().mockReturnValue({
      session: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((cb) => cb({ seq: 1 })),
    }),
  },
}));

// Import after mocks
import { validateJournalEntry, postJournalEntry, JournalValidationError } from '../journalEntryService.js';

describe('JournalEntry Service - Validation Tests', () => {
  describe('Lines Count Validation', () => {
    it('should REJECT entry with less than 2 lines', async () => {
      const entry = {
        date: new Date(),
        lines: [{ accountId: 'acc1', debit: 100, credit: 0 }],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MIN_LINES')).toBe(true);
    });

    it('should REJECT entry with empty lines array', async () => {
      const entry = {
        date: new Date(),
        lines: [],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MIN_LINES')).toBe(true);
    });

    it('should REJECT entry with no lines property', async () => {
      const entry = {
        date: new Date(),
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Balance Validation', () => {
    it('should REJECT unbalanced entry (debit > credit)', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { accountId: 'acc1', debit: 100, credit: 0 },
          { accountId: 'acc2', debit: 0, credit: 50 }, // Unbalanced!
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNBALANCED')).toBe(true);
      expect(result.totals.debit).toBe(100);
      expect(result.totals.credit).toBe(50);
    });

    it('should REJECT unbalanced entry (credit > debit)', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { accountId: 'acc1', debit: 50, credit: 0 },
          { accountId: 'acc2', debit: 0, credit: 100 }, // Unbalanced!
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNBALANCED')).toBe(true);
    });

    it('should ACCEPT balanced entry (debit == credit)', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { accountId: 'acc1', debit: 100, credit: 0 },
          { accountId: 'acc2', debit: 0, credit: 100 },
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.totals.debit).toBe(100);
      expect(result.totals.credit).toBe(100);
    });

    it('should ACCEPT balanced multi-line entry', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { accountId: 'acc1', debit: 100, credit: 0 },
          { accountId: 'acc2', debit: 50, credit: 0 },
          { accountId: 'acc1', debit: 0, credit: 75 },
          { accountId: 'acc2', debit: 0, credit: 75 },
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(true);
      expect(result.totals.debit).toBe(150);
      expect(result.totals.credit).toBe(150);
    });

    it('should handle floating point precision correctly', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { accountId: 'acc1', debit: 33.33, credit: 0 },
          { accountId: 'acc2', debit: 33.33, credit: 0 },
          { accountId: 'acc1', debit: 33.34, credit: 0 },
          { accountId: 'acc2', debit: 0, credit: 100 },
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(true);
    });
  });

  describe('Debit/Credit Validation', () => {
    it('should REJECT negative debit', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { accountId: 'acc1', debit: -100, credit: 0 },
          { accountId: 'acc2', debit: 0, credit: 100 },
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NEGATIVE_DEBIT')).toBe(true);
    });

    it('should REJECT negative credit', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { accountId: 'acc1', debit: 100, credit: 0 },
          { accountId: 'acc2', debit: 0, credit: -100 },
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NEGATIVE_CREDIT')).toBe(true);
    });

    it('should REJECT lines with both debit and credit as zero', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { accountId: 'acc1', debit: 0, credit: 0 },
          { accountId: 'acc2', debit: 0, credit: 0 },
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'ZERO_LINE')).toBe(true);
    });
  });

  describe('Account Validation', () => {
    it('should REJECT line with missing accountId', async () => {
      const entry = {
        date: new Date(),
        lines: [
          { debit: 100, credit: 0 }, // Missing accountId
          { accountId: 'acc2', debit: 0, credit: 100 },
        ],
      };

      const result = await validateJournalEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_ACCOUNT')).toBe(true);
    });
  });
});

describe('JournalEntry Service - postJournalEntry', () => {
  it('should throw JournalValidationError for invalid entry', async () => {
    const invalidEntry = {
      date: new Date(),
      lines: [{ accountId: 'acc1', debit: 100, credit: 0 }],
    };

    await expect(postJournalEntry(invalidEntry)).rejects.toThrow(JournalValidationError);
  });
});
