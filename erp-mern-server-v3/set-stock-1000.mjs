/**
 * Script to set all items stock balance to 1000 units
 * Usage: node set-stock-1000.mjs
 */

import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'erp-system';
const TARGET_STOCK = 1000;

async function setAllStockTo1000() {
    const client = new MongoClient(MONGO_URI);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Connected to database');

        const db = client.db(DB_NAME);

        // Get all items
        const items = await db.collection('items').find({}).toArray();
        console.log(`\n📦 Found ${items.length} items`);

        if (items.length === 0) {
            console.log('⚠️  No items found');
            return;
        }

        // Get first warehouse or create one
        let warehouse = await db.collection('warehouses').findOne({});

        if (!warehouse) {
            console.log('\n📍 No warehouse found, creating default warehouse...');
            const result = await db.collection('warehouses').insertOne({
                code: 'MAIN',
                name: 'المستودع الرئيسي',
                location: 'المخزن الرئيسي',
                isActive: true,
                createdAt: new Date()
            });
            warehouse = {
                _id: result.insertedId,
                name: 'المستودع الرئيسي',
                code: 'MAIN'
            };
            console.log(`✅ Created warehouse`);
        }

        console.log(`\n📍 Using warehouse: ${warehouse.name} (${warehouse.code})`);
        console.log(`🔄 Setting stock to ${TARGET_STOCK} for all items...\n`);

        // Update stock for each item
        let updated = 0;
        let created = 0;
        let errors = 0;

        for (const item of items) {
            try {
                const result = await db.collection('stockbalances').updateOne(
                    {
                        itemId: item._id,
                        warehouseId: warehouse._id
                    },
                    {
                        $set: {
                            balance: TARGET_STOCK,
                            updatedAt: new Date()
                        },
                        $setOnInsert: {
                            itemId: item._id,
                            warehouseId: warehouse._id,
                            createdAt: new Date()
                        }
                    },
                    { upsert: true }
                );

                if (result.modifiedCount > 0) {
                    updated++;
                    console.log(`✏️  Updated: ${item.name} -> ${TARGET_STOCK} ${item.uom || 'pcs'}`);
                } else if (result.upsertedCount > 0) {
                    created++;
                    console.log(`➕ Created: ${item.name} -> ${TARGET_STOCK} ${item.uom || 'pcs'}`);
                } else {
                    console.log(`⚪ No change: ${item.name} (already ${TARGET_STOCK})`);
                }
            } catch (err) {
                errors++;
                console.error(`❌ Error for ${item.name}:`, err.message);
            }
        }

        console.log(`\n${'='.repeat(50)}`);
        console.log(`✅ Done!`);
        console.log(`${'='.repeat(50)}`);
        console.log(`📊 Summary:`);
        console.log(`   - Total items: ${items.length}`);
        console.log(`   - Updated: ${updated}`);
        console.log(`   - Created: ${created}`);
        console.log(`   - Errors: ${errors}`);
        console.log(`   - Warehouse: ${warehouse.name}`);
        console.log(`   - Stock per item: ${TARGET_STOCK}`);
        console.log(`${'='.repeat(50)}\n`);

    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('🔌 Database connection closed\n');
    }
}

// Run the script
console.log('\n🚀 Starting stock update script...\n');
setAllStockTo1000()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Script failed:', err);
        process.exit(1);
    });
