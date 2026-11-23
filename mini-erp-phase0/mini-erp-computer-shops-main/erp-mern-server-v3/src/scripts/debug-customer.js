/**
 * Debug Customer Data
 */
import 'dotenv/config';
import connectDB from '../config/db.js';

async function debugCustomer() {
  await connectDB();

  const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
  const Customer = (await import('../models/Customer.js')).default;
  const Receipt = (await import('../models/Receipt.js')).default;

  const cust = await Customer.findOne({ name: /أمينة محمد الحاسي/ });
  console.log('\n=== Customer Info ===');
  console.log('Name:', cust.name);
  console.log('Balance from DB:', cust.balance);

  const invoices = await SalesInvoice.find({
    customer: cust._id,
    status: { $in: ['confirmed', 'posted', 'paid'] },
  })
    .sort({ date: -1 })
    .lean();

  let totalGrand = 0,
    totalPaid = 0;
  invoices.forEach((inv) => {
    totalGrand += inv.totals?.grand || 0;
    totalPaid += inv.totals?.paid || 0;
  });

  console.log('\n=== Invoice Summary ===');
  console.log('Total Invoices:', invoices.length);
  console.log('Total Grand:', totalGrand.toFixed(2));
  console.log('Total Paid (in invoices):', totalPaid.toFixed(2));
  console.log('Expected Remaining:', (totalGrand - totalPaid).toFixed(2));

  // Get receipts
  const receipts = await Receipt.find({ customer: cust._id }).lean();
  const receiptTotal = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  console.log('\n=== Receipts ===');
  console.log('Total Receipts:', receipts.length);
  console.log('Total Receipt Amount:', receiptTotal.toFixed(2));

  // Show last 10 invoices
  console.log('\n=== Last 10 Invoices ===');
  invoices.slice(0, 10).forEach((inv) => {
    console.log(
      ` ${inv.number || inv._id.toString().slice(-6)} | Grand: ${inv.totals?.grand} | Paid: ${inv.totals?.paid} | Remaining: ${(inv.totals?.grand || 0) - (inv.totals?.paid || 0)}`
    );
  });

  // Check for invoices where paid < grand
  const unpaidInvoices = invoices.filter((inv) => (inv.totals?.paid || 0) < (inv.totals?.grand || 0));
  console.log('\n=== Unpaid/Partial Invoices ===');
  console.log('Count:', unpaidInvoices.length);
  unpaidInvoices.slice(0, 5).forEach((inv) => {
    console.log(` ${inv.number} | Grand: ${inv.totals?.grand} | Paid: ${inv.totals?.paid}`);
  });

  process.exit(0);
}

debugCustomer().catch(console.error);
