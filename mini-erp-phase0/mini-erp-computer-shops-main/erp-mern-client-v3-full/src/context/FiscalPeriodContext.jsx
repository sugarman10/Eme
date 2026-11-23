import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const FiscalPeriodContext = createContext()

export function FiscalPeriodProvider({ children }) {
    const { me } = useAuth()
    const [periods, setPeriods] = useState([])
    const [selectedPeriodId, setSelectedPeriodId] = useState(null)
    const [loading, setLoading] = useState(true)

    const canSwitchPeriod = Boolean(
        me?.role === 'admin' ||
        me?.permissions?.includes('fiscal_period_switch') ||
        me?.permissions?.includes('*')
    )

    const canManagePeriods = Boolean(
        me?.role === 'admin' ||
        me?.permissions?.includes('fiscal_period_manage') ||
        me?.permissions?.includes('*')
    )

    const fetchPeriods = useCallback(async () => {
        try {
            const { data } = await api.get('/fiscal-periods')
            const list = Array.isArray(data) ? data : []
            // Sort: newest start date first
            list.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
            setPeriods(list)

            const savedId = localStorage.getItem('active_fiscal_period_id')
            let current = null
            if (savedId && list.some(p => p._id === savedId)) {
                current = list.find(p => p._id === savedId)
                setSelectedPeriodId(savedId)
            } else if (list.length > 0) {
                // Find open period or latest period
                current = list.find(p => !p.isClosed) || list[0]
                setSelectedPeriodId(current._id)
            }

            if (current) {
                localStorage.setItem('active_fiscal_period_id', current._id)
                localStorage.setItem('active_fiscal_period_start', current.startDate)
                localStorage.setItem('active_fiscal_period_end', current.endDate)
                localStorage.setItem('active_fiscal_period_name', current.name)
            }
        } catch (error) {
            console.error('Failed to load fiscal periods:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPeriods()
    }, [fetchPeriods])

    const selectPeriod = (periodId) => {
        if (!canSwitchPeriod) {
            return false
        }
        if (periodId === selectedPeriodId) {
            return true
        }
        setSelectedPeriodId(periodId)
        const target = periods.find(p => p._id === periodId)
        if (target) {
            localStorage.setItem('active_fiscal_period_id', target._id)
            localStorage.setItem('active_fiscal_period_start', target.startDate)
            localStorage.setItem('active_fiscal_period_end', target.endDate)
            localStorage.setItem('active_fiscal_period_name', target.name)
        } else {
            localStorage.removeItem('active_fiscal_period_id')
            localStorage.removeItem('active_fiscal_period_start')
            localStorage.removeItem('active_fiscal_period_end')
            localStorage.removeItem('active_fiscal_period_name')
        }
        // Force page reload so all open tables and reports re-fetch for the chosen fiscal year
        window.location.reload()
        return true
    }

    const currentPeriod = periods.find(p => p._id === selectedPeriodId) || periods[0] || null

    const value = {
        periods,
        selectedPeriodId,
        currentPeriod,
        selectPeriod,
        canSwitchPeriod,
        canManagePeriods,
        loading,
        refreshPeriods: fetchPeriods
    }

    return (
        <FiscalPeriodContext.Provider value={value}>
            {children}
        </FiscalPeriodContext.Provider>
    )
}

export function useFiscalPeriod() {
    const context = useContext(FiscalPeriodContext)
    if (!context) {
        throw new Error('useFiscalPeriod must be used within FiscalPeriodProvider')
    }
    return context
}
