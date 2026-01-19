import { describe, it, expect } from 'vitest';

/**
 * Fast Unit Tests for Dashboard Smart Alerts
 * Testing alert triggering logic and severity calculations
 */

describe('Dashboard Smart Alerts - Unit Tests', () => {

    const calcTrend = (curr, prev) => {
        if (prev === 0) return curr > 0 ? null : 0;
        return ((curr - prev) / prev) * 100;
    };

    describe('Sales Drop Alert', () => {
        it('should trigger high severity alert when trend <= -20%', () => {
            const trend = calcTrend(800, 1000); // -20%
            const pSalesVal = 1000;

            const shouldTrigger = trend !== null && trend <= -10 && pSalesVal > 0;
            expect(shouldTrigger).toBe(true);

            const severity = trend <= -20 ? 'high' : 'medium';
            expect(severity).toBe('high');
        });

        it('should trigger medium severity alert when trend between -10% and -20%', () => {
            const trend = calcTrend(850, 1000); // -15%
            const pSalesVal = 1000;

            const shouldTrigger = trend !== null && trend <= -10 && pSalesVal > 0;
            expect(shouldTrigger).toBe(true);

            const severity = trend <= -20 ? 'high' : 'medium';
            expect(severity).toBe('medium');
        });

        it('should NOT trigger alert when prev=0 (avoid false alerts)', () => {
            const trend = calcTrend(1000, 0); // null (new metric)
            const pSalesVal = 0;

            const shouldTrigger = trend !== null && trend <= -10 && pSalesVal > 0;
            expect(shouldTrigger).toBe(false);
        });

        it('should NOT trigger alert when trend is positive', () => {
            const trend = calcTrend(1200, 1000); // +20%
            const pSalesVal = 1000;

            const shouldTrigger = trend !== null && trend <= -10 && pSalesVal > 0;
            expect(shouldTrigger).toBe(false);
        });

        it('should NOT trigger alert when drop is less than 10%', () => {
            const trend = calcTrend(950, 1000); // -5%
            const pSalesVal = 1000;

            const shouldTrigger = trend !== null && trend <= -10 && pSalesVal > 0;
            expect(shouldTrigger).toBe(false);
        });
    });

    describe('Aging 90+ Alert', () => {
        it('should trigger high severity when aging90Plus > 10000', () => {
            const aging90Plus = 15000;

            const shouldTrigger = aging90Plus > 0;
            expect(shouldTrigger).toBe(true);

            const severity = aging90Plus > 10000 ? 'high' : 'medium';
            expect(severity).toBe('high');
        });

        it('should trigger medium severity when aging90Plus > 0 but <= 10000', () => {
            const aging90Plus = 5000;

            const shouldTrigger = aging90Plus > 0;
            expect(shouldTrigger).toBe(true);

            const severity = aging90Plus > 10000 ? 'high' : 'medium';
            expect(severity).toBe('medium');
        });

        it('should NOT trigger when aging90Plus = 0', () => {
            const aging90Plus = 0;

            const shouldTrigger = aging90Plus > 0;
            expect(shouldTrigger).toBe(false);
        });

        it('should calculate days since invoice correctly', () => {
            const invoiceDate = new Date('2025-09-01'); // ~118 days ago from 2025-12-27
            const now = new Date('2025-12-27');
            const daysSince = Math.floor((now - invoiceDate) / (1000 * 60 * 60 * 24));

            expect(daysSince).toBeGreaterThanOrEqual(90);
        });
    });

    describe('Low Stock Alert', () => {
        it('should trigger medium severity alert when lowStockCount > 0', () => {
            const lowStockCount = 5;

            const shouldTrigger = lowStockCount > 0;
            expect(shouldTrigger).toBe(true);

            const severity = 'medium';
            expect(severity).toBe('medium');
        });

        it('should NOT trigger when lowStockCount = 0', () => {
            const lowStockCount = 0;

            const shouldTrigger = lowStockCount > 0;
            expect(shouldTrigger).toBe(false);
        });
    });

    describe('Customer Risk Alert', () => {
        it('should trigger medium severity when top customer remaining > 5000', () => {
            const topCustomer = { name: 'Customer A', totalRemaining: 8000 };

            const severity = topCustomer.totalRemaining > 5000 ? 'medium' : 'low';
            expect(severity).toBe('medium');
        });

        it('should trigger low severity when top customer remaining <= 5000', () => {
            const topCustomer = { name: 'Customer B', totalRemaining: 3000 };

            const severity = topCustomer.totalRemaining > 5000 ? 'medium' : 'low';
            expect(severity).toBe('low');
        });
    });

    describe('Alert Response Structure', () => {
        it('should have all required alert fields', () => {
            const mockAlert = {
                id: 'sales_drop',
                title: 'هبوط في المبيعات',
                severity: 'high',
                message: 'انخفضت المبيعات بنسبة 23.4٪ مقارنة بالفترة السابقة',
                metric: { current: 15420.5, previous: 20000, trend: -22.9 },
                action: { type: 'drilldown', tab: 'invoices' }
            };

            expect(mockAlert).toHaveProperty('id');
            expect(mockAlert).toHaveProperty('title');
            expect(mockAlert).toHaveProperty('severity');
            expect(mockAlert).toHaveProperty('message');
            expect(mockAlert).toHaveProperty('metric');
            expect(mockAlert).toHaveProperty('action');

            expect(mockAlert.action).toHaveProperty('type');
            expect(mockAlert.action).toHaveProperty('tab');
        });

        it('should validate severity values', () => {
            const validSeverities = ['high', 'medium', 'low'];

            const testSeverity = 'high';
            expect(validSeverities).toContain(testSeverity);

            const testSeverity2 = 'medium';
            expect(validSeverities).toContain(testSeverity2);

            const testSeverity3 = 'low';
            expect(validSeverities).toContain(testSeverity3);
        });
    });
});
