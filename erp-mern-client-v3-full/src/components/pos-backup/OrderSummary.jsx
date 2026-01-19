import React from 'react'
import { motion } from 'framer-motion'
import {
    Banknote,
    CreditCard,
    Landmark,
    Calculator,
    Trash2,
    Save,
    Printer,
    Split
} from 'lucide-react'
import { Input } from '../ui/Input'
import { TreasurySelector } from '../TreasurySelector'
import { formatCurrency } from '../../lib/utils'
import { PAYMENT_METHODS, PAYMENT_METHOD_CONFIG, INVOICE_TYPES } from '../../constants/posConstants'

/**
 * OrderSummary - BlackRock Style Premium Checkout Footer
 * 
 * Features:
 * - Payment method selector
 * - Treasury selection
 * - Paid/Remaining inputs
 * - Premium total display with glassmorphism
 * - Action buttons with animations
 */
export const OrderSummary = ({
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    selectedTreasury,
    setSelectedTreasury,
    treasuryFilter,
    paidAmount,
    setPaidAmount,
    effectivePaidAmount,
    change,
    totalAfterDiscount,
    subtotal,
    globalDiscount,
    setGlobalDiscount,
    cartItems,
    saving,
    handleSaveOrder,
    clearCart,
    invoiceType,
    currency,
    splitPayments,
    setSplitPayments,
    setShowSplitPayment
}) => {
    const paymentMethods = [
        { ...PAYMENT_METHOD_CONFIG[PAYMENT_METHODS.CASH], icon: Banknote },
        { ...PAYMENT_METHOD_CONFIG[PAYMENT_METHODS.CARD], icon: CreditCard },
        { ...PAYMENT_METHOD_CONFIG[PAYMENT_METHODS.BANK], icon: Landmark },
        { ...PAYMENT_METHOD_CONFIG[PAYMENT_METHODS.SPLIT], icon: Calculator },
    ]

    const handlePaymentMethodClick = (method) => {
        setSelectedPaymentMethod(method.id)
        if (method.id === PAYMENT_METHODS.SPLIT) {
            setShowSplitPayment(true)
            setSplitPayments([
                { method: PAYMENT_METHODS.CASH, amount: totalAfterDiscount, treasury: '' },
                { method: PAYMENT_METHODS.CARD, amount: 0, treasury: '' }
            ])
        }
    }

    return (
        <div className={`p-3 bg-white border-t border-slate-100 flex flex-col gap-3 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-10 relative ${invoiceType === INVOICE_TYPES.PROFORMA ? 'border-amber-200 bg-amber-50/50' : ''
            }`}>

            {/* Payment Methods Row */}
            <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400">طريقة الدفع</label>
                <div className="grid grid-cols-4 gap-2">
                    {paymentMethods.map(method => {
                        const Icon = method.icon
                        const isSelected = selectedPaymentMethod === method.id

                        return (
                            <motion.button
                                key={method.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handlePaymentMethodClick(method)}
                                className={`h-10 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${isSelected
                                        ? `border-${method.color}-200 bg-${method.color}-50 text-${method.color}-700 shadow-inner`
                                        : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'
                                    }`}
                            >
                                <Icon size={14} className={isSelected ? `text-${method.color}-600` : "text-slate-400"} />
                                <span className="text-[9px] font-bold">{method.label}</span>
                            </motion.button>
                        )
                    })}
                </div>
            </div>

            {/* Treasury Row */}
            <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                    الخزينة
                    <span className="text-red-500">*</span>
                </label>

                {selectedPaymentMethod === PAYMENT_METHODS.SPLIT ? (
                    <div
                        className="h-10 w-full bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => setShowSplitPayment(true)}
                    >
                        <Split size={14} className="mr-2 text-orange-500" />
                        توزيع الدفعات
                    </div>
                ) : (
                    <TreasurySelector
                        value={selectedTreasury}
                        onChange={setSelectedTreasury}
                        required={true}
                        filterType={treasuryFilter}
                        className="h-10 rounded-xl border-slate-200 shadow-sm"
                        placeholder="اختر الخزينة..."
                    />
                )}
            </div>

            {/* Paid & Remaining Row */}
            <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    <span className="absolute -top-1.5 right-2 bg-white px-1 text-[9px] font-bold text-slate-400 z-10">
                        المدفوع
                    </span>
                    <Input
                        type="number"
                        className="h-11 text-center font-bold text-lg bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-1 focus:ring-primary/20 hover:border-primary/30 transition-all text-emerald-700 font-mono tabular-nums"
                        value={selectedPaymentMethod === PAYMENT_METHODS.SPLIT ? effectivePaidAmount : paidAmount}
                        onChange={e => selectedPaymentMethod !== PAYMENT_METHODS.SPLIT && setPaidAmount(e.target.value)}
                        placeholder="0.00"
                        readOnly={selectedPaymentMethod === PAYMENT_METHODS.SPLIT}
                        onClick={() => selectedPaymentMethod === PAYMENT_METHODS.SPLIT && setShowSplitPayment(true)}
                    />
                </div>
                <div className="relative">
                    <span className="absolute -top-1.5 right-2 bg-white px-1 text-[9px] font-bold text-slate-400 z-10">
                        المتبقي
                    </span>
                    <div className={`h-11 w-full flex items-center justify-center rounded-xl border text-lg font-bold font-mono tabular-nums transition-colors duration-300 ${change < 0
                            ? 'bg-red-50 text-red-500 border-red-200'
                            : 'bg-emerald-50 text-emerald-500 border-emerald-200'
                        }`}>
                        {formatCurrency(change)}
                    </div>
                </div>
            </div>

            {/* PREMIUM TOTAL DISPLAY - BlackRock Style */}
            <div className="bg-slate-900 rounded-2xl p-4 flex justify-between items-center shadow-lg shadow-slate-200 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950" />
                {/* Subtle glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                <div className="relative z-10 flex flex-col items-start gap-1">
                    <span className="text-[11px] font-bold text-slate-400">الإجمالي</span>
                    <span className="text-[9px] text-slate-500 font-medium">شامل الضريبة</span>
                </div>

                <div className="relative z-10 flex items-baseline gap-1" dir="ltr">
                    <span className="text-sm text-slate-500 font-medium">{currency}</span>
                    <span className="text-3xl font-bold text-white tracking-tight font-mono tabular-nums">
                        {totalAfterDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Footer Actions: Discount | Clear | Save | Print */}
            <div className="grid grid-cols-4 gap-2">
                {/* Discount Input */}
                <div className="col-span-1 relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none z-10">
                        <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                    <Input
                        type="number"
                        className="h-12 w-full text-center font-bold text-sm bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all group-hover:border-slate-300 font-mono tabular-nums"
                        value={globalDiscount}
                        onChange={e => setGlobalDiscount(e.target.value)}
                        placeholder="خصم"
                        title="نسبة الخصم"
                    />
                </div>

                {/* Clear Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={clearCart}
                    disabled={saving}
                    className="col-span-1 h-12 rounded-xl text-slate-500 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex items-center justify-center shadow-sm"
                    title="إلغاء الأمر"
                >
                    <Trash2 size={20} />
                </motion.button>

                {/* Save Button */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSaveOrder(false)}
                    disabled={saving || !cartItems.length}
                    className={`col-span-1 h-12 rounded-xl text-white shadow-md flex items-center justify-center transition-all ${invoiceType === INVOICE_TYPES.PROFORMA
                            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                            : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="حفظ فقط"
                >
                    <Save size={20} />
                </motion.button>

                {/* Print Button */}
                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSaveOrder(true)}
                    disabled={saving || !cartItems.length}
                    className={`col-span-1 h-12 rounded-xl text-white shadow-md flex items-center justify-center transition-all ${invoiceType === INVOICE_TYPES.PROFORMA
                            ? 'bg-slate-600 hover:bg-slate-700 shadow-slate-200'
                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="حفظ وطباعة"
                >
                    <Printer size={20} />
                </motion.button>
            </div>
        </div>
    )
}
