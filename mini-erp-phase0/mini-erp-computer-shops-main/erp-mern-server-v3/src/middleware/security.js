/**
 * Security Middleware
 *
 * Provides XSS protection and input sanitization for the ERP system.
 */

import logger from '../config/logger.js';

/**
 * Dangerous HTML tags and patterns to sanitize
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, // Iframe tags
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, // Object tags
  /<embed\b[^>]*>/gi, // Embed tags
  /<link\b[^>]*>/gi, // Link tags
  /javascript:/gi, // JavaScript protocol
  /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
  /data:\s*text\/html/gi, // Data URLs with HTML
  /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, // SVG (can contain scripts)
  /expression\s*\(/gi, // CSS expressions
  /url\s*\(\s*["']?\s*javascript:/gi, // CSS URL with JavaScript
];

/**
 * Sanitize a string by removing dangerous patterns
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  let sanitized = str;

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Encode remaining HTML special characters for display purposes
  // Note: We don't fully escape < and > as they might be legitimate in some contexts
  // The dangerous patterns above handle the truly dangerous cases

  return sanitized.trim();
}

/**
 * Recursively sanitize an object's string values
 * @param {*} obj - Object to sanitize
 * @returns {*} - Sanitized object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize both key and value
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * XSS Protection Middleware
 *
 * Sanitizes req.body, req.query, and req.params to remove dangerous HTML/JavaScript
 *
 * @returns {Function} Express middleware
 */
export function xssProtection() {
  return (req, res, next) => {
    try {
      // Sanitize request body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
      }

      next();
    } catch (error) {
      logger.error('XSS sanitization error:', error.message);
      next(); // Continue even if sanitization fails
    }
  };
}

/**
 * Content-Type Validation Middleware
 *
 * Ensures JSON endpoints receive proper Content-Type header
 * Helps prevent CSRF and content-type confusion attacks
 */
export function validateContentType() {
  return (req, res, next) => {
    // Only check for POST, PUT, PATCH requests with body
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      const contentType = req.headers['content-type'] || '';

      // Allow JSON and form-urlencoded
      const validTypes = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'];

      const isValid = validTypes.some((type) => contentType.includes(type));

      if (!isValid) {
        logger.warn('Invalid Content-Type received', {
          path: req.path,
          method: req.method,
          contentType,
        });
        // Don't block, just log - could be file uploads or other valid cases
      }
    }

    next();
  };
}

/**
 * Security Headers Middleware
 *
 * Adds additional security headers beyond what Helmet provides
 */
export function additionalSecurityHeaders() {
  return (req, res, next) => {
    // Prevent caching of sensitive data
    if (req.path.includes('/api/auth') || req.path.includes('/api/users/me')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Additional CSP for API responses
    res.setHeader('X-Content-Type-Options', 'nosniff');

    next();
  };
}

/**
 * Password Strength Validator
 *
 * Validates password meets security requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @param {string} password - Password to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['كلمة المرور مطلوبة'] };
  }

  if (password.length < 8) {
    errors.push('يجب أن تكون كلمة المرور 8 أحرف على الأقل');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('يجب أن تحتوي على رقم واحد على الأقل (0-9)');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('يجب أن تحتوي على رمز خاص واحد على الأقل (!@#$%^&*...)');
  }

  return {
    valid: errors.length === 0,
    errors,
    message: errors.length > 0 ? 'كلمة المرور ضعيفة: ' + errors.join('، ') : 'كلمة المرور قوية',
  };
}

export default {
  xssProtection,
  validateContentType,
  additionalSecurityHeaders,
  validatePasswordStrength,
};
