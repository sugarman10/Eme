import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate, useOutletContext } from 'react-router-dom'
import { PosReturnView } from './PosReturnView'
import { usePosReturn } from '../../hooks/usePosReturn'

/**
 * PosReturnLayout - Master Sales Return Workstation Container
 * 
 * Unifies Cash Return (مردود نقدي) and Customer Sales Return (مردود مبيعات)
 * under the dedicated PosReturnView workstation.
 */
export const PosReturnLayout = () => {
    const pos = usePosReturn()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const outletContext = useOutletContext() || {}
    const [viewMode, setViewMode] = useState(() => searchParams.get('mode') || localStorage.getItem('pos_return_mode') || 'fast')

    // Synchronize viewMode whenever URL searchParams change
    useEffect(() => {
        const mode = searchParams.get('mode')
        if (mode && ['fast', 'split', 'customer'].includes(mode)) {
            setViewMode(mode)
            localStorage.setItem('pos_return_mode', mode)
        } else if (!mode) {
            const saved = localStorage.getItem('pos_return_mode')
            if (saved && ['fast', 'split', 'customer'].includes(saved)) {
                setViewMode(saved)
            } else {
                setViewMode('fast')
            }
        }
    }, [searchParams])

    const handleViewModeChange = useCallback((mode) => {
        if (mode === 'split' || mode === 'customer') {
            navigate('/sales-returns')
        } else {
            setViewMode('fast')
            localStorage.setItem('pos_return_mode', 'fast')
            navigate('/pos-return', { replace: true })
        }
    }, [navigate])

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isModalOpen = pos.showAddCustomer || pos.showReturnModal || pos.showHistory

            // F9 - Open Return Modal
            if (e.key === 'F9' && !isModalOpen) {
                e.preventDefault()
                if (pos.cartItems.length > 0 && !pos.saving) {
                    pos.setShowReturnModal(true)
                }
            }

            // F4 - Switch Mode between Cash Return and Customer Return
            if (e.key === 'F4' && !isModalOpen) {
                e.preventDefault()
                handleViewModeChange(viewMode === 'fast' ? 'split' : 'fast')
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [pos, viewMode, handleViewModeChange])

    const isCustomerMode = viewMode !== 'fast'

    return (
        <div className="h-full w-full bg-[#fdf2f4]/60 dark:bg-slate-950 flex flex-col overflow-hidden select-none font-sans">
            <PosReturnView
                pos={pos}
                mode={isCustomerMode ? 'customer' : 'cash'}
                onExit={() => navigate('/')}
                onSwitchMode={handleViewModeChange}
                onToggleNav={() => outletContext?.setShowNavInPos && outletContext.setShowNavInPos(prev => !prev)}
                showNavInPos={outletContext?.showNavInPos}
            />
        </div>
    )
}
