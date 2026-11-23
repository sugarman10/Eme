import Item from '../models/Item.js';
import mongoose from 'mongoose';

/**
 * Check if sufficient stock exists in a specific warehouse
 * @param {string} itemId - Item ID
 * @param {string} warehouseId - Warehouse ID
 * @param {number} requiredQty - Required quantity
 * @returns {Promise<{available: boolean, currentQty: number}>}
 */
export async function checkStockAvailability(itemId, warehouseId, requiredQty) {
  const item = await Item.findById(itemId);
  if (!item) {
    throw new Error('Item not found');
  }

  const warehouseStock = item.stocks.find((s) => s.warehouse.toString() === warehouseId.toString());

  const currentQty = warehouseStock ? warehouseStock.qty : 0;

  return {
    available: currentQty >= requiredQty,
    currentQty,
  };
}

/**
 * Deduct stock from a specific warehouse (Atomic, allows negative stock)
 * Updates both stocks array and totalStock field
 *
 * @param {string} itemId - Item ID
 * @param {string} warehouseId - Warehouse ID
 * @param {number} qty - Quantity to deduct
 * @param {object} session - MongoDB session for transaction
 */
export async function deductStock(itemId, warehouseId, qty, session = null) {
  if (!itemId || !mongoose.Types.ObjectId.isValid(String(itemId))) {
    return { _id: itemId, skipped: true };
  }

  const whObjId = new mongoose.Types.ObjectId(warehouseId);
  const deductQty = Number(qty || 0);

  // 1. Try updating existing warehouse entry in stocks array (negative balance allowed)
  const result = await Item.updateOne(
    {
      _id: itemId,
      'stocks.warehouse': whObjId,
    },
    {
      $inc: {
        'stocks.$.qty': -deductQty,
        totalStock: -deductQty,
        stock: -deductQty,
      },
    },
    { session }
  );

  // 2. If warehouse entry didn't exist yet on this item, push a new warehouse stock entry with negative qty
  if (result.matchedCount === 0) {
    const item = await Item.findById(itemId).session(session);
    if (!item) throw new Error('Item not found');

    await Item.updateOne(
      { _id: itemId },
      {
        $push: {
          stocks: {
            warehouse: whObjId,
            qty: -deductQty,
          },
        },
        $inc: {
          totalStock: -deductQty,
          stock: -deductQty,
        },
      },
      { session }
    );
  }

  return { _id: itemId, success: true };
}

/**
 * Bulk Deduct Stock (Optimized, allows negative stock & custom item filtering)
 * @param {Array<{item: string, qty: number}>} items
 * @param {string} warehouseId
 * @param {object} session
 */
export async function deductStockBulk(items, warehouseId, session = null) {
  if (!items || items.length === 0 || !warehouseId) return { modifiedCount: 0 };

  const validItems = items.filter((line) => {
    const id = line?.item?._id || line?.item;
    return id && mongoose.Types.ObjectId.isValid(String(id));
  });

  if (validItems.length === 0) return { modifiedCount: 0 };

  const whStr = warehouseId.toString();
  const whObjId = new mongoose.Types.ObjectId(warehouseId);
  const itemIds = validItems.map((line) => line.item?._id || line.item);

  const q = Item.find({ _id: { $in: itemIds } }).select('_id stocks');
  if (session) q.session(session);
  const existingDocs = await q;
  const existingMap = new Map(existingDocs.map((d) => [d._id.toString(), d]));

  const operations = [];
  for (const line of validItems) {
    const idStr = (line.item?._id || line.item).toString();
    const doc = existingMap.get(idStr);
    if (!doc) continue;

    const deductQty = Number(line.qty || 0);
    const hasWarehouseEntry = doc.stocks?.some(
      (s) => (s.warehouse?._id || s.warehouse)?.toString() === whStr
    );

    if (hasWarehouseEntry) {
      operations.push({
        updateOne: {
          filter: {
            _id: doc._id,
            'stocks.warehouse': whObjId,
          },
          update: {
            $inc: {
              'stocks.$.qty': -deductQty,
              totalStock: -deductQty,
              stock: -deductQty,
            },
          },
        },
      });
    } else {
      operations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $push: {
              stocks: {
                warehouse: whObjId,
                qty: -deductQty,
              },
            },
            $inc: {
              totalStock: -deductQty,
              stock: -deductQty,
            },
          },
        },
      });
    }
  }

  if (operations.length === 0) return { modifiedCount: 0 };

  const result = await Item.bulkWrite(operations, { session });
  return result;
}

