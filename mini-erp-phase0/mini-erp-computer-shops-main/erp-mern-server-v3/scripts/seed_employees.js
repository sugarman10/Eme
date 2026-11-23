import mongoose from 'mongoose';
import 'dotenv/config';

const EmployeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    position: { type: String, required: true },
    phone: String,
    isActive: { type: Boolean, default: true },
    salaryDetails: {
        baseSalary: { type: Number, default: 0 },
        housingAllowance: { type: Number, default: 0 },
        transportAllowance: { type: Number, default: 0 },
        dailyRate: { type: Number, default: 0 },
    },
    joinDate: { type: Date, default: Date.now },
});

// Prevent overwrite error if model exists
const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);

const seedEmployees = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/erp-system');
        console.log('MongoDB Connected');

        const employees = [
            {
                name: "أحمد محمد",
                position: "محاسب",
                phone: "0501234567",
                salaryDetails: {
                    baseSalary: 4000,
                    housingAllowance: 500,
                    transportAllowance: 300
                }
            },
            {
                name: "سارة علي",
                position: "كاشير",
                phone: "0507654321",
                salaryDetails: {
                    baseSalary: 3000,
                    housingAllowance: 500,
                    transportAllowance: 200
                }
            },
            {
                name: "خالد عمر",
                position: "مدير فرع",
                phone: "0509988776",
                salaryDetails: {
                    baseSalary: 6000,
                    housingAllowance: 1000,
                    transportAllowance: 500
                }
            }
        ];

        // Ensure we don't duplicate if script runs multiple times, but for now clear is fine or check existence
        // Let's clear to be clean as requested "ensure completion"

        const count = await Employee.countDocuments();
        if (count === 0) {
            await Employee.insertMany(employees);
            console.log(`✅ Seeded ${employees.length} employees successfully.`);
        } else {
            console.log(`ℹ️ Employees already exist (${count}). Skipping seed.`);
        }

        process.exit();
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedEmployees();
