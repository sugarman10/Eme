import React from 'react'
import { motion } from 'framer-motion'
import {
    FileText,
    History,
    Archive,
    Package,
    ToggleLeft
} from 'lucide-react'
import { SpreadsheetCart } from './SpreadsheetCart'
import { CustomerSelector } from './CustomerSelector'
import { OrderSummary } from './OrderSummary'
import { INVOICE_TYPES } from '../../constants/posConstants'

/**
 * CartSidebar V4 - Spreadsheet Edition
 * 
 * Features:
 * - Excel/Spreadsheet style cart table
 * - Type code directly in empty rows
 * - Fixed visible rows like a ledger
 */
export const CartSidebar = ({
    cartItems,
    products,
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
    addToCartBySku,
    addToCart,
    updateItemDiscount,
    // Customer props
    customerSearch,
    setCustomerSearch,
    filteredCustomers,
    customerId,
    setCustomerId,
    customers,
    setShowAddCustomer,
    salesMode,
    setSalesMode,
    // Summary props
    subtotal,
    totalAfterDiscount,
    globalDiscount,
    setGlobalDiscount,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    selectedTreasury,
    setSelectedTreasury,
    treasuryFilter,
    paidAmount,
    setPaidAmount,
    effectivePaidAmount,
    change,
    saving,
    handleSaveOrder,
    currency,
    splitPayments,
    setSplitPayments,
    setShowSplitPayment,
    // Wallet props
    customerWalletBalance,
    walletAmountToUse,
    setWalletAmountToUse,
    applyWalletCredit,
    clearWalletUsage
}) => {
    const isProforma = invoiceType === INVOICE_TYPES.PROFORMA

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">

            {/* === HEADER - Compact toolbar === */}
            <div className="shrink-0 p-2 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                    {/* Action Buttons */}
                    <button
                        onClick={handleHoldBill}
                        disabled={!cartItems.length}
                        className="h-9 w-9 shrink-0 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-lg flex items-center justify-center text-slate-600 transition-all disabled:opacity-50"
                        title="تعليق"
                    >
                        <Archive size={16} />
                    </button>

                    <button
                        onClick={() => setShowHeldBills(true)}
                        className="relative h-9 w-9 shrink-0 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-400 rounded-lg flex items-center justify-center text-slate-600 transition-all"
                        title="معلقة"
                    >
                        <Package size={16} />
                        {heldBills.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-white">
                                {heldBills.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setShowHistory(true)}
                        className="h-9 w-9 shrink-0 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-400 rounded-lg flex items-center justify-center text-slate-600 transition-all"
                        title="سجل"
                    >
                        <History size={16} />
                    </button>

                    {/* Customer Selector */}
                    <CustomerSelector
                        customerSearch={customerSearch}
                        setCustomerSearch={setCustomerSearch}
                        filteredCustomers={filteredCustomers}
                        customerId={customerId}
                        setCustomerId={setCustomerId}
                        customers={customers}
                        setShowAddCustomer={setShowAddCustomer}
                        salesMode={salesMode}
                        setSalesMode={setSalesMode}
                    />
                </div>
            </div>

            {/* === SPREADSHEET CART - Excel Style === */}
            <div className="flex-1 overflow-hidden p-2">
                <SpreadsheetCart
                    cartItems={cartItems}
                    products={products}
                    addToCartBySku={addToCartBySku}
                    addToCart={addToCart}
                    updateQty={updateQty}
                    updateItemDiscount={updateItemDiscount}
                    removeFromCart={removeFromCart}
                    subtotal={subtotal}
                    currency={currency}
                />
            </div>

            {/* === FOOTER - ORDER SUMMARY === */}
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
                    clearCart={clearCart}
                    invoiceType={invoiceType}
                    currency={currency}
                    splitPayments={splitPayments}
                    setSplitPayments={setSplitPayments}
                    setShowSplitPayment={setShowSplitPayment}
                    // Wallet
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
