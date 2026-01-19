# 🎭 ERP System - 30-Day Full Simulation

## 📋 Overview

This comprehensive simulation tests the entire ERP system through realistic 30-day business scenarios including purchases, sales, inventory management, accounts payable/receivable, taxes, and expenses.

## 🎯 Objectives

1. **Full Integration Testing** - Test all system modules working together
2. **Data Validation** - Verify accounting and inventory accuracy
3. **Error Discovery** - Find bugs and gaps in business processes
4. **Performance Testing** - Assess system performance under load
5. **Reporting** - Generate comprehensive system evaluation reports

## 📊 Simulation Scope

### Covered Modules
- ✅ Purchases
- ✅ Sales (Retail & Wholesale)
- ✅ Accounts Receivable
- ✅ Accounts Payable
- ✅ Taxes (15% VAT)
- ✅ Expenses
- ✅ Inventory Management
- ✅ Financial Accounting

### Transaction Volume (30 Days)
- **Purchases:** ~50 transactions
- **Sales:** ~250 transactions
  - Retail: ~180
  - Wholesale: ~70
- **Expenses:** ~25 transactions
- **Stock Transfers:** ~10 transactions
- **Total:** ~335+ transactions

### Master Data Created
- **Accounts:** 12 financial accounts
- **Warehouses:** 3 locations
- **Suppliers:** 4 vendors
- **Customers:** 10 accounts (5 wholesale, 5 retail)
- **Products:** 50 items across 10 categories

## 📦 Installation

### Prerequisites
- Node.js 14+ installed
- ERP server running on `http://localhost:3000`
- Admin account created in the system

### Setup

1. **Install dependencies:**
```bash
cd simulation
npm install
```

2. **Configure environment** (optional):
Create `.env` file:
```env
API_URL=http://localhost:3000/api
ADMIN_EMAIL=admin@erp.com
ADMIN_PASSWORD=admin123
```

## 🚀 Running the Simulation

### Full Simulation (Recommended)
```bash
npm run simulate
```

This will:
1. Login to the system
2. Create all master data (accounts, warehouses, customers, suppliers, items)
3. Execute 30 days of transactions
4. Generate comprehensive reports

### Step-by-Step Execution

**1. Create Master Data Only:**
```bash
node 01-seed-data.js
```

**2. Run Simulation Only** (requires master data):
```bash
node 02-simulation-runner.js
```

## 📊 Generated Reports

All reports are saved to `simulation/simulation-results/` directory:

### Files Created:

1. **master-data-summary.json**
   - Summary of all created master data
   - Counts of accounts, warehouses, customers, etc.

2. **final-report.json**
   - Complete simulation summary
   - Financial statistics
   - Transaction counts
   - Errors and warnings

3. **transactions.json**
   - Detailed list of all transactions
   - Organized by type (purchases, sales, expenses, etc.)
   - Includes day number and full data

4. **simulation.log**
   - Detailed execution log
   - Timestamped entries
   - Success/error/warning messages

5. **SIMULATION_COMPLETE.txt** or **ERROR_LOG.txt**
   - Completion marker or error details

## 📈 Sample Output

```
🎬 =========================================
   ERP SYSTEM - FULL 30-DAY SIMULATION
=========================================

🔐 Logging in to ERP system...
✅ Login successful!

📝 PHASE 1: Creating Master Data
=========================================
📊 Creating Chart of Accounts...
  ✅ Created account: 1-1-001 - الخزينة الرئيسية
  ...
✅ Created 12 accounts

🏭 Creating Warehouses...
  ✅ Created warehouse: WH-001 - المستودع الرئيسي
  ...
✅ Created 3 warehouses

👥 Creating Customers...
  ...
✅ Created 10 customers

📦 Creating Items/Products...
  ...
✅ Created 50 items

🎭 PHASE 2: Running 30-Day Simulation
=========================================
========== DAY 1 ==========
💰 Purchase Order created: 25,750.00 SAR (Day 1)
💰 retail Sale created: 450.00 SAR (Paid) (Day 1)
💰 Expense recorded: Rent Expense - 7,500.00 SAR (Day 1)
✅ Day 1 complete: 5 sales, 2 purchases

========== DAY 2 ==========
...

📊 ========== SIMULATION SUMMARY ========
Period: 2025-01-01 to 2025-01-31

💰 Financial Summary:
  Total Sales: 125,450.75 SAR
  Total Purchases: 78,920.50 SAR
  Total Expenses: 35,500.00 SAR
  Gross Profit: 46,530.25 SAR
  Net Profit: 11,030.25 SAR

📦 Transaction Counts:
  Purchases: 48
  Sales: 245
    - Retail: 175
    - Wholesale: 70
    - Cash: 205
    - Credit: 40
  Expenses: 25
  Transfers: 8

⚠️  Errors: 0
⚠️  Warnings: 0

🎉 =========================================
   SIMULATION COMPLETED SUCCESSFULLY!
=========================================
```

## 🔍 Validation & Testing

### Automated Checks

The simulation automatically validates:

1. **Financial Balance:** Assets = Liabilities + Equity
2. **Inventory:** Calculated stock matches transactions
3. **Accounts Receivable:** Sales on credit - collections
4. **Accounts Payable:** Purchases on credit - payments
5. **Tax Calculations:** 15% VAT on all transactions

### Manual Verification Steps

After simulation, verify:

1. **Dashboard KPIs** - Check sales/inventory totals
2. **Financial Reports** - Review profit & loss, balance sheet
3. **Inventory Reports** - Compare stock levels
4. **Customer/Supplier Balances** - Verify outstanding amounts
5. **Tax Reports** - Confirm VAT calculations

## ⚠️ Troubleshooting

### Common Issues

**1. "Login failed"**
- Ensure server is running
- Check admin credentials
- Verify API_URL is correct

**2. "Failed to create [entity]"**
- Check server logs for validation errors
- Ensure database is accessible
- Required fields might be missing

**3. "Simulation completed with errors"**
- Review `ERROR_LOG.txt` in results directory
- Check missing/incompatible API endpoints
- Verify database constraints

**4. Performance issues**
- Reduce transaction count in `02-simulation-runner.js`
- Add delays between transactions
- Check database/server resources

## 🛠️ Customization

### Modify Transaction Volume

Edit `02-simulation-runner.js`:

```javascript
// Change number of sales per day
const numRetailSales = randomInt(3, 8); // Reduce from 8-15

// Change purchase frequency
if (dayType >= 1 && dayType <= 3) {  // Only Mon-Wed instead of Mon-Fri
```

### Add Custom Scenarios

Create new transaction generators:

```javascript
async function createCustomTransaction(day) {
  // Your custom logic here
}

// Call in runDay()
await createCustomTransaction(day);
```

### Modify Master Data

Edit `MASTER_DATA` object in `01-seed-data.js` to change:
- Item catalog
- Customer list
- Chart of accounts
- Warehouse locations

## 📝 Notes

- Simulation uses date range: Jan 1-31, 2025
- All amounts in SAR (Saudi Riyal)
- VAT rate: 15%
- Transactions are created sequentially (day 1, then day 2, etc.)
- Random variations ensure realistic data distribution

## 🤝 Support

For issues or questions:
1. Check `simulation.log` for detailed execution info
2. Review `ERROR_LOG.txt` if simulation failed
3. Ensure all prerequisites are met
4. Contact system administrator

---

**Last Updated:** 2025-11-28  
**Version:** 1.0.0  
**Author:** ERP Development Team
