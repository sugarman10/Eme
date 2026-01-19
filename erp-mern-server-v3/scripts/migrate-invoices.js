/**
 * MIGRATION SCRIPT: Fix Legacy Invoices (ES Module Version)
 * Usage: node migrate-invoices.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

// تهيئة متغيرات البيئة
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system-db';

async function migrateInvoices() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        console.log(`📡 URI: ${MONGO_URI.substring(0, 20)}...`);

        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;

        // 1. البحث عن المستودع والخزينة الافتراضية
        const mainWarehouse = await db.collection('warehouses').findOne({});
        const mainTreasury = await db.collection('treasuries').findOne({});

        if (!mainWarehouse || !mainTreasury) {
            console.error('❌ Error: No Warehouse or Treasury found via Database Direct Access.');
            console.error('👉 Please create at least one Warehouse and Treasury in the DB first.');
            process.exit(1);
        }

        console.log(`ℹ️  Will assign to: WH=[${mainWarehouse.name}], Treasury=[${mainTreasury.name}]`);

        // 2. البحث عن الجدول الصحيح (SalesInvoices vs Invoices)
        let collectionName = 'invoices';
        const collections = await db.listCollections({ name: 'invoices' }).toArray();
        if (collections.length === 0) {
            collectionName = 'salesinvoices';
        }

        const invoicesColl = db.collection(collectionName);
        console.log(`📂 Using collection: ${collectionName}`);

        // 3. تحديد الفواتير القديمة
        const query = {
            $or: [
                { warehouse: { $exists: false } },
                { treasury: { $exists: false } },
                { warehouse: null },
                { treasury: null }
            ]
        };

        const count = await invoicesColl.countDocuments(query);
        console.log(`📊 Found ${count} legacy invoices to fix.`);

        if (count === 0) {
            console.log('✨ All invoices are up to date. No action needed.');
            process.exit(0);
        }

        // 4. التحديث
        const result = await invoicesColl.updateMany(query, {
            $set: {
                warehouse: mainWarehouse._id,
                treasury: mainTreasury._id,
                isLegacy: true
            }
        });

        console.log(`✅ Successfully fixed ${result.modifiedCount} invoices.`);

    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Connection closed.');
        process.exit(0);
    }
}

migrateInvoices();