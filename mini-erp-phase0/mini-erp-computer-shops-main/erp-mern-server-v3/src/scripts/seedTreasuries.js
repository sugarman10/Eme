// Quick script to create sample treasuries
// Run with: node src/scripts/seedTreasuries.js

import 'dotenv/config';
import mongoose from 'mongoose';
import Treasury from '../models/Treasury.js';

const treasuries = [
  {
    name: 'الخزينة الرئيسية',
    type: 'safe',
    balance: 0,
  },
  {
    name: 'البنك الأهلي',
    type: 'bank',
    balance: 0,
  },
  {
    name: 'خزينة الفرع',
    type: 'safe',
    balance: 0,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erp');
    console.log('✅ Connected to MongoDB');

    // Clear existing treasuries
    await Treasury.deleteMany({});
    console.log('🗑️  Cleared existing treasuries');

    // Create new treasuries
    const created = await Treasury.insertMany(treasuries);
    console.log(`✅ Created ${created.length} treasuries:`);
    created.forEach((t) => {
      console.log(`   - ${t.name} (${t.type})`);
    });

    await mongoose.disconnect();
    console.log('✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seed();
