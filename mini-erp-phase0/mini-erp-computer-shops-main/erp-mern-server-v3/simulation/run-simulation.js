// =========================================
// 🚀 ERP System - Master Simulation Script
// Orchestrates the entire 30-day simulation
// =========================================

const seedData = require('./01-seed-data');
const simulationRunner = require('./02-simulation-runner');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin12345!';

// Output directory
const OUTPUT_DIR = path.join(__dirname, 'simulation-results');

// ========================================
// Step 1: Login & Get Token
// ========================================

async function login() {
    console.log('🔐 Logging in to ERP system...');

    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        const token = response.data.token;
        console.log('✅ Login successful!');

        return token;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data?.message || error.message);
        console.log('\n⚠️  Please make sure:');
        console.log('   1. The server is running');
        console.log('   2. Admin account exists');
        console.log(`   3. Credentials are correct (${ADMIN_EMAIL})`);
        throw error;
    }
}

// ========================================
// Step 2: Clean Previous Data (Optional)
// ========================================

async function cleanPreviousSimulation() {
    console.log('🧹 Cleaning previous simulation data...');

    // Delete previous results
    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log('✅ Clean complete!');
}

// ========================================
// Main Execution
// ========================================

async function main() {
    console.log('\n🎬 =========================================');
    console.log('   ERP SYSTEM - FULL 30-DAY SIMULATION');
    console.log('   Started at:', new Date().toLocaleString());
    console.log('=========================================\n');

    const startTime = Date.now();

    try {
        // Step 1: Login
        const token = await login();
        seedData.setToken(token);
        simulationRunner.setToken(token);

        // Step 2: Clean previous data
        await cleanPreviousSimulation();

        // Step 3: Create seed data
        console.log('\n📝 PHASE 1: Creating Master Data');
        console.log('=========================================');
        const masterData = await seedData.runSeedData();

        // Save master data summary
        const masterDataFile = path.join(OUTPUT_DIR, 'master-data-summary.json');
        fs.writeFileSync(masterDataFile, JSON.stringify({
            accounts: masterData.accounts.length,
            warehouses: masterData.warehouses.length,
            suppliers: masterData.suppliers.length,
            customers: masterData.customers.length,
            items: masterData.items.length,
            timestamp: new Date().toISOString()
        }, null, 2));

        console.log('\n✅ Master data creation complete!');
        console.log(`   Accounts: ${masterData.accounts.length}`);
        console.log(`   Warehouses: ${masterData.warehouses.length}`);
        console.log(`   Suppliers: ${masterData.suppliers.length}`);
        console.log(`   Customers: ${masterData.customers.length}`);
        console.log(`   Items: ${masterData.items.length}`);

        // Step 4: Run simulation
        console.log('\n🎭 PHASE 2: Running 30-Day Simulation');
        console.log('=========================================');
        await simulationRunner.runSimulation();

        // Step 5: Final Summary
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n🎉 =========================================');
        console.log('   SIMULATION COMPLETED SUCCESSFULLY!');
        console.log('=========================================');
        console.log(`   Duration: ${duration} seconds`);
        console.log(`   Results saved to: ${OUTPUT_DIR}`);
        console.log(`   Completed at: ${new Date().toLocaleString()}`);
        console.log('=========================================\n');

        // Create completion marker
        fs.writeFileSync(path.join(OUTPUT_DIR, 'SIMULATION_COMPLETE.txt'),
            `Simulation completed successfully at ${new Date().toISOString()}\nDuration: ${duration} seconds`
        );

    } catch (error) {
        console.error('\n❌ =========================================');
        console.error('   SIMULATION FAILED!');
        console.error('=========================================');
        console.error('Error:', error.message);
        console.error('\nPlease check:');
        console.error('  1. Server is running on', API_URL);
        console.error('  2. Database connection is active');
        console.error('  3. All required API endpoints exist');
        console.error('  4. Admin credentials are correct');
        console.error('=========================================\n');

        // Save error log
        fs.writeFileSync(path.join(OUTPUT_DIR, 'ERROR_LOG.txt'),
            `Simulation failed at ${new Date().toISOString()}\n\nError: ${error.message}\n\nStack:\n${error.stack}`
        );

        process.exit(1);
    }
}

// ========================================
// Run!
// ========================================

main();
