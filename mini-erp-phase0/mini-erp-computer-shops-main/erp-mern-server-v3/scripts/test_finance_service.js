import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { recordFinancialOperation } from '../src/services/financeService.js';
import Treasury from '../src/models/Treasury.js';
import Transaction from '../src/models/Transaction.js';
import JournalEntry from '../src/models/JournalEntry.js';

const runTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to DB');

        // Start Session
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Setup
            const treasury = await Treasury.findOne({ isActive: true });
            if (!treasury) throw new Error('No Treasury Found');
            const initialBalance = treasury.balance;
            console.log(`🏦 Initial Treasury Balance: ${initialBalance}`);

            const AMOUNT = 50;

            // Execute Operation
            console.log('🔄 Recording Expense Operation...');
            await recordFinancialOperation({
                type: 'EXPENSE',
                amount: AMOUNT,
                treasuryId: treasury._id,
                description: 'Test Expense Service',
                relatedModel: 'None',
                userId: null // System
            }, session);

            // Commit to check persistence (or abort if just testing logic)
            // We commit to see if it really works end-to-end
            await session.commitTransaction();
            console.log('✅ Transaction Committed');

            // Verification
            const updatedTreasury = await Treasury.findById(treasury._id);
            console.log(`🏦 Updated Balance: ${updatedTreasury.balance}`);
            console.log(`Expected: ${initialBalance - AMOUNT}`);

            if (updatedTreasury.balance !== initialBalance - AMOUNT) {
                console.error('❌ Balance Mismatch!');
            } else {
                console.log('✅ Balance Correct');
            }

            // Check Transaction Log
            const log = await Transaction.findOne({ description: 'Test Expense Service' }).sort({ createdAt: -1 });
            if (log) console.log('✅ Transaction Log Found:', log._id);
            else console.error('❌ Transaction Log Missing');

            // Check Journal Entry
            const je = await JournalEntry.findOne({ note: 'Test Expense Service' }).sort({ createdAt: -1 });
            if (je) console.log('✅ Journal Entry Found:', je._id);
            else console.log('⚠️ Journal Entry Missing (Might be due to missing Account Codes in DB)');

        } catch (err) {
            console.error('❌ Operation Failed:', err.message);
            await session.abortTransaction();
        } finally {
            session.endSession();
        }

    } catch (e) {
        console.error('❌ Connection Failed:', e);
    } finally {
        await mongoose.disconnect();
    }
};

runTest();
