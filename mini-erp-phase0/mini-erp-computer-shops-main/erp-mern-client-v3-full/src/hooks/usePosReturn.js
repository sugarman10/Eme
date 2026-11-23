import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useWarehouse } from '../context/WarehouseContext'
import { CURRENCY } from '../constants/posConstants'

/**
 * Audio beep helper using Web Audio API
 */
const playBeep = (isError = false) => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = audioCtx.createOscillator()
        const gain = audioCtx.createGain()
        osc.connect(gain)
        gain.connect(audioCtx.destination)

        if (isError) {
            osc.frequency.setValueAtTime(220, audioCtx.currentTime)
            osc.type = 'sawtooth'
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
            osc.start()
            osc.stop(audioCtx.currentTime + 0.25)
        } else {
            osc.frequency.setValueAtTime(750, audioCtx.currentTime)
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
            osc.start()
            osc.stop(audioCtx.currentTime + 0.12)
        }
    } catch {
        // AudioContext not supported
    }
}

/**
 * usePosReturn Hook - Dedicated Business Logic for POS Sales Returns
 * 
 * Powers both "مردود نقدي" (Cash Returns) and "مردود مبيعات" (Customer Returns)
 * with millimeter-level equivalence to the POS sales workstation.
 */
export function usePosReturn() {
    const { push } = useToast()
    const { me } = useAuth()
    const {
        selectedWarehouseId,
        currentWarehouse,
        selectWarehouse,
        setWarehouse: setContextWarehouse,
        warehouses: contextWarehouses
    } = useWarehouse()

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

    // ==================== RETURN CART STATE ====================
    const [cartItems, setCartItems] = useState([])
    const [globalDiscount, setGlobalDiscount] = useState(0)

    // ==================== SELECTION STATE ====================
    const [query, setQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [customerId, setCustomerId] = useState('')
    const [customCustomerName, setCustomCustomerName] = useState('عميل نقدي')
    const [selectedRefundMethod, setSelectedRefundMethod] = useState('cash')
    const [selectedTreasury, setSelectedTreasury] = useState('')
    const [originalInvoiceNumber, setOriginalInvoiceNumber] = useState('')
    const [originalInvoice, setOriginalInvoice] = useState(null)
    const [loadingInvoice, setLoadingInvoice] = useState(false)
    const [activeDeconstructBundle, setActiveDeconstructBundle] = useState(null)
    const [returnReason, setReturnReason] = useState('customer_return')
    const [returnNotes, setReturnNotes] = useState('')

    // ==================== INVOICES SIDEBAR STATE ====================
    const [recentInvoices, setRecentInvoices] = useState([])
    const [loadingInvoicesList, setLoadingInvoicesList] = useState(false)
    const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('')
    const [invoiceDateFilter, setInvoiceDateFilter] = useState('all') // 'all' | 'today'
    const [sidebarTab, setSidebarTab] = useState('invoices') // 'invoices' | 'products'

    // ==================== MODALS & POPUPS ====================
    const [showReturnModal, setShowReturnModal] = useState(false)
    const [showAddCustomer, setShowAddCustomer] = useState(false)
    const [customerSearch, setCustomerSearch] = useState('')
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })
    const [addingCustomer, setAddingCustomer] = useState(false)
    const [saving, setSaving] = useState(false)
    const [lastReturn, setLastReturn] = useState(null)

    // ==================== HISTORY DRAWER STATE ====================
    const [showHistory, setShowHistory] = useState(false)
    const [selectedHistoryReturn, setSelectedHistoryReturn] = useState(null)
    const [historyList, setHistoryList] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [historySearch, setHistorySearch] = useState('')

    // ==================== NEXT RETURN NUMBER ====================
    const [nextReturnNumber, setNextReturnNumber] = useState('')

    const fetchNextReturnNumber = useCallback(async () => {
        try {
            const res = await api.get('/sales/returns/next-number')
            if (res.data?.nextReturnNumber) {
                setNextReturnNumber(res.data.nextReturnNumber)
                return res.data.nextReturnNumber
            }
        } catch {
            // fallback
            const fallbackNum = `RET-${String(Date.now()).slice(-5)}`
            setNextReturnNumber(fallbackNum)
            return fallbackNum
        }
        return null
    }, [])

    // ==================== FETCH MASTER DATA ====================
    const refreshProducts = useCallback(async () => {
        try {
            setLoadingProducts(true)
            const [itemsRes, custRes, treasRes, whRes] = await Promise.all([
                api.get('/inventory/items'),
                api.get('/customers'),
                api.get('/finance/treasuries'),
                api.get('/inventory/warehouses')
            ])

            const activeItems = (itemsRes.data?.items || itemsRes.data || []).filter(i => i.status !== 'inactive')
            setProducts(activeItems.map(p => ({
                id: p._id,
                sku: p.sku || p.code || '',
                name: p.name || 'صنف بدون اسم',
                barcode: p.barcode || p.sku || '',
                category: typeof p.category === 'object' ? p.category?.name : (p.category || 'عام'),
                price: p.retailPrice || p.price || 0,
                retailPrice: p.retailPrice || p.price || 0,
                wholesalePrice: p.wholesalePrice || p.retailPrice || p.price || 0,
                cost: p.costPrice || p.cost || 0,
                stock: p.totalStock || 0,
                stocks: p.stocks || [],
                unit: p.unit || 'قطعة',
                image: p.image || null,
                minSellingPrice: p.minSellingPrice || 0
            })))

            const custData = custRes.data?.customers || custRes.data || []
            setCustomers(custData)

            const treasData = treasRes.data?.treasuries || treasRes.data || []
            setTreasuries(treasData)
            if (treasData.length > 0 && !selectedTreasury) {
                const defaultTreasury = treasData.find(t => t.isDefault) || treasData[0]
                setSelectedTreasury(defaultTreasury._id)
            }

            const whData = whRes.data?.warehouses || whRes.data || []
            setWarehouses(whData)
        } catch (err) {
            console.error('Failed to load return master data:', err)
            push('error', 'فشل تحميل بيانات الأصناف والمخازن')
        } finally {
            setLoadingProducts(false)
        }
    }, [push, selectedTreasury])

    useEffect(() => {
        refreshProducts()
        fetchNextReturnNumber()
        loadReturnHistory()
        fetchRecentInvoices('', 'all')
    }, [])

    // ==================== CART OPERATIONS ====================
    const addToCart = useCallback((product, qty = 1) => {
        if (!product) return

        setCartItems(prev => {
            const existingIdx = prev.findIndex(item => item.id === product.id)
            if (existingIdx > -1) {
                const updated = [...prev]
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    qty: updated[existingIdx].qty + qty
                }
                return updated
            } else {
                return [...prev, {
                    id: product.id,
                    sku: product.sku,
                    name: product.name,
                    price: product.price,
                    cost: product.cost,
                    unit: product.unit,
                    qty: qty,
                    stock: product.stock,
                    stocks: product.stocks,
                    image: product.image
                }]
            }
        })
        playBeep(false)
    }, [])

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
            playBeep(true)
            return false
        }
    }, [products, addToCart, push])

    const updateQty = useCallback((itemId, newQty) => {
        const qty = Number(newQty)
        if (isNaN(qty) || qty <= 0) {
            setCartItems(prev => prev.filter(i => i.id !== itemId))
            return
        }
        setCartItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, qty } : item
        ))
    }, [])

    const updatePrice = useCallback((itemId, newPrice) => {
        const price = Number(newPrice)
        if (isNaN(price) || price < 0) return
        setCartItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, price } : item
        ))
    }, [])

    const removeFromCart = useCallback((itemId) => {
        setCartItems(prev => prev.filter(item => item.id !== itemId))
        playBeep(false)
    }, [])

    const clearCart = useCallback(() => {
        setCartItems([])
        setGlobalDiscount(0)
        setCustomerId('')
        setCustomerSearch('')
        setCustomCustomerName('عميل نقدي')
        setOriginalInvoiceNumber('')
        setOriginalInvoice(null)
        setReturnNotes('')
        // Reset refund method & reason to defaults for next return session
        setSelectedRefundMethod('cash')
        setReturnReason('customer_return')
    }, [])

    const addItemsToReturnCart = useCallback((itemsToAdd) => {
        const toAdd = Array.isArray(itemsToAdd) ? itemsToAdd : [itemsToAdd]
        setCartItems(prev => {
            const updated = [...prev]
            for (const it of toAdd) {
                const existingIdx = updated.findIndex(existing => existing.id === it.id)
                if (existingIdx > -1) {
                    updated[existingIdx] = {
                        ...updated[existingIdx],
                        qty: Number(updated[existingIdx].qty || 1) + (Number(it.qty) || 1)
                    }
                } else {
                    updated.push({
                        ...it,
                        qty: Number(it.qty) || 1
                    })
                }
            }
            return updated
        })
        playBeep(false)
    }, [])

    // ==================== FETCH ORIGINAL INVOICE ====================
    const fetchOriginalInvoice = useCallback(async (invNum) => {
        const query = (invNum || originalInvoiceNumber || '').trim()
        if (!query) {
            push('error', 'يرجى إدخال رقم الفاتورة أو مسح الباركود')
            playBeep(true)
            return null
        }
        try {
            setLoadingInvoice(true)
            let res
            try {
                res = await api.get(`/sales/invoices?number=${encodeURIComponent(query)}&limit=5`)
            } catch {
                res = await api.get(`/sales/invoice?number=${encodeURIComponent(query)}&limit=5`)
            }

            const data = res?.data
            const invList = data?.docs || data?.invoices || data?.items || (Array.isArray(data) ? data : [])
            let foundInvoice = invList[0]

            if (!foundInvoice && /^[0-9a-fA-F]{24}$/.test(query)) {
                try {
                    const directRes = await api.get(`/sales/invoice/${query}`)
                    foundInvoice = directRes.data?.invoice || directRes.data?.doc || directRes.data
                } catch {
                    // ignore
                }
            }

            if (!foundInvoice) {
                push('error', `لم يتم العثور على الفاتورة: ${query}`)
                playBeep(true)
                return null
            }

            setOriginalInvoice(foundInvoice)
            setOriginalInvoiceNumber(foundInvoice.number || query)
            if (foundInvoice.customer) {
                const cId = foundInvoice.customer._id || foundInvoice.customer
                setCustomerId(cId)
                setCustomCustomerName(foundInvoice.customerName || foundInvoice.customer?.name || 'عميل مسجل')
            } else if (foundInvoice.customerName) {
                setCustomCustomerName(foundInvoice.customerName)
            }
            if (foundInvoice.warehouse) {
                setWarehouse(foundInvoice.warehouse._id || foundInvoice.warehouse)
            }
            playBeep(false)
            push('success', `✓ تم استدعاء الفاتورة #${foundInvoice.number} وتفاصيلها بنجاح`)
            return foundInvoice
        } catch (err) {
            console.error('Failed to fetch invoice:', err)
            push('error', 'تعذر جلب بيانات الفاتورة الأصلية')
            playBeep(true)
            return null
        } finally {
            setLoadingInvoice(false)
        }
    }, [originalInvoiceNumber, push, setWarehouse])

    // ==================== RECENT INVOICES LIST OPERATIONS ====================
    const fetchRecentInvoices = useCallback(async (searchQuery = '', dateFilter = 'all') => {
        try {
            setLoadingInvoicesList(true)
            const params = { limit: 50, status: 'confirmed,posted,paid' }
            const q = (typeof searchQuery === 'string' ? searchQuery : invoiceSearchQuery).trim()
            if (q) {
                params.number = q
            }
            const activeFilter = dateFilter !== undefined ? dateFilter : invoiceDateFilter
            if (activeFilter === 'today') {
                const today = new Date().toISOString().split('T')[0]
                params.from = today
                params.to = today
            }

            let res
            try {
                res = await api.get('/sales/invoices', { params })
            } catch {
                res = await api.get('/sales/invoice', { params })
            }

            const docs = res.data?.docs || res.data?.invoices || (Array.isArray(res.data) ? res.data : [])
            setRecentInvoices(docs)
            return docs
        } catch (err) {
            console.error('Failed to load recent invoices for return:', err)
            return []
        } finally {
            setLoadingInvoicesList(false)
        }
    }, [invoiceSearchQuery, invoiceDateFilter])

    const selectInvoice = useCallback((inv) => {
        if (!inv) return
        setOriginalInvoice(inv)
        setOriginalInvoiceNumber(inv.number || '')
        if (inv.customer) {
            const cId = inv.customer._id || inv.customer
            setCustomerId(cId)
            setCustomCustomerName(inv.customerName || inv.customer?.name || 'عميل مسجل')
        } else if (inv.customerName) {
            setCustomCustomerName(inv.customerName)
        }
        if (inv.warehouse) {
            setWarehouse(inv.warehouse._id || inv.warehouse)
        }
        playBeep(false)
        push('success', `✓ تم تحديد الفاتورة #${inv.number}`)
    }, [setWarehouse, push])

    const addItemFromInvoice = useCallback((invItem) => {
        if (!invItem) return
        const itemId = invItem.item?._id || invItem.item || invItem._id
        const isBundle = Boolean(invItem.isBundle || invItem.bundleComponents?.length)

        if (isBundle) {
            setActiveDeconstructBundle(invItem)
            return
        }

        setCartItems(prev => {
            const existingIdx = prev.findIndex(item => item.id === itemId || item.item === itemId)
            const maxAllowed = Number(invItem.qty) || 999

            if (existingIdx > -1) {
                if (prev[existingIdx].qty >= maxAllowed) {
                    push('warning', `تمت إضافة أقصى كمية مباعة لهذا الصنف (${maxAllowed})`)
                    return prev
                }
                const updated = [...prev]
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    qty: updated[existingIdx].qty + 1
                }
                return updated
            } else {
                return [...prev, {
                    id: itemId,
                    item: itemId,
                    name: invItem.name || invItem.item?.name || 'صنف',
                    sku: invItem.sku || invItem.item?.sku || '',
                    price: Number(invItem.price || invItem.unitPrice || 0),
                    qty: 1,
                    maxQty: maxAllowed,
                    reason: returnReason || 'customer_return',
                    isBundle: false,
                    parentBundle: null
                }]
            }
        })
        playBeep(false)
        push('success', `✓ تمت إضافة "${invItem.name || 'الصنف'}" للمرتجع`)
    }, [returnReason, push])

    // ==================== TOTALS CALCULATIONS ====================
    const subtotal = useMemo(() => {
        return cartItems.reduce((acc, item) => acc + (Number(item.qty || 1) * Number(item.price || 0)), 0)
    }, [cartItems])

    const totalAfterDiscount = useMemo(() => {
        return Math.max(0, subtotal - Number(globalDiscount || 0))
    }, [subtotal, globalDiscount])

    // ==================== CUSTOMER MANAGEMENT ====================
    const handleAddCustomer = useCallback(async () => {
        if (!newCustomer.name || !newCustomer.name.trim()) {
            push('error', 'يرجى إدخال اسم العميل')
            return
        }

        try {
            setAddingCustomer(true)
            const code = `CUST-${String(Date.now()).slice(-4)}`
            const res = await api.post('/customers', {
                ...newCustomer,
                code,
                type: 'retail',
                creditLimit: 0,
                balance: 0
            })

            const created = res.data?.customer || res.data
            push('success', `تمت إضافة العميل: ${created.name}`)
            setCustomers(prev => [created, ...prev])
            setCustomerId(created._id)
            setCustomCustomerName(created.name)
            setNewCustomer({ name: '', phone: '' })
            setShowAddCustomer(false)
        } catch (err) {
            push('error', err.response?.data?.message || 'فشل حفظ العميل')
        } finally {
            setAddingCustomer(false)
        }
    }, [newCustomer, push])

    // ==================== RETURN HISTORY ====================
    const loadReturnHistory = useCallback(async () => {
        try {
            setLoadingHistory(true)
            const res = await api.get('/sales/returns')
            const list = res.data?.returns || res.data || []
            setHistoryList(Array.isArray(list) ? list : [])
        } catch (err) {
            console.error('Failed to load return history:', err)
        } finally {
            setLoadingHistory(false)
        }
    }, [])

    // ==================== SAVE RETURN (ATOMIC POSTING) ====================
    const handleSaveReturn = useCallback(async (shouldPrint = false) => {
        if (!cartItems.length) {
            push('error', 'يرجى إضافة أصناف للإرجاع أولاً')
            playBeep(true)
            return false
        }

        if (!selectedWarehouseId) {
            push('error', 'يرجى اختيار المخزن المستلم للبضاعة المرجعة')
            playBeep(true)
            return false
        }

        if (selectedRefundMethod === 'credit' && !customerId) {
            push('error', 'يلزم تحديد عميل مسجل لتسوية المرتجع على حسابه (إشعار دائن)')
            playBeep(true)
            return false
        }

        try {
            setSaving(true)

            const payload = {
                invoiceId: originalInvoice?._id || undefined,
                items: cartItems.map(i => ({
                    item: i.item || i.id,
                    name: i.name,
                    qty: Number(i.qty) || 1,
                    unitPrice: Number(i.price) || 0,
                    reason: i.reason || returnReason || 'customer_return',
                    isBundle: Boolean(i.isBundle),
                    bundleComponents: i.bundleComponents || [],
                    parentBundle: i.parentBundle || null,
                    serials: i.serials || []
                })),
                warehouse: selectedWarehouseId,
                refundMethod: selectedRefundMethod,
                treasury: ['cash', 'bank'].includes(selectedRefundMethod) ? selectedTreasury : null,
                customer: customerId || undefined,
                note: `${customCustomerName ? `مرتجع مبيعات - ${customCustomerName}. ` : ''}${returnNotes || ''}${originalInvoiceNumber ? ` [فاتورة أصلية: ${originalInvoiceNumber}]` : ''}`,
                autoApprove: true // Automatically post, restore stock, and process cash/credit
            }

            const res = await api.post('/sales/returns', payload)
            const savedReturn = res.data?.return || res.data

            playBeep(false)
            push('success', `✓ تم إتمام وحفظ المرتجع بنجاح #${savedReturn.returnNumber || nextReturnNumber || ''}`)

            setLastReturn(savedReturn)

            if (shouldPrint) {
                setTimeout(() => window.print(), 300)
            }

            // Reset return cart & refresh master state
            clearCart()
            fetchNextReturnNumber()
            loadReturnHistory()
            refreshProducts()

            return true
        } catch (err) {
            console.error('Save Return Error:', err)
            playBeep(true)
            push('error', err.response?.data?.message || err.message || 'فشل حفظ المرتجع')
            return false
        } finally {
            setSaving(false)
        }
    }, [
        cartItems, selectedWarehouseId, selectedRefundMethod, customerId,
        selectedTreasury, customCustomerName, returnNotes, originalInvoiceNumber,
        returnReason, nextReturnNumber, clearCart, fetchNextReturnNumber,
        loadReturnHistory, refreshProducts, push
    ])

    return {
        // Warehouse & Auth
        me,
        warehouses: contextWarehouses || warehouses,
        selectedWarehouseId,
        currentWarehouse,
        setWarehouse,
        selectWarehouse: setWarehouse,

        // Master Data
        products,
        loadingProducts,
        refreshProducts,
        customers,
        treasuries,
        currency: CURRENCY,

        // Cart
        cartItems,
        setCartItems,
        addToCart,
        addToCartBySku,
        updateQty,
        updatePrice,
        removeFromCart,
        clearCart,
        subtotal,
        globalDiscount,
        setGlobalDiscount,
        totalAfterDiscount,

        // Selection & Parameters
        query,
        setQuery,
        selectedCategory,
        setSelectedCategory,
        customerId,
        setCustomerId,
        customCustomerName,
        setCustomCustomerName,
        selectedRefundMethod,
        setSelectedRefundMethod,
        selectedTreasury,
        setSelectedTreasury,
        originalInvoiceNumber,
        setOriginalInvoiceNumber,
        originalInvoice,
        setOriginalInvoice,
        loadingInvoice,
        fetchOriginalInvoice,
        activeDeconstructBundle,
        setActiveDeconstructBundle,
        addItemsToReturnCart,
        returnReason,
        setReturnReason,
        returnNotes,
        setReturnNotes,

        // Modals & UI
        showReturnModal,
        setShowReturnModal,
        showAddCustomer,
        setShowAddCustomer,
        customerSearch,
        setCustomerSearch,
        newCustomer,
        setNewCustomer,
        addingCustomer,
        handleAddCustomer,
        saving,
        lastReturn,

        // History
        showHistory,
        setShowHistory,
        historyList,
        loadingHistory,
        loadReturnHistory,
        selectedHistoryReturn,
        setSelectedHistoryReturn,

        // Next Return #
        nextReturnNumber,
        fetchNextReturnNumber,

        // Save
        handleSaveReturn,

        // Invoices Sidebar
        recentInvoices,
        loadingInvoicesList,
        invoiceSearchQuery,
        setInvoiceSearchQuery,
        invoiceDateFilter,
        setInvoiceDateFilter,
        sidebarTab,
        setSidebarTab,
        fetchRecentInvoices,
        selectInvoice,
        addItemFromInvoice
    }
}
