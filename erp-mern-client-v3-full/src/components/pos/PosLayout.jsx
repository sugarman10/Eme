import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Grid3x3, X, Plus, Minus, Trash2, Image as ImageIcon,
    ShoppingCart, Package, History, Archive, Save, Printer,
    User, ChevronDown
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { ProductGrid } from './ProductGrid'
import { SpreadsheetCart } from './SpreadsheetCart'
import { AddCustomerModal } from './modals/AddCustomerModal'
import { HeldBillsModal } from './modals/HeldBillsModal'
import { SplitPaymentModal } from './modals/SplitPaymentModal'
import { HistoryModal } from './modals/HistoryModal'
import { InvoicePrintTemplate } from './InvoicePrintTemplate'
import { OrderSummary } from './OrderSummary'
import { CustomerSelector } from './CustomerSelector'
import { usePos } from '../../hooks/usePos'
import { KEYBOARD_SHORTCUTS, INVOICE_TYPES } from '../../constants/posConstants'
import { formatCurrency } from '../../lib/utils'

/**
 * PosLayout V4 - Hybrid Mode Edition
 * 
 * Layout: Cart-focused main view + Product Browser overlay
 * - Main: Quick search + Cart table + Payment footer
 * - Overlay: Product grid with categories (triggered by button)
 */
