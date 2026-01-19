/**
 * Fix Negative Stock Quantities
 * 
 * This script fixes items that have negative stock quantities
 * which violate the min: 0 validation constraint
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Item from '../models/Item.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp';

async function fixNegativeStocks() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Find all items with negative stock quantities
        const itemsWithNegativeStock = await Item.find({
            $or: [
                { 'stocks.qty': { $lt: 0 } },
                { totalStock: { $lt: 0 } }
            ]
        });

        console.log(`Found ${itemsWithNegativeStock.length} items with negative stock`);

        let fixedCount = 0;
        for (const item of itemsWithNegativeStock) {
            console.log(`\nFixing item: ${item.name} (${item.sku})`);

            // Fix negative quantities in stocks array
            let changed = false;
            for (let i = 0; i < item.stocks.length; i++) {
                if (item.stocks[i].qty < 0) {
                    console.log(`  - Warehouse ${i}: ${item.stocks[i].qty} → 0`);
                    item.stocks[i].qty = 0;
                    changed = true;
                }
            }

            // Recalculate totalStock
            const newTotalStock = item.stocks.reduce((sum, s) => sum + Math.max(0, s.qty), 0);
            if (item.totalStock !== newTotalStock || item.totalStock < 0) {
                console.log(`  - totalStock: ${item.totalStock} → ${newTotalStock}`);
                item.totalStock = newTotalStock;
                changed = true;
            }

            if (changed) {
                // Use updateOne to bypass validation temporarily
                await Item.updateOne(
                    { _id: item._id },
                    {
                        $set: {
                            stocks: item.stocks,
                            totalStock: item.totalStock
                        }
                    }
                );
                fixedCount++;
            }
        }

        console.log(`\n✅ Fixed ${fixedCount} items`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

fixNegativeStocks();
