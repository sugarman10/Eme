import 'dotenv/config';
import mongoose from 'mongoose';
import Account from '../models/Account.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function verifyAccounts() {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const requiredCodes = [
        '1010', '1020', '1030', '1040', '10103', '10105', '11101',
        '2010', '2020', '20101',
        '3010', '3020',
        '4010', '40102',
        '5010', '5020'
    ];

    const accounts = await Account.find({ code: { $in: requiredCodes } });

    console.log(`\nFound ${accounts.length} of ${requiredCodes.length} required accounts:\n`);

    for (const code of requiredCodes) {
        const acc = accounts.find(a => a.code === code);
        if (acc) {
            console.log(`✅ ${code} - ${acc.name}`);
        } else {
            console.log(`❌ ${code} - MISSING!`);
        }
    }

    await mongoose.disconnect();
}

verifyAccounts().catch(console.error);
