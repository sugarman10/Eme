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
    Wallet,
    FileText
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
    saveProforma, // New Prop
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
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 shadow-lg transition-colors">

            {/* === WALLET SECTION (Only show if customer has wallet balance) === */}
            {customerId && hasWalletCredit && (
                <div className="bg-purple-50 dark:bg-purple-950/40 rounded-xl p-2.5 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shadow-xs">
                                <Wallet size={16} className="text-white" />
                            </div>
                            <div>
                                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">رصيد المحفظة</div>
                                <div className="text-xs sm:text-sm font-black text-purple-700 dark:text-purple-300 font-mono">
                                    {customerWalletBalance.toLocaleString()} {currency}
                                </div>
                            </div>
                        </div>

                        {isUsingWallet ? (
                            <button
                                type="button"
                                onClick={clearWalletUsage}
                                className="h-8 px-3 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-bold transition-colors"
                            >
                                إلغاء ✕
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={applyWalletCredit}
                                className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                            >
                                <Wallet size={12} />
                                تطبيق
                            </button>
                        )}
                    </div>

                    {/* Show breakdown if using wallet */}
                    {isUsingWallet && (
                        <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800/60 grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between bg-white/70 dark:bg-slate-800 rounded-lg px-2 py-1.5">
                                <span className="text-purple-600 dark:text-purple-400">من المحفظة:</span>
                                <span className="font-bold text-purple-700 dark:text-purple-300 font-mono">-{walletAmountToUse.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between bg-white/70 dark:bg-slate-800 rounded-lg px-2 py-1.5">
                                <span className="text-slate-600 dark:text-slate-300">المتبقي:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{remainingAfterWallet.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* === 3 EQUAL CARDS: Total + Discount + Treasury === */}
            <div className="grid grid-cols-3 gap-2">
                {/* Card 1: Total */}
                <div className="bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-600 rounded-xl p-2.5 text-center shadow-md shadow-emerald-600/10 h-16 flex flex-col justify-center select-none text-white">
                    <div className="text-[10px] text-emerald-100 font-bold">
                        {isUsingWallet ? 'المتبقي للدفع' : 'الإجمالي النهائي'}
                    </div>
                    <motion.div
                        key={isUsingWallet ? remainingAfterWallet : totalAfterDiscount}
                        initial={{ scale: 1.05 }}
                        animate={{ scale: 1 }}
                        className="text-base sm:text-lg font-black font-mono tracking-tight"
                        dir="ltr"
                    >
                        {(isUsingWallet ? remainingAfterWallet : totalAfterDiscount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-sans font-normal">{currency}</span>
                    </motion.div>
                </div>

                {/* Card 2: Discount */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2 text-center border border-slate-200 dark:border-slate-700 shadow-xs h-16 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center gap-1">
                        <Percent size={11} className="text-amber-500" />
                        الخصم
                    </div>
                    <input
                        type="number"
                        className="w-full text-center text-sm sm:text-base font-black font-mono border-0 focus:ring-0 p-0 bg-transparent text-amber-600 dark:text-amber-400 outline-none"
                        value={globalDiscount}
                        onChange={e => setGlobalDiscount(e.target.value)}
                        placeholder="0"
                    />
                </div>

                {/* Card 3: Treasury */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2 text-center border border-slate-200 dark:border-slate-700 shadow-xs h-16 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-0.5">الخزينة</div>
                    {selectedPaymentMethod === PAYMENT_METHODS.SPLIT ? (
                        <button
                            type="button"
                            className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                            onClick={() => setShowSplitPayment(true)}
                        >
                            توزيع الدفع ⚙️
                        </button>
                    ) : (
                        <TreasurySelector
                            value={selectedTreasury}
                            onChange={setSelectedTreasury}
                            required={true}
                            filterType={treasuryFilter}
                            className="[&>button]:h-6 [&>button]:py-0 [&>button]:px-1 [&>button]:text-xs [&>button]:border-0 [&>button]:bg-transparent [&>button>svg]:hidden"
                            placeholder="اختر خزينة"
                        />
                    )}
                </div>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-4 gap-1.5">
                {paymentMethods.map(method => {
                    const Icon = method.icon
                    const isSelected = selectedPaymentMethod === method.id

                    return (
                        <button
                            key={method.id}
                            type="button"
                            onClick={() => handlePaymentMethodClick(method)}
                            className={`h-9 sm:h-10 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer select-none ${isSelected
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 shadow-xs'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            <Icon size={14} className={isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'} />
                            <span>{method.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-6 gap-2">
                {/* Clear Cart */}
                <button
                    type="button"
                    onClick={clearCart}
                    disabled={saving || !cartItems.length}
                    className="col-span-1 h-13 sm:h-14 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 text-slate-500 dark:text-slate-400 hover:text-rose-600 transition-all flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                    title="مسح السلة بالكامل"
                >
                    <Trash2 size={17} />
                    <span className="text-[10px] font-bold">مسح</span>
                </button>

                {/* Save without print */}
                <button
                    type="button"
                    onClick={() => handleSaveOrder(false)}
                    disabled={saving || !cartItems.length}
                    className="col-span-2 h-13 sm:h-14 rounded-xl text-white flex flex-col items-center justify-center gap-0.5 font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed select-none bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                    <Save size={17} />
                    <span className="text-xs">حفظ بدون طباعة</span>
                </button>

                {/* PAY BUTTON - GIANT (F9) */}
                <button
                    type="button"
                    onClick={() => handleSaveOrder(true)}
                    disabled={saving || !cartItems.length}
                    className="col-span-3 h-13 sm:h-14 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white flex items-center justify-between px-4 sm:px-5 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed group select-none"
                >
                    <div className="flex flex-col items-start text-right">
                        <span className="text-[11px] font-bold text-emerald-100 flex items-center gap-1">
                            <span>دفع وطباعة</span>
                            <kbd className="text-[9px] px-1 bg-white/20 rounded font-mono">F9</kbd>
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-base sm:text-lg font-black font-mono tracking-tight leading-none">
                                {formatCurrency(isUsingWallet ? remainingAfterWallet : totalAfterDiscount)}
                            </span>
                            {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        </div>
                    </div>
                    <Printer size={24} className="text-emerald-100 group-hover:text-white group-hover:scale-110 transition-all shrink-0" />
                </button>
            </div>
        </div>
    )
}
