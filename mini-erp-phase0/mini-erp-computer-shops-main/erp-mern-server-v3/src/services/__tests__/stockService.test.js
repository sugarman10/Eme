import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { checkStockAvailability, deductStock, addStock } from '../stockService.js';
import Item from '../../models/Item.js';

/**
 * Unit Tests for Stock Service
 *
 * Run: npm test
 */

describe('Stock Service Tests', () => {
  let testItem;
  let testWarehouse;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/erp_test');

    // Create test warehouse
    testWarehouse = new mongoose.Types.ObjectId();

    // Create test item
    testItem = await Item.create({
      sku: 'TEST-001',
      name: 'Test Product',
      price: 100,
      cost: 50,
      stocks: [{ warehouse: testWarehouse, qty: 100 }],
      totalStock: 100,
    });
  });

  afterAll(async () => {
    // Cleanup
    await Item.deleteMany({ sku: /^TEST-/ });
    await mongoose.disconnect();
  });

  describe('checkStockAvailability', () => {
    it('should return true when stock is available', async () => {
      const result = await checkStockAvailability(testItem._id, testWarehouse, 50);

      expect(result.available).toBe(true);
      expect(result.currentQty).toBe(100);
    });

    it('should return false when stock is insufficient', async () => {
      const result = await checkStockAvailability(testItem._id, testWarehouse, 150);

      expect(result.available).toBe(false);
      expect(result.currentQty).toBe(100);
    });
  });

  describe('deductStock', () => {
    it('should deduct stock correctly', async () => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await deductStock(testItem._id, testWarehouse, 20, session);
        await session.commitTransaction();

        const updated = await Item.findById(testItem._id);
        const whStock = updated.stocks.find((s) => s.warehouse.equals(testWarehouse));

        expect(whStock.qty).toBe(80);
        expect(updated.totalStock).toBe(80);
      } finally {
        await session.endSession();
      }
    });

    it('should throw error when insufficient stock', async () => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await expect(deductStock(testItem._id, testWarehouse, 200, session)).rejects.toThrow('رصيد غير كافٍ');

        await session.abortTransaction();
      } finally {
        await session.endSession();
      }
    });
  });

  describe('addStock', () => {
    it('should add stock correctly', async () => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await addStock(testItem._id, testWarehouse, 50, session);
        await session.commitTransaction();

        const updated = await Item.findById(testItem._id);
        const whStock = updated.stocks.find((s) => s.warehouse.equals(testWarehouse));

        expect(whStock.qty).toBe(130); // 80 + 50
        expect(updated.totalStock).toBe(130);
      } finally {
        await session.endSession();
      }
    });
  });
});
