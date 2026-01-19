/**
 * Test: Actually Approve a Draft Sales Return
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import SalesReturn from '../models/SalesReturn.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import StockLedger from '../models/StockLedger.js';
import SalesInvoice from '../models/SalesInvoice.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/erp';

async function approveReturn() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Get the draft return
            const sr = await SalesReturn.findOne({ status: 'draft' }).session(session);

            if (!sr) {
                console.log('No draft returns found');
                await session.abortTransaction();
                session.endSession();
                process.exit(0);
            }

            console.log(`\nApproving return: ${sr._id}`);
            console.log('Warehouse:', sr.warehouse);

            const warehouseId = sr.warehouse;

            // Process each item
            for (const rItem of sr.items) {
                console.log(`\nProcessing item: ${rItem.item}, qty: ${rItem.qty}`);

                const product = await Item.findById(rItem.item).session(session);
                if (!product) {
                    throw new Error(`Item not found: ${rItem.item}`);
                }

                console.log(`  Product: ${product.name}`);
                console.log(`  Before stocks:`, product.stocks.map(s => ({ w: s.warehouse.toString().slice(-6), qty: s.qty })));

                // Find or add stock entry
                const stockIdx = product.stocks.findIndex(
                    s => s.warehouse.toString() === warehouseId.toString()
                );

                if (stockIdx > -1) {
                    product.stocks[stockIdx].qty += rItem.qty;
                    console.log(`  Updated stock at index ${stockIdx}: +${rItem.qty}`);
                } else {
                    product.stocks.push({ warehouse: warehouseId, qty: rItem.qty });
                    console.log(`  Added new stock entry: +${rItem.qty}`);
                }

                product.totalStock += rItem.qty;
                await product.save({ session });

                console.log(`  After stocks:`, product.stocks.map(s => ({ w: s.warehouse.toString().slice(-6), qty: s.qty })));

                // Create stock ledger entry
                await StockLedger.create([{
                    item: product._id,
                    warehouse: warehouseId,
                    type: 'SALES_RETURN',
                    qty: rItem.qty,
                    ref: `RET-SALE#${sr._id.toString().slice(-6)}`,
                    note: `مرتجع مبيعات - ${rItem.reason || 'غير محدد'}`,
                    date: new Date()
                }], { session });
            }

            // Update customer balance
            if (sr.customer) {
                await Customer.findByIdAndUpdate(sr.customer, {
                    $inc: { balance: -sr.totalAmount }
                }, { session });
                console.log(`\nCustomer balance reduced by: ${sr.totalAmount}`);
            }

            // Update original invoice
            const returnRecords = sr.items.map(item => ({
                item: item.item,
                qty: item.qty,
                date: new Date(),
                note: `Return #${sr._id.toString().slice(-6)}`
            }));

            await SalesInvoice.findByIdAndUpdate(sr.originalInvoice, {
                $push: { returns: { $each: returnRecords } }
            }, { session });

            // Update return status
            sr.status = 'returned';
            sr.approvedAt = new Date();
            await sr.save({ session });

            await session.commitTransaction();
            session.endSession();

            console.log('\n✅ Return approved successfully!');
            console.log('Status updated to: returned');

        } catch (txError) {
            await session.abortTransaction();
            session.endSession();
            throw txError;
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

approveReturn();
