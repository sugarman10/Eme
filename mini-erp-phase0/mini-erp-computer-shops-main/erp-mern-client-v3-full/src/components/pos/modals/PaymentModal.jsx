import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
    XCircle, Check, Printer, Save, Banknote, CreditCard,
    Building2, FileText, Split, Wallet, AlertCircle, Sparkles,
    Calculator, User, ChevronDown, CheckCircle2
} from 'lucide-react'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { formatCurrency } from '../../../lib/utils'
import { PAYMENT_METHODS } from '../../../constants/posConstants'
import { animations } from '../../../lib/posDesignTokens'
import { useSettings } from '../../../context/SettingsContext'

/**
 * PaymentModal - Master Point of Sale Checkout & Payment Finalization
 * 
 * Invoked at checkout ("عند إتمام البيع"):
 * - Allows selecting Cash, Card, Bank, Credit, Split, or Wallet
 * - Calculates change due / remaining debt in real-time
 * - Quick cash denomination helpers (+5, +10, +20, +50, +100, +200, Exact)
 * - Treasury routing (Safes for cash, Banks/POS for card/bank)
 * - Hotkeys: Enter/F9 = Save & Print, F8 = Save Only, Esc = Close
 */
export const PaymentModal = ({
    show,
    onClose,
    totalAfterDiscount = 0,
    subtotal = 0,
    globalDiscount = 0,
    currency = 'د.ل',
    selectedPaymentMethod = PAYMENT_METHODS.CASH,
    setSelectedPaymentMethod,
    paidAmount = '',
    setPaidAmount,
    effectivePaidAmount = 0,
    change = 0,
    selectedTreasury = '',
    setSelectedTreasury,
    treasuries = [],
    splitPayments = [],
    setSplitPayments,
    customerId = '',
    setCustomerId,
    customers = [],
    customerWalletBalance = 0,
    applyWalletCredit,
    walletAmountToUse = 0,
    onConfirmSave,
    saving = false,
    invoiceNumber = '',
    customerName = 'عميل نقدي',
    warehouseName = '',
    cartItemsCount = 0,
    allowCredit = true  // false in fast/cash mode — disables deferred (credit) payment
}) => {
    const cashInputRef = useRef(null)
    const [quickCustomerSearch, setQuickCustomerSearch] = useState('')
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
    const [usdCashPaid, setUsdCashPaid] = useState('')
    const { usdExchangeRate = 7.30 } = useSettings()

    const handleUsdCashChange = (val) => {
        setUsdCashPaid(val)
        const num = parseFloat(val)
        if (!isNaN(num) && num > 0) {
            const lydVal = Math.round(num * (usdExchangeRate || 7.30) * 100) / 100
            setPaidAmount(String(lydVal))
        } else if (val === '') {
            setPaidAmount('')
        }
    }

    // Filter treasuries based on payment method
    const filteredTreasuries = useMemo(() => {
        if (!treasuries || !treasuries.length) return []
        if (selectedPaymentMethod === PAYMENT_METHODS.CASH) {
            return treasuries.filter(t => t.type?.toLowerCase() === 'safe')
        }
        if ([PAYMENT_METHODS.CARD, PAYMENT_METHODS.BANK].includes(selectedPaymentMethod)) {
            return treasuries.filter(t => t.type?.toLowerCase() === 'bank')
        }
        return treasuries
    }, [treasuries, selectedPaymentMethod])

    // Auto-select matching treasury when payment method changes
    useEffect(() => {
        if (!show) return
        if (filteredTreasuries.length > 0) {
            const currentValid = filteredTreasuries.some(t => t._id === selectedTreasury)
            if (!currentValid) {
                setSelectedTreasury(filteredTreasuries[0]._id)
            }
        }
    }, [show, selectedPaymentMethod, filteredTreasuries, selectedTreasury, setSelectedTreasury])

    // Auto-focus cash input when modal opens in cash mode
    useEffect(() => {
        if (show && selectedPaymentMethod === PAYMENT_METHODS.CASH) {
            const timer = setTimeout(() => {
                cashInputRef.current?.focus()
                cashInputRef.current?.select()
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [show, selectedPaymentMethod])

    // Filtered customers for quick credit selection inside modal
    const modalFilteredCustomers = useMemo(() => {
        const q = quickCustomerSearch.trim().toLowerCase()
        if (!q) return customers.slice(0, 20)
        return customers.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q)) ||
            (c.code && c.code.toLowerCase().includes(q))
        ).slice(0, 20)
    }, [customers, quickCustomerSearch])

    const selectedCustObj = useMemo(() => {
        if (!customerId || !customers) return null
        return customers.find(c => (c._id || c.id)?.toString() === customerId?.toString()) || null
    }, [customerId, customers])

    const [creditOverrideApproved, setCreditOverrideApproved] = useState(false)

    // Credit & Limit calculations
    const currentCustomerBalance = Number(selectedCustObj?.balance || 0)
    const customerCreditLimit = Number(selectedCustObj?.creditLimit || 0)
    const creditRemainingDebt = Math.max(0, totalAfterDiscount - (Number(paidAmount) || 0))
    const projectedCustomerBalance = currentCustomerBalance + creditRemainingDebt
    const isExceedingCreditLimit = customerCreditLimit > 0 && projectedCustomerBalance > customerCreditLimit
    const creditExcessAmount = isExceedingCreditLimit ? projectedCustomerBalance - customerCreditLimit : 0
    const isSaveBlockedByCreditLimit = selectedPaymentMethod === PAYMENT_METHODS.CREDIT && isExceedingCreditLimit && !creditOverrideApproved

    const handleSaveTrigger = useCallback((shouldPrint = false) => {
        if (selectedPaymentMethod === PAYMENT_METHODS.CREDIT && isExceedingCreditLimit && !creditOverrideApproved) {
            alert(`⚠️ تنبيه: لا يمكن حفظ الفاتورة لأنها تتجاوز سقف الائتمان المسموح به للعميل (${formatCurrency(customerCreditLimit)} د.ل).\nمقدار التجاوز: ${formatCurrency(creditExcessAmount)} د.ل.\nيرجى سداد دفعة نقدية أكبر أو تفعيل موافقة المشرف المسؤول.`)
            return
        }
        if (onConfirmSave) {
            onConfirmSave(shouldPrint, { allowCreditOverride: creditOverrideApproved })
        }
    }, [selectedPaymentMethod, isExceedingCreditLimit, creditOverrideApproved, customerCreditLimit, creditExcessAmount, onConfirmSave])

    // Keyboard shortcuts inside modal
    useEffect(() => {
        if (!show) return

        const handleKeyDown = (e) => {
            // Escape - Close modal
            if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                onClose()
                return
            }

            // F9 - Save & Print
            if (e.key === 'F9') {
                e.preventDefault()
                e.stopPropagation()
                if (!saving) {
                    handleSaveTrigger(true)
                }
                return
            }

            // F8 - Save Only
            if (e.key === 'F8') {
                e.preventDefault()
                e.stopPropagation()
                if (!saving) {
                    handleSaveTrigger(false)
                }
                return
            }

            // Enter (only if not searching for customer)
            if (e.key === 'Enter' && !customerPickerOpen) {
                // If user is typing in cash input, Enter submits and prints
                e.preventDefault()
                e.stopPropagation()
                if (!saving) {
                    handleSaveTrigger(true)
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [show, saving, handleSaveTrigger, onClose, customerPickerOpen])

    if (!show) return null

    // Cash shortcuts helpers
    const setExactCash = () => {
        setPaidAmount(totalAfterDiscount.toString())
        cashInputRef.current?.focus()
    }

    const addCashAmount = (addon) => {
        const current = Number(paidAmount) || 0
        setPaidAmount((current + addon).toString())
        cashInputRef.current?.focus()
    }

    const setFixedCashNote = (note) => {
        setPaidAmount(note.toString())
        cashInputRef.current?.focus()
    }

    const numPaid = Number(paidAmount) || 0
    const cashChangeDue = Math.max(0, numPaid - totalAfterDiscount)
    const cashRemainingDue = Math.max(0, totalAfterDiscount - numPaid)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs select-none text-right font-sans animate-in fade-in duration-150">
            <motion.div
                initial={animations.scaleIn.initial}
                animate={animations.scaleIn.animate}
                exit={animations.scaleIn.exit}
                className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[95vh]"
            >
                {/* 1. Modal Header */}
                <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all cursor-pointer"
                        title="إلغاء وإغلاق (Esc)"
                    >
                        <XCircle size={18} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span>إتمام عملية البيع والدفع</span>
                                <div className="w-7 h-7 rounded-lg bg-[#24357a] text-white flex items-center justify-center shadow-xs">
                                    <Banknote size={16} />
                                </div>
                            </h2>
                            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-2 mt-0.5">
                                {invoiceNumber && <span className="font-mono font-bold text-slate-600 dark:text-slate-300">فاتورة #{invoiceNumber}</span>}
                                <span>•</span>
                                <span>{customerName || 'عميل نقدي'}</span>
                                {warehouseName && (
                                    <>
                                        <span>•</span>
                                        <span>{warehouseName}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Scrollable Body */}
                <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                    {/* Hero Total Box */}
                    <div className="bg-gradient-to-l from-[#24357a] to-[#1e2b60] text-white rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col">
                            <span className="text-xs text-blue-200 font-bold">الصافي المطلوب سداده</span>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight">
                                    {formatCurrency(totalAfterDiscount)}
                                </span>
                                <span className="text-xs text-blue-300 font-bold">({cartItemsCount} أصناف)</span>
                            </div>
                            {/* Dual USD Equivalent Badge */}
                            <div className="flex items-center gap-2 mt-2 text-xs text-emerald-300 font-bold font-mono bg-emerald-950/50 border border-emerald-500/40 px-2.5 py-1 rounded-lg w-fit shadow-xs">
                                <span>💵 المعادل بالدولار:</span>
                                <span className="text-sm font-black text-white">${(totalAfterDiscount / (usdExchangeRate || 7.30)).toFixed(2)} USD</span>
                                <span className="text-[10px] text-emerald-300/80 font-normal font-sans mr-1">(1$ = {usdExchangeRate || 7.30} د.ل)</span>
                            </div>
                        </div>

                        {globalDiscount > 0 && (
                            <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-right">
                                <div className="text-[10px] text-blue-200 font-bold">الإجمالي قبل الخصم:</div>
                                <div className="font-mono text-xs line-through opacity-80">{formatCurrency(subtotal)}</div>
                                <div className="text-[10px] text-amber-300 font-bold mt-0.5">خصم: {formatCurrency(globalDiscount)}</div>
                            </div>
                        )}
                    </div>

                    {/* 3. Payment Methods Selector Grid */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>طريقة الدفع:</span>
                            <span className="text-[10px] font-normal text-slate-400">اختر وسيلة التحصيل المناسبة</span>
                        </label>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {/* 1. Cash */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPaymentMethod(PAYMENT_METHODS.CASH)
                                    setPaidAmount('')
                                }}
                                className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${selectedPaymentMethod === PAYMENT_METHODS.CASH
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20 shadow-xs font-bold'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                                        <Banknote size={16} />
                                    </div>
                                    {selectedPaymentMethod === PAYMENT_METHODS.CASH && (
                                        <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                                    )}
                                </div>
                                <span className="text-xs font-bold mt-1">💵 نقدي (Cash)</span>
                                <span className="text-[10px] opacity-75 font-normal">دفع نقدي كاش فوري</span>
                            </button>

                            {/* 2. Card */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPaymentMethod(PAYMENT_METHODS.CARD)
                                    setPaidAmount('')
                                }}
                                className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${selectedPaymentMethod === PAYMENT_METHODS.CARD
                                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20 shadow-xs font-bold'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                                        <CreditCard size={16} />
                                    </div>
                                    {selectedPaymentMethod === PAYMENT_METHODS.CARD && (
                                        <CheckCircle2 size={15} className="text-blue-600 dark:text-blue-400" />
                                    )}
                                </div>
                                <span className="text-xs font-bold mt-1">💳 بطاقة مصرفية</span>
                                <span className="text-[10px] opacity-75 font-normal">أجهزة نقاط البيع POS</span>
                            </button>

                            {/* 3. Bank */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPaymentMethod(PAYMENT_METHODS.BANK)
                                    setPaidAmount('')
                                }}
                                className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${selectedPaymentMethod === PAYMENT_METHODS.BANK
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-500/20 shadow-xs font-bold'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                                        <Building2 size={16} />
                                    </div>
                                    {selectedPaymentMethod === PAYMENT_METHODS.BANK && (
                                        <CheckCircle2 size={15} className="text-indigo-600 dark:text-indigo-400" />
                                    )}
                                </div>
                                <span className="text-xs font-bold mt-1">🏦 تحويل بنكي</span>
                                <span className="text-[10px] opacity-75 font-normal">حوالة لحساب المصرف</span>
                            </button>

                            {/* 4. Credit — hidden in fast/cash mode */}
                            {allowCredit && <button
                                type="button"
                                onClick={() => {
                                    setSelectedPaymentMethod(PAYMENT_METHODS.CREDIT)
                                    setPaidAmount('')
                                }}
                                className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${selectedPaymentMethod === PAYMENT_METHODS.CREDIT
                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20 shadow-xs font-bold'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                                        <FileText size={16} />
                                    </div>
                                    {selectedPaymentMethod === PAYMENT_METHODS.CREDIT && (
                                        <CheckCircle2 size={15} className="text-rose-600 dark:text-rose-400" />
                                    )}
                                </div>
                                <span className="text-xs font-bold mt-1">📝 آجل (دين)</span>
                                <span className="text-[10px] opacity-75 font-normal">تسجيل على حساب العميل</span>
                            </button>}

                            {/* 5. Split */}
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPaymentMethod(PAYMENT_METHODS.SPLIT)
                                    if (!splitPayments || splitPayments.length < 2) {
                                        setSplitPayments([
                                            { method: PAYMENT_METHODS.CASH, amount: totalAfterDiscount, treasury: selectedTreasury },
                                            { method: PAYMENT_METHODS.CARD, amount: 0, treasury: '' }
                                        ])
                                    }
                                }}
                                className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${selectedPaymentMethod === PAYMENT_METHODS.SPLIT
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/20 shadow-xs font-bold'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                                        <Split size={16} />
                                    </div>
                                    {selectedPaymentMethod === PAYMENT_METHODS.SPLIT && (
                                        <CheckCircle2 size={15} className="text-amber-600 dark:text-amber-400" />
                                    )}
                                </div>
                                <span className="text-xs font-bold mt-1">⚡ دفع مجزأ</span>
                                <span className="text-[10px] opacity-75 font-normal">دفعات مختلطة نقد وبطاقة</span>
                            </button>

                            {/* 6. Wallet */}
                            {customerWalletBalance > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPaymentMethod(PAYMENT_METHODS.WALLET)
                                        if (applyWalletCredit) applyWalletCredit()
                                    }}
                                    className={`p-3 rounded-xl border text-right transition-all flex flex-col gap-1 cursor-pointer ${selectedPaymentMethod === PAYMENT_METHODS.WALLET
                                        ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-100 ring-2 ring-purple-500/20 shadow-xs font-bold'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                                            <Wallet size={16} />
                                        </div>
                                        {selectedPaymentMethod === PAYMENT_METHODS.WALLET && (
                                            <CheckCircle2 size={15} className="text-purple-600 dark:text-purple-400" />
                                        )}
                                    </div>
                                    <span className="text-xs font-bold mt-1">👛 رصيد المحفظة</span>
                                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold font-mono">
                                        متاح: {formatCurrency(customerWalletBalance)}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 4. Active Method Interaction Details */}
                    <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                        {/* CASE A: CASH DETAILS */}
                        {selectedPaymentMethod === PAYMENT_METHODS.CASH && (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        المبلغ المستلم نقداً:
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                        اكتب المبلغ المدفوع لحساب الباقي تلقائياً
                                    </span>
                                </div>

                                <div className="flex gap-2 items-center">
                                    <input
                                        ref={cashInputRef}
                                        type="number"
                                        step="any"
                                        value={paidAmount}
                                        onChange={e => setPaidAmount(e.target.value)}
                                        placeholder={totalAfterDiscount.toString()}
                                        className="flex-1 h-12 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl px-4 text-xl font-mono font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-left"
                                    />
                                    <button
                                        type="button"
                                        onClick={setExactCash}
                                        className="h-12 px-4 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl text-xs hover:bg-emerald-200 transition-all shrink-0 cursor-pointer"
                                    >
                                        المبلغ بالضبط
                                    </button>
                                </div>

                                {/* USD Cash Tender Option */}
                                <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                        <span className="text-sm">💵</span>
                                        <span>استلام بالدولار كاش ($):</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="any"
                                            value={usdCashPaid}
                                            onChange={e => handleUsdCashChange(e.target.value)}
                                            placeholder="0.00 $"
                                            className="w-24 h-8 bg-white dark:bg-slate-900 border border-emerald-400 dark:border-emerald-700 rounded-lg px-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 outline-none text-left"
                                        />
                                        {usdCashPaid && parseFloat(usdCashPaid) > 0 && (
                                            <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                                                = {(parseFloat(usdCashPaid) * (usdExchangeRate || 7.30)).toFixed(2)} د.ل
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Quick Cash Notes Helpers */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-slate-400 font-bold ml-1">فئات سريعة:</span>
                                    {[10, 20, 50, 100, 200].map(note => (
                                        <button
                                            key={note}
                                            type="button"
                                            onClick={() => setFixedCashNote(note)}
                                            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold hover:bg-slate-100 transition-all text-slate-700 dark:text-slate-300 shadow-2xs cursor-pointer"
                                        >
                                            {note}
                                        </button>
                                    ))}
                                    <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>
                                    {[5, 10, 20, 50].map(add => (
                                        <button
                                            key={add}
                                            type="button"
                                            onClick={() => addCashAmount(add)}
                                            className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-mono hover:bg-slate-200 transition-all text-slate-600 dark:text-slate-400 cursor-pointer"
                                        >
                                            +{add}
                                        </button>
                                    ))}
                                </div>

                                {/* Change Due / Remaining Box */}
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className={`p-3 rounded-xl border flex flex-col ${cashChangeDue > 0
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-100'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                                        }`}>
                                        <span className="text-[10px] font-bold">الباقي للعميل (الفكة):</span>
                                        <span className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                            {formatCurrency(cashChangeDue)}
                                        </span>
                                    </div>

                                    <div className={`p-3 rounded-xl border flex flex-col ${cashRemainingDue > 0 && numPaid > 0
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-100'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                                        }`}>
                                        <span className="text-[10px] font-bold">المتبقي المطلوب:</span>
                                        <span className="text-xl font-mono font-black text-amber-600 dark:text-amber-400 mt-0.5">
                                            {formatCurrency(cashRemainingDue)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CASE B: CREDIT DETAILS */}
                        {selectedPaymentMethod === PAYMENT_METHODS.CREDIT && (
                            <div className="flex flex-col gap-3">
                                {!customerId ? (
                                    <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 rounded-xl flex flex-col gap-2">
                                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
                                            <AlertCircle size={16} className="shrink-0" />
                                            <span>تنبيه: البيع الآجل يتطلب اختيار عميل مسجل في النظام.</span>
                                        </div>

                                        {/* Quick Customer Picker in Modal */}
                                        <div className="relative">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={quickCustomerSearch}
                                                    onChange={e => {
                                                        setQuickCustomerSearch(e.target.value)
                                                        setCustomerPickerOpen(true)
                                                    }}
                                                    onFocus={() => setCustomerPickerOpen(true)}
                                                    placeholder="🔍 ابحث عن عميل لاختياره فوراً..."
                                                    className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none"
                                                />
                                            </div>

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
                                    <div className="flex flex-col gap-3">
                                        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <User size={18} className="text-[#24357a]" />
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

                                        {/* Partial Cash payment input for credit */}
                                        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">الدفعة النقدية المقدمة:</span>
                                                <span className="text-[10px] text-slate-400">أي مبلغ يدفعه العميل الآن كاش</span>
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                max={totalAfterDiscount}
                                                step="any"
                                                value={paidAmount}
                                                onChange={e => setPaidAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-28 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 text-sm font-mono font-bold text-emerald-600 outline-none text-left"
                                            />
                                        </div>

                                        {/* Remaining Debt Banner */}
                                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                                                    المتبقي يسجل ديناً على حساب العميل:
                                                </span>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-lg font-mono font-black text-rose-600 dark:text-rose-400">
                                                        {formatCurrency(creditRemainingDebt)}
                                                    </span>
                                                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded shadow-2xs">
                                                        ≈ ${(creditRemainingDebt / (usdExchangeRate || 7.30)).toFixed(2)} USD
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 leading-tight">
                                                🛡️ <strong>حماية تقلبات الصرف:</strong> أصل الدين يُقيد في ذمة العميل بـ <strong>${(creditRemainingDebt / (usdExchangeRate || 7.30)).toFixed(2)} دولار</strong>، ويتم السداد بالدولار أو بما يعادله بالدينار بسعر الصرف المعتمد يوم السداد.
                                            </div>
                                        </div>

                                        {/* Customer Credit Limit Analysis & Warning */}
                                        {customerCreditLimit > 0 && (
                                            <div className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                                                isExceedingCreditLimit 
                                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100' 
                                                    : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                                            }`}>
                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span className="flex items-center gap-1.5">
                                                        <AlertCircle size={14} className={isExceedingCreditLimit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} />
                                                        <span>فحص سقف الائتمان للعميل:</span>
                                                    </span>
                                                    <span className="font-mono bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-current text-[11px]">
                                                        السقف: {formatCurrency(customerCreditLimit)}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                                    <div>
                                                        <span className="opacity-70">الرصيد بعد الفاتورة: </span>
                                                        <span className="font-mono font-bold">{formatCurrency(projectedCustomerBalance)}</span>
                                                    </div>
                                                    <div className="text-left">
                                                        {isExceedingCreditLimit ? (
                                                            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                                                                تجاوز بمقدار: +{formatCurrency(creditExcessAmount)}
                                                            </span>
                                                        ) : (
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                                المتبقي من السقف: {formatCurrency(customerCreditLimit - projectedCustomerBalance)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {isExceedingCreditLimit && (
                                                    <div className="mt-1 pt-2 border-t border-rose-200 dark:border-rose-800/80 flex items-center justify-between gap-2">
                                                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-rose-800 dark:text-rose-200">
                                                            <input
                                                                type="checkbox"
                                                                checked={creditOverrideApproved}
                                                                onChange={e => setCreditOverrideApproved(e.target.checked)}
                                                                className="w-4 h-4 text-rose-600 rounded cursor-pointer accent-rose-600"
                                                            />
                                                            <span>السماح بتجاوز السقف بموافقة المشرف / المسؤول</span>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CASE C: CARD / BANK DETAILS */}
                        {[PAYMENT_METHODS.CARD, PAYMENT_METHODS.BANK].includes(selectedPaymentMethod) && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    حساب الاستلام / جهاز الدفع الإلكتروني:
                                </span>
                                <select
                                    value={selectedTreasury}
                                    onChange={e => setSelectedTreasury(e.target.value)}
                                    className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                                >
                                    {filteredTreasuries.map(t => (
                                        <option key={t._id} value={t._id}>
                                            🏦 {t.name} ({t.type === 'bank' ? 'حساب مصرفي / بطاقات' : 'خزينة'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* CASE D: SPLIT DETAILS */}
                        {selectedPaymentMethod === PAYMENT_METHODS.SPLIT && (
                            <div className="flex flex-col gap-2">
                                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                    <span>تفاصيل الدفعات المجزأة:</span>
                                    <span className="text-xs font-mono font-bold text-amber-600">
                                        المجموع: {formatCurrency(splitPayments.reduce((s, p) => s + Number(p.amount || 0), 0))} / {formatCurrency(totalAfterDiscount)}
                                    </span>
                                </div>

                                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {splitPayments.map((p, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <select
                                                value={p.method}
                                                onChange={e => {
                                                    const updated = [...splitPayments]
                                                    updated[idx].method = e.target.value
                                                    setSplitPayments(updated)
                                                }}
                                                className="h-8 bg-slate-100 dark:bg-slate-800 rounded px-2 text-xs font-bold border-0"
                                            >
                                                <option value={PAYMENT_METHODS.CASH}>كاش</option>
                                                <option value={PAYMENT_METHODS.CARD}>بطاقة</option>
                                                <option value={PAYMENT_METHODS.BANK}>مصرفي</option>
                                            </select>

                                            <input
                                                type="number"
                                                value={p.amount || ''}
                                                onChange={e => {
                                                    const updated = [...splitPayments]
                                                    updated[idx].amount = Number(e.target.value) || 0
                                                    setSplitPayments(updated)
                                                }}
                                                placeholder="المبلغ"
                                                className="flex-1 h-8 bg-slate-50 dark:bg-slate-800 rounded px-2 text-xs font-mono font-bold outline-none text-left"
                                            />

                                            <select
                                                value={p.treasury || ''}
                                                onChange={e => {
                                                    const updated = [...splitPayments]
                                                    updated[idx].treasury = e.target.value
                                                    setSplitPayments(updated)
                                                }}
                                                className="h-8 bg-slate-100 dark:bg-slate-800 rounded px-2 text-xs font-bold border-0 flex-1"
                                            >
                                                <option value="">-- اختر الخزينة --</option>
                                                {treasuries.map(t => (
                                                    <option key={t._id} value={t._id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* CASE E: WALLET DETAILS */}
                        {selectedPaymentMethod === PAYMENT_METHODS.WALLET && (
                            <div className="bg-purple-50 dark:bg-purple-950/30 p-3 rounded-xl border border-purple-200 dark:border-purple-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Wallet size={20} className="text-purple-600" />
                                    <div>
                                        <div className="font-bold text-xs text-purple-900 dark:text-purple-100">
                                            سيتم خصم كامل المبلغ من رصيد المحفظة
                                        </div>
                                        <div className="text-[10px] text-purple-500 font-mono mt-0.5">
                                            الرصيد المتاح: {formatCurrency(customerWalletBalance)}
                                        </div>
                                    </div>
                                </div>
                                <span className="font-mono font-black text-sm text-purple-700 dark:text-purple-300">
                                    -{formatCurrency(totalAfterDiscount)}
                                </span>
                            </div>
                        )}

                        {/* Treasury Dropdown for Cash */}
                        {selectedPaymentMethod === PAYMENT_METHODS.CASH && filteredTreasuries.length > 1 && (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-[11px] font-bold text-slate-500">إيداع النقدية في:</span>
                                <select
                                    value={selectedTreasury}
                                    onChange={e => setSelectedTreasury(e.target.value)}
                                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                                >
                                    {filteredTreasuries.map(t => (
                                        <option key={t._id} value={t._id}>💵 {t.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. Modal Footer Action Buttons */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        إلغاء والرجوع للفاتورة (Esc)
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Save Only Button (F8) */}
                        <button
                            type="button"
                            onClick={() => handleSaveTrigger(false)}
                            disabled={saving || isSaveBlockedByCreditLimit}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 ${
                                isSaveBlockedByCreditLimit 
                                    ? 'bg-slate-400 text-white cursor-not-allowed' 
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title={isSaveBlockedByCreditLimit ? 'ممنوع الحفظ لتجاوز سقف الائتمان - يلزم موافقة المشرف' : 'حفظ وترحيل الفاتورة فقط بدون طباعة (F8)'}
                        >
                            <Save size={15} />
                            <span>حفظ وترحيل (F8)</span>
                        </button>

                        {/* Save and Print Button (F9 / Enter) */}
                        <button
                            type="button"
                            onClick={() => handleSaveTrigger(true)}
                            disabled={saving || isSaveBlockedByCreditLimit}
                            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95 disabled:opacity-50 ring-2 ${
                                isSaveBlockedByCreditLimit 
                                    ? 'bg-slate-400 text-white cursor-not-allowed ring-slate-400/30' 
                                    : 'bg-[#24357a] hover:bg-[#1b285d] text-white ring-[#24357a]/30'
                            }`}
                            title={isSaveBlockedByCreditLimit ? 'ممنوع الحفظ لتجاوز سقف الائتمان - يلزم موافقة المشرف' : 'حفظ وترحيل وطباعة إيصال الفاتورة (Enter / F9)'}
                        >
                            <Printer size={16} />
                            <span className="font-black">
                                {saving ? 'جاري الحفظ والطباعة...' : 'حفظ وطباعة الفاتورة (Enter / F9)'}
                            </span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
