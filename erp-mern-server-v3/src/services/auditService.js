/**
 * Audit Trail Service
 * 
 * Provides functions to log audit events for business entities.
 * MANDATORY MODE: Critical operations will fail if audit cannot be saved.
 */

import AuditLog from '../models/AuditLog.js';
import logger from '../config/logger.js';

/**
 * Audit Error - thrown when mandatory audit logging fails
 */
export class AuditError extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = 'AuditError';
        this.originalError = originalError;
        this.statusCode = 500;
    }
}

/**
 * Log an audit event
 * 
 * @param {Object} params - Audit parameters
 * @param {string} params.entityType - 'INVOICE', 'RECEIPT', 'PRODUCT', 'ACCOUNT', 'JOURNAL'
 * @param {string} params.entityId - ID of the entity
 * @param {string} params.action - 'CREATE', 'UPDATE', 'DELETE'
 * @param {Object|null} params.before - State before change (null for CREATE)
 * @param {Object|null} params.after - State after change (null for DELETE)
 * @param {string|null} params.userId - User who performed the action
 * @param {string} params.userName - User name for quick reference
 * @param {string} params.ip - IP address of the request
 * @param {string} params.description - Optional description
 * @param {boolean} params.mandatory - If true, throws error on failure (default: true)
 */
export async function logAudit({
    entityType,
    entityId,
    action,
    before = null,
    after = null,
    userId = null,
    userName = '',
    ip = '',
    description = '',
    mandatory = true,
    session = null,
    meta = null
}) {
    try {
        // Sanitize data - keep only essential fields to reduce storage
        const sanitizedBefore = before ? sanitizeForAudit(before, entityType) : null;
        const sanitizedAfter = after ? sanitizeForAudit(after, entityType) : null;

        if (meta && sanitizedAfter && typeof sanitizedAfter === 'object') {
            sanitizedAfter._audit = { ...(sanitizedAfter._audit || {}), ...meta };
        }

        const auditRecord = await AuditLog.create([{
            entityType,
            entityId: String(entityId),
            action,
            before: sanitizedBefore,
            after: sanitizedAfter,
            userId,
            userName,
            ip,
            description
        }], session ? { session } : undefined);

        logger.info(`📝 Audit: ${action} ${entityType} ${entityId}`);
        return Array.isArray(auditRecord) ? auditRecord[0] : auditRecord;

    } catch (error) {
        logger.logError('Audit logging failed', {
            error: error.message,
            entityType,
            entityId,
            action,
            mandatory
        });

        // For mandatory operations, throw error to block the operation
        if (mandatory) {
            throw new AuditError(
                'تعذر حفظ سجل التدقيق، تم إلغاء العملية حفاظًا على سلامة النظام',
                error
            );
        }

        // For non-mandatory, just log and continue
        return null;
    }
}

/**
 * Sanitize object for audit storage
 * Remove sensitive fields and keep only essential data
 */
function sanitizeForAudit(data, entityType) {
    if (!data) return null;

    // Convert Mongoose document to plain object if needed
    const obj = data.toObject ? data.toObject() : { ...data };

    // Remove internal fields
    delete obj.__v;
    delete obj.password;
    delete obj.refreshToken;

    // For specific entity types, keep only relevant fields
    switch (entityType) {
        case 'PRODUCT':
            return {
                _id: obj._id,
                name: obj.name,
                sku: obj.sku,
                price: obj.price,
                wholesalePrice: obj.wholesalePrice,
                cost: obj.cost,
                isActive: obj.isActive
            };

        case 'ACCOUNT':
            return {
                _id: obj._id,
                code: obj.code,
                name: obj.name,
                type: obj.type,
                isActive: obj.isActive,
                isSystem: obj.isSystem
            };

        case 'INVOICE':
            return {
                _id: obj._id,
                number: obj.number,
                date: obj.date,
                customer: obj.customer,
                totals: obj.totals,
                status: obj.status,
                type: obj.type
            };

        case 'RECEIPT':
            return {
                _id: obj._id,
                customer: obj.customer,
                amount: obj.amount,
                method: obj.method,
                date: obj.date,
                status: obj.status
            };

        case 'PURCHASE_ORDER':
            return {
                _id: obj._id,
                supplier: obj.supplier,
                totalAmount: obj.totalAmount,
                status: obj.status,
                receivedAt: obj.receivedAt,
                warehouse: obj.warehouse
            };

        case 'SALES_RETURN':
        case 'PURCHASE_RETURN':
            return {
                _id: obj._id,
                status: obj.status,
                totalAmount: obj.totalAmount,
                warehouse: obj.warehouse,
                customer: obj.customer,
                supplier: obj.supplier,
                originalInvoice: obj.originalInvoice,
                originalPO: obj.originalPO,
                isRefunded: obj.isRefunded
            };

        case 'JOURNAL':
            return {
                _id: obj._id,
                date: obj.date,
                referenceType: obj.referenceType,
                referenceId: obj.referenceId,
                ref: obj.ref,
                linesCount: obj.lines?.length || 0
            };

        default:
            return obj;
    }
}

/**
 * Mandatory audit functions for critical operations
 * These WILL throw if audit fails, blocking the operation
 */

export async function auditCreate(entityType, entity, user = null, ip = '', session = null, meta = null) {
    return logAudit({
        entityType,
        entityId: entity._id || entity.id,
        action: 'CREATE',
        before: null,
        after: entity,
        userId: user?._id || user?.id,
        userName: user?.name || '',
        ip,
        description: `إنشاء ${entityType}`,
        mandatory: true,
        session,
        meta
    });
}

export async function auditUpdate(entityType, entityId, before, after, user = null, ip = '', session = null, meta = null) {
    return logAudit({
        entityType,
        entityId,
        action: 'UPDATE',
        before,
        after,
        userId: user?._id || user?.id,
        userName: user?.name || '',
        ip,
        description: `تعديل ${entityType}`,
        mandatory: true,
        session,
        meta
    });
}

export async function auditDelete(entityType, entity, user = null, ip = '', session = null, meta = null) {
    return logAudit({
        entityType,
        entityId: entity._id || entity.id,
        action: 'DELETE',
        before: entity,
        after: null,
        userId: user?._id || user?.id,
        userName: user?.name || '',
        ip,
        description: `حذف ${entityType}`,
        mandatory: true,
        session,
        meta
    });
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogs(entityType, entityId, limit = 50) {
    return AuditLog.find({ entityType, entityId: String(entityId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .lean();
}

/**
 * Get recent audit logs (for admin dashboard)
 */
export async function getRecentAudits(limit = 100) {
    return AuditLog.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .lean();
}

export default {
    logAudit,
    auditCreate,
    auditUpdate,
    auditDelete,
    getAuditLogs,
    getRecentAudits,
    AuditError
};

