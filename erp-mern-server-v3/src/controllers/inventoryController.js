import mongoose from 'mongoose';
import { transferStock, addStock, deductStock } from '../services/stockService.js';
import StockLedger from '../models/StockLedger.js';
import Item from '../models/Item.js';
import Warehouse from '../models/Warehouse.js';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';

/**
 * Get Stock Movements (List)
 */
export async function getStockMovements(filters = {}, pagination = {}) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.warehouse) query.warehouse = filters.warehouse;
    if (filters.type) query.type = filters.type;
    if (filters.item) query.item = filters.item;
    if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const [movements, total] = await Promise.all([
        StockLedger.find(query)
            .populate('item', 'name sku')
            .populate('warehouse', 'name code')
            .populate('user', 'name') // Assuming user field exists or will be added
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        StockLedger.countDocuments(query)
    ]);

    return {
        movements,
        total,
        page,
        pages: Math.ceil(total / limit)
    };
}

/**
 * Add Manual Stock Movement (Adjustment)
 * Atomic Transaction
 */
export async function addStockMovement(movementData, userId = null) {
    const session = await mongoose.startSession();
    try {
        await session.startTransaction();

        const {
            item,
            warehouse,
            qty,
            type, // 'IN' or 'OUT'
            note = '',
            ref = ''
        } = movementData;

        // Validate Item and Warehouse existence
        const itemDoc = await Item.findById(item).session(session);
        if (!itemDoc) throw new Error('Item not found');

        const warehouseDoc = await Warehouse.findById(warehouse).session(session);
        if (!warehouseDoc) throw new Error('Warehouse not found');

        // Perform Stock Adjustment (Atomic)
        if (type === 'IN') {
            await addStock(item, warehouse, qty, session);
        } else if (type === 'OUT') {
            await deductStock(item, warehouse, qty, session);
        } else {
            throw new Error('Invalid movement type. Must be IN or OUT.');
        }

        // Create Ledger Entry
        const movement = await StockLedger.create([{
            item,
            warehouse,
            type: type === 'IN' ? 'ADJ_IN' : 'ADJ_OUT', // Use specific types for adjustments
            qty: type === 'IN' ? qty : -qty,
            ref: ref || `ADJ-${Date.now()}`,
            note: note || 'Manual Adjustment',
            user: userId
        }], { session });

        await session.commitTransaction();
        return movement[0];

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

/**
 * Transfer stock between warehouses with atomic transaction
 * 
 * Flow:
 * 1. Start MongoDB Session
 * 2. Validate source warehouse has sufficient stock
 * 3. Deduct from source warehouse
 * 4. Add to destination warehouse
 * 5. Create StockLedger entries for both movements
 * 6. Commit or Rollback
 */
/**
 * Transfer stock between warehouses with atomic transaction
 * 
 * Flow:
 * 1. Start MongoDB Session
 * 2. Validate source warehouse has sufficient stock
 * 3. Deduct from source warehouse (Atomic $inc)
 * 4. Add to destination warehouse (Atomic $inc or $push)
 * 5. Create StockLedger entries for both movements
 * 6. Commit or Rollback
 */
export async function transferStockBetweenWarehouses(transferData) {
    const session = await mongoose.startSession();

    try {
        await session.startTransaction();

        const {
            item,
            fromWarehouse,
            toWarehouse,
            qty,
            note = '',
            ref = ''
        } = transferData;

        // 0. Validate Inputs
        if (fromWarehouse === toWarehouse) {
            throw new Error('Source and destination warehouses must be different');
        }
        if (qty <= 0) {
            throw new Error('Quantity must be greater than zero');
        }

        // 1. Validate Source Stock
        const itemDoc = await Item.findById(item).session(session);
        if (!itemDoc) throw new Error('Item not found');

        const sourceStockEntry = itemDoc.stocks.find(s => s.warehouse.toString() === fromWarehouse.toString());
        if (!sourceStockEntry || sourceStockEntry.qty < qty) {
            throw new Error(`Insufficient stock in source warehouse. Available: ${sourceStockEntry ? sourceStockEntry.qty : 0}`);
        }

        // 2. Deduct from Source (Atomic)
        await Item.updateOne(
            { _id: item, 'stocks.warehouse': fromWarehouse },
            {
                $inc: { 'stocks.$.qty': -qty, totalStock: -qty }
            }
        ).session(session);

        // 3. Add to Destination (Atomic)
        // Check if destination warehouse exists in stocks array
        const destExists = itemDoc.stocks.find(s => s.warehouse.toString() === toWarehouse.toString());

        if (destExists) {
            // Case A: Update existing warehouse stock
            await Item.updateOne(
                { _id: item, 'stocks.warehouse': toWarehouse },
                {
                    $inc: { 'stocks.$.qty': qty, totalStock: qty }
                }
            ).session(session);
        } else {
            // Case B: Push new warehouse stock
            await Item.updateOne(
                { _id: item },
                {
                    $push: { stocks: { warehouse: toWarehouse, qty: qty } },
                    $inc: { totalStock: qty }
                }
            ).session(session);
        }

        // 4. Create StockLedger Entries
        const refCode = ref || `TRANS-${Date.now()}`;

        // OUT from source
        await StockLedger.create([{
            item,
            warehouse: fromWarehouse,
            type: 'MOVE',
            qty: -qty, // Negative for deduction
            ref: refCode,
            note: note || 'Stock transfer OUT',
            user: transferData.user // Pass user if available
        }], { session });

        // IN to destination
        await StockLedger.create([{
            item,
            warehouse: toWarehouse,
            type: 'MOVE',
            qty: qty, // Positive for addition
            ref: refCode,
            note: note || 'Stock transfer IN',
            user: transferData.user // Pass user if available
        }], { session });

        // Calculate legacy stock (just in case, though totalStock is handled above)
        // We do a final consistency update for legacy 'stock' field to match totalStock
        // Re-read item to get fresh totalStock if needed, or just $inc legacy field too.
        // For safety/simplicity, let's trust totalStock $inc above. 
        // But the legacy `stock` field is not inside `stocks` array, it's root level.
        // We should update it too. To keep it simple, we run a background sync or just include it in $inc above.
        // Since we split the updates, let's just run a final set to ensure consistency.
        await Item.findByIdAndUpdate(item, [{ $set: { stock: '$totalStock' } }], { session });

        // ===== Commit Transaction =====
        await session.commitTransaction();

        return {
            success: true,
            message: 'Stock transferred successfully',
            ref: refCode
        };

    } catch (error) {
        // ===== Rollback on Error =====
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}
/**
 * Add New Item with Image
 */
import Category from '../models/Category.js';

/**
 * Helper: Resolve Category (ID or Name) to ObjectId
 */
async function resolveCategory(input) {
    if (!input) return null;

    // 1. If valid ObjectId, return as is
    if (mongoose.Types.ObjectId.isValid(input)) {
        return input;
    }

    // 2. If String Name, Find or Create
    const name = String(input).trim();
    if (!name) return null;

    let category = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });

    if (!category) {
        category = await Category.create({ name });
        // Optional: Log new category creation
    }

    return category._id;
}

/**
 * Add New Item with Image
 */
export async function addItem(req, res) {
    const session = await mongoose.startSession();
    try {
        await session.startTransaction();

        const itemData = { ...req.body };

        // 1. Handle Image (Save Relative Path)
        if (req.file) {
            itemData.image = `/uploads/${req.file.filename}`;
        }

        // 2. Data Cleaning
        if (itemData.wholesalePrice) itemData.wholesalePrice = Number(itemData.wholesalePrice);

        // 3. Smart Category Resolution (NEW)
        itemData.category = await resolveCategory(itemData.category);

        // 4. Create Item
        const newItem = await Item.create([itemData], { session });
        const item = newItem[0];

        // 5. Handle Initial Stock (Opening Balance)
        if (req.body.initialStock && req.body.warehouse && Number(req.body.initialStock) > 0) {
            const qty = Number(req.body.initialStock);

            // Create Ledger Entry
            await StockLedger.create([{
                item: item._id,
                warehouse: req.body.warehouse,
                type: 'IN',
                qty: qty,
                ref: 'OPENING',
                note: 'Opening Balance'
            }], { session });

            // Update Item Cache (Legacy & V2)
            item.stock = qty; // Legacy
            item.totalStock = qty; // V2
            // Add to warehouse specific stock array
            item.stocks = [{
                warehouse: req.body.warehouse,
                qty: qty
            }];
            await item.save({ session });
        }

        await session.commitTransaction();
        res.status(201).json(item);

    } catch (error) {
        await session.abortTransaction();
        // Determine unique error
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Item with this SKU already exists' });
        }
        throw error;
    } finally {
        session.endSession();
    }
}

