import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import WalletTransaction from '../models/WalletTransaction.js';
import logger from '../config/logger.js';

/**
 * Wallet Controller
 *
 * Manages customer wallet (store credit) operations:
 * - Add credit (deposit/refund)
 * - Use credit (payment)
 * - Get balance & history
 */

// ============================================================
// ADD CREDIT TO WALLET
// ============================================================

/**
 * Add credit to customer wallet
 * Uses atomic $inc to prevent race conditions
 *
 * @param {string} customerId - Customer ID
 * @param {number} amount - Amount to add (positive)
 * @param {string} type - Transaction type ('deposit' | 'refund' | 'adjustment')
 * @param {Object} reference - Optional reference { type, id, number }
 * @param {string} note - Optional note
 * @param {string} userId - User performing action
 * @param {Object} session - MongoDB session for transactions
 */
export const addCredit = async (
  customerId,
  amount,
  type,
  reference = null,
  note = '',
  userId = null,
  session = null
) => {
  if (amount <= 0) {
    throw new Error('المبلغ يجب أن يكون موجباً');
  }

  const options = session ? { session } : {};

  // Get current balance
  const customer = await Customer.findById(customerId).session(session);
  if (!customer) {
    throw new Error('العميل غير موجود');
  }

  const balanceBefore = customer.walletBalance || 0;
  const balanceAfter = balanceBefore + amount;

  // Atomic update
  await Customer.findByIdAndUpdate(customerId, { $inc: { walletBalance: amount } }, options);

  // Log transaction
  const transaction = await WalletTransaction.logTransaction(
    {
      customer: customerId,
      type,
      amount: amount, // Positive for credit
      balanceBefore,
      balanceAfter,
      reference,
      note,
      createdBy: userId,
    },
    session
  );

  logger.info('Wallet credit added', {
    customerId,
    amount,
    type,
    balanceAfter,
    transactionId: transaction._id,
  });

  return {
    success: true,
    newBalance: balanceAfter,
    transaction,
  };
};

// ============================================================
// USE CREDIT FROM WALLET
// ============================================================

/**
 * Deduct credit from customer wallet
 * Used for payments or transfers
 *
 * @param {string} customerId - Customer ID
 * @param {number} amount - Amount to deduct (positive)
 * @param {Object} reference - Reference { type, id, number }
 * @param {string} note - Optional note
 * @param {string} userId - User performing action
 * @param {Object} session - MongoDB session for transactions
 */
export const useCredit = async (customerId, amount, reference, note = '', userId = null, session = null) => {
  if (amount <= 0) {
    throw new Error('المبلغ يجب أن يكون موجباً');
  }

  const options = session ? { session } : {};

  // Get current balance with lock
  const customer = await Customer.findById(customerId).session(session);
  if (!customer) {
    throw new Error('العميل غير موجود');
  }

  const walletBefore = Number(customer.walletBalance || 0);
  const debtBalance = Number(customer.balance || 0);
  const creditFromNegativeBalance = debtBalance < 0 ? Math.abs(debtBalance) : 0;
  const availableCredit = Number((walletBefore + creditFromNegativeBalance).toFixed(2));

  if (availableCredit + 0.001 < amount) {
    throw new Error(`رصيد المحفظة غير كافي. الرصيد المتاح: ${availableCredit}`);
  }

  // Determine how much comes from walletBalance vs negative debtBalance (overpayment)
  const deductFromWallet = Math.min(walletBefore, amount);
  const deductFromNegativeBalance = Number((amount - deductFromWallet).toFixed(2));
  const balanceAfter = Number((walletBefore - deductFromWallet).toFixed(2));

  const updateOps = {};
  if (deductFromWallet > 0 && deductFromNegativeBalance > 0) {
    updateOps.$inc = {
      walletBalance: -deductFromWallet,
      balance: deductFromNegativeBalance, // moves negative balance closer to 0
    };
  } else if (deductFromWallet > 0) {
    updateOps.$inc = { walletBalance: -deductFromWallet };
  } else if (deductFromNegativeBalance > 0) {
    updateOps.$inc = { balance: deductFromNegativeBalance };
  }

  // Atomic update with balance check
  const filter = { _id: customerId };
  if (deductFromWallet > 0) {
    filter.walletBalance = { $gte: deductFromWallet - 0.001 };
  }
  const result = await Customer.findOneAndUpdate(
    filter,
    updateOps,
    { ...options, new: true }
  );

  if (!result) {
    throw new Error('فشل في خصم المبلغ - تحقق من الرصيد');
  }

  // Log transaction
  const transaction = await WalletTransaction.logTransaction(
    {
      customer: customerId,
      type: 'payment_usage',
      amount: -amount, // Negative for debit
      balanceBefore: availableCredit,
      balanceAfter: Number((availableCredit - amount).toFixed(2)),
      reference,
      note,
      createdBy: userId,
    },
    session
  );

  logger.info('Wallet credit used', {
    customerId,
    amount,
    balanceAfter,
    reference,
    transactionId: transaction._id,
  });

  return {
    success: true,
    newBalance: balanceAfter,
    transaction,
  };
};

