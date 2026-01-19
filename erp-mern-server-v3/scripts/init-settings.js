import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import SystemSetting from '../src/models/SystemSetting.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system';

const seedSettings = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Define Settings
        const settings = [
            // TAX SETTING: 0% for Libya Context
            {
                key: 'tax_rate_percent',
                value: 0,
                description: 'شرط الضريبة (0% للسياق المحلي)',
                group: 'accounting'
            },
            // ACCOUNT CODES (Mapping logical names to Chart of Account codes)
            { key: 'acc_cash', value: '10101', description: 'الصندوق / النقدية', group: 'accounting' },
            { key: 'acc_ar', value: '10104', description: 'العملاء / الذمم المدينة', group: 'accounting' },
            { key: 'acc_sales', value: '40101', description: 'المبيعات / الإيرادات', group: 'accounting' },
            { key: 'acc_cogs', value: '50101', description: 'تكلفة البضاعة المباعة', group: 'accounting' },
            { key: 'acc_inventory', value: '10103', description: 'المخزون', group: 'accounting' }
        ];

        // 2. Upsert Settings
        for (const setting of settings) {
            await SystemSetting.findOneAndUpdate(
                { key: setting.key },
                { $set: setting },
                { upsert: true, new: true }
            );
            console.log(`🔹 Configured: ${setting.key} = ${setting.value}`);
        }

        console.log('✅ System Settings Initialized Successfully');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding settings:', error);
        process.exit(1);
    }
};

seedSettings();
