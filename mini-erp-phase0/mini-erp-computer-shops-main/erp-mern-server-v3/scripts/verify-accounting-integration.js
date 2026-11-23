import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { ensureStandardChartOfAccounts, getSystemAccount, getSystemAccountMap } from '../src/services/systemAccountsService.js';
import { createSalesJournalEntry } from '../src/services/salesService.js';
import Account from '../src/models/Account.js';
import JournalEntry from '../src/models/JournalEntry.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // 1. Ensure COA
  console.log('\n--- 1. Testing ensureStandardChartOfAccounts ---');
  const syncResult = await ensureStandardChartOfAccounts();
  console.log('Sync Result:', syncResult);

  // 2. Test getSystemAccount
  console.log('\n--- 2. Testing getSystemAccount ---');
  const testKeys = ['CASH', 'BANK', 'AR', 'AP', 'INVENTORY', 'COGS', 'SALES_REVENUE', 'SALES_RETURNS', 'CUSTOMER_WALLET'];
  for (const key of testKeys) {
    const acc = await getSystemAccount(key);
    console.log(`Key ${key.padEnd(16)} => Code: ${acc.code.padEnd(8)} Name: ${acc.name}`);
  }

  // 3. Test Sales Journal Entry with Perpetual Inventory
  console.log('\n--- 3. Testing Sales Journal Entry (Perpetual Inventory) ---');
  const testInvoiceId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();
  const testInvoiceNumber = 'TEST-INV-9999';

  const je = await createSalesJournalEntry({
    invoiceId: testInvoiceId,
    invoiceNumber: testInvoiceNumber,
    date: new Date(),
    paidAmount: 150,
    remaining: 50,
    grand: 200,
    tax: 0,
    customerName: 'تجربة عميل الفحص المحاسبي',
    paymentMethod: 'cash',
    userId: testUserId,
    totalCost: 120, // 120 cost
  });

  console.log('Created Sales Journal Entry ID:', je._id);
  console.log('JE Ref:', je.ref, 'Lines count:', je.lines.length);

  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of je.lines) {
    const accId = l.account || l.accountId;
    const acc = await Account.findById(accId);
    console.log(`  [${acc?.code || accId}] ${acc?.name || ''} | Dr: ${l.debit} | Cr: ${l.credit} | Memo: ${l.memo || l.note}`);
    totalDebit += l.debit || 0;
    totalCredit += l.credit || 0;
  }
  console.log(`Total Debit: ${totalDebit.toFixed(2)}, Total Credit: ${totalCredit.toFixed(2)}`);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error('UNBALANCED JOURNAL ENTRY DETECTED!');
  }
  console.log('✅ Sales Journal Entry is 100% Balanced!');

  await JournalEntry.findByIdAndDelete(je._id);

  // 4. Test Purchase Flow Accounting
  console.log('\n--- 4. Testing Purchase Flow (Direct Purchase) ---');
  const invAcc = await getSystemAccount('INVENTORY');
  const apAcc = await getSystemAccount('AP');
  const { postJournalEntry } = await import('../src/services/journalEntryService.js');

  const purchaseJe = await postJournalEntry({
    date: new Date(),
    referenceType: 'PURCHASE',
    referenceId: 'PO-TEST-1001',
    ref: 'PO-TEST-1001',
    note: 'شراء بضاعة مباشرة من مورد',
    lines: [
      { accountId: invAcc._id, debit: 500, credit: 0, memo: 'إثبات استلام بضاعة بالمخزون' },
      { accountId: apAcc._id, debit: 0, credit: 500, memo: 'استحقاق ذمم موردين' },
    ],
  });
  console.log('✅ Purchase Journal Entry Created:', purchaseJe._id, 'Ref:', purchaseJe.ref);
  await JournalEntry.findByIdAndDelete(purchaseJe._id);

  // 5. Test Purchase Return Flow
  console.log('\n--- 5. Testing Purchase Return Flow ---');
  const pretJe = await postJournalEntry({
    date: new Date(),
    referenceType: 'PURCHASE_RETURN',
    referenceId: 'PRET-TEST-1001',
    ref: 'PRET-TEST-1001',
    note: 'إرجاع بضاعة لمورد',
    lines: [
      { accountId: apAcc._id, debit: 100, credit: 0, memo: 'تخفيض ذمم موردين' },
      { accountId: invAcc._id, debit: 0, credit: 100, memo: 'تخفيض المخزون' },
    ],
  });
  console.log('✅ Purchase Return Journal Entry Created:', pretJe._id, 'Ref:', pretJe.ref);
  await JournalEntry.findByIdAndDelete(pretJe._id);

  // 6. Test Sales Return Flow (Double Entry + Perpetual Inventory)
  console.log('\n--- 6. Testing Sales Return Flow (Perpetual Inventory) ---');
  const salesReturnAcc = await getSystemAccount('SALES_RETURNS');
  const cogsAcc = await getSystemAccount('COGS');
  const arAcc = await getSystemAccount('AR');

  const sretJe = await postJournalEntry({
    date: new Date(),
    referenceType: 'SALES_RETURN',
    referenceId: 'RET-TEST-1001',
    ref: 'RET-TEST-1001',
    note: 'مردودات مبيعات تجربة',
    lines: [
      { accountId: salesReturnAcc._id, debit: 200, credit: 0, memo: 'مردودات مبيعات' },
      { accountId: arAcc._id, debit: 0, credit: 200, memo: 'تخفيض ذمم عملاء' },
      { accountId: invAcc._id, debit: 120, credit: 0, memo: 'استعادة مخزون بضاعة مردودة' },
      { accountId: cogsAcc._id, debit: 0, credit: 120, memo: 'تخفيض تكلفة البضاعة المباعة' },
    ],
  });
  console.log('✅ Sales Return Journal Entry Created:', sretJe._id, 'Ref:', sretJe.ref);
  await JournalEntry.findByIdAndDelete(sretJe._id);
  console.log('Cleaned up test journal entry.');

  await mongoose.disconnect();
  console.log('\nAll tests passed successfully!');
}

run().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
