/**
 * InvoicePagination Component
 * 
 * Pagination controls for the invoices table
 */

import React from 'react'

export default function InvoicePagination({
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange
}) {
    return (
        <div className="p-4 border-t bg-white flex flex-wrap items-center justify-between gap-4">
            {/* Results Info */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>عرض {startIndex + 1}-{Math.min(endIndex, totalItems)} من {totalItems}</span>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                >
                    السابق
                </button>

                <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                            pageNum = i + 1
                        } else if (currentPage <= 3) {
                            pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i
                        } else {
                            pageNum = currentPage - 2 + i
                        }

                        return (
                            <button
                                key={pageNum}
                                onClick={() => onPageChange(pageNum)}
                                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-slate-300 hover:bg-slate-50 text-slate-700'
                                    }`}
                            >
                                {pageNum}
                            </button>
                        )
                    })}
                </div>

                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                >
                    التالي
                </button>
            </div>

            {/* Items Per Page */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">عدد العناصر:</span>
                <select
                    value={itemsPerPage}
                    onChange={e => onItemsPerPageChange(Number(e.target.value))}
                    className="input w-20 text-sm"
                >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
            </div>
        </div>
    )
}
