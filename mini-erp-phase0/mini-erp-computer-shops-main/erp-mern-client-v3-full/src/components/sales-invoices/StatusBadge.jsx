/**
 * StatusBadge Component
 * 
 * Displays invoice status with appropriate styling
 */

import React from 'react'

const statusConfig = {
    draft: { label: 'مسودة', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
    pending: { label: 'معلقة', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    // Treat confirmed as posted for legacy data
    confirmed: { label: 'مرحلة', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    posted: { label: 'مرحلة', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    returned: { label: 'مرتجعة بالكامل', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    partially_returned: { label: 'مرتجعة جزئياً', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    refund: { label: 'مستردة', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    void: { label: 'ملغاة', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    cancelled: { label: 'ملغاة', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
}

export default function StatusBadge({ status }) {
    const config = statusConfig[status] || statusConfig.draft

    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${config.bg} ${config.text} ${config.border}`}>
            {config.label}
        </span>
    )
}
