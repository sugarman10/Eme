import mongoose from 'mongoose';
import User from './models/User.js';
import 'dotenv/config';

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/erp-db'); // Adjust URI if needed
        console.log('Connected to DB');

        const users = await User.find({}, 'name email role isActive');
        console.log('Users found:', users.length);
        console.log(JSON.stringify(users, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
