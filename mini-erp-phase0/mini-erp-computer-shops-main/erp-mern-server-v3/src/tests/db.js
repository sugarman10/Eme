import mongoose from 'mongoose';
import User from '../models/User.js';
import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import SalesInvoice from '../models/SalesInvoice.js';
import Receipt from '../models/Receipt.js';
// We'll trust that mongoose.models.AuditLog is available or use safe delete
// import AuditLog from '../models/AuditLog.js';

export const connectDB = async () => {
  if (mongoose.connection.readyState !== 0) return;

  // Explicit fixed Test DB - No fallback "smartness"
  const dbUri = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/erp-test-db';

  // Check if we are in test mode just to be safe, though filename implies it.
  if (process.env.NODE_ENV !== 'test') {
    console.warn('⚠️ connectDB called but NODE_ENV is not test!');
  }

  console.log(`🔌 Connecting to Fixed Test DB: ${dbUri}`);

  try {
    await mongoose.connect(dbUri);
  } catch (error) {
    console.error('❌ DB Connection failed:', error);
    throw error;
  }
};

export const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
};

export const clearDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};

import Customer from '../models/Customer.js';
import Item from '../models/Item.js';

export const resetTestDb = async () => {
  if (mongoose.connection.readyState === 0) return;

  // Ordered deletion if necessary, though simpler is just parallel
  await Promise.all([
    User.deleteMany({}),
    Account.deleteMany({}),
    JournalEntry.deleteMany({}),
    SalesInvoice.deleteMany({}),
    Receipt.deleteMany({}),
    Customer.deleteMany({}),
    Item.deleteMany({}),
    // Handle AuditLog dynamically since it might not have a model file exported or circular dep
    mongoose.connection
      .collection('auditlogs')
      .deleteMany({})
      .catch(() => {}),
  ]);
};
