import 'dotenv/config';
import mongoose from 'mongoose';
import Account from '../src/models/Account.js';
import connectDB from '../src/config/db.js';

const seedCOA = async () => {
    try {
        await connectDB();
        console.log('🔌 Connected to DB');

        // Check if accounts exist
        const count = await Account.countDocuments();
        if (count > 0) {
            console.log('⚠️ Accounts already exist. Skipping seed.');
            process.exit(0);
        }

        console.log('🌱 Seeding Standard Chart of Accounts...');

        // 1. Root Accounts (Level 1)
        const roots = [
            { code: '1', name: 'Assets', type: 'asset' },
            { code: '2', name: 'Liabilities', type: 'liability' },
            { code: '3', name: 'Equity', type: 'equity' },
            { code: '4', name: 'Revenue', type: 'revenue' },
            { code: '5', name: 'Expenses', type: 'expense' }
        ];

        const rootDocs = {};
        for (const root of roots) {
            const doc = await Account.create(root);
            rootDocs[root.code] = doc._id;
            console.log(`✅ Created Root: ${root.name} (${root.code})`);
        }

        // 2. Child Accounts (Level 2 & 3)
        const children = [
            // Assets (1)
            { code: '101', name: 'Current Assets', type: 'asset', parentId: rootDocs['1'] },
            { code: '102', name: 'Fixed Assets', type: 'asset', parentId: rootDocs['1'] },

            // Current Assets Children (101)
            // Need ID of 101, so we create these sequentially or look them up. 
            // For simplicity, let's just do Level 2 first, map them, then Level 3.
        ];

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
            const doc = await Account.create({
                ...item,
                parentId: rootDocs[item.parentCode]
            });
            level2Docs[item.code] = doc._id;
            console.log(`  ✅ Created: ${item.name} (${item.code})`);
        }

        // Level 3 (Leaf Nodes)
        const level3 = [
            // 101 Current Assets
            { code: '10101', name: 'Cash on Hand', type: 'asset', parentCode: '101' },
            { code: '10102', name: 'Bank Accounts', type: 'asset', parentCode: '101' },
            { code: '10103', name: 'Inventory', type: 'asset', parentCode: '101' },
            { code: '10200', name: 'Accounts Receivable', type: 'asset', parentCode: '101' },

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
            await Account.create({
                ...item,
                parentId: level2Docs[item.parentCode]
            });
            console.log(`    ✅ Created: ${item.name} (${item.code})`);
        }

        console.log('✨ Seed Complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error Seeding COA:', error);
        process.exit(1);
    }
};

seedCOA();
