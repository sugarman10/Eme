import mongoose from 'mongoose';
import Item from '../models/Item.js';
import Category from '../models/Category.js';

/**
 * Calculate the virtual stock for a bundle in a specific warehouse
 * Virtual stock = min( floor(component_stock / component_required_qty) )
 *
 * @param {Object|string} bundle - Bundle item object or ID
 * @param {string} warehouseId - Target warehouse ID
 * @param {Object} session - Optional MongoDB session
 * @returns {Promise<{ virtualStock: number, isAvailable: boolean, componentsStatus: Array }>}
 */
export async function calculateBundleVirtualStock(bundle, warehouseId, session = null) {
  let bundleDoc = bundle;
  if (typeof bundle === 'string' || !bundle.bundleComponents) {
    const q = Item.findById(bundle);
    if (session) q.session(session);
    bundleDoc = await q;
  }

  if (!bundleDoc || !bundleDoc.isBundle || !bundleDoc.bundleComponents?.length) {
    return { virtualStock: 0, isAvailable: false, componentsStatus: [] };
  }

  const componentItemIds = bundleDoc.bundleComponents.map((c) => c.item?._id || c.item);
  const qComp = Item.find({ _id: { $in: componentItemIds } });
  if (session) qComp.session(session);
  const componentDocs = await qComp;
  const compMap = new Map(componentDocs.map((doc) => [doc._id.toString(), doc]));

  let minUnits = Infinity;
  const componentsStatus = [];

  for (const comp of bundleDoc.bundleComponents) {
    const compId = (comp.item?._id || comp.item).toString();
    const doc = compMap.get(compId);
    const reqQty = Number(comp.qty || 1);

    if (!doc) {
      minUnits = 0;
      componentsStatus.push({
        itemId: compId,
        name: comp.name || 'عنصر غير متوفر',
        requiredQty: reqQty,
        availableQty: 0,
        unitsPossible: 0,
        isSufficient: false,
      });
      continue;
    }

    const whStock = doc.stocks?.find(
      (s) => (s.warehouse?._id || s.warehouse).toString() === warehouseId?.toString()
    );
    const availableQty = whStock ? Number(whStock.qty || 0) : 0;
    const unitsPossible = Math.floor(availableQty / reqQty);

    if (unitsPossible < minUnits) {
      minUnits = unitsPossible;
    }

    componentsStatus.push({
      itemId: doc._id.toString(),
      name: doc.name,
      sku: doc.sku,
      requiredQty: reqQty,
      availableQty,
      unitsPossible,
      isSufficient: unitsPossible >= 1,
    });
  }

  const virtualStock = minUnits === Infinity ? 0 : Math.max(0, minUnits);

  return {
    virtualStock,
    isAvailable: virtualStock > 0,
    componentsStatus,
  };
}

/**
 * Prepare and resolve items (standard, bundle components, & custom items) for checkout.
 * Note: Negative stock is permitted — does NOT throw an Insufficient Stock error.
 *
 * @param {Array} items - Invoice items array [{ item, qty, isBundle, isCustom, name }]
 * @param {string} warehouseId - Warehouse ID
 * @param {Object} session - MongoDB session
 */
