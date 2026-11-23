/**
 * MIGRATION SCRIPT: Activate All Treasuries
 * Usage: node activate-treasuries.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system-db';

async function activateTreasuries() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;

        const treasuriesColl = db.collection('treasuries');

        // Update all treasuries to be active
        const result = await treasuriesColl.updateMany(
            {},
            { $set: { isActive: true } }
        );

        console.log(`✅ Updated ${result.modifiedCount} treasuries to Active status.`);
        console.log(`ℹ️ Matched ${result.matchedCount} treasuries.`);

    } catch (error) {
        console.error('❌ Activation Failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Done.');
        process.exit(0);
    }
}

activateTreasuries();
