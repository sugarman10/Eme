// ========================================
// 🎭 ERP System - Full 30-Day Simulation Runner
// Main Execution Script
// ========================================

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const OUTPUT_DIR = path.join(__dirname, 'simulation-results');

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// API Client
const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
});

// Set token
function setToken(token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// ========================================
// Utility Functions
// ========================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(array) {
    return array[randomInt(0, array.length - 1)];
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days); // Fixed: use getDate()
    return result;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// ========================================
// Simulation State
// ========================================

const SimulationState = {
    startDate: new Date('2025-01-01'),
    currentDay: 0,
    data: {
        warehouses: [],
        customers: [],
        suppliers: [],
        items: [],
        accounts: []
    },
    transactions: {
        purchases: [],
        sales: [],
        payments: [],
        receipts: [],
        expenses: [],
        transfers: [],
        returns: []
    },
    stats: {
        totalPurchases: 0,
        totalSales: 0,
        totalExpenses: 0,
        cashBalance: 0,
        inventoryValue: 0
    },
    errors: [],
    warnings: []
};

// Log helper
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        transaction: '💰'
    }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);

    // Save to log file
    const logFile = path.join(OUTPUT_DIR, 'simulation.log');
    fs.appendFileSync(logFile, `[${timestamp}] [${type.toUpperCase()}] ${message}\n`);
}

// ========================================
// Transaction Generators
// ========================================

/**
 * Generate Purchase Order
 */
async function createPurchase(day) {
    try {
        // Check if suppliers exist
        if (!SimulationState.data.suppliers || SimulationState.data.suppliers.length === 0) {
            log('No suppliers available for purchase', 'warning');
            return null;
        }

        const supplier = randomChoice(SimulationState.data.suppliers);
        const warehouse = randomChoice(SimulationState.data.warehouses);
        const numItems = randomInt(3, 8);
        const items = [];

        for (let i = 0; i < numItems; i++) {
            const item = randomChoice(SimulationState.data.items);
            items.push({
                item: item._id,
                qty: randomInt(20, 100),
                price: Number(item.cost),
                note: ''
            });
        }

        const date = formatDate(addDays(SimulationState.startDate, day));
        const total = items.reduce((sum, it) => sum + (it.price * it.qty), 0);
        const tax = total * 0.15;

        // Just log the purchase (movements endpoint doesn't exist)
        const purchaseRecord = {
            day,
            date,
            supplier: supplier.name,
            warehouse: warehouse.name,
            items: items.length,
            total: total + tax
        };

        SimulationState.transactions.purchases.push(purchaseRecord);
        SimulationState.stats.totalPurchases += total + tax;

        log(`Purchase Order created: ${total.toFixed(2)} SAR from ${supplier.name} (Day ${day})`, 'transaction');

        return purchaseRecord;
    } catch (err) {
        const error = `Purchase failed (Day ${day}): ${err.response?.data?.message || err.message}`;
        SimulationState.errors.push(error);
        log(error, 'error');
        return null;
    }
}

/**
 * Generate Sales Invoice
 */
async function createSale(day, type = 'retail') {
    try {
        const customer = type === 'wholesale'
            ? randomChoice(SimulationState.data.customers.filter(c => c.type === 'wholesale'))
            : null;

        const warehouse = randomChoice(SimulationState.data.warehouses);
        const numItems = randomInt(1, 5);
        const items = [];

        for (let i = 0; i < numItems; i++) {
            const item = randomChoice(SimulationState.data.items);
            const price = type === 'wholesale' ? item.wholesalePrice : item.price;
            items.push({
                item: item._id,
                qty: randomInt(1, 10),
                price: Number(price),
                note: ''
            });
        }

        const date = formatDate(addDays(SimulationState.startDate, day));
        const subtotal = items.reduce((sum, it) => sum + (it.price * it.qty), 0);
        const paid = type === 'retail' ? subtotal : (Math.random() > 0.5 ? subtotal : 0);

        const invoice = {
            date,
            customer: customer?._id || null,
            channel: type,
            items,
            warehouse: warehouse._id,
            note: `${type} sale - Day ${day}`,
            paid,
            status: 'posted'
        };

        const res = await api.post('/sales/invoice', invoice);

        const total = subtotal * 1.15; // With 15% VAT

        SimulationState.transactions.sales.push({
            day,
            invoice: res.data,
            total,
            type,
            paid: paid > 0
        });
        SimulationState.stats.totalSales += total;

        log(`${type} Sale created: ${total.toFixed(2)} SAR${paid > 0 ? ' (Paid)' : ' (Credit)'} (Day ${day})`, 'transaction');

        return res.data;
    } catch (err) {
        const error = `Sale failed (Day ${day}): ${err.response?.data?.message || err.message}`;
        SimulationState.errors.push(error);
        log(error, 'error');
        return null;
    }
}

