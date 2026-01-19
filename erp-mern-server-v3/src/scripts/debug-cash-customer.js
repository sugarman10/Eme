/**
 * Debug Cash Customer Invoices
 * فحص فواتير العميل النقدي
 */
import 'dotenv/config';
import connectDB from '../config/db.js';

async function debugCashCustomer() {
    await connectDB();

    const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
    const Customer = (await import('../models/Customer.js')).default;

    // Find cash customer
    const cashCustomer = await Customer.findOne({ isCashCustomer: true });
    console.log('\n=== Cash Customer ===');
    console.log('ID:', cashCustomer?._id);
    console.log('Name:', cashCustomer?.name);
    console.log('Balance:', cashCustomer?.balance);

    // Find invoices without customer (null/undefined)
    const nullCustomerInvoices = await SalesInvoice.find({
        customer: { $in: [null, undefined] },
        status: { $in: ['confirmed', 'posted', 'paid'] }
    }).lean();

    let nullRemaining = 0;
    nullCustomerInvoices.forEach(inv => {
        nullRemaining += (inv.totals?.grand || 0) - (inv.totals?.paid || 0);
    });

    console.log('\n=== Invoices with NULL customer ===');
    console.log('Count:', nullCustomerInvoices.length);
    console.log('Total Remaining:', nullRemaining.toFixed(2));

    // Find cash customer invoices (by isCashCustomer)
    const cashInvoices = await SalesInvoice.find({
        customer: cashCustomer?._id,
        status: { $in: ['confirmed', 'posted', 'paid'] }
    }).lean();

    let cashRemaining = 0;
    let cashUnpaidCount = 0;
    cashInvoices.forEach(inv => {
        const remaining = (inv.totals?.grand || 0) - (inv.totals?.paid || 0);
        if (remaining > 0) {
            cashRemaining += remaining;
            cashUnpaidCount++;
        }
    });

    console.log('\n=== Cash Customer Invoices ===');
    console.log('Total Invoices:', cashInvoices.length);
    console.log('Unpaid/Partial Count:', cashUnpaidCount);
    console.log('Total Remaining:', cashRemaining.toFixed(2));

    // Summary
    const totalUnaccounted = nullRemaining + cashRemaining;
    console.log('\n=== SUMMARY ===');
    console.log('Total unaccounted (NULL + Cash):', totalUnaccounted.toFixed(2));
    console.log('(This should roughly match the 269,197 discrepancy)');

    // List some examples of cash customer unpaid invoices
    if (cashUnpaidCount > 0) {
        console.log('\n=== Sample Unpaid Cash Invoices ===');
        const samples = cashInvoices.filter(inv =>
            (inv.totals?.grand || 0) - (inv.totals?.paid || 0) > 0
        ).slice(0, 5);

        samples.forEach(inv => {
            console.log(`  ${inv.number || inv._id.toString().slice(-6)}: Grand=${inv.totals?.grand} Paid=${inv.totals?.paid}`);
        });
    }

    process.exit(0);
}

debugCashCustomer().catch(console.error);
