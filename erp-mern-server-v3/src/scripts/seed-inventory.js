import 'dotenv/config'; // Loads .env automatically
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Item from '../models/Item.js';
import Warehouse from '../models/Warehouse.js';
import StockLedger from '../models/StockLedger.js';
import Category from '../models/Category.js';

const dummyData = [
    { sku: 'ITM-001', name: 'لابتوب ديل XPS 15', price: 4500, cost: 3800, categoryName: 'Electronics' },
    { sku: 'ITM-002', name: 'ايفون 15 برو ماكس', price: 6500, cost: 5800, categoryName: 'Electronics' },
    { sku: 'ITM-003', name: 'شاشة سامسونج 27 بوصة', price: 1200, cost: 950, categoryName: 'Electronics' },
    { sku: 'ITM-004', name: 'كيبورد ميكانيكي RGB', price: 350, cost: 200, categoryName: 'Accessories' },
    { sku: 'ITM-005', name: 'ماوس لوجيتك G502', price: 250, cost: 180, categoryName: 'Accessories' },
    { sku: 'ITM-006', name: 'طاولة مكتب خشبية', price: 800, cost: 500, categoryName: 'Furniture' },
    { sku: 'ITM-007', name: 'كرسي مريح للألعاب', price: 1500, cost: 1100, categoryName: 'Furniture' },
    { sku: 'ITM-008', name: 'وحدة تخزين SSD 1TB', price: 400, cost: 280, categoryName: 'Storage' },
    { sku: 'ITM-009', name: 'رامات 16GB DDR4', price: 200, cost: 140, categoryName: 'Storage' },
    { sku: 'ITM-010', name: 'سماعة رأس سوني', price: 900, cost: 700, categoryName: 'Audio' },
    { sku: 'ITM-011', name: 'مكبر صوت بلوتوث', price: 300, cost: 200, categoryName: 'Audio' },
    { sku: 'ITM-012', name: 'حقيبة لابتوب مقاومة للماء', price: 150, cost: 80, categoryName: 'Accessories' },
    { sku: 'ITM-013', name: 'شاحن سريع انكر', price: 120, cost: 70, categoryName: 'Accessories' },
    { sku: 'ITM-014', name: 'كيبل HDMI 4K', price: 50, cost: 25, categoryName: 'Cables' },
    { sku: 'ITM-015', name: 'محول USB-C Hub', price: 180, cost: 120, categoryName: 'Accessories' },
    { sku: 'ITM-016', name: 'طابعة ليزر HP', price: 1100, cost: 850, categoryName: 'Electronics' },
    { sku: 'ITM-017', name: 'حبر طابعة اسود', price: 100, cost: 60, categoryName: 'Consumables' },
    { sku: 'ITM-018', name: 'ورق طباعة A4 (كرتون)', price: 80, cost: 50, categoryName: 'Consumables' },
    { sku: 'ITM-019', name: 'كاميرا مراقبة خارجية', price: 350, cost: 220, categoryName: 'Electronics' },
    { sku: 'ITM-020', name: 'راوتر واي فاي 6', price: 450, cost: 300, categoryName: 'Networking' }
];

async function seedInventory() {
    try {
        console.log('🔄 Connecting to Database...');
        await connectDB();

        console.log('📦 Fetching Warehouses...');
        let warehouses = await Warehouse.find({});

        if (warehouses.length === 0) {
            console.log('⚠️ No warehouses found. Creating "Main Warehouse"...');
            const mainWarehouse = await Warehouse.create({ code: 'WH-MAIN', name: 'المستودع الرئيسي' });
            warehouses = [mainWarehouse];
        }

        const warehouseIds = warehouses.map(w => w._id);
        console.log(`✅ Using ${warehouseIds.length} warehouses:`, warehouses.map(w => w.name).join(', '));

        console.log('📂 Processing Categories...');
        // Extract unique category names
        const uniqueCategories = [...new Set(dummyData.map(d => d.categoryName))];
        const categoryMap = {};

        for (const name of uniqueCategories) {
            // Upsert category
            let cat = await Category.findOne({ name });
            if (!cat) {
                cat = await Category.create({ name, description: 'Auto-created by seed script' });
                console.log(`   + Created Category: ${name}`);
            }
            categoryMap[name] = cat._id;
        }
        console.log(`✅ Processed ${uniqueCategories.length} categories.`);


        console.log('🔥 Wiping Clean (Items & Stock Ledger)...');
        await Item.deleteMany({});
        await StockLedger.deleteMany({});
        console.log('🗑️ Data cleared.');

        console.log('🌱 Seeding V2 Products...');
        const itemsToCreate = dummyData.map(data => {
            // 1. Assign stock to warehouses (Randomly distribute 50 items across available WHs)
            const stocks = warehouseIds.map(whId => ({
                warehouse: whId,
                qty: 50 // Fixed qty for simplicity
            }));

            // 2. Calculate Total Stock
            const totalStock = stocks.reduce((sum, s) => sum + s.qty, 0);

            const { categoryName, ...otherData } = data;

            return {
                ...otherData,
                category: categoryMap[categoryName] || null, // Assign ObjectID
                barcode: Math.floor(1000000000 + Math.random() * 9000000000).toString(), // Random EAN-like
                wholesalePrice: Math.floor(data.price * 0.85), // Wholesale is 15% cheaper
                stocks,
                totalStock,
                stock: totalStock, // Maintain Legacy Field
                unit: 'pcs',
                minStock: 10
            };
        });

        const createdItems = await Item.insertMany(itemsToCreate);

        // Create Initial Stock Ledger Entries
        console.log('📝 Creating Stock Ledger entries...');
        const ledgerEntries = [];

        for (const item of createdItems) {
            for (const stockParam of item.stocks) {
                ledgerEntries.push({
                    item: item._id,
                    warehouse: stockParam.warehouse,
                    type: 'IN',
                    qty: stockParam.qty,
                    ref: 'SEED-INIT',
                    note: 'Initial Seed Data',
                    date: new Date()
                });
            }
        }

        await StockLedger.insertMany(ledgerEntries);

        console.log(`✅ Successfully seeded ${createdItems.length} items with ${ledgerEntries.length} stock entries.`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Seeding Failed:', error);
        process.exit(1);
    }
}

seedInventory();
