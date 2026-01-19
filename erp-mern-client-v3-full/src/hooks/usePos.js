import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import {
    PAYMENT_METHODS,
    INVOICE_TYPES,
    SALES_MODES,
    INVOICE_STATUS,
    STORAGE_KEYS,
    CURRENCY
} from '../constants/posConstants'

/**
 * usePos Hook - Elite Business Logic Extraction
 * 
 * Manages ALL POS state, data fetching, calculations, and operations.
 * Clean separation of concerns following Google's engineering standards.
 */
export function usePos() {
    const { push } = useToast()
    const { me } = useAuth()
    const navigate = useNavigate()
    const { selectedWarehouseId, currentWarehouse, setWarehouse: setContextWarehouse } = useWarehouse()
    const printRef = useRef(null)

    // ==================== DATA STATE ====================
    const [products, setProducts] = useState([])
    const [warehouses, setWarehouses] = useState([])
    const [customers, setCustomers] = useState([])
    const [loadingProducts, setLoadingProducts] = useState(false)

    // ==================== CART STATE ====================
    const [cartItems, setCartItems] = useState([])
    const [globalDiscount, setGlobalDiscount] = useState(0)
    const [paidAmount, setPaidAmount] = useState('')

    // ==================== SELECTION STATE====================
    const [query, setQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [customerId, setCustomerId] = useState('')
    const [salesMode, setSalesMode] = useState(SALES_MODES.RETAIL)
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(PAYMENT_METHODS.CASH)
    const [selectedTreasury, setSelectedTreasury] = useState('')
    const [invoiceType, setInvoiceType] = useState(INVOICE_TYPES.OFFICIAL)

    // ==================== SPLIT PAYMENT STATE ====================
    const [showSplitPayment, setShowSplitPayment] = useState(false)
    const [splitPayments, setSplitPayments] = useState([
        { method: PAYMENT_METHODS.CASH, amount: 0, treasury: '' },
        { method: PAYMENT_METHODS.CARD, amount: 0, treasury: '' }
    ])

    // ==================== UI STATE ====================
    const [saving, setSaving] = useState(false)
    const [lastInvoice, setLastInvoice] = useState(null)

    // ==================== HISTORY STATE ====================
    const [showHistory, setShowHistory] = useState(false)
    const [historyList, setHistoryList] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [historyFilters, setHistoryFilters] = useState({
        searchQuery: '',
        status: '',
        invoiceType: '',
        dateRange: 'today' // Default: show today's invoices only
    })
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    // ==================== CUSTOMER STATE ====================
    const [showAddCustomer, setShowAddCustomer] = useState(false)
    const [customerSearch, setCustomerSearch] = useState('')
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })
    const [addingCustomer, setAddingCustomer] = useState(false)

    // ==================== HELD BILLS STATE ====================
    const [showHeldBills, setShowHeldBills] = useState(false)
    const [heldBills, setHeldBills] = useState([])

    // ==================== WALLET STATE ====================
    const [customerWalletBalance, setCustomerWalletBalance] = useState(0)
    const [walletAmountToUse, setWalletAmountToUse] = useState(0)
    const [loadingWallet, setLoadingWallet] = useState(false)

    // ==================== IMAGE URL HELPER ====================
    const getImageUrl = useCallback((path) => {
        if (!path) return null
        if (path.startsWith('http')) return path
        const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000/api'
        const rootUrl = baseUrl.replace(/\/api$/, '')
        return `${rootUrl}${path}`
    }, [])

    // ==================== WAREHOUSE LOCKDOWN ====================
    useEffect(() => {
        if (me?.assignedWarehouse) {
            if (selectedWarehouseId !== me.assignedWarehouse._id && selectedWarehouseId !== me.assignedWarehouse) {
                setContextWarehouse(me.assignedWarehouse._id || me.assignedWarehouse)
            }
        }
    }, [me, selectedWarehouseId, setContextWarehouse])

    // ==================== LOAD HELD BILLS ====================
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.HELD_BILLS)
        if (saved) {
            setHeldBills(JSON.parse(saved))
        }
    }, [])

    const saveHeldBills = useCallback((bills) => {
        localStorage.setItem(STORAGE_KEYS.HELD_BILLS, JSON.stringify(bills))
        setHeldBills(bills)
    }, [])

    // ==================== FETCH INITIAL DATA ====================
    useEffect(() => {
        const fetchData = async () => {
            setLoadingProducts(true)
            try {
                const [itemsRes, warehousesRes, customersRes] = await Promise.all([
                    api.get('/inventory/items'),
                    api.get('/inventory/warehouses'),
                    api.get('/customers')
                ])

                const list = Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data.items || [])
                setProducts(list.map(p => ({
                    id: p._id || p.id,
                    name: p.name,
                    sku: p.sku,
                    price: p.price,
                    wholesalePrice: p.wholesalePrice || p.price,
                    stock: p.totalStock || p.stock || 0,
                    stocks: p.stocks || [],
                    totalStock: p.totalStock || p.stock || 0,
                    cost: p.cost || 0,
                    category: p.category,
                    image: p.image
                })))

                setWarehouses(warehousesRes.data || [])
                setCustomers(customersRes.data || [])

            } catch (err) {
                console.error('Failed to load POS data', err)
                push('error', 'فشل تحميل بيانات نقطة البيع')
            } finally {
                setLoadingProducts(false)
            }
        }
        fetchData()
    }, [push])

    // ==================== AUTO-SELECT TREASURY ====================
    useEffect(() => {
        const fetchTreasuries = async () => {
            try {
                const { data } = await api.get('/finance/treasuries')
                if (data && data.length > 0 && !selectedTreasury) {
                    // Case-insensitive check for 'safe' type
                    const defaultTreasury = data.find(t => t.type?.toLowerCase() === 'safe') || data[0]
                    setSelectedTreasury(defaultTreasury._id)
                }
            } catch (err) {
                console.error('Failed to auto-select treasury', err)
            }
        }
        fetchTreasuries()
    }, [selectedTreasury])

    // ==================== FILTERED PRODUCTS (MEMOIZED) ====================
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchQuery = (p.name || '').toLowerCase().includes(query.toLowerCase()) ||
                (p.sku || '').toLowerCase().includes(query.toLowerCase())
            const matchCategory = selectedCategory ? p.category === selectedCategory : true
            return matchQuery && matchCategory
        })
    }, [query, selectedCategory, products])

    // ====================CATEGORIES (MEMOIZED) ====================
    const categories = useMemo(() => {
        const cats = new Set(products.map(p => p.category).filter(Boolean))
        return Array.from(cats)
    }, [products])

    // ==================== FILTERED CUSTOMERS (MEMOIZED) ====================
    const filteredCustomers = useMemo(() => {
        if (!customerSearch) return customers.slice(0, 10)
        return customers.filter(c =>
            c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
            (c.phone && c.phone.includes(customerSearch))
        ).slice(0, 10)
    }, [customers, customerSearch])

    // ==================== CART OPERATIONS ====================
    const addToCart = useCallback((product) => {
        if (!selectedWarehouseId) {
            push('error', 'يرجى اختيار المخزن من القائمة العلوية أولاً')
            return
        }

        const warehouseStock = product.stocks?.find(s => {
            const warehouseId = s.warehouse?._id || s.warehouse
            const stockWarehouseId = warehouseId?.toString()
            const selectedId = selectedWarehouseId?.toString()
            return stockWarehouseId === selectedId
        })

        const availableQty = warehouseStock?.qty || 0

        if (availableQty <= 0) {
            push('error',
                `${product.name} غير متوفر في مخزن ${currentWarehouse?.name || 'المحدد'}. ` +
                `المتوفر: ${availableQty}`
            )
            return
        }

        const price = salesMode === SALES_MODES.WHOLESALE ? product.wholesalePrice : product.price

        setCartItems(prev => {
            const existing = prev.find(x => x.id === product.id)

            if (existing) {
                const newQty = existing.qty + 1

                if (newQty > availableQty) {
                    push('error',
                        `الكمية المتوفرة في ${currentWarehouse?.name}: ${availableQty}، ` +
                        `المطلوب: ${newQty}`
                    )
                    return prev
                }

                return prev.map(x => x.id === product.id ? { ...x, qty: newQty, price } : x)
            }

            return [...prev, {
                ...product,
                qty: 1,
                price,
                retailPrice: product.price,
                wholesalePrice: product.wholesalePrice,
                availableInWarehouse: availableQty
            }]
        })
    }, [selectedWarehouseId, currentWarehouse, salesMode, push])

    const updateQty = useCallback((id, qty) => {
        setCartItems(prev => prev.map(item => {
            if (item.id === id) {
                if (qty > item.availableInWarehouse) {
                    push('error', `أقصى كمية متوفرة: ${item.availableInWarehouse}`)
                    return item
                }
                return { ...item, qty: Math.max(1, qty) }
            }
            return item
        }))
    }, [push])

    const removeFromCart = useCallback((id) => {
        setCartItems(prev => prev.filter(item => item.id !== id))
    }, [])

    const clearCart = useCallback(() => {
        setCartItems([])
        setGlobalDiscount(0)
        setPaidAmount('')
        setCustomerId('')
        setCustomerSearch('')
        setWalletAmountToUse(0)
        setCustomerWalletBalance(0)
    }, [])

    // ==================== ADD TO CART BY SKU/BARCODE ====================
    const addToCartBySku = useCallback((sku) => {
        if (!sku || !sku.trim()) return false

        const searchTerm = sku.trim().toLowerCase()
        const product = products.find(p =>
            p.sku?.toLowerCase() === searchTerm ||
            p.barcode?.toLowerCase() === searchTerm ||
            p.id?.toLowerCase() === searchTerm
        )

        if (product) {
            addToCart(product)
            return true
        } else {
            push('error', `لم يتم العثور على منتج بالكود: ${sku}`)
            return false
        }
    }, [products, addToCart, push])

    // ==================== UPDATE CART PRICES WHEN SALES MODE CHANGES ====================
    useEffect(() => {
        if (cartItems.length === 0) return

        setCartItems(prev => prev.map(item => {
            const newPrice = salesMode === SALES_MODES.WHOLESALE
                ? (item.wholesalePrice || item.retailPrice || item.price)
                : (item.retailPrice || item.price)

            return { ...item, price: newPrice }
        }))

        if (cartItems.length > 0) {
            push('info', salesMode === SALES_MODES.WHOLESALE
                ? '✓ تم تحديث الأسعار إلى أسعار الجملة'
                : '✓ تم تحديث الأسعار إلى أسعار القطاعي'
            )
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salesMode])

    // ==================== CALCULATIONS (MEMOIZED) ====================
    const subtotal = useMemo(() =>
        cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0)
        , [cartItems])

    const totalAfterDiscount = Math.max(0, subtotal - Number(globalDiscount || 0))

    // POS = Full Payment Only (no credit sales)
    const effectivePaidAmount = useMemo(() => {
        if (selectedPaymentMethod === PAYMENT_METHODS.SPLIT) {
            return splitPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        }
        // Always full payment in POS
        return totalAfterDiscount
    }, [selectedPaymentMethod, splitPayments, totalAfterDiscount])

    const change = Math.max(0, effectivePaidAmount - totalAfterDiscount)

    const treasuryFilter = useMemo(() => {
        if (selectedPaymentMethod === PAYMENT_METHODS.CASH) return 'safe'
        if ([PAYMENT_METHODS.CARD, PAYMENT_METHODS.BANK].includes(selectedPaymentMethod)) return 'bank'
        return null
    }, [selectedPaymentMethod])

    // ==================== HELD BILLS ====================
    const handleHoldBill = useCallback(() => {
        if (!cartItems.length) return

        const bill = {
            id: Date.now(),
            date: new Date().toISOString(),
            items: cartItems,
            customer: customers.find(c => c._id === customerId),
            discount: globalDiscount,
            total: totalAfterDiscount
        }

        const newBills = [bill, ...heldBills]
        saveHeldBills(newBills)
        clearCart()
        push('success', 'تم تعليق الفاتورة')
    }, [cartItems, customers, customerId, globalDiscount, totalAfterDiscount, heldBills, saveHeldBills, clearCart, push])

    const restoreHeldBill = useCallback((bill) => {
        setCartItems(bill.items)
        if (bill.customer) {
            setCustomerId(bill.customer._id)
            setCustomerSearch(bill.customer.name)
        } else {
            setCustomerId('')
            setCustomerSearch('')
        }
        setGlobalDiscount(bill.discount || 0)

        const newBills = heldBills.filter(b => b.id !== bill.id)
        saveHeldBills(newBills)
        setShowHeldBills(false)
        push('success', 'تم استرجاع الفاتورة')
    }, [heldBills, saveHeldBills, push])

    const deleteHeldBill = useCallback((id) => {
        const newBills = heldBills.filter(b => b.id !== id)
        saveHeldBills(newBills)
    }, [heldBills, saveHeldBills])

    // ==================== CUSTOMER MANAGEMENT ====================
    const handleAddCustomer = useCallback(async () => {
        if (!newCustomer.name) return
        setAddingCustomer(true)
        try {
            const { data } = await api.post('/customers', newCustomer)
            setCustomers(prev => [...prev, data])
            setCustomerId(data._id)
            setCustomerSearch(data.name)
            setShowAddCustomer(false)
            setNewCustomer({ name: '', phone: '' })
            push('success', 'تم إضافة العميل بنجاح')
        } catch (err) {
            console.error('Failed to add customer', err)
            push('error', 'فشل إضافة العميل')
        } finally {
            setAddingCustomer(false)
        }
    }, [newCustomer, push])

    // ==================== WALLET OPERATIONS ====================
    /**
     * Fetch customer wallet balance when customer is selected
     */
    const fetchWalletBalance = useCallback(async (custId) => {
        if (!custId) {
            setCustomerWalletBalance(0)
            setWalletAmountToUse(0)
            return
        }
        setLoadingWallet(true)
        try {
            const { data } = await api.get(`/wallet/${custId}/balance`)
            // Use availableCredit which includes walletBalance + credit from negative balance
            setCustomerWalletBalance(data.availableCredit || data.walletBalance || 0)
        } catch (err) {
            console.error('Failed to fetch wallet balance', err)
            setCustomerWalletBalance(0)
        } finally {
            setLoadingWallet(false)
        }
    }, [])

    /**
     * Apply wallet balance to current order
     * Auto-calculates the amount to use (min of balance and total)
     */
    const applyWalletCredit = useCallback(() => {
        if (customerWalletBalance <= 0) {
            push('warning', 'لا يوجد رصيد في المحفظة')
            return
        }
        const maxUsable = Math.min(customerWalletBalance, totalAfterDiscount)
        setWalletAmountToUse(maxUsable)
        push('success', `تم تطبيق ${maxUsable.toLocaleString()} من المحفظة`)
    }, [customerWalletBalance, totalAfterDiscount, push])

    /**
     * Clear wallet usage
     */
    const clearWalletUsage = useCallback(() => {
        setWalletAmountToUse(0)
    }, [])

    // Fetch wallet balance when customer changes
    useEffect(() => {
        fetchWalletBalance(customerId)
    }, [customerId, fetchWalletBalance])

    // ==================== HISTORY ====================
    const loadHistory = useCallback(async () => {
        setLoadingHistory(true)
        try {
            const { data } = await api.get('/sales/invoice?limit=5000')
            // API returns { docs: [...] } - extract the docs array
            const invoices = data?.docs || data || []
            const sorted = (Array.isArray(invoices) ? invoices : []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            setHistoryList(sorted)
        } catch (err) {
            console.error('Failed to load history', err)
            push('error', 'فشل تحميل سجل الفواتير')
        } finally {
            setLoadingHistory(false)
        }
    }, [push])

    useEffect(() => {
        if (showHistory) {
            loadHistory()
        }
    }, [showHistory, loadHistory])

    const getInvoiceStatus = useCallback((invoice) => {
        const total = invoice.items.reduce((acc, i) => acc + (i.qty * i.price), 0) - (invoice.discount || 0)
        const paid = invoice.paid || 0

        if (paid >= total) return INVOICE_STATUS.PAID
        if (paid > 0) return INVOICE_STATUS.PARTIAL
        return INVOICE_STATUS.UNPAID
    }, [])

    const filteredHistory = useMemo(() => {
        let filtered = [...historyList]

        if (historyFilters.searchQuery) {
            const q = historyFilters.searchQuery.toLowerCase()
            filtered = filtered.filter(inv =>
                inv._id.toLowerCase().includes(q) ||
                inv.customer?.name?.toLowerCase().includes(q) ||
                inv.number?.toLowerCase().includes(q)
            )
        }

        if (historyFilters.status) {
            filtered = filtered.filter(inv => getInvoiceStatus(inv) === historyFilters.status)
        }

        if (historyFilters.invoiceType) {
            filtered = filtered.filter(inv => inv.channel === historyFilters.invoiceType)
        }

        if (historyFilters.dateRange) {
            const now = new Date()
            filtered = filtered.filter(inv => {
                const invDate = new Date(inv.createdAt)
                if (historyFilters.dateRange === 'today') {
                    return invDate.toDateString() === now.toDateString()
                }
                if (historyFilters.dateRange === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    return invDate >= weekAgo
                }
                if (historyFilters.dateRange === 'month') {
                    return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear()
                }
                return true
            })
        }

        return filtered
    }, [historyList, historyFilters, getInvoiceStatus])

    const historyStats = useMemo(() => {
        const totalSales = filteredHistory.reduce((acc, inv) => {
            // Use totals.grand if available, otherwise calculate
            if (inv.totals?.grand) {
                return acc + inv.totals.grand
            }
            return acc + inv.items.reduce((sum, i) => sum + (i.qty * i.price), 0) - (inv.discount || 0)
        }, 0)

        // Read paid from totals.paid (API response structure)
        const totalPaid = filteredHistory.reduce((acc, inv) => {
            return acc + (inv.totals?.paid || inv.paid || 0)
        }, 0)
        const totalDue = Math.max(0, totalSales - totalPaid)

        return { totalSales, totalPaid, totalDue, count: filteredHistory.length }
    }, [filteredHistory])

    const paginatedHistory = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        return filteredHistory.slice(startIndex, endIndex)
    }, [filteredHistory, currentPage, itemsPerPage])

    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)

    const handleReprint = useCallback((invoice) => {
        const calculatedSubtotal = invoice.items.reduce((acc, i) => acc + (i.qty * i.price), 0)
        const calculatedTotal = calculatedSubtotal - (invoice.discount || 0)

        const receiptData = {
            number: invoice.number || invoice._id,
            date: invoice.createdAt,
            items: invoice.items.map(i => ({
                name: typeof i.item === 'object' ? i.item.name : 'منتج',
                sku: typeof i.item === 'object' ? (i.item.sku || i.item.code) : (i.sku || '-'),
                qty: i.qty,
                price: i.price,
                total: i.qty * i.price
            })),
            totals: {
                subtotal: calculatedSubtotal,
                discount: invoice.discount || 0,
                total: calculatedTotal,
                paid: invoice.paid || calculatedTotal,
                change: (invoice.paid || calculatedTotal) - calculatedTotal
            },
            paymentMethod: invoice.paymentMethod || 'cash'
        }
        setLastInvoice(receiptData)
        setTimeout(() => window.print(), 300)
    }, [])

    // ==================== SAVE ORDER ====================
    const handleSaveOrder = useCallback(async (shouldPrint = false) => {
        if (!cartItems.length) {
            push('error', 'السلة فارغة')
            return
        }

        if (!selectedWarehouseId) {
            push('error', 'يرجى اختيار المخزن من القائمة العلوية')
            return
        }

        if (invoiceType === INVOICE_TYPES.OFFICIAL &&
            selectedPaymentMethod !== PAYMENT_METHODS.SPLIT &&
            selectedPaymentMethod !== PAYMENT_METHODS.WALLET &&
            !selectedTreasury) {
            push('error', 'يرجى اختيار الخزينة المستهدفة')
            return
        } else if (invoiceType === INVOICE_TYPES.OFFICIAL && selectedPaymentMethod === PAYMENT_METHODS.SPLIT) {
            const invalidSplit = splitPayments.find(p => p.amount > 0 && !p.treasury)
            if (invalidSplit) {
                push('error', 'يرجى تحديد الخزينة لكل دفعة في الدفع المختلط')
                return
            }
        }

        if (selectedPaymentMethod === PAYMENT_METHODS.SPLIT) {
            if (effectivePaidAmount < totalAfterDiscount) {
                push('error', 'مجموع الدفعات أقل من المبلغ المطلوب')
                return
            }
        }

        const remainingAmount = Math.max(0, totalAfterDiscount - effectivePaidAmount)
        if (remainingAmount > 0 && customerId) {
            try {
                const { data: customer } = await api.get(`/customers/${customerId}`)
                if (customer.creditLimit > 0) {
                    const newBalance = (customer.balance || 0) + remainingAmount
                    if (newBalance > customer.creditLimit) {
                        push('error', `تجاوز سقف الائتمان! الرصيد الحالي: ${customer.balance}، السقف: ${customer.creditLimit}`)
                        return
                    }
                }
            } catch (err) {
                console.error('Credit check failed', err)
                push('error', 'فشل التحقق من سقف الائتمان')
                return
            }
        }

        try {
            setSaving(true)

            // Determine actual payment method based on wallet usage
            let actualPaymentMethod = selectedPaymentMethod
            let actualSplitDetails = null

            // If wallet is being used
            if (walletAmountToUse > 0) {
                const remainingAfterWallet = totalAfterDiscount - walletAmountToUse

                if (remainingAfterWallet <= 0) {
                    // Wallet covers everything
                    actualPaymentMethod = PAYMENT_METHODS.WALLET
                } else {
                    // Wallet covers part, rest is cash/card/bank
                    actualPaymentMethod = PAYMENT_METHODS.SPLIT
                    actualSplitDetails = [
                        { method: PAYMENT_METHODS.WALLET, amount: walletAmountToUse, treasury: null },
                        { method: selectedPaymentMethod, amount: remainingAfterWallet, treasury: selectedTreasury }
                    ]
                }
            }

            const payload = {
                date: new Date().toISOString(),
                channel: salesMode,
                items: cartItems.map(i => ({
                    item: i.id,
                    qty: Number(i.qty) || 1,
                    price: Number(i.price) || 0,
                    cost: Number(i.cost) || 0
                })),
                note: 'POS Sale',
                discountValue: Number(globalDiscount || 0),
                paid: effectivePaidAmount,
                paymentMethod: actualPaymentMethod,
                warehouse: selectedWarehouseId,
                treasury: actualPaymentMethod === PAYMENT_METHODS.WALLET
                    ? null
                    : (actualPaymentMethod === PAYMENT_METHODS.SPLIT
                        ? (actualSplitDetails?.find(p => p.method !== PAYMENT_METHODS.WALLET)?.treasury || selectedTreasury)
                        : selectedTreasury),
                customer: customerId || undefined,
                // ⚠️ IMPORTANT: عرض السعر = draft (لا يخصم)، رسمية = confirmed (يخصم)
                status: invoiceType === INVOICE_TYPES.PROFORMA ? 'draft' : 'confirmed',
                type: invoiceType,
                ...(actualPaymentMethod === PAYMENT_METHODS.SPLIT && {
                    splitDetails: actualSplitDetails || splitPayments.map(p => ({
                        method: p.method,
                        amount: p.amount,
                        treasury: p.treasury
                    }))
                })
            }



            const { data } = await api.post('/sales/invoice-v2', payload)

            const receiptData = {
                number: data.number || data._id,
                date: data.date || payload.date,
                items: cartItems.map(i => ({
                    name: i.name,
                    sku: i.sku,
                    qty: i.qty,
                    price: i.price,
                    total: i.price * i.qty
                })),
                totals: {
                    subtotal,
                    discount: Number(globalDiscount || 0),
                    total: totalAfterDiscount,
                    paid: Number(paidAmount || totalAfterDiscount),
                    change
                },
                paymentMethod: payload.paymentMethod,
                invoiceType, // Add invoice type for print template
                customer: customerId ? customers.find(c => c._id === customerId) : null // ✅ Add customer object
            }

            setLastInvoice(receiptData)

            // ⚠️ ONLY update stock for official invoices, NOT proforma
            if (invoiceType === INVOICE_TYPES.OFFICIAL) {
                setProducts(prevProducts => prevProducts.map(p => {
                    const cartItem = cartItems.find(c => c.id === p.id)
                    if (cartItem) {
                        const newTotalStock = p.totalStock - cartItem.qty

                        const newStocks = p.stocks.map(s => {
                            const sWhId = s.warehouse?._id || s.warehouse
                            if (sWhId?.toString() === selectedWarehouseId?.toString()) {
                                return { ...s, qty: s.qty - cartItem.qty }
                            }
                            return s
                        })

                        return { ...p, totalStock: newTotalStock, stock: newTotalStock, stocks: newStocks }
                    }
                    return p
                }))
            }

            push('success', invoiceType === INVOICE_TYPES.PROFORMA ? 'تم حفظ عرض السعر بنجاح' : 'تم حفظ الفاتورة بنجاح')
            clearCart()

            // ✅ Print with lock to prevent duplicates
            if (shouldPrint) {
                setTimeout(() => {
                    if (!window.__isPrinting) {
                        window.__isPrinting = true
                        window.print()
                        setTimeout(() => { window.__isPrinting = false }, 1000)
                    }
                }, 300)
            }

        } catch (err) {
            console.error('POS Save Error', err)

            if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
                const errorMessages = err.response.data.errors.map(e => e.msg).join('\n')
                push('error', `فشل التحقق:\n${errorMessages}`)
                console.error('Validation Errors:', err.response.data.errors)
            } else if (err.response?.data?.message) {
                push('error', err.response.data.message)
            } else {
                push('error', 'فشل حفظ الفاتورة - خطأ غير معروف')
            }
        } finally {
            setSaving(false)
        }
    }, [
        cartItems, selectedWarehouseId, invoiceType, selectedPaymentMethod, selectedTreasury,
        splitPayments, effectivePaidAmount, totalAfterDiscount, customerId, salesMode,
        globalDiscount, subtotal, paidAmount, change, push, clearCart, walletAmountToUse, customers
    ])

    // ==================== RETURN API ====================
    return {
        // Data
        products,
        customers,
        warehouses,
        cartItems,
        heldBills,
        historyList,
        loadingProducts,
        loadingHistory,

        // Computed / Memoized
        filteredProducts,
        categories,
        filteredCustomers,
        subtotal,
        totalAfterDiscount,
        effectivePaidAmount,
        change,
        treasuryFilter,
        filteredHistory,
        historyStats,
        paginatedHistory,
        totalPages,

        // Cart Operations
        addToCart,
        addToCartBySku,
        updateQty,
        removeFromCart,
        clearCart,

        // Order Processing
        handleSaveOrder,
        saving,
        lastInvoice,
        printRef,

        // Selection State
        query,
        setQuery,
        selectedCategory,
        setSelectedCategory,
        customerId,
        setCustomerId,
        salesMode,
        setSalesMode,
        selectedPaymentMethod,
        setSelectedPaymentMethod,
        selectedTreasury,
        setSelectedTreasury,
        invoiceType,
        setInvoiceType,
        globalDiscount,
        setGlobalDiscount,
        paidAmount,
        setPaidAmount,

        // Split Payment
        showSplitPayment,
        setShowSplitPayment,
        splitPayments,
        setSplitPayments,

        // Customer
        customerSearch,
        setCustomerSearch,
        showAddCustomer,
        setShowAddCustomer,
        newCustomer,
        setNewCustomer,
        addingCustomer,
        handleAddCustomer,

        // Held Bills
        handleHoldBill,
        restoreHeldBill,
        deleteHeldBill,
        showHeldBills,
        setShowHeldBills,

        // History
        showHistory,
        setShowHistory,
        historyFilters,
        setHistoryFilters,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        loadHistory,
        getInvoiceStatus,
        handleReprint,

        // Helpers
        getImageUrl,
        currency: CURRENCY,
        selectedWarehouseId,
        currentWarehouse,

        // Wallet
        customerWalletBalance,
        walletAmountToUse,
        setWalletAmountToUse,
        loadingWallet,
        applyWalletCredit,
        clearWalletUsage,
    }
}
