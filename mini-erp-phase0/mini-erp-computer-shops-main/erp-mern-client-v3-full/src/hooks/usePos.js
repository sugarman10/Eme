import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import { useSocket } from '../context/SocketContext'
import { useSettings } from '../context/SettingsContext'
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
    const { usdExchangeRate = 7.30, taxRate = 0, reloadSettings } = useSettings()
    const {
        selectedWarehouseId,
        currentWarehouse,
        selectWarehouse,
        setWarehouse: setContextWarehouse,
        warehouses: contextWarehouses,
        isWarehouseLocked
    } = useWarehouse()
    const printRef = useRef(null)
    const isSubmittingRef = useRef(false)

    const setWarehouse = useCallback((warehouseId) => {
        if (selectWarehouse) {
            selectWarehouse(warehouseId)
        } else if (setContextWarehouse) {
            setContextWarehouse(warehouseId)
        }
    }, [selectWarehouse, setContextWarehouse])

    // ==================== DATA STATE ====================
    const [products, setProducts] = useState([])
    const [warehouses, setWarehouses] = useState([])
    const [customers, setCustomers] = useState([])
    const [treasuries, setTreasuries] = useState([])
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

    // ==================== PAYMENT / CHECKOUT MODAL STATE ====================
    const [showPaymentModal, setShowPaymentModal] = useState(false)

    // ==================== UI STATE ====================
    const [saving, setSaving] = useState(false)
    const [lastInvoice, setLastInvoice] = useState(null)

    // ==================== HISTORY STATE ====================
    const [showHistory, setShowHistory] = useState(false)
    const [selectedHistoryInvoice, setSelectedHistoryInvoice] = useState(null)
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
    const [customCustomerName, setCustomCustomerName] = useState('عميل نقدي')
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
        const baseUrl = api.defaults.baseURL || 'http://127.0.0.1:4000/api'
        const rootUrl = baseUrl.replace(/\/api$/, '')
        return `${rootUrl}${path}`
    }, [])

    // ==================== DEFAULT INITIAL WAREHOUSE ====================
    useEffect(() => {
        if (me?.assignedWarehouse && !selectedWarehouseId) {
            const assignedId = me.assignedWarehouse._id || me.assignedWarehouse
            setWarehouse(assignedId)
        }
    }, [me, selectedWarehouseId, setWarehouse])

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

    // ==================== REAL-TIME STOCK SYNC (Socket.io) ====================
    const { socket } = useSocket()

    useEffect(() => {
        if (!socket) return

        const handleStockUpdate = (data) => {
            if (data.warehouseId !== selectedWarehouseId) return

            setProducts(currentProducts => {
                return currentProducts.map(product => {
                    const update = data.updates.find(u =>
                        u.productId === product.id || u.productId === product._id
                    )

                    if (update) {
                        const newTotalStock = (product.totalStock || 0) - update.deductedQty

                        const newStocks = (product.stocks || []).map(s => {
                            const sWhId = s.warehouse?._id || s.warehouse
                            if (sWhId?.toString() === data.warehouseId?.toString()) {
                                return { ...s, qty: (s.qty || 0) - update.deductedQty }
                            }
                            return s
                        })

                        return {
                            ...product,
                            totalStock: newTotalStock,
                            stock: newTotalStock,
                            stocks: newStocks
                        }
                    }
                    return product
                })
            })
        }

        socket.on('stock:update', handleStockUpdate)

        return () => {
            socket.off('stock:update', handleStockUpdate)
        }
    }, [socket, selectedWarehouseId])

    // ==================== REAL-TIME EXCHANGE RATE SYNC ====================
    useEffect(() => {
        if (!socket) return

        const handleExchangeRateUpdated = (data) => {
            const newRate = Number(data?.usdExchangeRate) || Number(usdExchangeRate) || 7.30

            // 1. Recalculate local products immediately
            setProducts(currentProducts => currentProducts.map(p => {
                const isUsd = p.pricingCurrency === 'USD' || Number(p.priceUSD) > 0
                if (!isUsd) return p

                const basePrice = Number(p.priceUSD) > 0
                    ? Math.round(Number(p.priceUSD) * newRate * 100) / 100
                    : Number(p.price) || 0
                const wholesalePrice = Number(p.wholesalePriceUSD) > 0
                    ? Math.round(Number(p.wholesalePriceUSD) * newRate * 100) / 100
                    : (Number(p.wholesalePrice) || basePrice)
                const costPrice = Number(p.costUSD) > 0
                    ? Math.round(Number(p.costUSD) * newRate * 100) / 100
                    : (Number(p.cost) || 0)

                let minPrice = p.minPrice
                let maxPrice = p.maxPrice
                if (Number(p.minPriceUSD) > 0) {
                    minPrice = Math.round(Number(p.minPriceUSD) * newRate * 100) / 100
                }
                if (Number(p.maxPriceUSD) > 0) {
                    maxPrice = Math.round(Number(p.maxPriceUSD) * newRate * 100) / 100
                }

                return {
                    ...p,
                    price: basePrice,
                    wholesalePrice,
                    cost: costPrice,
                    minPrice,
                    maxPrice
                }
            }))

            // 2. Recalculate active cashier cart items priced in USD
            setCartItems(currentCart => currentCart.map(item => {
                const isUsd = item.pricingCurrency === 'USD' || Number(item.priceUSD) > 0
                if (!isUsd) return item

                const newBasePrice = Number(item.priceUSD) > 0
                    ? Math.round(Number(item.priceUSD) * newRate * 100) / 100
                    : item.price
                const newWholesale = Number(item.wholesalePriceUSD) > 0
                    ? Math.round(Number(item.wholesalePriceUSD) * newRate * 100) / 100
                    : (item.wholesalePrice || newBasePrice)
                const activePrice = salesMode === SALES_MODES.WHOLESALE ? newWholesale : newBasePrice

                return {
                    ...item,
                    price: activePrice,
                    retailPrice: newBasePrice,
                    wholesalePrice: newWholesale
                }
            }))

            if (reloadSettings) {
                reloadSettings()
            }
        }

        socket.on('exchange_rate_updated', handleExchangeRateUpdated)
        return () => {
            socket.off('exchange_rate_updated', handleExchangeRateUpdated)
        }
    }, [socket, usdExchangeRate, salesMode, reloadSettings])

    // Keep products and cart items reactive to usdExchangeRate prop/context changes
    useEffect(() => {
        const rate = Number(usdExchangeRate) || 7.30
        setProducts(currentProducts => {
            if (!currentProducts || currentProducts.length === 0) return currentProducts
            return currentProducts.map(p => {
                const isUsd = p.pricingCurrency === 'USD' || Number(p.priceUSD) > 0
                if (!isUsd) return p

                const basePrice = Number(p.priceUSD) > 0
                    ? Math.round(Number(p.priceUSD) * rate * 100) / 100
                    : Number(p.price) || 0
                const wholesalePrice = Number(p.wholesalePriceUSD) > 0
                    ? Math.round(Number(p.wholesalePriceUSD) * rate * 100) / 100
                    : (Number(p.wholesalePrice) || basePrice)
                const costPrice = Number(p.costUSD) > 0
                    ? Math.round(Number(p.costUSD) * rate * 100) / 100
                    : (Number(p.cost) || 0)

                let minPrice = p.minPrice
                let maxPrice = p.maxPrice
                if (Number(p.minPriceUSD) > 0) {
                    minPrice = Math.round(Number(p.minPriceUSD) * rate * 100) / 100
                }
                if (Number(p.maxPriceUSD) > 0) {
                    maxPrice = Math.round(Number(p.maxPriceUSD) * rate * 100) / 100
                }

                return {
                    ...p,
                    price: basePrice,
                    wholesalePrice,
                    cost: costPrice,
                    minPrice,
                    maxPrice
                }
            })
        })

        setCartItems(currentCart => {
            if (!currentCart || currentCart.length === 0) return currentCart
            return currentCart.map(item => {
                const isUsd = item.pricingCurrency === 'USD' || Number(item.priceUSD) > 0
                if (!isUsd) return item

                const newBasePrice = Number(item.priceUSD) > 0
                    ? Math.round(Number(item.priceUSD) * rate * 100) / 100
                    : item.price
                const newWholesale = Number(item.wholesalePriceUSD) > 0
                    ? Math.round(Number(item.wholesalePriceUSD) * rate * 100) / 100
                    : (item.wholesalePrice || newBasePrice)
                const activePrice = salesMode === SALES_MODES.WHOLESALE ? newWholesale : newBasePrice

                return {
                    ...item,
                    price: activePrice,
                    retailPrice: newBasePrice,
                    wholesalePrice: newWholesale
                }
            })
        })
    }, [usdExchangeRate, salesMode])

    // ==================== FETCH INITIAL DATA ====================
    const fetchProductsData = useCallback(async () => {
        setLoadingProducts(true)
        try {
            const { data } = await api.get('/inventory/items', { params: { limit: 5000 } })
            const list = Array.isArray(data) ? data : (data.items || [])
            const rate = Number(usdExchangeRate) || 7.30
            setProducts(list.map(p => {
                let basePrice = Number(p.price) || 0
                let wholesalePrice = Number(p.wholesalePrice) || basePrice
                let costPrice = Number(p.cost) || 0

                if (p.pricingCurrency === 'USD' || Number(p.priceUSD) > 0) {
                    if (Number(p.priceUSD) > 0) {
                        basePrice = Math.round(Number(p.priceUSD) * rate * 100) / 100
                    }
                    if (Number(p.wholesalePriceUSD) > 0) {
                        wholesalePrice = Math.round(Number(p.wholesalePriceUSD) * rate * 100) / 100
                    }
                    if (Number(p.costUSD) > 0) {
                        costPrice = Math.round(Number(p.costUSD) * rate * 100) / 100
                    }
                }

                return {
                    id: p._id || p.id,
                    name: p.name,
                    sku: p.sku,
                    barcode: p.barcode,
                    price: basePrice,
                    wholesalePrice,
                    pricingCurrency: p.pricingCurrency || (Number(p.priceUSD) > 0 ? 'USD' : 'LYD'),
                    priceUSD: Number(p.priceUSD) || 0,
                    costUSD: Number(p.costUSD) || 0,
                    wholesalePriceUSD: Number(p.wholesalePriceUSD) || 0,
                    minPriceUSD: Number(p.minPriceUSD) || 0,
                    maxPriceUSD: Number(p.maxPriceUSD) || 0,
                    stock: p.totalStock ?? p.stock ?? 0,
                    stocks: p.stocks || [],
                    totalStock: p.totalStock ?? p.stock ?? 0,
                    cost: costPrice,
                    category: typeof p.category === 'object' ? (p.category?.name || 'عام') : (p.category || 'عام'),
                    image: p.image,
                    isBundle: !!p.isBundle,
                    bundleComponents: p.bundleComponents || []
                }
            }))
        } catch (err) {
            console.error('Failed to load products', err)
            push('error', 'فشل تحميل المنتجات')
        } finally {
            setLoadingProducts(false)
        }
    }, [push, usdExchangeRate])

    /**
     * 🔄 Refresh Products - Call after successful invoice to sync stock
     */
    const refreshProducts = useCallback(async (overrideRate = null) => {
        try {
            const { data } = await api.get('/inventory/items', { params: { limit: 5000 } })
            const list = Array.isArray(data) ? data : (data.items || [])
            const rate = Number(overrideRate) || Number(usdExchangeRate) || 7.30

            setProducts(list.map(p => {
                let basePrice = Number(p.price) || 0
                let wholesalePrice = Number(p.wholesalePrice) || basePrice
                let costPrice = Number(p.cost) || 0

                if (p.pricingCurrency === 'USD' || Number(p.priceUSD) > 0) {
                    if (Number(p.priceUSD) > 0) {
                        basePrice = Math.round(Number(p.priceUSD) * rate * 100) / 100
                    }
                    if (Number(p.wholesalePriceUSD) > 0) {
                        wholesalePrice = Math.round(Number(p.wholesalePriceUSD) * rate * 100) / 100
                    }
                    if (Number(p.costUSD) > 0) {
                        costPrice = Math.round(Number(p.costUSD) * rate * 100) / 100
                    }
                }

                let minPrice = p.minPrice
                let maxPrice = p.maxPrice
                if (Number(p.minPriceUSD) > 0) {
                    minPrice = Math.round(Number(p.minPriceUSD) * rate * 100) / 100
                }
                if (Number(p.maxPriceUSD) > 0) {
                    maxPrice = Math.round(Number(p.maxPriceUSD) * rate * 100) / 100
                }

                return {
                    id: p._id || p.id,
                    name: p.name,
                    sku: p.sku,
                    barcode: p.barcode,
                    price: basePrice,
                    wholesalePrice,
                    minPrice,
                    maxPrice,
                    pricingCurrency: p.pricingCurrency || (Number(p.priceUSD) > 0 ? 'USD' : 'LYD'),
                    priceUSD: Number(p.priceUSD) || 0,
                    costUSD: Number(p.costUSD) || 0,
                    wholesalePriceUSD: Number(p.wholesalePriceUSD) || 0,
                    minPriceUSD: Number(p.minPriceUSD) || 0,
                    maxPriceUSD: Number(p.maxPriceUSD) || 0,
                    stock: p.totalStock ?? p.stock ?? 0,
                    stocks: p.stocks || [],
                    totalStock: p.totalStock ?? p.stock ?? 0,
                    cost: costPrice,
                    category: typeof p.category === 'object' ? (p.category?.name || 'عام') : (p.category || 'عام'),
                    image: p.image,
                    isBundle: !!p.isBundle,
                    bundleComponents: p.bundleComponents || []
                }
            }))
        } catch (err) {
            console.error('Failed to refresh products', err)
        }
    }, [usdExchangeRate])

    useEffect(() => {
        const fetchData = async () => {
            setLoadingProducts(true)
            try {
                const [itemsRes, warehousesRes, customersRes] = await Promise.all([
                    api.get('/inventory/items', { params: { limit: 5000 } }),
                    api.get('/inventory/warehouses'),
                    api.get('/customers')
                ])

                const rate = Number(usdExchangeRate) || 7.30
                const list = Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data.items || [])
                setProducts(list.map(p => {
                    let basePrice = Number(p.price) || 0
                    let costPrice = Number(p.cost) || 0
                    let wholesalePrice = Number(p.wholesalePrice) || basePrice

                    if (p.pricingCurrency === 'USD' || Number(p.priceUSD) > 0) {
                        if (Number(p.priceUSD) > 0) {
                            basePrice = Math.round(Number(p.priceUSD) * rate * 100) / 100
                        }
                        if (Number(p.wholesalePriceUSD) > 0) {
                            wholesalePrice = Math.round(Number(p.wholesalePriceUSD) * rate * 100) / 100
                        }
                        if (Number(p.costUSD) > 0) {
                            costPrice = Math.round(Number(p.costUSD) * rate * 100) / 100
                        }
                    }

                    let explicitMin = p.minPrice != null && p.minPrice !== '' && Number(p.minPrice) > 0 ? Number(p.minPrice) : 0
                    let explicitMax = p.maxPrice != null && p.maxPrice !== '' && Number(p.maxPrice) > 0 ? Number(p.maxPrice) : 0

                    if (p.pricingCurrency === 'USD' || Number(p.priceUSD) > 0) {
                        if (p.minPriceUSD && Number(p.minPriceUSD) > 0) {
                            explicitMin = Math.round(Number(p.minPriceUSD) * rate * 100) / 100
                        }
                        if (p.maxPriceUSD && Number(p.maxPriceUSD) > 0) {
                            explicitMax = Math.round(Number(p.maxPriceUSD) * rate * 100) / 100
                        }
                    }

                    const minPrice = explicitMin > 0 ? explicitMin : (wholesalePrice > 0 ? wholesalePrice : (costPrice > 0 ? costPrice : Math.round(basePrice * 0.8 * 100) / 100))
                    const maxPrice = explicitMax > 0 ? explicitMax : Math.round(basePrice * 1.5 * 100) / 100

                    return {
                        id: p._id || p.id,
                        name: p.name,
                        sku: p.sku,
                        barcode: p.barcode,
                        price: basePrice,
                        wholesalePrice,
                        minPrice,
                        maxPrice,
                        minPriceUSD: Number(p.minPriceUSD) || 0,
                        maxPriceUSD: Number(p.maxPriceUSD) || 0,
                        pricingCurrency: p.pricingCurrency || (Number(p.priceUSD) > 0 ? 'USD' : 'LYD'),
                        priceUSD: Number(p.priceUSD) || 0,
                        costUSD: Number(p.costUSD) || 0,
                        wholesalePriceUSD: Number(p.wholesalePriceUSD) || 0,
                        unit: p.unit || p.uom || 'قطعة',
                        stock: p.totalStock ?? p.stock ?? 0,
                        stocks: p.stocks || [],
                        totalStock: p.totalStock ?? p.stock ?? 0,
                        cost: costPrice,
                        category: typeof p.category === 'object' ? (p.category?.name || 'عام') : (p.category || 'عام'),
                        image: p.image,
                        isBundle: !!p.isBundle,
                        bundleComponents: p.bundleComponents || []
                    }
                }))

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
    }, [push, usdExchangeRate])

    // Merge warehouse lists
    const activeWarehouses = useMemo(() => {
        if (warehouses && warehouses.length > 0) return warehouses
        if (contextWarehouses && contextWarehouses.length > 0) return contextWarehouses
        return []
    }, [warehouses, contextWarehouses])

    // ==================== AUTO-SELECT TREASURY ====================
    useEffect(() => {
        const fetchTreasuries = async () => {
            try {
                const { data } = await api.get('/finance/treasuries')
                setTreasuries(data || [])
                if (data && data.length > 0 && !selectedTreasury) {
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
            const pCat = typeof p.category === 'object' ? p.category?.name : p.category
            const matchCategory = selectedCategory ? pCat === selectedCategory : true
            return matchQuery && matchCategory
        })
    }, [query, selectedCategory, products])

    // ==================== CATEGORIES (MEMOIZED) ====================
    const categories = useMemo(() => {
        const cats = new Set(
            products
                .map(p => typeof p.category === 'object' ? p.category?.name : p.category)
                .filter(Boolean)
        )
        return Array.from(cats)
    }, [products])

    // ==================== FILTERED CUSTOMERS (MEMOIZED) ====================
    const filteredCustomers = useMemo(() => {
        const q = (customerSearch || '').trim().toLowerCase()
        if (!q) return customers.slice(0, 50)
        return customers.filter(c => {
            const name = (c.name || '').toLowerCase()
            const phone = (c.phone || '').toString().toLowerCase()
            const code = (c.code || '').toLowerCase()
            return name.includes(q) || phone.includes(q) || code.includes(q)
        }).slice(0, 50)
    }, [customers, customerSearch])

    // ==================== CART OPERATIONS (Supports 0-Stock, Negative Stock & Custom Items) ====================
    const addToCart = useCallback((product) => {
        if (!selectedWarehouseId && invoiceType !== INVOICE_TYPES.PROFORMA) {
            push('error', 'يرجى اختيار المخزن من القائمة العلوية أولاً')
            return
        }

        const warehouseStock = product.stocks?.find(s => {
            const warehouseId = s.warehouse?._id || s.warehouse
            const stockWarehouseId = warehouseId?.toString()
            const selectedId = selectedWarehouseId?.toString()
            return stockWarehouseId === selectedId
        })

        const availableQty = warehouseStock?.qty ?? 0
        const price = salesMode === SALES_MODES.WHOLESALE ? product.wholesalePrice : product.price

        setCartItems(prev => {
            const existing = prev.find(x => x.id === product.id)

            if (existing) {
                const newQty = existing.qty + 1
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
    }, [selectedWarehouseId, invoiceType, salesMode, push])

    /**
     * Add a Custom/Manual Item (غير مسجل في قاعدة البيانات) directly to the cart
     */
    const addCustomItem = useCallback((customData = {}) => {
        const customId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const newItem = {
            id: customId,
            _id: null,
            isCustom: true,
            name: customData.name || 'صنف حر جديد',
            sku: customData.sku || 'حر',
            barcode: '',
            unit: customData.unit || 'قطعة',
            qty: Math.max(1, Number(customData.qty) || 1),
            price: Math.max(0, Number(customData.price) || 0),
            retailPrice: Math.max(0, Number(customData.price) || 0),
            wholesalePrice: Math.max(0, Number(customData.price) || 0),
            cost: 0,
            availableInWarehouse: 0,
        }
        setCartItems(prev => [...prev, newItem])
        return newItem
    }, [])

    const updateItemName = useCallback((id, name) => {
        setCartItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, name }
            }
            return item
        }))
    }, [])

    const updateQty = useCallback((id, qty) => {
        setCartItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, qty: Math.max(1, Number(qty) || 1) }
            }
            return item
        }))
    }, [])

    const updatePrice = useCallback((id, price) => {
        setCartItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, price: Math.max(0, Number(price) || 0) }
            }
            return item
        }))
    }, [])

    const removeFromCart = useCallback((id) => {
        setCartItems(prev => prev.filter(item => item.id !== id))
    }, [])

    const clearCart = useCallback(() => {
        setCartItems([])
        setGlobalDiscount(0)
        setPaidAmount('')
        setCustomerId('')
        setCustomerSearch('')
        setCustomCustomerName('عميل نقدي')
        setWalletAmountToUse(0)
        setCustomerWalletBalance(0)
        setSelectedPaymentMethod(PAYMENT_METHODS.CASH)
        setSplitPayments([
            { method: PAYMENT_METHODS.CASH, amount: 0, treasury: '' },
            { method: PAYMENT_METHODS.CARD, amount: 0, treasury: '' }
        ])
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
            if (item.isCustom) return item
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

    const taxableAmount = Math.max(0, subtotal - Number(globalDiscount || 0))
    const taxAmount = Math.round(taxableAmount * (Number(taxRate || 0) / 100) * 100) / 100
    const totalAfterDiscount = Math.round((taxableAmount + taxAmount) * 100) / 100

    // POS Payment Calculations
    const effectivePaidAmount = useMemo(() => {
        if (selectedPaymentMethod === PAYMENT_METHODS.SPLIT) {
            return splitPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        }
        if (selectedPaymentMethod === PAYMENT_METHODS.CREDIT || selectedPaymentMethod === 'credit') {
            if (paidAmount === '' || paidAmount === null || paidAmount === undefined) {
                return 0
            }
            return Math.max(0, Math.min(Number(paidAmount), totalAfterDiscount))
        }
        return totalAfterDiscount
    }, [selectedPaymentMethod, splitPayments, totalAfterDiscount, paidAmount])

    const change = useMemo(() => {
        if (selectedPaymentMethod === PAYMENT_METHODS.CREDIT || selectedPaymentMethod === 'credit') {
            return 0
        }
        if (paidAmount && Number(paidAmount) > totalAfterDiscount) {
            return Number(paidAmount) - totalAfterDiscount
        }
        return Math.max(0, effectivePaidAmount - totalAfterDiscount)
    }, [selectedPaymentMethod, paidAmount, effectivePaidAmount, totalAfterDiscount])

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
            const payload = {
                ...newCustomer,
                code: newCustomer.code || `CUST-${Date.now().toString().slice(-6)}`
            }
            const { data } = await api.post('/customers', payload)
            setCustomers(prev => [...prev, data])
            setCustomerId(data._id)
            setCustomerSearch(data.name)
            setCustomCustomerName(data.name)
            setShowAddCustomer(false)
            setNewCustomer({ name: '', phone: '' })
            push('success', 'تم إضافة العميل بنجاح')
        } catch (err) {
            console.error('Failed to add customer', err)
            push('error', err?.response?.data?.message || 'فشل إضافة العميل')
        } finally {
            setAddingCustomer(false)
        }
    }, [newCustomer, push])

    // ==================== WALLET OPERATIONS ====================
    const fetchWalletBalance = useCallback(async (custId) => {
        if (!custId) {
            setCustomerWalletBalance(0)
            setWalletAmountToUse(0)
            return
        }
        setLoadingWallet(true)
        try {
            const { data } = await api.get(`/wallet/${custId}/balance`)
            setCustomerWalletBalance(data.availableCredit || data.walletBalance || 0)
        } catch (err) {
            console.error('Failed to fetch wallet balance', err)
            setCustomerWalletBalance(0)
        } finally {
            setLoadingWallet(false)
        }
    }, [])

    const applyWalletCredit = useCallback(() => {
        if (customerWalletBalance <= 0) {
            push('warning', 'لا يوجد رصيد في المحفظة')
            return
        }
        const maxUsable = Math.min(customerWalletBalance, totalAfterDiscount)
        setWalletAmountToUse(maxUsable)
        push('success', `تم تطبيق ${maxUsable.toLocaleString()} من المحفظة`)
    }, [customerWalletBalance, totalAfterDiscount, push])

    const clearWalletUsage = useCallback(() => {
        setWalletAmountToUse(0)
    }, [])

    useEffect(() => {
        fetchWalletBalance(customerId)
    }, [customerId, fetchWalletBalance])

    // ==================== HISTORY ====================
    const loadHistory = useCallback(async () => {
        setLoadingHistory(true)
        try {
            const { data } = await api.get('/sales/invoice?type=official&limit=50')
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

    const selectHistoryInvoice = useCallback((invoice) => {
        setSelectedHistoryInvoice(invoice)
        setShowHistory(false)
    }, [])

    // ==================== NEXT INVOICE NUMBER ====================
    const [nextInvoiceNumber, setNextInvoiceNumber] = useState('')

    const fetchNextInvoiceNumber = useCallback(async () => {
        try {
            const { data } = await api.get('/sales/invoice/next-number')
            if (data?.nextInvoiceNumber) {
                setNextInvoiceNumber(data.nextInvoiceNumber)
                return data.nextInvoiceNumber
            }
        } catch (err) {
            console.warn('Failed to fetch next invoice number:', err)
        }
        return null
    }, [])

    useEffect(() => {
        fetchNextInvoiceNumber()
        loadHistory()

        if (!socket) return

        const handleRemoteInvoiceSync = () => {
            fetchNextInvoiceNumber()
        }

        const handleExchangeRateUpdated = (data) => {
            if (reloadSettings) reloadSettings()
            if (refreshProducts) refreshProducts()
            if (data?.usdExchangeRate) {
                push('info', `💵 تم تحديث سعر صرف الدولار: 1$ = ${data.usdExchangeRate} د.ل`)
            }
        }

        socket.on('invoice:created', handleRemoteInvoiceSync)
        socket.on('stock:update', handleRemoteInvoiceSync)
        socket.on('exchange_rate_updated', handleExchangeRateUpdated)

        return () => {
            socket.off('invoice:created', handleRemoteInvoiceSync)
            socket.off('stock:update', handleRemoteInvoiceSync)
            socket.off('exchange_rate_updated', handleExchangeRateUpdated)
        }
    }, [fetchNextInvoiceNumber, loadHistory, socket, reloadSettings, refreshProducts, push])


    const getInvoiceStatus = useCallback((invoice) => {
        const total = invoice.totals?.grand || (invoice.items.reduce((acc, i) => acc + (i.qty * i.price), 0) - (invoice.discount || 0))
        const paid = invoice.totals?.paid || invoice.paid || 0

        if (paid >= total - 0.01) return INVOICE_STATUS.PAID
        if (paid > 0.01) return INVOICE_STATUS.PARTIAL
        return INVOICE_STATUS.UNPAID
    }, [])

    const filteredHistory = useMemo(() => {
        let filtered = [...historyList]

        if (historyFilters.searchQuery) {
            const q = historyFilters.searchQuery.toLowerCase()
            filtered = filtered.filter(inv =>
                inv._id?.toString().toLowerCase().includes(q) ||
                inv.customer?.name?.toLowerCase().includes(q) ||
                inv.customerName?.toLowerCase().includes(q) ||
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
            if (inv.totals?.grand) {
                return acc + inv.totals.grand
            }
            return acc + inv.items.reduce((sum, i) => sum + (i.qty * i.price), 0) - (inv.discount || 0)
        }, 0)

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
        const calculatedSubtotal = invoice.totals?.subtotal ?? invoice.items.reduce((acc, i) => acc + (i.qty * i.price), 0)
        const discount = invoice.totals?.discount ?? invoice.discountValue ?? invoice.discount ?? 0
        const calculatedTotal = invoice.totals?.grand ?? invoice.totals?.total ?? Math.max(0, calculatedSubtotal - discount)
        const paid = invoice.totals?.paid ?? invoice.paid ?? (invoice.paymentMethod === 'credit' ? 0 : calculatedTotal)
        const remaining = invoice.totals?.remaining ?? Math.max(0, calculatedTotal - paid)
        const isProforma = invoice.type === 'proforma' || invoice.type === 'quotation' || invoice.invoiceType === INVOICE_TYPES.PROFORMA

        const receiptData = {
            number: invoice.number || invoice.invoiceNumber || invoice._id,
            date: invoice.createdAt || invoice.date,
            invoiceType: isProforma ? INVOICE_TYPES.PROFORMA : INVOICE_TYPES.OFFICIAL,
            type: invoice.type,
            note: invoice.note,
            items: invoice.items.map(i => ({
                name: (typeof i.item === 'object' && i.item?.name) ? i.item.name : (i.name || 'منتج'),
                sku: (typeof i.item === 'object' && (i.item?.sku || i.item?.code)) ? (i.item.sku || i.item.code) : (i.sku || '-'),
                qty: i.qty,
                price: i.price,
                total: i.qty * i.price,
                isBundle: !!i.isBundle || !!i.item?.isBundle,
                bundleComponents: i.bundleComponents || i.item?.bundleComponents || []
            })),
            totals: {
                subtotal: calculatedSubtotal,
                discount,
                total: calculatedTotal,
                paid,
                remaining,
                change: Math.max(0, paid - calculatedTotal)
            },
            paymentMethod: invoice.paymentMethod || 'cash',
            customer: invoice.customer,
            customerName: invoice.customerName || invoice.customer?.name || 'عميل نقدي'
        }
        setLastInvoice(receiptData)
        setTimeout(() => window.print(), 300)
    }, [])

    // ==================== SAVE ORDER ====================
    const handleSaveOrder = useCallback(async (shouldPrint = false, options = {}) => {
        if (isSubmittingRef.current || saving) return false

        if (!cartItems.length) {
            push('error', 'السلة فارغة')
            return false
        }

        const isProforma = invoiceType === INVOICE_TYPES.PROFORMA

        if (!selectedWarehouseId && !isProforma) {
            push('error', 'يرجى اختيار المخزن من القائمة العلوية')
            return
        }

        // --- OFFICIAL VALIDATION ---
        const isCredit = !isProforma && (selectedPaymentMethod === PAYMENT_METHODS.CREDIT || selectedPaymentMethod === 'credit')
        if (isCredit && !customerId) {
            push('error', 'البيع الآجل يتطلب تحديد العميل المسجل أولاً')
            return
        }
        if (!isProforma && !isCredit &&
            selectedPaymentMethod !== PAYMENT_METHODS.SPLIT &&
            selectedPaymentMethod !== PAYMENT_METHODS.WALLET &&
            !selectedTreasury) {
            push('error', 'يرجى اختيار الخزينة المستهدفة')
            return
        } else if (isCredit && effectivePaidAmount > 0 && !selectedTreasury) {
            push('error', 'يرجى تحديد الخزينة لإيداع الدفعة النقدية')
            return
        } else if (!isProforma && selectedPaymentMethod === PAYMENT_METHODS.SPLIT) {
            const invalidSplit = splitPayments.find(p => p.amount > 0 && !p.treasury)
            if (invalidSplit) {
                push('error', 'يرجى تحديد الخزينة لكل دفعة في الدفع المختلط')
                return
            }
            if (effectivePaidAmount < totalAfterDiscount) {
                push('error', 'مجموع الدفعات أقل من المبلغ المطلوب')
                return
            }
        }

        try {
            isSubmittingRef.current = true
            setSaving(true)

            let actualPaymentMethod = selectedPaymentMethod
            let actualSplitDetails = null

            if (!isProforma && walletAmountToUse > 0) {
                const remainingAfterWallet = totalAfterDiscount - walletAmountToUse

                if (remainingAfterWallet <= 0) {
                    actualPaymentMethod = PAYMENT_METHODS.WALLET
                } else {
                    actualPaymentMethod = PAYMENT_METHODS.SPLIT
                    actualSplitDetails = [
                        { method: PAYMENT_METHODS.WALLET, amount: walletAmountToUse, treasury: null },
                        { method: selectedPaymentMethod, amount: remainingAfterWallet, treasury: selectedTreasury }
                    ]
                }
            }

            const isCreditPayment = actualPaymentMethod === PAYMENT_METHODS.CREDIT || actualPaymentMethod === 'credit'
            const currentExchangeRate = Number(usdExchangeRate) || 7.30
            const payload = {
                date: new Date().toISOString(),
                channel: salesMode,
                exchangeRate: currentExchangeRate,
                currency: 'LYD',
                items: cartItems.map(i => {
                    const rawId = i._id || i.id
                    const isValidMongoId = Boolean(rawId && /^[0-9a-fA-F]{24}$/.test(String(rawId)))
                    const isCustomItem = Boolean(i.isCustom || !isValidMongoId)
                    return {
                        item: isCustomItem ? null : rawId,
                        isCustom: isCustomItem,
                        name: (i.name || 'صنف حر').trim(),
                        sku: i.sku || (isCustomItem ? 'حر' : ''),
                        qty: Number(i.qty) || 1,
                        price: Number(i.price) || 0,
                        priceUSD: i.priceUSD || (Number(i.price) / currentExchangeRate),
                        cost: Number(i.cost) || 0,
                        costUSD: i.costUSD || (Number(i.cost) / currentExchangeRate),
                        pricingCurrency: i.pricingCurrency || 'LYD',
                        isBundle: !!i.isBundle,
                        bundleComponents: i.bundleComponents || []
                    }
                }),
                note: customCustomerName ? `POS Sale - ${customCustomerName}` : 'POS Sale',
                discountValue: Number(globalDiscount || 0),
                paid: isProforma ? 0 : effectivePaidAmount,
                paymentMethod: isProforma ? 'cash' : actualPaymentMethod,
                warehouse: selectedWarehouseId || undefined,
                treasury: (isProforma || actualPaymentMethod === PAYMENT_METHODS.WALLET || (isCreditPayment && effectivePaidAmount === 0))
                    ? null
                    : (actualPaymentMethod === PAYMENT_METHODS.SPLIT
                        ? (actualSplitDetails?.find(p => p.method !== PAYMENT_METHODS.WALLET)?.treasury || selectedTreasury)
                        : selectedTreasury),
                customer: customerId || undefined,
                customerName: customerId
                    ? (customers.find(c => c._id === customerId)?.name || customCustomerName?.trim() || 'عميل')
                    : (customCustomerName?.trim() || 'عميل نقدي'),
                status: isProforma ? 'draft' : 'posted',
                type: isProforma ? INVOICE_TYPES.PROFORMA : INVOICE_TYPES.OFFICIAL,
                allowCreditOverride: !!options.allowCreditOverride,
                ...(!isProforma && actualPaymentMethod === PAYMENT_METHODS.SPLIT && {
                    splitDetails: actualSplitDetails || splitPayments.map(p => ({
                        method: p.method,
                        amount: p.amount,
                        treasury: p.treasury
                    }))
                })
            }

            const { data } = await api.post('/sales/invoice-v2', payload)

            const remainingVal = Math.max(0, totalAfterDiscount - effectivePaidAmount)
            const receiptData = {
                number: data.number || data._id,
                date: data.date || payload.date,
                exchangeRate: currentExchangeRate,
                currency: 'LYD',
                items: cartItems.map(i => ({
                    name: i.name,
                    sku: i.sku || (i.isCustom ? 'حر' : '-'),
                    qty: i.qty,
                    price: i.price,
                    priceUSD: i.priceUSD || (Number(i.price) / currentExchangeRate),
                    total: i.price * i.qty,
                    isBundle: !!i.isBundle,
                    bundleComponents: i.bundleComponents || []
                })),
                totals: {
                    subtotal,
                    discount: Number(globalDiscount || 0),
                    total: totalAfterDiscount,
                    totalUSD: Number((totalAfterDiscount / currentExchangeRate).toFixed(2)),
                    paid: isProforma ? 0 : effectivePaidAmount,
                    paidUSD: Number((effectivePaidAmount / currentExchangeRate).toFixed(2)),
                    remaining: remainingVal,
                    remainingUSD: Number((remainingVal / currentExchangeRate).toFixed(2)),
                    change
                },
                paymentMethod: payload.paymentMethod,
                invoiceType,
                type: payload.type,
                customer: customerId ? customers.find(c => c._id === customerId) : null,
                customerName: customerId
                    ? (customers.find(c => c._id === customerId)?.name || customCustomerName?.trim() || 'عميل')
                    : (customCustomerName?.trim() || 'عميل نقدي')
            }

            setLastInvoice(receiptData)

            if (invoiceType === INVOICE_TYPES.OFFICIAL) {
                if (!socket) { refreshProducts().catch(() => { }) }
            }

            push('success', isProforma ? 'تم حفظ الفاتورة المبدئية (عرض السعر) بنجاح' : 'تم حفظ الفاتورة بنجاح')
            clearCart()
            fetchNextInvoiceNumber()
            loadHistory()

            if (shouldPrint) {
                setTimeout(() => {
                    if (!window.__isPrinting) {
                        window.__isPrinting = true
                        window.print()
                        setTimeout(() => { window.__isPrinting = false }, 1000)
                    }
                }, 300)
            }

            return true

        } catch (err) {
            console.error('POS Save Error:', err)

            let errorMessage = 'حدث خطأ غير متوقع'

            if (err.response) {
                const data = err.response.data

                if (data?.errors && Array.isArray(data.errors)) {
                    errorMessage = data.errors.map(e => e.msg || e.message).join(' | ')
                } else if (data?.message) {
                    errorMessage = data.message
                } else if (data?.error) {
                    errorMessage = data.error
                } else {
                    switch (err.response.status) {
                        case 400: errorMessage = 'بيانات غير صحيحة'; break
                        case 401: errorMessage = 'انتهت الجلسة، يرجى تسجيل الدخول'; break
                        case 403: errorMessage = 'ليس لديك صلاحية لهذه العملية'; break
                        case 404: errorMessage = 'المورد غير موجود'; break
                        case 409: errorMessage = 'تعارض في البيانات'; break
                        case 500: errorMessage = 'خطأ في السيرفر'; break
                        default: errorMessage = `خطأ: ${err.response.status}`
                    }
                }
            } else if (err.request) {
                errorMessage = '⚠️ تعذر الاتصال بالسيرفر. تحقق من الإنترنت.'
            } else {
                errorMessage = err.message || 'خطأ غير معروف'
            }

            push('error', errorMessage)
            return false
        } finally {
            isSubmittingRef.current = false
            setSaving(false)
        }
    }, [
        cartItems, selectedWarehouseId, invoiceType, selectedPaymentMethod, selectedTreasury,
        splitPayments, effectivePaidAmount, totalAfterDiscount, customerId, salesMode,
        globalDiscount, subtotal, paidAmount, change, push, clearCart, walletAmountToUse, customers,
        customCustomerName, usdExchangeRate, socket, refreshProducts, fetchNextInvoiceNumber, loadHistory, saving
    ])

    // ==================== RETURN API ====================
    return {
        // Data
        products,
        customers,
        warehouses: activeWarehouses,
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
        addCustomItem,
        updateItemName,
        addToCartBySku,
        updateQty,
        updatePrice,
        setCartItems,
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
        treasuries,
        invoiceType,
        setInvoiceType,
        globalDiscount,
        setGlobalDiscount,
        paidAmount,
        setPaidAmount,

        // Split & Payment Modal
        showSplitPayment,
        setShowSplitPayment,
        splitPayments,
        setSplitPayments,
        showPaymentModal,
        setShowPaymentModal,

        // Customer
        customerSearch,
        setCustomerSearch,
        customCustomerName,
        setCustomCustomerName,
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
        selectedHistoryInvoice,
        setSelectedHistoryInvoice,
        selectHistoryInvoice,
        historyList,
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
        refreshProducts,
        currency: CURRENCY,
        selectedWarehouseId,
        currentWarehouse,
        isWarehouseLocked,
        setWarehouse,
        selectWarehouse: setWarehouse,

        // Wallet
        customerWalletBalance,
        walletAmountToUse,
        setWalletAmountToUse,
        loadingWallet,
        applyWalletCredit,
        clearWalletUsage,

        // Current Auth User
        me,

        // Next Invoice Number
        nextInvoiceNumber,
        fetchNextInvoiceNumber,
        setNextInvoiceNumber,
    }
}
