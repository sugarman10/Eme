import express from 'express';
import { query, validationResult } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, requirePermission } from '../middleware/rbac.js';
import AuditLog from '../models/AuditLog.js';
import { wrap } from '../middleware/asyncHandler.js';

const router = express.Router();

/**
 * GET /api/audit
 * Optional filters:
 * - entityType
 * - entityId
 * - limit
 */
router.get('/',
  requireAuth(['admin', 'manager', 'accountant']),
  requireRole(['admin', 'manager', 'accountant']),
  requirePermission(['audit_view'], ['admin', 'manager', 'accountant']),
  query('entityType').optional().isString(),
  query('entityId').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  wrap(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { entityType, entityId } = req.query;
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 50)));

    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = String(entityId);

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .lean();

    res.json(logs);
  })
);

export default router;
