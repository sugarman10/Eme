/**
 * InvoiceFilters Component
 * 
 * Search and filter controls for the sales invoices list
 */

import React from 'react'
import { Search, Filter, Download, FileText } from 'lucide-react'

export default function InvoiceFilters({
    searchParams,
    onSearchChange,
    statusFilter,
    onStatusChange,
    paymentFilter,
    onPaymentChange,
    totalResults,
    onExportExcel,
    onExportPDF
}) {
    const handleSearchUpdate = (field, value) => {
        onSearchChange({ ...searchParams, [field]: value })
    }

    return (
        <div className="p-4 border-b bg-gray-50">
            {/* First Row - Search Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Client Search */}
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="بحث باسم العميل..."
                        className="input !pr-14 w-full bg-white"
                        value={searchParams.client}
                        onChange={e => handleSearchUpdate('client', e.target.value)}
                    />
                </div>

                {/* Item Search */}
                <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="بحث بصنف (كود/اسم)..."
                        className="input !pr-14 w-full bg-white"
                        value={searchParams.item}
                        onChange={e => handleSearchUpdate('item', e.target.value)}
                    />
                </div>

                {/* Date Range - Use LTR for date inputs */}
                <div className="flex gap-2">
                    <input
                        type="date"
                        className="input flex-1 bg-white"
                        style={{ direction: 'ltr', textAlign: 'left' }}
                        value={searchParams.dateFrom}
                        onChange={e => handleSearchUpdate('dateFrom', e.target.value)}
                        title="من تاريخ"
                    />
                    <input
                        type="date"
                        className="input flex-1 bg-white"
                        style={{ direction: 'ltr', textAlign: 'left' }}
                        value={searchParams.dateTo}
                        onChange={e => handleSearchUpdate('dateTo', e.target.value)}
                        title="إلى تاريخ"
                    />
                </div>
            </div>

            {/* Second Row - Dropdown Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div className="relative">
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                        className="input !pr-14 w-full bg-white"
                        value={statusFilter}
                        onChange={e => onStatusChange(e.target.value)}
                    >
                        <option value="all">جميع الحالات</option>
                        <option value="draft">مسودة (Draft)</option>
                        <option value="pending">معلقة (Pending)</option>
                        <option value="posted">مرحلة (Posted)</option>
                        <option value="returned">مرتجعة بالكامل (Returned)</option>
                        <option value="partially_returned">مرتجعة جزئياً (Partial)</option>
                        <option value="refund">مستردة (Refund)</option>
                        <option value="void">ملغاة (Void)</option>
                        <option value="cancelled">ملغاة (Cancelled)</option>
                    </select>
                </div>

                {/* Payment Filter */}
                <div className="relative">
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                        className="input !pr-14 w-full bg-white"
                        value={paymentFilter}
                        onChange={e => onPaymentChange(e.target.value)}
                    >
                        <option value="all">جميع حالات السداد</option>
                        <option value="paid">مدفوعة بالكامل</option>
                        <option value="unpaid">غير مدفوعة</option>
                        <option value="partial">مدفوعة جزئياً</option>
                    </select>
                </div>

                {/* Results Count & Export */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-600">النتائج: {totalResults}</span>
                    <div className="relative group">
                        <button className="btn btn-primary btn-sm flex items-center gap-2">
                            <Download size={16} />
                            تصدير
                        </button>
                        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[120px]">
                            <button
                                onClick={onExportExcel}
                                className="w-full px-4 py-2 text-right text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium"
                            >
                                <FileText size={14} />
                                Excel
                            </button>
                            <button
                                onClick={onExportPDF}
                                className="w-full px-4 py-2 text-right text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700 font-medium border-t"
                            >
                                <FileText size={14} />
                                PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
