import mongoose from 'mongoose';
import dotenv from 'dotenv';
import JournalEntry from '../src/models/JournalEntry.js';

dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const entries = await JournalEntry.find({ serialNumber: { $exists: false } });
        console.log(`Found ${entries.length} entries to migrate.`);

        let count = 0;
        for (const entry of entries) {
            // Generate LEGACY serial number
            // Format: LEGACY-{YYYY}-{ID_LAST_6}
            const year = new Date(entry.date).getFullYear();
            const shortId = entry._id.toString().slice(-6);

            entry.serialNumber = `LEGACY-${year}-${shortId}`;
            entry.status = 'POSTED'; // Ensure status is set

            await entry.save();
            process.stdout.write('.');
            count++;
        }

        console.log(`\nSuccessfully migrated ${count} entries.`);
        process.exit(0);

    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrate();
