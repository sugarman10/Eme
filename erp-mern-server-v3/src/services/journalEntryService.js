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

/**
 * Precision math helpers for financial calculations
 */
const round2 = (num) => Math.round(num * 100) / 100;

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
            message: 'القيد يجب أن يحتوي على سطرين على الأقل (minimum 2 lines required)'
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
                message: `السطر ${i + 1}: الحساب مطلوب (accountId required)`
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
                message: `السطر ${i + 1}: المدين لا يمكن أن يكون سالباً`
            });
        }
        totalDebit += debit;

        // Check credit is valid number >= 0
        const credit = Number(line.credit) || 0;
        if (credit < 0) {
            errors.push({
                field: `lines[${i}].credit`,
                code: 'NEGATIVE_CREDIT',
                message: `السطر ${i + 1}: الدائن لا يمكن أن يكون سالباً`
            });
        }
        totalCredit += credit;

        // Each line should have either debit or credit (not both zero)
        if (debit === 0 && credit === 0) {
            errors.push({
                field: `lines[${i}]`,
                code: 'ZERO_LINE',
                message: `السطر ${i + 1}: يجب أن يحتوي على مدين أو دائن`
            });
        }
    }

    // 3. Check balance (debit == credit) with cent precision
    const diff = round2(Math.abs(totalDebit - totalCredit));
    if (diff > 0.001) { // Allow for tiny floating point differences
        errors.push({
            field: 'balance',
            code: 'UNBALANCED',
            message: `القيد غير متوازن: المدين=${round2(totalDebit)}, الدائن=${round2(totalCredit)}, الفرق=${diff}`,
            details: { totalDebit: round2(totalDebit), totalCredit: round2(totalCredit), diff }
        });
    }

    // 4. Verify all accounts exist in database
    if (accountIds.length > 0 && errors.length === 0) {
        const query = Account.find({ _id: { $in: accountIds } });
        if (session) query.session(session);

        const foundAccounts = await query;
        const foundIds = new Set(foundAccounts.map(a => a._id.toString()));

        for (let i = 0; i < entry.lines.length; i++) {
            const accountId = (entry.lines[i].accountId || entry.lines[i].account)?.toString();
            if (accountId && !foundIds.has(accountId)) {
                errors.push({
                    field: `lines[${i}].accountId`,
                    code: 'ACCOUNT_NOT_FOUND',
                    message: `السطر ${i + 1}: الحساب غير موجود (${accountId})`
                });
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        totals: { debit: round2(totalDebit), credit: round2(totalCredit) }
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

    // 1. Validate entry
    const validation = await validateJournalEntry(entry, session);

    if (!validation.valid) {
        const error = new JournalValidationError(
            validation.errors.map(e => e.message).join('; '),
            validation.errors[0]?.code || 'VALIDATION_ERROR'
        );
        error.errors = validation.errors;
        throw error;
    }

    // 2. Prepare lines for database
    const lines = entry.lines.map(line => ({
        account: line.accountId || line.account,
        debit: round2(Number(line.debit) || 0),
        credit: round2(Number(line.credit) || 0),
        memo: line.memo || line.note || ''
    }));

    // 3. Create journal entry document
    const journalData = {
        date: entry.date || new Date(),
        referenceType: entry.referenceType || 'MANUAL',
        referenceId: entry.referenceId || '',
        lines,
        ref: entry.ref || entry.reference || '',
        note: entry.note || entry.description || '',
        user: entry.userId || entry.createdBy || null,
        createdBy: entry.createdBy || entry.userId || null
    };

    let savedEntry;

    if (session) {
        const [created] = await JournalEntry.create([journalData], { session });
        savedEntry = created;
    } else {
        savedEntry = await JournalEntry.create(journalData);
    }

    // 4. Audit Trail (MANDATORY - throws if fails)
    const { auditCreate } = await import('./auditService.js');
    await auditCreate('JOURNAL', savedEntry, { _id: entry.createdBy || entry.userId });

    // 5. Update account balances (optional)
    if (updateBalances) {
        await updateAccountBalances(lines, session);
    }

    return savedEntry;
};

/**
 * Update account balances based on journal entry lines
 * @private
 */
const updateAccountBalances = async (lines, session = null) => {
    // Fetch accounts to determine their types
    const accountIds = lines.map(l => l.account);
    const query = Account.find({ _id: { $in: accountIds } });
    if (session) query.session(session);

    const accounts = await query;
    const accountMap = new Map(accounts.map(a => [a._id.toString(), a]));

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
            const updateQuery = Account.findByIdAndUpdate(
                account._id,
                { $inc: { balance: round2(balanceChange) } }
            );
            if (session) updateQuery.session(session);
            await updateQuery;
        }
    }
};

export default {
    validateJournalEntry,
    postJournalEntry,
    JournalValidationError
};
