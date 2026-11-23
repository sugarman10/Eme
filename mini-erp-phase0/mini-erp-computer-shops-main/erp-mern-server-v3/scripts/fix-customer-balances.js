/**
 * MIGRATION SCRIPT: Recalculate & Fix Customer Balances
 * Usage: node fix-customer-balances.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// تحميل إعدادات البيئة (تأكد من وجود ?replicaSet=rs0 إذا لزم الأمر)
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erp_mern?replicaSet=rs0';

async function fixCustomerBalances() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;

        const customersColl = db.collection('customers');
        const invoicesColl = db.collection('salesinvoices'); // تأكد من اسم الكولكشن

        console.log('👥 Fetching all customers...');
        const customers = await customersColl.find({}).toArray();

        let updatedCount = 0;
        const bulkOps = [];

        console.log(`🔍 Processing ${customers.length} customers...`);

        for (const customer of customers) {
            // 1. تجميع كل الفواتير الخاصة بهذا العميل
            const pipeline = [
                {
                    $match: {
                        customer: customer._id,
                        status: { $ne: 'cancelled' } // تجاهل الفواتير الملغاة
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: "$totals.grand" },
                        totalPaid: { $sum: "$totals.paid" }
                    }
                }
            ];

            const result = await invoicesColl.aggregate(pipeline).toArray();

            // 2. حساب الرصيد المستحق (الديون)
            let calculatedBalance = 0;
            if (result.length > 0) {
                calculatedBalance = (result[0].totalSales || 0) - (result[0].totalPaid || 0);
                // تقريب لأقرب رقمين عشريين لتجنب مشاكل الفواصل
                calculatedBalance = Math.round(calculatedBalance * 100) / 100;
            }

            // 3. مقارنة الرصيد الحالي بالمحسوب (أو إذا كان الحقل غير موجود)
            if (customer.balance !== calculatedBalance) {
                console.log(`⚠️ Update [${customer.name}]: Old=${customer.balance || 0} -> New=${calculatedBalance}`);

                bulkOps.push({
                    updateOne: {
                        filter: { _id: customer._id },
                        update: { $set: { balance: calculatedBalance } }
                    }
                });
                updatedCount++;
            }
        }

        // 4. تنفيذ التحديثات
        if (bulkOps.length > 0) {
            console.log(`🚀 Updating ${updatedCount} customers...`);
            await customersColl.bulkWrite(bulkOps);
            console.log('✅ Done! All customer ledgers are synchronized.');
        } else {
            console.log('✨ All customer balances are already correct.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Connection closed.');
        process.exit(0);
    }
}

fixCustomerBalances();