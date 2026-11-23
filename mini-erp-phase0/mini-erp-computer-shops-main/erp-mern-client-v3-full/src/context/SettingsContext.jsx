import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

/**
 * SettingsContext - Provides system settings across the application
 * 
 * Features:
 * - Loads settings from backend on app start
 * - Provides settings to all components
 * - Allows real-time updates when settings change
 */

const SettingsContext = createContext()

export const useSettings = () => {
    const context = useContext(SettingsContext)
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}

const defaultSettings = {
    // Company Info
    companyName: '',
    commercialRegister: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logo: '',

    // Financial
    currency: 'LYD',
    currencySymbol: 'د.ل',
    usdExchangeRate: 7.30,
    taxRate: 0,
    enableSmartRounding: true,
    exchangeRateUpdatedAt: null,
    defaultCreditLimit: 0,
    invoicePrefix: 'INV-',
    purchaseOrderPrefix: 'PO-',

    // Print - General
    printTemplate: 'a4',
    thankYouMessage: 'شكراً لتعاملكم معنا',

    // Print - Header (Company Info)
    print_showLogo: true,
    print_showCompanyName: true,
    print_showAddress: true,
    print_showPhone: true,
    print_showEmail: true,
    print_showWebsite: true,
    print_showCommercialRegister: true,
    print_showInvoiceNumber: true,
    print_showDateTime: true,

    // Print - Customer Info
    print_showCustomerName: true,
    print_showCustomerPhone: true,
    print_showCustomerAddress: false,

    // Print - Items Table
    print_showRowNumber: true,
    print_showItemCode: true,
    print_showItemName: true,
    print_showQuantity: true,
    print_showUnitPrice: true,
    print_showItemTotal: true,

    // Print - Totals Summary
    print_showSubtotal: true,
    print_showDiscount: true,
    print_showPaidAmount: true,
    print_showRemainingAmount: true,
    print_showGrandTotal: true,

    // Print - Footer
    print_showThankYouMessage: true,
    print_showNotes: true
}

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(defaultSettings)
    const [loading, setLoading] = useState(true)

    // Helper to get currency symbol
    const getCurrencySymbol = (currency) => {
        const symbols = {
            'LYD': 'د.ل',
            'USD': '$',
            'EUR': '€'
        }
        return symbols[currency] || 'د.ل'
    }

    // Load settings from backend on mount (only if authenticated)
    useEffect(() => {
        const loadSettings = async () => {
            const token = localStorage.getItem('token')
            if (!token) {
                setLoading(false)
                return
            }

            try {
                const { data } = await api.get('/settings')
                if (data) {
                    setSettings(prev => ({
                        ...prev,
                        ...data,
                        companyName: data.companyName || data.name || '',
                        commercialRegister: data.commercialRegister || '',
                        address: data.address || '',
                        phone: data.phone || '',
                        email: data.email || '',
                        website: data.website || '',
                        logo: data.logo || data.logoUrl || '',
                        currency: data.currency || 'LYD',
                        currencySymbol: getCurrencySymbol(data.currency),
                        usdExchangeRate: Number(data.usdExchangeRate) || 7.30,
                        taxRate: Number(data.taxRate) || 0,
                        enableSmartRounding: data.enableSmartRounding !== false,
                        exchangeRateUpdatedAt: data.exchangeRateUpdatedAt || null,
                        defaultCreditLimit: data.defaultCreditLimit || 0,
                        invoicePrefix: data.invoicePrefix || 'INV-',
                        purchaseOrderPrefix: data.purchaseOrderPrefix || 'PO-',
                        printTemplate: data.printTemplate || 'a4',
                        thankYouMessage: data.thankYouMessage || 'شكراً لتعاملكم معنا',
                        showLogo: data.showLogo !== false,
                        showAddress: data.showAddress !== false,
                        showPhone: data.showPhone !== false
                    }))
                }
            } catch (err) {
                console.error('Failed to load settings', err)
            } finally {
                setLoading(false)
            }
        }
        loadSettings()
    }, [])

    // Update settings (for when Settings page saves)
    const updateSettings = (newSettings) => {
        setSettings(prev => ({
            ...prev,
            ...newSettings,
            currencySymbol: getCurrencySymbol(newSettings.currency || prev.currency)
        }))
    }

    // Reload settings from server
    const reloadSettings = async () => {
        try {
            const { data } = await api.get('/settings')
            if (data) {
                updateSettings(data)
            }
        } catch (err) {
            console.error('Failed to reload settings', err)
        }
    }

    // Quick update exchange rate
    const updateExchangeRate = async (newRate) => {
        const rateNum = Number(newRate)
        if (!rateNum || rateNum <= 0) return false
        try {
            let res
            try {
                res = await api.put('/settings', { usdExchangeRate: rateNum })
            } catch (putErr) {
                if (putErr?.response?.status === 404) {
                    res = await api.post('/settings', { usdExchangeRate: rateNum })
                } else {
                    throw putErr
                }
            }
            const data = res?.data
            if (data) {
                updateSettings({
                    usdExchangeRate: data.usdExchangeRate ?? rateNum,
                    exchangeRateUpdatedAt: data.exchangeRateUpdatedAt ?? new Date()
                })
            }
            return true
        } catch (err) {
            console.error('Failed to update exchange rate', err)
            throw err
        }
    }

    const value = {
        settings,
        loading,
        updateSettings,
        reloadSettings,
        updateExchangeRate,
        // Convenience getters
        companyName: settings.companyName,
        logo: settings.logo,
        email: settings.email,
        website: settings.website,
        currency: settings.currency,
        currencySymbol: settings.currencySymbol,
        usdExchangeRate: settings.usdExchangeRate || 7.30,
        taxRate: Number(settings.taxRate) || 0,
        enableSmartRounding: settings.enableSmartRounding,
        exchangeRateUpdatedAt: settings.exchangeRateUpdatedAt,
        defaultCreditLimit: settings.defaultCreditLimit,
        invoicePrefix: settings.invoicePrefix,
        purchaseOrderPrefix: settings.purchaseOrderPrefix,
        thankYouMessage: settings.thankYouMessage,
        printTemplate: settings.printTemplate
    }

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    )
}

export default SettingsContext
