/**
 * Complete System Audit Script
 * فحص شامل للنظام للبحث عن مشاكل محتملة
 *
 * Usage: node src/scripts/system-audit.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

const round = (num) => Math.round(num * 100) / 100;

async function systemAudit() {
  console.log('\n🔍 === COMPREHENSIVE SYSTEM AUDIT ===\n');
  console.log('='.repeat(70));

  await connectDB();

  const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
  const Customer = (await import('../models/Customer.js')).default;
  const Receipt = (await import('../models/Receipt.js')).default;
  const Supplier = (await import('../models/Supplier.js')).default;
  const PurchaseOrder = (await import('../models/PurchaseOrder.js')).default;
  const Item = (await import('../models/Item.js')).default;
  const Account = (await import('../models/Account.js')).default;
  const JournalEntry = (await import('../models/JournalEntry.js')).default;
  const Treasury = (await import('../models/Treasury.js')).default;

  const issues = [];

  // ============================================================
  // 1. CUSTOMER BALANCE AUDIT
  // ============================================================
  console.log('\n📊 1. CUSTOMER BALANCE AUDIT');
  console.log('-'.repeat(50));

  const customers = await Customer.find({ isCashCustomer: { $ne: true } }).lean();
  let custIssues = 0;

  for (const cust of customers) {
    const invoices = await SalesInvoice.find({
      customer: cust._id,
      status: { $in: ['confirmed', 'posted', 'paid'] },
    }).lean();

    const invoiceRemaining = invoices.reduce((sum, inv) => {
      return sum + ((inv.totals?.grand || 0) - (inv.totals?.paid || 0));
    }, 0);

    const expected = round(invoiceRemaining);
    const actual = round(cust.balance || 0);

    if (Math.abs(expected - actual) > 1) {
      custIssues++;
      issues.push({
        type: 'CUSTOMER_BALANCE',
        entity: cust.name,
        expected,
        actual,
        diff: round(expected - actual),
      });
    }
  }
  console.log(`   ${custIssues === 0 ? '✅' : '⚠️'} عدد حالات عدم التطابق: ${custIssues}`);

  // ============================================================
  // 2. SUPPLIER BALANCE AUDIT
  // ============================================================
  console.log('\n📊 2. SUPPLIER BALANCE AUDIT');
  console.log('-'.repeat(50));

  const suppliers = await Supplier.find({}).lean();
  let suppIssues = 0;

  for (const supp of suppliers) {
    const orders = await PurchaseOrder.find({
      supplier: supp._id,
      status: 'received',
    }).lean();

    const orderTotal = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const paidAmount = orders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
    const expectedBalance = round(orderTotal - paidAmount);
    const actualBalance = round(supp.balance || 0);

    if (Math.abs(expectedBalance - actualBalance) > 1) {
      suppIssues++;
      issues.push({
        type: 'SUPPLIER_BALANCE',
        entity: supp.name,
        expected: expectedBalance,
        actual: actualBalance,
        diff: round(expectedBalance - actualBalance),
      });
    }
  }
  console.log(`   ${suppIssues === 0 ? '✅' : '⚠️'} عدد حالات عدم التطابق: ${suppIssues}`);

  // ============================================================
  // 3. INVENTORY BALANCE AUDIT
  // ============================================================
  console.log('\n📊 3. INVENTORY BALANCE AUDIT');
  console.log('-'.repeat(50));

  const items = await Item.find({}).lean();
  let negativeStockItems = 0;
  let zeroStockItems = 0;

  for (const item of items) {
    const totalStock = (item.stocks || []).reduce((sum, s) => sum + (s.qty || 0), 0);
    if (totalStock < 0) {
      negativeStockItems++;
      issues.push({
        type: 'NEGATIVE_STOCK',
        entity: item.name,
        sku: item.sku,
        qty: totalStock,
      });
    }
    if (totalStock === 0) zeroStockItems++;
  }

  console.log(`   ${negativeStockItems === 0 ? '✅' : '⚠️'} أصناف برصيد سالب: ${negativeStockItems}`);
  console.log(`   ℹ️ أصناف برصيد صفر: ${zeroStockItems}`);

  // ============================================================
  // 4. JOURNAL ENTRY BALANCE AUDIT
  // ============================================================
  console.log('\n📊 4. JOURNAL ENTRY AUDIT');
  console.log('-'.repeat(50));

  const journals = await JournalEntry.find({}).lean();
  let unbalancedJournals = 0;

  for (const j of journals) {
    const totalDebit = j.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = j.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      unbalancedJournals++;
      issues.push({
        type: 'UNBALANCED_JOURNAL',
        ref: j.ref,
        id: j._id,
        debit: totalDebit,
        credit: totalCredit,
      });
    }
  }

  console.log(`   ${unbalancedJournals === 0 ? '✅' : '⚠️'} قيود غير متوازنة: ${unbalancedJournals}`);
  console.log(`   ℹ️ إجمالي القيود: ${journals.length}`);

  // ============================================================
  // 5. TREASURY BALANCE AUDIT
  // ============================================================
  console.log('\n📊 5. TREASURY BALANCE AUDIT');
  console.log('-'.repeat(50));

  const treasuries = await Treasury.find({}).lean();
  console.log(`   ℹ️ عدد الخزائن: ${treasuries.length}`);
  treasuries.forEach((t) => {
    console.log(`      - ${t.name}: ${round(t.balance || 0).toLocaleString()} د.ل`);
  });

  // ============================================================
  // 6. ORPHAN RECORDS CHECK
  // ============================================================
  console.log('\n📊 6. ORPHAN RECORDS CHECK');
  console.log('-'.repeat(50));

  // Invoices without customer
  const orphanInvoices = await SalesInvoice.countDocuments({
    customer: { $exists: true, $ne: null },
    $or: [{ customer: { $type: 'null' } }],
  });

  // Receipts without customer
  const orphanReceipts = await Receipt.countDocuments({
    customer: null,
  });

  console.log(`   ${orphanInvoices === 0 ? '✅' : '⚠️'} فواتير بدون عميل: ${orphanInvoices}`);
  console.log(`   ${orphanReceipts === 0 ? '✅' : '⚠️'} سندات قبض بدون عميل: ${orphanReceipts}`);

  // ============================================================
  // 7. INVOICE STATUS CHECK
  // ============================================================
  console.log('\n📊 7. INVOICE STATUS DISTRIBUTION');
  console.log('-'.repeat(50));

  const statusDist = await SalesInvoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

  statusDist.forEach((s) => {
    console.log(`   📍 ${s._id || 'undefined'}: ${s.count}`);
  });

  // ============================================================
  // 8. ACCOUNT BALANCE VERIFICATION
  // ============================================================
  console.log('\n📊 8. ACCOUNT BALANCE VERIFICATION');
  console.log('-'.repeat(50));

  // Check if account balances match journal entries
  const accounts = await Account.find({}).lean();
  let accountIssues = 0;

  for (const acc of accounts) {
    const journalAgg = await JournalEntry.aggregate([
      { $unwind: '$lines' },
      { $match: { 'lines.account': acc._id } },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: '$lines.debit' },
          totalCredit: { $sum: '$lines.credit' },
        },
      },
    ]);

    if (journalAgg.length > 0) {
      const { totalDebit, totalCredit } = journalAgg[0];
      let expectedBalance = 0;

      // Calculate expected balance based on account type
      if (['asset', 'expense'].includes(acc.type)) {
        expectedBalance = totalDebit - totalCredit;
      } else {
        expectedBalance = totalCredit - totalDebit;
      }

      const diff = Math.abs(round(expectedBalance) - round(acc.balance || 0));
      if (diff > 1) {
        accountIssues++;
        if (accountIssues <= 5) {
          issues.push({
            type: 'ACCOUNT_BALANCE',
            account: `${acc.code} - ${acc.name}`,
            expected: round(expectedBalance),
            actual: round(acc.balance || 0),
            diff: round(diff),
          });
        }
      }
    }
  }

  console.log(`   ${accountIssues === 0 ? '✅' : '⚠️'} حسابات برصيد غير متطابق: ${accountIssues}`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('📋 AUDIT SUMMARY');
  console.log('='.repeat(70));

  const totalIssues = issues.length;

  if (totalIssues === 0) {
    console.log('\n   ✅ لم يتم العثور على مشاكل! النظام سليم.');
  } else {
    console.log(`\n   ⚠️ تم العثور على ${totalIssues} مشكلة محتملة:`);

    const issueTypes = {};
    issues.forEach((i) => {
      issueTypes[i.type] = (issueTypes[i.type] || 0) + 1;
    });

    Object.entries(issueTypes).forEach(([type, count]) => {
      console.log(`      - ${type}: ${count}`);
    });

    console.log('\n   أول 5 مشاكل:');
    issues.slice(0, 5).forEach((issue, idx) => {
      console.log(`      ${idx + 1}. ${issue.type}: ${issue.entity || issue.account || issue.ref}`);
      if (issue.expected !== undefined) {
        console.log(`         متوقع: ${issue.expected} | فعلي: ${issue.actual}`);
      }
    });
  }

  console.log('\n✅ Audit complete.');
  process.exit(0);
}

systemAudit().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
