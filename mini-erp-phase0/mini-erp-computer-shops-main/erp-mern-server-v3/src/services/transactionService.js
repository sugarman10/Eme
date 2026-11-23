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
    date = new Date(),
  } = data;

  const safeAmount = Number(amount);
  if (!safeAmount || safeAmount <= 0) {
    throw new Error('Invalid transaction amount');
  }

  let treasuryDoc = null;

  if (flow === 'out') {
    treasuryDoc = await Treasury.findOneAndUpdate(
      { _id: treasury, balance: { $gte: safeAmount } },
      { $inc: { balance: -safeAmount } },
      { new: true, session }
    );

    if (!treasuryDoc) {
      const existingQuery = Treasury.findById(treasury);
      if (session) existingQuery.session(session);
      const existing = await existingQuery;
      if (!existing) {
        throw new Error('Treasury not found');
      }
      throw new Error(`Insufficient treasury balance. Available: ${existing.balance}, Required: ${safeAmount}`);
    }
  } else if (flow === 'in') {
    treasuryDoc = await Treasury.findByIdAndUpdate(treasury, { $inc: { balance: safeAmount } }, { new: true, session });

    if (!treasuryDoc) {
      throw new Error('Treasury not found');
    }
  } else {
    throw new Error('Invalid transaction flow');
  }

  const createOptions = session ? { session } : {};
  const transaction = await Transaction.create(
    [
      {
        type,
        flow,
        category,
        amount: safeAmount,
        treasury,
        relatedId,
        relatedModel,
        description,
        date,
      },
    ],
    createOptions
  );

  return transaction[0];
}

/**
 * Create income transaction (sales, receipts, etc.)
 * @param {object} data - Transaction data
 * @param {object} session - MongoDB session
 */
export async function createIncomeTransaction(data, session = null) {
  return createTransaction(
    {
      ...data,
      type: 'income',
      flow: 'in',
    },
    session
  );
}

/**
 * Create expense transaction (purchases, payments, etc.)
 * @param {object} data - Transaction data
 * @param {object} session - MongoDB session
 */
export async function createExpenseTransaction(data, session = null) {
  return createTransaction(
    {
      ...data,
      type: 'expense',
      flow: 'out',
    },
    session
  );
}

/**
 * Transfer between treasuries
 * @param {string} fromTreasuryId - Source treasury
 * @param {string} toTreasuryId - Destination treasury
 * @param {number} amount - Amount to transfer
 * @param {string} description - Transfer description
 * @param {object} session - MongoDB session
 */
export async function transferBetweenTreasuries(
  fromTreasuryId,
  toTreasuryId,
  amount,
  description = '',
  session = null,
  userId = null
) {
  // Create outgoing transaction
  await createTransaction(
    {
      type: 'transfer',
      flow: 'out',
      amount,
      treasury: fromTreasuryId,
      description: description || `Transfer to treasury`,
      category: 'transfer',
    },
    session
  );

  // Create incoming transaction
  await createTransaction(
    {
      type: 'transfer',
      flow: 'in',
      amount,
      treasury: toTreasuryId,
      description: description || `Transfer from treasury`,
      category: 'transfer',
    },
    session
  );

  // Automated Journal Entry between treasury accounts in General Ledger
  try {
    const fromTreasury = await Treasury.findById(fromTreasuryId).session(session);
    const toTreasury = await Treasury.findById(toTreasuryId).session(session);

    if (fromTreasury?.accountId && toTreasury?.accountId) {
      const { postJournalEntry } = await import('./journalEntryService.js');
      await postJournalEntry(
        {
          date: new Date(),
          referenceType: 'MANUAL',
          ref: `TRF-${Date.now().toString().slice(-6)}`,
          note: description || `تحويل بين الخزائن: من ${fromTreasury.name} إلى ${toTreasury.name}`,
          createdBy: userId,
          lines: [
            {
              accountId: toTreasury.accountId,
              debit: Number(amount),
              credit: 0,
              memo: `استلام تحويل في ${toTreasury.name}`,
            },
            {
              accountId: fromTreasury.accountId,
              debit: 0,
              credit: Number(amount),
              memo: `إرسال تحويل من ${fromTreasury.name}`,
            },
          ],
        },
        { session, updateBalances: true }
      );
    }
  } catch (jeErr) {
    console.warn('Could not post transfer journal entry:', jeErr.message);
  }
}
