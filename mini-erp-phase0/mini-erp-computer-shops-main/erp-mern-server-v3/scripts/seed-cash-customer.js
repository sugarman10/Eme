/**
 * Seed Cash Customer
 * Creates or updates the system Cash Customer
 * 
 * Usage: node scripts/seed-cash-customer.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from '../src/models/Customer.js';

dotenv.config();

async function seedCashCustomer() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Use the static method to ensure Cash Customer exists
        const cashCustomer = await Customer.ensureCashCustomer();

        console.log('✅ Cash Customer:', {
            id: cashCustomer._id,
            code: cashCustomer.code,
            name: cashCustomer.name,
            isCashCustomer: cashCustomer.isCashCustomer,
            isSystem: cashCustomer.isSystem
        });

        console.log('\n🎉 Cash Customer setup complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
    }
}

seedCashCustomer();
