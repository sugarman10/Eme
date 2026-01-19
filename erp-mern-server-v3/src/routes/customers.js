import express from 'express';
import { body, param } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} from '../controllers/customerController.js';

const router = express.Router();

router.post('/',
    requireAuth(['admin', 'manager', 'sales']),
    requireRole(['admin', 'manager', 'sales']),
    body('code').isString().isLength({ min: 1 }),
    body('name').isString().isLength({ min: 2 }),
    body('type').optional().isIn(['retail', 'wholesale']),
    body('creditLimit').optional().isFloat({ min: 0 }),
    wrap(createCustomer)
);

router.get('/', requireAuth(), wrap(getCustomers));

router.get('/:id', requireAuth(), wrap(getCustomerById));

router.put('/:id',
    requireAuth(['admin', 'manager', 'sales']),
    requireRole(['admin', 'manager', 'sales']),
    param('id').isMongoId(),
    body('code').optional().isString().isLength({ min: 1 }),
    body('name').optional().isString().isLength({ min: 2 }),
    body('type').optional().isIn(['retail', 'wholesale']),
    body('creditLimit').optional().isFloat({ min: 0 }),
    wrap(updateCustomer)
);

router.delete('/:id',
    requireAuth(['admin', 'manager']),
    requireRole(['admin', 'manager']),
    param('id').isMongoId(),
    wrap(deleteCustomer)
);

export default router;
