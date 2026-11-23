import User from '../models/User.js';

/**
 * Role-based access control middleware.
 * - Admin always allowed.
 * - User must match one of the specified roles.
 * - Checks live DB if token role does not match (to prevent stale-session lockouts).
 * - ZERO bypass: Does not allow access simply because permissions array is non-empty!
 */
export function authorize(...roles) {
  // Flatten arguments if an array was passed as the first argument
  const _roles = (Array.isArray(roles[0]) ? roles[0] : roles).map(r => String(r).toLowerCase());

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'يرجى تسجيل الدخول أولاً', code: 'UNAUTHORIZED' });
    }

    if (!_roles.length) return next();

    const role = (req.user.role || '').toLowerCase();
    if (role === 'admin') return next();

    // Check token role
    if (_roles.includes(role)) return next();

    // Fallback check against latest database state
    try {
      const userId = req.user.id || req.user._id;
      if (userId) {
        const user = await User.findById(userId).select('role permissions isActive');
        if (user && user.isActive !== false) {
          const dbRole = (user.role || '').toLowerCase();
          if (dbRole === 'admin' || _roles.includes(dbRole)) {
            req.user.role = user.role;
            req.user.permissions = user.permissions || [];
            return next();
          }
        }
      }
    } catch (err) {
      // ignore DB fallback error and proceed to 403
    }

    return res.status(403).json({
      message: 'عذراً، هذا الإجراء محصور بصلاحيات إدارية أعلى',
      code: 'ROLE_FORBIDDEN'
    });
  };
}

// Alias for backward compatibility
export const requireRole = (roles) => authorize(roles);

/**
 * Fine-grained permission access control middleware.
 * - Admin always allowed.
 * - Wildcard '*' permission always allowed.
 * - Matches if user has ANY of the required permissions.
 * - Optional allowRoles for backward-compatible role gates.
 */
export const requirePermission = (permissions = [], allowRoles = []) => {
  const required = Array.isArray(permissions) ? permissions : [permissions];
  const allowedRoles = (Array.isArray(allowRoles) ? allowRoles : [allowRoles]).map(r => String(r).toLowerCase());

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'يرجى تسجيل الدخول أولاً', code: 'UNAUTHORIZED' });
    }

    const role = (req.user.role || '').toLowerCase();
    if (role === 'admin') return next();

    // If allowedRoles provided and matches user role
    if (allowedRoles.length > 0 && allowedRoles.includes(role)) {
      return next();
    }

    // Check token permissions
    let userPerms = Array.isArray(req.user.permissions) ? req.user.permissions : [];

    if (userPerms.includes('*')) return next();
    if (required.length === 0) return next();
    if (required.some(p => userPerms.includes(p))) return next();

    // Fallback: check live DB permissions
    try {
      const userId = req.user.id || req.user._id;
      if (userId) {
        const user = await User.findById(userId).select('permissions role isActive');
        if (!user || user.isActive === false) {
          return res.status(403).json({ message: 'الحساب معطل أو غير موجود', code: 'ACCOUNT_INACTIVE' });
        }

        if (user.role === 'admin') return next();

        const dbPerms = Array.isArray(user.permissions) ? user.permissions : [];
        req.user.permissions = dbPerms;
        req.user.role = user.role;

        if (dbPerms.includes('*')) return next();
        if (required.some(p => dbPerms.includes(p))) return next();
      }
    } catch (error) {
      return res.status(500).json({ message: 'فشل التحقق من الصلاحيات' });
    }

    return res.status(403).json({
      message: 'عذراً، لا تملك الصلاحية الكافية لإتمام هذا الإجراء',
      code: 'PERMISSION_FORBIDDEN',
      requiredPermissions: required
    });
  };
};
