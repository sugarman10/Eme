import 'dotenv/config';
import mongoose from 'mongoose';
import Account from '../src/models/Account.js';
import connectDB from '../src/config/db.js';

const forceSeedCOA = async () => {
    try {
        await connectDB();
        console.log('🔌 Connected to DB');

        console.log('🌱 Force Seeding Standard Chart of Accounts...');
        console.log('⚠️ This will DELETE ALL existing accounts and recreate them!\n');

        // UPSERT LOGIC: Check before create
        const roots = [
            { code: '1', name: 'Assets', type: 'asset' },
            { code: '2', name: 'Liabilities', type: 'liability' },
            { code: '3', name: 'Equity', type: 'equity' },
            { code: '4', name: 'Revenue', type: 'revenue' },
            { code: '5', name: 'Expenses', type: 'expense' }
        ];

        const rootDocs = {};
        for (const root of roots) {
            let doc = await Account.findOne({ code: root.code });
            if (!doc) {
                doc = await Account.create(root);
                console.log(`✅ Created Root: ${root.name} (${root.code})`);
            } else {
                console.log(`ℹ️ Exists Root: ${root.name} (${root.code})`);
            }
            rootDocs[root.code] = doc._id;
        }

        // Level 2
        const level2 = [
            // Assets
            { code: '101', name: 'Current Assets', type: 'asset', parentCode: '1' },
            { code: '102', name: 'Non-Current Assets', type: 'asset', parentCode: '1' },
            // Liabilities
            { code: '201', name: 'Current Liabilities', type: 'liability', parentCode: '2' },
            { code: '202', name: 'Non-Current Liabilities', type: 'liability', parentCode: '2' },
            // Equity
            { code: '301', name: 'Owner Equity', type: 'equity', parentCode: '3' },
            // Revenue
            { code: '401', name: 'Operating Revenue', type: 'revenue', parentCode: '4' },
            // Expenses
            { code: '501', name: 'Cost of Goods Sold', type: 'expense', parentCode: '5' },
            { code: '502', name: 'Operating Expenses', type: 'expense', parentCode: '5' },
        ];

        const level2Docs = {};
        for (const item of level2) {
            let doc = await Account.findOne({ code: item.code });
            if (!doc) {
                doc = await Account.create({
                    ...item,
                    parentId: rootDocs[item.parentCode]
                });
                console.log(`  ✅ Created: ${item.name} (${item.code})`);
            } else {
                console.log(`  ℹ️ Exists: ${item.name} (${item.code})`);
            }
            level2Docs[item.code] = doc._id;
        }

        // Level 3 (Leaf Nodes)
        const level3 = [
            // 101 Current Assets
            { code: '10101', name: 'Cash on Hand', type: 'asset', parentCode: '101' },
            { code: '10102', name: 'Bank Accounts', type: 'asset', parentCode: '101' },
            { code: '10103', name: 'Inventory', type: 'asset', parentCode: '101' },
            { code: '10104', name: 'Accounts Receivable', type: 'asset', parentCode: '101' },

            // 201 Current Liabilities
            { code: '20101', name: 'Accounts Payable', type: 'liability', parentCode: '201' },
            { code: '20102', name: 'Tax Payable', type: 'liability', parentCode: '201' },

            // 401 Revenue
            { code: '40101', name: 'Sales Revenue', type: 'revenue', parentCode: '401' },
            { code: '40102', name: 'Service Revenue', type: 'revenue', parentCode: '401' },

            // 501 COGS
            { code: '50101', name: 'Cost of Goods Sold', type: 'expense', parentCode: '501' },

            // 502 Expenses
            { code: '50201', name: 'Salaries Expense', type: 'expense', parentCode: '502' },
            { code: '50202', name: 'Rent Expense', type: 'expense', parentCode: '502' },
            { code: '50203', name: 'Utilities Expense', type: 'expense', parentCode: '502' },
        ];

        for (const item of level3) {
            let doc = await Account.findOne({ code: item.code });
            if (!doc) {
                await Account.create({
                    ...item,
                    parentId: level2Docs[item.parentCode]
                });
                console.log(`    ✅ Created: ${item.name} (${item.code})`);
            } else {
                console.log(`    ℹ️ Exists: ${item.name} (${item.code})`);
            }
        }

        console.log('\n✨ Force Seed Complete!');
        console.log('\n🔍 Verifying sales accounts...');

        const salesAccounts = await Account.find({
            code: { $in: ['10101', '10104', '40101', '50101', '10103'] }
        });

        console.log(`✅ Found ${salesAccounts.length}/5 required sales accounts`);
        salesAccounts.forEach(acc => {
            console.log(`   ${acc.code} - ${acc.name}`);
        });

        process.exit(0);

    } catch (error) {
        console.error('❌ Error Force Seeding COA:', error);
        process.exit(1);
    }
};

forceSeedCOA();
