/**
 * Comprehensive ERP Seed Script
 * Simulates a full year of business operations for E2E testing
 * 
 * Run: node scripts/seed-full-test.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from '../src/config/db.js';

// Models
import User from '../src/models/User.js';
import Account from '../src/models/Account.js';
import Customer from '../src/models/Customer.js';
import Supplier from '../src/models/Supplier.js';
import Warehouse from '../src/models/Warehouse.js';
import Treasury from '../src/models/Treasury.js';
import Item from '../src/models/Item.js';
import SalesInvoice from '../src/models/SalesInvoice.js';
import Receipt from '../src/models/Receipt.js';
import StockLedger from '../src/models/StockLedger.js';

// ========== CONFIGURATION ==========
const YEAR = 2024;
const INVOICE_COUNT_PER_QUARTER = 25; // 100 invoices total
const ITEMS_PER_INVOICE_MIN = 1;
const ITEMS_PER_INVOICE_MAX = 5;

// ========== HELPER FUNCTIONS ==========
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (quarter) => {
    const startMonth = (quarter - 1) * 3;
    const month = startMonth + randomBetween(0, 2);
    const day = randomBetween(1, 28);
    return new Date(YEAR, month, day);
};

// ========== SEED DATA ==========
async function seedAll() {
    try {
        console.log('🌱 ========== STARTING COMPREHENSIVE SEED ==========');
        await connectDB();

        // ===== 1. CLEAR EXISTING DATA (Optional - Enable for fresh start) =====
        console.log('🗑️  Clearing existing test data...');
        await Promise.all([
            // Keep Users, Accounts - clear transactional data only
            SalesInvoice.deleteMany({}),
            Receipt.deleteMany({}),
            StockLedger.deleteMany({}),
            Customer.deleteMany({}),
            Supplier.deleteMany({}),
            Item.deleteMany({}),
            Warehouse.deleteMany({}),
            Treasury.deleteMany({})
        ]);
        console.log('✅ Old data cleared.');

        // ===== 2. SEED ADMIN USER =====
        console.log('\n👤 Seeding Admin User...');
        const seedPassword = process.env.SEED_TEST_PASSWORD;
        if (!seedPassword) { console.error('❌ SEED_TEST_PASSWORD غير مضبوط: عيّن كلمة المرور في متغير البيئة SEED_TEST_PASSWORD قبل التشغيل.'); process.exit(1); }
        const hashedPassword = await bcrypt.hash(seedPassword, 10);
        const admin = await User.findOneAndUpdate(
            { email: 'admin@example.com' },
            {
                $set: {
                    name: 'System Administrator',
                    email: 'admin@example.com',
                    password: hashedPassword,
                    role: 'admin',
                    isActive: true,
                    permissions: ['*']
                }
            },
            { upsert: true, new: true }
        );
        console.log(`   ✅ Admin: ${admin.email}`);

        // ===== 3. SEED CHART OF ACCOUNTS (Basic) =====
        console.log('\n📒 Seeding Chart of Accounts...');
        const accountsData = [
            // ===== الأصول (1xxx) =====
            { code: '1010', name: 'الصندوق', type: 'asset', isSystem: true },
            { code: '1020', name: 'البنك', type: 'asset', isSystem: true },
            { code: '1030', name: 'ذمم العملاء', type: 'asset', isSystem: true },
            { code: '1040', name: 'المخزون', type: 'asset', isSystem: true },
            // ===== الخصوم (2xxx) =====
            { code: '2010', name: 'ذمم الموردين', type: 'liability', isSystem: true },
            { code: '2020', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', isSystem: true },
            // ===== حقوق الملكية (3xxx) =====
            { code: '3010', name: 'رأس المال', type: 'equity', isSystem: true },
            { code: '3020', name: 'الأرباح المحتجزة', type: 'equity', isSystem: true },
            // ===== الإيرادات (4xxx) =====
            { code: '4010', name: 'إيرادات المبيعات', type: 'revenue', isSystem: true },
            // ===== المصروفات (5xxx) =====
            { code: '5010', name: 'تكلفة البضاعة المباعة', type: 'expense', isSystem: true },
            { code: '5020', name: 'مصروفات تشغيلية', type: 'expense', isSystem: true },
        ];
        for (const acc of accountsData) {
            await Account.findOneAndUpdate({ code: acc.code }, { $set: acc }, { upsert: true });
        }
        console.log(`   ✅ ${accountsData.length} accounts seeded.`);

        // ===== 4. SEED WAREHOUSES =====
        console.log('\n🏭 Seeding Warehouses...');
        const warehousesData = [
            { code: 'WH-MAIN', name: 'المخزن الرئيسي' },
            { code: 'WH-BRANCH1', name: 'مخزن الفرع الأول' }
        ];
        const warehouses = [];
        for (const wh of warehousesData) {
            const created = await Warehouse.findOneAndUpdate({ code: wh.code }, { $set: wh }, { upsert: true, new: true });
            warehouses.push(created);
        }
        console.log(`   ✅ ${warehouses.length} warehouses seeded.`);

        // ===== 5. SEED TREASURY =====
        console.log('\n💰 Seeding Treasuries...');
        const treasuryAccount = await Account.findOne({ code: '1010' });
        const treasury = await Treasury.findOneAndUpdate(
            { code: 'SAFE-01' },
            { $set: { code: 'SAFE-01', name: 'الخزينة الرئيسية', type: 'safe', balance: 50000, isActive: true, accountId: treasuryAccount?._id } },
            { upsert: true, new: true }
        );
        console.log(`   ✅ Treasury: ${treasury.name} (Balance: ${treasury.balance})`);

        // ===== 6. SEED CUSTOMERS =====
        console.log('\n👥 Seeding Customers...');
        const customersData = [
            { code: 'CUST-001', name: 'أحمد محمد', phone: '0911234567', type: 'retail', creditLimit: 5000 },
            { code: 'CUST-002', name: 'شركة الأمل للتجارة', phone: '0912345678', type: 'wholesale', creditLimit: 50000 },
            { code: 'CUST-003', name: 'سالم الفيتوري', phone: '0913456789', type: 'retail', creditLimit: 3000 },
            { code: 'CUST-004', name: 'مؤسسة النور', phone: '0914567890', type: 'wholesale', creditLimit: 30000 },
            { code: 'CUST-005', name: 'عميل نقدي', phone: '0915678901', type: 'retail', creditLimit: 0 }
        ];
        const customers = [];
        for (const cust of customersData) {
            const created = await Customer.findOneAndUpdate({ code: cust.code }, { $set: cust }, { upsert: true, new: true });
            customers.push(created);
        }
        console.log(`   ✅ ${customers.length} customers seeded.`);

        // ===== 7. SEED SUPPLIERS =====
        console.log('\n🚚 Seeding Suppliers...');
        const suppliersData = [
            { code: 'SUP-001', name: 'مورد البضائع العامة', company: 'شركة الاستيراد', phone: '0921234567' },
            { code: 'SUP-002', name: 'مصنع الأغذية', company: 'المصنع الوطني', phone: '0922345678' }
        ];
        for (const sup of suppliersData) {
            await Supplier.findOneAndUpdate({ code: sup.code }, { $set: sup }, { upsert: true });
        }
        console.log(`   ✅ ${suppliersData.length} suppliers seeded.`);

        // ===== 8. SEED ITEMS WITH STOCK =====
        console.log('\n📦 Seeding Items & Stock...');
        const itemsData = [
            { sku: 'ITEM-001', name: 'لابتوب HP', cost: 2500, price: 3500, wholesalePrice: 3200, minStock: 5 },
            { sku: 'ITEM-002', name: 'شاشة سامسونج 24"', cost: 500, price: 750, wholesalePrice: 680, minStock: 10 },
            { sku: 'ITEM-003', name: 'ماوس لاسلكي', cost: 30, price: 60, wholesalePrice: 50, minStock: 50 },
            { sku: 'ITEM-004', name: 'لوحة مفاتيح ميكانيكية', cost: 150, price: 250, wholesalePrice: 220, minStock: 20 },
            { sku: 'ITEM-005', name: 'سماعات بلوتوث', cost: 80, price: 150, wholesalePrice: 130, minStock: 30 },
            { sku: 'ITEM-006', name: 'كابل HDMI', cost: 10, price: 25, wholesalePrice: 20, minStock: 100 },
            { sku: 'ITEM-007', name: 'فلاشة USB 64GB', cost: 20, price: 45, wholesalePrice: 38, minStock: 80 },
            { sku: 'ITEM-008', name: 'هارد خارجي 1TB', cost: 200, price: 350, wholesalePrice: 310, minStock: 15 }
        ];
        const items = [];
        const mainWarehouse = warehouses[0];
        for (const itemData of itemsData) {
            const initialQty = randomBetween(50, 200);
            const item = await Item.findOneAndUpdate(
                { sku: itemData.sku },
                {
                    $set: {
                        ...itemData,
                        stocks: [{ warehouse: mainWarehouse._id, qty: initialQty }],
                        totalStock: initialQty,
                        stock: initialQty
                    }
                },
                { upsert: true, new: true }
            );
            items.push(item);

            // Create opening stock ledger entry
            await StockLedger.create({
                item: item._id,
                warehouse: mainWarehouse._id,
                type: 'IN',
                qty: initialQty,
                ref: 'OPENING',
                note: 'رصيد افتتاحي'
            });
        }
        console.log(`   ✅ ${items.length} items seeded with opening stock.`);

        // ===== 9. SEED SALES INVOICES (Q1-Q4) =====
        console.log('\n🧾 Seeding Sales Invoices...');
        let invoiceNumber = 1000;
        const allInvoices = [];

        for (let quarter = 1; quarter <= 4; quarter++) {
            console.log(`   📅 Quarter ${quarter}...`);
            for (let i = 0; i < INVOICE_COUNT_PER_QUARTER; i++) {
                const customer = randomElement(customers);
                const channel = customer.type === 'wholesale' ? 'wholesale' : 'retail';
                const invoiceDate = randomDate(quarter);
                const itemCount = randomBetween(ITEMS_PER_INVOICE_MIN, ITEMS_PER_INVOICE_MAX);

                const invoiceItems = [];
                let subtotal = 0;

                for (let j = 0; j < itemCount; j++) {
                    const item = randomElement(items);
                    const qty = randomBetween(1, 5);
                    const price = channel === 'wholesale' ? item.wholesalePrice : item.price;
                    invoiceItems.push({ item: item._id, qty, price, cost: item.cost });
                    subtotal += qty * price;
                }

                const discount = Math.random() > 0.7 ? Math.round(subtotal * 0.05) : 0;
                const grand = subtotal - discount;
                const isPaid = Math.random() > 0.3; // 70% chance fully paid
                const paid = isPaid ? grand : Math.round(grand * randomBetween(0, 80) / 100);
                const remaining = grand - paid;

                const invoice = await SalesInvoice.create({
                    number: `INV-${++invoiceNumber}`,
                    date: invoiceDate,
                    customer: customer._id,
                    cashier: admin._id,
                    channel,
                    type: channel === 'wholesale' ? 'wholesale' : 'retail',
                    items: invoiceItems,
                    warehouse: mainWarehouse._id,
                    treasury: treasury._id,
                    paymentMethod: isPaid ? 'cash' : 'credit',
                    status: 'confirmed',
                    discountValue: discount,
                    totals: {
                        subtotal,
                        tax: 0,
                        discount,
                        paid,
                        remaining,
                        grand
                    }
                });
                allInvoices.push(invoice);

                // Create receipt if paid
                if (paid > 0) {
                    await Receipt.create({
                        customer: customer._id,
                        date: invoiceDate,
                        amount: paid,
                        method: 'cash',
                        invoices: [invoice._id],
                        allocations: [{ invoice: invoice._id, amount: paid }]
                    });
                }
            }
        }
        console.log(`   ✅ ${allInvoices.length} invoices seeded across 4 quarters.`);

        // ===== 10. SUMMARY =====
        console.log('\n========== SEED COMPLETE ==========');
        console.log(`📊 Summary:`);
        console.log(`   - Users: 1 (admin@example.com / 12345678)`);
        console.log(`   - Accounts: ${accountsData.length}`);
        console.log(`   - Warehouses: ${warehouses.length}`);
        console.log(`   - Treasuries: 1 (Balance: 50,000)`);
        console.log(`   - Customers: ${customers.length}`);
        console.log(`   - Suppliers: ${suppliersData.length}`);
        console.log(`   - Items: ${items.length}`);
        console.log(`   - Invoices: ${allInvoices.length}`);
        console.log(`\n🎉 Ready for E2E Testing!`);

    } catch (error) {
        console.error('❌ Seed Failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Database connection closed.');
        process.exit(0);
    }
}

seedAll();
