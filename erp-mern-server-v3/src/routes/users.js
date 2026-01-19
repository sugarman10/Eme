import express from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} from '../controllers/userController.js';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

router.post('/',
  requireAuth(['admin']),
  requireRole(['admin']),
  body('name').isString().isLength({ min: 2 }),
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('role').optional().isIn(['admin', 'manager', 'cashier']),
  body('department').optional().isMongoId(),
  wrap(createUser)
);

router.get('/',
  requireAuth(['admin', 'manager']),
  requireRole(['admin', 'manager']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  wrap(getUsers)
);

router.put('/:id',
  requireAuth(['admin']), // Only admin should edit users fully
  requireRole(['admin']),
  param('id').isMongoId(),
  body('name').optional().isString().isLength({ min: 2 }),
  body('role').optional().isIn(['admin', 'manager', 'cashier']),
  body('department').optional().isMongoId(),
  wrap(updateUser)
);

router.patch('/:id/status',
  requireAuth(['admin']),
  requireRole(['admin']),
  param('id').isMongoId(),
  wrap(toggleUserStatus)
);

// Keep reset-password as specific route if needed, or merge into update. 
// For now, keeping as legacy support or specific action.
router.post('/:id/reset-password',
  requireAuth(['admin']),
  requireRole(['admin']),
  param('id').isMongoId(),
  body('password').isLength({ min: 8 }),
  wrap(async (req, res) => {
    // Check if we want to move this to controller too? 
    // For now inline is fine for this specific utility, or we can use updateUser
    const hash = await bcrypt.hash(req.body.password, 10);
    const updated = await User.findByIdAndUpdate(req.params.id, { password: hash }, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json({ ok: true });
  })
);

router.delete('/:id',
  requireAuth(['admin']),
  requireRole(['admin']),
  param('id').isMongoId(),
  wrap(deleteUser)
);

export default router;