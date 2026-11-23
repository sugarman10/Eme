import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

async function seedAdmin() {
  try {
    console.log('🌱 Starting Admin Seeding...');
    await connectDB();

    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD;
    if (!password) { console.error('❌ ADMIN_PASSWORD غير مضبوط: عيّن كلمة المرور في متغير البيئة ADMIN_PASSWORD قبل التشغيل.'); process.exit(1); }
    const name = process.env.ADMIN_NAME || 'System Administrator';

    console.log(`🔍 Checking if admin exists with email: ${email}`);

    const hashedPassword = await bcrypt.hash(password, 10);

    const adminData = {
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      permissions: ['*'], // Full access
    };

    const user = await User.findOneAndUpdate(
      { email },
      { $set: adminData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✅ Admin user seeded successfully:');
    console.log(`   - ID: ${user._id}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Role: ${user.role}`);

  } catch (error) {
    console.error('❌ Seeding Failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Database connection closed.');
    process.exit(0);
  }
}

seedAdmin();
