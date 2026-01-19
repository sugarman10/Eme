import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
    XCircle,
    History,
    Search,
    Filter,
    Calendar,
    Eye,
    Printer,
    Lock,
    Download
} from 'lucide-react'
import { Card } from '../../ui/Card'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { formatCurrency } from '../../../lib/utils'
import { INVOICE_STATUS, DATE_RANGES } from '../../../constants/posConstants'
import { animations } from '../../../lib/posDesignTokens'

/**
 * HistoryModal - Invoice History with Filters & Daily Closure
 * 
 * Features:
 * - Search by invoice number or customer
 * - Filter by status, type, date range
 * - Pagination
 * - Statistics summary
 * - Daily closure feature for any date
 * - Reprint invoices
 */
export const HistoryModal = ({
    show,
    onClose,
    historyList,
    loadingHistory,
    historyFilters,
    setHistoryFilters,
    paginatedHistory,
    historyStats,
    currentPage,
    setCurrentPage,
    totalPages,
    itemsPerPage,
    setItemsPerPage,
    getInvoiceStatus,
    handleReprint,
    currency
}) => {
    const [showClosureModal, setShowClosureModal] = useState(false)
    const [closureDate, setClosureDate] = useState(new Date().toISOString().split('T')[0])
    const [closingDay, setClosingDay] = useState(false)

    if (!show) return null

    const handleCloseDailyAccount = async () => {
        setClosingDay(true)
        try {
            // TODO: API call to close daily account
            // await api.post('/sales/close-daily-account', { date: closureDate })
            alert(`تم إغلاق حساب يوم ${new Date(closureDate).toLocaleDateString('ar-LY')} بنجاح!`)
            setShowClosureModal(false)
        } catch (err) {
            alert('فشل إغلاق الحساب')
        } finally {
            setClosingDay(false)
        }
    }

    const getStatusBadge = (invoice) => {
        const status = getInvoiceStatus(invoice)
        const config = {
            [INVOICE_STATUS.PAID]: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'مدفوع' },
            [INVOICE_STATUS.PARTIAL]: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'جزئي' },
            [INVOICE_STATUS.UNPAID]: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'غير مدفوع' }
        }
        const style = config[status] || config[INVOICE_STATUS.UNPAID]
        return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                {style.label}
            </span>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <motion.div
                initial={animations.scaleIn.initial}
                animate={animations.scaleIn.animate}
                exit={animations.scaleIn.exit}
                className="w-full max-w-6xl max-h-[90vh] flex flex-col"
            >
                <Card className="flex flex-col shadow-2xl bg-white rounded-xl overflow-hidden border-0 ring-1 ring-black/5">
                    {/* Header */}
                    <div className="p-4 border-b flex justify-between items-center bg-gradient-to-br from-slate-50 to-white flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
                                <History size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">سجل الفواتير</h2>
                                <p className="text-xs text-slate-500">إجمالي: {historyStats.count} فاتورة</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setShowClosureModal(true)}
                                className="flex items-center gap-2"
                            >
                                <Lock size={16} />
                                إغلاق حساب يومي
                            </Button>
                            <button
                                className="hover:bg-slate-200 rounded-full p-1 transition-colors"
                                onClick={onClose}
                            >
                                <XCircle size={20} className="text-slate-500" />
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="p-4 bg-slate-50 border-b flex-shrink-0">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <Input
                                    className="pr-10 text-sm"
                                    placeholder="بحث برقم الفاتورة أو العميل..."
                                    value={historyFilters.searchQuery}
                                    onChange={e => setHistoryFilters({ ...historyFilters, searchQuery: e.target.value })}
                                />
                            </div>

                            {/* Status Filter */}
                            <select
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={historyFilters.status}
                                onChange={e => setHistoryFilters({ ...historyFilters, status: e.target.value })}
                            >
                                <option value="">كل الحالات</option>
                                <option value={INVOICE_STATUS.PAID}>مدفوع</option>
                                <option value={INVOICE_STATUS.PARTIAL}>جزئي</option>
                                <option value={INVOICE_STATUS.UNPAID}>غير مدفوع</option>
                            </select>

                            {/* Type Filter */}
                            <select
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={historyFilters.invoiceType}
                                onChange={e => setHistoryFilters({ ...historyFilters, invoiceType: e.target.value })}
                            >
                                <option value="">كل الأنواع</option>
                                <option value="retail">تجزئة</option>
                                <option value="wholesale">جملة</option>
                            </select>

                            {/* Date Range */}
                            <select
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                value={historyFilters.dateRange}
                                onChange={e => setHistoryFilters({ ...historyFilters, dateRange: e.target.value })}
                            >
                                <option value="">كل الفترات</option>
                                <option value={DATE_RANGES.TODAY}>اليوم</option>
                                <option value={DATE_RANGES.WEEK}>هذا الأسبوع</option>
                                <option value={DATE_RANGES.MONTH}>هذا الشهر</option>
                            </select>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="p-4 bg-white border-b grid grid-cols-3 gap-4 flex-shrink-0">
                        <div className="text-center">
                            <div className="text-xs text-slate-500 mb-1">إجمالي المبيعات</div>
                            <div className="text-lg font-bold text-slate-900 font-mono">
                                {formatCurrency(historyStats.totalSales)}
                            </div>
                        </div>
                        <div className="text-center border-x border-slate-200">
                            <div className="text-xs text-slate-500 mb-1">المدفوع</div>
                            <div className="text-lg font-bold text-emerald-600 font-mono">
                                {formatCurrency(historyStats.totalPaid)}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-slate-500 mb-1">المتبقي</div>
                            <div className="text-lg font-bold text-red-600 font-mono">
                                {formatCurrency(historyStats.totalDue)}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                        ) : paginatedHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <History size={48} className="mb-4 opacity-20" />
                                <p className="font-bold">لا توجد فواتير</p>
                            </div>
                        ) : (
                            <table className="w-full bg-white rounded-lg overflow-hidden border border-slate-200">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr className="text-xs text-slate-600">
                                        <th className="py-2 px-3 text-right font-bold">رقم الفاتورة</th>
                                        <th className="py-2 px-3 text-right font-bold">التاريخ</th>
                                        <th className="py-2 px-3 text-right font-bold">العميل</th>
                                        <th className="py-2 px-3 text-center font-bold">المجموع</th>
                                        <th className="py-2 px-3 text-center font-bold">المدفوع</th>
                                        <th className="py-2 px-3 text-center font-bold">الحالة</th>
                                        <th className="py-2 px-3 text-center font-bold">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {paginatedHistory.map((invoice, i) => {
                                        const total = invoice.items.reduce((acc, item) => acc + (item.qty * item.price), 0) - (invoice.discount || 0)
                                        return (
                                            <tr key={invoice._id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="py-2 px-3 font-mono text-slate-700 font-bold">
                                                    #{invoice.number || invoice._id.slice(-6)}
                                                </td>
                                                <td className="py-2 px-3 text-slate-600">
                                                    {new Date(invoice.createdAt).toLocaleDateString('ar-LY')}
                                                </td>
                                                <td className="py-2 px-3 text-slate-700 font-medium">
                                                    {invoice.customer?.name || 'عميل عابر'}
                                                </td>
                                                <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                                                    {formatCurrency(total)}
                                                </td>
                                                <td className="py-2 px-3 text-center font-mono text-emerald-600 font-bold">
                                                    {formatCurrency(invoice.paid || 0)}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    {getStatusBadge(invoice)}
                                                </td>
                                                <td className="py-2 px-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleReprint(invoice)}
                                                            className="p-1.5 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                                                            title="طباعة"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t bg-white flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>عرض</span>
                            <select
                                className="border border-slate-200 rounded px-2 py-1 text-sm"
                                value={itemsPerPage}
                                onChange={e => setItemsPerPage(Number(e.target.value))}
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span>سجل</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                السابق
                            </Button>
                            <span className="text-sm text-slate-600">
                                {currentPage} / {totalPages || 1}
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                            >
                                التالي
                            </Button>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* Daily Closure Modal */}
            {showClosureModal && (
                <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600 border border-orange-200">
                                <Lock size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">إغلاق حساب يومي</h3>
                                <p className="text-xs text-slate-500">اختر التاريخ المراد إغلاقه</p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">التاريخ</label>
                            <Input
                                type="date"
                                value={closureDate}
                                onChange={e => setClosureDate(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                            <p className="text-xs text-amber-800">
                                ⚠️ <strong>تحذير:</strong> بعد إغلاق الحساب اليومي، لن يمكن التعديل على فواتير هذا اليوم.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setShowClosureModal(false)}
                                className="flex-1"
                                disabled={closingDay}
                            >
                                إلغاء
                            </Button>
                            <Button
                                onClick={handleCloseDailyAccount}
                                disabled={closingDay}
                                className="flex-1 bg-orange-600 hover:bg-orange-700"
                            >
                                {closingDay ? 'جاري الإغلاق...' : 'تأكيد الإغلاق'}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    )
}