/**
 * Add stock to a specific warehouse
 * Updates both stocks array and totalStock field
 * @param {string} itemId - Item ID
 * @param {string} warehouseId - Warehouse ID
 * @param {number} qty - Quantity to add
 * @param {object} session - MongoDB session for transaction
 */
export async function addStock(itemId, warehouseId, qty, session = null) {
  if (!itemId || !mongoose.Types.ObjectId.isValid(String(itemId))) {
    return null;
  }

  const item = await Item.findById(itemId).session(session);
  if (!item) {
    throw new Error('Item not found');
  }

  // Find warehouse in stocks array
  const warehouseStock = item.stocks.find((s) => s.warehouse.toString() === warehouseId.toString());

  if (warehouseStock) {
    // Warehouse exists, increment qty
    warehouseStock.qty += qty;
  } else {
    // Warehouse doesn't exist, add it
    item.stocks.push({
      warehouse: new mongoose.Types.ObjectId(warehouseId),
      qty,
    });
  }

  // Update totalStock
  item.totalStock = item.stocks.reduce((sum, s) => sum + s.qty, 0);

  // Update legacy stock field
  item.stock = item.totalStock;

  await item.save({ session });

  return item;
}

/**
 * Transfer stock between warehouses (atomic operation)
 * Creates StockLedger entries for audit trail
 *
 * @param {Object} transferData - Transfer data
 * @param {string} transferData.itemId - Item ID
 * @param {string} transferData.fromWarehouseId - Source warehouse ID
 * @param {string} transferData.toWarehouseId - Destination warehouse ID
 * @param {number} transferData.qty - Quantity to transfer
 * @param {string} [transferData.note] - Optional note
 * @param {string} [transferData.userId] - User performing the transfer
 * @param {object} session - MongoDB session for transaction (required)
 * @returns {Promise<{success: boolean, ref: string}>}
 */
export async function transferStock(transferData, session) {
  const { itemId, fromWarehouseId, toWarehouseId, qty, note = '', ref = '', userId = null } = transferData;

  // Validation
  if (!session) {
    throw new Error('Session is required for stock transfer');
  }
  if (fromWarehouseId.toString() === toWarehouseId.toString()) {
    throw new Error('Source and destination warehouses must be different');
  }
  if (qty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }

  // Deduct from source
  await deductStock(itemId, fromWarehouseId, qty, session);

  // Add to destination
  await addStock(itemId, toWarehouseId, qty, session);

  // Create StockLedger entries for audit trail
  const StockLedger = (await import('../models/StockLedger.js')).default;
  const refCode = ref || transferData.refCode || `TRF-${Date.now()}`;

  // OUT from source
  await StockLedger.create(
    [
      {
        item: itemId,
        warehouse: fromWarehouseId,
        type: 'MOVE',
        qty: -qty,
        ref: refCode,
        note: note ? `${note} (تحويل صادر)` : 'تحويل مخزني صادر',
        user: userId,
      },
    ],
    { session }
  );

  // IN to destination
  await StockLedger.create(
    [
      {
        item: itemId,
        warehouse: toWarehouseId,
        type: 'MOVE',
        qty: qty,
        ref: refCode,
        note: note ? `${note} (تحويل وارد)` : 'تحويل مخزني وارد',
        user: userId,
      },
    ],
    { session }
  );

  return { success: true, ref: refCode };
}

/**
 * Calculate weighted average cost
 * Formula: ((oldQty * oldCost) + (newQty * newCost)) / (oldQty + newQty)
 * @param {number} oldQty - Current total quantity
 * @param {number} oldCost - Current average cost
 * @param {number} newQty - New quantity being added
 * @param {number} newCost - Cost of new quantity
 * @returns {number} - New weighted average cost
 */
export function calculateWeightedAverageCost(oldQty, oldCost, newQty, newCost) {
  if (oldQty + newQty === 0) return 0;

  const totalValue = oldQty * oldCost + newQty * newCost;
  const totalQty = oldQty + newQty;

  return totalValue / totalQty;
}

/**
 * Update item cost using weighted average
 * @param {string} itemId - Item ID
 * @param {number} newQty - New quantity being added
 * @param {number} newCost - Cost of new quantity
 * @param {object} session - MongoDB session for transaction
 */
export async function updateWeightedAverageCost(itemId, newQty, newCost, session = null) {
  const item = await Item.findById(itemId).session(session);
  if (!item) {
    throw new Error('Item not found');
  }

  const oldQty = Math.max(0, item.totalStock || 0);
  const oldCost = item.cost || 0;

  const newAvgCost = calculateWeightedAverageCost(oldQty, oldCost, newQty, newCost);

  item.cost = newAvgCost;
  await item.save({ session });

  return item;
}
