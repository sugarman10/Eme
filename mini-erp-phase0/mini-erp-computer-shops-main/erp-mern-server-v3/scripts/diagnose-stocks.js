/**
 * DIAGNOSTIC SCRIPT: Check Product Stocks Data
 * Usage: node diagnose-stocks.js
 * 
 * This script will:
 * 1. Connect to MongoDB
 * 2. Fetch all items
 * 3. Check their stocks array
 * 4. Show which items have empty stocks
 * 5. Show warehouse IDs in stocks vs actual warehouse IDs
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system-db';

async function diagnoseStocks() {
    try {
        console.log('🔍 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;

        // 1. Get all warehouses
        const warehouses = await db.collection('warehouses').find({}).toArray();
        console.log('\n📦 Warehouses in system:');
        warehouses.forEach(wh => {
            console.log(`  - ${wh.name} (ID: ${wh._id})`);
        });

        // 2. Get all items
        const items = await db.collection('items').find({}).toArray();
        console.log(`\n📊 Total Items: ${items.length}`);

        // 3. Analyze stocks
        let itemsWithStocks = 0;
        let itemsWithoutStocks = 0;
        let itemsWithEmptyStocks = 0;

        console.log('\n🔍 Analyzing stocks array...\n');

        items.forEach(item => {
            const hasStocksField = item.stocks !== undefined;
            const hasStocksArray = Array.isArray(item.stocks);
            const stocksLength = item.stocks?.length || 0;

            if (!hasStocksField) {
                itemsWithoutStocks++;
                console.log(`❌ ${item.name} - NO stocks field`);
            } else if (!hasStocksArray) {
                console.log(`⚠️  ${item.name} - stocks is not an array: ${typeof item.stocks}`);
            } else if (stocksLength === 0) {
                itemsWithEmptyStocks++;
                console.log(`⚠️  ${item.name} - stocks array is EMPTY (totalStock: ${item.totalStock || 0})`);
            } else {
                itemsWithStocks++;
                console.log(`✅ ${item.name} - ${stocksLength} warehouse(s):`);
                item.stocks.forEach(s => {
                    const whName = warehouses.find(w => w._id.toString() === s.warehouse.toString())?.name || 'Unknown';
                    console.log(`     - ${whName} (${s.warehouse}): ${s.qty} units`);
                });
            }
        });

        console.log('\n📈 Summary:');
        console.log(`  ✅ Items with stocks: ${itemsWithStocks}`);
        console.log(`  ⚠️  Items with empty stocks: ${itemsWithEmptyStocks}`);
        console.log(`  ❌ Items without stocks field: ${itemsWithoutStocks}`);

        // 4. Check for data type issues
        console.log('\n🔬 Checking warehouse ID data types...');
        const sampleItem = items.find(i => i.stocks?.length > 0);
        if (sampleItem) {
            console.log(`\nSample item: ${sampleItem.name}`);
            console.log('stocks[0].warehouse type:', typeof sampleItem.stocks[0].warehouse);
            console.log('stocks[0].warehouse value:', sampleItem.stocks[0].warehouse);
            console.log('Is ObjectId?', sampleItem.stocks[0].warehouse instanceof mongoose.Types.ObjectId);
        }

        // 5. Recommendations
        console.log('\n💡 Recommendations:');
        if (itemsWithEmptyStocks > 0 || itemsWithoutStocks > 0) {
            console.log('  ⚠️  You have items without stock data!');
            console.log('  ➡️  Run migration script: node migrate-stocks.js');
        }
        if (itemsWithStocks === items.length) {
            console.log('  ✅ All items have stocks array - data looks good!');
        }

    } catch (error) {
        console.error('❌ Diagnostic Failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Done.');
        process.exit(0);
    }
}

diagnoseStocks();
