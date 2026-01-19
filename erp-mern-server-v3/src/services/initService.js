/**
 * Initialization Service
 * تشغيل تلقائي عند بدء السيرفر لضمان وجود البيانات الأساسية
 */
import Account from '../models/Account.js';
import Customer from '../models/Customer.js';
import logger from '../config/logger.js';

/**
 * الحسابات الأساسية المطلوبة للنظام
 */
const REQUIRED_ACCOUNTS = [
    // ===== الأصول (1xxx) =====
    { code: '1010', name: 'الصندوق', type: 'asset', isSystem: true },
    { code: '1020', name: 'البنك', type: 'asset', isSystem: true },
    { code: '1030', name: 'ذمم العملاء', type: 'asset', isSystem: true },
    { code: '1040', name: 'المخزون', type: 'asset', isSystem: true },
    { code: '10103', name: 'مخزون البضاعة', type: 'asset', isSystem: true },  // للمشتريات
    { code: '10105', name: 'حسابات العملاء الرقابية', type: 'asset', isSystem: true },
    { code: '11101', name: 'النقدية', type: 'asset', isSystem: true },

    // ===== الخصوم (2xxx) =====
    { code: '2010', name: 'ذمم الموردين', type: 'liability', isSystem: true },
    { code: '2020', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', isSystem: true },
    { code: '20101', name: 'حسابات الموردين الرقابية', type: 'liability', isSystem: true },  // للمشتريات

    // ===== حقوق الملكية (3xxx) =====
    { code: '3010', name: 'رأس المال', type: 'equity', isSystem: true },
    { code: '3020', name: 'الأرباح المحتجزة', type: 'equity', isSystem: true },

    // ===== الإيرادات (4xxx) =====
    { code: '4010', name: 'إيرادات المبيعات', type: 'revenue', isSystem: true },
    { code: '40102', name: 'مردودات المبيعات', type: 'revenue', isSystem: true },

    // ===== المصروفات (5xxx) =====
    { code: '5010', name: 'تكلفة البضاعة المباعة', type: 'expense', isSystem: true },
    { code: '5020', name: 'مصروفات تشغيلية', type: 'expense', isSystem: true },
];


/**
 * التحقق من وجود الحسابات الأساسية وإنشاء المفقودة
 */
export async function ensureRequiredAccounts() {
    try {
        let createdCount = 0;

        for (const account of REQUIRED_ACCOUNTS) {
            const exists = await Account.findOne({ code: account.code });

            if (!exists) {
                await Account.create(account);
                createdCount++;
                logger.info(`✅ Created account: ${account.code} - ${account.name}`);
            }
        }

        if (createdCount > 0) {
            logger.info(`📊 Auto-seeded ${createdCount} missing accounts`);
        } else {
            logger.info('✅ All required accounts exist');
        }

        return createdCount;
    } catch (error) {
        logger.error('❌ Failed to ensure required accounts:', error.message);
        throw error;
    }
}

/**
 * التحقق من وجود العميل النقدي
 */
export async function ensureCashCustomer() {
    try {
        const cashCustomer = await Customer.ensureCashCustomer();
        logger.info(`✅ Cash Customer ready: ${cashCustomer.code}`);
        return cashCustomer;
    } catch (error) {
        logger.logWarning('Cash Customer init skipped', { error: error.message });
        return null;
    }
}

/**
 * تهيئة جميع البيانات الأساسية
 */
export async function initializeSystemData() {
    logger.info('🔧 Initializing system data...');

    // 1. ضمان وجود الحسابات الأساسية
    await ensureRequiredAccounts();

    // 2. ضمان وجود العميل النقدي
    await ensureCashCustomer();

    logger.info('✅ System data initialization complete');
}

export default {
    ensureRequiredAccounts,
    ensureCashCustomer,
    initializeSystemData,
    REQUIRED_ACCOUNTS
};
