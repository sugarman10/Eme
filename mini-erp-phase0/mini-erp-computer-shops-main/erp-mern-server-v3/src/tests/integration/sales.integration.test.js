/**
 * Sales Invoice Integration Test
 * 
 * Tests the complete sales invoice flow:
 * 1. Stock validation and deduction
 * 2. Journal entry creation (balanced)
 * 3. Atomicity (all-or-nothing)
 * 4. Race condition prevention
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../app.js';
import { connectDB, closeDB, resetTestDb } from '../db.js';

// Models
import Item from '../../models/Item.js';
import Customer from '../../models/Customer.js';
import Warehouse from '../../models/Warehouse.js';
import Treasury from '../../models/Treasury.js';
import Account from '../../models/Account.js';
import User from '../../models/User.js';
import JournalEntry from '../../models/JournalEntry.js';
import StockLedger from '../../models/StockLedger.js';
import SalesInvoice from '../../models/SalesInvoice.js';
import Transaction from '../../models/Transaction.js';
import Counter from '../../models/Counter.js';

// كلمة مرور اختبار فقط — مولّدة عشوائياً في كل تشغيل إن لم تُضبط من البيئة
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || crypto.randomBytes(12).toString('hex');

// Auth helper
import jwt from 'jsonwebtoken';

// Test data holders
let testToken;
let testWarehouse;
let testTreasury;
let testCustomer;
let testProduct;
let testUser;

// Generate test token
const generateTestToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role, name: user.name },
        process.env.JWT_SECRET || 'test-secret-key',
        { expiresIn: '1h' }
    );
};

// Seed required system accounts (Arabic COA)
const seedSystemAccounts = async () => {
    const accounts = [
        { code: '1010', name: 'الصندوق', nameEn: 'Cash', type: 'asset', balance: 0 },
        { code: '1020', name: 'البنك', nameEn: 'Bank', type: 'asset', balance: 0 },
        { code: '1030', name: 'ذمم العملاء', nameEn: 'Accounts Receivable', type: 'asset', balance: 0 },
        { code: '4010', name: 'إيرادات المبيعات', nameEn: 'Sales Revenue', type: 'revenue', balance: 0 },
        { code: '2020', name: 'ض.ق.م المستحقة', nameEn: 'VAT Payable', type: 'liability', balance: 0 },
        { code: '2030', name: 'أمانات العملاء', nameEn: 'Customer Deposits', type: 'liability', balance: 0 },
    ];

    for (const acc of accounts) {
        await Account.findOneAndUpdate(
            { code: acc.code },
            acc,
            { upsert: true, new: true }
        );
    }
};

describe('Sales Invoice Flow (Integration)', () => {

    beforeAll(async () => {
        // Connect to test database
        process.env.NODE_ENV = 'test';
        await connectDB();

        // 🔥 FIX 1: Pre-create collections to avoid "catalog changes" error in transactions
        // MongoDB transactions require collections and indexes to exist beforehand
        await Promise.all([
            SalesInvoice.createCollection(),
            JournalEntry.createCollection(),
            StockLedger.createCollection(),
            Item.createCollection(),
            Customer.createCollection(),
            Account.createCollection(),
            Treasury.createCollection(),
            Transaction.createCollection(),
            Counter.createCollection(),
        ]);

        await Promise.all([
            SalesInvoice.init(),
            JournalEntry.init(),
            StockLedger.init(),
            Item.init(),
            Customer.init(),
            Account.init(),
            Treasury.init(),
            Transaction.init(),
            Counter.init(),
        ]);
    });

    afterAll(async () => {
        await closeDB();
    });

    beforeEach(async () => {
        // 1. تنظيف قاعدة البيانات تماماً
        await Promise.all([
            User.deleteMany({}),
            Warehouse.deleteMany({}),
            Treasury.deleteMany({}),
            Customer.deleteMany({}),
            Item.deleteMany({}),
            SalesInvoice.deleteMany({}),
            StockLedger.deleteMany({}),
            JournalEntry.deleteMany({}),
            Account.deleteMany({})
        ]);

        // 2. إعادة إنشاء الحسابات النظامية
        await seedSystemAccounts();

        // 3. إنشاء المستخدم (مرة واحدة فقط وبشكل صحيح)
        testUser = await User.create({
            name: 'Test Cashier',
            username: 'cashier_test',
            email: 'cashier@test.com',
            password: TEST_USER_PASSWORD,
            role: 'cashier',
            isActive: true,
        });
        testToken = generateTestToken(testUser);

        // 4. مهلة لرفع أقفال قاعدة البيانات
        await new Promise(resolve => setTimeout(resolve, 100));

        // 5. إنشاء باقي البيانات
        testWarehouse = await Warehouse.create({
            name: 'المستودع الرئيسي',
            code: 'WH-001',
            isDefault: true,
        });

        testTreasury = await Treasury.create({
            name: 'الصندوق الرئيسي',
            code: 'TR-001',
            balance: 10000,
            isActive: true,
        });

        testCustomer = await Customer.create({
            name: 'عميل اختبار',
            code: 'CUST-001',
            phone: '0912345678',
            balance: 0,
            creditLimit: 5000,
        });

        testProduct = await Item.create({
            name: 'منتج اختبار',
            sku: 'TST-001',
            barcode: '1234567890',
            price: 100,
            wholesalePrice: 90,
            cost: 80,
            stocks: [
                { warehouse: testWarehouse._id, qty: 10 }
            ],
        });
    });

    // =====================================================
    // TEST 1: The Golden Path - Everything Works
    // =====================================================
    it('should create invoice, deduct stock, and create balanced journal entry', async () => {
        const payload = {
            items: [
                { item: testProduct._id.toString(), qty: 2, price: 100 }
            ],
            warehouse: testWarehouse._id.toString(),
            treasury: testTreasury._id.toString(),
            customer: testCustomer._id.toString(),
            channel: 'retail',
            paymentMethod: 'cash',
            paid: 200,
            discountValue: 0,
        };

        // Execute request
        const res = await request(app)
            .post('/api/sales/invoice-v2')
            .set('Authorization', `Bearer ${testToken}`)
            .send(payload);

        // 1. Check request success
        expect(res.statusCode).toBe(201);
        expect(res.body.number).toBeDefined();
        expect(res.body.totals.grand).toBe(200);

        // 2. Verify stock was deducted (should be 8 now)
        const updatedProduct = await Item.findById(testProduct._id);
        const warehouseStock = updatedProduct.stocks.find(
            s => s.warehouse.toString() === testWarehouse._id.toString()
        );
        expect(warehouseStock.qty).toBe(8);

        // 3. Verify stock ledger entry exists
        const ledger = await StockLedger.findOne({
            ref: { $regex: res.body._id.toString() }
        });
        expect(ledger).toBeTruthy();
        expect(ledger.qty).toBe(-2);
        expect(ledger.type).toBe('OUT');

        // 4. Verify journal entry exists and is BALANCED
        const journalEntry = await JournalEntry.findOne({
            referenceId: res.body._id.toString()
        });
        expect(journalEntry).toBeTruthy();

        // Calculate totals
        const totalDebit = journalEntry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = journalEntry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

        // Perpetual Inventory: 200 (Cash/Revenue) + 160 (COGS/Inventory) = 360
        expect(totalDebit).toBe(360);
        expect(totalCredit).toBe(360);
        expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01); // Balanced!
    });

    // =====================================================
    // TEST 2: Insufficient Stock - Must Fail
    // =====================================================
    it('should FAIL if stock is insufficient and NOT modify anything', async () => {
        const payload = {
            items: [
                { item: testProduct._id.toString(), qty: 15, price: 100 } // Requesting 15, only 10 available
            ],
            warehouse: testWarehouse._id.toString(),
            treasury: testTreasury._id.toString(),
            channel: 'retail',
            paymentMethod: 'cash',
            paid: 1500,
        };

        // Execute request
        const res = await request(app)
            .post('/api/sales/invoice-v2')
            .set('Authorization', `Bearer ${testToken}`)
            .send(payload);

        // 1. Should fail
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('رصيد غير كافٍ');

        // 2. Stock should NOT have changed
        const product = await Item.findById(testProduct._id);
        const warehouseStock = product.stocks.find(
            s => s.warehouse.toString() === testWarehouse._id.toString()
        );
        expect(warehouseStock.qty).toBe(10); // Unchanged!

        // 3. No invoice should have been created
        const invoice = await SalesInvoice.findOne({ 'items.item': testProduct._id });
        expect(invoice).toBeNull();

        // 4. No journal entry should have been created
        const journalEntryCount = await JournalEntry.countDocuments({});
        expect(journalEntryCount).toBe(0);
    });

    // =====================================================
    // TEST 3: Credit Limit Exceeded - Must Fail
    // =====================================================
    it('should FAIL if customer credit limit is exceeded', async () => {
        // Customer has credit limit of 5000, balance is 0
        // We'll try to create a credit sale of 6000
        const payload = {
            items: [
                { item: testProduct._id.toString(), qty: 6, price: 1000 } // 6000 total
            ],
            warehouse: testWarehouse._id.toString(),
            treasury: testTreasury._id.toString(),
            customer: testCustomer._id.toString(),
            channel: 'retail',
            paymentMethod: 'cash',
            paid: 0, // Credit sale (no payment)
        };

        const res = await request(app)
            .post('/api/sales/invoice-v2')
            .set('Authorization', `Bearer ${testToken}`)
            .send(payload);

        // Should fail with credit limit error
        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('سقف الائتمان');

        // Stock should NOT have changed
        const product = await Item.findById(testProduct._id);
        const warehouseStock = product.stocks.find(
            s => s.warehouse.toString() === testWarehouse._id.toString()
        );
        expect(warehouseStock.qty).toBe(10);
    });

    // =====================================================
    // TEST 4: Missing Warehouse - Must Fail
    // =====================================================
    it('should FAIL if warehouse is missing', async () => {
        const payload = {
            items: [
                { item: testProduct._id.toString(), qty: 1, price: 100 }
            ],
            // warehouse: missing!
            treasury: testTreasury._id.toString(),
            paymentMethod: 'cash',
            paid: 100,
        };

        const res = await request(app)
            .post('/api/sales/invoice-v2')
            .set('Authorization', `Bearer ${testToken}`)
            .send(payload);

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('المستودع مطلوب');
    });

    // =====================================================
    // TEST 5: Concurrent Sales Race Condition
    // =====================================================
    it('should handle concurrent requests correctly (race condition test)', async () => {
        // Create product with only 5 units
        const limitedProduct = await Item.create({
            name: 'منتج محدود',
            sku: 'LTD-001',
            price: 100,
            cost: 80,
            stocks: [{ warehouse: testWarehouse._id, qty: 5 }],
        });

        const makeRequest = () => {
            return request(app)
                .post('/api/sales/invoice-v2')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    items: [{ item: limitedProduct._id.toString(), qty: 3, price: 100 }],
                    warehouse: testWarehouse._id.toString(),
                    treasury: testTreasury._id.toString(),
                    paymentMethod: 'cash',
                    paid: 300,
                });
        };

        // Fire 3 concurrent requests, each requesting 3 units (only 5 available)
        // At most 1 should succeed, 2 should fail
        const results = await Promise.all([
            makeRequest(),
            makeRequest(),
            makeRequest(),
        ]);

        const successes = results.filter(r => r.statusCode === 201);
        const failures = results.filter(r => r.statusCode >= 400);

        // Maximum 1 success (5 units, 3 requested = only 1 can succeed)
        expect(successes.length).toBeLessThanOrEqual(1);

        // Final stock should be consistent
        const finalProduct = await Item.findById(limitedProduct._id);
        const finalStock = finalProduct.stocks.find(
            s => s.warehouse.toString() === testWarehouse._id.toString()
        );

        // If 1 succeeded, stock should be 2. If 0 succeeded, stock should be 5.
        if (successes.length === 1) {
            expect(finalStock.qty).toBe(2);
        } else {
            expect(finalStock.qty).toBe(5);
        }
    });

    // =====================================================
    // TEST 6: Cash Customer Must Pay Full Amount
    // =====================================================
    it('should FAIL if cash customer tries to buy on credit', async () => {
        // Create cash customer
        const cashCustomer = await Customer.create({
            name: 'عميل نقدي',
            code: 'CASH-001',
            isCashCustomer: true,
            balance: 0,
        });

        const payload = {
            items: [
                { item: testProduct._id.toString(), qty: 2, price: 100 }
            ],
            warehouse: testWarehouse._id.toString(),
            treasury: testTreasury._id.toString(),
            customer: cashCustomer._id.toString(),
            channel: 'retail',
            paymentMethod: 'cash',
            paid: 100, // Only paying 100 out of 200
        };

        const res = await request(app)
            .post('/api/sales/invoice-v2')
            .set('Authorization', `Bearer ${testToken}`)
            .send(payload);

        expect(res.statusCode).toBe(400);
        expect(res.body.message).toContain('العميل النقدي يجب أن يدفع كامل المبلغ');
    });
});
