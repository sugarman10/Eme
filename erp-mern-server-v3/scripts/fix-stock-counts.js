/**
 * SCRIPT: Recalculate & Fix Total Stocks
 * Usage: node fix-stock-counts.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();
// تأكد من وجود ?replicaSet=rs0 إذا كان في ملف env
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erp_mern?replicaSet=rs0';

async function fixStocks() {
    try {
        console.log('🔄 Connecting...');
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;
        const itemsColl = db.collection('items'); // أو 'products' حسب تسميتك

        console.log('📊 Fetching all items...');
        const items = await itemsColl.find({}).toArray();

        let fixedCount = 0;
        const bulkOps = [];

        for (const item of items) {
            // 1. حساب المجموع الفعلي من المصفوفة
            const actualTotal = (item.stocks || []).reduce((sum, s) => sum + (s.qty || 0), 0);

            // 2. مقارنته بالرقم المسجل
            // (نتجاهل الفروقات البسيطة جداً في الكسور العشرية إن وجدت)
            if (item.totalStock !== actualTotal) {
                console.log(`⚠️ Mismatch found for [${item.name}]: Listed=${item.totalStock}, Actual=${actualTotal}`);

                bulkOps.push({
                    updateOne: {
                        filter: { _id: item._id },
                        update: { $set: { totalStock: actualTotal } }
                    }
                });
                fixedCount++;
            }
        }

        if (bulkOps.length > 0) {
            console.log(`🚀 Fixing ${fixedCount} items...`);
            await itemsColl.bulkWrite(bulkOps);
            console.log('✅ Done! All stock counts are now synchronized.');
        } else {
            console.log('✨ All stock counts are correct. No fixes needed.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixStocks();