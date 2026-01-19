import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Receipt from '../src/models/Receipt.js';

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ DB Connected');

        const count = await Receipt.countDocuments();
        console.log(`📊 Total Receipts in DB: ${count}`);

        if (count > 0) {
            const sample = await Receipt.findOne().lean();
            console.log('Sample data:', JSON.stringify(sample, null, 2));
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
    }
};

run();