export async function validateStockForCheckout(items, warehouseId, session = null) {
  const physicalQtyNeeded = new Map();
  const docMap = new Map();

  if (!items?.length) return { physicalQtyNeeded, docMap };

  // 1. Fetch all registered items mentioned in the invoice lines (skip custom items without valid ObjectId)
  const itemIds = items
    .map((i) => i.item?._id || i.item)
    .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)));

  if (itemIds.length > 0) {
    const qItems = Item.find({ _id: { $in: itemIds } });
    if (session) qItems.session(session);
    const invoiceDocs = await qItems;
    for (const d of invoiceDocs) {
      docMap.set(d._id.toString(), d);
    }
  }

  // 2. Identify bundles and fetch their components
  const bundleComponentIds = new Set();
  for (const line of items) {
    const rawId = line.item?._id || line.item;
    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) continue;

    const doc = docMap.get(rawId.toString());
    const isBundle = Boolean(doc?.isBundle || line.isBundle);
    const components = doc?.bundleComponents?.length ? doc.bundleComponents : (line.bundleComponents || []);
    if (isBundle && components.length) {
      for (const c of components) {
        const cId = c.item?._id || c.item;
        if (cId && mongoose.Types.ObjectId.isValid(String(cId))) {
          bundleComponentIds.add(cId.toString());
        }
      }
    }
  }

  // Fetch all component items if needed
  if (bundleComponentIds.size > 0) {
    const qComps = Item.find({ _id: { $in: Array.from(bundleComponentIds) } });
    if (session) qComps.session(session);
    const compDocs = await qComps;
    for (const cd of compDocs) {
      docMap.set(cd._id.toString(), cd);
    }
  }

  // 3. Aggregate total required quantities for each registered physical product
  for (const line of items) {
    const rawId = line.item?._id || line.item;
    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
      // Custom unregistered item — skip physical stock map
      continue;
    }

    const itemId = rawId.toString();
    const doc = docMap.get(itemId);
    if (!doc) {
      if (line.isCustom || line.name) {
        continue;
      }
      throw new Error(`المنتج غير موجود: ${itemId}`);
    }

    const lineQty = Number(line.qty || 1);
    const isBundle = Boolean(doc?.isBundle || line.isBundle);
    const components = doc?.bundleComponents?.length ? doc.bundleComponents : (line.bundleComponents || []);

    if (isBundle && components.length) {
      // It's a bundle -> need components
      const bundleDisplayName = line.name || doc.name || 'تجميعة مخصصة';
      for (const comp of components) {
        const rawCompId = comp.item?._id || comp.item;
        if (!rawCompId || !mongoose.Types.ObjectId.isValid(String(rawCompId))) continue;
        const compId = rawCompId.toString();
        const compDoc = docMap.get(compId);
        const compName = compDoc?.name || comp.name || compId;
        const totalCompNeeded = lineQty * Number(comp.qty || 1);

        const current = physicalQtyNeeded.get(compId) || {
          name: compName,
          neededQty: 0,
          isComponentOf: bundleDisplayName,
        };
        current.neededQty += totalCompNeeded;
        physicalQtyNeeded.set(compId, current);
      }
    } else {
      // Standard item
      const current = physicalQtyNeeded.get(itemId) || {
        name: doc.name,
        neededQty: 0,
        isComponentOf: null,
      };
      current.neededQty += lineQty;
      physicalQtyNeeded.set(itemId, current);
    }
  }

  // 4. Negative stock is permitted: we do NOT throw Insufficient Stock errors here.
  return { physicalQtyNeeded, docMap };
}

/**
 * Expand invoice items into physical deductions for bulk stock operations.
 * Standard items are deducted as-is; bundles are broken down into their individual components.
 * Custom items (without a registered Item document) are skipped safely.
 *
 * @param {Array} items - Invoice items array
 * @param {Map} docMap - Pre-fetched map of item documents
 * @returns {{ deductionItems: Array, ledgerEntries: Array }}
 */
export function preparePhysicalDeductions(items, docMap, warehouseId, invoiceRef, invoiceNumber, date) {
  const aggregatedDeductions = new Map(); // itemId -> qty
  const ledgerEntries = [];

  for (const line of items) {
    const rawId = line.item?._id || line.item;
    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
      // Custom unregistered item -> no physical inventory deduction
      continue;
    }

    const itemId = rawId.toString();
    const doc = docMap?.get(itemId);
    if (!doc) {
      // Not a registered physical item in DB
      continue;
    }

    const lineQty = Number(line.qty || 1);
    const isBundle = Boolean(doc?.isBundle || line.isBundle);
    const components = doc?.bundleComponents?.length ? doc.bundleComponents : (line.bundleComponents || []);

    if (isBundle && components.length) {
      // Bundle: deduct each component
      const bundleDisplayName = line.name || doc?.name || 'تجميعة مخصصة';
      for (const comp of components) {
        const rawCompId = comp.item?._id || comp.item;
        if (!rawCompId || !mongoose.Types.ObjectId.isValid(String(rawCompId))) continue;
        const compId = rawCompId.toString();
        const compDoc = docMap?.get(compId);
        if (!compDoc) continue;

        const compName = compDoc?.name || comp.name || 'مكون تجميعة';
        const deductQty = lineQty * Number(comp.qty || 1);

        const cur = aggregatedDeductions.get(compId) || 0;
        aggregatedDeductions.set(compId, cur + deductQty);

        ledgerEntries.push({
          item: compId,
          warehouse: warehouseId,
          type: 'OUT',
          qty: -deductQty,
          ref: invoiceRef,
          note: `فاتورة مبيعات ${invoiceNumber} (مكون تجميعة: ${bundleDisplayName} - ${compName})`,
          date,
        });
      }
    } else {
      // Standard item: deduct directly
      const cur = aggregatedDeductions.get(itemId) || 0;
      aggregatedDeductions.set(itemId, cur + lineQty);

      ledgerEntries.push({
        item: itemId,
        warehouse: warehouseId,
        type: 'OUT',
        qty: -lineQty,
        ref: invoiceRef,
        note: `فاتورة مبيعات ${invoiceNumber}`,
        date,
      });
    }
  }

  const deductionItems = Array.from(aggregatedDeductions.entries()).map(([itemId, qty]) => ({
    item: itemId,
    qty,
  }));

  return { deductionItems, ledgerEntries };
}