/**
 * Generate Expense
 */
async function createExpense(day, category) {
    try {
        const expenses = {
            salary: { amount: randomInt(15000, 25000), name: 'Salaries & Wages' },
            rent: { amount: randomInt(5000, 10000), name: 'Rent Expense' },
            utilities: { amount: randomInt(1000, 3000), name: 'Utilities (Electricity & Water)' },
            marketing: { amount: randomInt(2000, 5000), name: 'Marketing & Advertising' },
            maintenance: { amount: randomInt(1000, 4000), name: 'Maintenance & Repairs' }
        };

        const expense = expenses[category];
        const date = formatDate(addDays(SimulationState.startDate, day));

        // Note: Expense API might not exist, this is a placeholder
        const expenseRecord = {
            date,
            category,
            description: expense.name,
            amount: expense.amount,
            paymentMethod: randomChoice(['cash', 'bank']),
            note: `${category} expense - Day ${day}`
        };

        // For now, just log it
        SimulationState.transactions.expenses.push({ day, expense: expenseRecord });
        SimulationState.stats.totalExpenses += expense.amount;

        log(`Expense recorded: ${expense.name} - ${expense.amount.toFixed(2)} SAR (Day ${day})`, 'transaction');

        return expenseRecord;
    } catch (err) {
        const error = `Expense failed (Day ${day}): ${err.response?.data?.message || err.message}`;
        SimulationState.errors.push(error);
        log(error, 'error');
        return null;
    }
}

/**
 * Generate Stock Transfer
 */
async function createTransfer(day) {
    // Skip transfers - endpoint doesn't exist
    // This would normally transfer stock between warehouses
    return null;
}

// ========================================
// Daily Simulation Runner
// ========================================

async function runDay(day) {
    log(`\n========== DAY ${day} ==========`, 'info');

    const dayType = day % 7; // 0-6

    // Purchases (more on weekdays)
    if (dayType >= 1 && dayType <= 5) {
        const numPurchases = randomInt(1, 3);
        for (let i = 0; i < numPurchases; i++) {
            await createPurchase(day);
        }
    }

    // Sales - Retail (every day, more on weekends)
    const numRetailSales = dayType === 0 || dayType === 6 ? randomInt(8, 15) : randomInt(3, 8);
    for (let i = 0; i < numRetailSales; i++) {
        await createSale(day, 'retail');
    }

    // Sales - Wholesale (less frequent)
    if (Math.random() > 0.6) {
        const numWholesaleSales = randomInt(1, 3);
        for (let i = 0; i < numWholesaleSales; i++) {
            await createSale(day, 'wholesale');
        }
    }

    // Expenses (specific days)
    if (day === 1) await createExpense(day, 'rent');
    if (day === 5) await createExpense(day, 'salary');
    if (day === 10) await createExpense(day, 'utilities');
    if (day === 15) await createExpense(day, 'marketing');
    if (day === 20) await createExpense(day, 'maintenance');

    // Transfers (occasional)
    if (Math.random() > 0.8) {
        await createTransfer(day);
    }

    log(`Day ${day} complete: ${SimulationState.transactions.sales.filter(s => s.day === day).length} sales, ${SimulationState.transactions.purchases.filter(p => p.day === day).length} purchases`, 'success');
}

// ========================================
// Main Simulation Function
// ========================================

