const mongoose = require('mongoose');
require('dotenv').config();

// Define schema inline to avoid import issues in script
const EmployeeSchema = new mongoose.Schema({
    name: { type: String },
    isActive: { type: Boolean, default: true }
});
const Employee = mongoose.model('Employee', EmployeeSchema);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system');
        console.log('MongoDB Connected');

        const count = await Employee.countDocuments();
        console.log(`Total Employees: ${count}`);

        const activeCount = await Employee.countDocuments({ isActive: true });
        console.log(`Active Employees: ${activeCount}`);

        if (count > 0) {
            const employees = await Employee.find().limit(3);
            console.log('Sample Employees:', employees);
        }

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB();
