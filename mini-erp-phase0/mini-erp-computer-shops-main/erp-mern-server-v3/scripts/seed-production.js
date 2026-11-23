/**
 * SEED PRODUCTION USERS SCRIPT
 * مخصص لتهيئة مستخدمي النظام الأساسيين لأول مرة على جهاز العميل أو قاعدة بيانات جديدة
 * 
 * طريقة التشغيل:
 * 1. محلياً: node scripts/seed-production.js
 * 2. سحابياً (Atlas): node scripts/seed-production.js "mongodb+srv://user:pass@cluster0.mongodb.net/erp_mern"
 * كلمات المرور إلزامية من متغيرات البيئة: ADMIN_PASSWORD وACCOUNTANT_PASSWORD وCASHIER_PASSWORD.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Warehouse from '../src/models/Warehouse.js';

// تحديد رابط الاتصال: من وسائط الأمر أولاً، ثم من .env، ثم المحلي الافتراضي
const MONGO_URI = process.argv[2] || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erp_mern';

// كلمات المرور إلزامية من متغيرات البيئة — لا توجد كلمات مرور افتراضية.
function requiredSeedPassword(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ ${name} غير مضبوط: عيّن كلمة المرور في متغير البيئة ${name} قبل التشغيل.`);
    process.exit(1);
  }
  return value;
}

const DEFAULT_USERS = [
  {
    username: 'admin',
    name: 'مدير النظام الرئيسي',
    email: 'admin@core-erp.local',
    plainPassword: requiredSeedPassword('ADMIN_PASSWORD'),
    role: 'admin',
    permissions: ['*'],
    isActive: true,
  },
  {
    username: 'accountant',
    name: 'المحاسب المالي',
    email: 'accountant@core-erp.local',
    plainPassword: requiredSeedPassword('ACCOUNTANT_PASSWORD'),
    role: 'accountant',
    permissions: ['finance', 'reports', 'expenses', 'audit'],
    isActive: true,
  },
  {
    username: 'cashier',
    name: 'كاشير المبيعات',
    email: 'cashier@core-erp.local',
    plainPassword: requiredSeedPassword('CASHIER_PASSWORD'),
    role: 'cashier',
    permissions: ['pos'],
    isActive: true,
  },
];

async function seedUsers() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌱 بدء تهيئة مستخدمي نظام ERP الأساسيين للإنتاج');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    console.log(`📡 جاري الاتصال بقاعدة البيانات...`);
    await mongoose.connect(MONGO_URI);
    console.log(`✅ تم الاتصال بنجاح بقاعدة البيانات!\n`);

    // البحث عن مستودع رئيسي لربطه بالكاشير والمدير افتراضياً
    let defaultWarehouse = await Warehouse.findOne({ isActive: true });
    if (!defaultWarehouse) {
      // إنشاء مستودع افتراضي إن لم يوجد لضمان فتح شاشة الـ POS فوراً
      defaultWarehouse = await Warehouse.create({
        name: 'المستودع الرئيسي',
        code: 'WH-01',
        isDefault: true,
        isActive: true,
      });
      console.log('📦 تم إنشاء المستودع الافتراضي: المستودع الرئيسي');
    }

    console.log('👤 جاري إنشاء وتحديث المستخدمين...');

    for (const u of DEFAULT_USERS) {
      const hashedPassword = await bcrypt.hash(u.plainPassword, 10);

      const userData = {
        username: u.username,
        name: u.name,
        email: u.email,
        password: hashedPassword,
        role: u.role,
        permissions: u.permissions,
        isActive: u.isActive,
        assignedWarehouse: defaultWarehouse._id,
      };

      await User.findOneAndUpdate(
        { username: u.username },
        { $set: userData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log('\n✅ تم إنشاء/تحديث جميع المستخدمين بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 بيانات تسجيل الدخول الجاهزة للعميل:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣  مدير النظام (كامل الصلاحيات):');
    console.log('    - اسم المستخدم : admin');
    console.log('    - كلمة المرور  : (مضبوطة من متغير البيئة)');
    console.log('───────────────────────────────────────────────────');
    console.log('2️⃣  المحاسب المالي (المالية والتقارير):');
    console.log('    - اسم المستخدم : accountant');
    console.log('    - كلمة المرور  : (مضبوطة من متغير البيئة)');
    console.log('───────────────────────────────────────────────────');
    console.log('3️⃣  الكاشير (نقاط البيع POS):');
    console.log('    - اسم المستخدم : cashier');
    console.log('    - كلمة المرور  : (مضبوطة من متغير البيئة)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 نصيحة: يمكن للعميل تغيير كلمات المرور لاحقاً من شاشة "المستخدمين" في لوحة التحكم.');

  } catch (error) {
    console.error('❌ حدث خطأ أثناء تهيئة المستخدمين:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 تم إغلاق الاتصال بقاعدة البيانات.');
    process.exit(0);
  }
}

seedUsers();
