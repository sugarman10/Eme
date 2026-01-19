/**
 * Seed Arabic Chart of Accounts
 * دليل الحسابات باللغة العربية
 * 
 * Usage: node scripts/seed-coa-arabic.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import Account from '../src/models/Account.js';
import connectDB from '../src/config/db.js';

const seedArabicCOA = async () => {
    try {
        await connectDB();
        console.log('🔌 تم الاتصال بقاعدة البيانات');

        // حذف الحسابات القديمة (اختياري - يمكن تعليقه)
        await Account.deleteMany({});
        console.log('🗑️  تم حذف الحسابات القديمة');

        console.log('🌱 جاري إنشاء دليل الحسابات بالعربية...\n');

        // ============================================
        // الحسابات الرئيسية (دليل الحسابات العربي)
        // ============================================
        const accounts = [
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

        // إنشاء الحسابات
        for (const account of accounts) {
            await Account.create(account);
            console.log(`✅ ${account.code} - ${account.name}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✨ تم إنشاء ${accounts.length} حساب بنجاح!`);
        console.log('='.repeat(50));

        // عرض ملخص
        console.log('\n📊 ملخص دليل الحسابات:');
        console.log('─'.repeat(40));

        const summary = await Account.aggregate([
            { $group: { _id: '$type', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const typeNames = {
            asset: 'الأصول',
            liability: 'الخصوم',
            equity: 'حقوق الملكية',
            revenue: 'الإيرادات',
            expense: 'المصروفات'
        };

        for (const item of summary) {
            console.log(`   ${typeNames[item._id]}: ${item.count} حساب`);
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ خطأ:', error.message);
        process.exit(1);
    }
};

seedArabicCOA();
