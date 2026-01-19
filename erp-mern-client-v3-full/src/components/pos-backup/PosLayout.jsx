import React, { useEffect } from 'react'
import { Card } from '../ui/Card'
import { ProductGrid } from './ProductGrid'
import { CartSidebar } from './CartSidebar'
import { AddCustomerModal } from './modals/AddCustomerModal'
import { HeldBillsModal } from './modals/HeldBillsModal'
import { SplitPaymentModal } from './modals/SplitPaymentModal'
import { HistoryModal } from './modals/HistoryModal'
import { InvoicePrintTemplate } from './InvoicePrintTemplate'
import { usePos } from '../../hooks/usePos'
import { KEYBOARD_SHORTCUTS } from '../../constants/posConstants'

/**
 * PosLayout - Main POS Container
 * 
 * Features:
 * - Two-column layout: ProductGrid + CartSidebar
 * - Keyboard shortcuts (F9, ESC)
 * - Full-height container with proper overflow
 * - Integrates usePos hook
 */
export const PosLayout = () => {
    const pos = usePos()

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // F9 - Pay/Save Order
            if (e.key === KEYBOARD_SHORTCUTS.PAY) {
                e.preventDefault()
                if (pos.cartItems.length > 0) {
                    pos.handleSaveOrder(true)
                }
            }

            // ESC - Clear Cart
            if (e.key === KEYBOARD_SHORTCUTS.CLEAR) {
                if (!pos.showHistory && !pos.showHeldBills && !pos.showSplitPayment && !pos.showAddCustomer) {
                    pos.clearCart()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [pos])

    return (
        <>
            <div
                className="h-full flex flex-col gap-4 animate-in"
                style={{ height: 'calc(100vh - var(--navbar-height))' }}
            >
                <div className="flex gap-6 h-full">
                    {/* Left: Product Catalog (Flexible Width) */}
                    <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
                        <Card className="flex-1 flex flex-col shadow-sm border-0 bg-white/50 backdrop-blur-sm">
                            <ProductGrid
                                query={pos.query}
                                setQuery={pos.setQuery}
                                selectedCategory={pos.selectedCategory}
                                setSelectedCategory={pos.setSelectedCategory}
                                categories={pos.categories}
                                filteredProducts={pos.filteredProducts}
                                loadingProducts={pos.loadingProducts}
                                addToCart={pos.addToCart}
                                selectedWarehouseId={pos.selectedWarehouseId}
                                salesMode={pos.salesMode}
                                getImageUrl={pos.getImageUrl}
                            />
                        </Card>
                    </div>

                    {/* Right: Cart Sidebar (Fixed 420px) */}
                    <div className="flex flex-col w-[380px] xl:w-[420px] shrink-0 transition-all duration-300 h-full">
                        <CartSidebar
                            cartItems={pos.cartItems}
                            invoiceType={pos.invoiceType}
                            setInvoiceType={pos.setInvoiceType}
                            handleHoldBill={pos.handleHoldBill}
                            setShowHeldBills={pos.setShowHeldBills}
                            heldBills={pos.heldBills}
                            setShowHistory={pos.setShowHistory}
                            clearCart={pos.clearCart}
                            updateQty={pos.updateQty}
                            removeFromCart={pos.removeFromCart}
                            restoreHeldBill={pos.restoreHeldBill}
                            // Customer
                            customerSearch={pos.customerSearch}
                            setCustomerSearch={pos.setCustomerSearch}
                            customerId={pos.customerId}
                            setCustomerId={pos.setCustomerId}
                            filteredCustomers={pos.filteredCustomers}
                            customers={pos.customers}
                            setSalesMode={pos.setSalesMode}
                            setShowAddCustomer={pos.setShowAddCustomer}
                            push={pos.push}
                            // OrderSummary
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
                            saving={pos.saving}
                            handleSaveOrder={pos.handleSaveOrder}
                            currency={pos.currency}
                            splitPayments={pos.splitPayments}
                            setSplitPayments={pos.setSplitPayments}
                            setShowSplitPayment={pos.setShowSplitPayment}
                        />
                    </div>
                </div>
            </div>

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

            {/* History Modal */}
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
            <InvoicePrintTemplate
                invoice={pos.lastInvoice}
                printRef={pos.printRef}
            />

            {/* Print Styles */}
            <style>{`
        @media print {
          body { visibility: hidden; overflow: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            height: auto;
            min-height: 297mm;
            max-width: 210mm;
            padding: 20px;
            margin: 0 auto;
            box-sizing: border-box;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
        </>
    )
}
