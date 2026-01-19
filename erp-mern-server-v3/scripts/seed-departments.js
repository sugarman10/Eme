import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';

const DepartmentSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true } });
const Department = mongoose.model('Department', DepartmentSchema);

async function run() {
  await connectDB();
  await Department.deleteMany({});
  await Department.insertMany([
    { name: 'HR' }, { name: 'Sales' }, { name: 'Finance' }, { name: 'Inventory' }, { name: 'Procurement' }, { name: 'Projects' }, { name: 'CRM' }
  ]);
  console.log('✅ Seeded departments');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });