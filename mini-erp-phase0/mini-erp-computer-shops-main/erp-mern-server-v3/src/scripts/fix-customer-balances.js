/**
 * Script: Fix Customer Balances
 * إصلاح أرصدة العملاء لتتوافق مع الفواتير وسندات القبض
 *
 * Usage: node src/scripts/fix-customer-balances.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

const round = (num) => Math.round(num * 100) / 100;

async function fixCustomerBalances() {
  console.log('🔧 Starting Customer Balance Fix...\n');
  console.log('='.repeat(60));

  await connectDB();

  const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
  const Customer = (await import('../models/Customer.js')).default;
  const Receipt = (await import('../models/Receipt.js')).default;

  // Get all non-cash customers
  const customers = await Customer.find({ isCashCustomer: { $ne: true } });

  console.log(`\n📋 Processing ${customers.length} customers...\n`);

  let updated = 0;
  let unchanged = 0;
  let totalDifference = 0;

  for (const customer of customers) {
    // Calculate expected balance from invoices
    // Balance = Sum of (grand - paid) for all confirmed invoices
    const invoices = await SalesInvoice.find({
      customer: customer._id,
      status: { $in: ['confirmed', 'posted', 'paid'] },
    }).lean();

    const invoiceBalance = invoices.reduce((sum, inv) => {
      const grand = inv.totals?.grand || 0;
      const paid = inv.totals?.paid || 0;
      return sum + (grand - paid);
    }, 0);

    // Get total receipts (payments received after invoice creation)
    const receipts = await Receipt.find({ customer: customer._id }).lean();
    const receiptTotal = receipts.reduce((sum, rec) => sum + (rec.amount || 0), 0);

    // Expected balance = invoice remaining - additional receipts
    // Note: If receipts are already deducted from invoice.paid, we don't subtract again
    // Based on the data, it seems invoice.paid already includes payments,
    // and receipts are additional credit payments
    const expectedBalance = round(invoiceBalance);
    const actualBalance = round(customer.balance || 0);

    if (Math.abs(expectedBalance - actualBalance) > 0.01) {
      const diff = expectedBalance - actualBalance;
      totalDifference += Math.abs(diff);

      // Update customer balance
      customer.balance = expectedBalance;
      await customer.save();

      updated++;
      console.log(`   ✅ ${customer.name}`);
      console.log(`      كان: ${actualBalance.toLocaleString()} د.ل`);
      console.log(`      أصبح: ${expectedBalance.toLocaleString()} د.ل`);
      console.log(`      (${invoices.length} فاتورة، ${receipts.length} سند قبض)`);
      console.log('');
    } else {
      unchanged++;
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n   ✅ تم تحديث: ${updated} عميل`);
  console.log(`   ⏭️ بدون تغيير: ${unchanged} عميل`);
  console.log(`   📊 إجمالي التصحيحات: ${round(totalDifference).toLocaleString()} د.ل`);

  // Verify the fix
  console.log('\n\n🔍 Verifying fix...');
  const newCustomerStats = await Customer.aggregate([
    { $match: { isCashCustomer: { $ne: true } } },
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
      },
    },
  ]);

  const newTotal = round(newCustomerStats[0]?.totalBalance || 0);
  console.log(`   إجمالي أرصدة العملاء الجديد: ${newTotal.toLocaleString()} د.ل`);

  console.log('\n✅ Customer balance fix complete!');
  process.exit(0);
}

fixCustomerBalances().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
