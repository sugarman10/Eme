/**
 * SEED SCRIPT: Set Stock for All Items
 * Usage: node set-stock.js
 * 
 * This script will:
 * 1. Find "المستودع الرئيسي" (or the one you are using)
 * 2. Set 100 units for ALL items in that warehouse
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system-db';

// The ID from your log: '692a083a7f640a0a0d720fae' (المستودع الرئيسي)
const TARGET_WAREHOUSE_ID = '692a083a7f640a0a0d720fae';

async function setStock() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;

        console.log(`🎯 Target Warehouse ID: ${TARGET_WAREHOUSE_ID}`);

        const itemsColl = db.collection('items');
        const items = await itemsColl.find({}).toArray();

        console.log(`📊 Found ${items.length} items. Updating stock to 100...`);

        let updated = 0;

        for (const item of items) {
            // Create or update stocks array
            let stocks = item.stocks || [];

            // Remove existing entry for this warehouse if any
            stocks = stocks.filter(s => s.warehouse.toString() !== TARGET_WAREHOUSE_ID);

            // Add new entry
            stocks.push({
                warehouse: new mongoose.Types.ObjectId(TARGET_WAREHOUSE_ID),
                qty: 100
            });

            // Calculate total
            const totalStock = stocks.reduce((sum, s) => sum + s.qty, 0);

            await itemsColl.updateOne(
                { _id: item._id },
                {
                    $set: {
                        stocks: stocks,
                        totalStock: totalStock,
                        stock: totalStock
                    }
                }
            );
            updated++;
        }

        console.log(`✅ Successfully updated ${updated} items with 100 units each.`);

    } catch (error) {
        console.error('❌ Failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Done.');
        process.exit(0);
    }
}

setStock();
