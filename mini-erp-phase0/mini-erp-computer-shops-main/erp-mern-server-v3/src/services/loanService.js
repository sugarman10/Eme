import Loan from '../models/Loan.js';
import Employee from '../models/Employee.js';
import Account from '../models/Account.js';
import { recordFinancialOperation } from './financeService.js';
import { postJournalEntry } from './journalEntryService.js';

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
  await recordFinancialOperation(
    {
      type: 'LOAN_OUT', // Custom type or generic EXPENSE
      amount: loan.amount,
      treasuryId,
      relatedId: loan._id,
      relatedModel: 'Loan',
      description: `صرف سلفة للموظف ${employee.name}`,
      userId,
      date: new Date(),
    },
    session
  );

  // 2. Automated Journal Entry
  // Dr: 10105 (Employee Receivables - Asset)
  // Cr: 10101 (Treasury - Asset)
  const receivablesAcc = await Account.findOne({ code: '10105' }).session(session);
  const treasuryAcc = await Account.findOne({ code: '10101' }).session(session);

  if (receivablesAcc && treasuryAcc) {
    await postJournalEntry({
      date: new Date(),
      referenceType: 'LOAN',
      referenceId: loan._id,
      description: `صرف سلفة - ${employee.name}`,
      lines: [
        { accountId: receivablesAcc._id, debit: loan.amount, credit: 0, note: 'مديونية موظف' },
        { accountId: treasuryAcc._id, debit: 0, credit: loan.amount, note: 'صرف من الخزينة' },
      ],
      userId,
      createdBy: userId
    }, { session });
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
 * Waive / Forgive a Loan (التغاضي عن السلفة / إعفاء الموظف)
 * If loan was APPROVED (money paid out):
 * Creates Journal Entry: Dr Expense (5021) / Cr Receivables (10105)
 * Sets status to WAIVED so it will NOT be deducted in payroll.
 */
export const waiveLoan = async (loanId, { reason = '', waiveType = 'FORGIVE' } = {}, userId, session) => {
  const loan = await Loan.findById(loanId).populate('employee').session(session);
  if (!loan) throw new Error('Loan not found');
  if (loan.status === 'DEDUCTED') throw new Error('لا يمكن التغاضي عن سلفة تم استقطاعها بالفعل من الراتب');
  if (loan.status === 'WAIVED') throw new Error('هذه السلفة تم التغاضي عنها والإعفاء منها مسبقاً');

  const employee = loan.employee;

  // If the loan was already APPROVED (cash disbursed to employee),
  // we must write off the receivable to salaries/rewards expense.
  if (loan.status === 'APPROVED') {
    const expensesAcc = await Account.findOne({ $or: [{ code: '5021' }, { code: '5201' }, { type: 'expense' }] }).session(session);
    const receivablesAcc = await Account.findOne({ $or: [{ code: '10105' }, { code: '1105' }] }).session(session);

    if (expensesAcc && receivablesAcc) {
      const typeLabel = waiveType === 'BONUS' ? 'مكافأة ومنحة' : 'إعفاء وتغاضي';
      await postJournalEntry({
        date: new Date(),
        referenceType: 'LOAN',
        referenceId: loan._id,
        description: `${typeLabel} عن سلفة - الموظف ${employee?.name || ''}${reason ? ` (${reason})` : ''}`,
        lines: [
          { accountId: expensesAcc._id, debit: loan.amount, credit: 0, note: `${typeLabel} لموظف` },
          { accountId: receivablesAcc._id, debit: 0, credit: loan.amount, note: 'إقفال مديونية سلفة الموظف' },
        ],
        userId,
        createdBy: userId,
      }, { session });
    } else {
      console.warn('⚠️ Accounts for loan waiver JE missing.');
    }
  }

  // Update Status and audit
  loan.status = 'WAIVED';
  loan.waivedAt = new Date();
  loan.waivedBy = userId;
  loan.waiveReason = reason || '';
  loan.waiveType = waiveType || 'FORGIVE';

  await loan.save({ session });
  return loan;
};

/**
 * Postpone / Reschedule Repayment Month (تأجيل خصم السلفة)
 */
export const postponeLoan = async (loanId, newRepaymentMonth, userId, session) => {
  if (!newRepaymentMonth) throw new Error('يرجى تحديد الشهر الجديد للاستقطاع');
  const loan = await Loan.findById(loanId).session(session);
  if (!loan) throw new Error('Loan not found');
  if (loan.status === 'DEDUCTED') throw new Error('لا يمكن تأجيل سلفة تم استقطاعها بالفعل');
  if (loan.status === 'WAIVED') throw new Error('لا يمكن تأجيل سلفة معفى عنها');

  loan.repaymentMonth = newRepaymentMonth;
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
    status: 'APPROVED',
  });
};
