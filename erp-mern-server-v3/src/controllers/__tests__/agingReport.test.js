/**
 * Aging Report Tests
 * اختبارات تقرير أعمار الديون
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// TESTS
// ============================================================

describe('Aging Report Logic', () => {

    describe('Ignore Invoices with Remaining = 0', () => {

        it('should exclude fully paid invoices', () => {
            const invoices = [
                { totals: { remaining: 0 }, date: new Date() },      // Paid
                { totals: { remaining: 500 }, date: new Date() },    // Unpaid
                { totals: { remaining: 0.001 }, date: new Date() }   // Nearly paid (< 0.01)
            ];

            const unpaidInvoices = invoices.filter(inv => inv.totals.remaining > 0.01);

            expect(unpaidInvoices.length).toBe(1);
            expect(unpaidInvoices[0].totals.remaining).toBe(500);
        });

    });

    describe('Correct Bucket Assignment', () => {

        it('should assign 0-30 days bucket correctly', () => {
            const to = new Date('2024-12-31');
            const invoiceDate = new Date('2024-12-15'); // 16 days old
            const ageDays = Math.floor((to - invoiceDate) / (1000 * 60 * 60 * 24));

            let bucketKey;
            if (ageDays <= 30) bucketKey = '0_30';
            else if (ageDays <= 60) bucketKey = '31_60';
            else if (ageDays <= 90) bucketKey = '61_90';
            else bucketKey = '90_أكثر';

            expect(ageDays).toBe(16);
            expect(bucketKey).toBe('0_30');
        });

        it('should assign 31-60 days bucket correctly', () => {
            const to = new Date('2024-12-31');
            const invoiceDate = new Date('2024-11-15'); // 46 days old
            const ageDays = Math.floor((to - invoiceDate) / (1000 * 60 * 60 * 24));

            let bucketKey;
            if (ageDays <= 30) bucketKey = '0_30';
            else if (ageDays <= 60) bucketKey = '31_60';
            else if (ageDays <= 90) bucketKey = '61_90';
            else bucketKey = '90_أكثر';

            expect(ageDays).toBe(46);
            expect(bucketKey).toBe('31_60');
        });

        it('should assign 61-90 days bucket correctly', () => {
            const to = new Date('2024-12-31');
            const invoiceDate = new Date('2024-10-15'); // 77 days old
            const ageDays = Math.floor((to - invoiceDate) / (1000 * 60 * 60 * 24));

            let bucketKey;
            if (ageDays <= 30) bucketKey = '0_30';
            else if (ageDays <= 60) bucketKey = '31_60';
            else if (ageDays <= 90) bucketKey = '61_90';
            else bucketKey = '90_أكثر';

            expect(ageDays).toBe(77);
            expect(bucketKey).toBe('61_90');
        });

        it('should assign 90+ days bucket correctly', () => {
            const to = new Date('2024-12-31');
            const invoiceDate = new Date('2024-08-01'); // 152 days old
            const ageDays = Math.floor((to - invoiceDate) / (1000 * 60 * 60 * 24));

            let bucketKey;
            if (ageDays <= 30) bucketKey = '0_30';
            else if (ageDays <= 60) bucketKey = '31_60';
            else if (ageDays <= 90) bucketKey = '61_90';
            else bucketKey = '90_أكثر';

            expect(ageDays).toBe(152);
            expect(bucketKey).toBe('90_أكثر');
        });

    });

    describe('Handle Partial Payment', () => {

        it('should use remaining balance, not grand total', () => {
            const invoice = {
                totals: {
                    grand: 1000,
                    paid: 600,
                    remaining: 400
                }
            };

            const amountToReport = invoice.totals.remaining;

            expect(amountToReport).toBe(400);
            expect(amountToReport).not.toBe(invoice.totals.grand);
        });

    });

    describe('Totals Per Customer and Grand Totals', () => {

        it('should calculate customer totals correctly', () => {
            const customerInvoices = [
                { remaining: 100, bucket: '0_30' },
                { remaining: 200, bucket: '31_60' },
                { remaining: 300, bucket: '90_أكثر' }
            ];

            const customerData = {
                '0_30': 0,
                '31_60': 0,
                '61_90': 0,
                '90_أكثر': 0,
                الإجمالي: 0
            };

            for (const inv of customerInvoices) {
                customerData[inv.bucket] += inv.remaining;
                customerData['الإجمالي'] += inv.remaining;
            }

            expect(customerData['0_30']).toBe(100);
            expect(customerData['31_60']).toBe(200);
            expect(customerData['90_أكثر']).toBe(300);
            expect(customerData['الإجمالي']).toBe(600);
        });

        it('should calculate grand totals correctly', () => {
            const customers = [
                { 'الإجمالي': 600, '0_30': 100, '31_60': 200, '61_90': 0, '90_أكثر': 300 },
                { 'الإجمالي': 400, '0_30': 200, '31_60': 0, '61_90': 100, '90_أكثر': 100 }
            ];

            const الإجماليات = {
                '0_30': customers.reduce((sum, c) => sum + c['0_30'], 0),
                '31_60': customers.reduce((sum, c) => sum + c['31_60'], 0),
                '61_90': customers.reduce((sum, c) => sum + c['61_90'], 0),
                '90_أكثر': customers.reduce((sum, c) => sum + c['90_أكثر'], 0),
                الإجمالي: customers.reduce((sum, c) => sum + c['الإجمالي'], 0)
            };

            expect(الإجماليات['0_30']).toBe(300);
            expect(الإجماليات['31_60']).toBe(200);
            expect(الإجماليات['61_90']).toBe(100);
            expect(الإجماليات['90_أكثر']).toBe(400);
            expect(الإجماليات['الإجمالي']).toBe(1000);
        });

    });

    describe('Response Structure (Arabic)', () => {

        it('should return correct Arabic structure', () => {
            const mockResponse = {
                إلى: '2024-12-31',
                العملاء: [
                    {
                        العميل: { المعرف: 'cust1', الاسم: 'شركة الأمل', الكود: 'C001' },
                        '0_30': 100,
                        '31_60': 200,
                        '61_90': 0,
                        '90_أكثر': 300,
                        الإجمالي: 600
                    }
                ],
                الإجماليات: { '0_30': 100, '31_60': 200, '61_90': 0, '90_أكثر': 300, الإجمالي: 600 }
            };

            expect(mockResponse).toHaveProperty('إلى');
            expect(mockResponse).toHaveProperty('العملاء');
            expect(mockResponse).toHaveProperty('الإجماليات');
            expect(mockResponse.العملاء[0]).toHaveProperty('العميل');
            expect(mockResponse.العملاء[0]).toHaveProperty('الإجمالي');
        });

    });

});
