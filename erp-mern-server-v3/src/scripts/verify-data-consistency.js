/**
 * Script: Verify Data Consistency
 * التحقق من تناسق البيانات بين الفواتير والعملاء وسندات القبض
 * 
 * Usage: node src/scripts/verify-data-consistency.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

// Helper for precise math
const round = (num) => Math.round(num * 100) / 100;

async function verifyDataConsistency() {
    console.log('🔍 Starting Data Consistency Check...\n');
    console.log('='.repeat(60));

    await connectDB();

    const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
    const Customer = (await import('../models/Customer.js')).default;
    const Receipt = (await import('../models/Receipt.js')).default;

    const issues = [];

    // ============================================================
    // 1. SALES INVOICES SUMMARY
    // ============================================================
    console.log('\n📊 1. SALES INVOICES SUMMARY');
    console.log('-'.repeat(40));

    const invoiceStats = await SalesInvoice.aggregate([
        { $match: { status: { $in: ['confirmed', 'posted', 'paid'] } } },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                totalGrand: { $sum: '$totals.grand' },
                totalPaid: { $sum: '$totals.paid' },
                totalRemaining: { $sum: { $subtract: ['$totals.grand', '$totals.paid'] } }
            }
        }
    ]);

    const invSummary = invoiceStats[0] || { count: 0, totalGrand: 0, totalPaid: 0, totalRemaining: 0 };
    console.log(`   عدد الفواتير: ${invSummary.count}`);
    console.log(`   إجمالي المبيعات: ${round(invSummary.totalGrand).toLocaleString()} د.ل`);
    console.log(`   إجمالي المدفوع (في الفواتير): ${round(invSummary.totalPaid).toLocaleString()} د.ل`);
    console.log(`   إجمالي المتبقي: ${round(invSummary.totalRemaining).toLocaleString()} د.ل`);

    // ============================================================
    // 2. RECEIPTS SUMMARY
    // ============================================================
    console.log('\n📊 2. RECEIPTS SUMMARY');
    console.log('-'.repeat(40));

    const receiptStats = await Receipt.aggregate([
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        }
    ]);

    const recSummary = receiptStats[0] || { count: 0, totalAmount: 0 };
    console.log(`   عدد سندات القبض: ${recSummary.count}`);
    console.log(`   إجمالي المحصّل: ${round(recSummary.totalAmount).toLocaleString()} د.ل`);

    // ============================================================
    // 3. CUSTOMERS BALANCE SUMMARY
    // ============================================================
    console.log('\n📊 3. CUSTOMERS BALANCE SUMMARY');
    console.log('-'.repeat(40));

    const customerStats = await Customer.aggregate([
        { $match: { isCashCustomer: { $ne: true } } },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                totalBalance: { $sum: '$balance' },
                positiveBalance: { $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] } },
                negativeBalance: { $sum: { $cond: [{ $lt: ['$balance', 0] }, '$balance', 0] } }
            }
        }
    ]);

    const custSummary = customerStats[0] || { count: 0, totalBalance: 0, positiveBalance: 0, negativeBalance: 0 };
    console.log(`   عدد العملاء (غير النقدي): ${custSummary.count}`);
    console.log(`   إجمالي أرصدة العملاء: ${round(custSummary.totalBalance).toLocaleString()} د.ل`);
    console.log(`   أرصدة موجبة (مدين): ${round(custSummary.positiveBalance).toLocaleString()} د.ل`);
    console.log(`   أرصدة سالبة (دائن): ${round(custSummary.negativeBalance).toLocaleString()} د.ل`);

    // ============================================================
    // 4. CROSS-CHECK: Calculate Expected Customer Balance
    // ============================================================
    console.log('\n📊 4. CROSS-CHECK: Expected vs Actual Balances');
    console.log('-'.repeat(40));

    // Get all non-cash customers with their invoices and receipts
    const customers = await Customer.find({ isCashCustomer: { $ne: true } }).lean();

    let totalCalculatedBalance = 0;
    let mismatchCount = 0;

    for (const customer of customers) {
        // Sum of invoice remaining amounts for this customer
        const invoices = await SalesInvoice.find({
            customer: customer._id,
            status: { $in: ['confirmed', 'posted', 'paid'] }
        }).lean();

        const invoiceTotal = invoices.reduce((sum, inv) => {
            const grand = inv.totals?.grand || 0;
            const paid = inv.totals?.paid || 0;
            return sum + (grand - paid);
        }, 0);

        // Sum of receipts for this customer
        const receipts = await Receipt.find({ customer: customer._id }).lean();
        const receiptTotal = receipts.reduce((sum, rec) => sum + (rec.amount || 0), 0);

        // Expected balance = invoice remaining (already accounts for in-invoice payments)
        // Note: Receipts are for credit payments, not included in invoice.paid
        const expectedBalance = round(invoiceTotal);
        const actualBalance = round(customer.balance || 0);

        totalCalculatedBalance += expectedBalance;

        if (Math.abs(expectedBalance - actualBalance) > 0.01) {
            mismatchCount++;
            if (mismatchCount <= 5) { // Show first 5 mismatches
                issues.push({
                    type: 'CUSTOMER_BALANCE_MISMATCH',
                    customer: customer.name,
                    customerId: customer._id,
                    expected: expectedBalance,
                    actual: actualBalance,
                    difference: round(expectedBalance - actualBalance)
                });
                console.log(`   ⚠️ ${customer.name}: متوقع=${expectedBalance} | فعلي=${actualBalance} | فرق=${round(expectedBalance - actualBalance)}`);
            }
        }
    }

    console.log(`\n   إجمالي الرصيد المحسوب: ${round(totalCalculatedBalance).toLocaleString()} د.ل`);
    console.log(`   إجمالي الرصيد الفعلي: ${round(custSummary.totalBalance).toLocaleString()} د.ل`);
    console.log(`   عدد حالات عدم التطابق: ${mismatchCount}`);

    // ============================================================
    // 5. SUMMARY & RECOMMENDATIONS
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));

    const expectedAR = round(invSummary.totalRemaining);
    const actualAR = round(custSummary.totalBalance);
    const arDiff = round(expectedAR - actualAR);

    console.log(`\n   📌 متوقع ذمم العملاء (من الفواتير): ${expectedAR.toLocaleString()} د.ل`);
    console.log(`   📌 فعلي أرصدة العملاء: ${actualAR.toLocaleString()} د.ل`);
    console.log(`   📌 الفرق: ${arDiff.toLocaleString()} د.ل`);

    if (Math.abs(arDiff) > 1) {
        console.log('\n   ⚠️ يوجد فرق كبير! الأسباب المحتملة:');
        console.log('      - فواتير قديمة لم تُحدّث أرصدة العملاء');
        console.log('      - سندات قبض لم تُخصم من رصيد العميل');
        console.log('      - تعديلات يدوية على أرصدة العملاء');
    } else {
        console.log('\n   ✅ البيانات متناسقة بشكل عام');
    }

    // Output issues as JSON for further analysis
    if (issues.length > 0) {
        console.log('\n\n📁 Issues found (first 5):');
        console.log(JSON.stringify(issues, null, 2));
    }

    console.log('\n✅ Data consistency check complete.');
    process.exit(0);
}

verifyDataConsistency().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
