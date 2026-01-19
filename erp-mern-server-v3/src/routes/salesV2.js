import express from 'express';
import { body, validationResult, param } from 'express-validator';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { wrap } from '../middleware/asyncHandler.js';
import logger from '../config/logger.js';
import {
    createInvoiceWithTransaction,
    getInvoices,
    getInvoiceById,
    updateInvoiceStatus,
    returnInvoiceItems,
    postInvoice,
    voidInvoice,
    reverseInvoice
} from '../controllers/salesController.js';

const router = express.Router();

/**
 * POST /api/sales/invoice-v2 (or /invoice)
 * Create Sales Invoice with Atomic Transaction
 */
router.post('/invoice-v2',
    requireAuth(['admin', 'manager', 'sales', 'cashier']),
    requireRole(['admin', 'manager', 'sales', 'cashier']),
    body('items').isArray({ min: 1 }),
    body('items.*.item').isMongoId(),
    body('items.*.qty').isFloat({ gt: 0 }),
    body('items.*.price').isFloat({ min: 0 }),
    body('channel').optional().isIn(['retail', 'wholesale']),
    body('warehouse').optional().isMongoId(),
    // Convert empty string OR null to undefined before validation
    body('treasury').customSanitizer(v => (v === '' || v === null) ? undefined : v).optional().isMongoId(),
    body('customer').customSanitizer(v => (v === '' || v === null) ? undefined : v).optional().isMongoId(),
    body('paid').optional().isFloat({ min: 0 }),
    body('discountValue').optional().isFloat({ min: 0 }),
    wrap(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.logWarning('Invoice Validation Errors', { errors: errors.array() });
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const invoice = await createInvoiceWithTransaction(req.body, req.user?._id || req.user?.id);
            const populated = await invoice.populate([
                { path: 'customer', select: 'name code phone' },
                { path: 'items.item', select: 'name sku' },
                { path: 'warehouse', select: 'name code' },
                { path: 'treasury', select: 'name' },
                { path: 'cashier', select: 'name email' }
            ]);
            res.status(201).json(populated);
        } catch (error) {
            logger.logError('Invoice creation error', { error: error.message, stack: error.stack });
            res.status(400).json({
                message: error.message || 'Failed to create invoice',
                code: 'INVOICE_CREATION_FAILED'
            });
        }
    })
);

// ===== READ OPERATIONS =====
router.get('/invoice', requireAuth(), wrap(getInvoices));
router.get('/invoice/:id', requireAuth(), wrap(getInvoiceById));

// ===== UPDATE OPERATIONS =====
const allowedStatuses = ['draft', 'pending'];
router.patch('/invoice/:id/status',
    requireAuth(['admin', 'manager', 'sales']),
    requireRole(['admin', 'manager', 'sales']),
    param('id').isMongoId(),
    body('status').isIn(allowedStatuses),
    wrap(updateInvoiceStatus)
);

// ===== POSTING OPERATIONS =====
router.post('/invoice/:id/post',
    requireAuth(['admin', 'manager', 'sales']),
    requireRole(['admin', 'manager', 'sales']),
    param('id').isMongoId(),
    wrap(postInvoice)
);

router.post('/invoice/:id/void',
    requireAuth(['admin', 'manager']),
    requireRole(['admin', 'manager']),
    param('id').isMongoId(),
    wrap(voidInvoice)
);

router.post('/invoice/:id/reverse',
    requireAuth(['admin', 'manager']),
    requireRole(['admin', 'manager']),
    param('id').isMongoId(),
    wrap(reverseInvoice)
);

// ===== DELETE OPERATIONS =====

/**
 * DELETE /invoice/:id - Delete invoice with mandatory audit
 * CRITICAL: Audit failure blocks deletion
 */
router.delete('/invoice/:id',
    requireAuth(),
    requireRole(['admin']), // Only Admins can delete
    param('id').isMongoId(),
    wrap(async (req, res) => {
        const SalesInvoice = (await import('../models/SalesInvoice.js')).default;
        const { auditDelete } = await import('../services/auditService.js');

        const { id } = req.params;

        // 1. Fetch invoice before deletion (for audit)
        const invoice = await SalesInvoice.findById(id);
        if (!invoice) {
            return res.status(404).json({ message: 'الفاتورة غير موجودة' });
        }

        const deletableStatuses = ['draft', 'pending', 'void', 'cancelled'];
        if (!deletableStatuses.includes(invoice.status)) {
            return res.status(409).json({
                message: 'لا يمكن حذف فاتورة مرحّلة أو مؤكدة'
            });
        }

        // Keep before state for audit
        const beforeState = invoice.toObject();

        // 2. Delete the invoice
        await SalesInvoice.findByIdAndDelete(id);

        // 3. Mandatory Audit Trail (AFTER deletion to capture exact data)
        try {
            await auditDelete('INVOICE', beforeState, req.user, req.ip);
        } catch (auditError) {
            // Rollback: restore the invoice
            await SalesInvoice.create(beforeState);
            return res.status(500).json({
                message: 'تعذر حفظ سجل التدقيق، تم إلغاء العملية حفاظًا على سلامة النظام'
            });
        }

        res.status(200).json({ message: 'تم حذف الفاتورة بنجاح', invoiceNumber: beforeState.number });
    })
);

// ===== RETURN OPERATIONS =====
router.post('/invoice/:id/return',
    requireAuth(['admin', 'manager', 'sales']),
    requireRole(['admin', 'manager', 'sales']),
    param('id').isMongoId(),
    wrap(returnInvoiceItems)
);

// ===== SALES RETURN OPERATIONS (CREDIT NOTES) =====
import {
    createSalesReturn,
    approveSalesReturn,
    voidSalesReturn,
    reverseSalesReturn,
    getSalesReturns,
    getSalesReturnById,
    updateReturnStatus,
    getCreditNotePdf
} from '../controllers/salesReturnController.js';

// 1. Create Return Draft
router.post('/returns',
    requireAuth(['admin', 'manager', 'sales', 'cashier']),
    wrap(createSalesReturn)
);

// 2. Get List
router.get('/returns',
    requireAuth(['admin', 'manager', 'sales']),
    wrap(getSalesReturns)
);

// 3. Get Single
router.get('/returns/:id',
    requireAuth(['admin', 'manager', 'sales']),
    wrap(getSalesReturnById)
);

// 4. Approve Return (Atomic Transaction)
router.post('/returns/:id/approve',
    requireAuth(['admin', 'manager']),
    wrap(approveSalesReturn)
);

// 8.1 Post Return
router.post('/returns/:id/post',
    requireAuth(['admin', 'manager']),
    wrap(approveSalesReturn)
);

// 8.2 Void Return
router.post('/returns/:id/void',
    requireAuth(['admin', 'manager']),
    wrap(voidSalesReturn)
);

// 8.3 Reverse Return
router.post('/returns/:id/reverse',
    requireAuth(['admin', 'manager']),
    wrap(reverseSalesReturn)
);

// 5. Update Status
router.patch('/returns/:id/status',
    requireAuth(['admin', 'manager']),
    wrap(updateReturnStatus)
);

// 6. Download Credit Note PDF
router.get('/returns/:id/pdf',
    requireAuth(['admin', 'manager', 'sales']),
    param('id').isMongoId(),
    wrap(getCreditNotePdf)
);

export default router;
