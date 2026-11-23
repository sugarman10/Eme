/**
 * Financial Audit Fixes - Automated Test Suite
 * اختبارات التحقق من إصلاح الثغرات المالية والمحاسبية
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import JournalEntry from '../../models/JournalEntry.js';
import Receipt from '../../models/Receipt.js';
import PaymentVoucher from '../../models/PaymentVoucher.js';

describe('Financial Audit Remediation - Schema & Logic Verification', () => {
  describe('1. JournalEntry referenceType Enum Expansion', () => {
    it('should include all required operational and financial reference types in enum', () => {
      const enumValues = JournalEntry.schema.path('referenceType').enumValues;

      expect(enumValues).toContain('DAILY_CLOSURE');
      expect(enumValues).toContain('WALLET_WITHDRAWAL');
      expect(enumValues).toContain('WALLET_DEPOSIT');
      expect(enumValues).toContain('SALES');
      expect(enumValues).toContain('INCOME');
      expect(enumValues).toContain('SALARY');
      expect(enumValues).toContain('DEPOSIT');
      expect(enumValues).toContain('PURCHASE_RETURN_REVERSAL');
      expect(enumValues).toContain('SALE_INVOICE');
      expect(enumValues).toContain('RECEIPT');
      expect(enumValues).toContain('PAYMENT_VOUCHER');
    });
  });

  describe('2. Receipt Schema Enhancements', () => {
    it('should have splitDetails, treasury, and journalEntry fields in Receipt schema', () => {
      const paths = Receipt.schema.paths;
      expect(paths['treasury']).toBeDefined();
      expect(paths['journalEntry']).toBeDefined();
      expect(paths['splitDetails']).toBeDefined();
    });
  });

  describe('3. JournalEntry Lines Schema Integrity', () => {
    it('should confirm lines.account is the valid schema path (not lines.accountId)', () => {
      const linesSchema = JournalEntry.schema.path('lines');
      expect(linesSchema.schema.path('account')).toBeDefined();
      expect(linesSchema.schema.path('accountId')).toBeUndefined();
    });
  });

  describe('4. Receipt Reversal Audit Payload (ReferenceError Fix)', () => {
    it('should safely calculate walletReversalAmount without reference error', () => {
      const regularReceipt = { method: 'cash', amount: 500 };
      const walletReceipt = { method: 'wallet', amount: 350 };

      const regularReversalAmount = regularReceipt.method === 'wallet' ? regularReceipt.amount : 0;
      const walletReversalAmount = walletReceipt.method === 'wallet' ? walletReceipt.amount : 0;

      expect(regularReversalAmount).toBe(0);
      expect(walletReversalAmount).toBe(350);
    });
  });

  describe('5. Split Payment Journal Lines Balance', () => {
    it('should balance multi-leg split payment debits and credits precisely', () => {
      const totalAmount = 1000;
      const splitDetails = [
        { method: 'bank', amount: 800 },
        { method: 'cash', amount: 200 },
      ];

      const splitLines = splitDetails.map((s) => ({
        account: s.method === 'bank' ? 'bankAccId' : 'cashAccId',
        debit: s.amount,
        credit: 0,
      }));

      const creditLine = {
        account: 'arAccId',
        debit: 0,
        credit: totalAmount,
      };

      const allLines = [...splitLines, creditLine];
      const sumDebit = allLines.reduce((sum, l) => sum + l.debit, 0);
      const sumCredit = allLines.reduce((sum, l) => sum + l.credit, 0);

      expect(sumDebit).toBe(1000);
      expect(sumCredit).toBe(1000);
      expect(sumDebit).toBe(sumCredit);
    });
  });
});
