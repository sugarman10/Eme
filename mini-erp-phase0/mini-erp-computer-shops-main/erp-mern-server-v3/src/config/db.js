import mongoose from 'mongoose';
import logger from './logger.js';

export default async function connectDB() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI missing in env');
    // خيارات آمنة وحديثة
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10s to select server
      socketTimeoutMS: 60000, // 60s socket timeout (matches frontend)
      maxPoolSize: 10, // Connection pool
      minPoolSize: 2,
      autoIndex: true,
    });
    logger.logSuccess(`MongoDB connected: ${conn.connection.host}`, { database: conn.connection.name });
  } catch (error) {
    logger.logError('MongoDB connection error:', error.message);
    process.exit(1);
  }
}
