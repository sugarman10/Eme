import Transaction from '../models/Transaction.js';
import Treasury from '../models/Treasury.js';

/**
 * Create a financial transaction and update treasury balance
 * @param {object} data - Transaction data
 * @param {string} data.type - 'income', 'expense', or 'transfer'
 * @param {string} data.flow - 'in' or 'out'
 * @param {number} data.amount - Transaction amount
 * @param {string} data.treasury - Treasury ID
 * @param {string} data.relatedId - Related document ID (Invoice, PO, etc.)
 * @param {string} data.relatedModel - Related model name
 * @param {string} data.description - Transaction description
 * @param {string} data.category - Transaction category
 * @param {object} session - MongoDB session for transaction (null for standalone mode)
 * @returns {Promise<object>} - Created transaction
 */
export async function createTransaction(data, session = null) {
    const {
        type,
        flow,
        amount,
        treasury,
        relatedId = null,
        relatedModel = '',
        description = '',
        category = '',
        date = new Date()
    } = data;

    // Validate treasury exists (with or without session)
    const treasuryDoc = session
        ? await Treasury.findById(treasury).session(session)
        : await Treasury.findById(treasury);

    if (!treasuryDoc) {
        throw new Error('الخزينة غير موجودة (Treasury not found)');
    }

    // Create transaction (with or without session)
    const createOptions = session ? { session } : {};
    const transaction = await Transaction.create([{
        type,
        flow,
        category,
        amount,
        treasury,
        relatedId,
        relatedModel,
        description,
        date
    }], createOptions);

    // Update treasury balance
    if (flow === 'in') {
        treasuryDoc.balance += amount;
    } else if (flow === 'out') {
        treasuryDoc.balance -= amount;

        // Optional: Prevent negative balance
        if (treasuryDoc.balance < 0) {
            throw new Error(`رصيد الخزينة غير كافٍ. الحالي: ${treasuryDoc.balance + amount}, المطلوب: ${amount}`);
        }
    }

    // Save with or without session
    if (session) {
        await treasuryDoc.save({ session });
    } else {
        await treasuryDoc.save();
    }

    return transaction[0];
}

/**
 * Create income transaction (sales, receipts, etc.)
 * @param {object} data - Transaction data
 * @param {object} session - MongoDB session
 */
export async function createIncomeTransaction(data, session = null) {
    return createTransaction({
        ...data,
        type: 'income',
        flow: 'in'
    }, session);
}

/**
 * Create expense transaction (purchases, payments, etc.)
 * @param {object} data - Transaction data
 * @param {object} session - MongoDB session
 */
export async function createExpenseTransaction(data, session = null) {
    return createTransaction({
        ...data,
        type: 'expense',
        flow: 'out'
    }, session);
}

/**
 * Transfer between treasuries
 * @param {string} fromTreasuryId - Source treasury
 * @param {string} toTreasuryId - Destination treasury
 * @param {number} amount - Amount to transfer
 * @param {string} description - Transfer description
 * @param {object} session - MongoDB session
 */
export async function transferBetweenTreasuries(fromTreasuryId, toTreasuryId, amount, description = '', session = null) {
    // Create outgoing transaction
    await createTransaction({
        type: 'transfer',
        flow: 'out',
        amount,
        treasury: fromTreasuryId,
        description: description || `Transfer to treasury`,
        category: 'transfer'
    }, session);

    // Create incoming transaction
    await createTransaction({
        type: 'transfer',
        flow: 'in',
        amount,
        treasury: toTreasuryId,
        description: description || `Transfer from treasury`,
        category: 'transfer'
    }, session);
}