/**
 * Expand returned items into physical stock restorations.
 * If a returned line is a bundle, breaks it down into individual components to restore physical stock.
 *
 * @param {Array} returnItems - SalesReturn items array
 * @param {Map} docMap - Pre-fetched map of item documents
 * @param {string} warehouseId - Warehouse ID
 * @param {string} returnRef - Reference string for StockLedger
 * @param {string} returnNumber - Return number for notes
 * @param {Date} date - Return date
 * @returns {{ restorationItems: Array, ledgerEntries: Array }}
 */
export function preparePhysicalRestorations(returnItems, docMap, warehouseId, returnRef, returnNumber, date) {
  const aggregatedRestorations = new Map(); // itemId -> qty
  const ledgerEntries = [];

  for (const line of returnItems) {
    const rawId = line.item?._id || line.item;
    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
      continue;
    }

    const itemId = rawId.toString();
    const doc = docMap?.get(itemId);
    const lineQty = Number(line.qty || 1);
    const isBundle = Boolean(doc?.isBundle || line.isBundle);
    const components = line.bundleComponents?.length ? line.bundleComponents : (doc?.bundleComponents || []);

    if (isBundle && components.length) {
      // Bundle: restore each individual physical component
      const bundleDisplayName = line.name || doc?.name || 'تجميعة مخصصة';
      for (const comp of components) {
        const rawCompId = comp.item?._id || comp.item;
        if (!rawCompId || !mongoose.Types.ObjectId.isValid(String(rawCompId))) continue;
        const compId = rawCompId.toString();
        const compDoc = docMap?.get(compId);
        const compName = compDoc?.name || comp.name || 'مكون تجميعة';
        const restoreQty = lineQty * Number(comp.qty || 1);

        const cur = aggregatedRestorations.get(compId) || 0;
        aggregatedRestorations.set(compId, cur + restoreQty);

        const serialsNote = comp.serials && comp.serials.length ? ` [سيريال: ${comp.serials.join(', ')}]` : '';
        ledgerEntries.push({
          item: compId,
          warehouse: warehouseId,
          type: 'SALES_RETURN',
          qty: restoreQty,
          ref: returnRef,
          note: `مرتجع مبيعات ${returnNumber} (إرجاع مكون من تجميعة: ${bundleDisplayName} - ${compName})${serialsNote}`,
          date,
        });
      }
    } else {
      // Standard item: restore physical stock directly
      const cur = aggregatedRestorations.get(itemId) || 0;
      aggregatedRestorations.set(itemId, cur + lineQty);

      const serialsNote = line.serials && line.serials.length ? ` [سيريال: ${line.serials.join(', ')}]` : '';
      const parentNote = line.parentBundle ? ' (مكون منفرد من تجميعة)' : '';
      ledgerEntries.push({
        item: itemId,
        warehouse: warehouseId,
        type: 'SALES_RETURN',
        qty: lineQty,
        ref: returnRef,
        note: `مرتجع مبيعات ${returnNumber}${parentNote}${serialsNote}`,
        date,
      });
    }
  }

  const restorationItems = Array.from(aggregatedRestorations.entries()).map(([itemId, qty]) => ({
    item: itemId,
    qty,
  }));

  return { restorationItems, ledgerEntries };
}

/**
 * Find or create the master template item for Custom Bundles created on the fly in POS
 */
export async function getOrCreateCustomBundleTemplate() {
  let template = await Item.findOne({ sku: 'CUSTOM-BUNDLE' });
  if (!template) {
    let catDoc = null;
    try {
      catDoc = await Category.findOne({ name: 'تجميعات' });
      if (!catDoc) {
        catDoc = await Category.create({ name: 'تجميعات', description: 'تجميعات وباقات مخصصة' });
      }
    } catch {
      catDoc = null;
    }

    template = await Item.create({
      name: 'تجميعة كمبيوتر مخصصة',
      sku: 'CUSTOM-BUNDLE',
      itemType: 'bundle',
      isBundle: true,
      price: 0,
      cost: 0,
      totalStock: 9999,
      unit: 'تجميعة',
      category: catDoc?._id || null,
      bundleComponents: [],
    });
  }
  return template;
}
