import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();

// Get Settings (Accessible by authenticated users)
router.get('/', requireAuth(), wrap(getSettings));

// Update Settings (Admin/Manager only)
router.post('/',
    requireAuth(['admin', 'manager']),
    requireRole(['admin', 'manager']),
    wrap(updateSettings)
);

export default router;
