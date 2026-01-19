export const checkRole = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized: No user found' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: Access denied' });
        }

        next();
    };
};

export const checkPermission = (requiredPerm) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Admins have all permissions implicitly
        if (req.user.role === 'admin') return next();

        const userPerms = req.user.permissions || [];
        if (!userPerms.includes(requiredPerm)) {
            return res.status(403).json({ message: `Forbidden: Missing ${requiredPerm} permission` });
        }

        next();
    };
};
