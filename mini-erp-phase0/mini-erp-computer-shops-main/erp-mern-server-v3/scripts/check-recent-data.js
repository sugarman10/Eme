import mongoose from 'mongoose';
import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Receipt from '../src/models/Receipt.js';
import JournalEntry from '../src/models/JournalEntry.js';

const checkData = async () => {
    try {
        await connectDB();
        console.log('🔌 Connected to DB');

        console.log('\n🔍 Checking Last 3 Receipts:');
        const receipts = await Receipt.find().sort({ createdAt: -1 }).limit(3).lean();
        if (receipts.length === 0) console.log('❌ No Receipts Found.');
        receipts.forEach(r => {
            console.log(`🧾 ID: ${r._id} | Amount: ${r.amount} | Date: ${r.date} | CreatedAt: ${r.createdAt}`);
            console.log(`   Customer: ${r.customer} | Invoices: ${r.invoices?.length}`);
        });

        console.log('\n🔍 Checking Last 3 Journal Entries:');
        const jes = await JournalEntry.find().sort({ createdAt: -1 }).limit(3).lean();
        if (jes.length === 0) console.log('❌ No Journal Entries Found.');
        jes.forEach(j => {
            console.log(`📒 Ref: ${j.ref} | Desc: ${j.note?.substring(0, 50)} | Date: ${j.date}`);
            j.lines.forEach(l => {
                console.log(`   🔸 Acc: ${l.account} | Dr: ${l.debit} | Cr: ${l.credit}`);
            });
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

checkData();