/**
 * Update Item with Image Handling
 * AUDIT: Mandatory for price changes
 */
export async function updateItem(req, res) {
    const { id } = req.params;

    // 1. Find existing item (BEFORE state for audit)
    const existingItem = await Item.findById(id);
    if (!existingItem) return res.status(404).json({ message: 'Item not found' });

    // Keep before state for audit
    const beforeState = existingItem.toObject();

    const updateData = { ...req.body };

    // 2. Handle Image Update
    if (req.file) {
        // Delete old image if it exists and is local
        if (existingItem.image && existingItem.image.startsWith('/uploads/')) {
            const oldPath = path.join(process.cwd(), existingItem.image);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath); // Fire and forget deletion
            }
        }
        // Set new path
        updateData.image = `/uploads/${req.file.filename}`;
    }

    // 3. Data Cleaning
    if (updateData.wholesalePrice) updateData.wholesalePrice = Number(updateData.wholesalePrice);

    // 4. Smart Category Resolution (NEW)
    if (updateData.category !== undefined) {
        updateData.category = await resolveCategory(updateData.category);
    }

    // Clean ObjectId fields - convert empty strings to null
    if (updateData.category === '' || updateData.category === 'null') {
        updateData.category = null;
    }

    // 5. Update (Exclude stock fields to prevent manual override via edit)
    // We strictly control stock via transactions, so we remove stock fields from direct update
    delete updateData.stock;
    delete updateData.stocks;
    delete updateData.totalStock;
    delete updateData.initialStock; // Cannot change initial stock on edit

    const updatedItem = await Item.findByIdAndUpdate(id, updateData, { new: true });

    // 6. Mandatory Audit Trail (blocks if fails)
    try {
        const { auditUpdate } = await import('../services/auditService.js');
        await auditUpdate('PRODUCT', id, beforeState, updatedItem, req.user, req.ip);
    } catch (auditError) {
        // Rollback: restore original item
        await Item.findByIdAndUpdate(id, beforeState);
        return res.status(500).json({
            message: 'تعذر حفظ سجل التدقيق، تم إلغاء العملية حفاظًا على سلامة النظام'
        });
    }

    res.json(updatedItem);
}

/**
 * Bulk Update Prices (Percentage)
 */
export async function bulkUpdatePrices(req, res) {
    const { action, value, field } = req.body;

    // Calculate Factor
    const percent = Number(value) / 100;
    const factor = action === 'increase' ? (1 + percent) : (1 - percent);

    // Safety
    if (factor < 0) return res.status(400).json({ message: 'Invalid percentage resulting in negative factor' });

    // Execute with Pipeline for atomic update
    const result = await Item.updateMany({}, [
        {
            $set: {
                [field]: { $multiply: [`$${field}`, factor] }
            }
        }
    ]);

    res.json({
        success: true,
        message: 'تم تحديث الأسعار بنجاح',
        modifiedCount: result.modifiedCount
    });
}
