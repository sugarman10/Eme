
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = 'mongodb://localhost:27017';
const dbName = 'erp_mern';

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        console.log('Connected correctly to server');

        const col = db.collection('accounts');
        const r = await col.updateOne(
            { code: '2030' },
            { $set: { code: '2030', name: 'العملاء - دفعات مقدمة (محفظة)', type: 'liability', isSystem: true } },
            { upsert: true }
        );

        console.log('Account 2030 created/updated:', r);
    } catch (err) {
        console.error(err.stack);
    } finally {
        await client.close();
    }
}

run();
