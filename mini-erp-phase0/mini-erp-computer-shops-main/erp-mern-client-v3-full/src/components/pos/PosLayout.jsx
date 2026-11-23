import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate, useOutletContext } from 'react-router-dom'
import { FastInvoiceView } from './FastInvoiceView'
import { AddCustomerModal } from './modals/AddCustomerModal'
import { HeldBillsModal } from './modals/HeldBillsModal'
import { SplitPaymentModal } from './modals/SplitPaymentModal'
import { HistoryModal } from './modals/HistoryModal'
import { InvoicePrintTemplate } from './InvoicePrintTemplate'
import { usePos } from '../../hooks/usePos'
import { KEYBOARD_SHORTCUTS } from '../../constants/posConstants'

/**
 * PosLayout - Master POS Retail Workstation
 * 
 * Unifies Cash Sales (بيع نقدي) and Customer Sales (مبيعات العملاء)
 * under the high-performance FastInvoiceView layout millimeter-by-millimeter.
 */
export const PosLayout = () => {
    const pos = usePos()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const outletContext = useOutletContext() || {}
    const [viewMode, setViewMode] = useState(() => searchParams.get('mode') || localStorage.getItem('pos_view_mode') || 'fast')

    // Synchronize viewMode whenever searchParams URL changes (e.g. from top nav, sidebar, or mode switcher)
    useEffect(() => {
        const mode = searchParams.get('mode')
        if (mode && ['fast', 'split', 'table', 'customer'].includes(mode)) {
            setViewMode(mode)
            localStorage.setItem('pos_view_mode', mode)
        } else if (!mode) {
            const saved = localStorage.getItem('pos_view_mode')
            if (saved && ['fast', 'split', 'table', 'customer'].includes(saved)) {
                setViewMode(saved)
            } else {
                setViewMode('fast')
            }
        }
    }, [searchParams])

    // Save view mode preference and update URL
    const handleViewModeChange = useCallback((mode) => {
        setViewMode(mode)
        localStorage.setItem('pos_view_mode', mode)
        navigate(`/pos?mode=${mode}`, { replace: true })
    }, [navigate])

    // Select an invoice from history to open in POS sales screen
    const handleSelectHistoryInvoice = useCallback((invoice) => {
        if (pos.selectHistoryInvoice) {
            pos.selectHistoryInvoice(invoice)
        }
    }, [pos])

    // Global Keyboard Shortcuts (Layout level — guards modal-open state)
    // NOTE: F4 (mode toggle) is handled inside FastInvoiceView to avoid duplicate listeners.
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isModalOpen = pos.showAddCustomer || pos.showHeldBills ||
                pos.showSplitPayment || pos.showHistory || pos.showPaymentModal

            // F9 - Open Payment & Checkout Modal (عند إتمام البيع)
            if ((e.key === 'F9' || e.key === KEYBOARD_SHORTCUTS.SAVE) && !isModalOpen) {
                e.preventDefault()
                if (pos.cartItems.length > 0 && !pos.saving) {
                    pos.setShowPaymentModal(true)
                }
            }

            // F7 - Hold Bill
            if (e.key === 'F7' && !isModalOpen) {
                e.preventDefault()
                if (pos.cartItems.length > 0) {
                    pos.handleHoldBill()
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [pos, viewMode, handleViewModeChange])

    const isCustomerMode = viewMode !== 'fast'

    return (
        <div className="h-full w-full bg-[#f4f6fb] dark:bg-slate-950 flex flex-col overflow-hidden select-none font-sans">
            {/* Unified POS Workstation */}
            <FastInvoiceView
                pos={pos}
                mode={isCustomerMode ? 'customer' : 'cash'}
                onExit={() => navigate('/')}
                onSwitchMode={handleViewModeChange}
                onToggleNav={() => outletContext?.setShowNavInPos && outletContext.setShowNavInPos(prev => !prev)}
                showNavInPos={outletContext?.showNavInPos}
            />

            {/* Modals & Popups */}
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
                onSelectInvoice={handleSelectHistoryInvoice}
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

            {/* Invoice Print Template */}
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
        </div>
    )
}
