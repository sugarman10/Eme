import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import Account from '../models/Account.js';
import Loan from '../models/Loan.js';
import { recordFinancialOperation } from './financeService.js';
import { postJournalEntry } from './journalEntryService.js';
import { getSystemAccount } from './systemAccountsService.js';
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
    errors: [],
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

      // Loans Deduction
      const loans = await Loan.find({
        employee: emp._id,
        repaymentMonth: month,
        status: 'APPROVED',
      }).session(session);

      const loanAmount = loans.reduce((sum, l) => sum + (l.amount || 0), 0);

      // Update Loans to DEDUCTED
      for (const l of loans) {
        l.status = 'DEDUCTED';
        await l.save({ session });
      }

      // Default Deductions
      const deductions = {
        absenceDays: 0,
        absenceAmount: 0,
        loans: loanAmount,
        tax: 0,
      };

      const totalDeductions = add(deductions.absenceAmount, add(deductions.loans, deductions.tax));
      const netSalary = sub(gross, totalDeductions);

      const payroll = new Payroll({
        employee: emp._id,
        month,
        basics: {
          baseSalary: baseSalary || 0,
          housingAllowance: housingAllowance || 0,
          transportAllowance: transportAllowance || 0,
        },
        deductions,
        totals: {
          grossSalary: gross,
          totalDeductions,
          netSalary,
        },
        status: 'DRAFT',
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
  await recordFinancialOperation(
    {
      type: 'SALARY',
      amount: amount,
      treasuryId,
      relatedId: payroll._id,
      relatedModel: 'Payroll',
      description: `Salary Payment - ${payroll.employee.name} - ${payroll.month}`,
      userId,
      date: new Date(),
    },
    session
  );

  // 1.5. Record Loan Repayment Journal Entry if exists
  if (payroll.deductions.loans > 0) {
    try {
      const expensesAcc = await getSystemAccount('SALARIES_EXPENSE', session);
      const loansAcc = await getSystemAccount('EMPLOYEE_ADVANCES', session);

      if (expensesAcc && loansAcc) {
        await postJournalEntry({
          date: new Date(),
          referenceType: 'SALARY',
          referenceId: payroll._id.toString(),
          description: `تسوية سلفة من الراتب - ${payroll.employee.name}`,
          lines: [
            { accountId: expensesAcc._id, debit: payroll.deductions.loans, credit: 0 },
            { accountId: loansAcc._id, debit: 0, credit: payroll.deductions.loans },
          ],
          userId,
          createdBy: userId
        }, { session });
      }
    } catch (loanJeErr) {
      console.error('Failed to post loan settlement JE:', loanJeErr);
      throw loanJeErr;
    }
  }

  // 2. Update Payroll Status
  payroll.status = 'PAID';
  payroll.paymentDate = new Date();
  payroll.paidBy = userId;

  await payroll.save({ session });

  return payroll;
};

/**
 * Pay All Unpaid Payrolls for a Month
 * @param {string} month - YYYY-MM
 * @param {string} treasuryId
 * @param {string} userId
 * @param {object} session
 */
export const payAllPayroll = async (month, treasuryId, userId, session) => {
  // Find all unpaid DRAFT or APPROVED slips for this month
  // Note: Usually we only pay APPROVED, but here we assume DRAFT is fine if user triggers "Pay All"
  // Better practice: Only pay if status != PAID
  const payrolls = await Payroll.find({
    month,
    status: { $ne: 'PAID' },
  }).populate('employee').session(session);

  const results = {
    paid: 0,
    errors: [],
    skipped: 0
  };

  for (const slip of payrolls) {
    try {
      // Validate net salary > 0
      if (slip.totals.netSalary <= 0) {
        results.skipped++;
        continue;
      }

      await recordFinancialOperation(
        {
          type: 'SALARY',
          amount: slip.totals.netSalary,
          treasuryId,
          relatedId: slip._id,
          relatedModel: 'Payroll',
          description: `Salary Payment (Bulk) - ${slip.employee.name} - ${month}`,
          userId,
          date: new Date(),
        },
        session
      );

      // Record Loan Repayment JE for Bulk Payment
      if (slip.deductions.loans > 0) {
        try {
          const expensesAcc = await getSystemAccount('SALARIES_EXPENSE', session);
          const loansAcc = await getSystemAccount('EMPLOYEE_ADVANCES', session);

          if (expensesAcc && loansAcc) {
            await postJournalEntry({
              date: new Date(),
              referenceType: 'SALARY',
              referenceId: slip._id.toString(),
              description: `تسوية سلفة (كشف)- ${slip.employee.name}`,
              lines: [
                { accountId: expensesAcc._id, debit: slip.deductions.loans, credit: 0 },
                { accountId: loansAcc._id, debit: 0, credit: slip.deductions.loans },
              ],
              userId,
              createdBy: userId
            }, { session });
          }
        } catch (loanJeErr) {
          console.error('Failed to post bulk loan settlement JE:', loanJeErr);
          throw loanJeErr;
        }
      }

      slip.status = 'PAID';
      slip.paymentDate = new Date();
      slip.paidBy = userId;
      await slip.save({ session });

      results.paid++;
    } catch (error) {
      console.error(`Failed to pay slip ${slip._id}:`, error);
      results.errors.push({ employee: slip.employee?.name, error: error.message });
    }
  }

  return results;
};
