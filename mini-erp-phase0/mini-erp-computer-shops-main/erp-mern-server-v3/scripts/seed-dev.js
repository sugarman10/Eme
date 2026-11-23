/**
 * ERP Seed Script - Development Environment
 * Creates realistic test data for ERP system testing
 *
 * Run: node scripts/seed-dev.js
 *
 * Features:
 * - Upserts to prevent duplicates on re-run
 * - seedTag marker for easy cleanup
 * - Clear log output with counts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Models
import User from '../src/models/User.js';
import Account from '../src/models/Account.js';
import Customer from '../src/models/Customer.js';
import Supplier from '../src/models/Supplier.js';
import Warehouse from '../src/models/Warehouse.js';
import Treasury from '../src/models/Treasury.js';
import Item from '../src/models/Item.js';
import StockLedger from '../src/models/StockLedger.js';
import Category from '../src/models/Category.js';

// ============================================================
// CONFIGURATION
// ============================================================
const SEED_TAG = 'dev';
const SEED_DEV_PASSWORD = process.env.SEED_DEV_PASSWORD;
if (!SEED_DEV_PASSWORD) { console.error('❌ SEED_DEV_PASSWORD غير مضبوط: عيّن كلمة مرور مستخدمي بيئة التطوير في متغير البيئة SEED_DEV_PASSWORD قبل التشغيل.'); process.exit(1); }
const USERS_PASSWORD = {
    admin: SEED_DEV_PASSWORD,
    manager: SEED_DEV_PASSWORD,
    cashier: SEED_DEV_PASSWORD,
};

// ============================================================
// HELPER: Add seed marker to data
// ============================================================
const withSeedMarker = (data) => ({
    ...data,
    seeded: true,
    seedTag: SEED_TAG,
});

// ============================================================
// CHECK REPLICA SET
// ============================================================
async function checkReplicaSet() {
    try {
        const adminDb = mongoose.connection.db.admin();
        const result = await adminDb.command({ replSetGetStatus: 1 });
        return result.ok === 1;
    } catch {
        return false;
    }
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
async function seedDev() {
    console.log('🌱 ========== ERP SEED (DEV) ==========\n');

    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/erp';
        console.log(`📡 Connecting to: ${mongoUri.replace(/\/\/.*@/, '//***@')}`);

        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Check Replica Set
        const isReplicaSet = await checkReplicaSet();
        if (!isReplicaSet) {
            console.log('⚠️  WARNING: MongoDB is NOT a Replica Set.');
            console.log('   Transactions will not work. Smoke tests may be limited.\n');
        } else {
            console.log('✅ Replica Set detected - Transactions supported\n');
        }

        const counts = {
            accounts: 0,
            users: 0,
            warehouses: 0,
            treasuries: 0,
            categories: 0,
            items: 0,
            customers: 0,
            suppliers: 0,
        };

        // ===== 1. CHART OF ACCOUNTS =====
        console.log('📒 Seeding Chart of Accounts...');
        const accountsData = [
            // أصول (Assets) - 1xxx
            { code: '1010', name: 'الصندوق', type: 'asset', isSystem: true, description: 'Cash in hand' },
            { code: '1020', name: 'البنك', type: 'asset', isSystem: true, description: 'Bank account' },
            { code: '1030', name: 'ذمم العملاء', type: 'asset', isSystem: true, description: 'Accounts Receivable' },
            { code: '10103', name: 'المخزون', type: 'asset', isSystem: true, description: 'Inventory' },
            // خصوم (Liabilities) - 2xxx
            { code: '20101', name: 'ذمم الموردين', type: 'liability', isSystem: true, description: 'Accounts Payable' },
            {
                code: '2020',
                name: 'ضريبة القيمة المضافة المستحقة',
                type: 'liability',
                isSystem: true,
                description: 'VAT Payable',
            },
            { code: '2030', name: 'أمانات العملاء', type: 'liability', isSystem: true, description: 'Customer Wallet/Deposits' },
            // إيرادات (Revenue) - 4xxx
            { code: '4010', name: 'إيرادات المبيعات', type: 'revenue', isSystem: true, description: 'Sales Revenue' },
            // مصروفات (Expenses) - 5xxx
            { code: '5010', name: 'تكلفة البضاعة المباعة', type: 'expense', isSystem: true, description: 'COGS' },
        ];

        for (const acc of accountsData) {
            await Account.findOneAndUpdate({ code: acc.code }, { $set: withSeedMarker(acc) }, { upsert: true });
            counts.accounts++;
        }
        console.log(`   ✅ Accounts: ${counts.accounts} created/updated`);

        // ===== 2. USERS =====
        console.log('\n👤 Seeding Users...');
        const usersData = [
            {
                username: 'admin',
                name: 'مدير النظام',
                email: 'admin@erp.local',
                role: 'admin',
                permissions: ['*'],
                isActive: true,
            },
            {
                username: 'manager',
                name: 'مدير المخزن',
                email: 'manager@erp.local',
                role: 'manager',
                permissions: ['inventory', 'reports', 'pos'],
                isActive: true,
            },
            {
                username: 'cashier',
                name: 'أمين الصندوق',
                email: 'cashier@erp.local',
                role: 'cashier',
                permissions: ['pos'],
                isActive: true,
            },
        ];

        for (const userData of usersData) {
            const hashedPassword = await bcrypt.hash(USERS_PASSWORD[userData.username], 10);
            await User.findOneAndUpdate(
                { username: userData.username },
                { $set: withSeedMarker({ ...userData, password: hashedPassword }) },
                { upsert: true }
            );
            counts.users++;
        }
        console.log(`   ✅ Users: ${counts.users} created/updated`);

        // ===== 3. WAREHOUSES =====
        console.log('\n🏭 Seeding Warehouses...');
        const warehousesData = [
            { code: 'WH-MAIN', name: 'المخزن الرئيسي' },
            { code: 'WH-BRANCH', name: 'مخزن الفرع' },
        ];

        const warehouses = [];
        for (const wh of warehousesData) {
            const created = await Warehouse.findOneAndUpdate(
                { code: wh.code },
                { $set: withSeedMarker(wh) },
                { upsert: true, new: true }
            );
            warehouses.push(created);
            counts.warehouses++;
        }
        console.log(`   ✅ Warehouses: ${counts.warehouses} created/updated`);

        // ===== 4. TREASURIES =====
        console.log('\n💰 Seeding Treasuries...');
        const cashAccount = await Account.findOne({ code: '1010' });
        const bankAccount = await Account.findOne({ code: '1020' });

        const treasuriesData = [
            {
                code: 'SAFE-01',
                name: 'الخزينة الرئيسية',
                type: 'safe',
                balance: 5000,
                isActive: true,
                accountId: cashAccount?._id,
            },
            {
                code: 'BANK-01',
                name: 'الحساب البنكي',
                type: 'bank',
                balance: 20000,
                isActive: true,
                accountId: bankAccount?._id,
            },
        ];

        const treasuries = [];
        for (const tr of treasuriesData) {
            const created = await Treasury.findOneAndUpdate(
                { code: tr.code },
                { $set: withSeedMarker(tr) },
                { upsert: true, new: true }
            );
            treasuries.push(created);
            counts.treasuries++;
        }
        console.log(`   ✅ Treasuries: ${counts.treasuries} created/updated`);

        // ===== 5. CATEGORIES =====
        console.log('\n📁 Seeding Categories...');
        const categoriesData = [
            { name: 'إلكترونيات', code: 'CAT-ELEC' },
            { name: 'مواد غذائية', code: 'CAT-FOOD' },
            { name: 'مستلزمات مكتبية', code: 'CAT-OFFICE' },
        ];

        const categories = [];
        for (const cat of categoriesData) {
            const created = await Category.findOneAndUpdate(
                { name: cat.name },
                { $set: withSeedMarker(cat) },
                { upsert: true, new: true }
            );
            categories.push(created);
            counts.categories++;
        }
        console.log(`   ✅ Categories: ${counts.categories} created/updated`);

        // ===== 6. ITEMS =====
        console.log('\n📦 Seeding Items...');
        const mainWarehouse = warehouses[0];
        const branchWarehouse = warehouses[1];

        const itemsData = [
            // High Turnover (fast moving)
            {
                sku: 'ITEM-001',
                name: 'ماء معدني 500مل',
                barcode: '6281234567890',
                cost: 0.5,
                price: 1,
                wholesalePrice: 0.8,
                minStock: 100,
                category: categories[1]?._id,
                initialQty: 500,
            },
            {
                sku: 'ITEM-002',
                name: 'عصير برتقال 1 لتر',
                barcode: '6281234567891',
                cost: 2,
                price: 3.5,
                wholesalePrice: 3,
                minStock: 50,
                category: categories[1]?._id,
                initialQty: 200,
            },
            // Normal items
            {
                sku: 'ITEM-003',
                name: 'ماوس لاسلكي',
                barcode: '6281234567892',
                cost: 15,
                price: 30,
                wholesalePrice: 25,
                minStock: 20,
                category: categories[0]?._id,
                initialQty: 50,
            },
            {
                sku: 'ITEM-004',
                name: 'لوحة مفاتيح USB',
                barcode: '6281234567893',
                cost: 20,
                price: 40,
                wholesalePrice: 35,
                minStock: 15,
                category: categories[0]?._id,
                initialQty: 40,
            },
            {
                sku: 'ITEM-005',
                name: 'دفتر ملاحظات A4',
                barcode: '6281234567894',
                cost: 3,
                price: 7,
                wholesalePrice: 5.5,
                minStock: 30,
                category: categories[2]?._id,
                initialQty: 100,
            },
            {
                sku: 'ITEM-006',
                name: 'قلم حبر أزرق',
                barcode: '6281234567895',
                cost: 0.5,
                price: 1.5,
                wholesalePrice: 1,
                minStock: 100,
                category: categories[2]?._id,
                initialQty: 300,
            },
            // Slow moving
            {
                sku: 'ITEM-007',
                name: 'شاشة كمبيوتر 24 بوصة',
                barcode: '6281234567896',
                cost: 400,
                price: 600,
                wholesalePrice: 550,
                minStock: 3,
                category: categories[0]?._id,
                initialQty: 10,
            },
            {
                sku: 'ITEM-008',
                name: 'طابعة ليزر',
                barcode: '6281234567897',
                cost: 800,
                price: 1200,
                wholesalePrice: 1100,
                minStock: 2,
                category: categories[0]?._id,
                initialQty: 5,
            },
        ];

        const items = [];
        for (const itemData of itemsData) {
            const { initialQty, ...itemFields } = itemData;

            // Create stock entries for both warehouses
            const stocks = [
                { warehouse: mainWarehouse._id, qty: Math.floor(initialQty * 0.7) },
                { warehouse: branchWarehouse._id, qty: Math.floor(initialQty * 0.3) },
            ];
            const totalStock = stocks.reduce((sum, s) => sum + s.qty, 0);

            const item = await Item.findOneAndUpdate(
                { sku: itemFields.sku },
                {
                    $set: withSeedMarker({
                        ...itemFields,
                        stocks,
                        totalStock,
                        stock: totalStock,
                    }),
                },
                { upsert: true, new: true }
            );
            items.push(item);

            // Create opening stock ledger entries
            for (const stockEntry of stocks) {
                if (stockEntry.qty > 0) {
                    await StockLedger.findOneAndUpdate(
                        {
                            item: item._id,
                            warehouse: stockEntry.warehouse,
                            ref: 'SEED-OPENING',
                        },
                        {
                            $set: withSeedMarker({
                                item: item._id,
                                warehouse: stockEntry.warehouse,
                                type: 'IN',
                                qty: stockEntry.qty,
                                ref: 'SEED-OPENING',
                                note: 'رصيد افتتاحي - Seed',
                                date: new Date(),
                            }),
                        },
                        { upsert: true }
                    );
                }
            }

            counts.items++;
        }
        console.log(`   ✅ Items: ${counts.items} created/updated`);

        // ===== 7. CUSTOMERS =====
        console.log('\n👥 Seeding Customers...');
        const customersData = [
            // Cash Customer (System)
            {
                code: 'CASH',
                name: 'عميل نقدي',
                phone: '',
                type: 'retail',
                creditLimit: 0,
                balance: 0,
                walletBalance: 0,
                isCashCustomer: true,
                isSystem: true,
            },
            // Credit Customers with varied balances
            {
                code: 'CUST-001',
                name: 'أحمد محمد العلي',
                phone: '0911234567',
                email: 'ahmed@example.com',
                type: 'retail',
                creditLimit: 5000,
                balance: 0,
                walletBalance: 0,
                isCashCustomer: false,
                isSystem: false,
            },
            {
                code: 'CUST-002',
                name: 'شركة النور للتجارة',
                phone: '0912345678',
                email: 'info@alnour.com',
                type: 'wholesale',
                creditLimit: 50000,
                balance: 1000,
                walletBalance: 500,
                isCashCustomer: false,
                isSystem: false,
            },
            {
                code: 'CUST-003',
                name: 'سالم الفيتوري',
                phone: '0913456789',
                type: 'retail',
                creditLimit: 3000,
                balance: 250,
                walletBalance: 0,
                isCashCustomer: false,
                isSystem: false,
            },
            {
                code: 'CUST-004',
                name: 'مؤسسة الأمل',
                phone: '0914567890',
                email: 'amal@example.com',
                type: 'wholesale',
                creditLimit: 20000,
                balance: 50,
                walletBalance: 100,
                isCashCustomer: false,
                isSystem: false,
            },
        ];

        for (const cust of customersData) {
            await Customer.findOneAndUpdate({ code: cust.code }, { $set: withSeedMarker(cust) }, { upsert: true });
            counts.customers++;
        }
        console.log(`   ✅ Customers: ${counts.customers} created/updated`);

        // ===== 8. SUPPLIERS =====
        console.log('\n🚚 Seeding Suppliers...');
        const suppliersData = [
            {
                code: 'SUP-001',
                name: 'شركة الاستيراد العامة',
                company: 'General Import Co.',
                phone: '0921234567',
                email: 'info@genimport.com',
                openingBalance: 0,
                balance: 0,
            },
            {
                code: 'SUP-002',
                name: 'مصنع الأغذية الوطني',
                company: 'National Food Factory',
                phone: '0922345678',
                email: 'sales@natfood.com',
                openingBalance: 5000,
                balance: 5000,
            },
            {
                code: 'SUP-003',
                name: 'مورد الإلكترونيات',
                company: 'ElectroSupply Ltd',
                phone: '0923456789',
                email: 'orders@electrosupply.com',
                openingBalance: 800,
                balance: 800,
            },
        ];

        for (const sup of suppliersData) {
            await Supplier.findOneAndUpdate({ code: sup.code }, { $set: withSeedMarker(sup) }, { upsert: true });
            counts.suppliers++;
        }
        console.log(`   ✅ Suppliers: ${counts.suppliers} created/updated`);

        // ===== SUMMARY =====
        console.log('\n========== SEED COMPLETE ==========');
        console.log('📊 Summary:');
        console.log(`   - Accounts: ${counts.accounts}`);
        console.log(`   - Users: ${counts.users}`);
        console.log(`   - Warehouses: ${counts.warehouses}`);
        console.log(`   - Treasuries: ${counts.treasuries}`);
        console.log(`   - Categories: ${counts.categories}`);
        console.log(`   - Items: ${counts.items}`);
        console.log(`   - Customers: ${counts.customers}`);
        console.log(`   - Suppliers: ${counts.suppliers}`);

        console.log('\n📋 User Credentials:');
        console.log('   ┌───────────┬─────────────┐');
        console.log('   │ Username  │ Password    │');
        console.log('   ├───────────┼─────────────┤');
        console.log('   │ admin     │ (من البيئة) │');
        console.log('   │ manager   │ (من البيئة) │');
        console.log('   │ cashier   │ (من البيئة) │');
        console.log('   └───────────┴─────────────┘');

        console.log('\n💡 Treasury Balances:');
        console.log('   - SAFE-01 (Cash): 5,000');
        console.log('   - BANK-01 (Bank): 20,000');

        if (!isReplicaSet) {
            console.log('\n⚠️  Note: Run smoke-critical.js after setting up Replica Set for transaction tests.');
        } else {
            console.log('\n✅ Ready! Run: node scripts/smoke-critical.js');
        }
    } catch (error) {
        console.error('\n❌ Seed Failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Database connection closed.');
        process.exit(0);
    }
}

seedDev();
