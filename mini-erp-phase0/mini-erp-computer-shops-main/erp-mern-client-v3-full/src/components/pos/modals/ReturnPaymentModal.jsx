import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
    XCircle, Check, Printer, Save, Banknote, CreditCard,
    Building2, FileText, AlertCircle, RotateCcw,
    Calculator, User, ChevronDown, CheckCircle2, ShieldAlert
} from 'lucide-react'
import { formatCurrency } from '../../../lib/utils'
import { PAYMENT_METHODS } from '../../../constants/posConstants'

/**
 * ReturnPaymentModal - Master Sales Return Finalization & Refund Modal
 * 
 * Invoked when cashier finishes adding return items:
 * - Displays grand refund total due to customer.
 * - Supports refund methods:
 *   1. Cash Refund (صرف نقدي من الخزينة)
 *   2. On Account / Credit Note (تخفيض حساب العميل / إشعار دائن)
 *   3. Bank Transfer (تحويل بنكي)
 * - Selects treasury for cash/bank refunds.
 * - Captures optional return reason & original invoice number.
 * - Hotkeys: Enter / F9 = Confirm Return, Esc = Close.
 */
export const ReturnPaymentModal = ({
    show,
    onClose,
    totalRefundAmount = 0,
    subtotal = 0,
    globalDiscount = 0,
    currency = 'د.ل',
    selectedRefundMethod = 'cash',
    setSelectedRefundMethod,
    selectedTreasury = '',
    setSelectedTreasury,
    treasuries = [],
    customerId = '',
    setCustomerId,
    customers = [],
    customerName = 'عميل نقدي',
    onConfirmReturn,
    saving = false,
    returnNumber = '',
    originalInvoiceNumber = '',
    setOriginalInvoiceNumber,
    returnReason = 'customer_return',
    setReturnReason,
    returnNotes = '',
    setReturnNotes,
    warehouseName = '',
    returnItemsCount = 0
}) => {
    const cashTreasurySelectRef = useRef(null)
    const [quickCustomerSearch, setQuickCustomerSearch] = useState('')
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false)

    // Filtered Treasuries
    const filteredTreasuries = useMemo(() => {
        if (!treasuries || !treasuries.length) return []
        if (selectedRefundMethod === 'cash') {
            return treasuries.filter(t => t.type?.toLowerCase() === 'safe')
        }
        if (selectedRefundMethod === 'bank') {
            return treasuries.filter(t => t.type?.toLowerCase() === 'bank')
        }
        return treasuries
    }, [treasuries, selectedRefundMethod])

    // Ensure default treasury is selected
    useEffect(() => {
        if (!show) return
        if (filteredTreasuries.length > 0 && !selectedTreasury) {
            setSelectedTreasury(filteredTreasuries[0]._id)
        } else if (filteredTreasuries.length > 0 && !filteredTreasuries.some(t => t._id === selectedTreasury)) {
            setSelectedTreasury(filteredTreasuries[0]._id)
        }
    }, [show, filteredTreasuries, selectedTreasury, setSelectedTreasury])

    // Customer Lookup
    const selectedCustObj = useMemo(() => {
        if (!customerId || !customers) return null
        return customers.find(c => (c._id || c.id)?.toString() === customerId?.toString()) || null
    }, [customerId, customers])

    const modalFilteredCustomers = useMemo(() => {
        const q = quickCustomerSearch.trim().toLowerCase()
        if (!q) return customers.slice(0, 20)
        return customers.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q)) ||
            (c.code && c.code.toLowerCase().includes(q))
        ).slice(0, 20)
    }, [customers, quickCustomerSearch])

    // Submit handler
    const handleSubmit = useCallback((shouldPrint = false) => {
        if (selectedRefundMethod === 'credit' && !customerId) {
            alert('يرجى اختيار عميل مسجل لإرجاع المبلغ على الحساب (إشعار دائن)')
            return
        }
        if (onConfirmReturn) {
            onConfirmReturn(shouldPrint)
        }
    }, [selectedRefundMethod, customerId, onConfirmReturn])

    // Keyboard Shortcuts inside Modal
    useEffect(() => {
        if (!show) return

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                onClose()
                return
            }

            if (e.key === 'F9' || e.key === 'Enter') {
                if (!customerPickerOpen && !saving) {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSubmit(true)
                }
            }

            if (e.key === 'F8') {
                if (!saving) {
                    e.preventDefault()
                    e.stopPropagation()
                    handleSubmit(false)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [show, saving, handleSubmit, onClose, customerPickerOpen])

    if (!show) return null

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
            <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden flex flex-col max-h-[92vh]"
            >
                {/* 1. Modal Top Bar - Deep Crimson / Rose Theme */}
                <div className="bg-gradient-to-r from-rose-900 via-rose-950 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-rose-800/40">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                            <RotateCcw size={18} className="animate-spin-once" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-black tracking-wide">
                                    إتمام عملية الإرجاع وصرف المبلغ
                                </h3>
                                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full font-bold border border-rose-500/30">
                                    مردودات مبيعات
                                </span>
                            </div>
                            <div className="text-[11px] text-rose-200/80 font-mono mt-0.5 flex items-center gap-3">
                                <span>مرتجع: #{returnNumber || 'جديد'}</span>
                                <span>•</span>
                                <span>المخزن المستلم: {warehouseName || 'المخزن الرئيسي'}</span>
                                <span>•</span>
                                <span>الأصناف: {returnItemsCount} صنف</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-rose-300 hover:text-white p-1 rounded-lg hover:bg-rose-800/50 transition-colors cursor-pointer"
                        title="إلغاء والرجوع (Esc)"
                    >
                        <XCircle size={22} />
                    </button>
                </div>

                {/* 2. Grand Refund Total Banner */}
                <div className="p-4 bg-gradient-to-br from-rose-50 via-rose-100/50 to-white dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 border-b border-rose-200 dark:border-rose-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                        <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                            إجمالي المبلغ المستحق رده للعميل:
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            سيتم إضافة الأصناف المرجعة للمخزون وصرف المبلغ بالطريقة المحددة
                        </span>
                    </div>
                    <div className="text-right flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight">
                            {formatCurrency(totalRefundAmount)}
                        </span>
                        <span className="text-sm font-bold text-rose-700 dark:text-rose-300">{currency}</span>
                    </div>
                </div>

                {/* 3. Refund Methods Grid */}
                <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                            اختر طريقة صرف / تسوية المرتجع:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {/* Option 1: Cash Refund */}
                            <button
                                type="button"
                                onClick={() => setSelectedRefundMethod('cash')}
                                className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                                    selectedRefundMethod === 'cash'
                                        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20 shadow-xs font-bold'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                                        <Banknote size={16} />
                                    </div>
                                    {selectedRefundMethod === 'cash' && (
                                        <CheckCircle2 size={15} className="text-rose-600 dark:text-rose-400" />
                                    )}
                                </div>
                                <span className="text-xs font-bold mt-1">💵 صرف نقدي (كاش)</span>
                                <span className="text-[10px] opacity-75 font-normal">صرف فوري من الخزينة النقدية</span>
                            </button>

                            {/* Option 2: Credit Account / Credit Note */}
                            <button
                                type="button"
                                onClick={() => setSelectedRefundMethod('credit')}
                                className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                                    selectedRefundMethod === 'credit'
                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs font-bold'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                                        <FileText size={16} />
                                    </div>
                                    {selectedRefundMethod === 'credit' && (
                                        <CheckCircle2 size={15} className="text-blue-600 dark:text-blue-400" />
                                    )}
                                </div>
                                <span className="text-xs font-bold mt-1">📝 على الحساب (إشعار دائن)</span>
                                <span className="text-[10px] opacity-75 font-normal">خصم من مديونية العميل</span>
                            </button>

                            {/* Option 3: Bank Refund */}
                            <button
                                type="button"
                                onClick={() => setSelectedRefundMethod('bank')}
                                className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                                    selectedRefundMethod === 'bank'
                                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-100 ring-2 ring-purple-500/20 shadow-xs font-bold'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                                        <Building2 size={16} />
                                    </div>
                                    {selectedRefundMethod === 'bank' && (
                                        <CheckCircle2 size={15} className="text-purple-600 dark:text-purple-400" />
                                    )}
                                </div>
                                <span className="text-xs font-bold mt-1">🏦 تحويل بنكي / بطاقة</span>
                                <span className="text-[10px] opacity-75 font-normal">صرف من الحساب المصرفي</span>
                            </button>
                        </div>
                    </div>

                    {/* Method Details Box */}
                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                        {/* Detail A: Cash or Bank Treasury Selection */}
                        {['cash', 'bank'].includes(selectedRefundMethod) && (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {selectedRefundMethod === 'cash' ? 'الخزينة النقدية التي سيتم الصرف منها:' : 'الحساب المصرفي للصرف:'}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                        سيتم تسجيل قيد سند صرف تلقائي
                                    </span>
                                </div>
                                <select
                                    ref={cashTreasurySelectRef}
                                    value={selectedTreasury}
                                    onChange={e => setSelectedTreasury(e.target.value)}
                                    className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer focus:border-rose-500"
                                >
                                    {filteredTreasuries.map(t => (
                                        <option key={t._id} value={t._id}>
                                            {t.type === 'bank' ? '🏦' : '💵'} {t.name} ({t.type === 'bank' ? 'حساب مصرفي' : 'خزينة نقدية'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Detail B: On Account (Customer check) */}
                        {selectedRefundMethod === 'credit' && (
                            <div className="flex flex-col gap-3">
                                {!customerId ? (
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                                            <AlertCircle size={15} className="text-amber-600" />
                                            <span>يلزم تحديد عميل مسجل لتسوية المرتجع على حسابه:</span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={quickCustomerSearch}
                                                onChange={e => {
                                                    setQuickCustomerSearch(e.target.value)
                                                    setCustomerPickerOpen(true)
                                                }}
                                                onFocus={() => setCustomerPickerOpen(true)}
                                                placeholder="🔍 ابحث عن عميل بالاسم أو الهاتف..."
                                                className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none"
                                            />
                                            {customerPickerOpen && (
                                                <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto p-1">
                                                    {modalFilteredCustomers.map(c => (
                                                        <div
                                                            key={c._id}
                                                            onClick={() => {
                                                                setCustomerId(c._id)
                                                                setCustomerPickerOpen(false)
                                                            }}
                                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer flex items-center justify-between text-xs"
                                                        >
                                                            <span className="font-bold text-slate-800 dark:text-white">{c.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono">{c.phone}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <User size={18} className="text-blue-600" />
                                            <div>
                                                <div className="font-bold text-xs text-slate-900 dark:text-white">
                                                    {selectedCustObj?.name || customerName}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {selectedCustObj?.phone || 'بدون هاتف'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[10px] text-slate-400 font-bold">الرصيد الحالي:</div>
                                            <div className={`text-xs font-mono font-bold ${(selectedCustObj?.balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {formatCurrency(selectedCustObj?.balance || 0)}
                                                {(selectedCustObj?.balance || 0) > 0 ? ' (مدين)' : ' (دائن)'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {customerId && (
                                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                                        <span className="text-xs font-bold text-blue-800 dark:text-blue-200">
                                            الرصيد الجديد بعد خصم المرتجع (إشعار دائن):
                                        </span>
                                        <span className="text-sm font-mono font-black text-blue-700 dark:text-blue-300">
                                            {formatCurrency((selectedCustObj?.balance || 0) - totalRefundAmount)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Optional Invoice & Return Reason Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                            {/* Reason */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                                    سبب الإرجاع:
                                </label>
                                <select
                                    value={returnReason}
                                    onChange={e => setReturnReason && setReturnReason(e.target.value)}
                                    className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none"
                                >
                                    <option value="customer_return">رغبة العميل (بضاعة سليمة)</option>
                                    <option value="damaged">صنف تالف / به عيب مصنعي</option>
                                    <option value="expired">منتهي الصلاحية</option>
                                    <option value="wrong_item">صنف بالخطأ / مختلف عن الطلب</option>
                                    <option value="other">أخرى</option>
                                </select>
                            </div>

                            {/* Optional Original Invoice Number */}
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">
                                    رقم الفاتورة الأصلية (اختياري):
                                </label>
                                <input
                                    type="text"
                                    value={originalInvoiceNumber}
                                    onChange={e => setOriginalInvoiceNumber && setOriginalInvoiceNumber(e.target.value)}
                                    placeholder="مثال: INV-00125"
                                    className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Modal Footer Action Buttons */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        إلغاء والرجوع (Esc)
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Save Only Button (F8) */}
                        <button
                            type="button"
                            onClick={() => handleSubmit(false)}
                            disabled={saving || !totalRefundAmount}
                            className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                            title="حفظ وترحيل المرتجع فقط بدون طباعة (F8)"
                        >
                            <Save size={15} />
                            <span>حفظ وترحيل المرتجع (F8)</span>
                        </button>

                        {/* Save & Print Button (F9 / Enter) */}
                        <button
                            type="button"
                            onClick={() => handleSubmit(true)}
                            disabled={saving || !totalRefundAmount}
                            className="px-6 py-2.5 bg-gradient-to-r from-rose-800 to-rose-950 hover:from-rose-900 hover:to-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95 disabled:opacity-50 ring-2 ring-rose-500/30"
                            title="تأكيد المرتجع وصرف المبلغ وطباعة السند (Enter / F9)"
                        >
                            <RotateCcw size={16} />
                            <span className="font-black">
                                {saving ? 'جاري تنفيذ المرتجع...' : 'تأكيد وصرف المرتجع (Enter / F9)'}
                            </span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