// ============================================================
// GET WALLET BALANCE
// ============================================================

/**
 * Get customer wallet balance
 */
export const getWalletBalance = async (req, res) => {
  const { customerId } = req.params;

  const customer = await Customer.findById(customerId).select('name code walletBalance balance');
  if (!customer) {
    return res.status(404).json({ message: 'العميل غير موجود' });
  }

  const walletBalance = customer.walletBalance || 0;
  const debtBalance = customer.balance || 0;
  // If balance is negative, customer has overpaid - that's additional credit
  const creditFromNegativeBalance = debtBalance < 0 ? Math.abs(debtBalance) : 0;
  const availableCredit = walletBalance + creditFromNegativeBalance;

  res.json({
    customerId: customer._id,
    name: customer.name,
    code: customer.code,
    walletBalance: walletBalance,
    debtBalance: debtBalance,
    creditFromNegativeBalance: creditFromNegativeBalance,
    availableCredit: availableCredit, // Total usable credit
  });
};

// ============================================================
// GET WALLET TRANSACTIONS
// ============================================================

/**
 * Get wallet transaction history for a customer
 */
export const getWalletTransactions = async (req, res) => {
  const { customerId } = req.params;
  const { limit = 50, skip = 0, type } = req.query;

  const transactions = await WalletTransaction.getCustomerHistory(customerId, {
    limit: parseInt(limit),
    skip: parseInt(skip),
    type,
  });

  const total = await WalletTransaction.countDocuments({ customer: customerId });

  res.json({
    transactions,
    pagination: {
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      hasMore: skip + transactions.length < total,
    },
  });
};

// ============================================================
// DEPOSIT TO WALLET (API Endpoint)
// ============================================================

/**
 * API endpoint to add deposit to wallet
 */
