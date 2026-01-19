import User from '../models/User.js';

export function authorize(...roles) {
  // If roles passed as array in first arg (legacy support), flatten
  const _roles = Array.isArray(roles[0]) ? roles[0] : roles;

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!_roles.length) return next();
    if (!_roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

// Alias for backward compatibility
export const requireRole = (roles) => authorize(roles);

/**
 * Permission-based access control.
 * - Admin always allowed
 * - Otherwise checks permissions array (from token or DB)
 * - Optional allowRoles for backward-compatible role gates
 */
export const requirePermission = (permissions = [], allowRoles = []) => {
  const required = Array.isArray(permissions) ? permissions : [permissions];
  const allowedRoles = Array.isArray(allowRoles) ? allowRoles : [allowRoles];

  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const role = (req.user.role || '').toLowerCase();
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (role === 'admin') return next();
    if (required.length === 0) return next();

    const roleDefaults = {
      manager: ['inventory_adjust', 'treasury_manage', 'coa_manage'],
      accountant: ['treasury_manage', 'coa_manage'],
      storekeeper: ['inventory_adjust']
    };

    const tokenPerms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const effectivePerms = tokenPerms.length > 0 ? tokenPerms : (roleDefaults[role] || []);
    if (required.some(p => effectivePerms.includes(p))) return next();

    try {
      const user = await User.findById(req.user.id || req.user._id).select('permissions role');
      if (!user) return res.status(403).json({ message: 'Forbidden' });

      if (user.role === 'admin') return next();

      const dbRole = (user.role || '').toLowerCase();
      const dbPerms = Array.isArray(user.permissions) && user.permissions.length > 0
        ? user.permissions
        : (roleDefaults[dbRole] || []);
      if (required.some(p => dbPerms.includes(p))) {
        req.user.permissions = dbPerms;
        return next();
      }
    } catch (error) {
      return res.status(500).json({ message: 'Permission check failed' });
    }

    return res.status(403).json({ message: 'Forbidden: Missing permission', code: 'PERMISSION_FORBIDDEN' });
  };
};
