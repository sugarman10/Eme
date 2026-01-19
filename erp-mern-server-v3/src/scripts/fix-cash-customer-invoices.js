/**
 * Fix Cash Customer Invoices
 * إصلاح فواتير العميل النقدي - يجب أن تكون مدفوعة بالكامل
 * 
 * Usage: node src/scripts/fix-cash-customer-invoices.js
 */

import 'dotenv/config';
import connectDB from '../config/db.js';

async function fixCashCustomerInvoices() {
    console.log('\n🔧 Fixing Cash Customer Invoices...\n');
    console.log('='.repeat(60));

    await connectDB();

    const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
    const Customer = (await import('../models/Customer.js')).default;

    // Find cash customer
    const cashCustomer = await Customer.findOne({ isCashCustomer: true });

    if (!cashCustomer) {
        console.log('❌ Cash customer not found!');
        process.exit(1);
    }

    console.log(`📌 Cash Customer: ${cashCustomer.name} (${cashCustomer._id})`);

    // Find unpaid cash customer invoices
    const invoices = await SalesInvoice.find({
        customer: cashCustomer._id,
        status: { $in: ['confirmed', 'posted', 'paid'] }
    });

    let fixedCount = 0;
    let totalFixed = 0;

    for (const inv of invoices) {
        const grand = inv.totals?.grand || 0;
        const paid = inv.totals?.paid || 0;
        const remaining = grand - paid;

        if (remaining > 0.01) {
            // Fix: Set paid = grand for cash customers
            inv.totals.paid = grand;
            inv.totals.remaining = 0;
            await inv.save();

            fixedCount++;
            totalFixed += remaining;

            if (fixedCount <= 5) {
                console.log(`   ✅ ${inv.number}: ${paid.toFixed(2)} → ${grand.toFixed(2)} (+${remaining.toFixed(2)})`);
            }
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n   ✅ تم إصلاح: ${fixedCount} فاتورة`);
    console.log(`   💰 إجمالي المبالغ المُصححة: ${totalFixed.toLocaleString()} د.ل`);

    console.log('\n✅ Fix complete!');
    process.exit(0);
}

fixCashCustomerInvoices().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
