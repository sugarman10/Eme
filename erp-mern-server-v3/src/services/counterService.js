import Counter from '../models/Counter.js';

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
 * Generate invoice number with prefix
 * @param {string} prefix - Prefix for invoice number (e.g., 'INV')
 * @returns {Promise<string>} - Formatted invoice number (e.g., 'INV-00001')
 */
export async function generateInvoiceNumber(prefix = 'INV') {
    const seq = await getNextSequence('invoice');
    return `${prefix}-${String(seq).padStart(5, '0')}`;
}

/**
 * Reset counter (use with caution!)
 * @param {string} counterName - Name of the counter to reset
 */
export async function resetCounter(counterName) {
    await Counter.findOneAndUpdate(
        { name: counterName },
        { seq: 0 },
        { upsert: true }
    );
}
