import mongoose from 'mongoose';

/**
 * Run a posting operation inside a MongoDB transaction.
 * Keeps transaction handling consistent across modules.
 *
 * @param {(session: import('mongoose').ClientSession) => Promise<any>} handler
 * @returns {Promise<any>}
 */
export async function runPostingTransaction(handler) {
    const session = await mongoose.startSession();
    let result;

    try {
        await session.withTransaction(async () => {
            result = await handler(session);
        });
    } finally {
        session.endSession();
    }

    return result;
}

export default {
    runPostingTransaction
};
