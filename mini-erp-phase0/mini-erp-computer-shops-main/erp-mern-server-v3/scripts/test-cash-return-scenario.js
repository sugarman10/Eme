
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Models
import User from '../src/models/User.js';
import Treasury from '../src/models/Treasury.js';
import Item from '../src/models/Item.js';
import Customer from '../src/models/Customer.js';
import SalesInvoice from '../src/models/SalesInvoice.js';
import SalesReturn from '../src/models/SalesReturn.js';
import Warehouse from '../src/models/Warehouse.js';
import Account from '../src/models/Account.js';

// Controllers/Services (We will use logic directly or import helper)
import { createSalesReturn } from '../src/controllers/salesReturnController.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp-system';

async function runTest() {
    console.log('🚀 Starting Cash Refund Scenario Test...');

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Setup Data
        // Find Admin User
        const admin = await User.findOne({ role: 'admin' });
        if (!admin) throw new Error('No admin user found');
        console.log(`👤 Admin User: ${admin.name}`);

        // Find Warehouse
        const warehouse = await Warehouse.findOne();
        if (!warehouse) throw new Error('No warehouse found');
        console.log(`🏭 Warehouse: ${warehouse.name}`);

        // Find/Create Treasury
        let treasury = await Treasury.findOne({ type: 'cash' });
        if (!treasury) {
            console.log('⚠️ No cash treasury found, creating one...');
            treasury = await Treasury.create({ name: 'Test Treasury', type: 'cash', balance: 10000 });
        }
        const initialTreasuryBalance = treasury.balance;
        console.log(`💰 Treasury: ${treasury.name} | Balance: ${initialTreasuryBalance}`);

        // Find/Create Item
        let item = await Item.findOne({ 'stocks.warehouse': warehouse._id, 'stocks.qty': { $gt: 10 } });
        if (!item) {
            console.log('⚠️ No suitable item found, creating one...');
            item = await Item.create({
                name: 'Test Item',
                sku: `TEST-${Date.now()}`,
                price: 100,
                cost: 80,
                type: 'product',
                stocks: [{ warehouse: warehouse._id, qty: 100 }],
                totalStock: 100
            });
        }
        const initialStock = item.stocks.find(s => s.warehouse.toString() === warehouse._id.toString()).qty;
        console.log(`📦 Item: ${item.name} | Stock: ${initialStock}`);

        // Find/Create Customer
        let customer = await Customer.findOne({ isCashCustomer: false });
        if (!customer) {
            customer = await Customer.create({ name: 'Test Customer', phone: '123456' });
        }
        console.log(`👥 Customer: ${customer.name}`);

        // 2. Create Invoice (Mocking the process)
        console.log('\n--- Step 1: Creating Sales Invoice (Paid) ---');
        // We won't use the full controller, just create the doc to simulate strict state
        const QTY_SOLD = 5;
        const UNIT_PRICE = item.price;
        const TOTAL_SALE = QTY_SOLD * UNIT_PRICE;

        // Deduct stock manually for setup
        await Item.updateOne(
            { _id: item._id, 'stocks.warehouse': warehouse._id },
            { $inc: { 'stocks.$.qty': -QTY_SOLD, totalStock: -QTY_SOLD } }
        );

        const invoice = await SalesInvoice.create({
            number: `INV-TEST-${Date.now()}`,
            date: new Date(),
            customer: customer._id,
            warehouse: warehouse._id,
            items: [{ item: item._id, qty: QTY_SOLD, price: UNIT_PRICE, cost: item.cost }],
            status: 'posted',
            paymentMethod: 'cash',
            totals: { subtotal: TOTAL_SALE, tax: 0, discount: 0, paid: TOTAL_SALE, remaining: 0, grand: TOTAL_SALE },
            createdBy: admin._id
        });
        console.log(`✅ Invoice Created: ${invoice.number} | Qty: ${QTY_SOLD} | Total: ${TOTAL_SALE}`);

        // 3. Perform Cash Return
        console.log('\n--- Step 2: Performing Cash Return (Auto-Approve) ---');
        const QTY_RETURN = 2;
        const REFUND_AMOUNT = QTY_RETURN * UNIT_PRICE;

        // Mock Request/Response for Controller
        const req = {
            user: admin,
            ip: '127.0.0.1',
            body: {
                invoiceId: invoice._id,
                items: [{ item: item._id.toString(), qty: QTY_RETURN, reason: 'changed_mind' }],
                warehouse: warehouse._id,
                autoApprove: true,
                refundMethod: 'cash',
                treasury: treasury._id,
                note: 'Test Cash Refund'
            }
        };

        const res = {
            status: (code) => ({
                json: (data) => {
                    // console.log(`Response [${code}]:`, data);
                    return { code, data };
                }
            })
        };

        // Call Controller
        const result = await createSalesReturn(req, res);

        // 4. Verification
        console.log('\n--- Step 3: Verifying Results ---');

        // A. Check Treasury Deduction
        const updatedTreasury = await Treasury.findById(treasury._id);
        const expectedBalance = initialTreasuryBalance - REFUND_AMOUNT;

        console.log(`💰 Old Treasury Balance: ${initialTreasuryBalance}`);
        console.log(`💰 New Treasury Balance: ${updatedTreasury.balance}`);
        console.log(`💰 Expected Balance: ${expectedBalance}`);

        if (Math.abs(updatedTreasury.balance - expectedBalance) < 0.01) {
            console.log('✅ Treasury Verification PASSED');
        } else {
            console.error('❌ Treasury Verification FAILED');
        }

        // B. Check Invoice Status
        const updatedInvoice = await SalesInvoice.findById(invoice._id);
        console.log(`📄 Invoice Status: ${updatedInvoice.status}`);
        if (updatedInvoice.status === 'partially_returned') {
            console.log('✅ Invoice Status Verification PASSED');
        } else {
            console.error('❌ Invoice Status Verification FAILED (Expected partially_returned)');
        }

        // C. Check Stock
        const updatedItem = await Item.findById(item._id);
        const currentStock = updatedItem.stocks.find(s => s.warehouse.toString() === warehouse._id.toString()).qty;
        // Initial - Sold + Returned
        const expectedStock = initialStock - QTY_SOLD + QTY_RETURN;
        console.log(`📦 Item Stock: ${currentStock} (Expected: ${expectedStock})`);
        if (currentStock === expectedStock) {
            console.log('✅ Stock Verification PASSED');
        } else {
            console.error('❌ Stock Verification FAILED');
        }

        // D. Check Transaction
        const Transaction = (await import('../src/models/Transaction.js')).default;
        const tx = await Transaction.findOne({ relatedModel: 'SalesReturn', relatedId: result.data._id, type: 'expense' });
        if (tx) {
            console.log(`✅ Transaction Created: ${tx.amount} (Type: ${tx.type})`);
        } else {
            console.error('❌ Transaction Verification FAILED');
        }

    } catch (error) {
        console.error('🚨 Test Failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

runTest();