export const PosLayout = () => {
    const pos = usePos()
    const [isBrowserOpen, setIsBrowserOpen] = useState(false)
    const [quickSearch, setQuickSearch] = useState('')
    const searchInputRef = useRef(null)

    // Filter products for quick search dropdown
    const quickSearchResults = quickSearch.length >= 2
        ? pos.products.filter(p =>
            p.name.toLowerCase().includes(quickSearch.toLowerCase()) ||
            p.sku?.toLowerCase().includes(quickSearch.toLowerCase())
        ).slice(0, 8)
        : []

    // Add product and close browser overlay
    const handleBrowserProductClick = (product) => {
        pos.addToCart(product)
        setIsBrowserOpen(false)
    }

    // Quick add from search dropdown
    const handleQuickAdd = (product) => {
        pos.addToCart(product)
        setQuickSearch('')
        searchInputRef.current?.focus()
    }

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isModalOpen = pos.showAddCustomer || pos.showHeldBills ||
                pos.showSplitPayment || pos.showHistory || isBrowserOpen

            if (e.key === KEYBOARD_SHORTCUTS.SAVE && !isModalOpen) {
                e.preventDefault()
                if (pos.cartItems.length > 0) pos.handleSaveOrder(true)
            }
            if (e.key === KEYBOARD_SHORTCUTS.CLEAR && !isModalOpen) {
                e.preventDefault()
                pos.clearCart()
            }
            if (e.key === 'Escape' && isBrowserOpen) {
                setIsBrowserOpen(false)
            }
            // Focus search on / key
            if (e.key === '/' && !isModalOpen) {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [pos, isBrowserOpen])

    return (
        <>
            {/* Main Layout - Cart Focused */}
            <div className="h-screen w-full bg-slate-100 overflow-hidden flex flex-col relative">

                {/* === TOP BAR === */}
                <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 p-4">

                        {/* Quick Search Combobox */}
                        <div className="relative flex-1 max-w-xl">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={quickSearch}
                                onChange={(e) => setQuickSearch(e.target.value)}
                                placeholder="بحث سريع بالاسم أو الكود... (اضغط /)"
                                className="w-full h-12 pr-12 pl-4 text-base border-2 border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                            />

                            {/* Quick Search Dropdown */}
                            {quickSearchResults.length > 0 && (
                                <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
                                    {quickSearchResults.map(product => {
                                        const price = pos.salesMode === 'wholesale' ? product.wholesalePrice : product.price
                                        return (
                                            <button
                                                key={product.id}
                                                onClick={() => handleQuickAdd(product)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-indigo-50 transition-colors text-right border-b border-slate-100 last:border-0"
                                            >
                                                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                                    {product.image ? (
                                                        <img src={pos.getImageUrl(product.image)} alt="" className="w-full h-full object-cover rounded-lg" />
                                                    ) : (
                                                        <Package size={20} className="text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-slate-800 truncate">{product.name}</div>
                                                    <div className="text-xs text-slate-500">{product.sku || 'بدون كود'}</div>
                                                </div>
                                                <div className="text-left shrink-0">
                                                    <div className="font-bold text-indigo-600 font-mono">{formatCurrency(price)}</div>
                                                    <div className="text-xs text-slate-500">المخزون: {product.stock || 0}</div>
                                                </div>
                                                <Plus size={20} className="text-indigo-500 shrink-0" />
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Browse Products Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsBrowserOpen(true)}
                            className="h-12 px-6 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all"
                        >
                            <ImageIcon size={20} />
                            تصفح المنتجات
                        </motion.button>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={pos.handleHoldBill}
                                disabled={!pos.cartItems.length}
                                className="h-12 w-12 bg-white border border-slate-200 hover:bg-amber-50 hover:border-amber-300 rounded-xl flex items-center justify-center text-slate-600 hover:text-amber-600 transition-all disabled:opacity-50"
                                title="تعليق الفاتورة"
                            >
                                <Archive size={20} />
                            </button>
                            <button
                                onClick={() => pos.setShowHeldBills(true)}
                                className="relative h-12 w-12 bg-white border border-slate-200 hover:bg-orange-50 hover:border-orange-300 rounded-xl flex items-center justify-center text-slate-600 hover:text-orange-600 transition-all"
                                title="الفواتير المعلقة"
                            >
                                <Package size={20} />
                                {pos.heldBills.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
                                        {pos.heldBills.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => pos.setShowHistory(true)}
                                className="h-12 w-12 bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-300 rounded-xl flex items-center justify-center text-slate-600 hover:text-blue-600 transition-all"
                                title="سجل المبيعات"
                            >
                                <History size={20} />
                            </button>
                        </div>

                        {/* Customer Selector */}
                        <div className="w-64 shrink-0">
                            <CustomerSelector
                                customerSearch={pos.customerSearch}
                                setCustomerSearch={pos.setCustomerSearch}
                                filteredCustomers={pos.filteredCustomers}
                                customerId={pos.customerId}
                                setCustomerId={pos.setCustomerId}
                                customers={pos.customers}
                                setShowAddCustomer={pos.setShowAddCustomer}
                                salesMode={pos.salesMode}
                                setSalesMode={pos.setSalesMode}
                            />
                        </div>
                    </div>
                </div>

                {/* === SPREADSHEET CART - Main Content === */}
                <div className="flex-1 overflow-hidden p-4">
                    <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">

                        {/* Cart Header */}
                        <div className="shrink-0 flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                    <ShoppingCart size={20} className="text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-800">سلة المشتريات</h2>
                                    <p className="text-xs text-slate-500">اكتب الرمز أو ابحث في عمود "الرمز" للإضافة</p>
                                </div>
                            </div>
                            <button
                                onClick={pos.clearCart}
                                disabled={!pos.cartItems.length}
                                className="text-xs text-red-500 hover:text-red-600 font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                                <Trash2 size={14} />
                                مسح الكل
                            </button>
                        </div>

                        {/* Spreadsheet Cart - Excel Style */}
                        <div className="flex-1 overflow-hidden">
                            <SpreadsheetCart
                                cartItems={pos.cartItems}
                                products={pos.products}
                                addToCartBySku={pos.addToCartBySku}
                                addToCart={pos.addToCart}
                                updateQty={pos.updateQty}
                                updateItemDiscount={pos.updateItemDiscount}
                                removeFromCart={pos.removeFromCart}
                                subtotal={pos.subtotal}
                                currency={pos.currency}
                            />
                        </div>
                    </div>
                </div>

                {/* === FOOTER - Totals & Actions === */}
                <div className="shrink-0 bg-white border-t border-slate-200 shadow-lg">
                    <OrderSummary
                        selectedPaymentMethod={pos.selectedPaymentMethod}
                        setSelectedPaymentMethod={pos.setSelectedPaymentMethod}
                        selectedTreasury={pos.selectedTreasury}
                        setSelectedTreasury={pos.setSelectedTreasury}
                        treasuryFilter={pos.treasuryFilter}
                        paidAmount={pos.paidAmount}
                        setPaidAmount={pos.setPaidAmount}
                        effectivePaidAmount={pos.effectivePaidAmount}
                        change={pos.change}
                        totalAfterDiscount={pos.totalAfterDiscount}
                        subtotal={pos.subtotal}
                        globalDiscount={pos.globalDiscount}
                        setGlobalDiscount={pos.setGlobalDiscount}
                        cartItems={pos.cartItems}
                        saving={pos.saving}
                        handleSaveOrder={pos.handleSaveOrder}
                        clearCart={pos.clearCart}
                        invoiceType={pos.invoiceType}
                        currency={pos.currency}
                        splitPayments={pos.splitPayments}
                        setSplitPayments={pos.setSplitPayments}
                        setShowSplitPayment={pos.setShowSplitPayment}
                        customerWalletBalance={pos.customerWalletBalance}
                        walletAmountToUse={pos.walletAmountToUse}
                        applyWalletCredit={pos.applyWalletCredit}
                        clearWalletUsage={pos.clearWalletUsage}
                        customerId={pos.customerId}
                    />
                </div>
            </div>

            {/* === PRODUCT BROWSER OVERLAY (Using Portal) === */}
            {isBrowserOpen && createPortal(
                <div className="fixed inset-0 z-[9999]">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsBrowserOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Browser Modal - Centered */}
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="absolute inset-4 md:inset-8 lg:inset-16 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Browser Header */}
                        <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Grid3x3 size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">تصفح المنتجات</h2>
                                    <p className="text-sm text-white/80">{pos.products.length} منتج متوفر</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsBrowserOpen(false)}
                                className="w-12 h-12 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Product Grid */}
                        <div className="flex-1 overflow-hidden">
                            <ProductGrid
                                query={pos.query}
                                setQuery={pos.setQuery}
                                selectedCategory={pos.selectedCategory}
                                setSelectedCategory={pos.setSelectedCategory}
                                categories={pos.categories}
                                filteredProducts={pos.filteredProducts}
                                loadingProducts={pos.loadingProducts}
                                addToCart={handleBrowserProductClick}
                                selectedWarehouseId={pos.selectedWarehouseId}
                                salesMode={pos.salesMode}
                                getImageUrl={pos.getImageUrl}
                            />
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}

            {/* Modals */}
            <AddCustomerModal
                show={pos.showAddCustomer}
                onClose={() => pos.setShowAddCustomer(false)}
                newCustomer={pos.newCustomer}
                setNewCustomer={pos.setNewCustomer}
                onAdd={pos.handleAddCustomer}
                adding={pos.addingCustomer}
            />
            <HeldBillsModal
                show={pos.showHeldBills}
                onClose={() => pos.setShowHeldBills(false)}
                heldBills={pos.heldBills}
                onRestore={pos.restoreHeldBill}
                onDelete={pos.deleteHeldBill}
            />
            <SplitPaymentModal
                show={pos.showSplitPayment}
                onClose={() => pos.setShowSplitPayment(false)}
                splitPayments={pos.splitPayments}
                setSplitPayments={pos.setSplitPayments}
                totalAfterDiscount={pos.totalAfterDiscount}
            />
            <HistoryModal
                show={pos.showHistory}
                onClose={() => pos.setShowHistory(false)}
                historyList={pos.historyList}
                loadingHistory={pos.loadingHistory}
                historyFilters={pos.historyFilters}
                setHistoryFilters={pos.setHistoryFilters}
                paginatedHistory={pos.paginatedHistory}
                historyStats={pos.historyStats}
                currentPage={pos.currentPage}
                setCurrentPage={pos.setCurrentPage}
                totalPages={pos.totalPages}
                itemsPerPage={pos.itemsPerPage}
                setItemsPerPage={pos.setItemsPerPage}
                getInvoiceStatus={pos.getInvoiceStatus}
                handleReprint={pos.handleReprint}
                currency={pos.currency}
            />

            {/* Print Template */}
            <InvoicePrintTemplate invoice={pos.lastInvoice} printRef={pos.printRef} />

            {/* Print Styles */}
            <style>{`
                @media print {
                    body { visibility: hidden; overflow: hidden; }
                    #receipt-print, #receipt-print * { visibility: visible; }
                    #receipt-print { 
                        position: absolute; left: 0; top: 0; width: 100%; 
                        height: auto; min-height: 297mm; max-width: 210mm;
                        padding: 20px; margin: 0 auto; box-sizing: border-box;
                    }
                    @page { size: A4; margin: 0; }
                }
            `}</style>
        </>
    )
}
