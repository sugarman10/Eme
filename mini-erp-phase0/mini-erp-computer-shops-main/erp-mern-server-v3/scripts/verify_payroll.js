
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';
import Payroll from '../src/models/Payroll.js';
import Treasury from '../src/models/Treasury.js';
import { generateMonthlyPayroll, payPayroll } from '../src/services/payrollService.js';

import path from 'path';
import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');

// Debugging .env loading
console.log('🔍 Script Location:', __dirname);
console.log('🔍 Target .env Path:', envPath);
import fs from 'fs';
if (fs.existsSync(envPath)) {
    console.log('✅ .env file found at target path.');
} else {
    console.error('❌ .env file NOT found at target path!');
}

// Load .env
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.error('❌ dotenv config error:', result.error);
} else {
    console.log('✅ dotenv loaded successfully.');
}

console.log('🔍 MONGO_URI:', process.env.MONGO_URI ? 'Defined' : 'UNDEFINED');
console.log('🔍 MONGODB_URI:', process.env.MONGODB_URI ? 'Defined' : 'UNDEFINED');
console.log('---------------------------------------------------');

const verifyPayroll = async () => {
    try {
        console.log('🔌 Connecting to DB...');
        // Use MONGO_URI (standard in this project) or MONGODB_URI (fallback)
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        console.log('🔍 Connection URI:', uri ? '*** HIDDEN ***' : 'UNDEFINED');

        await mongoose.connect(uri);
        console.log('✅ Connected');

        // 1. Create Test Employee
        console.log('\n--- 1. Creating Test Employee ---');
        const emp = await Employee.create({
            name: `Test Emp ${Date.now()}`,
            position: 'Developer',
            isActive: true,
            salaryDetails: {
                baseSalary: 4000,
                housingAllowance: 500,
                transportAllowance: 200,
                dailyRate: 150
            }
        });
        console.log(`✅ Employee Created: ${emp.name} (ID: ${emp._id})`);

        // 2. Generate Payroll
        console.log('\n--- 2. Generating Payroll for 2025-01 ---');
        const session = await mongoose.startSession();
        let genResult;
        await session.withTransaction(async () => {
            genResult = await generateMonthlyPayroll('2025-01', session);
        });
        session.endSession();
        console.log('✅ Generation Result:', genResult);

        // 3. Verify Payroll Document
        const payroll = await Payroll.findOne({ employee: emp._id, month: '2025-01' });
        if (!payroll) throw new Error('Payroll Document NOT Found!');
        console.log(`✅ Payroll Document Found! Net Salary: ${payroll.totals.netSalary}`);

        if (payroll.totals.netSalary !== 4700) {
            throw new Error(`Calculation Error! Expected 4700, Got ${payroll.totals.netSalary}`);
        }

        // 4. Pay Payroll
        console.log('\n--- 3. Paying Payroll ---');
        // Find a valid Treasury
        const treasury = await Treasury.findOne({ isActive: true });
        if (!treasury) throw new Error('No Active Treasury Found for Test');

        console.log(`Using Treasury: ${treasury.name} (Balance: ${treasury.balance})`);
        const initialBalance = treasury.balance;

        const session2 = await mongoose.startSession();
        await session2.withTransaction(async () => {
            await payPayroll(payroll._id, treasury._id, null, session2);
        });
        session2.endSession();

        // 5. Verify payment effects
        const updatedTreasury = await Treasury.findById(treasury._id);
        console.log(`✅ Payment Processed. New Treasury Balance: ${updatedTreasury.balance}`);

        if (updatedTreasury.balance >= initialBalance) {
            console.warn('⚠️ Treasury Balance did not decrease! (Logic check needed)');
        } else {
            console.log('✅ Treasury Balance Decreased correctly.');
        }

        const updatedPayroll = await Payroll.findById(payroll._id);
        console.log(`✅ Payroll Status: ${updatedPayroll.status}`);

        console.log('\n✅✅ VERIFICATION SUCCESSFUL ✅✅');

    } catch (err) {
        console.error('\n❌ VERIFICATION FAILED:', err);
    } finally {
        await mongoose.disconnect();
    }
};

verifyPayroll();
