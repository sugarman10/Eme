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

    const warehouseStock = item.stocks.find(
        s => s.warehouse.toString() === warehouseId.toString()
    );

    const currentQty = warehouseStock ? warehouseStock.qty : 0;

    return {
        available: currentQty >= requiredQty,
        currentQty
    };
}

/**
 * Deduct stock from a specific warehouse
 * Updates both stocks array and totalStock field
 * @param {string} itemId - Item ID
 * @param {string} warehouseId - Warehouse ID
 * @param {number} qty - Quantity to deduct
 * @param {object} session - MongoDB session for transaction
 */
/**
 * Deduct stock from a specific warehouse (Atomic)
 * Updates both stocks array and totalStock field
 * 
 * ✅ FIXED: Race Condition Prevention
 * Uses DB-level condition to ensure stock never goes below zero.
 * 
 * @param {string} itemId - Item ID
 * @param {string} warehouseId - Warehouse ID
 * @param {number} qty - Quantity to deduct
 * @param {object} session - MongoDB session for transaction
 */
export async function deductStock(itemId, warehouseId, qty, session = null) {
    // 1. Atomic Update (Check & Deduct in one go)
    // We search for the item WHERE stock >= qty
    const result = await Item.updateOne(
        {
            _id: itemId,
            'stocks': {
                $elemMatch: {
                    warehouse: warehouseId,
                    qty: { $gte: qty } // ✅ CRITICAL: Atomic Constraint
                }
            }
        },
        {
            $inc: {
                'stocks.$.qty': -qty,
                totalStock: -qty,
                stock: -qty // Keep legacy field in sync
            }
        },
        { session }
    );

    // 2. Handle Failure
    if (result.modifiedCount === 0) {
        // We need to know WHY it failed to give a good error message
        // A) Item doesn't exist?
        // B) Warehouse doesn't exist?
        // C) Insufficient stock?

        const item = await Item.findById(itemId).session(session);
        if (!item) throw new Error('Item not found');

        const warehouseStock = item.stocks.find(s => s.warehouse.toString() === warehouseId.toString());
        if (!warehouseStock) throw new Error('Item not available in warehouse');

        // If we are here, it means stock < qty (Concurrency caught this, or just logic)
        throw new Error(`Insufficient stock for ${item.name}. Available: ${warehouseStock.qty}, Required: ${qty}`);
    }

    // Return updated document for reference (optional, requires another read if needed)
    // But efficiency wise, we just return true or the id. 
    // The original contract returned 'item', let's fetch it if strictly needed, 
    // or better, just return true to save bandwidth. 
    // For compatibility with legacy code calling this, let's fetch the lightweight version or rely on caller re-fetching.
    // Ideally, we shouldn't re-fetch unless necessary.

    return { _id: itemId, success: true };
}

/**
 * Bulk Deduct Stock (Optimized)
 * @param {Array<{item: string, qty: number}>} items 
 * @param {string} warehouseId 
 * @param {object} session 
 */
export async function deductStockBulk(items, warehouseId, session = null) {
    if (!items || items.length === 0) return;

    // Construct Bulk Operations
    // Each op is an updateOne with the atomic condition logic
    const operations = items.map(line => ({
        updateOne: {
            filter: {
                _id: line.item,
                'stocks': {
                    $elemMatch: {
                        warehouse: warehouseId,
                        qty: { $gte: line.qty }
                    }
                }
            },
            update: {
                $inc: {
                    'stocks.$.qty': -line.qty,
                    totalStock: -line.qty,
                    stock: -line.qty
                }
            }
        }
    }));

    // Execute Bulk Write
    const result = await Item.bulkWrite(operations, { session });

    // Validate if all items were updated
    // If matchedCount < items.length, it means some items failed the condition (Insufficient Stock or Not Found)
    if (result.modifiedCount !== items.length) {
        throw new Error(`فشل خصم المخزون - رصيد غير كافٍ لبعض الأصناف (Bulk Operation Failed). Success: ${result.modifiedCount}/${items.length}`);
    }

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
    const item = await Item.findById(itemId).session(session);
    if (!item) {
        throw new Error('Item not found');
    }

    // Find warehouse in stocks array
    const warehouseStock = item.stocks.find(
        s => s.warehouse.toString() === warehouseId.toString()
    );

    if (warehouseStock) {
        // Warehouse exists, increment qty
        warehouseStock.qty += qty;
    } else {
        // Warehouse doesn't exist, add it
        item.stocks.push({
            warehouse: new mongoose.Types.ObjectId(warehouseId),
            qty
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
 * @param {string} itemId - Item ID
 * @param {string} fromWarehouseId - Source warehouse ID
 * @param {string} toWarehouseId - Destination warehouse ID
 * @param {number} qty - Quantity to transfer
 * @param {object} session - MongoDB session for transaction
 */
export async function transferStock(itemId, fromWarehouseId, toWarehouseId, qty, session = null) {
    // Deduct from source
    await deductStock(itemId, fromWarehouseId, qty, session);

    // Add to destination
    await addStock(itemId, toWarehouseId, qty, session);
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

    const totalValue = (oldQty * oldCost) + (newQty * newCost);
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

    const oldQty = item.totalStock || 0;
    const oldCost = item.cost || 0;

    const newAvgCost = calculateWeightedAverageCost(oldQty, oldCost, newQty, newCost);

    item.cost = newAvgCost;
    await item.save({ session });

    return item;
}
