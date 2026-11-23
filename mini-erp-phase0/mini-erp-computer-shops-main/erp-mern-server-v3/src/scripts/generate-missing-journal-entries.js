/**
 * Script: Generate Missing Journal Entries for Existing Sales Invoices
 *
 * هذا السكريبت يُنشئ قيود محاسبية للفواتير القديمة التي لم تُسجل لها قيود
 *
 * Usage: node src/scripts/generate-missing-journal-entries.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import SalesInvoice from '../models/SalesInvoice.js';
import JournalEntry from '../models/JournalEntry.js';
import Account from '../models/Account.js';
import Customer from '../models/Customer.js';

// Helper function for precise math
const round = (num) => Math.round(num * 100) / 100;

async function generateMissingJournalEntries() {
  console.log('🔄 Starting: Generate Missing Journal Entries for Sales Invoices...\n');

  await connectDB();

  // 1. Get all required accounts
  const accountCodes = ['1010', '1020', '1030', '4010', '2020'];
  const accounts = await Account.find({ code: { $in: accountCodes } });

  const accountMap = {};
  accounts.forEach((acc) => {
    accountMap[acc.code] = acc._id;
  });

  console.log('📋 System Accounts:');
  accounts.forEach((acc) => console.log(`   ${acc.code} - ${acc.name}`));

  // Validate required accounts
  const missing = accountCodes.filter((code) => !accountMap[code]);
  if (missing.length > 0) {
    console.error(`\n❌ Missing accounts: ${missing.join(', ')}`);
    console.error('   Run initService first to seed required accounts.');
    process.exit(1);
  }

  // 2. Get all confirmed invoices
  const invoices = await SalesInvoice.find({
    status: { $in: ['confirmed', 'posted', 'paid'] },
  }).populate('customer', 'name');

  console.log(`\n📜 Found ${invoices.length} confirmed invoices`);

  // 3. Check which invoices already have journal entries
  const existingJEs = await JournalEntry.find(
    {
      referenceType: 'SALE_INVOICE',
    },
    'referenceId'
  );

  const existingInvoiceIds = new Set(existingJEs.map((je) => je.referenceId));
  console.log(`📖 ${existingInvoiceIds.size} invoices already have journal entries`);

  // 4. Filter invoices without journal entries
  const invoicesWithoutJE = invoices.filter((inv) => !existingInvoiceIds.has(inv._id.toString()));
  console.log(`⚠️ ${invoicesWithoutJE.length} invoices need journal entries\n`);

  if (invoicesWithoutJE.length === 0) {
    console.log('✅ All invoices already have journal entries!');
    process.exit(0);
  }

  // 5. Create journal entries
  let created = 0;
  let failed = 0;

  for (const invoice of invoicesWithoutJE) {
    try {
      const grand = invoice.totals?.grand || 0;
      const paid = invoice.totals?.paid || 0;
      const tax = invoice.totals?.tax || 0;
      const remaining = grand - paid;
      const netSales = round(grand - tax);

      const customerName = invoice.customer?.name || 'عميل نقدي';

      // Build journal lines
      const lines = [];

      // DEBIT: Cash/Bank/AR
      if (paid > 0) {
        const paymentMethod = invoice.paymentMethod || 'cash';
        const debitAccountCode = paymentMethod === 'bank' || paymentMethod === 'transfer' ? '1020' : '1010';
        lines.push({
          account: accountMap[debitAccountCode],
          debit: paid,
          credit: 0,
          memo: paymentMethod === 'bank' ? 'تحصيل بنكي' : 'تحصيل نقدي',
        });
      }

      if (remaining > 0) {
        lines.push({
          account: accountMap['1030'], // AR
          debit: remaining,
          credit: 0,
          memo: `آجل - ${customerName}`,
        });
      }

      // CREDIT: Sales Revenue
      lines.push({
        account: accountMap['4010'],
        debit: 0,
        credit: netSales,
        memo: 'إيرادات مبيعات',
      });

      // CREDIT: VAT (if any)
      if (tax > 0) {
        lines.push({
          account: accountMap['2020'],
          debit: 0,
          credit: tax,
          memo: 'ضريبة القيمة المضافة',
        });
      }

      // Validate balance
      const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        console.error(`   ⚠️ Unbalanced entry for ${invoice._id}: D=${totalDebit} C=${totalCredit}`);
        failed++;
        continue;
      }

      // Create JournalEntry
      await JournalEntry.create({
        date: invoice.date || invoice.createdAt,
        referenceType: 'SALE_INVOICE',
        referenceId: invoice._id.toString(),
        ref: `INV-${invoice.number || invoice._id.toString().slice(-6)}`,
        note: `فاتورة مبيعات - ${customerName}`,
        lines,
      });

      created++;
      console.log(`   ✅ ${invoice.number || invoice._id.toString().slice(-6)} - ${customerName} - ${grand} د.ل`);
    } catch (error) {
      console.error(`   ❌ ${invoice._id}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Created: ${created} journal entries`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`========================================\n`);

  // 6. Update Account balances based on all journal entries
  console.log('🔄 Recalculating account balances...');

  const pipeline = [
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.account',
        totalDebit: { $sum: '$lines.debit' },
        totalCredit: { $sum: '$lines.credit' },
      },
    },
  ];

  const balances = await JournalEntry.aggregate(pipeline);

  for (const { _id, totalDebit, totalCredit } of balances) {
    const account = await Account.findById(_id);
    if (!account) continue;

    // Calculate balance based on account type
    let balance;
    if (account.type === 'asset' || account.type === 'expense') {
      balance = round(totalDebit - totalCredit);
    } else {
      balance = round(totalCredit - totalDebit);
    }

    await Account.findByIdAndUpdate(_id, { balance });
    console.log(`   ${account.code} ${account.name}: ${balance} د.ل`);
  }

  console.log('\n✅ Done! Account balances updated.');
  process.exit(0);
}

generateMissingJournalEntries().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