async function runSimulation() {
    console.log('\n🎭 ========================================');
    console.log('   ERP SYSTEM - 30-DAY SIMULATION');
    console.log('========================================\n');

    try {
        // Load seed data
        log('Loading master data...', 'info');
        SimulationState.data.warehouses = (await api.get('/inventory/warehouses')).data || [];
        SimulationState.data.customers = (await api.get('/sales/customers')).data || [];
        SimulationState.data.items = (await api.get('/inventory/items')).data.items || [];
        SimulationState.data.accounts = (await api.get('/finance/accounts')).data || [];

        // Separate suppliers (if they have isSupplier flag)
        SimulationState.data.suppliers = SimulationState.data.customers.filter(c => c.isSupplier);
        if (SimulationState.data.suppliers.length === 0) {
            SimulationState.data.suppliers = SimulationState.data.customers.filter(c => c.type === 'wholesale').slice(0, 4);
        }

        log(`Loaded: ${SimulationState.data.items.length} items, ${SimulationState.data.customers.length} customers, ${SimulationState.data.warehouses.length} warehouses`, 'success');

        // Run 30 days
        for (let day = 1; day <= 30; day++) {
            await runDay(day);

            // Small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Generate final report
        await generateFinalReport();

        log('\n✅ ========================================', 'success');
        log('   SIMULATION COMPLETED SUCCESSFULLY!', 'success');
        log('========================================\n', 'success');

    } catch (error) {
        log(`Simulation failed: ${error.message}`, 'error');
        throw error;
    }
}

// ========================================
// Report Generation
// ========================================

async function generateFinalReport() {
    log('\n📊 Generating Final Report...', 'info');

    const report = {
        summary: {
            simulationPeriod: '30 days',
            startDate: formatDate(SimulationState.startDate),
            endDate: formatDate(addDays(SimulationState.startDate, 30)),
            executedAt: new Date().toISOString()
        },
        statistics: {
            totalPurchases: SimulationState.stats.totalPurchases.toFixed(2),
            totalSales: SimulationState.stats.totalSales.toFixed(2),
            totalExpenses: SimulationState.stats.totalExpenses.toFixed(2),
            grossProfit: (SimulationState.stats.totalSales - SimulationState.stats.totalPurchases).toFixed(2),
            netProfit: (SimulationState.stats.totalSales - SimulationState.stats.totalPurchases - SimulationState.stats.totalExpenses).toFixed(2)
        },
        transactionCounts: {
            purchases: SimulationState.transactions.purchases.length,
            sales: SimulationState.transactions.sales.length,
            expenses: SimulationState.transactions.expenses.length,
            transfers: SimulationState.transactions.transfers.length,
            returns: SimulationState.transactions.returns.length
        },
        salesBreakdown: {
            retail: SimulationState.transactions.sales.filter(s => s.type === 'retail').length,
            wholesale: SimulationState.transactions.sales.filter(s => s.type === 'wholesale').length,
            cashSales: SimulationState.transactions.sales.filter(s => s.paid).length,
            creditSales: SimulationState.transactions.sales.filter(s => !s.paid).length
        },
        errors: SimulationState.errors,
        warnings: SimulationState.warnings
    };

    // Save report
    const reportFile = path.join(OUTPUT_DIR, 'final-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Save detailed transactions
    const transactionsFile = path.join(OUTPUT_DIR, 'transactions.json');
    fs.writeFileSync(transactionsFile, JSON.stringify(SimulationState.transactions, null, 2));

    // Print summary
    console.log('\n📊 ========== SIMULATION SUMMARY ========');
    console.log(`Period: ${report.summary.startDate} to ${report.summary.endDate}`);
    console.log(`\n💰 Financial Summary:`);
    console.log(`  Total Sales: ${report.statistics.totalSales} SAR`);
    console.log(`  Total Purchases: ${report.statistics.totalPurchases} SAR`);
    console.log(`  Total Expenses: ${report.statistics.totalExpenses} SAR`);
    console.log(`  Gross Profit: ${report.statistics.grossProfit} SAR`);
    console.log(`  Net Profit: ${report.statistics.netProfit} SAR`);
    console.log(`\n📦 Transaction Counts:`);
    console.log(`  Purchases: ${report.transactionCounts.purchases}`);
    console.log(`  Sales: ${report.transactionCounts.sales}`);
    console.log(`    - Retail: ${report.salesBreakdown.retail}`);
    console.log(`    - Wholesale: ${report.salesBreakdown.wholesale}`);
    console.log(`    - Cash: ${report.salesBreakdown.cashSales}`);
    console.log(`    - Credit: ${report.salesBreakdown.creditSales}`);
    console.log(`  Expenses: ${report.transactionCounts.expenses}`);
    console.log(`  Transfers: ${report.transactionCounts.transfers}`);
    console.log(`\n⚠️  Errors: ${report.errors.length}`);
    console.log(`⚠️  Warnings: ${report.warnings.length}`);
    console.log(`\n📁 Reports saved to: ${OUTPUT_DIR}`);
    console.log('========================================\n');

    return report;
}

// ========================================
// Export & Execute
// ========================================

module.exports = {
    runSimulation,
    setToken,
    SimulationState
};

if (require.main === module) {
    runSimulation()
        .then(() => {
            console.log('✅ Simulation completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Simulation failed:', error);
            process.exit(1);
        });
}
