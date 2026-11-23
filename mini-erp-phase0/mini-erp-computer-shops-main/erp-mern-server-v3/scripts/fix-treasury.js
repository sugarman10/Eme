/**
 * Fix Treasury Data Script
 * 
 * Fixes existing treasuries that have:
 * - type: 'Safe' or 'Bank' (uppercase) -> 'safe' or 'bank' (lowercase)
 * - Missing code field -> Generate from name
 * 
 * Run: node scripts/fix-treasury.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp';

const TreasurySchema = new mongoose.Schema({
    code: { type: String, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['safe', 'bank'], default: 'safe' },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
}, { timestamps: true });

const Treasury = mongoose.model('Treasury', TreasurySchema);

async function fixTreasuries() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Get all treasuries
        const treasuries = await Treasury.find({});
        console.log(`📦 Found ${treasuries.length} treasuries`);

        let fixed = 0;
        for (const t of treasuries) {
            let needsUpdate = false;

            // Fix type (uppercase -> lowercase)
            if (t.type && t.type !== t.type.toLowerCase()) {
                t.type = t.type.toLowerCase();
                needsUpdate = true;
                console.log(`   🔧 Fixed type: ${t.name} -> ${t.type}`);
            }

            // Fix missing code
            if (!t.code) {
                const prefix = t.type === 'bank' ? 'BANK' : 'SAFE';
                const suffix = String(fixed + 1).padStart(2, '0');
                t.code = `${prefix}-${suffix}`;
                needsUpdate = true;
                console.log(`   🔧 Added code: ${t.name} -> ${t.code}`);
            }

            if (needsUpdate) {
                await t.save();
                fixed++;
            }
        }

        console.log(`\n✅ Fixed ${fixed} treasuries`);

        // Show current state
        const updated = await Treasury.find({}).lean();
        console.log('\n📋 Current Treasuries:');
        updated.forEach(t => {
            console.log(`   - ${t.code}: ${t.name} (${t.type}) - Balance: ${t.balance}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected');
    }
}

fixTreasuries();
