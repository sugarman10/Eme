import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from '../src/models/Employee.js';
import User from '../src/models/User.js';

dotenv.config();

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erp_mern');
  const emps = await Employee.find().populate('user').lean();
  console.log('=== EMPLOYEES ===');
  emps.forEach(e => {
    console.log(`Emp ID: ${e._id}, Name: ${e.name}, User:`, e.user ? `@${e.user.username} (role: ${e.user.role}, perms: ${e.user.permissions?.length || 0})` : 'null');
  });

  const users = await User.find().populate('employee').lean();
  console.log('=== USERS ===');
  users.forEach(u => {
    console.log(`User ID: ${u._id}, Username: ${u.username}, Name: ${u.name}, Role: ${u.role}, Perms count: ${u.permissions?.length || 0}, Linked Emp:`, u.employee ? u.employee.name : 'null');
  });

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
