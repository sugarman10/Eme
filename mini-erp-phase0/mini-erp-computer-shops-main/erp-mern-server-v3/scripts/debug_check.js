
import mongoose from 'mongoose';
import User from './src/models/User.js';
import SalesInvoice from './src/models/SalesInvoice.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        console.log('\n--- USERS ---');
        const users = await User.find({}, 'name email role assignedWarehouse');
        users.forEach(u => {
            console.log(`User: ${u.name} | Role: ${u.role} | Warehouse: ${u.assignedWarehouse} | ID: ${u._id}`);
        });

        console.log('\n--- LAST 5 INVOICES ---');
        const invoices = await SalesInvoice.find().sort({ createdAt: -1 }).limit(5).select('number cashier createdAt totals.grand');
        invoices.forEach(inv => {
            console.log(`Inv: ${inv.number} | CashierID: ${inv.cashier} | Date: ${inv.createdAt} | Total: ${inv.totals?.grand}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
