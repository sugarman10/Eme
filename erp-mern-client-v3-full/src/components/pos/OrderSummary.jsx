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
    Percent,
    Wallet
} from 'lucide-react'
import { TreasurySelector } from '../TreasurySelector'
import { formatCurrency } from '../../lib/utils'
import { PAYMENT_METHODS, PAYMENT_METHOD_CONFIG, INVOICE_TYPES } from '../../constants/posConstants'

/**
 * OrderSummary V4 - With Wallet Support
 * 
 * Features:
 * - Wallet balance display when customer has credit
 * - Apply wallet button
 * - Split payment display (wallet + remaining)
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
    setShowSplitPayment,
    // Wallet Props
    customerWalletBalance = 0,
    walletAmountToUse = 0,
    applyWalletCredit,
    clearWalletUsage,
    customerId
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

    // Calculate remaining after wallet
    const remainingAfterWallet = Math.max(0, totalAfterDiscount - walletAmountToUse)
    const hasWalletCredit = customerWalletBalance > 0
    const isUsingWallet = walletAmountToUse > 0

    return (
        <div className={`p-3 bg-linear-to-br from-slate-50 to-white border-t-2 flex flex-col gap-2.5 shadow-xl ${invoiceType === INVOICE_TYPES.PROFORMA ? 'border-amber-300 bg-amber-50/20' : 'border-indigo-200'
            }`}>

            {/* === WALLET SECTION (Only show if customer has wallet balance) === */}
            {customerId && hasWalletCredit && (
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-2.5 border border-purple-200">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                                <Wallet size={16} className="text-white" />
                            </div>
                            <div>
                                <div className="text-[10px] text-purple-600 font-medium">رصيد المحفظة</div>
                                <div className="text-sm font-bold text-purple-700 font-mono">
                                    {customerWalletBalance.toLocaleString()} {currency}
                                </div>
                            </div>
                        </div>

                        {isUsingWallet ? (
                            <button
                                onClick={clearWalletUsage}
                                className="h-8 px-3 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold transition-colors"
                            >
                                إلغاء ✕
                            </button>
                        ) : (
                            <button
                                onClick={applyWalletCredit}
                                className="h-8 px-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold transition-colors flex items-center gap-1"
                            >
                                <Wallet size={12} />
                                تطبيق
                            </button>
                        )}
                    </div>

                    {/* Show breakdown if using wallet */}
                    {isUsingWallet && (
                        <div className="mt-2 pt-2 border-t border-purple-200 grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between bg-white/60 rounded-lg px-2 py-1.5">
                                <span className="text-purple-600">من المحفظة:</span>
                                <span className="font-bold text-purple-700 font-mono">-{walletAmountToUse.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between bg-white/60 rounded-lg px-2 py-1.5">
                                <span className="text-slate-600">المتبقي:</span>
                                <span className="font-bold text-emerald-600 font-mono">{remainingAfterWallet.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* === 3 EQUAL CARDS: Total + Discount + Treasury === */}
            <div className="grid grid-cols-3 gap-2">
                {/* Card 1: Total */}
                <div className="bg-linear-to-br from-indigo-500 to-indigo-600 rounded-xl p-3 text-center shadow-lg shadow-indigo-200 h-16 flex flex-col justify-center">
                    <div className="text-[10px] text-indigo-200 font-semibold">
                        {isUsingWallet ? 'المتبقي' : 'الإجمالي'}
                    </div>
                    <motion.div
                        key={isUsingWallet ? remainingAfterWallet : totalAfterDiscount}
                        initial={{ scale: 1.1 }}
                        animate={{ scale: 1 }}
                        className="text-base font-black text-white font-mono"
                        dir="ltr"
                    >
                        {(isUsingWallet ? remainingAfterWallet : totalAfterDiscount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.div>
                </div>

                {/* Card 2: Discount */}
                <div className="bg-white rounded-xl p-3 text-center border border-slate-200 shadow-sm h-16 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-center gap-1">
                        <Percent size={10} className="text-amber-500" />
                        خصم
                    </div>
                    <input
                        type="number"
                        className="w-full text-center text-base font-bold font-mono border-0 focus:ring-0 p-0 bg-transparent text-amber-600"
                        value={globalDiscount}
                        onChange={e => setGlobalDiscount(e.target.value)}
                        placeholder="0"
                    />
                </div>

                {/* Card 3: Treasury - Simple with name display */}
                <div className="bg-white rounded-xl p-2 text-center border border-slate-200 shadow-sm h-16 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 font-semibold">الخزينة</div>
                    {selectedPaymentMethod === PAYMENT_METHODS.SPLIT ? (
                        <button
                            className="text-xs font-bold text-orange-600 hover:text-orange-700"
                            onClick={() => setShowSplitPayment(true)}
                        >
                            مختلط ⚙️
                        </button>
                    ) : (
                        <TreasurySelector
                            value={selectedTreasury}
                            onChange={setSelectedTreasury}
                            required={true}
                            filterType={treasuryFilter}
                            className="[&>button]:h-7 [&>button]:py-0 [&>button]:px-1 [&>button]:text-xs [&>button]:border-0 [&>button]:bg-transparent [&>button>svg]:hidden"
                            placeholder="اختر"
                        />
                    )}
                </div>
            </div>

            {/* Payment Methods - Compact */}
            <div className="grid grid-cols-4 gap-1.5">
                {paymentMethods.map(method => {
                    const Icon = method.icon
                    const isSelected = selectedPaymentMethod === method.id

                    return (
                        <button
                            key={method.id}
                            onClick={() => handlePaymentMethodClick(method)}
                            className={`h-10 rounded-lg border flex flex-col items-center justify-center gap-0.5 text-[9px] font-bold transition-all ${isSelected
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <Icon size={14} strokeWidth={2} />
                            {method.label}
                        </button>
                    )
                })}
            </div>

            {/* Paid & Change - POS = Full Payment Only */}
            <div className="grid grid-cols-2 gap-2">
                <div className="h-10 flex items-center justify-center rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-700 font-bold font-mono text-base">
                    {formatCurrency(isUsingWallet ? remainingAfterWallet : totalAfterDiscount)}
                </div>
                <div className="h-10 flex items-center justify-center rounded-lg bg-slate-100 border border-slate-300 text-xs text-slate-500">
                    {isUsingWallet ? `✓ محفظة: ${walletAmountToUse}` : '✓ دفع كامل'}
                </div>
            </div>

            {/* Action Buttons - Compact */}
            <div className="grid grid-cols-4 gap-1.5">
                <button
                    onClick={clearCart}
                    disabled={saving || !cartItems.length}
                    className="h-11 rounded-lg bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center disabled:opacity-50"
                >
                    <Trash2 size={18} />
                </button>
                <button
                    onClick={() => handleSaveOrder(false)}
                    disabled={saving || !cartItems.length}
                    className={`col-span-2 h-11 rounded-lg text-white flex items-center justify-center gap-1.5 font-bold text-xs ${invoiceType === INVOICE_TYPES.PROFORMA
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-emerald-500 hover:bg-emerald-600'
                        } disabled:opacity-50`}
                >
                    <Save size={16} />
                    {saving ? 'حفظ...' : 'حفظ'}
                </button>
                <button
                    onClick={() => handleSaveOrder(true)}
                    disabled={saving || !cartItems.length}
                    className="h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-50"
                >
                    <Printer size={18} />
                </button>
            </div>
        </div>
    )
}
