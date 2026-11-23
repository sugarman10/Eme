/**
 * Journal Entry Service
 * خدمة قيود اليومية
 *
 * Provides postJournalEntry helper with full validation.
 * Does not modify existing APIs - this is a foundation layer.
 */

import mongoose from 'mongoose';
import JournalEntry from '../models/JournalEntry.js';
import Account from '../models/Account.js';
import FiscalPeriod from '../models/FiscalPeriod.js';
import Counter from '../models/Counter.js'; // Import Counter model


/**
 * Precision math helpers for financial calculations
 */
const round2 = (num) => Math.round(num * 100) / 100;

/**
 * Check if date falls in closed period
 * @param {Date} date - Date to check
 * @returns {Promise<void>} - Throws error if closed
 */
const checkFiscalPeriod = async (date) => {
  const period = await FiscalPeriod.findOne({
    startDate: { $lte: date },
    endDate: { $gte: date },
    isClosed: true,
  });

  if (period) {
    throw new JournalValidationError(
      `التاريخ ${date.toISOString().slice(0, 10)} يقع ضمن الفترة المالية المغلقة: ${period.name}`,
      'FISCAL_PERIOD_CLOSED'
    );
  }
};

/**
 * Generate Serial Number (JE-YYYY-XXXXXX)
 * @param {number} year
 * @param {Object|null} session - Optional MongoDB session
 * @returns {Promise<{serialNumber: string, sequence: number}>}
 */
const generateSerialNumber = async (year, session = null) => {
  const counterName = `journal_entry_${year}`;
  const options = { new: true, upsert: true };
  if (session) options.session = session;
  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    options
  );

  const sequence = counter.seq;
  const serialNumber = `JE-${year}-${String(sequence).padStart(6, '0')}`;
  return { serialNumber, sequence };
};

/**
 * Validation Errors
 */
export class JournalValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'JournalValidationError';
    this.code = code;
  }
}

/**
 * Validate journal entry data
 * @param {Object} entry - Journal entry data
 * @returns {Object} - Validation result { valid, errors }
 */
