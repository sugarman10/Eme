import React from 'react'
import { motion } from 'framer-motion'
import {
    Banknote,
    CreditCard,
    Landmark,
    Wallet,
    Percent,
    Save,
    Printer,
    Trash2,
    DollarSign,
    FileText
} from 'lucide-react'
import { TreasurySelector } from '../TreasurySelector'
import { formatCurrency } from '../../lib/utils'
import { PAYMENT_METHODS, PAYMENT_METHOD_CONFIG, INVOICE_TYPES } from '../../constants/posConstants'

/**
 * PosFooter - Purple Payment Bar (Inspired by reference image)
 * 
 * Features:
 * - Large total display on right
 * - Payment method buttons in center
 * - Action buttons on left
 * - Purple gradient background
 */
export const PosFooter = ({
    totalAfterDiscount,
    subtotal,
    globalDiscount,
    setGlobalDiscount,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    selectedTreasury,
    setSelectedTreasury,
    treasuryFilter,
    cartItems,
    saving,
    handleSaveOrder,
    clearCart,
    invoiceType,
    currency,
    setShowSplitPayment,
    setSplitPayments
}) => {
    const paymentMethods = [
        { id: PAYMENT_METHODS.CASH, label: 'نقدي', icon: Banknote },
        { id: PAYMENT_METHODS.CARD, label: 'بطاقة', icon: CreditCard },
        { id: PAYMENT_METHODS.BANK, label: 'حوالة', icon: Landmark },
        { id: PAYMENT_METHODS.WALLET, label: 'محفظة', icon: Wallet },
        { id: PAYMENT_METHODS.SPLIT, label: 'مختلط', icon: FileText }, // Assuming Split icon/label needs separation
    ]

    const handlePaymentClick = (methodId) => {
        setSelectedPaymentMethod(methodId)
        if (methodId === PAYMENT_METHODS.SPLIT) {
            setShowSplitPayment(true)
            setSplitPayments([
                { method: PAYMENT_METHODS.CASH, amount: totalAfterDiscount, treasury: '' },
                { method: PAYMENT_METHODS.CARD, amount: 0, treasury: '' }
            ])
        }
    }

    return (
        <div className="h-[140px] bg-gradient-to-r from-violet-700 via-violet-600 to-purple-600 shrink-0 relative overflow-hidden">
            {/* Glow effects */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-32 -translate-y-32" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-x-24 translate-y-24" />

            <div className="relative z-10 h-full px-6 py-4 flex items-center gap-6">

                {/* LEFT: Total Display */}
                <div className="w-64 shrink-0">
                    <div className="text-white/90 text-xs font-bold uppercase tracking-wider mb-1">
                        الإجمالي
                    </div>
                    <motion.div
                        key={totalAfterDiscount}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        className="text-white text-4xl font-black font-mono"
                        dir="ltr"
                    >
                        {totalAfterDiscount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currency}
                    </motion.div>
                </div>

                {/* CENTER: Payment Methods & Actions */}
                <div className="flex-1 flex flex-col gap-3">
                    {/* Payment Methods Row */}
                    <div className="flex items-center gap-2">
                        {paymentMethods.map(method => {
                            const Icon = method.icon
                            const isSelected = selectedPaymentMethod === method.id

                            return (
                                <button
                                    key={method.id}
                                    onClick={() => handlePaymentClick(method.id)}
                                    className={`flex-1 h-12 rounded-lg flex items-center justify-center gap-2 font-bold text-sm transition-all ${isSelected
                                        ? 'bg-white text-violet-700 shadow-lg'
                                        : 'bg-white/20 text-white hover:bg-white/30'
                                        }`}
                                >
                                    <Icon size={18} />
                                    {method.label}
                                </button>
                            )
                        })}

                        {/* Discount Button */}
                        <button
                            onClick={() => {
                                const discount = prompt('أدخل الخصم:', globalDiscount || '0')
                                if (discount !== null) setGlobalDiscount(discount)
                            }}
                            className="h-12 px-4 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-all flex items-center gap-2 font-bold text-sm"
                        >
                            <Percent size={18} />
                            خصم
                            {globalDiscount > 0 && <span className="text-xs">({globalDiscount})</span>}
                        </button>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2">
                        {/* Save Button - Green */}
                        <button
                            onClick={() => handleSaveOrder(false)}
                            disabled={saving || !cartItems.length}
                            className="flex-1 h-12 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            <Save size={18} />
                            حفظ
                        </button>

                        {/* Print Button - White */}
                        <button
                            onClick={() => handleSaveOrder(true)}
                            disabled={saving || !cartItems.length}
                            className="flex-1 h-12 rounded-lg bg-white text-violet-700 hover:bg-white/90 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            <Printer size={18} />
                            طباعة
                        </button>

                        {/* Delete Button - Pink */}
                        <button
                            onClick={clearCart}
                            disabled={saving || !cartItems.length}
                            className="h-12 px-4 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            <Trash2 size={18} />
                            حذف
                        </button>

                        {/* Pay Button - Outline */}
                        <button
                            onClick={() => handleSaveOrder(false)}
                            disabled={saving || !cartItems.length}
                            className="flex-1 h-12 rounded-lg border-2 border-white text-white hover:bg-white hover:text-violet-700 font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <DollarSign size={18} />
                            الدفع
                        </button>
                    </div>
                </div>

                {/* RIGHT: Treasury Selector */}
                <div className="w-48 shrink-0">
                    <TreasurySelector
                        value={selectedTreasury}
                        onChange={setSelectedTreasury}
                        required={true}
                        filterType={treasuryFilter}
                        className="h-12 bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-lg"
                        placeholder="اختر الخزينة"
                    />
                </div>
            </div>
        </div>
    )
}
