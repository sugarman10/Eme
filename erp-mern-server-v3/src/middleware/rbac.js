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