/**
 * ERP Seed Cleanup Script
 * Removes only seeded test data (seedTag: 'dev')
 *
 * Run: node scripts/seed-clean.js
 *
 * This script ONLY removes documents that have:
 *   - seeded: true
 *   - seedTag: 'dev'
 *
 * Production data without these markers is preserved.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

// Models
import User from '../src/models/User.js';
import Account from '../src/models/Account.js';
import Customer from '../src/models/Customer.js';
import Supplier from '../src/models/Supplier.js';
import Warehouse from '../src/models/Warehouse.js';
import Treasury from '../src/models/Treasury.js';
import Item from '../src/models/Item.js';
import Category from '../src/models/Category.js';
import StockLedger from '../src/models/StockLedger.js';

// ============================================================
// CONFIGURATION
// ============================================================
const SEED_TAG = 'dev';
const CLEANUP_FILTER = { seeded: true, seedTag: SEED_TAG };

// ============================================================
// MAIN CLEANUP
// ============================================================
async function cleanupSeed() {
    console.log('🧹 ========== ERP SEED CLEANUP ==========\n');
    console.log(`📌 Removing data with seedTag: "${SEED_TAG}"\n`);

    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/erp';
        console.log(`📡 Connecting to: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);

        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        const counts = {};

        // Cleanup in reverse order of dependencies

        // 1. Stock Ledger (depends on Items)
        const stockResult = await StockLedger.deleteMany(CLEANUP_FILTER);
        counts.stockLedger = stockResult.deletedCount;
        console.log(`   🗑️  StockLedger: ${counts.stockLedger} deleted`);

        // 2. Items (depends on Categories, Warehouses)
        const itemResult = await Item.deleteMany(CLEANUP_FILTER);
        counts.items = itemResult.deletedCount;
        console.log(`   🗑️  Items: ${counts.items} deleted`);

        // 3. Categories
        const catResult = await Category.deleteMany(CLEANUP_FILTER);
        counts.categories = catResult.deletedCount;
        console.log(`   🗑️  Categories: ${counts.categories} deleted`);

        // 4. Customers
        const custResult = await Customer.deleteMany(CLEANUP_FILTER);
        counts.customers = custResult.deletedCount;
        console.log(`   🗑️  Customers: ${counts.customers} deleted`);

        // 5. Suppliers
        const supResult = await Supplier.deleteMany(CLEANUP_FILTER);
        counts.suppliers = supResult.deletedCount;
        console.log(`   🗑️  Suppliers: ${counts.suppliers} deleted`);

        // 6. Treasuries
        const treasuryResult = await Treasury.deleteMany(CLEANUP_FILTER);
        counts.treasuries = treasuryResult.deletedCount;
        console.log(`   🗑️  Treasuries: ${counts.treasuries} deleted`);

        // 7. Warehouses
        const whResult = await Warehouse.deleteMany(CLEANUP_FILTER);
        counts.warehouses = whResult.deletedCount;
        console.log(`   🗑️  Warehouses: ${counts.warehouses} deleted`);

        // 8. Users (except admin - keep one admin)
        const userResult = await User.deleteMany({
            ...CLEANUP_FILTER,
            role: { $ne: 'admin' }, // Preserve admin users
        });
        counts.users = userResult.deletedCount;
        console.log(`   🗑️  Users: ${counts.users} deleted (admin preserved)`);

        // 9. Accounts (be careful - only non-system if needed)
        // We keep system accounts as they are critical
        const accResult = await Account.deleteMany({
            ...CLEANUP_FILTER,
            isSystem: false, // Only delete non-system seeded accounts
        });
        counts.accounts = accResult.deletedCount;
        console.log(`   🗑️  Accounts: ${counts.accounts} deleted (system accounts preserved)`);

        // Summary
        const totalDeleted = Object.values(counts).reduce((sum, c) => sum + c, 0);

        console.log('\n========== CLEANUP COMPLETE ==========');
        console.log(`📊 Total documents deleted: ${totalDeleted}`);

        if (totalDeleted === 0) {
            console.log('\n💡 No seeded data found. Database may already be clean.');
        } else {
            console.log('\n✅ Seed data removed successfully.');
            console.log('💡 Run seed-dev.js to re-populate test data.');
        }
    } catch (error) {
        console.error('\n❌ Cleanup Failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Database connection closed.');
        process.exit(0);
    }
}

// Confirmation prompt
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

console.log('⚠️  WARNING: This will delete all data with seedTag: "dev"');
console.log('   System accounts and admin users will be preserved.\n');

rl.question('Are you sure you want to proceed? (yes/no): ', (answer) => {
    rl.close();

    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        cleanupSeed();
    } else {
        console.log('\n❌ Cleanup cancelled.');
        process.exit(0);
    }
});
