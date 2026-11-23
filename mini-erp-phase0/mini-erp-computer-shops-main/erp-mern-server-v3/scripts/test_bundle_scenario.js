import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import Item from '../src/models/Item.js';
import Warehouse from '../src/models/Warehouse.js';
import Treasury from '../src/models/Treasury.js';
import Customer from '../src/models/Customer.js';
import SalesInvoice from '../src/models/SalesInvoice.js';
import StockLedger from '../src/models/StockLedger.js';
import { createInvoiceWithTransaction } from '../src/controllers/salesController.js';
import { calculateBundleVirtualStock } from '../src/services/bundleService.js';

async function runBundleScenario() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system';
  console.log('Connecting to MongoDB:', mongoUri);
  await mongoose.connect(mongoUri);

  try {
    console.log('\n--- 1. PREPARING TEST DATA ---');
    // Get or create warehouse
    let warehouse = await Warehouse.findOne();
    if (!warehouse) {
      warehouse = await Warehouse.create({ name: 'المستودع الرئيسي', code: 'WH-01' });
    }
    console.log(`Using Warehouse: ${warehouse.name} (${warehouse._id})`);

    // Get or create treasury
    let treasury = await Treasury.findOne();
    if (!treasury) {
      treasury = await Treasury.create({ name: 'الخزينة النقدية الرئيسية', balance: 10000 });
    }
    console.log(`Using Treasury: ${treasury.name} (${treasury._id})`);

    // Get or create customer
    let customer = await Customer.findOne({ isCashCustomer: false });
    if (!customer) {
      customer = await Customer.create({ name: 'أحمد التاجوري', phone: '0910000000', code: 'CUST-001', balance: 0, creditLimit: 20000 });
    }
    console.log(`Using Customer: ${customer.name} (${customer._id})`);

    // Create Components
    const cpuSku = `CPU-${Date.now()}`;
    const ramSku = `RAM-${Date.now()}`;
    const gpuSku = `GPU-${Date.now()}`;
    const monitorSku = `MON-${Date.now()}`;
    const mouseSku = `MOU-${Date.now()}`;

    const cpu = await Item.create({
      name: 'معالج Intel Core i7-14700K',
      sku: cpuSku,
      cost: 1100,
      price: 1300,
      totalStock: 5,
      stocks: [{ warehouse: warehouse._id, qty: 5 }]
    });

    const ram = await Item.create({
      name: 'ذاكرة Corsair Vengeance 16GB DDR5',
      sku: ramSku,
      cost: 250,
      price: 320,
      totalStock: 10,
      stocks: [{ warehouse: warehouse._id, qty: 10 }]
    });

    const gpu = await Item.create({
      name: 'كرت شاشة RTX 4070 Super 12GB',
      sku: gpuSku,
      cost: 2200,
      price: 2600,
      totalStock: 3,
      stocks: [{ warehouse: warehouse._id, qty: 3 }]
    });

    // Standalone Items
    const monitor = await Item.create({
      name: 'شاشة ألعاب 27 بوصة 165Hz IPS',
      sku: monitorSku,
      cost: 750,
      price: 950,
      totalStock: 5,
      stocks: [{ warehouse: warehouse._id, qty: 5 }]
    });

    const mouse = await Item.create({
      name: 'ماوس ألعاب لاسلكي احترافي RGB',
      sku: mouseSku,
      cost: 150,
      price: 220,
      totalStock: 8,
      stocks: [{ warehouse: warehouse._id, qty: 8 }]
    });

    console.log('Component Items created successfully:');
    console.log(`- CPU: Stock 5, Cost 1100`);
    console.log(`- RAM: Stock 10, Cost 250`);
    console.log(`- GPU: Stock 3, Cost 2200`);
    console.log(`- Standalone Monitor: Stock 5, Price 950`);
    console.log(`- Standalone Mouse: Stock 8, Price 220`);

    // Create Bundle Item
    const bundleSku = `BNDL-${Date.now()}`;
    const bundle = await Item.create({
      name: 'تجميعة قيمنق احترافية',
      sku: bundleSku,
      itemType: 'bundle',
      isBundle: true,
      price: 3500,
      cost: 3800, // Suggested or set cost
      bundleComponents: [
        { item: cpu._id, name: cpu.name, qty: 1 },
        { item: ram._id, name: ram.name, qty: 2 }, // requires 2x RAM
        { item: gpu._id, name: gpu.name, qty: 1 }
      ]
    });

    console.log(`\n--- 2. TESTING VIRTUAL STOCK CALCULATION ---`);
    // Virtual stock should be min(floor(5/1), floor(10/2), floor(3/1)) = min(5, 5, 3) = 3
    const populatedBundle = await Item.findById(bundle._id).populate('bundleComponents.item');
    const { virtualStock } = await calculateBundleVirtualStock(populatedBundle, warehouse._id);
    console.log(`Calculated Virtual Stock for "${bundle.name}": ${virtualStock}`);
    if (virtualStock !== 3) {
      throw new Error(`Expected virtual stock to be 3, got ${virtualStock}`);
    }
    console.log('✓ Virtual stock test PASSED (3 units available)');

    console.log(`\n--- 3. TESTING ATOMIC STOCK VALIDATION & ABORT (INSUFFICIENT STOCK) ---`);
    // Attempting to buy 4 bundles when GPU stock is only 3
    let errorCaught = false;
    try {
      await createInvoiceWithTransaction({
        warehouse: warehouse._id,
        treasury: treasury._id,
        customer: customer._id,
        items: [
          {
            item: bundle._id,
            qty: 4, // Exceeds available GPU stock of 3!
            price: 3500,
            isBundle: true,
            bundleComponents: bundle.bundleComponents
          }
        ],
        paid: 14000,
        paymentMethod: 'cash'
      });
    } catch (err) {
      errorCaught = true;
      console.log('✓ Successfully caught insufficient stock error:', err.message);
      if (!err.message.includes('رصيد غير كافٍ')) {
        throw new Error(`Expected Arabic error message containing "رصيد غير كافٍ", got: ${err.message}`);
      }
    }

    if (!errorCaught) {
      throw new Error('FAILED: Transaction did not abort on insufficient stock!');
    }

    // Verify no stock was deducted during aborted transaction
    const gpuAfterAbort = await Item.findById(gpu._id);
    const gpuStockInWarehouse = gpuAfterAbort.stocks.find(s => s.warehouse.toString() === warehouse._id.toString())?.qty;
    if (gpuStockInWarehouse !== 3) {
      throw new Error(`Stock changed after aborted transaction! Expected 3, got ${gpuStockInWarehouse}`);
    }
    console.log('✓ Verified 100% rollback on aborted transaction (GPU stock remains 3)');

    console.log(`\n--- 4. TESTING SUCCESSFUL BUNDLE + STANDALONE SALE (PHASE 2) ---`);
    // Customer buys:
    // 1x Bundle (3,500 LYD)
    // 1x Monitor (950 LYD)
    // 1x Mouse (220 LYD)
    // Expected Total: 3,500 + 950 + 220 = 4,670 LYD
    const invoice = await createInvoiceWithTransaction({
      warehouse: warehouse._id,
      treasury: treasury._id,
      customer: customer._id,
      items: [
        {
          item: bundle._id,
          qty: 1,
          price: 3500,
          isBundle: true,
          bundleComponents: bundle.bundleComponents,
          componentSerials: {
            [cpu._id.toString()]: ['CPU-SN-998811'],
            [gpu._id.toString()]: ['GPU-SN-445566']
          }
        },
        {
          item: monitor._id,
          qty: 1,
          price: 950
        },
        {
          item: mouse._id,
          qty: 1,
          price: 220
        }
      ],
      paid: 4670,
      paymentMethod: 'cash',
      discountValue: 0
    });

    console.log(`Invoice Created: #${invoice.number || invoice._id}`);
    console.log(`Invoice Grand Total: ${invoice.totals.grand} LYD (Expected: 4,670 LYD)`);
    if (invoice.totals.grand !== 4670) {
      throw new Error(`Expected grand total 4670, got ${invoice.totals.grand}`);
    }

    console.log(`\n--- 5. VERIFYING PHYSICAL STOCK DEDUCTIONS ---`);
    // Verify Components were deducted:
    // CPU: 5 - 1 = 4
    // RAM: 10 - 2 = 8
    // GPU: 3 - 1 = 2
    // Monitor: 5 - 1 = 4
    // Mouse: 8 - 1 = 7
    const updatedCpu = await Item.findById(cpu._id);
    const updatedRam = await Item.findById(ram._id);
    const updatedGpu = await Item.findById(gpu._id);
    const updatedMonitor = await Item.findById(monitor._id);
    const updatedMouse = await Item.findById(mouse._id);

    const getQty = (item) => item.stocks.find(s => s.warehouse.toString() === warehouse._id.toString())?.qty;

    console.log(`CPU stock: ${getQty(updatedCpu)} (expected 4)`);
    console.log(`RAM stock: ${getQty(updatedRam)} (expected 8)`);
    console.log(`GPU stock: ${getQty(updatedGpu)} (expected 2)`);
    console.log(`Monitor stock: ${getQty(updatedMonitor)} (expected 4)`);
    console.log(`Mouse stock: ${getQty(updatedMouse)} (expected 7)`);

    if (getQty(updatedCpu) !== 4) throw new Error(`CPU deduction mismatch: expected 4, got ${getQty(updatedCpu)}`);
    if (getQty(updatedRam) !== 8) throw new Error(`RAM deduction mismatch: expected 8, got ${getQty(updatedRam)}`);
    if (getQty(updatedGpu) !== 2) throw new Error(`GPU deduction mismatch: expected 2, got ${getQty(updatedGpu)}`);
    if (getQty(updatedMonitor) !== 4) throw new Error(`Monitor deduction mismatch: expected 4, got ${getQty(updatedMonitor)}`);
    if (getQty(updatedMouse) !== 7) throw new Error(`Mouse deduction mismatch: expected 7, got ${getQty(updatedMouse)}`);

    console.log(`\n--- 6. VERIFYING INVOICE ITEM SNAPSHOT & STOCK LEDGER ---`);
    const invoiceDoc = await SalesInvoice.findById(invoice._id);
    const bundleLine = invoiceDoc.items.find(i => i.isBundle);
    if (!bundleLine) throw new Error('Bundle line item missing in invoice document!');
    console.log(`Bundle Line Item: ${bundleLine.name || 'Bundle'}, Price: ${bundleLine.price} LYD`);
    console.log(`Bundle Components Snapshot count: ${bundleLine.bundleComponents?.length}`);
    bundleLine.bundleComponents.forEach(c => {
      console.log(`  - ${c.name}: Qty ${c.qty}, Serials: ${c.serials?.join(', ') || 'None'}`);
    });

    const ledgers = await StockLedger.find({ ref: `INV#${invoiceDoc._id}` });
    console.log(`\nStockLedger movements created: ${ledgers.length}`);
    ledgers.forEach(l => {
      console.log(`  - Movement: ${l.qty} units | Item: ${l.item} | Note: "${l.note}"`);
    });

    if (ledgers.length < 5) {
      throw new Error(`Expected at least 5 ledger entries (3 components + 2 standalone), found ${ledgers.length}`);
    }

    console.log('\n=========================================');
    console.log('✅ ALL BUNDLE SALE SCENARIO TESTS PASSED!');
    console.log('=========================================\n');

  } catch (err) {
    console.error('\n❌ SCENARIO TEST FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runBundleScenario();
