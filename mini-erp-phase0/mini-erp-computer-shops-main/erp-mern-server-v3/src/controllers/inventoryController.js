import mongoose from 'mongoose';
import { addStock, deductStock, transferStock } from '../services/stockService.js';
import StockLedger from '../models/StockLedger.js';
import Item from '../models/Item.js';
import Warehouse from '../models/Warehouse.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import SalesInvoice from '../models/SalesInvoice.js';
import StockTransfer from '../models/StockTransfer.js';
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
    StockLedger.countDocuments(query),
  ]);

  return {
    movements,
    total,
    page,
    pages: Math.ceil(total / limit),
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
      ref = '',
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
    const movement = await StockLedger.create(
      [
        {
          item,
          warehouse,
          type: type === 'IN' ? 'ADJ_IN' : 'ADJ_OUT', // Use specific types for adjustments
          qty: type === 'IN' ? qty : -qty,
          ref: ref || `ADJ-${Date.now()}`,
          note: note || 'Manual Adjustment',
          user: userId,
        },
      ],
      { session }
    );

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
 * Uses centralized transferStock from stockService
 */
export async function transferStockBetweenWarehouses(transferData) {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { item, fromWarehouse, toWarehouse, qty, note = '', ref = '', user } = transferData;

    // Use centralized service function
    const result = await transferStock(
      {
        itemId: item,
        fromWarehouseId: fromWarehouse,
        toWarehouseId: toWarehouse,
        qty,
        note,
        userId: user,
      },
      session
    );

    // Sync legacy stock field
    await Item.findByIdAndUpdate(item, [{ $set: { stock: '$totalStock' } }], { session });

    await session.commitTransaction();

    return {
      success: true,
      message: 'Stock transferred successfully',
      ref: result.ref,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Transfer multiple items between warehouses in a single atomic transaction (Transfer Invoice)
 */
export async function transferStockBatch(batchData) {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { fromWarehouse, toWarehouse, items, note = '', ref = '', user } = batchData;

    if (!fromWarehouse || !toWarehouse) {
      throw new Error('المخزن المصدر والمخزن المستلم مطلوبان');
    }

    if (fromWarehouse.toString() === toWarehouse.toString()) {
      throw new Error('لا يمكن التحويل لنفس المخزن، يجب اختيار مخزنين مختلفين');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('يجب إضافة صنف واحد على الأقل في فاتورة التحويل');
    }

    const refCode = ref || `TRF-${Date.now()}`;
    const results = [];

    for (const line of items) {
      const { item, qty, note: lineNote } = line;
      const numQty = Number(qty);
      if (!item || isNaN(numQty) || numQty <= 0) {
        throw new Error('الكمية المحولة لكل صنف يجب أن تكون أكبر من صفر');
      }

      // Check current stock in source warehouse within session
      const itemDoc = await Item.findById(item).session(session);
      if (!itemDoc) {
        throw new Error(`الصنف غير موجود: ${item}`);
      }

      const sourceStockEntry = itemDoc.stocks?.find(
        (s) => (s.warehouse?._id || s.warehouse)?.toString() === fromWarehouse.toString()
      );
      const availableQty = Number(sourceStockEntry?.qty || 0);

      if (numQty > availableQty) {
        throw new Error(
          `رصيد الصنف "${itemDoc.name}" في المخزن المصدر غير كافٍ. المتاح: ${availableQty}، المطلوب تحويله: ${numQty}`
        );
      }

      // Execute transfer for this item
      const res = await transferStock(
        {
          itemId: item,
          fromWarehouseId: fromWarehouse,
          toWarehouseId: toWarehouse,
          qty: numQty,
          note: lineNote || note || 'إذن تحويل مخزني',
          ref: refCode,
          userId: user,
        },
        session
      );

      // Sync legacy stock field
      await Item.findByIdAndUpdate(item, [{ $set: { stock: '$totalStock' } }], { session });

      results.push({ item: itemDoc.name, qty: numQty, ref: res.ref });
    }

    // Record StockTransfer document for history & audit
    await StockTransfer.create(
      [
        {
          transferNumber: refCode,
          fromWarehouse,
          toWarehouse,
          date: new Date(),
          status: 'completed',
          items: items.map((l) => ({
            item: l.item,
            name: l.name || '',
            sku: l.sku || '',
            qty: Number(l.qty),
            note: l.note || '',
          })),
          totalItems: items.length,
          totalQuantity: items.reduce((sum, l) => sum + Number(l.qty || 0), 0),
          note,
          user,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return {
      success: true,
      message: `تم ترحيل إذن التحويل بنجاح (${items.length} صنف)`,
      ref: refCode,
      results,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Get Stock Transfers History (List)
 */
export async function getStockTransfers(req, res) {
  try {
    const { page = 1, limit = 20, q = '', fromWarehouse, toWarehouse } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};
    if (fromWarehouse) filter.fromWarehouse = fromWarehouse;
    if (toWarehouse) filter.toWarehouse = toWarehouse;
    if (q) {
      filter.$or = [
        { transferNumber: { $regex: q, $options: 'i' } },
        { note: { $regex: q, $options: 'i' } },
      ];
    }

    const [transfers, total] = await Promise.all([
      StockTransfer.find(filter)
        .populate('fromWarehouse', 'name code')
        .populate('toWarehouse', 'name code')
        .populate('user', 'name')
        .populate('cancelledBy', 'name')
        .populate('items.item', 'name sku barcode image uom')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      StockTransfer.countDocuments(filter),
    ]);

    res.json({
      transfers,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    console.error('getStockTransfers error:', error);
    res.status(500).json({ message: 'فشل جلب سجل التحويلات المخزنية', error: error.message });
  }
}

/**
 * Cancel and Reverse a Stock Transfer
 */
export async function cancelStockTransfer(req, res) {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'معرف التحويل غير صالح' });
    }

    const transfer = await StockTransfer.findById(id).populate('items.item');
    if (!transfer) {
      return res.status(404).json({ message: 'إذن التحويل غير موجود' });
    }

    if (transfer.status === 'cancelled') {
      return res.status(400).json({ message: 'إذن التحويل ملغى مسبقاً' });
    }

    // 1. Pre-validate that toWarehouse has enough stock for each item before reversing
    for (const line of transfer.items) {
      const itemId = line.item?._id || line.item;
      const itemDoc = await Item.findById(itemId);
      if (!itemDoc) {
        return res.status(400).json({ message: `الصنف (${line.name || line.sku}) غير موجود في النظام` });
      }

      const whStock = (itemDoc.stocks || []).find(
        (s) => s.warehouse?.toString() === transfer.toWarehouse.toString()
      );
      const availableAtDest = Number(whStock?.qty || 0);

      if (availableAtDest < Number(line.qty)) {
        return res.status(400).json({
          message: `لا يمكن إلغاء التحويل: رصيد الصنف "${itemDoc.name}" في المخزن المستلم (${availableAtDest}) أقل من الكمية المطلوب عكسها (${line.qty})`,
        });
      }
    }

    // 2. Execute reversal inside MongoDB transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Atomic Lock: Mark as cancelled atomically within session
      // If another concurrent request already marked it cancelled, updatedTransfer will be null
      const updatedTransfer = await StockTransfer.findOneAndUpdate(
        { _id: id, status: { $ne: 'cancelled' } },
        {
          $set: {
            status: 'cancelled',
            cancelledBy: userId,
            cancelledAt: new Date(),
            cancelReason: reason || 'إلغاء وتراجع عن إذن التحويل',
          },
        },
        { session, new: true }
      );

      if (!updatedTransfer) {
        throw new Error('إذن التحويل ملغى مسبقاً أو غير موجود');
      }

      for (const line of transfer.items) {
        const itemId = line.item?._id || line.item;
        const numQty = Number(line.qty);

        // Deduct from destination warehouse
        await deductStock(itemId, transfer.toWarehouse, numQty, session);

        // Add back to source warehouse
        await addStock(itemId, transfer.fromWarehouse, numQty, session);

        // Sync legacy stock field
        await Item.findByIdAndUpdate(itemId, [{ $set: { stock: '$totalStock' } }], { session });

        // Create reversal audit entries in StockLedger
        await StockLedger.create(
          [
            {
              item: itemId,
              warehouse: transfer.toWarehouse,
              type: 'MOVE',
              qty: -numQty,
              ref: transfer.transferNumber,
              note: `إلغاء إذن تحويل (إرجاع صادر للمصدر) - ${reason || 'تراجع عن التحويل'}`,
              user: userId,
            },
            {
              item: itemId,
              warehouse: transfer.fromWarehouse,
              type: 'MOVE',
              qty: numQty,
              ref: transfer.transferNumber,
              note: `إلغاء إذن تحويل (استعادة رصيد وارد) - ${reason || 'تراجع عن التحويل'}`,
              user: userId,
            },
          ],
          { session, ordered: true }
        );
      }

      await session.commitTransaction();

      res.json({
        success: true,
        message: `تم إلغاء إذن التحويل (${updatedTransfer.transferNumber}) وعكس الكميات للمخزن المصدر بنجاح`,
        transfer: updatedTransfer,
      });
    } catch (txError) {
      await session.abortTransaction();
      throw txError;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('cancelStockTransfer error:', error);
    res.status(500).json({
      message: error.message || 'فشل إلغاء إذن التحويل وعكس المخزون',
      error: error.message,
    });
  }
}

/**
 * Add New Item with Image
 */
import Category from '../models/Category.js';

/**
 * Helper: Resolve Category (ID or Name) to ObjectId
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveCategory(input) {
  if (!input) return null;

  // 1. If valid ObjectId, return as is if exists
  if (mongoose.Types.ObjectId.isValid(input)) {
    const existing = await Category.findById(input);
    if (existing) return existing._id;
  }

  // 2. If String Name, Find or Create
  const name = String(input).trim();
  if (!name) return null;

  // First try exact string match
  let category = await Category.findOne({ name });

  // Then try case-insensitive match with regex escaping
  if (!category) {
    const escaped = escapeRegex(name);
    category = await Category.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
  }

  // If still not found, create new category safely
  if (!category) {
    try {
      category = await Category.create({ name });
    } catch (err) {
      if (err.code === 11000) {
        category = await Category.findOne({ name });
        if (!category) {
          const escaped = escapeRegex(name);
          category = await Category.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });
        }
      } else {
        throw err;
      }
    }
  }

  return category ? category._id : null;
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
    if (itemData.cost !== undefined) itemData.cost = Number(itemData.cost) || 0;
    if (itemData.price !== undefined) itemData.price = Number(itemData.price) || 0;
    if (itemData.wholesalePrice !== undefined) itemData.wholesalePrice = Number(itemData.wholesalePrice) || 0;
    if (itemData.minPrice !== undefined) itemData.minPrice = Number(itemData.minPrice) || 0;
    if (itemData.maxPrice !== undefined) itemData.maxPrice = Number(itemData.maxPrice) || 0;
    if (itemData.costUSD !== undefined) itemData.costUSD = Number(itemData.costUSD) || 0;
    if (itemData.priceUSD !== undefined) itemData.priceUSD = Number(itemData.priceUSD) || 0;
    if (itemData.wholesalePriceUSD !== undefined) itemData.wholesalePriceUSD = Number(itemData.wholesalePriceUSD) || 0;
    if (itemData.minPriceUSD !== undefined) itemData.minPriceUSD = Number(itemData.minPriceUSD) || 0;
    if (itemData.maxPriceUSD !== undefined) itemData.maxPriceUSD = Number(itemData.maxPriceUSD) || 0;
    if (typeof itemData.bundleComponents === 'string') {
      try {
        itemData.bundleComponents = JSON.parse(itemData.bundleComponents);
      } catch (e) {
        itemData.bundleComponents = [];
      }
    }
    if (itemData.isBundle === 'true' || itemData.isBundle === true) {
      itemData.isBundle = true;
      itemData.itemType = 'bundle';
    } else if (itemData.isBundle === 'false' || itemData.isBundle === false) {
      itemData.isBundle = false;
      itemData.itemType = 'standard';
    }

    // 3. Smart Category Resolution (NEW)
    itemData.category = await resolveCategory(itemData.category);

    // 4. Create Item
    const newItem = await Item.create([itemData], { session });
    const item = newItem[0];

    // 5. Handle Initial Stock (Opening Balance) - Only for standard items (bundles have virtual stock)
    if (!item.isBundle && req.body.initialStock && req.body.warehouse && Number(req.body.initialStock) > 0) {
      const qty = Number(req.body.initialStock);

      // Create Ledger Entry
      await StockLedger.create(
        [
          {
            item: item._id,
            warehouse: req.body.warehouse,
            type: 'IN',
            qty: qty,
            ref: 'OPENING',
            note: 'Opening Balance',
          },
        ],
        { session }
      );

      // Update Item Cache (Legacy & V2)
      item.stock = qty; // Legacy
      item.totalStock = qty; // V2
      // Add to warehouse specific stock array
      item.stocks = [
        {
          warehouse: req.body.warehouse,
          qty: qty,
        },
      ];
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
  if (updateData.cost !== undefined) updateData.cost = Number(updateData.cost) || 0;
  if (updateData.price !== undefined) updateData.price = Number(updateData.price) || 0;
  if (updateData.wholesalePrice !== undefined) updateData.wholesalePrice = Number(updateData.wholesalePrice) || 0;
  if (updateData.minPrice !== undefined) updateData.minPrice = Number(updateData.minPrice) || 0;
  if (updateData.maxPrice !== undefined) updateData.maxPrice = Number(updateData.maxPrice) || 0;
  if (updateData.costUSD !== undefined) updateData.costUSD = Number(updateData.costUSD) || 0;
  if (updateData.priceUSD !== undefined) updateData.priceUSD = Number(updateData.priceUSD) || 0;
  if (updateData.wholesalePriceUSD !== undefined) updateData.wholesalePriceUSD = Number(updateData.wholesalePriceUSD) || 0;
  if (updateData.minPriceUSD !== undefined) updateData.minPriceUSD = Number(updateData.minPriceUSD) || 0;
  if (updateData.maxPriceUSD !== undefined) updateData.maxPriceUSD = Number(updateData.maxPriceUSD) || 0;
  if (typeof updateData.bundleComponents === 'string') {
    try {
      updateData.bundleComponents = JSON.parse(updateData.bundleComponents);
    } catch (e) {
      updateData.bundleComponents = [];
    }
  }
  if (updateData.isBundle === 'true' || updateData.isBundle === true) {
    updateData.isBundle = true;
    updateData.itemType = 'bundle';
  } else if (updateData.isBundle === 'false' || updateData.isBundle === false) {
    updateData.isBundle = false;
    updateData.itemType = 'standard';
  }

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
      message: 'تعذر حفظ سجل التدقيق، تم إلغاء العملية حفاظًا على سلامة النظام',
    });
  }

  res.json(updatedItem);
}

/**
 * Bulk Update Prices (Percentage)
 */
export async function bulkUpdatePrices(req, res) {
  const { action, value, field } = req.body;

  const allowedFields = ['price', 'wholesalePrice', 'minPrice', 'maxPrice', 'cost', 'costUSD', 'priceUSD', 'wholesalePriceUSD'];
  if (!allowedFields.includes(field)) {
    return res.status(400).json({ message: `الحقل المطلوب تعديله غير مصرح به: ${field}` });
  }

  // Calculate Factor
  const percent = Number(value) / 100;
  const factor = action === 'increase' ? 1 + percent : 1 - percent;

  // Safety
  if (factor < 0) return res.status(400).json({ message: 'Invalid percentage resulting in negative factor' });

  // Execute with Pipeline for atomic update
  const result = await Item.updateMany({}, [
    {
      $set: {
        [field]: { $multiply: [`$${field}`, factor] },
      },
    },
  ]);

  res.json({
    success: true,
    message: 'تم تحديث الأسعار بنجاح',
    modifiedCount: result.modifiedCount,
  });
}

/**
 * Comprehensive Item Movement & History Card
 * Analyzes purchases, sales, stock movements, and cost variance
 */
export async function getItemHistory(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'معرف الصنف غير صالح' });
  }

  const item = await Item.findById(id)
    .populate('category', 'name')
    .populate('stocks.warehouse', 'name code');

  if (!item) {
    return res.status(404).json({ message: 'الصنف غير موجود' });
  }

  const itemId = new mongoose.Types.ObjectId(id);

  // 1. Fetch Purchases (Received or Approved POs)
  const purchaseOrders = await PurchaseOrder.find({
    'items.item': itemId,
    status: { $ne: 'cancelled' },
  })
    .populate('supplier', 'name code phone')
    .populate('warehouse', 'name code')
    .sort({ createdAt: -1 })
    .lean();

  const purchases = [];
  let totalPurchasedQty = 0;
  let totalPurchasedAmount = 0;
  let highestPurchaseCost = 0;
  let lowestPurchaseCost = Infinity;

  purchaseOrders.forEach((po) => {
    const itemLines = (po.items || []).filter((line) => (line.item?._id || line.item)?.toString() === id);
    itemLines.forEach((line) => {
      const lineCost = Number(line.cost || 0);
      const lineQty = Number(line.qty || 0);
      const lineTotal = lineCost * lineQty;

      totalPurchasedQty += lineQty;
      totalPurchasedAmount += lineTotal;

      if (lineCost > highestPurchaseCost) highestPurchaseCost = lineCost;
      if (lineCost < lowestPurchaseCost && lineCost > 0) lowestPurchaseCost = lineCost;

      const costDiff = lineCost - (item.cost || 0);
      const costDiffPct = (item.cost || 0) > 0 ? (costDiff / item.cost) * 100 : 0;

      purchases.push({
        _id: po._id,
        orderNumber: po.number || `PO-${po._id.toString().slice(-6)}`,
        date: po.receivedAt || po.createdAt,
        supplierName: po.supplier?.name || 'مورد عام',
        supplierCode: po.supplier?.code || '',
        supplierId: po.supplier?._id,
        warehouseName: po.warehouse?.name || 'المستودع الرئيسي',
        qty: lineQty,
        cost: lineCost,
        costUSD: Number(line.costUSD || (po.exchangeRate > 0 ? (lineCost / po.exchangeRate).toFixed(2) : 0)),
        exchangeRate: po.exchangeRate || 7.30,
        currency: line.currency || po.currency || 'LYD',
        total: lineTotal,
        paymentMethod: po.paymentMethod || 'credit',
        status: po.status,
        costDiff,
        costDiffPct: Math.round(costDiffPct * 10) / 10,
      });
    });
  });

  if (lowestPurchaseCost === Infinity) lowestPurchaseCost = 0;
  const lastPurchase = purchases[0] || null;
  const avgPurchaseCost = totalPurchasedQty > 0 ? totalPurchasedAmount / totalPurchasedQty : item.cost || 0;

  // 2. Fetch Sales (Confirmed / Posted SalesInvoices)
  const salesInvoices = await SalesInvoice.find({
    'items.item': itemId,
    status: { $nin: ['void', 'cancelled'] },
  })
    .populate('customer', 'name code phone')
    .populate('warehouse', 'name code')
    .sort({ date: -1 })
    .lean();

  const sales = [];
  let totalSoldQty = 0;
  let totalSalesAmount = 0;
  let totalProfit = 0;
  let highestSalePrice = 0;
  let lowestSalePrice = Infinity;

  salesInvoices.forEach((inv) => {
    const itemLines = (inv.items || []).filter((line) => (line.item?._id || line.item)?.toString() === id);
    itemLines.forEach((line) => {
      const linePrice = Number(line.price || 0);
      const lineQty = Number(line.qty || 0);
      const lineCost = Number(line.cost || item.cost || 0);
      const lineTotal = linePrice * lineQty;
      const lineProfit = (linePrice - lineCost) * lineQty;
      const profitMarginPct = linePrice > 0 ? ((linePrice - lineCost) / linePrice) * 100 : 0;

      totalSoldQty += lineQty;
      totalSalesAmount += lineTotal;
      totalProfit += lineProfit;

      if (linePrice > highestSalePrice) highestSalePrice = linePrice;
      if (linePrice < lowestSalePrice && linePrice > 0) lowestSalePrice = linePrice;

      sales.push({
        _id: inv._id,
        invoiceNumber: inv.number || `INV-${inv._id.toString().slice(-6)}`,
        date: inv.date || inv.createdAt,
        customerName: inv.customerName || inv.customer?.name || 'عميل نقدي',
        customerPhone: inv.customer?.phone || '',
        warehouseName: inv.warehouse?.name || 'المستودع الرئيسي',
        qty: lineQty,
        price: linePrice,
        cost: lineCost,
        total: lineTotal,
        profit: Math.round(lineProfit * 100) / 100,
        profitMarginPct: Math.round(profitMarginPct * 10) / 10,
        paymentMethod: inv.paymentMethod || 'cash',
        channel: inv.channel || 'retail',
      });
    });
  });

  if (lowestSalePrice === Infinity) lowestSalePrice = 0;
  const lastSale = sales[0] || null;
  const avgSalePrice = totalSoldQty > 0 ? totalSalesAmount / totalSoldQty : item.price || 0;
  const avgProfitMarginPct = totalSalesAmount > 0 ? (totalProfit / totalSalesAmount) * 100 : 0;

  // 3. Fetch Stock Movements from StockLedger
  const ledgerEntries = await StockLedger.find({ item: itemId })
    .populate('warehouse', 'name code')
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const movements = ledgerEntries.map((entry) => ({
    _id: entry._id,
    date: entry.createdAt,
    type: entry.type,
    qty: entry.qty,
    ref: entry.ref || '',
    note: entry.note || '',
    warehouseName: entry.warehouse?.name || '',
    userName: entry.user?.name || '',
  }));

  // 4. Warehouse Stock Breakdown
  const currentStock = item.totalStock ?? (item.stocks || []).reduce((acc, s) => acc + (s.qty || 0), 0);
  const warehouseBreakdown = (item.stocks || []).map((s) => ({
    warehouseId: s.warehouse?._id || s.warehouse,
    warehouseName: s.warehouse?.name || 'مستودع',
    qty: s.qty || 0,
  }));

  const isAdmin = (req.user?.role || '').toLowerCase().trim() === 'admin';

  if (!isAdmin) {
    return res.json({
      item: {
        _id: item._id,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        category: item.category?.name || 'عام',
        unit: item.unit || item.uom || 'قطعة',
        cost: 0,
        price: Number(item.price || 0),
        wholesalePrice: 0,
        minPrice: Number(item.minPrice || 0),
        maxPrice: Number(item.maxPrice || 0),
        priceUSD: Number(item.priceUSD || 0),
        costUSD: 0,
        minPriceUSD: Number(item.minPriceUSD || 0),
        maxPriceUSD: Number(item.maxPriceUSD || 0),
        totalStock: currentStock,
        warehouses: warehouseBreakdown,
        isBundle: item.isBundle || false,
      },
      stats: {
        currentStock,
        totalSoldQty,
        avgSalePrice: Math.round(avgSalePrice * 100) / 100,
        lastSalePrice: lastSale ? lastSale.price : item.price || 0,
        lastSaleDate: lastSale ? lastSale.date : null,
        highestSalePrice,
        lowestSalePrice,
      },
      purchases: [],
      sales: sales.map((s) => {
        const { cost, profit, profitMarginPct, ...safeSale } = s;
        return safeSale;
      }),
      movements,
    });
  }

  res.json({
    item: {
      _id: item._id,
      sku: item.sku,
      name: item.name,
      barcode: item.barcode,
      category: item.category?.name || 'عام',
      unit: item.unit || item.uom || 'قطعة',
      cost: Number(item.cost || 0),
      price: Number(item.price || 0),
      wholesalePrice: Number(item.wholesalePrice || 0),
      minPrice: Number(item.minPrice || 0),
      maxPrice: Number(item.maxPrice || 0),
      priceUSD: Number(item.priceUSD || 0),
      costUSD: Number(item.costUSD || 0),
      minPriceUSD: Number(item.minPriceUSD || 0),
      maxPriceUSD: Number(item.maxPriceUSD || 0),
      totalStock: currentStock,
      warehouses: warehouseBreakdown,
      isBundle: item.isBundle || false,
    },
    stats: {
      // Inventory
      currentStock,
      currentStockValue: Math.round(currentStock * (item.cost || 0) * 100) / 100,

      // Purchases
      totalPurchasedQty,
      totalPurchasedAmount: Math.round(totalPurchasedAmount * 100) / 100,
      avgPurchaseCost: Math.round(avgPurchaseCost * 100) / 100,
      lastPurchaseCost: lastPurchase ? lastPurchase.cost : item.cost || 0,
      lastPurchaseDate: lastPurchase ? lastPurchase.date : null,
      lastSupplierName: lastPurchase ? lastPurchase.supplierName : null,
      highestPurchaseCost,
      lowestPurchaseCost,

      // Sales
      totalSoldQty,
      totalSalesAmount: Math.round(totalSalesAmount * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgSalePrice: Math.round(avgSalePrice * 100) / 100,
      avgProfitMarginPct: Math.round(avgProfitMarginPct * 10) / 10,
      lastSalePrice: lastSale ? lastSale.price : item.price || 0,
      lastSaleDate: lastSale ? lastSale.date : null,
      highestSalePrice,
      lowestSalePrice,

      // Variance analysis (Current price vs current cost)
      unitMargin: Math.round(((item.price || 0) - (item.cost || 0)) * 100) / 100,
      unitMarginPct:
        (item.price || 0) > 0 ? Math.round((((item.price || 0) - (item.cost || 0)) / item.price) * 1000) / 10 : 0,
    },
    purchases,
    sales,
    movements,
  });
}
