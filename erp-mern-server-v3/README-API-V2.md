# ERP Backend API V2 - Implementation Guide

## 🎯 Overview

This implementation follows the **Backend Specification V2** with:
- ✅ Multi-warehouse inventory management
- ✅ Atomic transactions using MongoDB sessions
- ✅ Weighted average cost calculation
- ✅ Auto-increment invoice numbering
- ✅ Comprehensive financial tracking

---

## 📦 New Models

### Counter
Auto-increment counter for invoice numbers.
```javascript
{ name: 'invoice', seq: 1234 }
```

### Category
Product categorization.
```javascript
{ name: 'Electronics', description: 'Electronic devices' }
```

### Treasury
Financial accounts (Safe/Bank).
```javascript
{ name: 'Main Safe', balance: 50000, type: 'safe' }
```

### Transaction
Financial transaction ledger.
```javascript
{
  type: 'income',
  flow: 'in',
  amount: 1500,
  treasury: ObjectId,
  relatedId: ObjectId, // Invoice/PO ID
  relatedModel: 'SalesInvoice',
  description: 'Payment from invoice INV-00123'
}
```

---

## 🔄 Updated Models

### Item (Multi-Warehouse)
```javascript
{
  sku: 'PROD-001',
  name: 'Product Name',
  barcode: '123456789',
  category: ObjectId,
  brand: 'Brand Name',
  cost: 50, // Weighted average cost
  price: 100,
  wholesalePrice: 80,
  minStock: 5,
  
  // Multi-warehouse stocks
  stocks: [
    { warehouse: ObjectId('warehouse1'), qty: 100 },
    { warehouse: ObjectId('warehouse2'), qty: 50 }
  ],
  
  // Stored field for efficient queries
  totalStock: 150
}
```

### SalesInvoice
```javascript
{
  number: 'INV-00123', // Auto-generated
  date: Date,
  customer: ObjectId,
  cashier: ObjectId, // User who created
  channel: 'retail',
  items: [{
    item: ObjectId,
    qty: 10,
    price: 100,
    cost: 50 // For profit calculation
  }],
  warehouse: ObjectId, // Source warehouse
  treasury: ObjectId, // Target treasury
  totals: {
    subtotal: 1000,
    discount: 50,
    tax: 0,
    grand: 950,
    paid: 500,
    remaining: 450
  }
}
```

---

## 🚀 New API Endpoints

### 1. Create Sales Invoice (Atomic)

**Endpoint:** `POST /api/sales/v2/invoice-v2`

**Features:**
- ✅ Validates stock availability
- ✅ Auto-generates invoice number
- ✅ Deducts stock from specific warehouse
- ✅ Creates financial transaction
- ✅ Updates treasury balance
- ✅ Validates customer credit limit
- ✅ **Rolls back everything on error**

**Request:**
```json
{
  "items": [
    { "item": "item_id", "qty": 10, "price": 100 }
  ],
  "customer": "customer_id",
  "channel": "retail",
  "warehouse": "warehouse_id",
  "treasury": "treasury_id",
  "paid": 500,
  "discountValue": 50,
  "paymentMethod": "cash"
}
```

**Response:**
```json
{
  "number": "INV-00123",
  "totals": {
    "grand": 950,
    "paid": 500,
    "remaining": 450
  },
  "status": "confirmed"
}
```

---

### 2. Receive Purchase Order (Weighted Average)

**Endpoint:** `PATCH /api/procurement/v2/purchase-orders/:id/receive`

**Features:**
- ✅ Calculates weighted average cost
- ✅ Updates item cost automatically
- ✅ Adds stock to warehouse
- ✅ Creates expense transaction
- ✅ Updates supplier balance

**Request:**
```json
{
  "treasury": "treasury_id",
  "paidAmount": 5000
}
```

**Formula:**
```
New Cost = ((oldQty * oldCost) + (newQty * newCost)) / (oldQty + newQty)

Example:
- Current: 100 units @ $5 = $500
- Purchase: 50 units @ $8 = $400
- New Cost: ($500 + $400) / (100 + 50) = $6
```

---

### 3. Transfer Stock Between Warehouses

**Endpoint:** `POST /api/inventory/v2/stock/transfer`

**Features:**
- ✅ Atomic transfer (deduct + add in one transaction)
- ✅ Validates source warehouse stock
- ✅ Creates StockLedger entries
- ✅ Updates totalStock automatically

**Request:**
```json
{
  "item": "item_id",
  "fromWarehouse": "warehouse_a_id",
  "toWarehouse": "warehouse_b_id",
  "qty": 50,
  "note": "Restocking branch"
}
```

---

## 🧪 Testing Guide

### Test 1: Multi-Warehouse Stock
```bash
# 1. Create product with stock in Warehouse A
POST /api/inventory/items
{
  "sku": "TEST-001",
  "name": "Test Product",
  "price": 100,
  "warehouse": "warehouse_a_id",
  "initialStock": 100
}

# 2. Create sale from Warehouse A (should succeed)
POST /api/sales/v2/invoice-v2
{
  "items": [{ "item": "test_product_id", "qty": 10, "price": 100 }],
  "warehouse": "warehouse_a_id"
}

# 3. Create sale from Warehouse B (should FAIL - insufficient stock)
POST /api/sales/v2/invoice-v2
{
  "items": [{ "item": "test_product_id", "qty": 10, "price": 100 }],
  "warehouse": "warehouse_b_id"
}
# Expected: Error "رصيد غير كافٍ"

# 4. Transfer stock A → B
POST /api/inventory/v2/stock/transfer
{
  "item": "test_product_id",
  "fromWarehouse": "warehouse_a_id",
  "toWarehouse": "warehouse_b_id",
  "qty": 50
}

# 5. Retry sale from Warehouse B (should succeed now)
```

