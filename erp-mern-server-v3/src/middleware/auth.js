// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import TokenBlacklist from '../models/TokenBlacklist.js';
import logger from '../config/logger.js';

/**
 * JWT Authentication Middleware
 * 
 * Verifies JWT token and checks against blacklist for secure logout.
 * Attaches user payload to req.user if valid.
 * 
 * Security Features:
 * - Token verification with secret
 * - Token blacklist check (for logout/revocation)
 * - isActive check for banned users
 */
export function requireAuth() {
  return async (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
      // Step 1: Verify token signature and expiration
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      // Step 2: Check if token is blacklisted (logged out or revoked)
      const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
      if (isBlacklisted) {
        logger.logWarning('Blacklisted token used', {
          userId: payload.id,
          ip: req.ip
        });
        return res.status(401).json({
          message: 'Token has been revoked. Please login again.',
          code: 'TOKEN_REVOKED'
        });
      }

      // Step 3: Check if user account is active
      if (payload.isActive === false) {
        return res.status(403).json({
          message: 'Account is banned or inactive',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Attach user payload to request
      req.user = payload;
      req.token = token; // Store token for potential logout use

      return next();
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          message: 'Token has expired. Please login again.',
          code: 'TOKEN_EXPIRED'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          message: 'Invalid token',
          code: 'TOKEN_INVALID'
        });
      }

      // Log unexpected errors
      logger.error('Auth middleware error:', error.message);
      return res.status(401).json({ message: 'Authentication failed' });
    }
  };
}

/**
 * Optional Auth Middleware
 * 
 * Similar to requireAuth but doesn't reject if no token is provided.
 * Useful for endpoints that work differently for authenticated vs anonymous users.
 */
export function optionalAuth() {
  return async (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      // Check blacklist
      const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
      if (isBlacklisted) {
        req.user = null;
        return next();
      }

      if (payload.isActive === false) {
        req.user = null;
        return next();
      }

      req.user = payload;
      req.token = token;
      return next();
    } catch {
      req.user = null;
      return next();
    }
  };
}