export const depositToWallet = async (req, res) => {
  const { customerId } = req.params;
  const { amount, treasuryId, note } = req.body;

  const safeAmount = Number(amount);
  if (!safeAmount || safeAmount <= 0) {
    return res.status(400).json({ message: 'المبلغ يجب أن يكون موجباً' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Add credit to customer wallet
    const result = await addCredit(
      customerId,
      safeAmount,
      'deposit',
      { type: 'Manual' },
      note || 'إيداع نقدي',
      req.user?._id || req.user?.id,
      session
    );

    // 2. Resolve Treasury and record Treasury income transaction
    const { createIncomeTransaction } = await import('../services/transactionService.js');
    const Treasury = (await import('../models/Treasury.js')).default;
    let targetTreasuryId = treasuryId;
    if (!targetTreasuryId) {
      const defTreasury = (await Treasury.findOne({ isActive: true, isDefault: true }).session(session)) ||
                          (await Treasury.findOne({ isActive: true }).session(session));
      targetTreasuryId = defTreasury?._id;
    }

    if (targetTreasuryId) {
      await createIncomeTransaction(
        {
          amount: safeAmount,
          treasury: targetTreasuryId,
          relatedId: customerId,
          relatedModel: 'Customer',
          description: `إيداع بمحفظة العميل: ${note || ''}`.trim(),
          category: 'deposit',
          date: new Date(),
        },
        session
      );
    }

    // 3. Post Journal Entry to General Ledger: Dr Cash/Treasury, Cr Customer Deposits (CUSTOMER_WALLET)
    const Account = (await import('../models/Account.js')).default;
    const { postJournalEntry } = await import('../services/journalEntryService.js');
    const { getSystemAccount } = await import('../services/systemAccountsService.js');
    const customerDepositsAcc = await getSystemAccount('CUSTOMER_WALLET', session);

    let cashAcc = null;
    if (targetTreasuryId) {
      const tDoc = await Treasury.findById(targetTreasuryId).session(session);
      if (tDoc?.accountId) cashAcc = await Account.findById(tDoc.accountId).session(session);
    }
    if (!cashAcc) cashAcc = await getSystemAccount('CASH', session);

    if (customerDepositsAcc && cashAcc) {
      const customerDoc = await Customer.findById(customerId).session(session);
      await postJournalEntry(
        {
          date: new Date(),
          referenceType: 'WALLET_DEPOSIT',
          referenceId: customerId.toString(),
          ref: `DEP-${customerId.toString().slice(-6)}`,
          note: `إيداع بمحفظة العميل ${customerDoc?.name || ''} - ${note || ''}`.trim(),
          createdBy: req.user?._id || req.user?.id,
          lines: [
            {
              accountId: cashAcc._id,
              debit: safeAmount,
              credit: 0,
              memo: `توريد إيداع نقدي للمحفظة في ${cashAcc.name}`,
            },
            {
              accountId: customerDepositsAcc._id,
              debit: 0,
              credit: safeAmount,
              memo: `أمانات عميل - ${customerDoc?.name || ''}`,
            },
          ],
        },
        { session, updateBalances: true }
      );
    }

    await session.commitTransaction();

    res.status(200).json({
      message: 'تم إيداع المبلغ بنجاح',
      ...result,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.logError('Wallet deposit failed', { error: error.message, customerId, amount });
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// ============================================================
// USE WALLET FOR PAYMENT (API Endpoint)
// ============================================================

/**
 * API endpoint to use wallet balance for payment of existing invoice
 * This reduces both walletBalance AND customer.balance (debt)
 */
export const useWalletForPayment = async (req, res) => {
  const { customerId } = req.params;
  const { amount, invoiceId, invoiceNumber, note } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'المبلغ يجب أن يكون موجباً' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 0. Import models and services
    const Receipt = (await import('../models/Receipt.js')).default;
    const Account = (await import('../models/Account.js')).default;
    const { postJournalEntry } = await import('../services/journalEntryService.js');
    const SalesInvoice = (await import('../models/SalesInvoice.js')).default;

    // 1. Create Receipt Document (To document the payment)
    const receipt = await Receipt.create(
      [
        {
          customer: customerId,
          date: new Date(),
          amount,
          method: 'wallet',
          note: note || `سداد من المحفظة للفاتورة ${invoiceNumber || ''}`,
          invoices: invoiceId ? [invoiceId] : [],
          allocations: invoiceId ? [{ invoice: invoiceId, amount }] : [],
        },
      ],
      { session }
    );

    const receiptDoc = receipt[0];

    // 2. Deduct from wallet balance (Operational)
    const result = await useCredit(
      customerId,
      amount,
      {
        type: 'Receipt',
        id: receiptDoc._id,
        number: `RCT-${receiptDoc._id.toString().slice(-6)}`,
      },
      note || 'سداد فاتورة من المحفظة',
      req.user?._id || req.user?.id,
      session
    );

    // 3. Reduce customer debt (balance) - Operational
    await Customer.findByIdAndUpdate(customerId, { $inc: { balance: -amount } }, { session });

    // 4. Update invoice paid amount if invoice provided
    if (invoiceId) {
      await SalesInvoice.findByIdAndUpdate(
        invoiceId,
        {
          $inc: { 'totals.paid': amount, 'totals.remaining': -amount },
        },
        { session }
      );
    }

    // 5. Create Journal Entry (Accounting)
    // Dr: Wallet (CUSTOMER_WALLET) - Reduce Liability
    // Cr: Accounts Receivable (AR) - Reduce Asset (Customer Debt)
    const { getSystemAccount } = await import('../services/systemAccountsService.js');
    const [walletAcc, arAcc] = await Promise.all([
      getSystemAccount('CUSTOMER_WALLET', session),
      getSystemAccount('AR', session),
    ]);

    if (walletAcc && arAcc) {
      await postJournalEntry(
        {
          date: new Date(),
          referenceType: 'RECEIPT',
          referenceId: receiptDoc._id.toString(),
          ref: `RCT-${receiptDoc._id.toString().slice(-6)}`,
          note: `سداد من المحفظة - ${note || ''}`,
          createdBy: req.user?._id || req.user?.id,
          lines: [
            {
              accountId: walletAcc._id,
              debit: amount,
              credit: 0,
              memo: 'خصم من المحفظة',
            },
            {
              accountId: arAcc._id,
              debit: 0,
              credit: amount,
              memo: `سداد ذمم (فاتورة ${invoiceNumber || ''})`,
            },
          ],
        },
        { session, updateBalances: true }
      );
    } else {
      logger.logWarning('Missing system accounts for wallet payment JE (2030/1030)');
    }

    await session.commitTransaction();

    logger.info('Wallet payment for invoice successful', { customerId, amount, invoiceId, receiptId: receiptDoc._id });

    res.status(200).json({
      message: 'تم سداد المبلغ من المحفظة بنجاح وإنشاء سند قبض',
      ...result,
      receipt: receiptDoc,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.logError('Wallet payment failed', { error: error.message, customerId, amount });
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// ============================================================
// ADJUST WALLET BALANCE (Admin Only)
// ============================================================

/**
 * Manual adjustment of wallet balance (admin only)
 */
export const adjustWalletBalance = async (req, res) => {
  const { customerId } = req.params;
  const { amount, note } = req.body;

  if (!amount || amount === 0) {
    return res.status(400).json({ message: 'المبلغ مطلوب' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let result;

    if (amount > 0) {
      // Adding credit
      result = await addCredit(
        customerId,
        amount,
        'adjustment',
        { type: 'Manual' },
        note || 'تعديل يدوي - إضافة',
        req.user?._id || req.user?.id,
        session
      );
    } else {
      // Deducting credit
      result = await useCredit(
        customerId,
        Math.abs(amount),
        { type: 'Manual' },
        note || 'تعديل يدوي - خصم',
        req.user?._id || req.user?.id,
        session
      );
    }

    // Record corresponding Journal Entry in General Ledger
    const { postJournalEntry } = await import('../services/journalEntryService.js');
    const { getSystemAccount } = await import('../services/systemAccountsService.js');
    const [walletAcc, discountAcc, overageAcc] = await Promise.all([
      getSystemAccount('CUSTOMER_WALLET', session),
      getSystemAccount('SALES_DISCOUNT', session),
      getSystemAccount('CASH_OVERAGE', session),
    ]);

    const customerDoc = await Customer.findById(customerId).session(session);
    const absAmount = Math.abs(Number(amount));

    if (walletAcc && discountAcc && overageAcc) {
      const lines =
        amount > 0
          ? [
              {
                accountId: discountAcc._id,
                debit: absAmount,
                credit: 0,
                memo: `تسوية محفظة (إضافة رصيد) - ${customerDoc?.name || ''}`,
              },
              {
                accountId: walletAcc._id,
                debit: 0,
                credit: absAmount,
                memo: `زيادة رصيد محفظة العميل - ${note || ''}`.trim(),
              },
            ]
          : [
              {
                accountId: walletAcc._id,
                debit: absAmount,
                credit: 0,
                memo: `تخفيض رصيد محفظة العميل - ${note || ''}`.trim(),
              },
              {
                accountId: overageAcc._id,
                debit: 0,
                credit: absAmount,
                memo: `تسوية محفظة (خصم رصيد) - ${customerDoc?.name || ''}`,
              },
            ];

      await postJournalEntry(
        {
          date: new Date(),
          referenceType: 'ADJUSTMENT',
          referenceId: customerId.toString(),
          ref: `WADJ-${customerId.toString().slice(-6)}`,
          note: `تسوية يدوية لمحفظة العميل ${customerDoc?.name || ''} - ${note || ''}`.trim(),
          createdBy: req.user?._id || req.user?.id,
          lines,
        },
        { session, updateBalances: true }
      );
    }

    await session.commitTransaction();

    res.status(200).json({
      message: 'تم تعديل الرصيد بنجاح',
      ...result,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.logError('Wallet adjustment failed', { error: error.message, customerId, amount });
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// ============================================================
// WITHDRAW FROM WALLET (Cash Out - Manager Only)
// ============================================================

/**
 * Withdraw cash from customer wallet
 * Requires manager approval
 * Creates expense transaction and journal entry
 */
export const withdrawFromWallet = async (req, res) => {
  const { customerId } = req.params;
  const { amount, treasuryId, note } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'المبلغ يجب أن يكون موجباً' });
  }

  if (!treasuryId) {
    return res.status(400).json({ message: 'يجب تحديد الخزينة للصرف' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Deduct from wallet balance
    const result = await useCredit(
      customerId,
      amount,
      { type: 'Withdrawal', id: null, number: null },
      note || 'صرف نقدي من المحفظة',
      req.user?._id || req.user?.id,
      session
    );

    // 2. Create expense transaction (deduct from treasury)
    const { createExpenseTransaction } = await import('../services/transactionService.js');
    await createExpenseTransaction(
      {
        amount,
        treasury: treasuryId,
        relatedId: customerId,
        relatedModel: 'Customer',
        description: `صرف نقدي من محفظة العميل - ${note || ''}`,
        category: 'wallet_withdrawal',
        date: new Date(),
      },
      session
    );

    // 3. Create Journal Entry
    // Debit: Customer Deposits (CUSTOMER_WALLET) - reduce liability
    // Credit: Cash/Bank (Treasury account) - cash out
    const { postJournalEntry } = await import('../services/journalEntryService.js');
    const { getSystemAccount } = await import('../services/systemAccountsService.js');
    const Account = (await import('../models/Account.js')).default;
    const Treasury = (await import('../models/Treasury.js')).default;

    const customerDepositsAcc = await getSystemAccount('CUSTOMER_WALLET', session);
    let cashAcc = null;
    if (treasuryId) {
      const tDoc = await Treasury.findById(treasuryId).session(session);
      if (tDoc?.accountId) cashAcc = await Account.findById(tDoc.accountId).session(session);
      if (!cashAcc) cashAcc = await getSystemAccount(tDoc?.type === 'bank' ? 'BANK' : 'CASH', session);
    }
    if (!cashAcc) cashAcc = await getSystemAccount('CASH', session);

    if (!customerDepositsAcc || !cashAcc) {
      throw new Error('حسابات النظام غير مكتملة (CUSTOMER_WALLET أو CASH)');
    }

    const customer = await Customer.findById(customerId).session(session);

    await postJournalEntry(
      {
        date: new Date(),
        referenceType: 'WALLET_WITHDRAWAL',
        referenceId: customerId,
        ref: `WD-${customerId.slice(-6)}`,
        note: `صرف نقدي من محفظة العميل ${customer?.name || ''}`,
        createdBy: req.user?._id || req.user?.id,
        lines: [
          {
            accountId: customerDepositsAcc._id,
            debit: amount,
            credit: 0,
            memo: 'صرف من المحفظة',
          },
          {
            accountId: cashAcc._id,
            debit: 0,
            credit: amount,
            memo: 'صرف نقدي للعميل',
          },
        ],
      },
      { session, updateBalances: true }
    );

    await session.commitTransaction();

    logger.info('Wallet withdrawal successful', { customerId, amount, treasuryId });

    res.status(200).json({
      message: 'تم صرف المبلغ بنجاح',
      ...result,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.logError('Wallet withdrawal failed', { error: error.message, customerId, amount });
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
};