### Test 2: Atomic Transaction Rollback
```javascript
// Simulate error during invoice creation
// Stock should NOT be deducted
// Treasury balance should NOT change
```

### Test 3: Weighted Average Cost
```bash
# 1. Create product
POST /api/inventory/items
{ "sku": "AVG-001", "name": "Avg Test", "cost": 0 }

# 2. First purchase: 10 units @ $5
POST /api/procurement/v2/purchase-orders
{
  "supplier": "supplier_id",
  "warehouse": "warehouse_id",
  "items": [{ "item": "avg_test_id", "qty": 10, "cost": 5 }]
}
PATCH /api/procurement/v2/purchase-orders/:id/receive

# Check: Item cost should be $5

# 3. Second purchase: 5 units @ $8
POST /api/procurement/v2/purchase-orders
{
  "supplier": "supplier_id",
  "warehouse": "warehouse_id",
  "items": [{ "item": "avg_test_id", "qty": 5, "cost": 8 }]
}
PATCH /api/procurement/v2/purchase-orders/:id/receive

# Check: Item cost should be $6
# Formula: ((10 * 5) + (5 * 8)) / (10 + 5) = 90 / 15 = $6
```

---

## ⚠️ Important Notes

### Backward Compatibility
- ✅ Model name remains `Item` (not renamed to Product)
- ✅ API endpoints remain `/api/inventory/items`
- ✅ Field `channel` kept in SalesInvoice
- ✅ Legacy `stock` field maintained for StockLedger compatibility

### Performance Optimization
- ✅ `totalStock` is a **stored field** (not virtual)
- ✅ Auto-updated by stock services
- ✅ Enables efficient filtering and sorting
- ✅ Indexed `stocks.warehouse` for fast lookups

### Error Handling
All V2 endpoints use MongoDB transactions:
- ✅ Any error triggers automatic rollback
- ✅ Database remains consistent
- ✅ No partial updates

---

## 📊 Database Migration

If you have existing data, you need to migrate:

```javascript
// Migration script to add stocks array to existing items
db.items.find().forEach(item => {
  if (!item.stocks) {
    // Assume all existing stock is in default warehouse
    const defaultWarehouse = ObjectId('default_warehouse_id');
    db.items.updateOne(
      { _id: item._id },
      {
        $set: {
          stocks: [{ warehouse: defaultWarehouse, qty: item.stock || 0 }],
          totalStock: item.stock || 0
        }
      }
    );
  }
});
```

---

## 🎓 Usage Examples

### Complete Sales Flow
```javascript
// 1. Create treasury
POST /api/finance/treasuries
{ "name": "Main Safe", "type": "safe" }

// 2. Create warehouse
POST /api/inventory/warehouses
{ "code": "WH-01", "name": "Main Warehouse" }

// 3. Create item with stock
POST /api/inventory/items
{
  "sku": "PROD-001",
  "name": "Product 1",
  "price": 100,
  "cost": 50,
  "warehouse": "warehouse_id",
  "initialStock": 100
}

// 4. Create customer
POST /api/sales/customers
{
  "code": "CUST-001",
  "name": "Customer 1",
  "creditLimit": 10000
}

// 5. Create invoice (ATOMIC)
POST /api/sales/v2/invoice-v2
{
  "items": [{ "item": "item_id", "qty": 10, "price": 100 }],
  "customer": "customer_id",
  "warehouse": "warehouse_id",
  "treasury": "treasury_id",
  "paid": 500,
  "channel": "retail"
}
```

---

## 🔧 Services API

### counterService
```javascript
import { generateInvoiceNumber } from './services/counterService.js';
const invoiceNum = await generateInvoiceNumber('INV'); // INV-00001
```

### stockService
```javascript
import { checkStockAvailability, deductStock, addStock, transferStock } from './services/stockService.js';

// Check availability
const { available, currentQty } = await checkStockAvailability(itemId, warehouseId, qty);

// Deduct (with session for transaction)
await deductStock(itemId, warehouseId, qty, session);

// Add
await addStock(itemId, warehouseId, qty, session);

// Transfer
await transferStock(itemId, fromWarehouseId, toWarehouseId, qty, session);
```

### transactionService
```javascript
import { createIncomeTransaction, createExpenseTransaction } from './services/transactionService.js';

// Income
await createIncomeTransaction({
  amount: 1000,
  treasury: treasuryId,
  relatedId: invoiceId,
  relatedModel: 'SalesInvoice',
  description: 'Sale payment'
}, session);
```

---

## ✅ Implementation Checklist

- [x] Counter model for auto-increment
- [x] Category model
- [x] Treasury model
- [x] Transaction model
- [x] Updated User model (username, permissions, isActive)
- [x] Updated Item model (multi-warehouse stocks array)
- [x] Updated SalesInvoice model (number, cashier, cost, treasury, warehouse)
- [x] Updated Supplier model (company, balance)
- [x] Updated PurchaseOrder model (warehouse, totalAmount, paidAmount)
- [x] counterService (auto-increment)
- [x] stockService (check, deduct, add, transfer, weighted avg)
- [x] transactionService (income, expense, treasury updates)
- [x] salesController (atomic invoice creation)
- [x] procurementController (weighted average costing)
- [x] inventoryController (atomic stock transfer)
- [x] V2 Routes registered in index.js

---

## 🎉 Ready to Use!

The backend is now fully implemented according to Specification V2.

**New Endpoints:**
- `POST /api/sales/v2/invoice-v2` - Atomic sales
- `PATCH /api/procurement/v2/purchase-orders/:id/receive` - Weighted avg
- `POST /api/inventory/v2/stock/transfer` - Atomic transfer

**Start the server:**
```bash
npm start
```

**Test the endpoints using Postman or your frontend!**
