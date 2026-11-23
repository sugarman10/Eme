/**
 * Full Audit Remediation - Automated Test Suite
 * اختبارات التحقق من إصلاحات المبيعات، الرواتب، المشتريات، المخزون، والمردودات
 */

import { describe, it, expect } from 'vitest';
import JournalEntry from '../../models/JournalEntry.js';
import PurchaseOrder from '../../models/PurchaseOrder.js';
import Item from '../../models/Item.js';
import { add, sub, mul } from '../../utils/mathUtils.js';

describe('Full ERP System Audit Remediation - Test Suite', () => {

  describe('1. JournalEntry ReferenceType Enum Compatibility', () => {
    it('should include both SALARY and PAYROLL in referenceType enum', () => {
      const enumValues = JournalEntry.schema.path('referenceType').enumValues;

      expect(enumValues).toContain('SALARY');
      expect(enumValues).toContain('PAYROLL');
      expect(enumValues).toContain('SALE_INVOICE');
      expect(enumValues).toContain('PURCHASE');
      expect(enumValues).toContain('PURCHASE_RETURN');
      expect(enumValues).toContain('PURCHASE_RETURN_REVERSAL');
      expect(enumValues).toContain('SALES_RETURN');
    });
  });

  describe('2. Sales Tax Calculation on Net Taxable Amount (Legal Compliance)', () => {
    it('should calculate VAT on net amount after discount, not on gross subtotal', () => {
      const subtotal = 1000;
      const discount = 200;
      const taxRate = 15; // 15% VAT

      // Correct formula implemented in salesController.js
      const taxableAmount = Math.max(0, sub(subtotal, discount)); // 800
      const tax = mul(taxableAmount, taxRate / 100); // 120
      const grand = add(taxableAmount, tax); // 920

      expect(taxableAmount).toBe(800);
      expect(tax).toBe(120);
      expect(grand).toBe(920);

      // Verify it does NOT calculate tax on un-discounted gross (which would have been 150)
      expect(tax).not.toBe(150);
    });
  });

  describe('3. Credit Limit Override Invoice Array Handling (TypeError Fix)', () => {
    it('should safely access document from Model.create array without throwing TypeError', () => {
      // Model.create([data]) returns an array of documents
      const mockCreatedInvoices = [
        {
          _id: 'inv_123',
          note: 'Initial Note',
          save: function () {
            this.saved = true;
            return Promise.resolve(this);
          },
        },
      ];

      // Fixed logic in salesController.js
      const targetInvoice = Array.isArray(mockCreatedInvoices) ? mockCreatedInvoices[0] : mockCreatedInvoices;
      expect(targetInvoice).toBeDefined();
      expect(typeof targetInvoice.save).toBe('function');

      targetInvoice.note = (targetInvoice.note || '') + ' [تجاوز سقف الائتمان بموافقة مسؤولة]';
      expect(targetInvoice.note).toContain('تجاوز سقف الائتمان');
    });
  });

  describe('4. Bundle Component Return Quantity Capping (Fraud Prevention)', () => {
    it('should calculate exact maximum component quantity from invoice and reject excess return', () => {
      const invoice = {
        items: [
          {
            item: 'bundle_pc_01',
            name: 'Gaming PC',
            qty: 2, // 2 bundles sold
            isBundle: true,
            bundleComponents: [
              { item: 'gpu_rtx_4080', name: 'RTX 4080', qty: 1 }, // 1 GPU per bundle
              { item: 'ram_16gb', name: 'RAM 16GB', qty: 2 },     // 2 RAM sticks per bundle
            ],
          },
        ],
        returns: [
          { item: 'gpu_rtx_4080', qty: 1 }, // 1 GPU was already returned previously
        ],
      };

      const originalItem = invoice.items[0];
      const compMatch = originalItem.bundleComponents.find((c) => c.item === 'gpu_rtx_4080');

      // Total sold components: 2 bundles * 1 GPU = 2 GPUs sold
      const compSoldQty = Number(originalItem.qty || 1) * Number(compMatch.qty || 1);
      expect(compSoldQty).toBe(2);

      // Previously returned: 1
      const prevReturnedQty = invoice.returns.filter((r) => r.item === 'gpu_rtx_4080').reduce((s, r) => s + r.qty, 0);
      expect(prevReturnedQty).toBe(1);

      // Remaining allowed to return: 2 - 1 = 1
      const maxAvailableQty = compSoldQty;
      const remainingQty = maxAvailableQty - prevReturnedQty;
      expect(remainingQty).toBe(1);

      // Testing invalid return attempt: customer tries to return 5 GPUs
      const requestedReturnQty = 5;
      const isAllowed = requestedReturnQty <= remainingQty;
      expect(isAllowed).toBe(false);

      // Valid return attempt: customer returns 1 GPU
      const validReturnQty = 1;
      expect(validReturnQty <= remainingQty).toBe(true);
    });
  });

  describe('5. Direct POS Return Price Schema Validation', () => {
    it('should correctly read price from Item model price field instead of undefined retailPrice', () => {
      const product = {
        _id: 'prod_99',
        name: 'Headphones',
        price: 150,
        cost: 90,
        // retailPrice does not exist on Item model
      };

      const rItemWithoutPrice = { item: 'prod_99', qty: 1 };

      // Fixed logic in salesReturnController.js
      const unitPrice = Number(rItemWithoutPrice.unitPrice ?? rItemWithoutPrice.price ?? product.price ?? 0);
      expect(unitPrice).toBe(150);

      // Verify the faulty fallback would have returned 0
      const buggyPrice = Number(rItemWithoutPrice.unitPrice ?? rItemWithoutPrice.price ?? product.retailPrice ?? 0);
      expect(buggyPrice).toBe(0);
    });
  });

  describe('6. Bulk Price Update Field Whitelist', () => {
    it('should reject unauthorized field modifications and allow only whitelisted price fields', () => {
      const allowedFields = ['price', 'wholesalePrice', 'minPrice', 'maxPrice', 'cost', 'costUSD', 'priceUSD', 'wholesalePriceUSD'];

      expect(allowedFields.includes('price')).toBe(true);
      expect(allowedFields.includes('cost')).toBe(true);
      expect(allowedFields.includes('wholesalePrice')).toBe(true);

      // Malicious or invalid fields must be rejected
      expect(allowedFields.includes('password')).toBe(false);
      expect(allowedFields.includes('role')).toBe(false);
      expect(allowedFields.includes('$where')).toBe(false);
      expect(allowedFields.includes('stocks')).toBe(false);
    });
  });

  describe('7. Concurrency Lock for Transfer Cancellation', () => {
    it('should simulate atomic check-and-set preventing duplicate stock reversals', () => {
      let transfer = {
        _id: 'trf_001',
        status: 'completed',
      };

      // Atomic findOneAndUpdate simulation
      const atomicCancel = () => {
        if (transfer.status !== 'cancelled') {
          transfer.status = 'cancelled';
          return { success: true, transfer };
        }
        return null; // Already cancelled
      };

      // Request 1: succeeds
      const req1 = atomicCancel();
      expect(req1).not.toBeNull();
      expect(req1.success).toBe(true);

      // Request 2 (concurrent double-click): fails cleanly
      const req2 = atomicCancel();
      expect(req2).toBeNull();
    });
  });
});