export const validateJournalEntry = async (entry, session = null) => {
  const errors = [];

  // 1. Check lines count (minimum 2)
  if (!entry.lines || !Array.isArray(entry.lines)) {
    errors.push({ field: 'lines', message: 'القيد يجب أن يحتوي على سطور (lines is required)' });
    return { valid: false, errors };
  }

  if (entry.lines.length < 2) {
    errors.push({
      field: 'lines',
      code: 'MIN_LINES',
      message: 'القيد يجب أن يحتوي على سطرين على الأقل (minimum 2 lines required)',
    });
  }

  // 2. Check debit/credit values
  let totalDebit = 0;
  let totalCredit = 0;
  const accountIds = [];

  for (let i = 0; i < entry.lines.length; i++) {
    const line = entry.lines[i];

    // Check accountId exists
    if (!line.accountId && !line.account) {
      errors.push({
        field: `lines[${i}].accountId`,
        code: 'MISSING_ACCOUNT',
        message: `السطر ${i + 1}: الحساب مطلوب (accountId required)`,
      });
    } else {
      accountIds.push(line.accountId || line.account);
    }

    // Check debit is valid number >= 0
    const debit = Number(line.debit) || 0;
    if (debit < 0) {
      errors.push({
        field: `lines[${i}].debit`,
        code: 'NEGATIVE_DEBIT',
        message: `السطر ${i + 1}: المدين لا يمكن أن يكون سالباً`,
      });
    }
    totalDebit += debit;

    // Check credit is valid number >= 0
    const credit = Number(line.credit) || 0;
    if (credit < 0) {
      errors.push({
        field: `lines[${i}].credit`,
        code: 'NEGATIVE_CREDIT',
        message: `السطر ${i + 1}: الدائن لا يمكن أن يكون سالباً`,
      });
    }
    totalCredit += credit;

    // Each line should have either debit or credit (not both zero)
    if (debit === 0 && credit === 0) {
      errors.push({
        field: `lines[${i}]`,
        code: 'ZERO_LINE',
        message: `السطر ${i + 1}: يجب أن يحتوي على مدين أو دائن`,
      });
    }
  }

  // 3. Check balance (debit == credit) with cent precision
  const diff = round2(Math.abs(totalDebit - totalCredit));
  if (diff > 0.001) {
    // Allow for tiny floating point differences
    errors.push({
      field: 'balance',
      code: 'UNBALANCED',
      message: `القيد غير متوازن: المدين=${round2(totalDebit)}, الدائن=${round2(totalCredit)}, الفرق=${diff}`,
      details: { totalDebit: round2(totalDebit), totalCredit: round2(totalCredit), diff },
    });
  }

  // 4. Verify all accounts exist in database and are not parent accounts
  if (accountIds.length > 0 && errors.length === 0) {
    const query = Account.find({ _id: { $in: accountIds } });
    if (session) query.session(session);

    const foundAccounts = await query;
    const foundIds = new Set(foundAccounts.map((a) => a._id.toString()));

    for (let i = 0; i < entry.lines.length; i++) {
      const accountId = (entry.lines[i].accountId || entry.lines[i].account)?.toString();
      if (accountId && !foundIds.has(accountId)) {
        errors.push({
          field: `lines[${i}].accountId`,
          code: 'ACCOUNT_NOT_FOUND',
          message: `السطر ${i + 1}: الحساب غير موجود (${accountId})`,
        });
      }
    }

    // Check for parent accounts (accounts with children cannot receive direct journal entries)
    if (errors.length === 0) {
      const parentQuery = Account.find({ parentId: { $in: accountIds } }, { parentId: 1 });
      if (session) parentQuery.session(session);
      const childDocs = await parentQuery;
      const parentIdSet = new Set(childDocs.map((p) => p.parentId?.toString()).filter(Boolean));

      for (let i = 0; i < entry.lines.length; i++) {
        const accountId = (entry.lines[i].accountId || entry.lines[i].account)?.toString();
        if (accountId && parentIdSet.has(accountId)) {
          const acc = foundAccounts.find((a) => a._id.toString() === accountId);
          errors.push({
            field: `lines[${i}].accountId`,
            code: 'PARENT_ACCOUNT_NOT_ALLOWED',
            message: `السطر ${i + 1}: لا يمكن ترحيل قيود مباشرة على حساب رئيسي يمتلك حسابات فرعية (${acc?.code || ''} - ${acc?.name || ''})`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    totals: { debit: round2(totalDebit), credit: round2(totalCredit) },
  };
};

/**
 * Post Journal Entry
 * Creates a validated journal entry in the database
 *
 * @param {Object} entry - Journal entry data
 * @param {Object} options - { session: mongoose.Session, updateBalances: boolean }
 * @returns {Promise<Object>} - Created journal entry
 * @throws {JournalValidationError} - If validation fails
 */
export const postJournalEntry = async (entry, options = {}) => {
  const { session = null, updateBalances = true } = options;

  // 0. Check Fiscal Period (CRITICAL)
  await checkFiscalPeriod(entry.date || new Date());

  // 1. Validate entry
  const validation = await validateJournalEntry(entry, session);

  if (!validation.valid) {
    const error = new JournalValidationError(
      validation.errors.map((e) => e.message).join('; '),
      validation.errors[0]?.code || 'VALIDATION_ERROR'
    );
    error.errors = validation.errors;
    throw error;
  }

  // 2. Prepare lines for database
  const lines = entry.lines.map((line) => ({
    account: line.accountId || line.account,
    debit: round2(Number(line.debit) || 0),
    credit: round2(Number(line.credit) || 0),
    memo: line.memo || line.note || '',
  }));

  // 3. Create journal entry document
  const dateObj = new Date(entry.date || new Date());
  const year = dateObj.getFullYear();

  // Generate Serial Number (atomic)
  const { serialNumber, sequence } = await generateSerialNumber(year, session);

  const journalData = {
    date: dateObj,
    referenceType: entry.referenceType || 'MANUAL',
    referenceId: entry.referenceId || '',
    lines,
    ref: entry.ref || entry.reference || '',
    note: entry.note || entry.description || '',
    user: entry.userId || entry.createdBy || null,
    createdBy: entry.createdBy || entry.userId || null,
    // New Fields
    status: 'POSTED', // Always posted
    serialNumber,
    year,
    sequence,
    reversalOf: entry.reversalOf || null,
    reversedBy: entry.reversedBy || null,
  };

  let savedEntry;

  if (session) {
    const [created] = await JournalEntry.create([journalData], { session });
    savedEntry = created;
  } else {
    savedEntry = await JournalEntry.create(journalData);
  }

  // 4. Audit Trail (MANDATORY - respects transaction session)
  const { auditCreate } = await import('./auditService.js');
  await auditCreate('JOURNAL', savedEntry, { _id: entry.createdBy || entry.userId }, '', session);

  // 5. Update account balances (optional)
  if (updateBalances) {
    await updateAccountBalances(lines, session);
  }

  return savedEntry;
};

/**
 * Reverse Journal Entry
 * @param {string} journalId
 * @param {string} userId
 * @param {string} reason
 */
export const reverseJournalEntry = async (journalId, userId, reason = '') => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch Original Entry
    const original = await JournalEntry.findById(journalId).session(session);
    if (!original) throw new Error('Journal Entry not found');

    if (original.status === 'REVERSED') {
      throw new Error('This entry is already reversed');
    }

    if (original.referenceType === 'OPENING') {
      throw new Error('Cannot reverse Opening Balance entries');
    }

    // 2. Validate Reversal Date (Today)
    const reversalDate = new Date();
    await checkFiscalPeriod(reversalDate);

    // 3. Prepare Reversal Lines (Swap Dr/Cr)
    const reversalLines = original.lines.map(line => ({
      accountId: line.account,
      debit: line.credit,  // Swap
      credit: line.debit,  // Swap
      memo: `Reversal of ${original.serialNumber || original.ref} - ${reason}`
    }));

    // 4. Create Reversal Entry
    const reversalEntry = await postJournalEntry({
      date: reversalDate,
      lines: reversalLines,
      referenceType: 'MANUAL', // Or REVERSAL if added to enum
      referenceId: original._id.toString(), // Link to original
      ref: `REV-${original.serialNumber || 'LEGACY'}`,
      note: `Reversal of ${original.serialNumber} - ${reason}`,
      userId: userId,
      status: 'POSTED',
      reversalOf: original._id
    }, { session });

    // 5. Update Original Entry
    original.status = 'REVERSED';
    original.reversedBy = reversalEntry._id;
    await original.save({ session });

    // 6. Audit
    const { auditUpdate } = await import('./auditService.js');
    await auditUpdate('JOURNAL', original._id, { status: 'POSTED' }, { status: 'REVERSED' }, { _id: userId }, '', session);

    await session.commitTransaction();
    return reversalEntry;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Update account balances based on journal entry lines
 * @private
 */
const updateAccountBalances = async (lines, session = null) => {
  // Fetch accounts to determine their types
  const accountIds = lines.map((l) => l.account);
  const query = Account.find({ _id: { $in: accountIds } });
  if (session) query.session(session);

  const accounts = await query;
  const accountMap = new Map(accounts.map((a) => [a._id.toString(), a]));

  for (const line of lines) {
    const account = accountMap.get(line.account.toString());
    if (!account) continue;

    const debit = line.debit || 0;
    const credit = line.credit || 0;
    let balanceChange = 0;

    // Asset/Expense: Debit (+), Credit (-)
    // Liability/Equity/Revenue: Credit (+), Debit (-)
    if (['asset', 'expense'].includes(account.type?.toLowerCase())) {
      balanceChange = debit - credit;
    } else {
      balanceChange = credit - debit;
    }

    if (balanceChange !== 0) {
      const updateQuery = Account.findByIdAndUpdate(account._id, { $inc: { balance: round2(balanceChange) } });
      if (session) updateQuery.session(session);
      await updateQuery;
    }
  }
};

/**
 * Reverse or cancel posted Journal Entries matching a filter within an active transaction
 * Reverses Account.balance impacts and deletes/reverses the entries cleanly.
 *
 * @param {Object} filter - Mongoose filter (e.g., { referenceType: 'SALE_INVOICE', referenceId: id })
 * @param {Object|null} session - MongoDB session
 * @param {Object} options - { deleteEntries: boolean, userId: string, reason: string }
 */
export const reverseJournalEntriesByReference = async (filter, session = null, options = {}) => {
  const { deleteEntries = false, userId = null, reason = 'Document updated/reverted' } = options;

  const query = JournalEntry.find({ ...filter, status: 'POSTED' });
  if (session) query.session(session);
  const entries = await query;

  if (!entries || entries.length === 0) return [];

  const results = [];
  for (const original of entries) {
    // Prepare inverted lines (Swap Debit and Credit)
    const invertedLines = original.lines.map((line) => ({
      account: line.account,
      accountId: line.account,
      debit: round2(Number(line.credit) || 0),
      credit: round2(Number(line.debit) || 0),
      memo: `عكس قيد ${original.serialNumber || original.ref || ''} - ${reason}`.trim(),
    }));

    if (deleteEntries) {
      // Directly reverse account balances and delete the entry (when replacing in-place during document edit)
      await updateAccountBalances(invertedLines, session);
      const delQuery = JournalEntry.findByIdAndDelete(original._id);
      if (session) delQuery.session(session);
      await delQuery;
      results.push(original._id);
    } else {
      // Create an official reversal entry and mark original as REVERSED
      const reversalEntry = await postJournalEntry(
        {
          date: new Date(),
          lines: invertedLines,
          referenceType: original.referenceType || 'MANUAL',
          referenceId: original.referenceId || original._id.toString(),
          ref: `REV-${original.serialNumber || original.ref || 'JE'}`,
          note: `عكس قيد ${original.serialNumber || ''} - ${reason}`.trim(),
          userId,
          createdBy: userId,
          reversalOf: original._id,
        },
        { session, updateBalances: true }
      );

      original.status = 'REVERSED';
      original.reversedBy = reversalEntry._id;
      await original.save(session ? { session } : undefined);
      results.push(reversalEntry);
    }
  }

  return results;
};

export default {
  validateJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  reverseJournalEntriesByReference,
  JournalValidationError,
};
