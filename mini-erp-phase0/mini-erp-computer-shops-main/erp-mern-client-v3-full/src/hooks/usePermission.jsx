import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Assuming AuthContext exists

export const usePermission = () => {
    const { user, me } = useAuth();
    const currentUser = user || me;

    const role = currentUser?.role || 'guest';
    const permissions = currentUser?.permissions || [];

    const check = (requiredRole, requiredPerm = null) => {
        if (!currentUser) return false;
        if (role === 'admin') return true; // Admin has full access

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
        canDelete: check(null, 'delete_invoices'),
        canViewReports: role === 'admin',
        canEditExchangeRate: check(null, 'exchange_rate_manage'),
        canSwitchFiscalPeriod: check(null, 'fiscal_period_switch'),
        hasPermission: (perm) => check(null, perm)
    };
};
