import Loan from '../models/Loan.js';
import Employee from '../models/Employee.js';
import Account from '../models/Account.js';
import { recordFinancialOperation } from './financeService.js';
import { createJournalEntry } from './accountingService.js';

/**
 * Approve and Pay Loan (Advance)
 * Logic:
 * 1. Validate Amount (<= Base/2)
 * 2. Deduct from Treasury (Finance Transaction)
 * 3. Create Journal Entry (Dr Employee Receivables / Cr Treasury)
 * 4. Update Loan Status
 */
export const approveLoan = async (loanId, treasuryId, userId, session) => {
    const loan = await Loan.findById(loanId).populate('employee').session(session);
    if (!loan) throw new Error('Loan not found');
    if (loan.status !== 'PENDING') throw new Error(`Loan is ${loan.status}`);

    const employee = loan.employee;
    const maxLoan = (employee.salaryDetails?.baseSalary || 0) / 2;

    if (loan.amount > maxLoan) {
        throw new Error(`Loan amount (${loan.amount}) exceeds 50% of base salary (${maxLoan})`);
    }

    // 1. Record Treasury Deduction (Using FinanceService helper)
    // This creates the Transaction record and updates Treasury Balance
    await recordFinancialOperation({
        type: 'LOAN_OUT', // Custom type or generic EXPENSE
        amount: loan.amount,
        treasuryId,
        relatedId: loan._id,
        relatedModel: 'Loan',
        description: `صرف سلفة للموظف ${employee.name}`,
        userId,
        date: new Date()
    }, session);

    // 2. Automated Journal Entry
    // Dr: 10105 (Employee Receivables - Asset)
    // Cr: 10101 (Treasury - Asset)
    const receivablesAcc = await Account.findOne({ code: '10105' }).session(session);
    const treasuryAcc = await Account.findOne({ code: '10101' }).session(session);

    if (receivablesAcc && treasuryAcc) {
        await createJournalEntry(session, {
            date: new Date(),
            reference: `LOAN #${loan._id.toString().slice(-6)}`,
            description: `صرف سلفة - ${employee.name}`,
            userId,
            entries: [
                { accountId: receivablesAcc._id, debit: loan.amount, credit: 0, note: 'مديونية موظف' },
                { accountId: treasuryAcc._id, debit: 0, credit: loan.amount, note: 'صرف من الخزينة' }
            ]
        });
    } else {
        console.warn('⚠️ Accounts 10105 or 10101 missing. JE skipped.');
    }

    // 3. Update Status
    loan.status = 'APPROVED';
    loan.approvalDate = new Date();
    loan.approvedBy = userId;

    await loan.save({ session });

    return loan;
};

/**
 * Get Approved Loans for a specific Payroll Month
 */
export const getLoansForPayroll = async (employeeId, month) => {
    return await Loan.find({
        employee: employeeId,
        repaymentMonth: month,
        status: 'APPROVED'
    });
};
