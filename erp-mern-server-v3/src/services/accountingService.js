import mongoose from 'mongoose';
import JournalEntry from '../models/JournalEntry.js';
import Account from '../models/Account.js';

/**
 * DOUBLE-ENTRY ACCOUNTING ENGINE
 * 
 * This service handles the creation of Journal Entries and ensures
 * the fundamental accounting equation (Debits = Credits) is always met.
 * It also atomically updates the balances of the affected accounts.
 */

/**
 * Ensure transaction balance (Debit === Credit)
 * @param {Array} entries - List of { accountId, debit, credit }
 */
import { round, sub, add } from '../utils/mathUtils.js';

/**
 * Ensure transaction balance (Debit === Credit)
 * @param {Array} entries - List of { accountId, debit, credit }
 */
const validateBalance = (entries) => {
    let totalDebit = 0;
    let totalCredit = 0;

    entries.forEach(entry => {
        totalDebit = add(totalDebit, Number(entry.debit) || 0);
        totalCredit = add(totalCredit, Number(entry.credit) || 0);
    });

    // Precision check using robust math
    // We check if the difference is effectively zero (allowing for tiny epsilon just in case, but custom sub handles it)
    const diff = Math.abs(sub(totalDebit, totalCredit));

    // Strict zero check for financial integrity
    if (diff > 0) {
        throw new Error(`Unbalanced Journal Entry. Debit: ${totalDebit}, Credit: ${totalCredit}, Diff: ${diff}`);
    }
};

/**
 * Determine the effect on account balance based on Account Type and Entry Side
 * Asset/Expense: Debit increases (+), Credit decreases (-)
 * Liability/Equity/Revenue: Credit increases (+), Debit decreases (-)
 * 
 * However, to keep it simple for the database:
 * We usually store "Debit is Positive" and "Credit is Negative" OR store absolute value and calc on fly.
 * 
 * APPROACH USED HERE: **Signed Balance**
 * Assets/Expenses: Normal Balance is Debit (Positive)
 * Liabilities/Equity/Revenue: Normal Balance is Credit (Positive)
 * 
 * We will update the balance atomically based on the "nature" of the account.
 * To do this efficiently in one go without looking up every account type first, 
 * we rely on the caller or we do a lookup. 
 * 
 * BETTER APPROACH FOR HIGH PERFORMANCE:
 * Store `balance` simply as (Debit - Credit). 
 * So Assets have + balance, Liabilities have - balance.
 * 
 * Let's stick to the "User Friendly" balance:
 * We need to know account type to know if we Add or Subtract.
 * => We must fetch account types.
 */

/**
 * Create a Journal Entry
 * @param {object} session - Mongoose Session (Required)
 * @param {object} data - { date, reference, description, entries: [{ accountId, debit, credit, note }] }
 */
export const createJournalEntry = async (session, data) => {
    const { date, reference, description, entries, userId } = data;

    if (!entries || entries.length < 2) {
        throw new Error('Journal Entry must have at least 2 lines.');
    }

    // 1. Validate Balance
    validateBalance(entries);

    // 2. Fetch Accounts to validate existence and determine types for balance update
    const accountIds = entries.map(e => e.accountId);
    const accounts = await Account.find({ _id: { $in: accountIds } }).session(session);

    if (accounts.length !== new Set(accountIds).size) {
        throw new Error('One or more accounts not found.');
    }

    const accountMap = accounts.reduce((map, acc) => {
        map[acc._id.toString()] = acc;
        return map;
    }, {});

    // 3. Prepare Journal Document
    // Format lines for model
    const lines = entries.map(e => ({
        account: e.accountId,
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0,
        note: e.note || ''
    }));

    const journalEntry = new JournalEntry({
        date: date || new Date(),
        ref: reference,
        note: description,
        lines,
        user: userId // Optional audit trail
    });

    await journalEntry.save({ session });

    // 4. Update Account Balances (Atomic)
    // We iterate and update each account. 
    // Optimization: BulkWrite could be used but loop is fine for small batches.
    for (const entry of entries) {
        const account = accountMap[entry.accountId.toString()];
        const debit = Number(entry.debit) || 0;
        const credit = Number(entry.credit) || 0;

        let balanceChange = 0;

        // Formula: Normal Balance Increase
        if (['asset', 'expense'].includes(account.type.toLowerCase())) {
            // Debit increases (+), Credit decreases (-)
            balanceChange = sub(debit, credit);
        } else {
            // Liability, Equity, Revenue
            // Credit increases (+), Debit decreases (-)
            balanceChange = sub(credit, debit);
        }

        if (balanceChange !== 0) {
            await Account.findByIdAndUpdate(
                account._id,
                { $inc: { balance: balanceChange } },
                { session }
            );
        }
    }

    return journalEntry;
};
