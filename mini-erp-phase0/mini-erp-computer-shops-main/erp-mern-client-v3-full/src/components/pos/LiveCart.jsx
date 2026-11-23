import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    PackageOpen,
    FileText,
    Tag,
    AlertCircle
} from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { OrderSummary } from './OrderSummary'
import { INVOICE_TYPES } from '../../constants/posConstants'

/**
 * LiveCart - Interactive Cashier Cart Panel for Modern Split View
 * 
 * Features:
 * - Real-time animated item list
 * - Smooth quantity steppers (+ / -)
 * - Quick item removal with tactile feedback
 * - Proforma indicator badge
 * - Integrated OrderSummary checkout station
 */
export const LiveCart = ({
    cartItems = [],
    updateQty,
    removeFromCart,
    clearCart,
    invoiceType,
    currency,
    // OrderSummary props
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
    saving,
    handleSaveOrder,
    saveProforma,
    splitPayments,
    setSplitPayments,
    setShowSplitPayment,
    customerWalletBalance,
    walletAmountToUse,
    applyWalletCredit,
    clearWalletUsage,
    customerId
}) => {
    const isProforma = invoiceType === INVOICE_TYPES.PROFORMA
    const totalItemsCount = cartItems.reduce((acc, item) => acc + (item.qty || 1), 0)

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-md overflow-hidden transition-colors">
            {/* 1. Header */}
            <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b select-none transition-colors bg-slate-50/80 dark:bg-slate-850 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs bg-primary-600">
                        <ShoppingCart size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h2 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                                فاتورة المبيعات
                            </h2>
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold font-mono bg-primary-100 dark:bg-primary-950/80 text-primary-700 dark:text-primary-300">
                                {totalItemsCount} قطعة
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-400">
                            {cartItems.length} أصناف فريدة
                        </p>
                    </div>
                </div>

                {cartItems.length > 0 && (
                    <button
                        type="button"
                        onClick={clearCart}
                        disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                        title="مسح جميع الأصناف من السلة"
                    >
                        <Trash2 size={13} />
                        <span>إفراغ</span>
                    </button>
                )}
            </div>

            {/* 2. Cart Items Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 custom-scrollbar min-h-0 bg-slate-50/50 dark:bg-slate-950/40">
                {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 select-none min-h-[220px]">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                            <PackageOpen size={32} className="text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
                            السلة فارغة حالياً
                        </h3>
                        <p className="text-[11px] text-slate-400 max-w-[200px] leading-relaxed">
                            انقر على أي صنف من الكتالوج أو امسح الباركود لإضافته فوراً
                        </p>
                    </div>
                ) : (
                    <AnimatePresence initial={false} mode="popLayout">
                        {cartItems.map((item, index) => {
                            const lineTotal = (item.price || 0) * (item.qty || 1)
                            return (
                                <motion.div
                                    key={item.id || item._id || index}
                                    layout
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.15 }}
                                    className="group bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-2.5 shadow-xs hover:shadow-sm transition-all"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        {/* Product Title & Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-4 h-4 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                                    {index + 1}
                                                </span>
                                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title={item.name}>
                                                    {item.name}
                                                </h4>
                                            </div>

                                            <div className="flex items-center gap-2 mt-1 mr-5">
                                                <span className="text-[10px] font-mono text-slate-400">
                                                    {item.sku || item.barcode || 'بدون كود'}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                                    × {formatCurrency(item.price)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Line Total & Remove Button */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                                {formatCurrency(lineTotal)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeFromCart(item.id || item._id)}
                                                className="w-6 h-6 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center justify-center transition-colors"
                                                title="حذف من السلة"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stepper Quantity Controls */}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                        <div className="text-[10px] text-slate-400">
                                            الكمية المطلوبة:
                                        </div>

                                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/60 p-0.5 rounded-lg border border-slate-200/70 dark:border-slate-600">
                                            <button
                                                type="button"
                                                onClick={() => updateQty(item.id || item._id, (item.qty || 1) - 1)}
                                                disabled={item.qty <= 1}
                                                className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors"
                                                title="إنقاص الكمية"
                                            >
                                                <Minus size={11} strokeWidth={2.5} />
                                            </button>

                                            <input
                                                type="number"
                                                value={item.qty || 1}
                                                onChange={(e) => updateQty(item.id || item._id, Math.max(1, parseInt(e.target.value) || 1))}
                                                className="w-12 h-6 text-center text-xs font-black font-mono text-slate-800 dark:text-slate-100 bg-transparent border-0 focus:ring-0 p-0 outline-none"
                                                min="1"
                                            />

                                            <button
                                                type="button"
                                                onClick={() => updateQty(item.id || item._id, (item.qty || 1) + 1)}
                                                className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center shadow-xs transition-colors"
                                                title="زيادة الكمية"
                                            >
                                                <Plus size={11} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* 3. Order Summary & Payment Dock */}
            <div className="shrink-0">
                <OrderSummary
                    selectedPaymentMethod={selectedPaymentMethod}
                    setSelectedPaymentMethod={setSelectedPaymentMethod}
                    selectedTreasury={selectedTreasury}
                    setSelectedTreasury={setSelectedTreasury}
                    treasuryFilter={treasuryFilter}
                    paidAmount={paidAmount}
                    setPaidAmount={setPaidAmount}
                    effectivePaidAmount={effectivePaidAmount}
                    change={change}
                    totalAfterDiscount={totalAfterDiscount}
                    subtotal={subtotal}
                    globalDiscount={globalDiscount}
                    setGlobalDiscount={setGlobalDiscount}
                    cartItems={cartItems}
                    saving={saving}
                    handleSaveOrder={handleSaveOrder}
                    saveProforma={saveProforma}
                    clearCart={clearCart}
                    invoiceType={invoiceType}
                    currency={currency}
                    splitPayments={splitPayments}
                    setSplitPayments={setSplitPayments}
                    setShowSplitPayment={setShowSplitPayment}
                    customerWalletBalance={customerWalletBalance}
                    walletAmountToUse={walletAmountToUse}
                    applyWalletCredit={applyWalletCredit}
                    clearWalletUsage={clearWalletUsage}
                    customerId={customerId}
                />
            </div>
        </div>
    )
}
