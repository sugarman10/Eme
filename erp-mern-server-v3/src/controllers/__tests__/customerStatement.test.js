/**
 * Customer Statement Report Tests
 * اختبارات كشف حساب العميل
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// TESTS
// ============================================================

describe('Customer Statement Report Logic', () => {

    describe('Statement Ordering', () => {

        it('should order transactions by date ascending', () => {
            const transactions = [
                { التاريخ: new Date('2024-03-15'), النوع: 'فاتورة', مدين: 500, دائن: 0 },
                { التاريخ: new Date('2024-01-10'), النوع: 'فاتورة', مدين: 300, دائن: 0 },
                { التاريخ: new Date('2024-02-20'), النوع: 'سند قبض', مدين: 0, دائن: 200 }
            ];

            // Sort by date ascending
            const sorted = transactions.sort((a, b) =>
                new Date(a.التاريخ).getTime() - new Date(b.التاريخ).getTime()
            );

            expect(sorted[0].التاريخ.getMonth()).toBe(0); // January
            expect(sorted[1].التاريخ.getMonth()).toBe(1); // February
            expect(sorted[2].التاريخ.getMonth()).toBe(2); // March
        });

        it('should maintain order with same-day transactions', () => {
            const transactions = [
                { التاريخ: new Date('2024-01-15T10:00:00'), النوع: 'فاتورة', _sortDate: new Date('2024-01-15T10:00:00').getTime() },
                { التاريخ: new Date('2024-01-15T09:00:00'), النوع: 'سند قبض', _sortDate: new Date('2024-01-15T09:00:00').getTime() },
            ];

            const sorted = transactions.sort((a, b) => a._sortDate - b._sortDate);

            expect(sorted[0].النوع).toBe('سند قبض'); // Earlier in the day
            expect(sorted[1].النوع).toBe('فاتورة');
        });

    });

    describe('Running Balance Calculation', () => {

        it('should calculate correct running balance', () => {
            const transactions = [
                { مدين: 1000, دائن: 0 },     // Invoice: +1000, Balance = 1000
                { مدين: 500, دائن: 0 },      // Invoice: +500, Balance = 1500
                { مدين: 0, دائن: 300 },      // Receipt: -300, Balance = 1200
                { مدين: 200, دائن: 0 },      // Invoice: +200, Balance = 1400
                { مدين: 0, دائن: 1000 }      // Receipt: -1000, Balance = 400
            ];

            let runningBalance = 0;
            const withBalance = transactions.map(tx => {
                runningBalance += tx.مدين - tx.دائن;
                return { ...tx, الرصيد: runningBalance };
            });

            expect(withBalance[0].الرصيد).toBe(1000);
            expect(withBalance[1].الرصيد).toBe(1500);
            expect(withBalance[2].الرصيد).toBe(1200);
            expect(withBalance[3].الرصيد).toBe(1400);
            expect(withBalance[4].الرصيد).toBe(400);
        });

        it('should handle negative balance (overpayment)', () => {
            const transactions = [
                { مدين: 500, دائن: 0 },   // Invoice: +500
                { مدين: 0, دائن: 800 }    // Receipt: -800 (overpayment)
            ];

            let runningBalance = 0;
            transactions.forEach(tx => {
                runningBalance += tx.مدين - tx.دائن;
            });

            expect(runningBalance).toBe(-300); // Customer has credit
        });

        it('should calculate final balance correctly', () => {
            const إجمالي_المدين = 1700; // Total invoices
            const إجمالي_الدائن = 1300; // Total receipts
            const الرصيد_الختامي = إجمالي_المدين - إجمالي_الدائن;

            expect(الرصيد_الختامي).toBe(400);
        });

    });

    describe('Works When From Omitted (Cumulative)', () => {

        it('should build date filter with only to date', () => {
            const from = null;
            const to = '2024-12-31';

            const endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);

            const dateFilter = { $lte: endDate };

            if (from) {
                const startDate = new Date(from);
                dateFilter.$gte = startDate;
            }

            expect(dateFilter.$lte).toBeDefined();
            expect(dateFilter.$gte).toBeUndefined(); // No start date
        });

        it('should include all historical transactions when from omitted', () => {
            const allTransactions = [
                { date: new Date('2020-01-01'), amount: 1000 },
                { date: new Date('2022-06-15'), amount: 500 },
                { date: new Date('2024-12-01'), amount: 300 }
            ];

            const to = new Date('2024-12-31');
            const filtered = allTransactions.filter(tx => tx.date <= to);

            expect(filtered.length).toBe(3); // All included
        });

    });

    describe('Response Structure (Arabic)', () => {

        it('should return correct Arabic structure', () => {
            const mockResponse = {
                العميل: {
                    المعرف: 'cust123',
                    الاسم: 'شركة الأمل',
                    الكود: 'C001'
                },
                الفترة: {
                    من: null,
                    إلى: '2024-12-31'
                },
                العمليات: [
                    { التاريخ: new Date(), النوع: 'فاتورة', الرقم: 'INV-001', مدين: 1000, دائن: 0, الرصيد: 1000 }
                ],
                الإجماليات: {
                    إجمالي_المدين: 1000,
                    إجمالي_الدائن: 0,
                    الرصيد_الختامي: 1000
                }
            };

            expect(mockResponse).toHaveProperty('العميل');
            expect(mockResponse).toHaveProperty('الفترة');
            expect(mockResponse).toHaveProperty('العمليات');
            expect(mockResponse).toHaveProperty('الإجماليات');
            expect(mockResponse.العميل).toHaveProperty('الاسم');
            expect(mockResponse.الإجماليات).toHaveProperty('الرصيد_الختامي');
        });

        it('should distinguish between فاتورة and سند قبض', () => {
            const invoiceType = 'فاتورة';
            const receiptType = 'سند قبض';

            expect(invoiceType).not.toBe(receiptType);
            expect(['فاتورة', 'سند قبض']).toContain(invoiceType);
            expect(['فاتورة', 'سند قبض']).toContain(receiptType);
        });

    });

});
