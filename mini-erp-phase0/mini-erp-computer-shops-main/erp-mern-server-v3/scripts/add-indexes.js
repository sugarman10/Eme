import mongoose from 'mongoose';
import Item from '../src/models/Item.js';
import SalesInvoice from '../src/models/SalesInvoice.js';
import Customer from '../src/models/Customer.js';
import Transaction from '../src/models/Transaction.js';
import StockLedger from '../src/models/StockLedger.js';
import JournalEntry from '../src/models/JournalEntry.js';
import Account from '../src/models/Account.js';

/**
 * Performance Optimization Script
 * Adds strategic indexes to frequently accessed collections
 * 
 * Run this once after deployment
 */

async function addPerformanceIndexes() {
    try {
        console.log('🚀 Starting database indexing optimization...\n');

        // 1. Item Collection
        console.log('📦 Indexing Item collection...');
        await Item.collection.createIndex({ sku: 1 }, { unique: true });
        await Item.collection.createIndex({ barcode: 1 });
        await Item.collection.createIndex({ 'stocks.warehouse': 1 }); // Multi-warehouse lookup
        await Item.collection.createIndex({ name: 'text' }); // Text search
        await Item.collection.createIndex({ category: 1 });
        await Item.collection.createIndex({ totalStock: 1 }); // Low stock queries
        console.log('✅ Item indexes created');

        // 2. SalesInvoice Collection
        console.log('💰 Indexing SalesInvoice collection...');
        await SalesInvoice.collection.createIndex({ number: 1 }, { unique: true });
        await SalesInvoice.collection.createIndex({ date: -1 }); // Recent invoices first
        await SalesInvoice.collection.createIndex({ customer: 1 });
        await SalesInvoice.collection.createIndex({ warehouse: 1 });
        await SalesInvoice.collection.createIndex({ status: 1 });
        await SalesInvoice.collection.createIndex({ cashier: 1 });
        await SalesInvoice.collection.createIndex({ customer: 1, date: -1 }); // Compound for customer history
        console.log('✅ SalesInvoice indexes created');

        // 3. Customer Collection
        console.log('👥 Indexing Customer collection...');
        await Customer.collection.createIndex({ code: 1 }, { unique: true });
        await Customer.collection.createIndex({ phone: 1 });
        await Customer.collection.createIndex({ email: 1 });
        await Customer.collection.createIndex({ name: 'text' }); // Text search
        await Customer.collection.createIndex({ balance: 1 }); // Debtors report
        console.log('✅ Customer indexes created');

        // 4. Transaction Collection
        console.log('💵 Indexing Transaction collection...');
        await Transaction.collection.createIndex({ treasury: 1, date: -1 }); // Compound for treasury reports
        await Transaction.collection.createIndex({ date: -1 });
        await Transaction.collection.createIndex({ type: 1 });
        await Transaction.collection.createIndex({ relatedId: 1, relatedModel: 1 }); // Lookup transactions
        console.log('✅ Transaction indexes created');

        // 5. StockLedger Collection
        console.log('📊 Indexing StockLedger collection...');
        await StockLedger.collection.createIndex({ item: 1, date: -1 }); // Item movement history
        await StockLedger.collection.createIndex({ warehouse: 1, date: -1 }); // Warehouse activity
        await StockLedger.collection.createIndex({ type: 1 });
        console.log('✅ StockLedger indexes created');

        // 6. JournalEntry Collection
        console.log('📖 Indexing JournalEntry collection...');
        await JournalEntry.collection.createIndex({ number: 1 }, { unique: true });
        await JournalEntry.collection.createIndex({ date: -1 });
        await JournalEntry.collection.createIndex({ 'entries.accountId': 1 }); // Account lookup
        await JournalEntry.collection.createIndex({ userId: 1 });
        console.log('✅ JournalEntry indexes created');

        // 7. Account Collection
        console.log('🏦 Indexing Account collection...');
        await Account.collection.createIndex({ code: 1 }, { unique: true });
        await Account.collection.createIndex({ type: 1 });
        await Account.collection.createIndex({ parentAccount: 1 }); // Tree traversal
        await Account.collection.createIndex({ name: 'text' }); // Text search
        console.log('✅ Account indexes created');

        console.log('\n🎉 All performance indexes created successfully!');
        console.log('📈 Database queries should now be significantly faster.');

    } catch (error) {
        console.error('❌ Error creating indexes:', error);
        throw error;
    }
}

export default addPerformanceIndexes;

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    import('dotenv/config');
    import('../src/config/db.js').then(({ default: connectDB }) => {
        connectDB().then(async () => {
            await addPerformanceIndexes();
            process.exit(0);
        });
    });
}
