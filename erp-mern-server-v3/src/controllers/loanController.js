import mongoose from 'mongoose';
import Loan from '../models/Loan.js';
import { approveLoan } from '../services/loanService.js';

// GET /api/hr/loans
export const getLoans = async (req, res) => {
    try {
        const { status, month, employeeId } = req.query;
        const query = {};
        if (status && status !== 'ALL') query.status = status;
        if (month) query.repaymentMonth = month;
        if (employeeId) query.employee = employeeId;

        const loans = await Loan.find(query)
            .populate('employee', 'name position')
            .sort({ createdAt: -1 });

        res.json(loans);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/hr/loans
export const createLoanRequest = async (req, res) => {
    try {
        const { employeeId, amount, repaymentMonth } = req.body;

        const existing = await Loan.findOne({
            employee: employeeId,
            repaymentMonth,
            status: { $in: ['PENDING', 'APPROVED'] }
        });

        if (existing) {
            return res.status(400).json({ message: 'يوجد سلفة/طلب مسجل لهذا الموظف في هذا الشهر بالفعل' });
        }

        const loan = await Loan.create({
            employee: employeeId,
            amount,
            repaymentMonth, // YYYY-MM
            status: 'PENDING'
        });

        res.status(201).json(loan);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// POST /api/hr/loans/:id/approve
export const approveLoanRequest = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const { id } = req.params;
        const { treasuryId } = req.body;
        const userId = req.user._id;

        if (!treasuryId) throw new Error('يرجى تحديد الخزينة');

        const loan = await approveLoan(id, treasuryId, userId, session);

        await session.commitTransaction();
        res.json(loan);
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: error.message });
    } finally {
        session.endSession();
    }
};

// DELETE /api/hr/loans/:id
export const deleteLoanRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const loan = await Loan.findById(id);

        if (!loan) return res.status(404).json({ message: 'غير موجود' });
        if (loan.status !== 'PENDING') return res.status(400).json({ message: 'لا يمكن حذف سلفة تم اعتمادها' });

        await Loan.findByIdAndDelete(id);
        res.json({ message: 'تم الحذف بنجاح' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
