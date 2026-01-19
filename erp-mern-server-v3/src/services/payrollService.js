import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import { recordFinancialOperation } from './financeService.js';
import { add, sub, mul, round } from '../utils/mathUtils.js';

/**
 * Generate Monthly Payroll for All Active Employees
 * @param {string} month - Format "YYYY-MM"
 * @param {object} session - Mongoose Session
 */
export const generateMonthlyPayroll = async (month, session) => {
    // 1. Fetch Active Employees
    const employees = await Employee.find({ isActive: true }).session(session);

    const results = {
        created: 0,
        skipped: 0,
        errors: []
    };

    for (const emp of employees) {
        try {
            // Check if already exists
            const existing = await Payroll.findOne({ employee: emp._id, month }).session(session);
            if (existing) {
                results.skipped++;
                continue;
            }

            // Calculate Components
            const { baseSalary, housingAllowance, transportAllowance, dailyRate } = emp.salaryDetails || {};

            const gross = add(add(baseSalary || 0, housingAllowance || 0), transportAllowance || 0);

            // Default Deductions (can be updated later before approval)
            const deductions = {
                absenceDays: 0,
                absenceAmount: 0,
                loans: 0,
                tax: 0
            };

            const totalDeductions = 0;
            const netSalary = sub(gross, totalDeductions);

            const payroll = new Payroll({
                employee: emp._id,
                month,
                basics: {
                    baseSalary: baseSalary || 0,
                    housingAllowance: housingAllowance || 0,
                    transportAllowance: transportAllowance || 0
                },
                deductions,
                totals: {
                    grossSalary: gross,
                    totalDeductions,
                    netSalary
                },
                status: 'DRAFT'
            });

            await payroll.save({ session });
            results.created++;

        } catch (err) {
            console.error(`Error generating payroll for ${emp.name}:`, err);
            results.errors.push({ employee: emp.name, error: err.message });
        }
    }

    return results;
};

/**
 * process Payroll Payment
 * @param {string} payrollId 
 * @param {string} treasuryId 
 * @param {string} userId 
 * @param {object} session 
 */
export const payPayroll = async (payrollId, treasuryId, userId, session) => {
    const payroll = await Payroll.findById(payrollId).populate('employee').session(session);

    if (!payroll) throw new Error('Payroll slip not found');

    if (payroll.status === 'PAID') {
        throw new Error('This payroll slip is already PAID');
    }

    const amount = payroll.totals.netSalary;

    if (amount <= 0) {
        throw new Error('Cannot pay a payroll with 0 or negative net salary');
    }

    // 1. Record Financial Operation (Treasury Out + Journal Entry)
    // This handles sufficiency check, treasury update, and accounting
    await recordFinancialOperation({
        type: 'SALARY',
        amount: amount,
        treasuryId,
        relatedId: payroll._id,
        relatedModel: 'Payroll',
        description: `Salary Payment - ${payroll.employee.name} - ${payroll.month}`,
        userId,
        date: new Date()
    }, session);

    // 2. Update Payroll Status
    payroll.status = 'PAID';
    payroll.paymentDate = new Date();
    payroll.paidBy = userId;

    await payroll.save({ session });

    return payroll;
};
