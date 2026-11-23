import express from 'express';
import { getDashboardSummary, exportDashboardPdf } from '../controllers/dashboardController.js';
import {
  getDrilldownInvoices,
  getDrilldownReceipts,
  getDrilldownLowStock,
  getDrilldownAlerts,
} from '../controllers/drilldownController.js';
import { createSavedView, getSavedViews, deleteSavedView } from '../controllers/savedViewsController.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap } from '../middleware/asyncHandler.js';

const router = express.Router();

// Admin only - System-wide dashboard metrics & financials
router.get('/summary', requireAuth(['admin']), wrap(getDashboardSummary));

// Drill-down endpoints (Admin only)
router.get('/drilldown/invoices', requireAuth(['admin']), wrap(getDrilldownInvoices));
router.get('/drilldown/receipts', requireAuth(['admin']), wrap(getDrilldownReceipts));
router.get('/drilldown/low-stock', requireAuth(['admin']), wrap(getDrilldownLowStock));
router.get('/drilldown/alerts', requireAuth(['admin']), wrap(getDrilldownAlerts));

// Saved Views (Filters)
router.post('/views', requireAuth(['admin']), wrap(createSavedView));
router.get('/views', requireAuth(['admin']), wrap(getSavedViews));
router.delete('/views/:id', requireAuth(['admin']), wrap(deleteSavedView));

// PDF Export (Admin only)
router.post('/export/pdf', requireAuth(['admin']), wrap(exportDashboardPdf));

export default router;
