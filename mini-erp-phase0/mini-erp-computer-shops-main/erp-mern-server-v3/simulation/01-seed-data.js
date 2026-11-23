// ========================================
// 🌱 ERP System - 30-Day Full Simulation
// Seed Data Generator
// ========================================

const axios = require('axios');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const TOKEN = process.env.API_TOKEN || ''; // Will be set after login

// Helper function to make API calls
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Set token after login
function setToken(token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// ========================================
// Master Data
// ========================================

const MASTER_DATA = {
    // Chart of Accounts (Simplified)
    accounts: [
        { code: '1-1-001', name: 'الخزينة الرئيسية', type: 'asset', parent: null },
        { code: '1-1-002', name: 'البنك - الراجحي', type: 'asset', parent: null },
        { code: '1-2-001', name: 'المخزون - بضاعة', type: 'asset', parent: null },
        { code: '1-3-001', name: 'عملاء', type: 'asset', parent: null },
        { code: '2-1-001', name: 'موردون', type: 'liability', parent: null },
        { code: '2-2-001', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', parent: null },
        { code: '3-1-001', name: 'رأس المال', type: 'equity', parent: null },
        { code: '4-1-001', name: 'مبيعات', type: 'revenue', parent: null },
        { code: '5-1-001', name: 'تكلفة البضاعة المباعة', type: 'expense', parent: null },
        { code: '5-2-001', name: 'مصاريف الرواتب', type: 'expense', parent: null },
        { code: '5-2-002', name: 'مصاريف الإيجار', type: 'expense', parent: null },
        { code: '5-2-003', name: 'مصاريف الكهرباء والماء', type: 'expense', parent: null },
    ],

    // Warehouses
    warehouses: [
        { code: 'WH-001', name: 'المستودع الرئيسي', location: 'الرياض - حي الملز', isDefault: true },
        { code: 'WH-002', name: 'مستودع الفرع الشمالي', location: 'الرياض - حي النرجس', isDefault: false },
        { code: 'WH-003', name: 'مستودع جدة', location: 'جدة - حي الروضة', isDefault: false },
    ],

    // Suppliers
    suppliers: [
        { code: 'SUP-001', name: 'شركة التجارة العالمية', type: 'wholesale', phone: '0501234567', email: 'sales@trade.com' },
        { code: 'SUP-002', name: 'مؤسسة القمة للتوريدات', type: 'wholesale', phone: '0507654321', email: 'info@alqimma.com' },
        { code: 'SUP-003', name: 'شركة النجاح التجارية', type: 'wholesale', phone: '0509876543', email: 'orders@success.com' },
        { code: 'SUP-004', name: 'مصنع الجودة المحدودة', type: 'manufacturer', phone: '0112345678', email: 'factory@quality.com' },
    ],

    // Customers
    customers: [
        // Wholesale Customers
        { code: 'CUST-001', name: 'محلات الفخامة', type: 'wholesale', phone: '0501111111', creditLimit: 50000 },
        { code: 'CUST-002', name: 'سوبر ماركت النور', type: 'wholesale', phone: '0502222222', creditLimit: 30000 },
        { code: 'CUST-003', name: 'مجمع السلام التجاري', type: 'wholesale', phone: '0503333333', creditLimit: 75000 },
        { code: 'CUST-004', name: 'شركة التوزيع الوطنية', type: 'wholesale', phone: '0504444444', creditLimit: 100000 },
        { code: 'CUST-005', name: 'مؤسسة البركة', type: 'wholesale', phone: '0505555555', creditLimit: 40000 },

        // Retail Customers
        { code: 'CUST-006', name: 'أحمد محمد العلي', type: 'retail', phone: '0506666666', creditLimit: 5000 },
        { code: 'CUST-007', name: 'فاطمة سعد الدوسري', type: 'retail', phone: '0507777777', creditLimit: 3000 },
        { code: 'CUST-008', name: 'خالد عبدالله القحطاني', type: 'retail', phone: '0508888888', creditLimit: 4000 },
        { code: 'CUST-009', name: 'منى إبراهيم السالم', type: 'retail', phone: '0509999999', creditLimit: 2000 },
        { code: 'CUST-010', name: 'عمر حسن الشهري', type: 'retail', phone: '0500000000', creditLimit: 6000 },
    ],

    // Products/Items (50 items)
    items: [
        // Electronics Category
        { sku: 'ELEC-001', name: 'هاتف ذكي سامسونج A54', category: 'إلكترونيات', uom: 'pcs', cost: 800, price: 1200, wholesalePrice: 1000, reorderLevel: 10 },
        { sku: 'ELEC-002', name: 'هاتف ذكي آيفون 13', category: 'إلكترونيات', uom: 'pcs', cost: 2500, price: 3500, wholesalePrice: 3000, reorderLevel: 5 },
        { sku: 'ELEC-003', name: 'لابتوب HP 15', category: 'إلكترونيات', uom: 'pcs', cost: 1800, price: 2700, wholesalePrice: 2300, reorderLevel: 5 },
        { sku: 'ELEC-004', name: 'تابلت سامسونج Tab A8', category: 'إلكترونيات', uom: 'pcs', cost: 600, price: 900, wholesalePrice: 750, reorderLevel: 8 },
        { sku: 'ELEC-005', name: 'سماعات بلوتوث JBL', category: 'إلكترونيات', uom: 'pcs', cost: 150, price: 250, wholesalePrice: 200, reorderLevel: 20 },

        // Clothing
        { sku: 'CLTH-001', name: 'قميص رجالي قطن', category: 'ملابس', uom: 'pcs', cost: 50, price: 100, wholesalePrice: 80, reorderLevel: 30 },
        { sku: 'CLTH-002', name: 'بنطلون جينز', category: 'ملابس', uom: 'pcs', cost: 80, price: 150, wholesalePrice: 120, reorderLevel: 25 },
        { sku: 'CLTH-003', name: 'فستان نسائي', category: 'ملابس', uom: 'pcs', cost: 100, price: 200, wholesalePrice: 160, reorderLevel: 20 },
        { sku: 'CLTH-004', name: 'جاكيت شتوي', category: 'ملابس', uom: 'pcs', cost: 150, price: 300, wholesalePrice: 240, reorderLevel: 15 },
        { sku: 'CLTH-005', name: 'حذاء رياضي', category: 'ملابس', uom: 'pcs', cost: 120, price: 250, wholesalePrice: 200, reorderLevel: 20 },

        // Food & Beverages
        { sku: 'FOOD-001', name: 'أرز بسمتي 5كجم', category: 'مواد غذائية', uom: 'bag', cost: 25, price: 40, wholesalePrice: 35, reorderLevel: 100 },
        { sku: 'FOOD-002', name: 'سكر 1كجم', category: 'مواد غذائية', uom: 'kg', cost: 3, price: 6, wholesalePrice: 5, reorderLevel: 200 },
        { sku: 'FOOD-003', name: 'زيت زيتون 1لتر', category: 'مواد غذائية', uom: 'bottle', cost: 30, price: 50, wholesalePrice: 42, reorderLevel: 50 },
        { sku: 'FOOD-004', name: 'معكرونة 500جم', category: 'مواد غذائية', uom: 'pcs', cost: 2, price: 4, wholesalePrice: 3.5, reorderLevel: 150 },
        { sku: 'FOOD-005', name: 'حليب طويل الأمد 1لتر', category: 'مواد غذائية', uom: 'carton', cost: 4, price: 7, wholesalePrice: 6, reorderLevel: 100 },

        // Home Appliances
        { sku: 'HOME-001', name: 'مكنسة كهربائية', category: 'أجهزة منزلية', uom: 'pcs', cost: 200, price: 350, wholesalePrice: 300, reorderLevel: 10 },
        { sku: 'HOME-002', name: 'مروحة سقف', category: 'أجهزة منزلية', uom: 'pcs', cost: 150, price: 280, wholesalePrice: 230, reorderLevel: 10 },
        { sku: 'HOME-003', name: 'غلاية كهربائية', category: 'أجهزة منزلية', uom: 'pcs', cost: 50, price: 90, wholesalePrice: 75, reorderLevel: 25 },
        { sku: 'HOME-004', name: 'محمصة خبز', category: 'أجهزة منزلية', uom: 'pcs', cost: 80, price: 140, wholesalePrice: 115, reorderLevel: 15 },
        { sku: 'HOME-005', name: 'خلاط كهربائي', category: 'أجهزة منزلية', uom: 'pcs', cost: 120, price: 220, wholesalePrice: 180, reorderLevel: 12 },

        // Stationery
        { sku: 'STAT-001', name: 'دفتر 100 ورقة', category: 'قرطاسية', uom: 'pcs', cost: 5, price: 10, wholesalePrice: 8, reorderLevel: 100 },
        { sku: 'STAT-002', name: 'أقلام حبر أزرق (عبوة 10)', category: 'قرطاسية', uom: 'box', cost: 8, price: 15, wholesalePrice: 12, reorderLevel: 50 },
        { sku: 'STAT-003', name: 'ملف حفظ A4', category: 'قرطاسية', uom: 'pcs', cost: 3, price: 6, wholesalePrice: 5, reorderLevel: 80 },
        { sku: 'STAT-004', name: 'آلة حاسبة علمية', category: 'قرطاسية', uom: 'pcs', cost: 25, price: 45, wholesalePrice: 38, reorderLevel: 20 },
        { sku: 'STAT-005', name: 'طابعة ملصقات', category: 'قرطاسية', uom: 'pcs', cost: 150, price: 280, wholesalePrice: 230, reorderLevel: 5 },

        // Toys
        { sku: 'TOY-001', name: 'لعبة سيارة تحكم عن بعد', category: 'ألعاب', uom: 'pcs', cost: 80, price: 150, wholesalePrice: 120, reorderLevel: 15 },
        { sku: 'TOY-002', name: 'دمية باربي', category: 'ألعاب', uom: 'pcs', cost: 40, price: 75, wholesalePrice: 60, reorderLevel: 25 },
        { sku: 'TOY-003', name: 'مكعبات ليجو (500 قطعة)', category: 'ألعاب', uom: 'box', cost: 100, price: 180, wholesalePrice: 150, reorderLevel: 10 },
        { sku: 'TOY-004', name: 'لعبة بازل 1000 قطعة', category: 'ألعاب', uom: 'pcs', cost: 30, price: 60, wholesalePrice: 50, reorderLevel: 20 },
        { sku: 'TOY-005', name: 'دراجة أطفال', category: 'ألعاب', uom: 'pcs', cost: 200, price: 380, wholesalePrice: 320, reorderLevel: 8 },

        // Sports
        { sku: 'SPRT-001', name: 'كرة قدم', category: 'رياضة', uom: 'pcs', cost: 40, price: 80, wholesalePrice: 65, reorderLevel: 30 },
        { sku: 'SPRT-002', name: 'مضرب تنس', category: 'رياضة', uom: 'pcs', cost: 80, price: 150, wholesalePrice: 125, reorderLevel: 15 },
        { sku: 'SPRT-003', name: 'حبل القفز', category: 'رياضة', uom: 'pcs', cost: 15, price: 30, wholesalePrice: 25, reorderLevel: 40 },
        { sku: 'SPRT-004', name: 'دمبل 5كجم (زوج)', category: 'رياضة', uom: 'set', cost: 50, price: 100, wholesalePrice: 85, reorderLevel: 20 },
        { sku: 'SPRT-005', name: 'سجادة يوغا', category: 'رياضة', uom: 'pcs', cost: 30, price: 60, wholesalePrice: 50, reorderLevel: 25 },

        // Beauty & Personal Care
        { sku: 'BEAU-001', name: 'شامبو 400مل', category: 'عناية شخصية', uom: 'bottle', cost: 15, price: 30, wholesalePrice: 25, reorderLevel: 50 },
        { sku: 'BEAU-002', name: 'كريم مرطب للوجه', category: 'عناية شخصية', uom: 'jar', cost: 25, price: 50, wholesalePrice: 42, reorderLevel: 40 },
        { sku: 'BEAU-003', name: 'عطر رجالي 100مل', category: 'عناية شخصية', uom: 'bottle', cost: 80, price: 150, wholesalePrice: 125, reorderLevel: 20 },
        { sku: 'BEAU-004', name: 'مجموعة مكياج', category: 'عناية شخصية', uom: 'set', cost: 120, price: 220, wholesalePrice: 185, reorderLevel: 15 },
        { sku: 'BEAU-005', name: 'فرشاة شعر كهربائية', category: 'عناية شخصية', uom: 'pcs', cost: 60, price: 110, wholesalePrice: 92, reorderLevel: 18 },

        // Books
        { sku: 'BOOK-001', name: 'رواية عربية', category: 'كتب', uom: 'pcs', cost: 20, price: 40, wholesalePrice: 35, reorderLevel: 30 },
        { sku: 'BOOK-002', name: 'كتاب تطوير ذاتي', category: 'كتب', uom: 'pcs', cost: 30, price: 55, wholesalePrice: 47, reorderLevel: 25 },
        { sku: 'BOOK-003', name: 'قصص أطفال (مجموعة)', category: 'كتب', uom: 'set', cost: 50, price: 90, wholesalePrice: 78, reorderLevel: 20 },
        { sku: 'BOOK-004', name: 'كتاب طبخ', category: 'كتب', uom: 'pcs', cost: 35, price: 65, wholesalePrice: 57, reorderLevel: 15 },
        { sku: 'BOOK-005', name: 'موسوعة علمية', category: 'كتب', uom: 'pcs', cost: 100, price: 180, wholesalePrice: 158, reorderLevel: 10 },

        // Furniture
        { sku: 'FURN-001', name: 'كرسي مكتب', category: 'أثاث', uom: 'pcs', cost: 300, price: 550, wholesalePrice: 475, reorderLevel: 8 },
        { sku: 'FURN-002', name: 'طاولة قهوة', category: 'أثاث', uom: 'pcs', cost: 250, price: 480, wholesalePrice: 415, reorderLevel: 5 },
        { sku: 'FURN-003', name: 'رف كتب خشبي', category: 'أثاث', uom: 'pcs', cost: 400, price: 750, wholesalePrice: 650, reorderLevel: 5 },
        { sku: 'FURN-004', name: 'مرآة حائط كبيرة', category: 'أثاث', uom: 'pcs', cost: 150, price: 300, wholesalePrice: 260, reorderLevel: 10 },
        { sku: 'FURN-005', name: 'مصباح أرضي', category: 'أثاث', uom: 'pcs', cost: 120, price: 230, wholesalePrice: 200, reorderLevel: 12 },
    ]
};

// ========================================
// Seed Data Creation Functions
// ========================================

async function createAccounts() {
    console.log('📊 Creating Chart of Accounts...');
    const created = [];

    for (const acc of MASTER_DATA.accounts) {
        try {
            const res = await api.post('/finance/accounts', acc);
            created.push(res.data);
            console.log(`  ✅ Created account: ${acc.code} - ${acc.name}`);
        } catch (err) {
            console.error(`  ❌ Failed to create account ${acc.code}:`, err.response?.data?.message || err.message);
        }
    }

    return created;
}

async function createWarehouses() {
    console.log('🏭 Creating Warehouses...');
    const created = [];

    for (const wh of MASTER_DATA.warehouses) {
        try {
            const res = await api.post('/inventory/warehouses', wh);
            created.push(res.data);
            console.log(`  ✅ Created warehouse: ${wh.code} - ${wh.name}`);
        } catch (err) {
            console.error(`  ❌ Failed to create warehouse ${wh.code}:`, err.response?.data?.message || err.message);
        }
    }

    return created;
}

async function createSuppliers() {
    console.log('🏪 Creating Suppliers...');
    const created = [];

    for (const sup of MASTER_DATA.suppliers) {
        try {
            const res = await api.post('/sales/customers', { ...sup, isSupplier: true });
            created.push(res.data);
            console.log(`  ✅ Created supplier: ${sup.code} - ${sup.name}`);
        } catch (err) {
            console.error(`  ❌ Failed to create supplier ${sup.code}:`, err.response?.data?.message || err.message);
        }
    }

    return created;
}

async function createCustomers() {
    console.log('👥 Creating Customers...');
    const created = [];

    for (const cust of MASTER_DATA.customers) {
        try {
            const res = await api.post('/sales/customers', cust);
            created.push(res.data);
            console.log(`  ✅ Created customer: ${cust.code} - ${cust.name}`);
        } catch (err) {
            console.error(`  ❌ Failed to create customer ${cust.code}:`, err.response?.data?.message || err.message);
        }
    }

    return created;
}

async function createItems() {
    console.log('📦 Creating Items/Products...');
    const created = [];

    for (const item of MASTER_DATA.items) {
        try {
            const res = await api.post('/inventory/items', item);
            created.push(res.data);
            console.log(`  ✅ Created item: ${item.sku} - ${item.name}`);
        } catch (err) {
            console.error(`  ❌ Failed to create item ${item.sku}:`, err.response?.data?.message || err.message);
        }
    }

    return created;
}

// ========================================
// Main Seed Function
// ========================================

async function runSeedData() {
    console.log('\n🌱 ========================================');
    console.log('   ERP SYSTEM - SEED DATA GENERATOR');
    console.log('========================================\n');

    try {
        // Step 1: Create Chart of Accounts
        const accounts = await createAccounts();
        console.log(`\n✅ Created ${accounts.length} accounts\n`);

        // Step 2: Create Warehouses
        const warehouses = await createWarehouses();
        console.log(`\n✅ Created ${warehouses.length} warehouses\n`);

        // Step 3: Create Suppliers
        const suppliers = await createSuppliers();
        console.log(`\n✅ Created ${suppliers.length} suppliers\n`);

        // Step 4: Create Customers
        const customers = await createCustomers();
        console.log(`\n✅ Created ${customers.length} customers\n`);

        // Step 5: Create Items
        const items = await createItems();
        console.log(`\n✅ Created ${items.length} items\n`);

        // Summary
        console.log('\n📊 ========================================');
        console.log('   SEED DATA CREATION COMPLETE!');
        console.log('========================================');
        console.log(`Total Accounts: ${accounts.length}`);
        console.log(`Total Warehouses: ${warehouses.length}`);
        console.log(`Total Suppliers: ${suppliers.length}`);
        console.log(`Total Customers: ${customers.length}`);
        console.log(`Total Items: ${items.length}`);
        console.log('========================================\n');

        return {
            accounts,
            warehouses,
            suppliers,
            customers,
            items
        };

    } catch (error) {
        console.error('\n❌ Seed data creation failed:', error.message);
        throw error;
    }
}

// Export functions
module.exports = {
    runSeedData,
    setToken,
    MASTER_DATA
};

// Run if executed directly
if (require.main === module) {
    runSeedData()
        .then(() => {
            console.log('✅ Seed data completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Seed data failed:', error);
            process.exit(1);
        });
}
