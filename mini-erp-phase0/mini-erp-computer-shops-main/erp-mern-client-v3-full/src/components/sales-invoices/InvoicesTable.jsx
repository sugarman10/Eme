/**
 * InvoicesTable Component
 * 
 * Data table for displaying sales invoices with sorting and selection
 */

import React from 'react'
import {
    FileText, Printer, Check, X, RotateCcw, Undo2,
    ChevronUp, ChevronDown, CheckSquare, Square, User
} from 'lucide-react'
import StatusBadge from './StatusBadge'

// Sort Icon Component
const SortIcon = ({ columnKey, sortConfig }) => {
    if (sortConfig.key !== columnKey) return <ChevronUp size={14} className="opacity-30" />
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
}

export default function InvoicesTable({
    invoices,
    selectedInvoices,
    sortConfig,
    canDelete,
    onSort,
    onSelectAll,
    onSelectInvoice,
    onView,
    onPrint,
    onPost,
    onVoid,
    onReverse,
    onReturn
}) {
    const toggleSelectAll = () => {
        if (selectedInvoices.length === invoices.length && invoices.length > 0) {
            onSelectAll([])
        } else {
            onSelectAll(invoices.map(inv => inv._id))
        }
    }

    const toggleSelectInvoice = (id) => {
        if (selectedInvoices.includes(id)) {
            onSelectInvoice(selectedInvoices.filter(i => i !== id))
        } else {
            onSelectInvoice([...selectedInvoices, id])
        }
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Scrollable Table Container */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 sticky top-0">
                        <tr>
                            {/* Checkbox Column */}
                            <th className="px-2 py-2.5 w-8">
                                <button onClick={toggleSelectAll} className="p-1 hover:bg-slate-200 rounded">
                                    {selectedInvoices.length === invoices.length && invoices.length > 0 ? (
                                        <CheckSquare size={14} className="text-primary-600" />
                                    ) : (
                                        <Square size={14} className="text-slate-400" />
                                    )}
                                </button>
                            </th>

                            {/* Invoice Number Column */}
                            <th className="px-2 py-2.5 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 w-24" onClick={() => onSort('id')}>
                                <div className="flex items-center gap-1">
                                    <span>رقم الفاتورة</span>
                                    <SortIcon columnKey="id" sortConfig={sortConfig} />
                                </div>
                            </th>

                            {/* Date Column */}
                            <th className="px-2 py-2.5 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 w-20" onClick={() => onSort('createdAt')}>
                                <div className="flex items-center gap-1">
                                    <span>التاريخ</span>
                                    <SortIcon columnKey="createdAt" sortConfig={sortConfig} />
                                </div>
                            </th>

                            <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-20">المستودع</th>
                            <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-16">الخزينة</th>
                            <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-28">العميل</th>
                            <th className="px-2 py-2.5 text-center font-bold text-slate-700 w-10">#</th>

                            {/* Payment Method Column */}
                            <th className="px-2 py-2.5 text-center font-bold text-slate-700 w-14">الدفع</th>

                            {/* Total Column */}
                            <th className="px-2 py-2.5 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 w-20" onClick={() => onSort('total')}>
                                <div className="flex items-center gap-1">
                                    <span>الإجمالي</span>
                                    <SortIcon columnKey="total" sortConfig={sortConfig} />
                                </div>
                            </th>

                            {/* Remaining Column */}
                            <th className="px-2 py-2.5 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 w-16" onClick={() => onSort('remaining')}>
                                <div className="flex items-center gap-1">
                                    <span>المتبقي</span>
                                    <SortIcon columnKey="remaining" sortConfig={sortConfig} />
                                </div>
                            </th>

                            {/* Cashier Column */}
                            <th className="px-2 py-2.5 text-right font-bold text-slate-700 w-20">الكاشير</th>

                            <th className="px-2 py-2.5 text-center font-bold text-slate-700 w-16">الحالة</th>
                            <th className="px-2 py-2.5 text-center font-bold text-slate-700 w-20">إجراءات</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="text-center p-8 text-gray-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <FileText size={48} className="opacity-20" />
                                        <p>لا توجد فواتير تطابق البحث</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            invoices.map(inv => {
                                const total = inv.totals?.grand || (inv.items || []).reduce((acc, i) => acc + (i.qty * i.price), 0) - (inv.totals?.discount || 0)
                                const paid = inv.totals?.paid || 0
                                const remaining = Math.max(0, total - paid)
                                const invDate = inv.date || inv.createdAt
                                const canPost = ['draft', 'pending'].includes(inv.status)
                                const canVoid = ['draft', 'pending'].includes(inv.status)
                                const canReturn = ['confirmed', 'posted', 'paid', 'closed'].includes(inv.status)
                                const canReverse = ['posted', 'confirmed'].includes(inv.status)

                                return (
                                    <tr key={inv._id} className="hover:bg-slate-50 transition-colors">
                                        {/* Checkbox */}
                                        <td className="px-2 py-3">
                                            <button onClick={() => toggleSelectInvoice(inv._id)} className="p-1 hover:bg-slate-200 rounded">
                                                {selectedInvoices.includes(inv._id) ? (
                                                    <CheckSquare size={16} className="text-primary-600" />
                                                ) : (
                                                    <Square size={16} className="text-slate-400" />
                                                )}
                                            </button>
                                        </td>

                                        {/* Invoice Number */}
                                        <td className="px-2 py-3">
                                            <span className="font-mono font-bold text-primary text-xs">
                                                {inv.number || `INV-${inv._id.slice(-6)}`}
                                            </span>
                                        </td>

                                        {/* Date & Time */}
                                        <td className="px-2 py-3">
                                            <div className="font-medium text-slate-900 text-xs">
                                                {new Date(invDate).toLocaleDateString('ar-LY')}
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                {new Date(invDate).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>

                                        {/* Warehouse */}
                                        <td className="px-2 py-3">
                                            <div className="text-xs font-medium text-slate-700 truncate" title={inv.warehouse?.name}>
                                                {inv.warehouse?.name || '-'}
                                            </div>
                                        </td>

                                        {/* Treasury */}
                                        <td className="px-2 py-3">
                                            <div className="text-xs font-medium text-slate-700 truncate" title={inv.treasury?.name}>
                                                {inv.treasury?.name || '-'}
                                            </div>
                                        </td>

                                        {/* Customer */}
                                        <td className="px-2 py-3">
                                            <div className="flex items-center gap-2 truncate" title={inv.customerName || inv.customer?.name || 'عميل نقدي'}>
                                                <div className="w-6 h-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                                                    {(inv.customerName || inv.customer?.name)?.[0] || 'ع'}
                                                </div>
                                                <span className="font-medium text-xs truncate">{inv.customerName || inv.customer?.name || 'عميل نقدي'}</span>
                                            </div>
                                        </td>

                                        {/* Items Count */}
                                        <td className="px-2 py-3 text-center">
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                                                {inv.items?.length || 0}
                                            </span>
                                        </td>

                                        {/* Payment Method - V2.0 */}
                                        <td className="px-2 py-3 text-center">
                                            {(() => {
                                                const method = inv.paymentMethod || 'cash'
                                                const methodConfig = {
                                                    cash: { label: 'نقدي', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '💵' },
                                                    card: { label: 'بطاقة', bg: 'bg-blue-100', text: 'text-blue-700', icon: '💳' },
                                                    bank: { label: 'تحويل', bg: 'bg-purple-100', text: 'text-purple-700', icon: '🏦' },
                                                    credit: { label: 'آجل', bg: 'bg-amber-100', text: 'text-amber-700', icon: '📅' },
                                                    check: { label: 'شيك', bg: 'bg-gray-100', text: 'text-gray-700', icon: '📝' },
                                                    split: { label: 'مقسم', bg: 'bg-indigo-100', text: 'text-indigo-700', icon: '✂️' }
                                                }
                                                const config = methodConfig[method] || methodConfig.cash
                                                return (
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bg} ${config.text}`}>
                                                        <span>{config.icon}</span>
                                                        {config.label}
                                                    </span>
                                                )
                                            })()}
                                        </td>

                                        {/* Total */}
                                        <td className="px-2 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 text-xs whitespace-nowrap">
                                                    {total.toFixed(2)} د.ل
                                                </span>
                                                {inv.totalUSD > 0 && (
                                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                                                        ≈ ${inv.totalUSD.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Remaining - Red if > 0 */}
                                        <td className="px-2 py-3">
                                            <div className="flex flex-col">
                                                <span className={`font-bold text-xs whitespace-nowrap ${remaining > 0 ? 'text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded' : 'text-emerald-600'}`}>
                                                    {remaining.toFixed(2)} د.ل
                                                </span>
                                                {remaining > 0 && inv.remainingUSD > 0 && (
                                                    <span className="text-[10px] text-red-500 font-mono font-bold">
                                                        ≈ ${inv.remainingUSD.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Cashier - V2.0 */}
                                        <td className="px-2 py-3">
                                            {inv.cashier?.name ? (
                                                <div className="flex items-center gap-1 text-xs text-slate-600">
                                                    <User size={12} className="text-slate-400" />
                                                    <span className="truncate max-w-[80px]" title={inv.cashier.name}>{inv.cashier.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-2 py-3 text-center">
                                            <StatusBadge status={inv.status} />
                                        </td>

                                        {/* Actions */}
                                        <td className="px-2 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => onView(inv)}
                                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-indigo-600 transition-colors"
                                                    title="عرض التفاصيل"
                                                >
                                                    <FileText size={14} />
                                                </button>
                                                <button
                                                    onClick={() => onPrint(inv)}
                                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-primary transition-colors"
                                                    title="طباعة"
                                                >
                                                    <Printer size={14} />
                                                </button>

                                                {canPost && (
                                                    <button
                                                        onClick={() => onPost(inv)}
                                                        className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                                                        title="Post"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                )}

                                                {canVoid && canDelete && (
                                                    <button
                                                        onClick={() => onVoid(inv)}
                                                        className="p-1.5 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                                                        title="Void"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}

                                                {canReturn && (
                                                    <button
                                                        onClick={() => onReturn(inv)}
                                                        className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-600 transition-colors"
                                                        title="Return"
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                )}

                                                {canReverse && (
                                                    <button
                                                        onClick={() => onReverse(inv)}
                                                        className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-600 transition-colors"
                                                        title="Reverse"
                                                    >
                                                        <Undo2 size={14} />
                                                    </button>
                                                )}

                                                {inv.status === 'refund' && (
                                                    <div className="text-[10px] text-purple-600 italic flex items-center gap-1">
                                                        <RotateCcw size={12} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
