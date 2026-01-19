import express from 'express';
import { getDashboardSummary, exportDashboardPdf } from '../controllers/dashboardController.js';
import {
    getDrilldownInvoices,
    getDrilldownReceipts,
    getDrilldownLowStock,
    getDrilldownAlerts
} from '../controllers/drilldownController.js';
import {
    createSavedView,
    getSavedViews,
    deleteSavedView
} from '../controllers/savedViewsController.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap } from '../middleware/asyncHandler.js';

const router = express.Router();

// Auth restored - use fastMode=true for quick loading
router.get('/summary', requireAuth(), wrap(getDashboardSummary));

// Drill-down endpoints
router.get('/drilldown/invoices', requireAuth(), wrap(getDrilldownInvoices));
router.get('/drilldown/receipts', requireAuth(), wrap(getDrilldownReceipts));
router.get('/drilldown/low-stock', requireAuth(), wrap(getDrilldownLowStock));
router.get('/drilldown/alerts', requireAuth(), wrap(getDrilldownAlerts));

// Saved Views (Filters)
router.post('/views', requireAuth(), wrap(createSavedView));
router.get('/views', requireAuth(), wrap(getSavedViews));
router.delete('/views/:id', requireAuth(), wrap(deleteSavedView));

// PDF Export (auth only - RBAC can be added in controller if needed)
router.post('/export/pdf', requireAuth(), wrap(exportDashboardPdf));

export default router;
