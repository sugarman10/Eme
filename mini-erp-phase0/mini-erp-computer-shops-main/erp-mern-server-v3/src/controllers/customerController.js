import Customer from '../models/Customer.js';
import SalesInvoice from '../models/SalesInvoice.js';

export async function createCustomer(req, res) {
  const exists = await Customer.findOne({ code: req.body.code });
  if (exists) return res.status(409).json({ message: 'Customer code exists' });

  // accountId removed - using parent accounts directly

  const c = await Customer.create(req.body);
  res.status(201).json(c);
}

export async function getCustomers(req, res) {
  const rawQ = req.query.q;
  const q = typeof rawQ === 'string' ? rawQ.trim() : '';

  const filter = q
    ? {
        $or: [
          { code: { $regex: q, $options: 'i' } },
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
        ],
      }
    : {};

  const data = await Customer.find(filter).sort({ name: 1 });
  res.json(data);
}

export async function getCustomerById(req, res) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  // Calculate Balance: Sum of (Grand Total - Paid) for all non-cancelled invoices
  const result = await SalesInvoice.aggregate([
    { $match: { customer: customer._id, status: { $ne: 'cancelled' } } },
    {
      $group: {
        _id: null,
        totalDue: { $sum: { $subtract: [{ $ifNull: ['$totals.grand', 0] }, { $ifNull: ['$totals.paid', 0] }] } },
      },
    },
  ]);

  const invoiceBalance = result[0]?.totalDue || 0;
  // Use stored balance (can be negative = customer credit) if different from invoice calculation
  // Priority: stored balance because it accounts for receipts and corrections
  const storedBalance = customer.balance || 0;

  res.json({
    ...customer,
    balance: storedBalance, // Use stored balance (supports negative = credit)
    invoiceBalance: invoiceBalance, // Also include calculated for reference
  });
}

export async function updateCustomer(req, res) {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  // Check code uniqueness if changed
  if (req.body.code && req.body.code !== customer.code) {
    const exists = await Customer.findOne({ code: req.body.code });
    if (exists) return res.status(409).json({ message: 'Customer code exists' });
  }

  // accountId removed - using parent accounts directly

  const updatedCustomer = await Customer.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  res.json(updatedCustomer);
}

export async function deleteCustomer(req, res) {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  await customer.deleteOne();
  res.json({ message: 'Customer deleted' });
}
