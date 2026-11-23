import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();

// Get Settings (Accessible by authenticated users)
router.get('/', requireAuth(), wrap(getSettings));

// Update Settings (Secured via granular permissions in controller)
router.post('/', requireAuth(), wrap(updateSettings));
router.put('/', requireAuth(), wrap(updateSettings));

export default router;
