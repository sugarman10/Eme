/**
 * Token Blacklist Model
 *
 * Stores invalidated JWT tokens for secure logout functionality.
 * Tokens are automatically expired via MongoDB TTL index.
 */

import mongoose from 'mongoose';

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  reason: {
    type: String,
    enum: ['logout', 'password_change', 'security', 'admin_revoke'],
    default: 'logout',
  },
  blacklistedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL index: MongoDB auto-deletes when expiresAt is reached
  },
});

// Static method to check if token is blacklisted
tokenBlacklistSchema.statics.isBlacklisted = async function (token) {
  const doc = await this.findOne({ token });
  return !!doc;
};

// Static method to blacklist a token
tokenBlacklistSchema.statics.blacklist = async function (token, userId, expiresAt, reason = 'logout') {
  try {
    await this.create({
      token,
      userId,
      expiresAt,
      reason,
    });
    return true;
  } catch (error) {
    // Handle duplicate key error (token already blacklisted)
    if (error.code === 11000) {
      return true; // Already blacklisted, consider it success
    }
    throw error;
  }
};

// Cleanup method for expired tokens (optional, TTL handles this)
tokenBlacklistSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({ expiresAt: { $lt: new Date() } });
  return result.deletedCount;
};

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

export default TokenBlacklist;
