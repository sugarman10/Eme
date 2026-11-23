import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import 'dotenv/config';

async function resetBob() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/erp-db');
        console.log('Connected to DB');

        const email = 'bob@example.com';
        const password = process.env.BOB_PASSWORD;
        if (!password) {
            console.error('❌ BOB_PASSWORD غير مضبوط: عيّن كلمة المرور في متغير البيئة BOB_PASSWORD قبل التشغيل.');
            process.exit(1);
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const updated = await User.findOneAndUpdate(
            { email },
            {
                name: 'Bob Admin',
                email,
                password: hashedPassword,
                role: 'admin',
                isActive: true
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('User "Bob" reset successfully:');
        console.log('Email:', email);
        console.log('Role:', updated.role);

        process.exit(0);
    } catch (err) {
        console.error('Failed to reset Bob:', err);
        process.exit(1);
    }
}

resetBob();
