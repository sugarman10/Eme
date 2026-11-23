import 'dotenv/config';
import mongoose from 'mongoose';
import Account from '../src/models/Account.js';
import connectDB from '../src/config/db.js';

const check = async () => {
    try {
        await connectDB();
        const count = await Account.countDocuments();
        console.log(`Accounts Count: ${count}`);
        if (count > 0) {
            const list = await Account.find().limit(5);
            console.log('Sample:', list.map(a => `${a.code} - ${a.name}`));
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};
check();
