/**
 * Seed Arabic Chart of Accounts (Unified & Detailed)
 * دليل الحسابات الموحد والشامل (متوافق مع النظام الحي والكود البرمجي)
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
        // await Account.deleteMany({});
        // console.log('🗑️  تم حذف الحسابات القديمة');

        console.log('🌱 جاري تحديث دليل الحسابات...\n');

        const accounts = [
            // ============================================
            // 1. الأصول (Assets)
            // ============================================
            // النقدية وما في حكمها
            { code: '1010', name: 'الصندوق الرئيسي', type: 'asset', isSystem: true },
            { code: '10101', name: 'صندوق الكاشير 1', type: 'asset', isSystem: true, parentCode: '1010' },
            { code: '10102', name: 'صندوق الكاشير 2', type: 'asset', isSystem: true, parentCode: '1010' },

            // البنوك
            { code: '1020', name: 'البنك', type: 'asset', isSystem: true },
            { code: '10201', name: 'مصرف الجمهورية', type: 'asset', isSystem: true, parentCode: '1020' },

            // الذمم
            { code: '1030', name: 'ذمم العملاء (إجمالي)', type: 'asset', isSystem: true },
            { code: '10105', name: 'ذمم موظفين / سلف', type: 'asset', isSystem: true, description: 'حساب مراقبة سلف الموظفين' }, // هام للرواتب
            { code: '11101', name: 'عهد نقدية وأخرى', type: 'asset', isSystem: true },

            // المخزون
            { code: '1040', name: 'المخزون السلعي', type: 'asset', isSystem: true },
            { code: '10103', name: 'مخزون بضاعة آخر المدة', type: 'asset', isSystem: true, description: 'للاستخدام في القيود الآلية' },

            // الأصول الثابتة
            { code: '1100', name: 'أصول ثابتة', type: 'asset', isSystem: true },


            // ============================================
            // 2. الالتزامات (Liabilities)
            // ============================================
            { code: '2010', name: 'ذمم الموردين', type: 'liability', isSystem: true },
            { code: '20101', name: 'موردين بضاعة', type: 'liability', isSystem: true, parentCode: '2010' },

            { code: '2020', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', isSystem: true },
            { code: '2030', name: 'أمانات ومحافظ العملاء', type: 'liability', isSystem: true, description: 'رصيد المحفظة الإلكترونية' }, // هام للمحفظة

            // ============================================
            // 3. حقوق الملكية (Equity)
            // ============================================
            { code: '3010', name: 'رأس المال', type: 'equity', isSystem: true },
            { code: '3020', name: 'الأرباح المحتجزة', type: 'equity', isSystem: true },


            // ============================================
            // 4. الإيرادات (Revenue)
            // ============================================
            { code: '4010', name: 'إيرادات المبيعات', type: 'revenue', isSystem: true },
            { code: '40101', name: 'مبيعات نقدية', type: 'revenue', isSystem: true, parentCode: '4010' },

            { code: '40102', name: 'مردودات المبيعات', type: 'revenue', isSystem: true, description: 'حساب مدين لتخفيض الإيراد' }, // هام للمرتجعات

            { code: '4030', name: 'إيرادات فروقات نقدية', type: 'revenue', isSystem: true, description: 'زيادة في الصندوق' }, // هام للإغلاق اليومي

            // ============================================
            // 5. المصروفات (Expenses)
            // ============================================
            { code: '5010', name: 'تكلفة البضاعة المباعة', type: 'expense', isSystem: true },

            { code: '5020', name: 'مصروفات تشغيلية', type: 'expense', isSystem: true },
            { code: '5021', name: 'رواتب وأجور', type: 'expense', isSystem: true, parentCode: '5020' }, // هام للرواتب
            { code: '5022', name: 'إيجار', type: 'expense', isSystem: true, parentCode: '5020' },
            { code: '5023', name: 'كهرباء ومياه', type: 'expense', isSystem: true, parentCode: '5020' },

            { code: '5030', name: 'عجز وخسائر نقدية', type: 'expense', isSystem: true, description: 'عجز في الصندوق' }, // هام للإغلاق اليومي
        ];

        // Fetch Parents First (map codes to IDs if needed, but schema uses recursive IDs or flat structure?
        // Schema checks: parentId is ObjectId. We need to handle this.
        // Strategy: Insert Roots first, then Children.

        // 1. Map Hierarchy
        const accountMap = {}; // code -> _id

        // Sort by code length to ensure parents created before children usually
        accounts.sort((a, b) => a.code.length - b.code.length);

        for (const acc of accounts) {
            let parentId = null;
            if (acc.parentCode) {
                if (accountMap[acc.parentCode]) {
                    parentId = accountMap[acc.parentCode];
                } else {
                    // Start looking up from DB if not in current batch map (in case of re-seed)
                    const parentDoc = await Account.findOne({ code: acc.parentCode });
                    if (parentDoc) parentId = parentDoc._id;
                }
            }

            // Create or Update
            const doc = await Account.findOneAndUpdate(
                { code: acc.code },
                {
                    $set: {
                        name: acc.name,
                        type: acc.type,
                        isSystem: acc.isSystem,
                        description: acc.description,
                        parentId: parentId
                    }
                },
                { upsert: true, new: true }
            );

            accountMap[acc.code] = doc._id;
            console.log(`✅ ${acc.code} - ${acc.name} ${parentId ? '(Child)' : ''}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✨ تم تحديث ${accounts.length} حساب بنجاح!`);
        console.log('='.repeat(50));

        process.exit(0);

    } catch (error) {
        console.error('❌ خطأ:', error.message);
        process.exit(1);
    }
};

seedArabicCOA();
