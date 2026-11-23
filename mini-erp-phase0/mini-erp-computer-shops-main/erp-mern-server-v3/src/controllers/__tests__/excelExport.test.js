import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { connectDB, closeDB, resetTestDb } from '../../tests/db';
import User from '../../models/User';
import Account from '../../models/Account';
import JournalEntry from '../../models/JournalEntry';
import Customer from '../../models/Customer';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

// Ensure JWT_SECRET is set for tests
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); // سر اختبار فقط، مولّد عشوائياً في كل تشغيل
const TEST_PASSWORD = process.env.TEST_PASSWORD || crypto.randomBytes(12).toString('base64url'); // كلمة مرور اختبار فقط — تُستخدم لإنشاء مستخدمي الاختبار وتسجيل دخولهم

describe('Financial Excel Export Endpoints', () => {
  let adminToken;
  let userId;
  let cashierToken;
  let seededCustomerId;

  beforeEach(async () => {
    try {
      await connectDB();
      await resetTestDb();

      const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

      // Create Admin User
      const user = await User.create({
        username: 'admin_excel',
        name: 'Admin User',
        email: 'admin_excel@test.com',
        password: hashedPassword,
        role: 'admin',
      });
      userId = user._id;

      // Login Admin
      const res = await request(app).post('/api/auth/login').send({ username: 'admin_excel', password: TEST_PASSWORD });
      adminToken = res.body.token;

      // Create Cashier User (Restricted)
      await User.create({
        username: 'cashier_excel',
        name: 'Cashier User',
        email: 'cashier_excel@test.com',
        password: hashedPassword,
        role: 'cashier',
      });

      // Login Cashier
      const resCashier = await request(app)
        .post('/api/auth/login')
        .send({ username: 'cashier_excel', password: TEST_PASSWORD });
      cashierToken = resCashier.body.token;

      // Seed Accounts - Removed balanceType, used valid type 'revenue'
      const assetsAccount = await Account.create({
        code: '1001',
        name: 'Cash',
        type: 'asset',
        balance: 1000,
      });

      const incomeAccount = await Account.create({
        code: '4001',
        name: 'Sales',
        type: 'revenue',
        balance: 500,
      });

      // Seed Customer
      const customer = await Customer.create({
        code: 'CUST-001',
        name: 'Test Customer',
        type: 'retail',
      });
      seededCustomerId = customer._id;

      // Create a Journal Entry
      await JournalEntry.create({
        date: new Date(),
        ref: 'JE-001',
        note: 'Test Entry',
        lines: [
          { account: assetsAccount._id, debit: 500, credit: 0, note: 'Debit Cash' },
          { account: incomeAccount._id, debit: 0, credit: 500, note: 'Credit Sales' },
        ],
        user: userId,
      });
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  afterEach(async () => {
    await resetTestDb();
  });

  // --- Security Tests ---

  it('should reject unauthorized access (401) without token', async () => {
    const res = await request(app).get('/api/finance/reports/trial-balance/export');
    expect(res.status).toBe(401);
  });

  it('should reject access (403) for unauthorized role (cashier)', async () => {
    const res = await request(app)
      .get('/api/finance/reports/trial-balance/export')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(403);
  });

  // --- Functional Tests ---

  it('should export Trial Balance as Excel', async () => {
    const res = await request(app)
      .get('/api/finance/reports/trial-balance/export')
      .query({ from: '2023-01-01', to: '2025-12-31' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.header['content-disposition']).toContain('trial-balance');
  }, 20000);

  it('should export Income Statement as Excel', async () => {
    const res = await request(app)
      .get('/api/finance/reports/income-statement/export')
      .query({ from: '2023-01-01', to: '2025-12-31' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.header['content-disposition']).toContain('income-statement');
  });

  it('should export Customer Statement as Excel', async () => {
    const res = await request(app)
      .get('/api/finance/reports/customer-statement/export')
      .query({ from: '2023-01-01', to: '2025-12-31', customerId: seededCustomerId.toString() })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.header['content-disposition']).toContain('customer-statement');
  });

  it('should export Aging Report as Excel', async () => {
    const res = await request(app)
      .get('/api/finance/reports/aging/export')
      .query({ to: '2025-12-31' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.header['content-disposition']).toContain('aging-report');
  });
});
