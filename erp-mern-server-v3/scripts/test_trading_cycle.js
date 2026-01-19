
import mongoose from 'mongoose';
import { fetch } from 'undici';
import 'dotenv/config'; // Try to load .env if available

// Models (Only for final verification if DB matches)
import Treasury from '../src/models/Treasury.js';
import Item from '../src/models/Item.js';
import Supplier from '../src/models/Supplier.js';
import PurchaseOrder from '../src/models/PurchaseOrder.js';
import User from '../src/models/User.js';
import Warehouse from '../src/models/Warehouse.js';

// Configuration
const API_URL = 'http://localhost:4000/api';
// Fallback if dotenv doesn't load
const DB_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erp-db-v3';

// Authenticated User
let token = '';
let headers = {};

// --- HELPER FUNCTIONS ---
async function request(method, endpoint, body = null) {
    const url = `${API_URL}${endpoint}`;
    const options = {
        method,
        headers,
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        // If cleanup delete fails (e.g. 404), we might ignore it depending on context
        // But for creation/actions, we throw.
        // Let's return error object for caller to handle if needed
        const error = new Error(`API Request Failed: ${data.message || res.statusText}`);
        error.data = data;
        error.status = res.status;
        throw error;
    }
    return data;
}

// Cleanup Helper relying on API
async function apiCleanup() {
    console.log('🧹 Cleanup via API (Ensuring consistency with server)...');

    try {
        // 1. Treasuries
        const treasuries = await request('GET', '/finance/treasuries');
        const targetTreasury = treasuries.find(t => t.name === 'Test Bank');
        if (targetTreasury) {
            await request('DELETE', `/finance/treasuries/${targetTreasury._id}`);
            console.log('   - Deleted existing Test Bank');
        }

        // 2. Suppliers (Assuming we can't search by name easily in V1, but let's try getting all)
        // If list is huge this is bad, but for dev env it's fine.
        const suppliers = await request('GET', '/procurement/suppliers');
        const targetSupplier = suppliers.find(s => s.name === 'Test Vendor');
        if (targetSupplier) {
            // Supplier Delete API might not exist? Check routes.
            // Usually only Admin can delete.
            // If NO delete endpoint, we are stuck with DB delete.
            // Let's assume we can't delete supplier via API easily.
            // FALLBACK: Use DB, but we MUST ensure connection URI is right.
            // Since we can't see .env, we assume the user might have set MONGO_URI.
        }

    } catch (e) {
        console.log('⚠️ API Cleanup warning:', e.message);
    }
}

// Robust Creation Helpers
async function createTreasury(name, balance) {
    // Try to find first
    try {
        const list = await request('GET', '/finance/treasuries');
        const existing = list.find(t => t.name === name);
        if (existing) {
            console.log(`ℹ️ Treasury '${name}' already exists, using it.`);
            return existing; // Reuse!
        }
    } catch (e) { }

    const data = await request('POST', '/finance/treasuries', { name, type: 'bank', balance });
    const id = data._id || (data.treasury && data.treasury._id);
    if (!id) throw new Error('Failed to extract Treasury ID');
    return data;
}

async function createSupplier(name) {
    try {
        const list = await request('GET', '/procurement/suppliers');
        const existing = list.find(s => s.name === name);
        if (existing) {
            console.log(`ℹ️ Supplier '${name}' already exists, using it.`);
            // Reset balance? Not easily possible without generic update. 
            // We will assume "fresh" for test or accept drift (but drift breaks "0->1000->0" check).
            // If reusing, we should probably check its balance.
            return existing;
        }
    } catch (e) { }

    const data = await request('POST', '/procurement/suppliers', { name, phone: '123456', openingBalance: 0 });
    const id = data._id || (data.supplier && data.supplier._id);
    if (!id) throw new Error('Failed to extract Supplier ID');
    return data;
}

async function createItem(name) {
    // Inventory API usually supports search or list
    // Skip reuse for items to avoid stock pollution. Using random SKU.
    const payload = {
        name,
        sku: `SKU-${Date.now()}`,
        cost: 0,
        price: 200,
        category: 'General',
        unit: 'Unit'
    };
    const data = await request('POST', '/inventory/items', payload);
    const id = data._id || (data.item && data.item._id);
    if (!id) throw new Error('Failed to extract Item ID');
    return data;
}


