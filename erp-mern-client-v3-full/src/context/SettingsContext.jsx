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

    // Load settings from backend on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const { data } = await api.get('/settings')
                if (data) {
                    setSettings(prev => ({
                        ...prev,
                        companyName: data.companyName || '',
                        commercialRegister: data.commercialRegister || '',
                        address: data.address || '',
                        phone: data.phone || '',
                        email: data.email || '',
                        website: data.website || '',
                        logo: data.logo || '',
                        currency: data.currency || 'LYD',
                        currencySymbol: getCurrencySymbol(data.currency),
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
                // Use defaults on error
            } finally {
                setLoading(false)
            }
        }
        loadSettings()
    }, [])

    // Helper to get currency symbol
    const getCurrencySymbol = (currency) => {
        const symbols = {
            'LYD': 'د.ل',
            'USD': '$',
            'EUR': '€'
        }
        return symbols[currency] || 'د.ل'
    }

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

    const value = {
        settings,
        loading,
        updateSettings,
        reloadSettings,
        // Convenience getters
        companyName: settings.companyName,
        logo: settings.logo,
        currency: settings.currency,
        currencySymbol: settings.currencySymbol,
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
