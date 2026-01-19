/**
 * StatusBadge Component
 * 
 * Displays invoice status with appropriate styling
 */

import React from 'react'

const statusConfig = {
    fulfilled: { label: 'مدفوعة', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
    confirmed: { label: 'مؤكدة', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
    posted: { label: 'posted', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
    pending: { label: 'pending', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
    draft: { label: 'مسودة', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
    cancelled: { label: 'ملغاة', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    void: { label: 'void', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
    refund: { label: 'مُرتجعة', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
    reversed: { label: 'reversed', bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' }
}

export default function StatusBadge({ status }) {
    const config = statusConfig[status] || statusConfig.draft

    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${config.bg} ${config.text} ${config.border}`}>
            {config.label}
        </span>
    )
}
