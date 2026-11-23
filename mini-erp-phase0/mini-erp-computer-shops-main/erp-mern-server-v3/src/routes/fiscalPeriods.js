import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import {
    getFiscalPeriods,
    createFiscalPeriod,
    closeFiscalPeriod,
    reopenFiscalPeriod
} from '../controllers/fiscalPeriodController.js';

const router = express.Router();

// Get all periods
router.get('/', requireAuth(), wrap(getFiscalPeriods));

// Create (Admin/Manager)
router.post(
    '/',
    requireAuth(['admin', 'manager']),
    requireRole(['admin', 'manager']),
    wrap(createFiscalPeriod)
);

// Close (Admin/Manager)
router.post(
    '/:id/close',
    requireAuth(['admin', 'manager']),
    requireRole(['admin', 'manager']),
    wrap(closeFiscalPeriod)
);

// Reopen (Admin Only - Higher Security)
router.post(
    '/:id/reopen',
    requireAuth(['admin']),
    requireRole(['admin']),
    wrap(reopenFiscalPeriod)
);

export default router;
