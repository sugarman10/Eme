import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ShoppingCart,
    PauseCircle,
    ClipboardList,
    History,
    Trash2,
    CheckCircle2,
    Play
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { CustomerSelector } from './CustomerSelector'
import { CartItem } from './CartItem'
import { OrderSummary } from './OrderSummary'
import { formatCurrency } from '../../lib/utils'
import { INVOICE_TYPES } from '../../constants/posConstants'

/**
 * CartSidebar - Premium Cart Panel with Glassmorphism
 * 
 * Features:
 * - Glassmorphism effect (backdrop-blur)
 * - Invoice type toggle
 * - Cart item list with animations
 * - OrderSummary footer
 * - Held bills quick access
 */
export const CartSidebar = ({
    cartItems,
    invoiceType,
    setInvoiceType,
    handleHoldBill,
    setShowHeldBills,
    heldBills,
    setShowHistory,
    clearCart,
    updateQty,
    removeFromCart,
    restoreHeldBill,
    // Customer props
    customerSearch,
    setCustomerSearch,
    customerId,
    setCustomerId,
    filteredCustomers,
    customers,
    setSalesMode,
    setShowAddCustomer,
    push,
    // OrderSummary props
    ...orderSummaryProps
}) => {
    return (
        <Card className="flex flex-col shadow-2xl border-0 bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden ring-1 ring-slate-200/50 h-full">
            {/* Cart Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-white/50 flex flex-col gap-4 flex-shrink-0">
                <div className="flex justify-between items-center">
                    {/* Left: Title */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-600 rounded-xl text-white shadow-lg shadow-primary/20 flex items-center justify-center">
                            <ShoppingCart size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-800 leading-tight">سلة المبيعات</h2>
                            <p className="text-[10px] font-medium text-slate-400">
                                {cartItems.length} منتجات مضافة
                            </p>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex gap-2">
                        {/* Invoice Type Toggle */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setInvoiceType(prev => prev === INVOICE_TYPES.OFFICIAL ? INVOICE_TYPES.PROFORMA : INVOICE_TYPES.OFFICIAL)}
                            className={`h-9 px-4 rounded-full transition-all duration-300 font-bold text-xs flex items-center gap-2 border shadow-sm ${invoiceType === INVOICE_TYPES.OFFICIAL
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                            title={invoiceType === INVOICE_TYPES.OFFICIAL ? 'تحويل لعرض سعر' : 'تحويل لفاتورة رسمية'}
                        >
                            {invoiceType === INVOICE_TYPES.OFFICIAL ? (
                                <>
                                    <CheckCircle2 size={16} className="text-emerald-600" strokeWidth={2.5} />
                                    <span>رسمية</span>
                                </>
                            ) : (
                                <>
                                    <ClipboardList size={16} className="text-amber-600" strokeWidth={2.5} />
                                    <span>عرض سعر</span>
                                </>
                            )}
                        </motion.button>

                        <div className="w-px h-8 bg-slate-200 my-auto mx-1" />

                        {/* Action Buttons */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleHoldBill}
                            disabled={!cartItems.length}
                            className="h-9 w-9 rounded-full bg-slate-50 border border-slate-100 text-slate-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all duration-300 disabled:opacity-50"
                            title="تعليق الفاتورة"
                        >
                            <PauseCircle size={18} strokeWidth={2} />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowHeldBills(true)}
                            className="h-9 w-9 rounded-full bg-slate-50 border border-slate-100 text-slate-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 relative transition-all duration-300"
                            title="الفواتير المعلقة"
                        >
                            <ClipboardList size={18} strokeWidth={2} />
                            {heldBills.length > 0 && (
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-orange-500 rounded-full ring-2 ring-white animate-pulse" />
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowHistory(true)}
                            className="h-9 w-9 rounded-full bg-slate-50 border border-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-300"
                            title="سجل الفواتير"
                        >
                            <History size={18} strokeWidth={2} />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={clearCart}
                            className="h-9 w-9 rounded-full bg-slate-50 border border-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-300"
                            title="تفريغ السلة"
                        >
                            <Trash2 size={18} strokeWidth={2} />
                        </Button>
                    </div>
                </div>

                {/* Customer Selector */}
                <CustomerSelector
                    customerSearch={customerSearch}
                    setCustomerSearch={setCustomerSearch}
                    customerId={customerId}
                    setCustomerId={setCustomerId}
                    filteredCustomers={filteredCustomers}
                    customers={customers}
                    setSalesMode={setSalesMode}
                    setShowAddCustomer={setShowAddCustomer}
                    push={push}
                />
            </div>

            {/* Cart Items List - Fixed Height with Scroll */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-slate-50/50 custom-scrollbar min-h-0">
                <AnimatePresence mode="popLayout">
                    {cartItems.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60"
                        >
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                <ShoppingCart size={32} className="text-slate-300" />
                            </div>
                            <p className="text-base font-bold text-slate-500">السلة فارغة</p>
                            <p className="text-xs mt-1 text-slate-400">قم بإضافة منتجات للبدء</p>

                            {/* Held Bills Quick Access */}
                            {heldBills.length > 0 && (
                                <div className="mt-8 w-full px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex items-center gap-3 mb-3 justify-center">
                                        <div className="h-px bg-slate-200 flex-1" />
                                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-100 shadow-sm">
                                            {heldBills.length} فواتير معلقة
                                        </span>
                                        <div className="h-px bg-slate-200 flex-1" />
                                    </div>
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                        {heldBills.map(bill => (
                                            <div
                                                key={bill.id}
                                                className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center hover:border-orange-300 hover:shadow-md cursor-pointer transition-all group relative overflow-hidden"
                                                onClick={() => restoreHeldBill(bill)}
                                            >
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xs border border-orange-100">
                                                        {bill.items.length}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {bill.customer?.name || 'عميل عابر'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 tabular-nums">
                                                            {formatCurrency(bill.total)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-6 h-6 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                    <Play size={12} fill="currentColor" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        cartItems.map(item => (
                            <CartItem
                                key={item.id}
                                item={item}
                                onUpdateQty={updateQty}
                                onRemove={removeFromCart}
                            />
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Order Summary Footer */}
            <OrderSummary {...orderSummaryProps} cartItems={cartItems} invoiceType={invoiceType} />
        </Card>
    )
}
