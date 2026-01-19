/**
 * 🎮 Complete ERP Seed Script
 * شركة استيراد ألعاب أطفال - ليبيا
 * 
 * تشغيل: node src/scripts/seed-full-system.js
 * 
 * يقوم هذا السكربت بإنشاء بيانات كاملة لسنة 2025
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';

// Models
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Category from '../models/Category.js';
import Item from '../models/Item.js';
import Warehouse from '../models/Warehouse.js';
import Department from '../models/Department.js';
import Employee from '../models/Employee.js';
import Account from '../models/Account.js';
import Treasury from '../models/Treasury.js';
import SalesInvoice from '../models/SalesInvoice.js';
import SalesReturn from '../models/SalesReturn.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import Receipt from '../models/Receipt.js';
import Payroll from '../models/Payroll.js';
import Loan from '../models/Loan.js';
import JournalEntry from '../models/JournalEntry.js';
import Transaction from '../models/Transaction.js';
import StockLedger from '../models/StockLedger.js';
import Counter from '../models/Counter.js';
import CompanySettings from '../models/CompanySettings.js';
import bcrypt from 'bcryptjs';

// ============================================================
// CONFIGURATION
// ============================================================
const START_DATE = new Date('2025-01-01');
const END_DATE = new Date('2025-12-31');
const CURRENCY = 'LYD';

// Seasonal multipliers for daily transactions
const SEASONAL_MULTIPLIERS = {
    1: 1.0,   // يناير - عادي
    2: 1.0,   // فبراير - عادي
    3: 1.3,   // مارس - رمضان
    4: 2.0,   // أبريل - عيد الفطر 🎉
    5: 1.1,   // مايو
    6: 1.3,   // يونيو - إجازة صيف
    7: 1.4,   // يوليو - إجازة صيف
    8: 1.3,   // أغسطس - إجازة صيف
    9: 1.0,   // سبتمبر - بداية مدارس
    10: 1.1,  // أكتوبر
    11: 1.8,  // نوفمبر - يوم الطفل العالمي 🧒
    12: 1.3   // ديسمبر - نهاية السنة
};

// ============================================================
// DATA DEFINITIONS
// ============================================================

const WAREHOUSES = [
    { code: 'WH-MAIN', name: 'المستودع الرئيسي - طرابلس' },
    { code: 'WH-TRP', name: 'مستودع فرع طرابلس' },
    { code: 'WH-BNG', name: 'مستودع بنغازي' },
    { code: 'WH-MSR', name: 'مستودع مصراتة' },
    { code: 'WH-SBH', name: 'مستودع سبها' }
];

const DEPARTMENTS = [
    { name: 'الإدارة العامة', description: 'إدارة الشركة والتخطيط' },
    { name: 'المبيعات', description: 'قسم المبيعات وخدمة العملاء' },
    { name: 'المستودعات', description: 'إدارة المخزون والتوزيع' },
    { name: 'المحاسبة', description: 'الشؤون المالية والحسابات' }
];

const TREASURIES = [
    { code: 'SAFE-01', name: 'الخزينة الرئيسية', type: 'safe', balance: 50000 },
    { code: 'BANK-01', name: 'بنك الجمهورية', type: 'bank', balance: 200000 },
    { code: 'BANK-02', name: 'بنك الوحدة', type: 'bank', balance: 100000 },
    { code: 'SAFE-02', name: 'خزينة فرع بنغازي', type: 'safe', balance: 25000 },
    { code: 'SAFE-03', name: 'خزينة فرع مصراتة', type: 'safe', balance: 15000 }
];

// 120 Categories for Toys
const CATEGORIES = [
    // دمى وشخصيات (20)
    'دمى بنات', 'دمى أطفال', 'شخصيات كرتونية', 'شخصيات أبطال خارقين', 'دمى باربي',
    'شخصيات ديزني', 'شخصيات مارفل', 'شخصيات أنمي', 'دمى قماشية', 'دمى تفاعلية',
    'شخصيات حيوانات', 'دمى رضع', 'شخصيات روبوتات', 'دمى أميرات', 'شخصيات سبايدرمان',
    'شخصيات باتمان', 'دمى إلسا', 'شخصيات ماينكرافت', 'شخصيات فورتنايت', 'دمى LOL',

    // سيارات ومركبات (15)
    'سيارات صغيرة', 'سيارات ريموت كنترول', 'شاحنات', 'طائرات', 'قطارات',
    'سيارات هوت ويلز', 'سيارات سباق', 'دراجات أطفال', 'سكوترات', 'موتوسيكلات',
    'سيارات كهربائية للركوب', 'مركبات بناء', 'سيارات إطفاء', 'سيارات شرطة', 'سيارات إسعاف',

    // ألعاب تعليمية (20)
    'بازل', 'مكعبات بناء', 'ألعاب ذكاء', 'ألعاب رياضيات', 'ألعاب لغات',
    'ألعاب علوم', 'تجارب علمية', 'ألعاب برمجة', 'روبوتات تعليمية', 'ألعاب ذاكرة',
    'ألعاب منطق', 'ألعاب حروف', 'ألعاب أرقام', 'ألعاب أشكال', 'ألعاب ألوان',
    'خرائط تعليمية', 'كتب تفاعلية', 'أقلام ذكية', 'سبورات أطفال', 'ألعاب مونتيسوري',

    // ألعاب إلكترونية (15)
    'ألعاب فيديو', 'أجهزة ألعاب محمولة', 'سماعات أطفال', 'تابلت أطفال', 'ساعات ذكية أطفال',
    'كاميرات أطفال', 'ميكروفونات أطفال', 'بيانو إلكتروني', 'جيتار إلكتروني', 'درامز إلكترونية',
    'روبوتات ذكية', 'درونز أطفال', 'نظارات VR أطفال', 'أجهزة كاريوكي', 'مشغلات MP3 أطفال',

    // ألعاب خارجية (15)
    'كرات قدم', 'كرات سلة', 'مضارب تنس', 'زلاجات', 'حبال قفز',
    'طائرات ورقية', 'بالونات', 'فقاعات صابون', 'ألعاب ماء', 'مسابح أطفال',
    'زحاليق', 'أراجيح', 'خيم أطفال', 'ألعاب رمل', 'ألعاب حديقة',

    // ألعاب بناء وتركيب (15)
    'ليجو كلاسيك', 'ليجو تكنيك', 'ليجو سيتي', 'ليجو فريندز', 'ليجو ستار وورز',
    'مكعبات خشبية', 'مغناطيس بناء', 'ألعاب تركيب', 'نماذج طائرات', 'نماذج سيارات',
    'نماذج سفن', 'قطع تركيب 3D', 'ألعاب هندسة', 'برج هانوي', 'ألعاب توازن',

    // ألعاب فنية (10)
    'ألوان مائية', 'ألوان زيتية', 'صلصال', 'عجينة', 'رسم بالرمل',
    'طباعة', 'كولاج', 'أعمال يدوية', 'خرز', 'حياكة أطفال',

    // ألعاب اجتماعية (10)
    'مونوبولي', 'أونو', 'شطرنج', 'ألعاب ورق', 'ألعاب طاولة',
    'ألعاب عائلية', 'ألعاب حفلات', 'ألعاب تمثيل', 'ألعاب تخمين', 'ألعاب سباق'
];

const SUPPLIERS = [
    { code: 'SUP-001', name: 'شركة تشينا تويز', company: 'China Toys Co.', phone: '0912345678' },
    { code: 'SUP-002', name: 'مصنع إسطنبول للألعاب', company: 'Istanbul Toys Factory', phone: '0923456789' },
    { code: 'SUP-003', name: 'دبي تويز إمبورت', company: 'Dubai Toys Import', phone: '0934567890' },
    { code: 'SUP-004', name: 'مصنع شنغهاي', company: 'Shanghai Manufacturing', phone: '0945678901' },
    { code: 'SUP-005', name: 'تركيا للألعاب التعليمية', company: 'Turkey Educational Toys', phone: '0956789012' },
    { code: 'SUP-006', name: 'هونغ كونغ تويز', company: 'Hong Kong Toys Ltd', phone: '0967890123' },
    { code: 'SUP-007', name: 'مصنع قوانزو', company: 'Guangzhou Factory', phone: '0978901234' },
    { code: 'SUP-008', name: 'الإمارات للتوزيع', company: 'UAE Distribution', phone: '0989012345' },
    { code: 'SUP-009', name: 'مصر للألعاب', company: 'Egypt Toys', phone: '0990123456' },
    { code: 'SUP-010', name: 'تونس تويز', company: 'Tunisia Toys', phone: '0901234567' }
];

const CUSTOMERS_RETAIL = [
    { code: 'CUS-001', name: 'أحمد محمد الفيتوري', phone: '0911111111', type: 'retail', creditLimit: 1000 },
    { code: 'CUS-002', name: 'فاطمة علي السنوسي', phone: '0922222222', type: 'retail', creditLimit: 500 },
    { code: 'CUS-003', name: 'محمد صالح المقريف', phone: '0933333333', type: 'retail', creditLimit: 1500 },
    { code: 'CUS-004', name: 'عائشة أحمد الورفلي', phone: '0944444444', type: 'retail', creditLimit: 800 },
    { code: 'CUS-005', name: 'خالد عمر الكيلاني', phone: '0955555555', type: 'retail', creditLimit: 2000 },
    { code: 'CUS-006', name: 'سارة محمود الزوي', phone: '0966666666', type: 'retail', creditLimit: 600 },
    { code: 'CUS-007', name: 'يوسف إبراهيم الطرابلسي', phone: '0977777777', type: 'retail', creditLimit: 1200 },
    { code: 'CUS-008', name: 'مريم عبدالله البنغازي', phone: '0988888888', type: 'retail', creditLimit: 900 },
    { code: 'CUS-009', name: 'علي حسن المصراتي', phone: '0999999999', type: 'retail', creditLimit: 1100 },
    { code: 'CUS-010', name: 'نورة سالم الزنتاني', phone: '0910101010', type: 'retail', creditLimit: 700 },
    { code: 'CUS-011', name: 'عمر محمد الغرياني', phone: '0920202020', type: 'retail', creditLimit: 1300 },
    { code: 'CUS-012', name: 'هدى علي السبراتي', phone: '0930303030', type: 'retail', creditLimit: 400 },
    { code: 'CUS-013', name: 'عبدالرحمن أحمد', phone: '0940404040', type: 'retail', creditLimit: 1000 },
    { code: 'CUS-014', name: 'أمينة محمد الحاسي', phone: '0950505050', type: 'retail', creditLimit: 550 },
    { code: 'CUS-015', name: 'سليمان عمر الجبالي', phone: '0960606060', type: 'retail', creditLimit: 850 }
];

const CUSTOMERS_WHOLESALE = [
    { code: 'CUS-W01', name: 'مكتبة الأمل للألعاب', phone: '0917171717', type: 'wholesale', creditLimit: 50000 },
    { code: 'CUS-W02', name: 'مركز الطفولة السعيدة', phone: '0927272727', type: 'wholesale', creditLimit: 75000 },
    { code: 'CUS-W03', name: 'محلات النجوم للألعاب', phone: '0937373737', type: 'wholesale', creditLimit: 60000 },
    { code: 'CUS-W04', name: 'سوبر ماركت العائلة', phone: '0947474747', type: 'wholesale', creditLimit: 40000 },
    { code: 'CUS-W05', name: 'مجمع الأطفال التجاري', phone: '0957575757', type: 'wholesale', creditLimit: 100000 }
];

const EMPLOYEES = [
    { name: 'أحمد محمد العلوي', position: 'مدير عام', phone: '0918181818', baseSalary: 5000, housing: 500, transport: 300 },
    { name: 'فاطمة علي الشريف', position: 'مديرة مبيعات', phone: '0928282828', baseSalary: 3500, housing: 400, transport: 250 },
    { name: 'محمد صالح البرعصي', position: 'محاسب رئيسي', phone: '0938383838', baseSalary: 2500, housing: 300, transport: 200 },
    { name: 'عائشة أحمد المنفي', position: 'كاشير', phone: '0948484848', baseSalary: 1500, housing: 200, transport: 150 },
    { name: 'خالد عمر الحداد', position: 'كاشير', phone: '0958585858', baseSalary: 1500, housing: 200, transport: 150 },
    { name: 'سارة محمود النعاس', position: 'كاشير', phone: '0968686868', baseSalary: 1500, housing: 200, transport: 150 },
    { name: 'يوسف إبراهيم الكوافي', position: 'أمين مستودع', phone: '0978787878', baseSalary: 1800, housing: 250, transport: 180 },
    { name: 'مريم عبدالله الصيد', position: 'أمينة مستودع', phone: '0988989898', baseSalary: 1800, housing: 250, transport: 180 },
    { name: 'علي حسن السويحلي', position: 'سائق توصيل', phone: '0990909090', baseSalary: 1600, housing: 200, transport: 250 },
    { name: 'نورة سالم الدرسي', position: 'موظفة استقبال', phone: '0911010101', baseSalary: 1400, housing: 180, transport: 120 }
];

// Chart of Accounts
const ACCOUNTS = [
    // Assets - الأصول
    { code: '1000', name: 'الأصول', type: 'asset', parentCode: null },
    { code: '1100', name: 'الأصول المتداولة', type: 'asset', parentCode: '1000' },
    { code: '1110', name: 'النقدية والبنوك', type: 'asset', parentCode: '1100' },
    { code: '1111', name: 'الخزينة الرئيسية', type: 'asset', parentCode: '1110' },
    { code: '1112', name: 'بنك الجمهورية', type: 'asset', parentCode: '1110' },
    { code: '1113', name: 'بنك الوحدة', type: 'asset', parentCode: '1110' },
    { code: '1120', name: 'العملاء', type: 'asset', parentCode: '1100' },
    { code: '1130', name: 'المخزون', type: 'asset', parentCode: '1100' },

    // Liabilities - الخصوم
    { code: '2000', name: 'الخصوم', type: 'liability', parentCode: null },
    { code: '2100', name: 'الخصوم المتداولة', type: 'liability', parentCode: '2000' },
    { code: '2110', name: 'الموردين', type: 'liability', parentCode: '2100' },
    { code: '2120', name: 'الرواتب المستحقة', type: 'liability', parentCode: '2100' },

    // Equity - حقوق الملكية
    { code: '3000', name: 'حقوق الملكية', type: 'equity', parentCode: null },
    { code: '3100', name: 'رأس المال', type: 'equity', parentCode: '3000' },
    { code: '3200', name: 'الأرباح المحتجزة', type: 'equity', parentCode: '3000' },

    // Revenue - الإيرادات
    { code: '4000', name: 'الإيرادات', type: 'revenue', parentCode: null },
    { code: '4100', name: 'المبيعات', type: 'revenue', parentCode: '4000' },
    { code: '4110', name: 'مبيعات تجزئة', type: 'revenue', parentCode: '4100' },
    { code: '4120', name: 'مبيعات جملة', type: 'revenue', parentCode: '4100' },
    { code: '4200', name: 'إيرادات أخرى', type: 'revenue', parentCode: '4000' },

    // Expenses - المصروفات
    { code: '5000', name: 'المصروفات', type: 'expense', parentCode: null },
    { code: '5100', name: 'تكلفة المبيعات', type: 'expense', parentCode: '5000' },
    { code: '5200', name: 'الرواتب والأجور', type: 'expense', parentCode: '5000' },
    { code: '5300', name: 'الإيجارات', type: 'expense', parentCode: '5000' },
    { code: '5400', name: 'المصاريف الإدارية', type: 'expense', parentCode: '5000' },
    { code: '5500', name: 'مصاريف النقل', type: 'expense', parentCode: '5000' }
];

// Items Generator based on categories
function generateItems(categories, categoryMap) {
    const items = [];
    let itemNumber = 1;

    const itemTemplates = {
        'دمى بنات': ['دمية باربي', 'دمية أميرة', 'دمية عروس', 'دمية طفلة'],
        'سيارات صغيرة': ['سيارة سباق', 'سيارة jeep', 'سيارة كلاسيكية', 'سيارة رياضية'],
        'ألعاب تعليمية': ['لعبة حروف', 'لعبة أرقام', 'لعبة ألوان', 'لعبة أشكال'],
        'مكعبات بناء': ['مكعبات 50 قطعة', 'مكعبات 100 قطعة', 'مكعبات 200 قطعة'],
        'كرات قدم': ['كرة قدم صغيرة', 'كرة قدم متوسطة', 'كرة قدم كبيرة'],
    };

    categories.forEach(catName => {
        const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items per category

        for (let i = 0; i < numItems; i++) {
            const basePrice = Math.floor(Math.random() * 450) + 10; // 10-460 LYD
            const cost = Math.floor(basePrice * (0.5 + Math.random() * 0.25)); // 50-75% of price

            items.push({
                sku: `TOY-${String(itemNumber).padStart(4, '0')}`,
                name: `${catName} - نموذج ${i + 1}`,
                category: categoryMap[catName],
                barcode: `62800${String(itemNumber).padStart(8, '0')}`,
                brand: ['تشينا', 'تركي', 'إماراتي', 'محلي'][Math.floor(Math.random() * 4)],
                unit: 'pcs',
                cost: cost,
                price: basePrice,
                wholesalePrice: Math.floor(basePrice * 0.85),
                minStock: 5
            });
            itemNumber++;
        }
    });

    return items;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatMonth(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ============================================================
// MAIN SEEDING FUNCTIONS
// ============================================================

async function clearDatabase() {
    console.log('🗑️  Clearing database...');

    await Promise.all([
        User.deleteMany({}),
        Customer.deleteMany({}),
        Supplier.deleteMany({}),
        Category.deleteMany({}),
        Item.deleteMany({}),
        Warehouse.deleteMany({}),
        Department.deleteMany({}),
        Employee.deleteMany({}),
        Account.deleteMany({}),
        Treasury.deleteMany({}),
        SalesInvoice.deleteMany({}),
        SalesReturn.deleteMany({}),
        PurchaseOrder.deleteMany({}),
        PurchaseReturn.deleteMany({}),
        Receipt.deleteMany({}),
        Payroll.deleteMany({}),
        Loan.deleteMany({}),
        JournalEntry.deleteMany({}),
        Transaction.deleteMany({}),
        StockLedger.deleteMany({}),
        Counter.deleteMany({})
    ]);

    console.log('✅ Database cleared');
}

async function seedMasterData() {
    console.log('\n📦 Seeding Master Data...');

    // Company Settings
    await CompanySettings.findOneAndUpdate({}, {
        name: 'شركة ليبيا تويز لاستيراد الألعاب',
        address: 'طرابلس - شارع الجمهورية',
        phone: '021-1234567',
        email: 'info@libyatoys.ly',
        taxNumber: 'LY123456789',
        currency: CURRENCY
    }, { upsert: true });

    // Warehouses
    const warehouses = await Warehouse.insertMany(WAREHOUSES);
    console.log(`   ✅ ${warehouses.length} warehouses created`);

    // Departments
    const departments = await Department.insertMany(DEPARTMENTS);
    console.log(`   ✅ ${departments.length} departments created`);

    // Categories
    const categories = await Category.insertMany(
        CATEGORIES.map(name => ({ name, description: `تصنيف ${name}` }))
    );
    const categoryMap = {};
    categories.forEach(cat => categoryMap[cat.name] = cat._id);
    console.log(`   ✅ ${categories.length} categories created`);

    // Suppliers
    const suppliers = await Supplier.insertMany(SUPPLIERS);
    console.log(`   ✅ ${suppliers.length} suppliers created`);

    // Customers
    const customers = await Customer.insertMany([...CUSTOMERS_RETAIL, ...CUSTOMERS_WHOLESALE]);
    // Ensure Cash Customer exists
    await Customer.ensureCashCustomer();
    console.log(`   ✅ ${customers.length + 1} customers created (including cash customer)`);

    // Items
    const itemsData = generateItems(CATEGORIES, categoryMap);
    const itemsWithStocks = itemsData.map(item => ({
        ...item,
        stocks: warehouses.map(wh => ({
            warehouse: wh._id,
            qty: randomInt(20, 100)
        })),
        totalStock: 0
    }));

    // Calculate totalStock
    itemsWithStocks.forEach(item => {
        item.totalStock = item.stocks.reduce((sum, s) => sum + s.qty, 0);
        item.stock = item.totalStock;
    });

    const items = await Item.insertMany(itemsWithStocks);
    console.log(`   ✅ ${items.length} items created`);

    // Create initial Stock Ledger entries
    const stockEntries = [];
    for (const item of items) {
        for (const stock of item.stocks) {
            stockEntries.push({
                item: item._id,
                warehouse: stock.warehouse,
                type: 'IN',
                qty: stock.qty,
                ref: 'OPENING-2025',
                note: 'رصيد افتتاحي 2025'
            });
        }
    }
    await StockLedger.insertMany(stockEntries);
    console.log(`   ✅ ${stockEntries.length} stock ledger entries created`);

    return { warehouses, departments, categories, categoryMap, suppliers, customers, items };
}

async function seedAccounts() {
    console.log('\n💰 Seeding Chart of Accounts...');

    // First pass: create all accounts
    const accountMap = {};
    for (const acc of ACCOUNTS) {
        const account = await Account.create({
            code: acc.code,
            name: acc.name,
            type: acc.type,
            balance: 0
        });
        accountMap[acc.code] = account._id;
    }

    // Second pass: set parent relationships
    for (const acc of ACCOUNTS) {
        if (acc.parentCode) {
            await Account.findByIdAndUpdate(accountMap[acc.code], {
                parentId: accountMap[acc.parentCode]
            });
        }
    }

    console.log(`   ✅ ${ACCOUNTS.length} accounts created`);
    return accountMap;
}

async function seedTreasuries(accountMap) {
    console.log('\n🏦 Seeding Treasuries...');

    const treasuryAccountMap = {
        'SAFE-01': '1111',
        'BANK-01': '1112',
        'BANK-02': '1113',
        'SAFE-02': '1111',
        'SAFE-03': '1111'
    };

    const treasuries = await Treasury.insertMany(
        TREASURIES.map(t => ({
            ...t,
            accountId: accountMap[treasuryAccountMap[t.code]] || null
        }))
    );

    console.log(`   ✅ ${treasuries.length} treasuries created`);
    return treasuries;
}

async function seedEmployees(departments) {
    console.log('\n👥 Seeding Employees...');

    const deptMap = {
        'مدير عام': 'الإدارة العامة',
        'مديرة مبيعات': 'المبيعات',
        'محاسب رئيسي': 'المحاسبة',
        'كاشير': 'المبيعات',
        'أمين مستودع': 'المستودعات',
        'أمينة مستودع': 'المستودعات',
        'سائق توصيل': 'المستودعات',
        'موظفة استقبال': 'الإدارة العامة'
    };

    const deptIdMap = {};
    departments.forEach(d => deptIdMap[d.name] = d._id);

    const employees = await Employee.insertMany(
        EMPLOYEES.map(emp => ({
            name: emp.name,
            position: emp.position,
            phone: emp.phone,
            isActive: true,
            joinDate: new Date('2024-01-01'),
            salaryDetails: {
                baseSalary: emp.baseSalary,
                housingAllowance: emp.housing,
                transportAllowance: emp.transport,
                dailyRate: Math.floor(emp.baseSalary / 26)
            }
        }))
    );

    console.log(`   ✅ ${employees.length} employees created`);
    return employees;
}

async function seedUsers(departments, warehouses) {
    console.log('\n🔐 Seeding Users...');

    const hashedPassword = await bcrypt.hash('123456', 10);

    const users = await User.insertMany([
        {
            username: 'admin',
            name: 'مدير النظام',
            email: 'admin@libyatoys.ly',
            password: hashedPassword,
            role: 'admin',
            isActive: true,
            department: departments.find(d => d.name === 'الإدارة العامة')?._id,
            assignedWarehouse: warehouses[0]._id
        },
        {
            username: 'manager',
            name: 'مدير المبيعات',
            email: 'manager@libyatoys.ly',
            password: hashedPassword,
            role: 'manager',
            isActive: true,
            department: departments.find(d => d.name === 'المبيعات')?._id,
            assignedWarehouse: warehouses[0]._id
        },
        {
            username: 'cashier1',
            name: 'كاشير 1',
            email: 'cashier1@libyatoys.ly',
            password: hashedPassword,
            role: 'cashier',
            isActive: true,
            department: departments.find(d => d.name === 'المبيعات')?._id,
            assignedWarehouse: warehouses[0]._id
        },
        {
            username: 'cashier2',
            name: 'كاشير 2',
            email: 'cashier2@libyatoys.ly',
            password: hashedPassword,
            role: 'cashier',
            isActive: true,
            department: departments.find(d => d.name === 'المبيعات')?._id,
            assignedWarehouse: warehouses[1]._id
        },
        {
            username: 'cashier3',
            name: 'كاشير 3',
            email: 'cashier3@libyatoys.ly',
            password: hashedPassword,
            role: 'cashier',
            isActive: true,
            department: departments.find(d => d.name === 'المبيعات')?._id,
            assignedWarehouse: warehouses[2]._id
        }
    ]);

    console.log(`   ✅ ${users.length} users created`);
    return users;
}

async function seedTransactions(data) {
    console.log('\n📊 Seeding Transactions for Year 2025...');

    const { warehouses, customers, items, treasuries, users, suppliers } = data;
    const cashCustomer = await Customer.getCashCustomer();

    let invoiceCount = 0;
    let receiptCount = 0;
    let purchaseCount = 0;
    let returnCount = 0;
    let invoiceNumber = 1;

    // Iterate through each day of 2025
    let currentDate = new Date(START_DATE);

    while (currentDate <= END_DATE) {
        const month = currentDate.getMonth() + 1;
        const dayOfWeek = currentDate.getDay();

        // Skip Fridays (weekend in Libya)
        if (dayOfWeek !== 5) {
            const multiplier = SEASONAL_MULTIPLIERS[month];
            const baseTransactions = randomInt(5, 15);
            const dailyTransactions = Math.floor(baseTransactions * multiplier);

            // Create Sales Invoices for the day
            for (let i = 0; i < dailyTransactions; i++) {
                const isWholesale = Math.random() < 0.2; // 20% wholesale
                const customer = isWholesale
                    ? randomElement(customers.filter(c => c.type === 'wholesale'))
                    : (Math.random() < 0.4 ? cashCustomer : randomElement(customers.filter(c => c.type === 'retail')));

                const warehouse = randomElement(warehouses);
                const treasury = randomElement(treasuries);
                const cashier = randomElement(users.filter(u => u.role === 'cashier'));

                // Generate random items (1-5 items per invoice)
                const numItems = randomInt(1, 5);
                const invoiceItems = [];
                let subtotal = 0;

                for (let j = 0; j < numItems; j++) {
                    const item = randomElement(items);
                    const qty = randomInt(1, 5);
                    const price = isWholesale ? item.wholesalePrice : item.price;

                    invoiceItems.push({
                        item: item._id,
                        qty,
                        price,
                        cost: item.cost
                    });
                    subtotal += qty * price;
                }

                const isCash = Math.random() < 0.6; // 60% cash
                const paid = isCash ? subtotal : (Math.random() < 0.5 ? subtotal : subtotal * 0.5);

                const invoice = await SalesInvoice.create({
                    number: `INV-${String(invoiceNumber++).padStart(6, '0')}`,
                    date: new Date(currentDate),
                    customer: customer._id,
                    cashier: cashier._id,
                    channel: isWholesale ? 'wholesale' : 'retail',
                    type: isWholesale ? 'wholesale' : 'retail',
                    items: invoiceItems,
                    warehouse: warehouse._id,
                    treasury: treasury._id,
                    paymentMethod: isCash ? 'cash' : 'credit',
                    status: 'confirmed',
                    totals: {
                        subtotal,
                        tax: 0,
                        discount: 0,
                        paid,
                        remaining: subtotal - paid,
                        grand: subtotal
                    }
                });

                invoiceCount++;

                // Decrease stock
                for (const invItem of invoiceItems) {
                    await Item.updateOne(
                        { _id: invItem.item, 'stocks.warehouse': warehouse._id },
                        { $inc: { 'stocks.$.qty': -invItem.qty, totalStock: -invItem.qty, stock: -invItem.qty } }
                    );

                    await StockLedger.create({
                        item: invItem.item,
                        warehouse: warehouse._id,
                        type: 'SALE',
                        qty: -invItem.qty,
                        ref: invoice.number,
                        note: `مبيعات - فاتورة ${invoice.number}`
                    });
                }

                // Create transaction for treasury
                if (paid > 0) {
                    await Transaction.create({
                        type: 'income',
                        flow: 'in',
                        category: 'sales',
                        amount: paid,
                        treasury: treasury._id,
                        relatedId: invoice._id,
                        relatedModel: 'SalesInvoice',
                        description: `تحصيل فاتورة ${invoice.number}`,
                        date: currentDate
                    });

                    await Treasury.updateOne({ _id: treasury._id }, { $inc: { balance: paid } });
                }
            }

            // Create Purchase Orders (2-4 per week on Sundays)
            if (dayOfWeek === 0 && Math.random() < 0.8) {
                const numPOs = randomInt(2, 4);
                for (let p = 0; p < numPOs; p++) {
                    const supplier = randomElement(suppliers);
                    const warehouse = randomElement(warehouses);
                    const numItems = randomInt(5, 15);
                    const poItems = [];
                    let totalAmount = 0;

                    for (let j = 0; j < numItems; j++) {
                        const item = randomElement(items);
                        const qty = randomInt(10, 50);
                        const cost = item.cost;
                        poItems.push({ item: item._id, qty, cost });
                        totalAmount += qty * cost;
                    }

                    const po = await PurchaseOrder.create({
                        supplier: supplier._id,
                        items: poItems,
                        warehouse: warehouse._id,
                        status: 'received',
                        totalAmount,
                        paidAmount: totalAmount,
                        receivedAt: addDays(currentDate, randomInt(3, 7))
                    });

                    purchaseCount++;

                    // Increase stock
                    for (const poItem of poItems) {
                        await Item.updateOne(
                            { _id: poItem.item, 'stocks.warehouse': warehouse._id },
                            { $inc: { 'stocks.$.qty': poItem.qty, totalStock: poItem.qty, stock: poItem.qty } }
                        );

                        await StockLedger.create({
                            item: poItem.item,
                            warehouse: warehouse._id,
                            type: 'PURCHASE',
                            qty: poItem.qty,
                            ref: `PO-${po._id.toString().slice(-6)}`,
                            note: 'استلام بضاعة'
                        });
                    }
                }
            }

            // Create some receipts for credit invoices
            if (Math.random() < 0.3) {
                const creditInvoices = await SalesInvoice.find({
                    'totals.remaining': { $gt: 0 },
                    date: { $lt: currentDate }
                }).limit(5);

                for (const inv of creditInvoices) {
                    if (Math.random() < 0.4) {
                        const payAmount = Math.min(inv.totals.remaining, randomInt(100, 500));
                        const treasury = randomElement(treasuries);

                        await Receipt.create({
                            customer: inv.customer,
                            date: currentDate,
                            amount: payAmount,
                            method: 'cash',
                            invoices: [inv._id],
                            allocations: [{ invoice: inv._id, amount: payAmount }]
                        });

                        await SalesInvoice.updateOne(
                            { _id: inv._id },
                            { $inc: { 'totals.paid': payAmount, 'totals.remaining': -payAmount } }
                        );

                        await Treasury.updateOne({ _id: treasury._id }, { $inc: { balance: payAmount } });

                        receiptCount++;
                    }
                }
            }
        }

        // Move to next day
        currentDate = addDays(currentDate, 1);

        // Log progress every month
        if (currentDate.getDate() === 1) {
            console.log(`   📅 Processed ${formatMonth(addDays(currentDate, -1))} - ${invoiceCount} invoices so far`);
        }
    }

    console.log(`   ✅ ${invoiceCount} sales invoices created`);
    console.log(`   ✅ ${purchaseCount} purchase orders created`);
    console.log(`   ✅ ${receiptCount} receipts created`);
}

async function seedPayroll(employees) {
    console.log('\n💵 Seeding Payroll for 2025...');

    let payrollCount = 0;
    let loanCount = 0;

    for (let month = 1; month <= 12; month++) {
        const monthStr = `2025-${String(month).padStart(2, '0')}`;

        for (const emp of employees) {
            const absenceDays = randomInt(0, 2);
            const dailyRate = emp.salaryDetails.dailyRate || Math.floor(emp.salaryDetails.baseSalary / 26);
            const absenceAmount = absenceDays * dailyRate;
            const loanDeduction = Math.random() < 0.1 ? randomInt(100, 300) : 0;

            const grossSalary = emp.salaryDetails.baseSalary +
                emp.salaryDetails.housingAllowance +
                emp.salaryDetails.transportAllowance;
            const totalDeductions = absenceAmount + loanDeduction;
            const netSalary = grossSalary - totalDeductions;

            await Payroll.create({
                employee: emp._id,
                month: monthStr,
                basics: {
                    baseSalary: emp.salaryDetails.baseSalary,
                    housingAllowance: emp.salaryDetails.housingAllowance,
                    transportAllowance: emp.salaryDetails.transportAllowance
                },
                deductions: {
                    absenceDays,
                    absenceAmount,
                    loans: loanDeduction,
                    tax: 0
                },
                totals: {
                    grossSalary,
                    totalDeductions,
                    netSalary
                },
                status: 'PAID',
                paymentDate: new Date(`2025-${String(month).padStart(2, '0')}-28`)
            });

            payrollCount++;

            // Random loans
            if (Math.random() < 0.05 && month < 12) {
                await Loan.create({
                    employee: emp._id,
                    amount: randomInt(200, 1000),
                    requestDate: new Date(`2025-${String(month).padStart(2, '0')}-15`),
                    repaymentMonth: `2025-${String(month + 1).padStart(2, '0')}`,
                    status: 'DEDUCTED',
                    approvalDate: new Date(`2025-${String(month).padStart(2, '0')}-16`)
                });
                loanCount++;
            }
        }
    }

    console.log(`   ✅ ${payrollCount} payroll records created`);
    console.log(`   ✅ ${loanCount} loans created`);
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
    console.log('🎮 ========================================');
    console.log('   Libya Toys ERP - Full System Seed');
    console.log('   شركة ليبيا تويز لاستيراد الألعاب');
    console.log('========================================\n');

    try {
        await connectDB();
        console.log('✅ Connected to MongoDB\n');

        await clearDatabase();

        const masterData = await seedMasterData();
        const accountMap = await seedAccounts();
        const treasuries = await seedTreasuries(accountMap);
        const employees = await seedEmployees(masterData.departments);
        const users = await seedUsers(masterData.departments, masterData.warehouses);

        await seedTransactions({
            ...masterData,
            treasuries,
            users
        });

        await seedPayroll(employees);

        // Final Statistics
        console.log('\n========================================');
        console.log('📊 SEED COMPLETE - Final Statistics:');
        console.log('========================================');
        console.log(`   Warehouses:     ${await Warehouse.countDocuments()}`);
        console.log(`   Categories:     ${await Category.countDocuments()}`);
        console.log(`   Items:          ${await Item.countDocuments()}`);
        console.log(`   Customers:      ${await Customer.countDocuments()}`);
        console.log(`   Suppliers:      ${await Supplier.countDocuments()}`);
        console.log(`   Employees:      ${await Employee.countDocuments()}`);
        console.log(`   Users:          ${await User.countDocuments()}`);
        console.log(`   Treasuries:     ${await Treasury.countDocuments()}`);
        console.log(`   Accounts:       ${await Account.countDocuments()}`);
        console.log(`   Sales Invoices: ${await SalesInvoice.countDocuments()}`);
        console.log(`   Purchase Orders:${await PurchaseOrder.countDocuments()}`);
        console.log(`   Receipts:       ${await Receipt.countDocuments()}`);
        console.log(`   Payroll:        ${await Payroll.countDocuments()}`);
        console.log(`   Stock Ledger:   ${await StockLedger.countDocuments()}`);
        console.log('========================================\n');

        console.log('🎉 Seed completed successfully!');
        console.log('👤 Login credentials:');
        console.log('   Admin: admin@libyatoys.ly / 123456');
        console.log('   Manager: manager@libyatoys.ly / 123456');
        console.log('   Cashier: cashier1@libyatoys.ly / 123456\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

main();
