
import 'dotenv/config';
import mongoose from 'mongoose';
import Customer from './src/models/Customer.js';
import WalletTransaction from './src/models/WalletTransaction.js';
import { useCredit } from './src/controllers/walletController.js';

const uri = 'mongodb://localhost:27017/erp_mern';

async function run() {
    try {
        await mongoose.connect(uri);
        console.log('DB Connected');

        // Create a dummy customer
        const cust = new Customer({
            name: 'Wallet Tester',
            code: 'TEST-WALLET-' + Date.now(),
            walletBalance: 500,
            type: 'retail',
            phone: '0000000000'
        });
        await cust.save();
        console.log('Customer created, Wallet:', cust.walletBalance);

        // Call useCredit
        const res = await useCredit(cust._id, 100, { type: 'Manual' });
        console.log('useCredit result:', res);

        // Check DB
        const check = await Customer.findById(cust._id);
        console.log('DB Wallet Balance:', check.walletBalance);

        // Cleanup
        await Customer.findByIdAndDelete(cust._id);

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
