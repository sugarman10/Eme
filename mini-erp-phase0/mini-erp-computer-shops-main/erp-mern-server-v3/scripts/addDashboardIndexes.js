/**
 * Dashboard Performance Optimization Script
 * Adds necessary indexes to speed up Dashboard queries
 * 
 * Run: node scripts/addDashboardIndexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function addIndexes() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;

        // 1. SalesInvoice Indexes (Most Critical)
        console.log('\n📊 Adding SalesInvoice indexes...');
        await db.collection('salesinvoices').createIndex(
            { date: 1, status: 1 },
            { name: 'dashboard_date_status', background: true }
        );
        console.log('✅ Index: date + status');

        await db.collection('salesinvoices').createIndex(
            { date: 1, warehouse: 1, status: 1 },
            { name: 'dashboard_date_warehouse_status', background: true }
        );
        console.log('✅ Index: date + warehouse + status');

        await db.collection('salesinvoices').createIndex(
            { date: -1 },
            { name: 'dashboard_date_desc', background: true }
        );
        console.log('✅ Index: date (desc) for recent invoices');

        // 2. Receipt Indexes
        console.log('\n💰 Adding Receipt indexes...');
        await db.collection('receipts').createIndex(
            { date: 1 },
            { name: 'dashboard_date', background: true }
        );
        console.log('✅ Index: date');

        await db.collection('receipts').createIndex(
            { date: -1 },
            { name: 'dashboard_date_desc', background: true }
        );
        console.log('✅ Index: date (desc)');

        // 3. Customer Indexes
        console.log('\n👥 Adding Customer indexes...');
        await db.collection('customers').createIndex(
            { createdAt: 1 },
            { name: 'dashboard_created', background: true }
        );
        console.log('✅ Index: createdAt');

        // 4. Item Indexes (Low Stock)
        console.log('\n📦 Adding Item indexes...');
        await db.collection('items').createIndex(
            { totalStock: 1, minStock: 1 },
            { name: 'dashboard_low_stock', background: true }
        );
        console.log('✅ Index: totalStock + minStock');

        await db.collection('items').createIndex(
            { 'stocks.warehouse': 1, 'stocks.qty': 1 },
            { name: 'dashboard_warehouse_stock', background: true }
        );
        console.log('✅ Index: stocks.warehouse + stocks.qty');

        // 5. Verify Indexes
        console.log('\n🔍 Verifying indexes...');
        const collections = ['salesinvoices', 'receipts', 'customers', 'items'];
        for (const collName of collections) {
            const indexes = await db.collection(collName).indexes();
            console.log(`\n${collName} indexes:`, indexes.map(i => i.name).join(', '));
        }

        console.log('\n✅ All indexes created successfully!');
        console.log('\n📈 Dashboard queries should now be 10-100x faster');
        console.log('\n⚠️  Note: First query after indexes may still be slow (index warmup)');

    } catch (error) {
        console.error('❌ Error adding indexes:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

addIndexes();
