import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Assuming AuthContext exists

export const usePermission = () => {
    const { user } = useAuth();

    const role = user?.role || 'guest';
    const permissions = user?.permissions || [];

    const check = (requiredRole, requiredPerm = null) => {
        if (!user) return false;
        if (role === 'admin') return true; // Admin bypass

        // Check Role
        if (requiredRole && role !== requiredRole) return false;

        // Check Permission
        if (requiredPerm && !permissions.includes(requiredPerm)) return false;

        return true;
    };

    return {
        isAdmin: role === 'admin',
        isManager: role === 'manager',
        isCashier: role === 'cashier',
        role,
        canDelete: check(null, 'delete_invoices'), // Example common permission
        canViewReports: check('manager') || check('admin'), // Managers or Admins only
        hasPermission: (perm) => check(null, perm)
    };
};
