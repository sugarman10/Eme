/**
 * SEED SCRIPT: Create Default Warehouse & Treasury
 * Usage: node seed-defaults.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system-db';

async function seedDefaults() {
    try {
        console.log('🌱 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;

        // 1. إنشاء مستودع افتراضي (إذا لم يوجد)
        const warehousesColl = db.collection('warehouses');
        const existingWH = await warehousesColl.findOne({});

        if (!existingWH) {
            console.log('📦 Creating Default Warehouse...');
            await warehousesColl.insertOne({
                name: 'Main Warehouse',
                location: 'Main HQ',
                manager: 'System Admin',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('✅ Created: Main Warehouse');
        } else {
            console.log('ℹ️ Warehouse already exists.');
        }

        // 2. إنشاء خزينة افتراضية (إذا لم توجد)
        const treasuriesColl = db.collection('treasuries');
        const existingTreasury = await treasuriesColl.findOne({});

        if (!existingTreasury) {
            console.log('💰 Creating Default Treasury...');
            await treasuriesColl.insertOne({
                name: 'Main Safe',
                type: 'Safe', // or 'Bank'
                balance: 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('✅ Created: Main Safe');
        } else {
            console.log('ℹ️ Treasury already exists.');
        }

    } catch (error) {
        console.error('❌ Seeding Failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Done.');
        process.exit(0);
    }
}

seedDefaults();