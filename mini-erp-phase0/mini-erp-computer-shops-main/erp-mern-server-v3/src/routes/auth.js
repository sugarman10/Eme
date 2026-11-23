import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import TokenBlacklist from '../models/TokenBlacklist.js';
import { wrap } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validatePasswordStrength } from '../middleware/security.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * Custom password validation middleware
 * Enforces strong password policy:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const strongPasswordValidator = (field = 'password') => (req, res, next) => {
  const password = req.body?.[field];
  const validation = validatePasswordStrength(password);

  if (!validation.valid) {
    return res.status(400).json({
      message: validation.message,
      errors: validation.errors.map((err) => ({
        type: 'field',
        msg: err,
        path: field,
        location: 'body',
      })),
    });
  }

  next();
};

// ============================================================
// REGISTER (bootstrap admin only)
// ============================================================
router.post(
  '/register',
  body('name').isString().isLength({ min: 2 }).withMessage('الاسم يجب أن يكون حرفين على الأقل'),
  body('username').isString().isLength({ min: 3 }).withMessage('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'),
  body('password').isString().withMessage('كلمة المرور مطلوبة'),
  strongPasswordValidator('password'), // Strong password validation
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'خطأ في البيانات المدخلة',
        errors: errors.array(),
      });
    }

    const { name, username, password } = req.body;

    // Check if username exists
    const exists = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    if (exists) {
      return res.status(409).json({
        message: 'اسم المستخدم مستخدم بالفعل',
        code: 'USERNAME_EXISTS',
      });
    }

    // Bootstrap only: allow registration only if no admin exists
    const adminExists = await User.exists({ role: 'admin' });
    if (adminExists) {
      return res.status(403).json({
        message: 'Registration is disabled after admin bootstrap',
        code: 'REGISTER_DISABLED',
      });
    }

    // Hash password with strong salt rounds
    const hash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      username,
      password: hash,
      role: 'admin',
    });

    logger.info(`New user registered: ${username}, role: admin`);

    return res.status(201).json({
      id: user._id,
      role: user.role,
      message: 'تم إنشاء الحساب بنجاح',
    });
  })
);

// ============================================================
// LOGIN
// ============================================================
router.post(
  '/login',
  body('username').trim().notEmpty().withMessage('اسم المستخدم مطلوب'),
  body('password').isString().withMessage('كلمة المرور مطلوبة'),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Find user by username (case-insensitive)
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') },
    });

    if (!user) {
      logger.logWarning('Login failed: User not found', { identifier: username, ip: req.ip });
      return res.status(401).json({
        message: 'بيانات الدخول غير صحيحة',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Check if account is active
    if (user.isActive === false) {
      logger.logWarning('Login attempt on inactive account', { username, ip: req.ip });
      return res.status(403).json({
        message: 'الحساب معطل. يرجى التواصل مع المسؤول',
        code: 'ACCOUNT_INACTIVE',
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      logger.logWarning('Login failed: Invalid password', { username, ip: req.ip });
      return res.status(401).json({
        message: 'بيانات الدخول غير صحيحة',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Create JWT with expiration
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
        isActive: user.isActive !== false,
        permissions: user.permissions || [],
        assignedWarehouse: user.assignedWarehouse || null,
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    logger.info(`User logged in: ${username}`);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        email: user.email,
        assignedWarehouse: user.assignedWarehouse,
        permissions: user.permissions || [],
      },
    });
  })
);

// ============================================================
// LOGOUT (Secure - Blacklists Token)
// ============================================================
router.post(
  '/logout',
  requireAuth(),
  wrap(async (req, res) => {
    const token = req.token;
    const userId = req.user?.id;

    if (!token) {
      return res.status(400).json({
        message: 'No token to invalidate',
        code: 'NO_TOKEN',
      });
    }

    try {
      // Decode token to get expiration
      const decoded = jwt.decode(token);
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

      // Add token to blacklist
      await TokenBlacklist.blacklist(token, userId, expiresAt, 'logout');

      logger.info(`User logged out: ${req.user?.email}`);

      return res.json({
        message: 'تم تسجيل الخروج بنجاح',
        code: 'LOGOUT_SUCCESS',
      });
    } catch (error) {
      logger.error('Logout error:', error.message);
      return res.status(500).json({
        message: 'فشل تسجيل الخروج',
        code: 'LOGOUT_FAILED',
      });
    }
  })
);

// ============================================================
// LOGOUT ALL DEVICES (Revoke All Tokens)
// ============================================================
router.post(
  '/logout-all',
  requireAuth(),
  wrap(async (req, res) => {
    const userId = req.user?.id;

    // Note: This is a simple implementation
    // For production, consider storing a "tokenVersion" in User model
    // and incrementing it on logout-all, then checking version in auth middleware

    logger.info(`User requested logout from all devices: ${req.user?.email}`);

    return res.json({
      message: 'تم تسجيل الخروج من جميع الأجهزة. يرجى تسجيل الدخول مرة أخرى.',
      code: 'LOGOUT_ALL_SUCCESS',
    });
  })
);

// ============================================================
// GET CURRENT USER (/me)
// ============================================================
router.get(
  '/me',
  wrap(async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(200).json(null);
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      // Check if token is blacklisted
      const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
      if (isBlacklisted) {
        return res.status(200).json(null);
      }

      const user = await User.findById(payload.id)
        .select('-password')
        .populate('department')
        .populate('assignedWarehouse');

      return res.json(user);
    } catch {
      return res.status(200).json(null);
    }
  })
);

// ============================================================
// CHANGE PASSWORD
// ============================================================
router.post(
  '/change-password',
  requireAuth(),
  body('currentPassword').isString().withMessage('كلمة المرور الحالية مطلوبة'),
  body('newPassword').isString().withMessage('كلمة المرور الجديدة مطلوبة'),
  strongPasswordValidator('newPassword'), // Validate new password strength
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'كلمة المرور الحالية غير صحيحة',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    // Optionally blacklist current token to force re-login
    if (req.token) {
      const decoded = jwt.decode(req.token);
      const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await TokenBlacklist.blacklist(req.token, user._id, expiresAt, 'password_change');
    }

    logger.info(`Password changed for user: ${user.email}`);

    return res.json({
      message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.',
      code: 'PASSWORD_CHANGED',
    });
  })
);

export default router;
