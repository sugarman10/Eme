import mongoose from 'mongoose';
import Account from '../src/models/Account.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp';

async function checkSalesAccounts() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // These are the exact codes needed for sales automation
        const requiredCodes = ['10101', '10104', '40101', '50101', '10103'];

        console.log('\n🔍 Checking for required accounts:');
        console.log('Required codes:', requiredCodes);

        const accounts = await Account.find({ code: { $in: requiredCodes } });

        console.log(`\n📊 Found ${accounts.length} out of 5 required accounts:\n`);

        requiredCodes.forEach(code => {
            const found = accounts.find(acc => acc.code === code);
            if (found) {
                console.log(`  ✅ ${code} - ${found.name} (ID: ${found._id})`);
            } else {
                console.log(`  ❌ ${code} - MISSING!`);
            }
        });

        if (accounts.length === 5) {
            console.log('\n✅ All required accounts exist! Sales automation should work.');
        } else {
            console.log('\n⚠️ Missing accounts! Sales automation will be skipped.');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkSalesAccounts();
