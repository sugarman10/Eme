/**
 * POS Constants - V3 Elite Edition
 * 
 * Eliminates magic strings and provides type safety through constants.
 */

// Payment Methods
export const PAYMENT_METHODS = {
    CASH: 'cash',
    CARD: 'card',
    BANK: 'bank',
    SPLIT: 'split',
    WALLET: 'wallet',
}

export const PAYMENT_METHOD_CONFIG = {
    [PAYMENT_METHODS.CASH]: {
        id: PAYMENT_METHODS.CASH,
        label: 'نقدي',
        color: 'emerald',
        treasuryType: 'safe',
    },
    [PAYMENT_METHODS.CARD]: {
        id: PAYMENT_METHODS.CARD,
        label: 'بطاقة',
        color: 'blue',
        treasuryType: 'bank',
    },
    [PAYMENT_METHODS.BANK]: {
        id: PAYMENT_METHODS.BANK,
        label: 'حوالة',
        color: 'purple',
        treasuryType: 'bank',
    },
    [PAYMENT_METHODS.WALLET]: {
        id: PAYMENT_METHODS.WALLET,
        label: 'محفظة',
        color: 'indigo',
        treasuryType: null,
    },
    [PAYMENT_METHODS.SPLIT]: {
        id: PAYMENT_METHODS.SPLIT,
        label: 'مختلط',
        color: 'orange',
        treasuryType: null,
    },
}

// Invoice Types
export const INVOICE_TYPES = {
    OFFICIAL: 'official',
    PROFORMA: 'proforma',
}

export const INVOICE_TYPE_CONFIG = {
    [INVOICE_TYPES.OFFICIAL]: {
        id: INVOICE_TYPES.OFFICIAL,
        label: 'رسمية',
        color: 'emerald',
        icon: 'CheckCircle2',
    },
    [INVOICE_TYPES.PROFORMA]: {
        id: INVOICE_TYPES.PROFORMA,
        label: 'عرض سعر',
        color: 'amber',
        icon: 'ClipboardList',
    },
}

// Sales Modes
export const SALES_MODES = {
    RETAIL: 'retail',
    WHOLESALE: 'wholesale',
}

// Invoice Status
export const INVOICE_STATUS = {
    PAID: 'paid',
    UNPAID: 'unpaid',
    PARTIAL: 'partial',
}

export const STATUS_CONFIG = {
    [INVOICE_STATUS.PAID]: {
        label: 'مدفوعة',
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        border: 'border-emerald-300',
    },
    [INVOICE_STATUS.UNPAID]: {
        label: 'غير مدفوعة',
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
    },
    [INVOICE_STATUS.PARTIAL]: {
        label: 'مدفوعة جزئياً',
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-300',
    },
}

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
    PAY: 'F9',
    CLEAR: 'Escape',
    SEARCH: '/',
    HOLD_BILL: 'F8',
}

// Local Storage Keys
export const STORAGE_KEYS = {
    HELD_BILLS: 'pos_held_bills',
    LAST_CUSTOMER: 'pos_last_customer',
    PREFERENCES: 'pos_preferences',
}

// Date Ranges for History
export const DATE_RANGES = {
    TODAY: 'today',
    WEEK: 'week',
    MONTH: 'month',
    ALL: '',
}

// Pagination
export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

// Currency
export const CURRENCY = 'د.ل'
