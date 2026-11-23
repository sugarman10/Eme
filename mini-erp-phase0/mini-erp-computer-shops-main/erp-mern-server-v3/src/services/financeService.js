import Treasury from '../models/Treasury.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { postJournalEntry } from './journalEntryService.js';
import { getAccountCode } from './settingService.js';
import { getSystemAccount } from './systemAccountsService.js';
import { add, sub } from '../utils/mathUtils.js';

/**
 * Record a comprehensive Financial Operation
 * Handles: Validation, Treasury Update, Transaction Log, Journal Entry
 *
 * @param {object} data - Operation Data
 * @param {string} data.type - 'SALES', 'PURCHASE', 'EXPENSE', 'SALARY', 'INCOME'
 * @param {number} data.amount - Amount
 * @param {string} data.treasuryId - Treasury ID
 * @param {string} [data.relatedId] - Related Doc ID
 * @param {string} [data.relatedModel] - Related Model Name
 * @param {string} [data.description] - Description
 * @param {string} [data.userId] - User performing action
 * @param {Date} [data.date] - Date
 * @param {object} session - Mongoose Session
 */
export const recordFinancialOperation = async (data, session) => {
  const {
    type,
    amount,
    treasuryId,
    relatedId = null,
    relatedModel = '',
    description = '',
    userId = null,
    date = new Date(),
  } = data;

  // 1. Validation
  const safeAmount = Number(amount);
  if (!safeAmount || safeAmount <= 0) {
    throw new Error('المبلغ يجب أن يكون أكبر من صفر (Invalid Amount)');
  }

  const treasury = await Treasury.findById(treasuryId).session(session);
  if (!treasury) {
    throw new Error('الخزينة غير موجودة (Treasury not found)');
  }
  if (!treasury.isActive) {
    throw new Error('الخزينة غير نشطة (Treasury is inactive)');
  }

  // 2. Logic Determination
  const opType = type.toUpperCase();
  let flow = 'out';
  let transactionType = 'expense'; // Default

  const INCOMING_TYPES = ['SALES', 'INCOME', 'DEPOSIT'];
  if (INCOMING_TYPES.includes(opType)) {
    flow = 'in';
    transactionType = opType === 'SALES' ? 'income' : 'income'; // Map to enum
  } else {
    flow = 'out';
    transactionType = 'expense';
  }

  // 3. Treasury Update
  if (flow === 'in') {
    treasury.balance = add(treasury.balance, safeAmount);
  } else {
    // Check Sufficiency
    if (treasury.balance < safeAmount) {
      throw new Error(`رصيد الخزينة غير كافٍ. المتوفر: ${treasury.balance}، المطلوب: ${safeAmount}`);
    }
    treasury.balance = sub(treasury.balance, safeAmount);
  }
  await treasury.save({ session });

  // 4. Transaction Log
  // Map internal type to Schema Enum ['income', 'expense', 'transfer']
  let schemaType = 'expense';
  if (['SALES', 'INCOME'].includes(opType)) schemaType = 'income';

  await Transaction.create(
    [
      {
        type: schemaType,
        flow,
        category: opType, // Store specific type in category
        amount: safeAmount,
        treasury: treasuryId,
        relatedId,
        relatedModel,
        description,
        date,
      },
    ],
    { session }
  );

  // 5. Automated Journal Entry (Accounting)
  // Resolve Account Codes
  // We expect Account Codes to be strings in SystemSettings
  // دليل الحسابات العربي - Arabic CoA Format (4-digit):
  // الصندوق/البنك (Treasury): 1010 / 1020
  // إيرادات المبيعات (Sales): 4010
  // تكلفة البضاعة المباعة (Purchases): 5010
  // مصروفات تشغيلية (Expense/Salary): 5020
  // Fallback codes below match Arabic COA seed

  try {
    const entryLines = [];

    // Resolve Treasury Account
    // NEW: Use direct treasury.accountId if available (preferred)
    // FALLBACK: Use global setting for backward compatibility
    let treasuryAccount = null;

    if (treasury.accountId) {
      // Direct linking - optimal approach
      treasuryAccount = await Account.findById(treasury.accountId).session(session);
    }

    if (!treasuryAccount) {
      // Fallback to global setting or system account (CASH / BANK)
      const treasuryAccountCode = await getAccountCode('acc_treasury_default', '1010');
      treasuryAccount = await Account.findOne({ code: treasuryAccountCode }).session(session);
      if (!treasuryAccount) {
        treasuryAccount = await getSystemAccount(treasury.type === 'bank' ? 'BANK' : 'CASH', session);
      }
    }

    if (!treasuryAccount) {
      throw new Error('لم يتم العثور على حساب الخزينة المحاسبي');
    }

    // Resolve Target Account based on Type
    let targetAccountCode = '';
    let targetSystemKey = '';
    let debitLine = {};
    let creditLine = {};

    switch (opType) {
      case 'SALES':
        targetAccountCode = await getAccountCode('acc_sales_revenue', '4010');
        targetSystemKey = 'SALES_REVENUE';
        // Dr Treasury, Cr Revenue
        debitLine = { code: treasuryAccount.code, amount: safeAmount, note: 'تحصيل مبيعات' };
        creditLine = { code: targetAccountCode, amount: safeAmount, note: 'إيراد مبيعات' };
        break;

      case 'INCOME':
        targetAccountCode = await getAccountCode('acc_general_income', '4010');
        targetSystemKey = 'SALES_REVENUE';
        // Dr Treasury, Cr Income
        debitLine = { code: treasuryAccount.code, amount: safeAmount, note: 'قبض إيراد' };
        creditLine = { code: targetAccountCode, amount: safeAmount, note: 'إيراد متنوع' };
        break;

      case 'PURCHASE':
        targetAccountCode = await getAccountCode('acc_purchases', '5010');
        targetSystemKey = 'COGS';
        // Dr Purchases, Cr Treasury
        debitLine = { code: targetAccountCode, amount: safeAmount, note: 'شراء بضاعة' };
        creditLine = { code: treasuryAccount.code, amount: safeAmount, note: 'سداد مشتريات' };
        break;

      case 'EXPENSE':
        targetAccountCode = await getAccountCode('acc_general_expense', '5020');
        targetSystemKey = 'GENERAL_EXPENSE';
        // Dr Expense, Cr Treasury
        debitLine = { code: targetAccountCode, amount: safeAmount, note: 'مصروفات' };
        creditLine = { code: treasuryAccount.code, amount: safeAmount, note: 'سداد مصروف' };
        break;

      case 'SALARY':
        targetAccountCode = await getAccountCode('acc_salaries', '5201');
        targetSystemKey = 'SALARIES_EXPENSE';
        // Dr Salaries, Cr Treasury
        debitLine = { code: targetAccountCode, amount: safeAmount, note: 'رواتب وأجور' };
        creditLine = { code: treasuryAccount.code, amount: safeAmount, note: 'صرف رواتب' };
        break;

      default:
        console.warn(`Unknown Finance Type: ${opType}. Skipping Journal Entry.`);
        return;
    }

    // Fetch Accounts to get IDs (with automatic fallback to getSystemAccount)
    const accounts = await Account.find({
      code: { $in: [debitLine.code, creditLine.code] },
    }).session(session);

    let debitAcc = accounts.find((a) => a.code === debitLine.code);
    let creditAcc = accounts.find((a) => a.code === creditLine.code);

    if (!debitAcc && debitLine.code === targetAccountCode && targetSystemKey) {
      debitAcc = await getSystemAccount(targetSystemKey, session);
    }
    if (!creditAcc && creditLine.code === targetAccountCode && targetSystemKey) {
      creditAcc = await getSystemAccount(targetSystemKey, session);
    }
    if (!debitAcc && debitLine.code === treasuryAccount.code) {
      debitAcc = treasuryAccount;
    }
    if (!creditAcc && creditLine.code === treasuryAccount.code) {
      creditAcc = treasuryAccount;
    }

    if (debitAcc && creditAcc) {
      await postJournalEntry({
        date,
        ref: `${opType} #${relatedId || Date.now()}`,
        note: description || `Auto-generated ${opType}`,
        referenceType: opType,
        referenceId: relatedId?.toString() || '',
        userId,
        lines: [
          { accountId: debitAcc._id, debit: debitLine.amount, credit: 0, memo: debitLine.note },
          { accountId: creditAcc._id, debit: 0, credit: creditLine.amount, memo: creditLine.note },
        ],
      }, { session });
    } else {
      console.warn(`Missing Account Codes for JE: ${debitLine.code} or ${creditLine.code}`);
    }
  } catch (jeError) {
    // Don't block the transaction but log the error.
    // OR throw if accounting is strict. User requirement: "Requirement... create Journal Entries".
    // If it fails, effectively the accounting is out of sync.
    console.error('Accounting Entry Failed:', jeError);
    // We throw to rollup the transaction because user implies strict "Automatic Generation".
    throw new Error(`فشل إنشاء القيد المحاسبي: ${jeError.message}`);
  }
};
