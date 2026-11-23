/**
 * MIGRATION SCRIPT: Convert Legacy Stock to Multi-Warehouse Format
 * Usage: node migrate-stocks.js
 * 
 * This script converts:
 * FROM: { stock: 100 }
 * TO:   { stocks: [{ warehouse: defaultWarehouseId, qty: 100 }], totalStock: 100 }
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system-db';

async function migrateStocks() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;

        // 1. Find default warehouse (or first available)
        const defaultWarehouse = await db.collection('warehouses').findOne({});

        if (!defaultWarehouse) {
            console.error('❌ No warehouse found! Please create a warehouse first.');
            console.log('💡 Run: node seed-defaults.js');
            process.exit(1);
        }

        console.log(`✅ Using default warehouse: ${defaultWarehouse.name} (${defaultWarehouse._id})`);

        // 2. Find items without stocks array
        const itemsColl = db.collection('items');
        const itemsToMigrate = await itemsColl.find({
            $or: [
                { stocks: { $exists: false } },
                { stocks: { $eq: null } },
                { stocks: { $size: 0 } }
            ]
        }).toArray();

        console.log(`\n📊 Found ${itemsToMigrate.length} items to migrate`);

        if (itemsToMigrate.length === 0) {
            console.log('✅ All items already have stocks array!');
            process.exit(0);
        }

        // 3. Migrate each item
        let migrated = 0;
        let errors = 0;

        for (const item of itemsToMigrate) {
            try {
                const oldStock = item.stock || 0;

                // Create stocks array with default warehouse
                const stocks = oldStock > 0 ? [{
                    warehouse: defaultWarehouse._id,
                    qty: oldStock
                }] : [];

                // Update item
                await itemsColl.updateOne(
                    { _id: item._id },
                    {
                        $set: {
                            stocks: stocks,
                            totalStock: oldStock,
                            stock: oldStock // Keep for backward compatibility
                        }
                    }
                );

                migrated++;
                console.log(`✅ ${item.name}: ${oldStock} units → ${defaultWarehouse.name}`);

            } catch (err) {
                errors++;
                console.error(`❌ Failed to migrate ${item.name}:`, err.message);
            }
        }

        // 4. Summary
        console.log('\n📈 Migration Summary:');
        console.log(`  ✅ Migrated: ${migrated} items`);
        console.log(`  ❌ Errors: ${errors} items`);
        console.log(`  📦 Default Warehouse: ${defaultWarehouse.name}`);

        // 5. Verify
        const verifyCount = await itemsColl.countDocuments({
            stocks: { $exists: true, $ne: null }
        });
        console.log(`\n🔍 Verification: ${verifyCount} items now have stocks array`);

    } catch (error) {
        console.error('❌ Migration Failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Done.');
        process.exit(0);
    }
}

migrateStocks();
