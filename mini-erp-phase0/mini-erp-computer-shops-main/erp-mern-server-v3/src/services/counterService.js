import Counter from '../models/Counter.js';
import CompanySettings from '../models/CompanySettings.js';
import SalesInvoice from '../models/SalesInvoice.js';

/**
 * Format invoice prefix cleanly:
 * - Trims whitespace
 * - Defaults to 'INV-' if empty or falsy
 * - Collapses multiple trailing hyphens
 * - Ensures a delimiter ('-', '/', '_') exists at the end
 *
 * Examples:
 *  'INV-'   -> 'INV-'
 *  'INV'    -> 'INV-'
 *  'FAT-'   -> 'FAT-'
 *  'FAT'    -> 'FAT-'
 *  'فاتورة' -> 'فاتورة-'
 *  ''       -> 'INV-'
 */
export function formatInvoicePrefix(rawPrefix) {
  let p = (rawPrefix || '').trim();
  if (!p) return 'INV-';
  p = p.replace(/-+$/, '-');
  if (p.endsWith('-') || p.endsWith('/') || p.endsWith('_')) {
    return p;
  }
  return `${p}-`;
}

/**
 * Get counter name for a given prefix
 */
export function getInvoiceCounterName(cleanPrefix) {
  return `invoice_${cleanPrefix}`;
}

/**
 * Get next sequence number for a counter
 * @param {string} counterName - Name of the counter (e.g., 'invoice')
 * @returns {Promise<number>} - Next sequence number
 */
export async function getNextSequence(counterName) {
  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

/**
 * Get the true mathematical maximum sequence number from existing invoices in the DB
 * @param {string} prefix - Cleaned prefix to match against (e.g. 'INV-', 'FAT-')
 * @returns {Promise<number>} - Highest sequence number found, or 0 if none
 */
export async function getHighestInvoiceSequence(prefix) {
  try {
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escapedPrefix}(\\d+)$`);
    const invoices = await SalesInvoice.find({ number: prefixRegex }, { number: 1 }).lean();
    let maxSeq = 0;
    for (const inv of invoices) {
      const match = inv.number.match(prefixRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
    return maxSeq;
  } catch (err) {
    return 0;
  }
}

/**
 * Generate invoice number with prefix
 * @param {string} [customPrefix] - Optional prefix override (e.g., 'INV-', 'FAT-')
 * @returns {Promise<string>} - Formatted invoice number (e.g., 'INV-00001', 'FAT-00001')
 */
export async function generateInvoiceNumber(customPrefix = null) {
  let rawPrefix = customPrefix;
  if (!rawPrefix) {
    try {
      const settings = await CompanySettings.getSettings();
      rawPrefix = settings?.invoicePrefix;
    } catch (err) {
      rawPrefix = 'INV-';
    }
  }

  const prefix = formatInvoicePrefix(rawPrefix);
  const counterName = getInvoiceCounterName(prefix);

  // Initialize counter if not already created
  const existingCounter = await Counter.findOne({ name: counterName });
  if (!existingCounter) {
    let initialSeq = 0;
    // If prefix is 'INV-', check legacy 'invoice' counter for existing sequence
    if (prefix === 'INV-') {
      const legacyCounter = await Counter.findOne({ name: 'invoice' });
      if (legacyCounter?.seq) {
        initialSeq = legacyCounter.seq;
      }
    }

    // Check true maximum existing invoice in DB with this prefix
    const maxExisting = await getHighestInvoiceSequence(prefix);
    if (maxExisting > initialSeq) {
      initialSeq = maxExisting;
    }

    await Counter.findOneAndUpdate(
      { name: counterName },
      { $setOnInsert: { seq: initialSeq } },
      { upsert: true }
    );
  }

  // Atomically increment counter
  const updatedCounter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  let seq = updatedCounter.seq;

  // Collision prevention safety check:
  // If an invoice with candidate number already exists, jump to true max + 1
  let candidateNumber = `${prefix}${String(seq).padStart(5, '0')}`;
  const existingInvoice = await SalesInvoice.findOne({ number: candidateNumber });
  if (existingInvoice) {
    const trueMax = await getHighestInvoiceSequence(prefix);
    seq = trueMax + 1;
    await Counter.findOneAndUpdate({ name: counterName }, { seq });
    candidateNumber = `${prefix}${String(seq).padStart(5, '0')}`;
  }

  return candidateNumber;
}

/**
 * Reset counter (use with caution!)
 * @param {string} counterName - Name of the counter to reset
 */
export async function resetCounter(counterName) {
  await Counter.findOneAndUpdate({ name: counterName }, { seq: 0 }, { upsert: true });
}