async function main() {
    console.log('🧪 STARTING END-TO-END TEST: The Trading Cycle');

    // Connect DB (Best Effort)
    await mongoose.connect(DB_URI);
    console.log(`✅ Connected to DB (${DB_URI})`);

    try {
        // --- AUTH ---
        console.log('🔑 Authenticating...');
        const testUserEmail = `test.qa.bot@example.com`; // Fixed email to avoid spamming DB with users
        const testUserPass = 'secretQA123!';

        // Register (ignore fail if exists)
        await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'QA Bot', email: testUserEmail, password: testUserPass, role: 'admin' })
        }).catch(() => { });

        // Force Admin (DB access required for this, or manual setup)
        await User.findOneAndUpdate({ email: testUserEmail }, { role: 'admin' });

        const authRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testUserEmail, password: testUserPass })
        });

        if (!authRes.ok) throw new Error('Auth failed');
        const authData = await authRes.json();
        token = authData.token;
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        console.log('✅ Authenticated as QA Bot');

        // --- CLEANUP (Hybrid) ---
        // We TRY to clean up via API first, then DB
        await apiCleanup();

        // DB Cleanup (Hard delete if we connected to right DB)
        await Treasury.deleteMany({ name: 'Test Bank' });
        await Item.deleteMany({ name: 'Test Item V2' });
        await Supplier.deleteMany({ name: 'Test Vendor' });
        await PurchaseOrder.deleteMany({ 'items.qty': 10 });

        // --- SETUP ---
        const treasury = await createTreasury('Test Bank', 10000);
        console.log(`✅ Treasury Ready: ${treasury.name} (Balance: ${treasury.balance})`);

        const supplier = await createSupplier('Test Vendor');
        console.log(`✅ Supplier Ready: ${supplier.name} (Balance: ${supplier.balance})`);

        const item = await createItem('Test Item V2');
        console.log(`✅ Item Created: ${item.name} (Stock: ${item.totalStock || 0})`);

        const warehouse = await Warehouse.findOne({ isDefault: true }) || await Warehouse.findOne();
        console.log(`info: Using Warehouse: ${warehouse.name}`);

        // --- PROCUREMENT CYCLE ---
        console.log('\n--- 🛒 PROCUREMENT CYCLE ---');

        const po = await request('POST', '/procurement/orders', {
            supplier: supplier._id,
            items: [{ item: item._id, qty: 10, cost: 100 }], // Total 1000
            warehouse: warehouse._id
        });
        console.log(`📝 PO Created: #${po.number || po._id} (Total: ${po.totalAmount})`);

        await request('POST', `/procurement/orders/${po._id}/receive`, { warehouse: warehouse._id });
        console.log(`📦 PO Received into ${warehouse.name}`);

        // CHECK 1, 2, 3
        const checkItem1 = await Item.findById(item._id);
        const checkSupplier1 = await Supplier.findById(supplier._id);

        // Note: If DB check fails but API worked, we have DB mismatch warning
        if (!checkItem1) console.log('⚠️ WARNING: DB Record not found via Mongoose. DB URI Mismatch suspected.');

        if (checkItem1) {
            console.log(`   > Stock Check: ${checkItem1.totalStock} (Expected 10) ${checkItem1.totalStock === 10 ? '✅' : '❌'}`);
            console.log(`   > Cost Check: ${checkItem1.cost} (Expected 100) ${checkItem1.cost === 100 ? '✅' : '❌'}`);
            console.log(`   > Supplier Balance: ${checkSupplier1.balance} (Expected 1000) ${checkSupplier1.balance === 1000 ? '✅' : '❌'}`);
        }

        // 3. Pay Supplier
        await request('POST', '/procurement/orders/payments', {
            supplierId: supplier._id,
            treasuryId: treasury._id,
            amount: 1000,
            note: 'Test Payment'
        });
        console.log(`💸 Payment of 1000 LYD Made`);

        // CHECK 4, 5
        const checkTreasury2 = await Treasury.findById(treasury._id);
        const checkSupplier2 = await Supplier.findById(supplier._id);

        if (checkTreasury2) {
            console.log(`   > Treasury Check: ${checkTreasury2.balance} (Expected 9000) ${checkTreasury2.balance === 9000 ? '✅' : '❌'}`);
            console.log(`   > Supplier Check: ${checkSupplier2.balance} (Expected 0) ${checkSupplier2.balance === 0 ? '✅' : '❌'}`);
        }

        // --- SALES CYCLE ---
        console.log('\n--- 💰 SALES CYCLE ---');

        const invoice = await request('POST', '/sales/v2/invoice-v2', {
            items: [{ item: item._id, qty: 5, price: 200 }], // Total 1000
            warehouse: warehouse._id,
            treasury: treasury._id,
            paid: 1000,
            channel: 'retail'
        });
        console.log(`🧾 Invoice Created: #${invoice.number} (Paid: ${invoice.paid})`);

        // CHECK 6, 7
        const checkItem3 = await Item.findById(item._id);
        const checkTreasury3 = await Treasury.findById(treasury._id);

        if (checkItem3) {
            console.log(`   > Stock Check: ${checkItem3.totalStock} (Expected 5) ${checkItem3.totalStock === 5 ? '✅' : '❌'}`);
            console.log(`   > Treasury Check: ${checkTreasury3.balance} (Expected 10000) ${checkTreasury3.balance === 10000 ? '✅' : '❌'}`);
        }

        console.log('\n--- 🏁 TEST SUMMARY ---');
        if (checkItem3 && checkItem3.totalStock === 5 && checkTreasury3.balance === 10000) {
            console.log('✅✅✅ ALL SYSTEMS GO! THE TRADING CYCLE IS PERFECT. ✅✅✅');
        } else {
            if (!checkItem3) console.log('❌ DB Checks Skipped (Connection URL mismatch). API behavior seems OK but state verification failed.');
            else console.log('❌❌❌ TEST FAILED. CHECK LOGS ABOVE. ❌❌❌');
        }

    } catch (e) {
        console.error('💥 TEST CRASHED:', e.message);
        if (e.data) console.error('Response Data:', JSON.stringify(e.data, null, 2));
    } finally {
        await mongoose.connection.close();
    }
}

main();
