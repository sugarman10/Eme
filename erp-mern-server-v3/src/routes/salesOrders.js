import express from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import {
    createSalesOrder,
    updateSalesOrderStatus,
    getSalesOrders
} from '../controllers/salesOrderController.js';

const router = express.Router();

router.post('/',
    requireAuth(['admin', 'manager', 'sales']),
    requireRole(['admin', 'manager', 'sales']),
    body('customer').isMongoId(),
    body('items').isArray({ min: 1 }),
    wrap(createSalesOrder)
);

router.get('/', requireAuth(), wrap(getSalesOrders));

router.put('/:id/status',
    requireAuth(['admin', 'manager', 'sales']),
    requireRole(['admin', 'manager', 'sales']),
    param('id').isMongoId(),
    body('status').isIn(['confirmed', 'fulfilled', 'cancelled']),
    body('warehouse').optional().isMongoId(),
    wrap(updateSalesOrderStatus)
);

export default router;
