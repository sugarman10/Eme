import mongoose from 'mongoose';
import { generateMonthlyPayroll, payPayroll, payAllPayroll } from '../services/payrollService.js';
import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';

// GET /api/hr/payroll/:month
export const getMonthlyPayroll = async (req, res) => {
  try {
    const { month } = req.params;
    // Fetch payroll slips populated with employee data
    const payrolls = await Payroll.find({ month })
      .populate('employee', 'name position salaryDetails')
      .sort({ 'employee.name': 1 }); // might need aggregation for sorting by populated field, but basic sort is fine for now

    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/hr/employees/:id/payroll
export const getEmployeePayrolls = async (req, res) => {
  try {
    const { id } = req.params;
    const payrolls = await Payroll.find({ employee: id }).sort({ month: -1 });
    res.json(payrolls);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/hr/payroll/generate
export const generatePayroll = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { month } = req.body;

    if (!month) {
      throw new Error('Month is required (YYYY-MM)');
    }

    const result = await generateMonthlyPayroll(month, session);

    await session.commitTransaction();
    res.json(result);
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// POST /api/hr/payroll/:id/pay
export const processPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { id } = req.params;
    const { treasuryId } = req.body;
    const userId = req.user?._id; // Assuming auth middleware

    if (!treasuryId) throw new Error('Treasury ID is required');

    const payroll = await payPayroll(id, treasuryId, userId, session);

    await session.commitTransaction();
    res.json(payroll);
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// POST /api/hr/payroll/pay-all
export const processBulkPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { month, treasuryId } = req.body;
    const userId = req.user?._id;

    if (!month || !treasuryId) throw new Error('Month and Treasury ID are required');

    const result = await payAllPayroll(month, treasuryId, userId, session);

    await session.commitTransaction();
    res.json(result);
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// POST /api/hr/payroll/:id/update
// Optional: Allow editing deductions before payment
export const updatePayrollSlip = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; // e.g., { deductions: { ... } }

    const payroll = await Payroll.findById(id);
    if (!payroll) throw new Error('Not found');
    if (payroll.status === 'PAID') throw new Error('Cannot edit PAID slip');

    // Logic to update fields and Recalculate Totals
    // For simplicity, just updating manual fields if provided
    if (updates.deductions) {
      payroll.deductions = { ...payroll.deductions, ...updates.deductions };

      // Recalculate
      const gross = payroll.totals.grossSalary; // Base is fixed from snapshot
      const totalDeductions =
        (Number(payroll.deductions.absenceAmount) || 0) +
        (Number(payroll.deductions.loans) || 0) +
        (Number(payroll.deductions.tax) || 0);

      payroll.totals.totalDeductions = totalDeductions;
      payroll.totals.netSalary = gross - totalDeductions;
    }

    if (updates.status && updates.status === 'APPROVED') {
      payroll.status = 'APPROVED';
    }

    await payroll.save();
    res.json(payroll);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
