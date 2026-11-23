import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Barcode, Trash2, Plus, Minus, Save, Printer, FileSpreadsheet,
    RotateCcw, ArrowRight, ArrowLeft, LogOut, CheckCircle2, AlertCircle,
    Archive, ShoppingCart, Package, Layers, FileText, ChevronDown, Check,
    Sparkles, Clock, Calendar, User, Building2, Store, Zap, RefreshCw, X,
    Menu, LayoutDashboard, SlidersHorizontal, UserPlus, Edit, Edit3, Users,
    CreditCard, Wallet, Banknote, Cpu, Lock
} from 'lucide-react'
import * as XLSX from 'xlsx'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import { INVOICE_TYPES, SALES_MODES, PAYMENT_METHODS, PAYMENT_METHOD_CONFIG } from '../../constants/posConstants'
import { ConfirmModal } from './modals/ConfirmModal'
import { PaymentModal } from './modals/PaymentModal'
import { PcBuilderModal } from './modals/PcBuilderModal'
import { ExchangeRateModal } from './modals/ExchangeRateModal'
import ItemHistoryModal from '../modals/ItemHistoryModal'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'

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
            osc.frequency.setValueAtTime(880, audioCtx.currentTime)
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
            osc.start()
            osc.stop(audioCtx.currentTime + 0.12)
        }
    } catch {
        // AudioContext not supported or allowed yet
    }
}

/**
 * FastInvoiceView - Master Integrated Retail & Sales Workstation
 * Matched 100% to the ERP system screenshot:
 * 
 * In RTL layout:
 * - Top Header: System branding, online status, and operations bar.
 * - Upper Card: Compact invoice metadata (Invoice #, Date, Time, Customer, Notes, Warehouse).
 * - Main Split Workstation:
 *   - RIGHT: "تفاصيل الفاتورة" (Table with Navy header, quantities +/-, subtotal, actions, totals).
 *   - LEFT: "دليل الأصناف" (Search, Categories with Arabic names, quick clickable item cards).
 *   - FAR LEFT: Slim Vertical Tool Strip (Quick actions: New, Save, Print, Hold, History, Nav Toggle).
 * - Bottom Bar: "إدخال صنف سريع" (Barcode scanner with Enter auto-submit).
 */
export const FastInvoiceView = ({
    pos,
    onExit,
    onSwitchMode,
    onToggleNav,
    showNavInPos,
    mode = 'cash'
}) => {
    const isCustomerMode = mode === 'customer'

    const {
        products = [],
        categories = [],
        cartItems = [],
        setCartItems,
        addToCart,
        addCustomItem,
        updateItemName,
        updateQty,
        updatePrice,
        removeFromCart,
        clearCart,
        subtotal = 0,
        globalDiscount = 0,
        setGlobalDiscount,
        totalAfterDiscount = 0,
        paidAmount,
        setPaidAmount,
        effectivePaidAmount,
        change,
        handleSaveOrder,
        handleHoldBill,
        saving = false,
        customers = [],
        customerId,
        setCustomerId,
        customCustomerName,
        setCustomCustomerName,
        warehouses = [],
        selectedWarehouseId,
        setWarehouse,
        currentWarehouse,
        isWarehouseLocked = false,
        selectedTreasury,
        setSelectedTreasury,
        treasuries = [],
        selectedPaymentMethod = PAYMENT_METHODS.CASH,
        setSelectedPaymentMethod,
        salesMode = SALES_MODES.RETAIL,
        setSalesMode,
        invoiceType = INVOICE_TYPES.OFFICIAL,
        setInvoiceType,
        customerSearch = '',
        setCustomerSearch,
        filteredCustomers = [],
        setShowAddCustomer,
        setShowSplitPayment,
        splitPayments = [],
        setSplitPayments,
        setShowHeldBills,
        showPaymentModal: posShowPaymentModal,
        setShowPaymentModal: posSetShowPaymentModal,
        customerWalletBalance = 0,
        walletAmountToUse = 0,
        setWalletAmountToUse,
        applyWalletCredit,
        refreshProducts,
        historyList = [],
        selectedHistoryInvoice,
        setSelectedHistoryInvoice,
        handleReprint,
        loadHistory,
        lastInvoice,
        currency = 'د.ل',
        me,
        nextInvoiceNumber: posNextNumber,
        fetchNextInvoiceNumber
    } = pos

    // Ensure history is loaded on mount
    useEffect(() => {
        if (loadHistory) {
            loadHistory()
        }
    }, [loadHistory])

    // Authenticated User from AuthContext or pos
    const { me: authUser, user: authUserAlt } = useAuth() || {}
    const currentUser = authUser || authUserAlt || me
    const loggedInName = currentUser?.name || currentUser?.username || 'المستخدم'
    const { push } = useToast()
    const canEditExchangeRate = Boolean(
        currentUser?.role === 'admin' ||
        currentUser?.permissions?.includes('exchange_rate_manage') ||
        currentUser?.permissions?.includes('*')
    )

    // Central Live USD Exchange Rate
    const { usdExchangeRate = 7.30, updateExchangeRate, exchangeRateUpdatedAt } = useSettings()
    const [showExchangeRateModal, setShowExchangeRateModal] = useState(false)

    // Local state fallback for Payment Modal
    const [localShowPaymentModal, setLocalShowPaymentModal] = useState(false)
    const showPaymentModal = posShowPaymentModal !== undefined ? posShowPaymentModal : localShowPaymentModal
    const setShowPaymentModal = posSetShowPaymentModal || setLocalShowPaymentModal

    // Real System Invoice Number State
    const [systemInvoiceNumber, setSystemInvoiceNumber] = useState(posNextNumber || '')

    // Keep system invoice number synchronized with backend
    useEffect(() => {
        if (posNextNumber) {
            setSystemInvoiceNumber(posNextNumber)
        }
        // Always refresh next invoice number on mount or prefix update
        if (fetchNextInvoiceNumber) {
            fetchNextInvoiceNumber().then(num => {
                if (num) setSystemInvoiceNumber(num)
            })
        } else {
            api.get('/sales/invoice/next-number')
                .then(res => {
                    if (res.data?.nextInvoiceNumber) {
                        setSystemInvoiceNumber(res.data.nextInvoiceNumber)
                    }
                })
                .catch(() => {})
        }
    }, [posNextNumber, fetchNextInvoiceNumber])

    const [currentTime, setCurrentTime] = useState('')
    const [currentDate, setCurrentDate] = useState('')
    const [invoiceNote, setInvoiceNote] = useState('')
    const [historyIndex, setHistoryIndex] = useState(-1)

    // Synchronize when an invoice is chosen from HistoryModal
    useEffect(() => {
        if (selectedHistoryInvoice) {
            const foundIndex = historyList.findIndex(inv =>
                (inv._id && selectedHistoryInvoice._id && inv._id.toString() === selectedHistoryInvoice._id.toString()) ||
                (inv.number && selectedHistoryInvoice.number && inv.number === selectedHistoryInvoice.number)
            )
            if (foundIndex !== -1) {
                setHistoryIndex(foundIndex)
            } else {
                setHistoryIndex(-1)
            }
            playBeep(false)
            const num = selectedHistoryInvoice.number || selectedHistoryInvoice._id?.slice(-6) || ''
            setFeedbackMessage({
                type: 'success',
                text: `تم فتح الفاتورة ${num} في شاشة البيع`
            })
            setTimeout(() => setFeedbackMessage(null), 3000)
        }
    }, [selectedHistoryInvoice, historyList])

    // Currently viewed historical invoice or null
    const activeHistoryInvoice = (historyIndex >= 0 && historyList && historyList[historyIndex])
        ? historyList[historyIndex]
        : (selectedHistoryInvoice || null)

    // Same-Day Cash Invoice Edit State
    const [editingInvoice, setEditingInvoice] = useState(null)
    const [editSaving, setEditSaving] = useState(false)

    // Item Movement & History Modal State (F1)
    const [historyModalItem, setHistoryModalItem] = useState(null)
    const [showHistoryModal, setShowHistoryModal] = useState(false)

    const openItemHistory = useCallback((product) => {
        setHistoryModalItem(product)
        setShowHistoryModal(true)
    }, [])

    // Custom Confirmation Dialog State (replaces window.confirm)
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'تأكيد',
        cancelText: 'إلغاء',
        altText: null,
        type: 'warning',
        onConfirm: () => {},
        onCancel: null,
        onAlt: null
    })

    // Check if invoice was issued today
    const isInvoiceSameDay = useCallback((inv) => {
        if (!inv) return false
        const invDate = new Date(inv.date || inv.createdAt)
        const today = new Date()
        return (
            invDate.getFullYear() === today.getFullYear() &&
            invDate.getMonth() === today.getMonth() &&
            invDate.getDate() === today.getDate()
        )
    }, [])

    // Check if invoice is cash
    const isInvoiceCash = useCallback((inv) => {
        if (!inv) return false
        if (inv.paymentMethod === 'cash' || !inv.paymentMethod) return true
        const custName = inv.customer?.name || ''
        return !inv.customer || custName.includes('نقدي')
    }, [])

    // Check if the currently viewed invoice can be edited
    const canEditActiveInvoice = useMemo(() => {
        if (!activeHistoryInvoice) return false
        if (['void', 'cancelled', 'refunded'].includes(activeHistoryInvoice.status)) return false
        return isInvoiceSameDay(activeHistoryInvoice) && isInvoiceCash(activeHistoryInvoice)
    }, [activeHistoryInvoice, isInvoiceSameDay, isInvoiceCash])

    // Load invoice into active POS cart for editing
    const handleStartEditInvoice = useCallback((targetInvoice = activeHistoryInvoice) => {
        if (!targetInvoice) return

        // Map items to POS cart item structure
        const loadedItems = (targetInvoice.items || []).map((row, idx) => {
            const rowItem = typeof row.item === 'object' && row.item ? row.item : {}
            const prodId = rowItem._id || rowItem.id || row.item
            const fullProduct = products.find(p => (p.id || p._id)?.toString() === prodId?.toString()) || {}

            const warehouseStock = fullProduct.stocks?.find(s => {
                const whId = s.warehouse?._id || s.warehouse
                return whId?.toString() === (targetInvoice.warehouse?._id || targetInvoice.warehouse || selectedWarehouseId)?.toString()
            })
            const currentStock = warehouseStock?.qty ?? (fullProduct.totalStock || fullProduct.stock || 0)
            const oldQty = Number(row.qty) || 1

            return {
                id: prodId || `edit-item-${idx}`,
                _id: prodId,
                name: fullProduct.name || rowItem.name || row.name || 'صنف مبيعات',
                sku: fullProduct.sku || rowItem.sku || row.sku || '-',
                barcode: fullProduct.barcode || rowItem.barcode || row.barcode || '',
                unit: fullProduct.unit || rowItem.unit || row.unit || 'قطعة',
                price: Number(row.price) || 0,
                qty: oldQty,
                cost: Number(row.cost) || fullProduct.cost || 0,
                retailPrice: fullProduct.price || row.price,
                wholesalePrice: fullProduct.wholesalePrice || row.price,
                minPrice: fullProduct.minPrice,
                maxPrice: fullProduct.maxPrice,
                availableInWarehouse: currentStock + oldQty,
                isBundle: !!row.isBundle || !!rowItem.isBundle || !!fullProduct.isBundle,
                bundleComponents: (row.bundleComponents && row.bundleComponents.length > 0)
                    ? row.bundleComponents
                    : (rowItem.bundleComponents || fullProduct.bundleComponents || [])
            }
        })

        if (setCartItems) {
            setCartItems(loadedItems)
        }
        if (setGlobalDiscount) {
            setGlobalDiscount(targetInvoice.discountValue || targetInvoice.totals?.discount || 0)
        }
        setInvoiceNote(targetInvoice.note || '')
        if (setCustomCustomerName) {
            setCustomCustomerName(targetInvoice.customerName || targetInvoice.customer?.name || 'عميل نقدي')
        }
        setEditingInvoice(targetInvoice)
        setHistoryIndex(-1) // Exit history view and go to live cart
        if (setSelectedHistoryInvoice) {
            setSelectedHistoryInvoice(null)
        }

        if (targetInvoice.warehouse) {
            const whId = targetInvoice.warehouse._id || targetInvoice.warehouse
            if (whId && setWarehouse) {
                setWarehouse(whId)
            }
        }

        playBeep(false)
        setFeedbackMessage({
            type: 'success',
            text: `تم فتح الفاتورة ${targetInvoice.number} للتعديل`
        })
        setTimeout(() => setFeedbackMessage(null), 3000)
    }, [activeHistoryInvoice, products, selectedWarehouseId, setCartItems, setGlobalDiscount, setWarehouse])

    // Scanner and Barcode State
    const [fastBarcode, setFastBarcode] = useState('')
    const [feedbackMessage, setFeedbackMessage] = useState(null)
    const barcodeInputRef = useRef(null)

    // Customer Selection state for Customer Mode
    const selectedCustomer = useMemo(() => {
        if (!customerId || !customers || !customers.length) return null
        return customers.find(c => (c._id || c.id)?.toString() === customerId?.toString()) || null
    }, [customerId, customers])

    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
    const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(0)
    const customerSearchInputRef = useRef(null)
    const customerContainerRef = useRef(null)

    // Handle selecting a customer in Customer Mode
    const handleSelectCustomer = useCallback((customer) => {
        if (!customer) return
        const cId = (customer._id || customer.id)?.toString()
        setCustomerId(cId)
        if (setCustomerSearch) setCustomerSearch(customer.name || '')
        if (setCustomCustomerName) setCustomCustomerName(customer.name || '')
        setCustomerDropdownOpen(false)

        if (customer.type === 'wholesale' && setSalesMode) {
            setSalesMode(SALES_MODES.WHOLESALE)
            playBeep(false)
            setFeedbackMessage({
                type: 'info',
                text: `تم اختيار العميل: ${customer.name} وتفعيل أسعار الجملة`
            })
            setTimeout(() => setFeedbackMessage(null), 3000)
        } else if (setSalesMode) {
            setSalesMode(SALES_MODES.RETAIL)
        }
    }, [setCustomerId, setCustomerSearch, setCustomCustomerName, setSalesMode])

    // Handle clearing customer
    const handleClearCustomer = useCallback(() => {
        setCustomerId('')
        if (setCustomerSearch) setCustomerSearch('')
        if (setCustomCustomerName) setCustomCustomerName('عميل نقدي')
        if (setSalesMode) setSalesMode(SALES_MODES.RETAIL)
    }, [setCustomerId, setCustomerSearch, setCustomCustomerName, setSalesMode])

    // Close customer search dropdown on click outside
    useEffect(() => {
        if (!customerDropdownOpen) return
        const handleClickOutside = (e) => {
            if (customerContainerRef.current && !customerContainerRef.current.contains(e.target)) {
                setCustomerDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [customerDropdownOpen])

    // Keyboard navigation in customer search dropdown
    const handleCustomerKeyDown = useCallback((e) => {
        if (!customerDropdownOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setCustomerDropdownOpen(true)
                return
            }
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedCustomerIndex(prev => Math.min(prev + 1, (filteredCustomers?.length || 1) - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedCustomerIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (filteredCustomers && filteredCustomers[selectedCustomerIndex]) {
                handleSelectCustomer(filteredCustomers[selectedCustomerIndex])
            }
        } else if (e.key === 'Escape') {
            setCustomerDropdownOpen(false)
        }
    }, [customerDropdownOpen, filteredCustomers, selectedCustomerIndex, handleSelectCustomer])

    // Catalog Popup Modal State
    const [showCatalogModal, setShowCatalogModal] = useState(false)
    const [modalSearch, setModalSearch] = useState('')
    const [modalCategory, setModalCategory] = useState('')
    const [departments, setDepartments] = useState([])
    const modalSearchInputRef = useRef(null)

    // PC Builder Modal State
    const [showPcBuilderModal, setShowPcBuilderModal] = useState(false)
    const [editingBundleItem, setEditingBundleItem] = useState(null)

    // Modal Arrow & Mouse Navigation State
    const [modalSelectedIndex, setModalSelectedIndex] = useState(0)
    const modalRowRefs = useRef([])

    // Fast Item Entry Loop States & Refs (Qty -> Price -> Reopen Modal)
    const [focusedItemId, setFocusedItemId] = useState(null)
    const [focusedField, setFocusedField] = useState(null) // 'qty' | 'price'
    const qtyInputRefs = useRef({})
    const priceInputRefs = useRef({})
    const [priceError, setPriceError] = useState(null) // { itemId, message }

    // Add Custom PC Bundle to Cart
    const handleAddCustomBundle = useCallback((bundleItem) => {
        if (setCartItems) {
            setCartItems(prev => [bundleItem, ...prev])
        }
        playBeep(false)
        setFeedbackMessage({
            type: 'success',
            text: `تمت إضافة التجميعة المخصصة: ${bundleItem.name}`
        })
        setTimeout(() => setFeedbackMessage(null), 3000)
    }, [setCartItems])

    // Edit Custom PC Bundle from Cart
    const handleEditCustomBundle = useCallback((bundleItem) => {
        setEditingBundleItem(bundleItem)
        setShowPcBuilderModal(true)
    }, [])

    // Update Custom PC Bundle in Cart
    const handleUpdateCustomBundle = useCallback((updatedBundle) => {
        if (setCartItems) {
            setCartItems(prev => prev.map(it => (it.id === updatedBundle.id || it._id === updatedBundle._id) ? updatedBundle : it))
        }
        playBeep(false)
        setFeedbackMessage({
            type: 'success',
            text: `تم حفظ التعديلات على التجميعة: ${updatedBundle.name}`
        })
        setTimeout(() => setFeedbackMessage(null), 3000)
    }, [setCartItems])

    // Close PC Builder Modal
    const handleClosePcBuilder = useCallback(() => {
        setShowPcBuilderModal(false)
        setEditingBundleItem(null)
    }, [])

    // Helper: calculate min and max selling price bounds for an item
    const getItemPriceBounds = useCallback((item) => {
        const basePrice = Number(item.retailPrice || item.price) || 0
        const costPrice = Number(item.cost) || 0
        const wholesale = Number(item.wholesalePrice) || basePrice

        const hasExplicitMin = item.minPrice != null && item.minPrice !== '' && Number(item.minPrice) > 0
        const hasExplicitMax = item.maxPrice != null && item.maxPrice !== '' && Number(item.maxPrice) > 0

        let min = hasExplicitMin
            ? Number(item.minPrice)
            : (wholesale > 0 ? wholesale : (costPrice > 0 ? costPrice : Math.round(basePrice * 0.8 * 100) / 100))

        let max = hasExplicitMax
            ? Number(item.maxPrice)
            : Math.round(basePrice * 1.5 * 100) / 100

        if (hasExplicitMin && hasExplicitMax && min > max) {
            max = min
        }

        return { min, max }
    }, [])

    // Validate all items in cart against their price bounds before checkout
    const validateAllCartPrices = useCallback(() => {
        if (invoiceType === INVOICE_TYPES.PROFORMA) return true
        for (const item of cartItems) {
            if (item.isHistorical || item.isCustom) continue
            const { min, max } = getItemPriceBounds(item)
            const currentPrice = Number(item.price)
            if (currentPrice < min) {
                setPriceError({
                    itemId: item.id,
                    message: `السعر (${currentPrice}) أقل من أدنى سعر مسموح (${min})`
                })
                setFeedbackMessage({
                    type: 'error',
                    text: `سعر الصنف "${item.name}" (${currentPrice}) أقل من أدنى سعر مسموح به (${min})`
                })
                playBeep(true)
                const el = priceInputRefs.current[item.id]
                if (el) {
                    el.focus()
                    el.select()
                }
                return false
            }
            if (currentPrice > max) {
                setPriceError({
                    itemId: item.id,
                    message: `السعر (${currentPrice}) أعلى من أقصى سعر مسموح (${max})`
                })
                setFeedbackMessage({
                    type: 'error',
                    text: `سعر الصنف "${item.name}" (${currentPrice}) أعلى من أقصى سعر مسموح به (${max})`
                })
                playBeep(true)
                const el = priceInputRefs.current[item.id]
                if (el) {
                    el.focus()
                    el.select()
                }
                return false
            }
        }
        return true
    }, [cartItems, getItemPriceBounds, playBeep, invoiceType])

    // Handle Item Selection from Catalog Modal (السماح بإضافة الأصناف حتى لو كان الرصيد 0)
    const handleSelectProductFromModal = useCallback((product) => {
        const prodId = product.id || product._id

        const existing = cartItems.find(i => i.id === prodId)

        if (!existing) {
            addToCart(product)
        }

        playBeep(false)
        setShowCatalogModal(false)
        setPriceError(null)

        // Queue focus to Quantity field of this item
        setFocusedItemId(prodId)
        setFocusedField('qty')
    }, [cartItems, addToCart])

    // Manage Focus Transition (Qty -> Price)
    useEffect(() => {
        if (!focusedItemId || !focusedField) return

        const timer = setTimeout(() => {
            if (focusedField === 'qty') {
                const el = qtyInputRefs.current[focusedItemId]
                if (el) {
                    el.focus()
                    el.select()
                }
            } else if (focusedField === 'price') {
                const el = priceInputRefs.current[focusedItemId]
                if (el) {
                    el.focus()
                    el.select()
                }
            }
        }, 70)

        return () => clearTimeout(timer)
    }, [focusedItemId, focusedField, cartItems.length])

    // Quantity Input KeyDown: Press Enter -> move to Price
    const handleQtyKeyDown = (e, item) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            setFocusedItemId(item.id)
            setFocusedField('price')
        }
    }

    // Confirm Item Price and Re-open Catalog Modal
    const confirmItemPriceAndContinue = (item) => {
        const { min, max } = getItemPriceBounds(item)
        const currentPrice = Number(item.price)

        if (!item.isCustom && invoiceType !== INVOICE_TYPES.PROFORMA) {
            if (currentPrice < min) {
                setPriceError({
                    itemId: item.id,
                    message: `السعر (${currentPrice}) أقل من أدنى سعر مسموح (${min})`
                })
                playBeep(true)
                const el = priceInputRefs.current[item.id]
                if (el) {
                    el.focus()
                    el.select()
                }
                return
            }

            if (currentPrice > max) {
                setPriceError({
                    itemId: item.id,
                    message: `السعر (${currentPrice}) أعلى من أقصى سعر مسموح (${max})`
                })
                playBeep(true)
                const el = priceInputRefs.current[item.id]
                if (el) {
                    el.focus()
                    el.select()
                }
                return
            }
        }

        // Price is valid!
        setPriceError(null)
        playBeep(false)
        setFeedbackMessage({
            type: 'success',
            text: `تم اعتماد الصنف: ${item.name} | كمية: ${item.qty} | سعر: ${currentPrice}`
        })
        setTimeout(() => setFeedbackMessage(null), 2500)

        // Reset focus state and re-open modal for next item with debounce to prevent Enter key bounce
        setFocusedItemId(null)
        setFocusedField(null)
        setTimeout(() => {
            setShowCatalogModal(true)
        }, 150)
    }

    // Price Input KeyDown: Press Enter -> Confirm & Re-open Modal
    const handlePriceKeyDown = (e, item) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            confirmItemPriceAndContinue(item)
        }
    }

    // Load departments for Arabic category names in modal
    useEffect(() => {
        api.get('/departments')
            .then(res => setDepartments(res.data?.items || res.data || []))
            .catch(() => { })
    }, [])

    const getCategoryName = useCallback((catId) => {
        if (!catId) return 'عام'
        if (typeof catId === 'object') return catId.name || catId._id || 'عام'
        const found = departments.find(d => d._id === catId || d.name === catId)
        if (found) return found.name
        if (/^[0-9a-fA-F]{24}$/.test(catId)) return 'القسم الرئيسي'
        return String(catId)
    }, [departments])

    // Auto-focus search when modal opens, refocus barcode when modal closes if not editing an item
    useEffect(() => {
        if (showCatalogModal) {
            setTimeout(() => {
                modalSearchInputRef.current?.focus()
            }, 100)
        } else {
            if (!focusedItemId) {
                setTimeout(() => {
                    barcodeInputRef.current?.focus()
                }, 100)
            }
        }
    }, [showCatalogModal, focusedItemId])

    // Filtered products for modal
    const modalFilteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesQuery = !modalSearch ||
                (p.name && p.name.toLowerCase().includes(modalSearch.toLowerCase())) ||
                (p.sku && p.sku.toLowerCase().includes(modalSearch.toLowerCase())) ||
                (p.barcode && p.barcode.includes(modalSearch))

            const pCat = typeof p.category === 'object' ? (p.category.name || p.category._id) : p.category
            const matchesCategory = !modalCategory || pCat === modalCategory

            return matchesQuery && matchesCategory
        })
    }, [products, modalSearch, modalCategory])

    // Reset selected index when search, category, or modal opens
    useEffect(() => {
        setModalSelectedIndex(0)
    }, [modalSearch, modalCategory, showCatalogModal])

    // Scroll selected row into view when navigating with arrows
    useEffect(() => {
        if (showCatalogModal && modalRowRefs.current[modalSelectedIndex]) {
            modalRowRefs.current[modalSelectedIndex]?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            })
        }
    }, [modalSelectedIndex, showCatalogModal])

    const modalOpenTimestampRef = useRef(0)
    useEffect(() => {
        if (showCatalogModal) {
            modalOpenTimestampRef.current = Date.now()
        }
    }, [showCatalogModal])

    // Modal Arrow & Enter keyboard navigation handler
    const handleModalKeyDown = useCallback((e) => {
        if (!showCatalogModal || modalFilteredProducts.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setModalSelectedIndex(prev => Math.min(modalFilteredProducts.length - 1, prev + 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setModalSelectedIndex(prev => Math.max(0, prev - 1))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            // Ignore accidental Enter press immediately upon opening (within 200ms)
            if (Date.now() - modalOpenTimestampRef.current < 200) return

            const selectedProduct = modalFilteredProducts[modalSelectedIndex]
            if (selectedProduct) {
                handleSelectProductFromModal(selectedProduct)
            }
        } else if (e.key === 'Escape') {
            e.preventDefault()
            setShowCatalogModal(false)
        }
    }, [showCatalogModal, modalFilteredProducts, modalSelectedIndex, handleSelectProductFromModal])

    // Global keydown listener when modal is open (capture phase to run first)
    useEffect(() => {
        if (!showCatalogModal) return

        const onKeyDown = (e) => {
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                e.stopImmediatePropagation()
                handleModalKeyDown(e)
            }
        }

        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [showCatalogModal, handleModalKeyDown])

    // Keep Date and Time Fresh
    useEffect(() => {
        const updateClock = () => {
            const now = new Date()
            setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }))
            setCurrentDate(now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }))
        }
        updateClock()
        const interval = setInterval(updateClock, 10000)
        return () => clearInterval(interval)
    }, [])

    // Focus barcode scanner on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            barcodeInputRef.current?.focus()
        }, 200)
        return () => clearTimeout(timer)
    }, [])

    // New Invoice Reset (Refreshes next real invoice number from system)
    const handleNewInvoice = useCallback(async () => {
        setEditingInvoice(null)
        clearCart()
        setInvoiceNote('')
        setHistoryIndex(-1)
        if (setSelectedHistoryInvoice) setSelectedHistoryInvoice(null)
        if (setGlobalDiscount) setGlobalDiscount(0)
        if (!isCustomerMode) {
            setCustomerId('') // Ensure cash customer is enforced in cash mode
            if (setCustomCustomerName) setCustomCustomerName('عميل نقدي')
        }
        if (fetchNextInvoiceNumber) {
            const num = await fetchNextInvoiceNumber()
            if (num) setSystemInvoiceNumber(num)
        } else {
            try {
                const { data } = await api.get('/sales/invoice/next-number')
                if (data?.nextInvoiceNumber) setSystemInvoiceNumber(data.nextInvoiceNumber)
            } catch {
                // Keep current sequence
            }
        }
        barcodeInputRef.current?.focus()
    }, [clearCart, fetchNextInvoiceNumber, setCustomerId, setGlobalDiscount, setSelectedHistoryInvoice])

    // Cancel edit mode
    const handleCancelEdit = useCallback(() => {
        setConfirmDialog({
            isOpen: true,
            title: 'إلغاء تعديل الفاتورة',
            message: 'هل أنت متأكد من إلغاء تعديل الفاتورة والعودة لفاتورة جديدة؟\nسيتم التراجع عن جميع التغييرات غير المحفوظة.',
            type: 'danger',
            confirmText: 'نعم، إلغاء التعديل',
            cancelText: 'متابعة التعديل',
            onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                handleNewInvoice()
            },
            onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        })
    }, [handleNewInvoice])

    // Save edited invoice to backend via PUT /api/sales/invoice/:id
    const handleSaveEditInvoice = useCallback(async (andPrint = false) => {
        if (!editingInvoice || !cartItems.length || editSaving) return
        if (!validateAllCartPrices()) return

        try {
            setEditSaving(true)
            const payload = {
                items: cartItems.map(item => ({
                    item: item.isCustom ? null : (item.id || item._id),
                    isCustom: !!item.isCustom,
                    name: item.name,
                    sku: item.sku || (item.isCustom ? 'حر' : ''),
                    qty: Number(item.qty),
                    price: Number(item.price),
                    isBundle: !!item.isBundle,
                    bundleComponents: item.bundleComponents || []
                })),
                discountValue: Number(globalDiscount) || 0,
                note: invoiceNote || '',
                customerName: (customCustomerName && customCustomerName.trim()) ? customCustomerName.trim() : 'عميل نقدي',
                warehouse: selectedWarehouseId,
                treasury: selectedTreasury
            }

            const res = await api.put(`/sales/invoice/${editingInvoice._id}`, payload)
            const updatedInv = res.data?.invoice

            playBeep(false)
            setFeedbackMessage({
                type: 'success',
                text: res.data?.message || `تم تعديل الفاتورة ${editingInvoice.number} وتحديث المخزون والخزينة بنجاح!`
            })

            if (andPrint && updatedInv && handleReprint) {
                handleReprint(updatedInv)
            }

            if (refreshProducts) {
                await refreshProducts()
            }
            if (loadHistory) {
                await loadHistory()
            }

            setEditingInvoice(null)
            clearCart()
            setInvoiceNote('')
            if (setGlobalDiscount) setGlobalDiscount(0)
            await handleNewInvoice()
        } catch (err) {
            playBeep(true)
            const errorMsg = err.response?.data?.message || err.message || 'فشل تعديل الفاتورة'
            setFeedbackMessage({
                type: 'error',
                text: errorMsg
            })
        } finally {
            setEditSaving(false)
        }
    }, [editingInvoice, cartItems, editSaving, validateAllCartPrices, globalDiscount, invoiceNote, customCustomerName, selectedWarehouseId, selectedTreasury, handleReprint, refreshProducts, loadHistory, clearCart, setGlobalDiscount, handleNewInvoice, playBeep])

    // Save and Print Handler - Opens payment modal at checkout
    const handleSaveAndPrint = useCallback(async () => {
        if (!validateAllCartPrices()) return
        if (editingInvoice) {
            await handleSaveEditInvoice(true)
            return
        }
        if (!cartItems.length) return
        setShowPaymentModal(true)
    }, [validateAllCartPrices, editingInvoice, handleSaveEditInvoice, cartItems.length, setShowPaymentModal])

    // Save only Handler - Opens payment modal at checkout
    const handleSaveOnly = useCallback(async () => {
        if (!validateAllCartPrices()) return
        if (editingInvoice) {
            await handleSaveEditInvoice(false)
            return
        }
        if (!cartItems.length) return
        setShowPaymentModal(true)
    }, [validateAllCartPrices, editingInvoice, handleSaveEditInvoice, cartItems.length, setShowPaymentModal])

    // Confirmation Handler from inside PaymentModal
    const handleConfirmPaymentSave = useCallback(async (andPrint = true, options = {}) => {
        const success = await handleSaveOrder(andPrint, options)
        if (success) {
            setShowPaymentModal(false)
            await handleNewInvoice()
        }
        return success
    }, [handleSaveOrder, setShowPaymentModal, handleNewInvoice])

    // New Invoice click: ask user before discarding current cart
    const handleNewInvoiceClick = useCallback(async () => {
        if (editingInvoice) {
            // In edit mode — confirm before abandoning changes
            setConfirmDialog({
                isOpen: true,
                title: 'تعديل الفاتورة قيد التنفيذ',
                message: 'أنت حالياً في وضع تعديل الفاتورة. هل ترغب في حفظ التعديلات الحالية قبل الانتقال لفاتورة جديدة؟',
                type: 'warning',
                confirmText: 'حفظ وبدء جديدة',
                altText: 'تجاهل التعديلات وبدء جديدة',
                cancelText: 'البقاء في الفاتورة',
                onConfirm: async () => {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                    await handleSaveEditInvoice(false)
                    await handleNewInvoice()
                },
                onAlt: async () => {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                    await handleNewInvoice()
                },
                onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
            })
            return
        }

        if (cartItems.length > 0) {
            // Cart has items — never auto-save, always confirm first
            setConfirmDialog({
                isOpen: true,
                title: 'فاتورة جديدة',
                message: `السلة تحتوي على ${cartItems.length} صنف.\nهل تريد حفظ الفاتورة الحالية وترحيلها قبل البدء بفاتورة جديدة؟`,
                type: 'warning',
                confirmText: 'حفظ وترحيل ثم جديدة',
                altText: 'تجاهل السلة وبدء جديدة',
                cancelText: 'البقاء في الفاتورة الحالية',
                onConfirm: async () => {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                    // Open payment modal to complete checkout, then start new
                    setShowPaymentModal(true)
                },
                onAlt: async () => {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                    await handleNewInvoice()
                },
                onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
            })
            return
        }

        await handleNewInvoice()
    }, [editingInvoice, cartItems.length, handleSaveEditInvoice, handleNewInvoice, setShowPaymentModal])

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // F1 - Item History / Card (سجل وحركة الصنف والمشتريات والمبيعات)
            if (e.key === 'F1') {
                e.preventDefault()
                let target = null
                if (focusedItemId) {
                    target = cartItems.find(i => (i.id || i.item) === focusedItemId) || products.find(p => p._id === focusedItemId)
                } else if (showCatalogModal && modalFilteredProducts[modalSelectedIndex]) {
                    target = modalFilteredProducts[modalSelectedIndex]
                } else if (cartItems.length > 0) {
                    target = cartItems[cartItems.length - 1]
                } else if (products.length > 0) {
                    target = products[0]
                }
                openItemHistory(target)
            }
            // F9 - Save & Print
            if (e.key === 'F9') {
                e.preventDefault()
                if (cartItems.length && !saving) {
                    handleSaveAndPrint()
                }
            }
            // F7 - Hold Bill
            if (e.key === 'F7') {
                e.preventDefault()
                if (cartItems.length) {
                    handleHoldBill()
                }
            }
            // F4 - Toggle Mode (fast ↔ split)
            if (e.key === 'F4' && onSwitchMode) {
                e.preventDefault()
                // Toggle: if currently customer mode → go fast, else → go split
                onSwitchMode(mode === 'customer' ? 'fast' : 'split')
            }
            // Space (المسطرة) - Open/Close Catalog Modal
            if (e.key === ' ' && !showCatalogModal && !showPcBuilderModal && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault()
                setShowCatalogModal(true)
            }
            // Escape - Close Catalog Modal or PC Builder
            if (e.key === 'Escape') {
                if (showCatalogModal) {
                    e.preventDefault()
                    setShowCatalogModal(false)
                }
                if (showPcBuilderModal) {
                    e.preventDefault()
                    setShowPcBuilderModal(false)
                }
            }
            // F8 - Open PC Builder Modal
            if (e.key === 'F8') {
                e.preventDefault()
                setShowPcBuilderModal(true)
            }
            // F2 - Focus Barcode
            if (e.key === 'F2') {
                e.preventDefault()
                barcodeInputRef.current?.focus()
                barcodeInputRef.current?.select()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [cartItems.length, saving, handleSaveAndPrint, handleHoldBill, onSwitchMode, showCatalogModal, showPcBuilderModal, mode])

    // Handle Quick Barcode Entry
    const handleBarcodeSubmit = (e) => {
        e?.preventDefault()
        const term = fastBarcode.trim()
        if (!term) return

        // Search product by Barcode, SKU, or Name
        const matched = products.find(p =>
            (p.barcode && p.barcode.trim().toLowerCase() === term.toLowerCase()) ||
            (p.sku && p.sku.trim().toLowerCase() === term.toLowerCase()) ||
            (p.name && p.name.trim().toLowerCase() === term.toLowerCase())
        )

        if (matched) {
            addToCart(matched)
            playBeep(false)
            setFeedbackMessage({ type: 'success', text: `تمت إضافة: ${matched.name}` })
            setFastBarcode('')
        } else {
            playBeep(true)
            setFeedbackMessage({ type: 'error', text: `لم يتم العثور على صنف بالرمز: "${term}"` })
        }

        setTimeout(() => setFeedbackMessage(null), 2500)
    }

    const currentInvoiceNumber = activeHistoryInvoice
        ? (activeHistoryInvoice.number || activeHistoryInvoice._id?.toString().slice(-6))
        : (editingInvoice
            ? editingInvoice.number
            : (systemInvoiceNumber || posNextNumber || '...'))

    // Displayed Items (Current cart or historical invoice items)
    const displayedItems = useMemo(() => {
        if (activeHistoryInvoice) {
            return (activeHistoryInvoice.items || []).map((row, idx) => {
                const prod = typeof row.item === 'object' && row.item
                    ? row.item
                    : (products.find(p => p.id === (row.item?._id || row.item)) || {})

                return {
                    id: row._id || `hist-${idx}`,
                    name: prod.name || row.name || 'صنف مبيعات',
                    sku: prod.sku || prod.barcode || row.sku || '-',
                    barcode: prod.barcode || row.barcode || '',
                    unit: prod.unit || row.unit || 'قطعة',
                    qty: Number(row.qty) || 1,
                    price: Number(row.price) || 0,
                    isHistorical: true,
                    isBundle: !!row.isBundle || !!row.item?.isBundle || !!prod.isBundle,
                    bundleComponents: (row.bundleComponents && row.bundleComponents.length > 0)
                        ? row.bundleComponents
                        : (row.item?.bundleComponents && row.item.bundleComponents.length > 0)
                            ? row.item.bundleComponents
                            : (prod.bundleComponents || [])
                }
            })
        }
        return cartItems
    }, [activeHistoryInvoice, cartItems, products])

    // Displayed Calculations
    const displayedSubtotal = useMemo(() => {
        if (activeHistoryInvoice) {
            return activeHistoryInvoice.totals?.subtotal ||
                (activeHistoryInvoice.items || []).reduce((acc, i) => acc + ((Number(i.qty) || 0) * (Number(i.price) || 0)), 0)
        }
        return subtotal
    }, [activeHistoryInvoice, subtotal])

    const displayedDiscount = useMemo(() => {
        if (activeHistoryInvoice) {
            return activeHistoryInvoice.discountValue || activeHistoryInvoice.totals?.discount || 0
        }
        return globalDiscount
    }, [activeHistoryInvoice, globalDiscount])

    const displayedTotal = useMemo(() => {
        if (activeHistoryInvoice) {
            return activeHistoryInvoice.totals?.grand || (displayedSubtotal - displayedDiscount)
        }
        return totalAfterDiscount
    }, [activeHistoryInvoice, displayedSubtotal, displayedDiscount, totalAfterDiscount])

    const displayedQtyTotal = useMemo(() => {
        if (activeHistoryInvoice) {
            return (activeHistoryInvoice.items || []).reduce((acc, i) => acc + (Number(i.qty) || 0), 0)
        }
        return cartItems.reduce((acc, i) => acc + i.qty, 0)
    }, [activeHistoryInvoice, cartItems])

    // Displayed Date & Time & Customer & Note
    const displayedDate = useMemo(() => {
        const target = activeHistoryInvoice || editingInvoice
        if (target) {
            const rawDate = target.date || target.createdAt
            if (rawDate) {
                const d = new Date(rawDate)
                if (!isNaN(d.getTime())) {
                    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })
                }
            }
        }
        return currentDate
    }, [activeHistoryInvoice, editingInvoice, currentDate])

    const displayedTime = useMemo(() => {
        const target = activeHistoryInvoice || editingInvoice
        if (target) {
            const rawTime = target.createdAt || target.date
            if (rawTime) {
                const d = new Date(rawTime)
                if (!isNaN(d.getTime())) {
                    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                }
            }
        }
        return currentTime
    }, [activeHistoryInvoice, editingInvoice, currentTime])

    const displayedCustomerName = useMemo(() => {
        const target = activeHistoryInvoice || editingInvoice
        if (target) {
            return target.customerName || target.customer?.name || 'عميل نقدي'
        }
        return customCustomerName || 'عميل نقدي'
    }, [activeHistoryInvoice, editingInvoice, customCustomerName])

    const displayedNote = useMemo(() => {
        if (activeHistoryInvoice) {
            return activeHistoryInvoice.note || ''
        }
        return invoiceNote
    }, [activeHistoryInvoice, invoiceNote])

    // Export to Excel
    const handleExportExcel = () => {
        if (!displayedItems.length) {
            alert('لا توجد أصناف في الفاتورة لتصديرها!')
            return
        }

        const rows = displayedItems.map((item, idx) => ({
            'م': idx + 1,
            'رقم الصنف (SKU)': item.sku || item.barcode || '-',
            'اسم الصنف': item.name,
            'الوحدة': item.unit || 'قطعة',
            'الكمية': item.qty,
            'السعر الإفرادي': item.price,
            'الإجمالي': item.price * item.qty
        }))

        // Append Summary Rows
        rows.push({
            'م': '',
            'رقم الصنف (SKU)': '',
            'اسم الصنف': 'المجموع الفرعي',
            'الوحدة': '',
            'الكمية': '',
            'السعر الإفرادي': '',
            'الإجمالي': displayedSubtotal
        })
        if (displayedDiscount > 0) {
            rows.push({
                'م': '',
                'رقم الصنف (SKU)': '',
                'اسم الصنف': 'الخصم',
                'الوحدة': '',
                'الكمية': '',
                'السعر الإفرادي': '',
                'الإجمالي': -displayedDiscount
            })
        }
        rows.push({
            'م': '',
            'رقم الصنف (SKU)': '',
            'اسم الصنف': 'الصافي النهائي',
            'الوحدة': '',
            'الكمية': '',
            'السعر الإفرادي': '',
            'الإجمالي': displayedTotal
        })

        const worksheet = XLSX.utils.json_to_sheet(rows)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, `فاتورة_${currentInvoiceNumber}`)
        XLSX.writeFile(workbook, `فاتورة_مبيعات_${currentInvoiceNumber}_${(displayedDate || currentDate).replace(/\//g, '-')}.xlsx`)
    }

    // Navigate Invoices (Previous / Next)
    const handleNavigateHistory = (direction) => {
        if (!historyList || !historyList.length) return
        if (setSelectedHistoryInvoice) setSelectedHistoryInvoice(null)
        if (direction === 1) {
            // Previous invoice
            if (historyIndex === -1) {
                setHistoryIndex(0)
            } else if (historyIndex < historyList.length - 1) {
                setHistoryIndex(historyIndex + 1)
            }
        } else {
            // Next invoice
            if (historyIndex > 0) {
                setHistoryIndex(historyIndex - 1)
            } else if (historyIndex === 0) {
                setHistoryIndex(-1)
            }
        }
    }

    // Warehouse change handler
    const handleWarehouseChange = useCallback((newWarehouseId) => {
        if (isWarehouseLocked || !newWarehouseId || newWarehouseId === selectedWarehouseId) return
        if (setWarehouse) {
            setWarehouse(newWarehouseId)
        }
        const targetWh = warehouses.find(w => w._id === newWarehouseId)
        const whName = targetWh?.name || 'المحدد'
        playBeep(false)
        setFeedbackMessage({
            type: 'success',
            text: `تم التبديل إلى مخزن: ${whName}`
        })
        setTimeout(() => setFeedbackMessage(null), 3000)

        // Refresh cart items with available stock in the newly selected warehouse
        if (cartItems.length > 0 && setCartItems) {
            setCartItems(prev => prev.map(item => {
                const fullProduct = products.find(p => (p.id || p._id)?.toString() === (item.id || item._id)?.toString())
                const wStock = fullProduct?.stocks?.find(s => {
                    const sWhId = s.warehouse?._id || s.warehouse
                    return sWhId?.toString() === newWarehouseId?.toString()
                })
                const availableInWarehouse = wStock?.qty ?? 0
                return {
                    ...item,
                    availableInWarehouse
                }
            }))
        }
    }, [setWarehouse, selectedWarehouseId, warehouses, cartItems.length, setCartItems, products])

    // Warehouse name
    const warehouseDisplayName = currentWarehouse?.name || (warehouses.find(w => w._id === selectedWarehouseId)?.name) || 'المخزن الرئيسي'

    return (
        <div className="h-full w-full flex flex-col bg-[#f4f6fb] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans select-none overflow-hidden">

            {/* ========================================================================= */}
            {/* 1. TOP BAR (Matching Screenshot) */}
            {/* ========================================================================= */}
            <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-4 py-1.5 flex items-center justify-between shadow-2xs gap-2">
                {/* Left: User & Connection Status & Quick Mode Switcher */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs shrink-0">
                    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="hidden sm:inline">متصل</span>
                    </div>
                    <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
                    <div className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span className="hidden md:inline">المستخدم:</span>
                        <strong className="text-slate-900 dark:text-white font-bold truncate max-w-[90px] sm:max-w-[130px]">{loggedInName}</strong>
                        {currentUser?.role === 'admin' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold hidden lg:inline">
                                مدير النظام
                            </span>
                        )}
                    </div>

                    {/* Quick Mode Switcher (Cash Sale vs Customer Sales) */}
                    {onSwitchMode && (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0 mr-1">
                            <button
                                type="button"
                                onClick={() => onSwitchMode('fast')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                    !isCustomerMode
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="نقطة البيع النقدي السريع"
                            >
                                <Zap size={13} className={!isCustomerMode ? 'fill-current' : ''} />
                                <span>بيع نقدي</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onSwitchMode('split')}
                                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                                    isCustomerMode
                                        ? 'bg-[#24357a] text-white shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title="نقطة بيع العملاء (تسجيل عميل، بيع آجل، خصومات)"
                            >
                                <Users size={13} />
                                <span>مبيعات (عملاء)</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Center / Action Buttons */}
                <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {/* Live Exchange Rate Ticker */}
                    <button
                        type="button"
                        onClick={() => {
                            if (canEditExchangeRate) {
                                setShowExchangeRateModal(true)
                            } else {
                                push('error', 'عذراً، لا تملك صلاحية تعديل سعر الصرف المعتمد')
                            }
                        }}
                        className={`px-2 sm:px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs shrink-0 ${
                            canEditExchangeRate
                                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700/70 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-default opacity-85'
                        }`}
                        title={canEditExchangeRate ? 'سعر صرف الدولار اليومي المعتمد - اضغط لتعديل السعر وبثه فورياً' : 'سعر صرف الدولار المعتمد (يتطلب صلاحية لتعديله)'}
                    >
                        <span className="text-sm leading-none">💵</span>
                        <span className="font-mono font-black">1$ = {usdExchangeRate || 7.30} د.ل</span>
                        {canEditExchangeRate ? (
                            <span className="text-[10px] bg-amber-200/80 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1 py-0.2 rounded font-medium hidden md:inline">تعديل</span>
                        ) : (
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 px-1 py-0.2 rounded font-medium hidden md:inline">ثابت</span>
                        )}
                    </button>

                    {/* Excel Export Button */}
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={!cartItems.length}
                        className="px-2 sm:px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                        title="تصدير بنود الفاتورة إلى ملف Excel"
                    >
                        <FileSpreadsheet size={14} />
                        <span className="hidden xl:inline">Excel</span>
                    </button>

                    {/* Print Button */}
                    <button
                        type="button"
                        onClick={handleSaveAndPrint}
                        disabled={!cartItems.length || saving || editSaving}
                        className="px-2 sm:px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                        title={editingInvoice ? 'حفظ وطباعة التعديلات' : 'طباعة الفاتورة فوراً (F9)'}
                    >
                        <Printer size={14} />
                        <span className="hidden md:inline">{editingInvoice ? 'حفظ وطباعة' : 'طباعة'}</span>
                    </button>

                    {/* Save Button */}
                    <button
                        type="button"
                        onClick={handleSaveOnly}
                        disabled={!cartItems.length || saving || editSaving}
                        className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 active:scale-95"
                        title={editingInvoice ? 'حفظ التعديلات' : 'حفظ وترحيل الفاتورة إلى المخزن والخزينة (F9)'}
                    >
                        <Save size={14} />
                        <span className="hidden sm:inline">{editingInvoice ? (editSaving ? 'جاري الحفظ...' : 'حفظ التعديلات') : 'حفظ وترحيل'}</span>
                    </button>

                    {/* New Invoice Button */}
                    <button
                        type="button"
                        onClick={handleNewInvoiceClick}
                        className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer shrink-0 active:scale-95"
                        title="بدء فاتورة جديدة (يحفظ الفاتورة الحالية تلقائياً)"
                    >
                        <Plus size={14} />
                        <span className="hidden sm:inline">فاتورة جديدة</span>
                    </button>

                    {/* Navigation Buttons: Previous / Next */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleNavigateHistory(1)}
                            disabled={!historyList.length || historyIndex >= historyList.length - 1}
                            className="px-1.5 sm:px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded transition-all flex items-center gap-0.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="الفاتورة السابقة"
                        >
                            <ArrowRight size={12} />
                            <span className="hidden lg:inline">السابق</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleNavigateHistory(-1)}
                            disabled={historyIndex === -1}
                            className="px-1.5 sm:px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded transition-all flex items-center gap-0.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="الفاتورة التالية"
                        >
                            <span className="hidden lg:inline">التالي</span>
                            <ArrowLeft size={12} />
                        </button>
                    </div>



                    {/* Navigation Toggle for full ERP menu */}
                    {onToggleNav && (
                        <button
                            type="button"
                            onClick={onToggleNav}
                            className={`px-2 sm:px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${showNavInPos
                                ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 border-indigo-300'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                            title="إظهار / إخفاء القائمة العلوية للنظام"
                        >
                            <Menu size={14} />
                            <span className="hidden lg:inline">القائمة</span>
                        </button>
                    )}

                    {/* Exit Button */}
                    {onExit && (
                        <button
                            type="button"
                            onClick={onExit}
                            className="px-2 sm:px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                            title="خروج إلى لوحة التحكم"
                        >
                            <LogOut size={13} />
                            <span className="hidden sm:inline">خروج</span>
                        </button>
                    )}
                </div>


            </header>

            {/* ========================================================================= */}
            {/* 2. INVOICE HEADER INFORMATION CARD (Matching Screenshot) */}
            {/* ========================================================================= */}
            <div className="shrink-0 px-3 pt-2 pb-1">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-2.5 transition-all">
                    {/* Top Row: Invoice Title & Warehouse Badge & Customer Mode Additions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Warehouse selector / display */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-bold">
                                <Store size={14} className="text-[#24357a] dark:text-blue-400" />
                                <span>المخزن:</span>
                                {isWarehouseLocked ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-bold text-xs shadow-2xs select-none">
                                        <Lock size={12} className="text-purple-600 dark:text-purple-400" />
                                        <span>{warehouseDisplayName}</span>
                                    </span>
                                ) : warehouses && warehouses.length > 0 ? (
                                    <select
                                        value={selectedWarehouseId || ''}
                                        onChange={e => handleWarehouseChange(e.target.value)}
                                        className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-0.5 text-xs outline-none cursor-pointer hover:border-primary-400 transition-colors shadow-2xs"
                                    >
                                        {warehouses.map(wh => (
                                            <option key={wh._id} value={wh._id}>{wh.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className="text-slate-900 dark:text-white font-bold">{warehouseDisplayName}</span>
                                )}
                            </div>

                            {/* Customer Mode Extras: Sales Mode Toggle & Proforma Toggle */}
                            {isCustomerMode && !activeHistoryInvoice && (
                                <>
                                    <div className="flex items-center gap-1.5 text-xs font-bold border-r border-slate-200 dark:border-slate-700 pr-3">
                                        <span className="text-slate-400">التسعير:</span>
                                        <button
                                            type="button"
                                            onClick={() => setSalesMode && setSalesMode(salesMode === SALES_MODES.WHOLESALE ? SALES_MODES.RETAIL : SALES_MODES.WHOLESALE)}
                                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                                                salesMode === SALES_MODES.WHOLESALE
                                                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-300 shadow-2xs'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 hover:bg-slate-200'
                                            }`}
                                            title="التبديل بين سعر القطاعي وسعر الجملة"
                                        >
                                            {salesMode === SALES_MODES.WHOLESALE ? '🏷️ سعر الجملة' : '🏷️ سعر القطاعي'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Customer Balance & Wallet if customer selected */}
                            {isCustomerMode && selectedCustomer && !activeHistoryInvoice && (
                                <div className="flex items-center gap-2 text-xs border-r border-slate-200 dark:border-slate-700 pr-3">
                                    <span className="text-slate-400 font-bold">الرصيد:</span>
                                    <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${
                                        (selectedCustomer.balance || 0) > 0
                                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                            : (selectedCustomer.balance || 0) < 0
                                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                    }`}>
                                        {formatCurrency(selectedCustomer.balance || 0)}
                                        {(selectedCustomer.balance || 0) > 0 ? ' (مدين)' : (selectedCustomer.balance || 0) < 0 ? ' (دائن)' : ''}
                                    </span>

                                    {customerWalletBalance > 0 && (
                                        <button
                                            type="button"
                                            onClick={applyWalletCredit}
                                            className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md text-[11px] font-bold hover:bg-indigo-100 flex items-center gap-1 cursor-pointer"
                                            title="استخدام رصيد المحفظة لتسديد الفاتورة"
                                        >
                                            <Wallet size={11} />
                                            <span>استخدام المحفظة ({formatCurrency(customerWalletBalance)})</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Status Badge (only for Edit or History modes) */}
                        {(editingInvoice || activeHistoryInvoice) && (
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    editingInvoice
                                        ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 animate-pulse'
                                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                }`}>
                                    {editingInvoice ? 'تعديل جاري' : 'سابقة'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Data Fields Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-right">
                        {/* 1. Invoice Number */}
                        <div className="bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">رقم الفاتورة</span>
                            <span className="font-mono font-black text-sm text-slate-800 dark:text-slate-100">
                                {currentInvoiceNumber}
                            </span>
                        </div>

                        {!isCustomerMode ? (
                            <>
                                {/* 2. Invoice Date */}
                                <div className="bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col justify-center">
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-end gap-1">
                                        <Calendar size={10} />
                                        <span>التاريخ</span>
                                    </span>
                                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                        {displayedDate}
                                    </span>
                                </div>

                                {/* 3. Invoice Time */}
                                <div className="bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col justify-center">
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-end gap-1">
                                        <Clock size={10} />
                                        <span>الوقت</span>
                                    </span>
                                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                        {displayedTime}
                                    </span>
                                </div>

                                {/* 4. Customer / Account (Writable Cash Customer Name) */}
                                <div className="bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col justify-center">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${
                                                customerId
                                                    ? 'bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border-primary-300'
                                                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                            }`}>
                                                {customerId ? 'عميل مسجل' : 'نقدي'}
                                            </span>
                                            {customerId && !activeHistoryInvoice && (
                                                <button
                                                    type="button"
                                                    onClick={handleClearCustomer}
                                                    className="w-3.5 h-3.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center cursor-pointer"
                                                    title="إلغاء اختيار العميل والعودة لعميل نقدي"
                                                >
                                                    <X size={9} />
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">الحساب / العميل</span>
                                    </div>
                                    <div className="flex items-center mt-0.5 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
                                        <input
                                            type="text"
                                            value={activeHistoryInvoice ? displayedCustomerName : (customCustomerName || '')}
                                            onChange={e => {
                                                if (!activeHistoryInvoice) {
                                                    if (setCustomCustomerName) setCustomCustomerName(e.target.value)
                                                    if (customerId && selectedCustomer && e.target.value !== selectedCustomer.name) {
                                                        setCustomerId('')
                                                    }
                                                }
                                            }}
                                            onFocus={e => {
                                                if (!activeHistoryInvoice && e.target.value === 'عميل نقدي') {
                                                    e.target.select()
                                                }
                                            }}
                                            readOnly={!!activeHistoryInvoice}
                                            placeholder="اسم العميل (نقدي)..."
                                            title={activeHistoryInvoice ? "اسم العميل في الفاتورة السابقة" : "اكتب اسم العميل أو انتقل لمبيعات العملاء لاختيار عميل مسجل"}
                                            className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 disabled:opacity-70"
                                        />
                                        {!activeHistoryInvoice && onSwitchMode && (
                                            <button
                                                type="button"
                                                onClick={() => onSwitchMode('split')}
                                                className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 shrink-0 ml-1"
                                                title="التبديل إلى مبيعات العملاء لاختيار عميل مسجل وآجل"
                                            >
                                                <Users size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* 2. Invoice Date */}
                                <div className="bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col justify-center">
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-end gap-1">
                                        <Calendar size={10} />
                                        <span>التاريخ</span>
                                    </span>
                                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                        {displayedDate}
                                    </span>
                                </div>

                                {/* 3. Invoice Time */}
                                <div className="bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col justify-center">
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center justify-end gap-1">
                                        <Clock size={10} />
                                        <span>الوقت</span>
                                    </span>
                                    <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                        {displayedTime}
                                    </span>
                                </div>

                                {/* 4. Registered Customer Selector */}
                                <div className="relative bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col justify-center">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowAddCustomer && setShowAddCustomer(true)}
                                                className="w-4 h-4 rounded bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 hover:bg-primary-200 flex items-center justify-center transition-all cursor-pointer"
                                                title="إضافة عميل جديد"
                                            >
                                                <UserPlus size={10} />
                                            </button>
                                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${
                                                customerId
                                                    ? 'bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border-primary-300'
                                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300'
                                            }`}>
                                                {customerId ? 'عميل مسجل' : 'اختر العميل'}
                                            </span>
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">العميل</span>
                                    </div>

                                    {activeHistoryInvoice ? (
                                        <div className="mt-0.5 px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {displayedCustomerName}
                                        </div>
                                    ) : selectedCustomer ? (
                                        <div className="mt-0.5 px-2 py-0.5 bg-primary-50/90 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 rounded-md flex items-center justify-between text-xs transition-all">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <User size={12} className="text-primary-600 shrink-0" />
                                                <span className="font-bold text-primary-900 dark:text-primary-100 truncate text-xs">
                                                    {selectedCustomer.name}
                                                </span>
                                                {selectedCustomer.type === 'wholesale' && (
                                                    <span className="text-[8px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-bold shrink-0">جملة</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleClearCustomer}
                                                className="w-4 h-4 rounded hover:bg-primary-200 dark:hover:bg-primary-800 text-primary-600 flex items-center justify-center cursor-pointer shrink-0 ml-1"
                                                title="إلغاء اختيار العميل"
                                            >
                                                <X size={11} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative mt-0.5" ref={customerContainerRef}>
                                            <div className="relative flex items-center">
                                                <input
                                                    ref={customerSearchInputRef}
                                                    type="text"
                                                    value={customerSearch}
                                                    onChange={e => {
                                                        if (setCustomerSearch) setCustomerSearch(e.target.value)
                                                        setCustomerDropdownOpen(true)
                                                        setSelectedCustomerIndex(0)
                                                    }}
                                                    onFocus={() => {
                                                        setCustomerDropdownOpen(true)
                                                        setSelectedCustomerIndex(0)
                                                    }}
                                                    onKeyDown={handleCustomerKeyDown}
                                                    placeholder="🔍 ابحث أو اضغط لاختيار عميل..."
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md pr-2 pl-6 py-0.5 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 focus:border-blue-500 transition-all"
                                                />
                                                <button
                                                    type="button"
                                                    tabIndex={-1}
                                                    onClick={() => setCustomerDropdownOpen(prev => !prev)}
                                                    className="absolute left-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                                                >
                                                    <ChevronDown size={13} className={`transition-transform duration-200 ${customerDropdownOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                            </div>

                                            {customerDropdownOpen && (
                                                <div
                                                    className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto p-1 animate-in fade-in duration-100 divide-y divide-slate-100 dark:divide-slate-800/60"
                                                >
                                                    {filteredCustomers && filteredCustomers.length > 0 ? (
                                                        filteredCustomers.map((c, idx) => (
                                                            <div
                                                                key={c._id || c.id || idx}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    handleSelectCustomer(c)
                                                                }}
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    handleSelectCustomer(c)
                                                                }}
                                                                className={`p-2 rounded-md cursor-pointer flex items-center justify-between text-xs transition-colors ${
                                                                    idx === selectedCustomerIndex
                                                                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-900 dark:text-blue-100 font-medium'
                                                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                                                }`}
                                                            >
                                                                <div className="truncate flex-1 ml-2">
                                                                    <div className="font-bold truncate">{c.name}</div>
                                                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                                                                        {c.code && <span>كود: {c.code}</span>}
                                                                        {c.phone && <span>هاتف: {c.phone}</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {c.type === 'wholesale' && (
                                                                        <span className="text-[8px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-1 py-0.2 rounded font-bold">جملة</span>
                                                                    )}
                                                                    {c.creditLimit > 0 && (
                                                                        <span className={`text-[8px] px-1 py-0.2 rounded font-mono font-bold ${
                                                                            (c.balance || 0) > c.creditLimit
                                                                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 ring-1 ring-rose-500/30'
                                                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                                        }`} title={`سقف الائتمان: ${formatCurrency(c.creditLimit)}`}>
                                                                            حد: {formatCurrency(c.creditLimit)}
                                                                        </span>
                                                                    )}
                                                                    {c.balance > 0 && (
                                                                        <span className="text-[9px] text-rose-600 dark:text-rose-400 font-mono font-bold">مدين: {formatCurrency(c.balance)}</span>
                                                                    )}
                                                                    {c.balance < 0 && (
                                                                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">دائن: {formatCurrency(Math.abs(c.balance))}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-3 text-center text-xs text-slate-400">
                                                            لا يوجد عميل مطابق للبحث
                                                        </div>
                                                    )}
                                                    <div className="pt-1 mt-1">
                                                        <button
                                                            type="button"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault()
                                                                setCustomerDropdownOpen(false)
                                                                if (setShowAddCustomer) setShowAddCustomer(true)
                                                            }}
                                                            onClick={() => {
                                                                setCustomerDropdownOpen(false)
                                                                if (setShowAddCustomer) setShowAddCustomer(true)
                                                            }}
                                                            className="w-full py-1.5 px-2 text-center text-xs font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/50 rounded flex items-center justify-center gap-1 cursor-pointer"
                                                        >
                                                            <Plus size={12} />
                                                            <span>إضافة عميل جديد</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* 5. Invoice Notes */}
                        <div className="col-span-2 sm:col-span-2 lg:col-span-1 bg-slate-50 dark:bg-slate-850 px-2 py-1 rounded-lg border border-slate-200/70 dark:border-slate-800 flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">ملاحظات</span>
                            <input
                                type="text"
                                value={displayedNote}
                                onChange={e => {
                                    if (!activeHistoryInvoice) setInvoiceNote(e.target.value)
                                }}
                                readOnly={!!activeHistoryInvoice}
                                placeholder="أضف ملاحظة للفاتورة..."
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 focus:border-blue-500 transition-all mt-0.5 disabled:opacity-60"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 3. MAIN WORKSPACE (Split: Right Invoice Table | Left Item Directory | Far Left Strip) */}
            {/* In RTL: Child 1 is RIGHT, Child 2 is LEFT, Child 3 is FAR LEFT */}
            {/* ========================================================================= */}
            <div className="flex-1 px-3 py-1.5 overflow-hidden flex flex-row gap-2.5 min-h-0">

                {/* ------------------------------------------------------------- */}
                {/* 3.A RIGHT (First Child in RTL): تفاصيل الفاتورة (Invoice Table) */}
                {/* ------------------------------------------------------------- */}
                <div className="flex-1 h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden min-w-0">
                    {/* Header Bar */}
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-2">
                        {/* Table Actions: Hold / Clear / Add Custom Item */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={handleHoldBill}
                                disabled={!cartItems.length || !!activeHistoryInvoice}
                                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title="تعليق الفاتورة الحالية مؤقتاً"
                            >
                                <Archive size={13} />
                                <span>تعليق</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!cartItems.length) return
                                    setConfirmDialog({
                                        isOpen: true,
                                        title: 'مسح بنود الفاتورة',
                                        message: 'هل أنت متأكد من رغبتك في حذف كافة الأصناف من الفاتورة الحالية؟\nلا يمكن التراجع عن هذا الإجراء.',
                                        type: 'danger',
                                        confirmText: 'نعم، مسح الكل',
                                        cancelText: 'تراجع',
                                        onConfirm: () => {
                                            setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                                            clearCart()
                                        },
                                        onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                                    })
                                }}
                                disabled={!cartItems.length || !!activeHistoryInvoice}
                                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title="حذف جميع بنود الفاتورة"
                            >
                                <Trash2 size={13} />
                                <span>مسح</span>
                            </button>
                            {addCustomItem && !activeHistoryInvoice && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const customId = addCustomItem({ name: 'صنف حر', qty: 1, price: 0 })
                                        playBeep(false)
                                        setFocusedItemId(customId)
                                        setFocusedField('qty')
                                    }}
                                    className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="إضافة صنف حر (يدوي غير مسجل في المخزون)"
                                >
                                    <Plus size={13} />
                                    <span>+ صنف حر</span>
                                </button>
                            )}
                        </div>

                        {/* Invoice Type Toggle & Items Count */}
                        <div className="flex items-center gap-2">
                            {setInvoiceType && !activeHistoryInvoice && !editingInvoice && (
                                <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-300/70 dark:border-slate-700 text-[11px] font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceType(INVOICE_TYPES.OFFICIAL)}
                                        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                                            invoiceType !== INVOICE_TYPES.PROFORMA
                                                ? 'bg-[#24357a] text-white shadow-2xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        فاتورة مبيعات
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInvoiceType(INVOICE_TYPES.PROFORMA)}
                                        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                                            invoiceType === INVOICE_TYPES.PROFORMA
                                                ? 'bg-amber-600 text-white shadow-2xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    >
                                        فاتورة مبدئية (عرض سعر)
                                    </button>
                                </div>
                            )}
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                بنود الفاتورة ({displayedItems.length})
                            </span>
                        </div>
                    </div>

                    {/* Active Edit Mode Banner */}
                    {editingInvoice && (
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1.5 flex items-center justify-between text-xs shadow-xs shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                                <span className="font-bold">✏️ وضع تعديل الفاتورة النقدية: <strong className="font-mono text-sm underline">{editingInvoice.number}</strong></span>
                                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full hidden sm:inline">نفس اليوم • يتم ضبط المخزون والخزينة تلقائياً بالفرق</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleSaveEditInvoice(false)}
                                    disabled={editSaving || !cartItems.length}
                                    className="px-2.5 py-1 bg-white text-orange-800 hover:bg-orange-50 rounded text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                >
                                    <Save size={12} />
                                    <span>{editSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={editSaving}
                                    className="px-2 py-1 bg-black/20 hover:bg-black/30 text-white rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <X size={12} />
                                    <span>إلغاء التعديل</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Historical Invoice Notice Banner */}
                    {activeHistoryInvoice && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-3 py-1.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                <span className="font-bold">استعراض فاتورة سابقة: <strong className="font-mono text-sm underline">{currentInvoiceNumber}</strong></span>
                                <span className="text-[11px] opacity-75">({historyIndex + 1} من {historyList.length})</span>
                                {canEditActiveInvoice && (
                                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                                        قابلة للتعديل اليوم
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {canEditActiveInvoice && (
                                    <button
                                        type="button"
                                        onClick={() => handleStartEditInvoice(activeHistoryInvoice)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                                        title="تعديل هذه الفاتورة النقدية (نفس اليوم)"
                                    >
                                        <Edit size={12} />
                                        <span>تعديل الفاتورة</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleReprint && handleReprint(activeHistoryInvoice)}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <Printer size={12} />
                                    <span>إعادة طباعة</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHistoryIndex(-1)
                                        if (setSelectedHistoryInvoice) setSelectedHistoryInvoice(null)
                                    }}
                                    className="px-2.5 py-1 bg-[#24357a] hover:bg-[#1a285a] text-white rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <span>العودة للفاتورة الجديدة</span>
                                    <ArrowLeft size={12} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Items Table with Navy Header (Matching Screenshot Dimensions) */}
                    <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
                        {displayedItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 select-none">
                                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                                    <ShoppingCart size={32} className="text-[#24357a] opacity-80" />
                                </div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    الفاتورة فارغة حالياً
                                </p>
                                <p className="text-xs text-slate-400 text-center px-4 mb-4">
                                    امسح الباركود في الأسفل أو افتح دليل الأصناف للإضافة الفورية
                                </p>
                                <div className="flex items-center gap-2 flex-wrap justify-center">
                                    <button
                                        type="button"
                                        onClick={() => setShowCatalogModal(true)}
                                        className="px-4 py-2 bg-[#24357a] hover:bg-[#1a285a] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                                    >
                                        <Package size={15} />
                                        <span>فتح دليل الأصناف (Space)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowPcBuilderModal(true)}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                                    >
                                        <Cpu size={15} />
                                        <span>🖥️ بناء تجميعة (PC Builder - F8)</span>
                                    </button>
                                    {addCustomItem && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const customId = addCustomItem({ name: 'صنف حر', qty: 1, price: 0 })
                                                playBeep(false)
                                                setFocusedItemId(customId)
                                                setFocusedField('qty')
                                            }}
                                            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                                        >
                                            <Plus size={15} />
                                            <span>إضافة صنف حر (يدوي)</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-right border-collapse text-xs min-w-[580px]">
                                {/* Deep Navy Header */}
                                <thead className="sticky top-0 bg-[#24357a] text-white font-bold z-10 select-none shadow-xs">
                                    <tr>
                                        <th className="py-2.5 px-3 w-12 text-center">م</th>
                                        <th className="hidden sm:table-cell py-2.5 px-3 w-28">رقم الصنف</th>
                                        <th className="py-2.5 px-3">اسم الصنف</th>
                                        <th className="py-2.5 px-3 w-40 text-center">الكمية</th>
                                        <th className="hidden md:table-cell py-2.5 px-3 w-20 text-center">الوحدة</th>
                                        <th className="py-2.5 px-3 w-48 text-right font-mono">السعر</th>
                                        <th className="py-2.5 px-3 w-32 text-left font-mono">الإجمالي</th>
                                        <th className="py-2.5 px-2 w-10 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                    <AnimatePresence initial={false}>
                                        {displayedItems.map((item, idx) => {
                                            const itemSubtotal = item.price * item.qty
                                            const bounds = !item.isHistorical ? getItemPriceBounds(item) : null
                                            const isEditingThisItem = !item.isHistorical && focusedItemId === item.id
                                            const isEditingQty = isEditingThisItem && focusedField === 'qty'
                                            const isEditingPrice = isEditingThisItem && focusedField === 'price'

                                            return (
                                                <motion.tr
                                                    key={item.id}
                                                    initial={{ opacity: 0, y: 3 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors ${
                                                        isEditingThisItem ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                                                    }`}
                                                >
                                                    {/* م - Index */}
                                                    <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold text-xs">
                                                        {idx + 1}
                                                    </td>

                                                    {/* رقم الصنف - SKU */}
                                                    <td className="hidden sm:table-cell py-3 px-3 font-mono font-bold text-slate-600 dark:text-slate-300 text-xs">
                                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                                                            {item.sku || item.barcode || '-'}
                                                        </span>
                                                    </td>

                                                    {/* اسم الصنف - Name */}
                                                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                                                        <div className="flex items-center gap-2">
                                                            {item.isCustom && !item.isHistorical && updateItemName ? (
                                                                <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                                                                    <input
                                                                        type="text"
                                                                        value={item.name}
                                                                        onChange={(e) => updateItemName(item.id, e.target.value)}
                                                                        placeholder="اكتب اسم الصنف الحر..."
                                                                        className="w-full px-2 py-1 text-xs sm:text-sm font-bold bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-900 dark:text-white"
                                                                    />
                                                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold shrink-0">
                                                                        صنف حر
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span>{item.name}</span>
                                                            )}
                                                            {!item.isCustom && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        openItemHistory(item)
                                                                    }}
                                                                    className="px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                                                                    title="سجل الصنف وتاريخ المشتريات والمبيعات والتكلفة [F1]"
                                                                >
                                                                    <FileText size={10} />
                                                                    <span>سجل [F1]</span>
                                                                </button>
                                                            )}
                                                            {item.isBundle && (
                                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                                    <Layers size={10} />
                                                                    تجميعة
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.isBundle && item.bundleComponents?.length > 0 && (
                                                            <div className="mt-1.5 p-2 bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 rounded-lg text-[11px] font-normal space-y-1">
                                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                                    <div className="text-[10px] font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1">
                                                                        <Cpu size={12} className="text-purple-600" />
                                                                        <span>قطع التجميعة المشمولة:</span>
                                                                    </div>
                                                                    {!item.isHistorical && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleEditCustomBundle(item)}
                                                                            className="px-2 py-0.5 rounded bg-purple-200/80 hover:bg-purple-300 dark:bg-purple-900/80 dark:hover:bg-purple-800 text-purple-900 dark:text-purple-200 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                                                                            title="تعديل قطع أو سعر التجميعة المخصصة"
                                                                        >
                                                                            <Edit3 size={11} />
                                                                            <span>تعديل التجميعة</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-700 dark:text-slate-200 mr-1.5">
                                                                    {item.bundleComponents.map((comp, ci) => (
                                                                        <div key={ci} className="flex items-center gap-1">
                                                                            <span className="text-purple-500 font-bold">•</span>
                                                                            <span className="font-semibold">{comp.name || comp.item?.name}</span>
                                                                            <span className="font-mono text-purple-700 dark:text-purple-300 font-bold">({comp.qty}x)</span>
                                                                            {comp.serials && comp.serials.length > 0 && (
                                                                                <span className="text-slate-600 dark:text-slate-300 font-mono text-[9px] bg-white dark:bg-slate-800 px-1 border border-slate-200 dark:border-slate-700 rounded">
                                                                                    S/N: {comp.serials.join(', ')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {priceError?.itemId === item.id && (
                                                            <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                                                                {priceError.message}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* الكمية - Quantity */}
                                                    <td className="py-3 px-3">
                                                        {item.isHistorical ? (
                                                            <div className="flex items-center justify-center font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                                                <span className="px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                                    {item.qty}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (item.qty > 1) {
                                                                            updateQty(item.id, item.qty - 1)
                                                                        } else {
                                                                            removeFromCart(item.id)
                                                                        }
                                                                    }}
                                                                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center font-bold transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                                                >
                                                                    <Minus size={13} />
                                                                </button>
                                                                <input
                                                                    ref={el => { if (el) qtyInputRefs.current[item.id] = el }}
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.qty}
                                                                    onFocus={() => {
                                                                        setFocusedItemId(item.id)
                                                                        setFocusedField('qty')
                                                                    }}
                                                                    onKeyDown={e => handleQtyKeyDown(e, item)}
                                                                    onChange={e => {
                                                                        const val = parseInt(e.target.value, 10)
                                                                        if (!isNaN(val) && val >= 1) {
                                                                            updateQty(item.id, val)
                                                                        }
                                                                    }}
                                                                    className={`w-14 h-7 text-center font-mono font-bold text-xs sm:text-sm bg-white dark:bg-slate-800 border rounded-lg outline-none transition-all shadow-2xs ${
                                                                        isEditingQty
                                                                            ? 'border-blue-600 ring-2 ring-blue-500/30 font-black'
                                                                            : 'border-slate-200 dark:border-slate-700'
                                                                    }`}
                                                                    title="الكمية - اضغط Enter للانتقال للسعر"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateQty(item.id, item.qty + 1)}
                                                                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center font-bold transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                                                                >
                                                                    <Plus size={13} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* الوحدة - Unit */}
                                                    <td className="hidden md:table-cell py-3 px-3 text-center text-slate-600 dark:text-slate-400 text-xs">
                                                        <span className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium">
                                                            {item.unit || 'قطعة'}
                                                        </span>
                                                    </td>

                                                    {/* السعر - Price */}
                                                    <td className="py-3 px-3">
                                                        {item.isHistorical ? (
                                                            <div className="flex flex-col items-end px-2">
                                                                <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                                                                    {formatCurrency(item.price)}
                                                                </div>
                                                                {item.priceUSD > 0 && (
                                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                                                        ${Number(item.priceUSD).toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <div className="flex items-center gap-1 w-full justify-end">
                                                                    {item.pricingCurrency === 'USD' && (
                                                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0" title="مسعر بالدولار">
                                                                            ${Number(item.priceUSD || (item.price / (usdExchangeRate || 7.30))).toFixed(2)}
                                                                        </span>
                                                                    )}
                                                                    {isEditingPrice && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => confirmItemPriceAndContinue(item)}
                                                                            className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 shrink-0"
                                                                            title="موافقة وفتح دليل الأصناف (Enter)"
                                                                        >
                                                                            <Check size={13} />
                                                                            <span>موافقة</span>
                                                                        </button>
                                                                    )}
                                                                    <input
                                                                        ref={el => { if (el) priceInputRefs.current[item.id] = el }}
                                                                        type="number"
                                                                        step="any"
                                                                        value={item.price}
                                                                        onFocus={() => {
                                                                            setFocusedItemId(item.id)
                                                                            setFocusedField('price')
                                                                        }}
                                                                        onKeyDown={e => handlePriceKeyDown(e, item)}
                                                                        onChange={e => {
                                                                            const val = parseFloat(e.target.value)
                                                                            if (!isNaN(val)) {
                                                                                updatePrice(item.id, val)
                                                                            } else if (e.target.value === '') {
                                                                                updatePrice(item.id, 0)
                                                                            }
                                                                        }}
                                                                        className={`w-24 h-7 text-left px-2 font-mono font-bold text-xs sm:text-sm bg-white dark:bg-slate-800 border rounded-lg outline-none transition-all shadow-2xs ${
                                                                            priceError?.itemId === item.id
                                                                                ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-50/20'
                                                                                : (isEditingPrice
                                                                                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 font-black'
                                                                                    : 'border-slate-200 dark:border-slate-700')
                                                                        }`}
                                                                        title={`السعر - مسموح من ${bounds?.min} إلى ${bounds?.max} - اضغط Enter للموافقة`}
                                                                    />
                                                                </div>
                                                                {/* Price bounds hint */}
                                                                {bounds && (
                                                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 select-none">
                                                                        <span>أدنى: {bounds.min}</span>
                                                                        <span>-</span>
                                                                        <span>أعلى: {bounds.max}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* الإجمالي - Subtotal */}
                                                    <td className="py-3 px-3 text-left font-mono font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                                                        {formatCurrency(itemSubtotal)}
                                                    </td>

                                                    {/* Action / Delete Button */}
                                                    <td className="py-3 px-2 text-center">
                                                        {item.isHistorical ? (
                                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 rounded border border-emerald-200 dark:border-emerald-800">
                                                                تم البيع
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeFromCart(item.id)}
                                                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-all cursor-pointer"
                                                                title="حذف هذا الصنف"
                                                            >
                                                                <X size={15} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            )
                                        })}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Table Bottom Totals Bar */}
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 shrink-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            {/* Summary Badges */}
                            <div className="flex items-center gap-3 text-xs">
                                <div>
                                    <span className="text-slate-400 ml-1">إجمالي الكميات:</span>
                                    <strong className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                        {displayedQtyTotal}
                                    </strong>
                                </div>
                                <div className="text-slate-300 dark:text-slate-700">|</div>
                                <div>
                                    <span className="text-slate-400 ml-1">المجموع:</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {formatCurrency(displayedSubtotal)}
                                    </span>
                                </div>
                                {displayedDiscount > 0 && (
                                    <>
                                        <div className="text-slate-300 dark:text-slate-700">|</div>
                                        <div>
                                            <span className="text-rose-500 ml-1">الخصم:</span>
                                            <span className="font-mono font-bold text-rose-600">
                                                -{formatCurrency(displayedDiscount)}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Net Total Box & Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        {activeHistoryInvoice ? 'إجمالي الفاتورة:' : 'الصافي المطلوب:'}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <div className="px-3 py-1 rounded-lg bg-[#24357a] text-white font-mono font-black text-base shadow-xs">
                                            {formatCurrency(displayedTotal)}
                                        </div>
                                        <div className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs flex items-center gap-1 shadow-2xs" title="المعادل بالدولار الأمريكي">
                                            <span>≈</span>
                                            <span>${Number(displayedTotal / (usdExchangeRate || 7.30)).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {activeHistoryInvoice ? (
                                    <>
                                        {canEditActiveInvoice && (
                                            <button
                                                type="button"
                                                onClick={() => handleStartEditInvoice(activeHistoryInvoice)}
                                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                                title="تعديل هذه الفاتورة النقدية (نفس اليوم)"
                                            >
                                                <Edit size={14} />
                                                <span>تعديل هذه الفاتورة</span>
                                            </button>
                                        )}

                                        {/* Reprint Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleReprint && handleReprint(activeHistoryInvoice)}
                                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                            title="إعادة طباعة هذه الفاتورة السابقة"
                                        >
                                            <Printer size={14} />
                                            <span>طباعة الفاتورة</span>
                                        </button>

                                        {/* Return to Sales Mode */}
                                        <button
                                            type="button"
                                            onClick={() => setHistoryIndex(-1)}
                                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                            title="العودة لشاشة البيع وبدء فاتورة جديدة"
                                        >
                                            <Plus size={14} />
                                            <span>العودة للبيع (فاتورة جديدة)</span>
                                        </button>
                                    </>
                                ) : editingInvoice ? (
                                    <>
                                        {/* Save Edit Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleSaveEditInvoice(false)}
                                            disabled={!cartItems.length || editSaving}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                            title="حفظ تعديلات الفاتورة وتحديث المخزون والخزينة تلقائياً"
                                        >
                                            <Save size={14} />
                                            <span>{editSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                                        </button>

                                        {/* Save & Print Edit Button */}
                                        <button
                                            type="button"
                                            onClick={() => handleSaveEditInvoice(true)}
                                            disabled={!cartItems.length || editSaving}
                                            className="px-3 py-1.5 bg-[#24357a] hover:bg-[#1a285a] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                            title="حفظ التعديلات وطباعة الفاتورة المعدلة"
                                        >
                                            <Printer size={14} />
                                            <span>حفظ وطباعة</span>
                                        </button>

                                        {/* Cancel Edit Button */}
                                        <button
                                            type="button"
                                            onClick={handleCancelEdit}
                                            disabled={editSaving}
                                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            title="إلغاء التعديل والتراجع"
                                        >
                                            <X size={14} />
                                            <span>إلغاء</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {/* Master Checkout & Payment Button (عند إتمام البيع - F9) */}
                                        <button
                                            type="button"
                                            onClick={() => setShowPaymentModal(true)}
                                            disabled={!cartItems.length || saving}
                                            className="px-4 sm:px-5 py-2 bg-gradient-to-r from-[#24357a] to-[#1b285d] hover:from-[#1b285d] hover:to-[#141e46] text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ring-2 ring-[#24357a]/20"
                                            title="إتمام عملية البيع واختيار وسيلة الدفع (F9)"
                                        >
                                            <Banknote size={16} className="text-emerald-400" />
                                            <span>إتمام البيع والدفع (F9)</span>
                                        </button>

                                        {/* Quick Save and Print Button */}
                                        <button
                                            type="button"
                                            onClick={handleSaveAndPrint}
                                            disabled={!cartItems.length || saving}
                                            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all flex items-center gap-1 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                            title="حفظ الفاتورة وطباعتها فوراً"
                                        >
                                            <Printer size={14} />
                                            <span>حفظ وطباعة</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>


                {/* ------------------------------------------------------------- */}
                {/* 3.C FAR LEFT (Third Child in RTL): Slim Vertical Tool Strip */}
                {/* ------------------------------------------------------------- */}
                <div className="w-10 shrink-0 h-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col items-center py-2.5 gap-2 select-none">
                    <button
                        type="button"
                        onClick={handleNewInvoiceClick}
                        className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center hover:bg-blue-100 transition-all cursor-pointer"
                        title="فاتورة جديدة"
                    >
                        <Plus size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveOnly}
                        disabled={!cartItems.length || saving}
                        className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer"
                        title="حفظ الفاتورة"
                    >
                        <Save size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveAndPrint}
                        disabled={!cartItems.length || saving}
                        className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 transition-all disabled:opacity-30 cursor-pointer"
                        title="طباعة (F9)"
                    >
                        <Printer size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={handleHoldBill}
                        disabled={!cartItems.length}
                        className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-850 text-amber-600 flex items-center justify-center hover:bg-amber-50 transition-all disabled:opacity-30 cursor-pointer"
                        title="تعليق الفاتورة (F7)"
                    >
                        <Archive size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => pos.setShowHeldBills && pos.setShowHeldBills(true)}
                        className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-850 text-orange-600 flex items-center justify-center hover:bg-orange-50 transition-all cursor-pointer relative"
                        title="الفواتير المعلقة"
                    >
                        <Clock size={15} />
                        {pos.heldBills?.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                                {pos.heldBills.length}
                            </span>
                        )}
                    </button>
                    {/* All Invoices Button (Replaces Sales Invoices page) */}
                    <button
                        type="button"
                        onClick={() => {
                            if (pos.loadHistory) pos.loadHistory()
                            if (pos.setHistoryFilters) {
                                pos.setHistoryFilters(prev => ({ ...prev, dateRange: '' }))
                            }
                            if (pos.setShowHistory) pos.setShowHistory(true)
                        }}
                        className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all cursor-pointer relative"
                        title="فواتير المبيعات (عرض وبحث وطباعة كافة الفواتير)"
                    >
                        <FileText size={15} />
                        {pos.historyList?.length > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-indigo-600 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                                {pos.historyList.length > 99 ? '99+' : pos.historyList.length}
                            </span>
                        )}
                    </button>

                    {/* Customer Mode: Add Customer Shortcut Button */}
                    {isCustomerMode && (
                        <button
                            type="button"
                            onClick={() => setShowAddCustomer && setShowAddCustomer(true)}
                            className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center hover:bg-purple-100 dark:hover:bg-purple-900 transition-all cursor-pointer"
                            title="إضافة عميل جديد"
                        >
                            <UserPlus size={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 4. BOTTOM BAR: زر دليل الأصناف المنبثق + إدخال صنف سريع */}
            {/* ========================================================================= */}
            <div className="shrink-0 px-3 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-md">
                <div className="flex items-center gap-2.5">
                    {/* Catalog Modal Trigger Button */}
                    <button
                        type="button"
                        onClick={() => setShowCatalogModal(true)}
                        className="h-10 px-4 bg-[#24357a] hover:bg-[#1a285a] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer shrink-0 active:scale-95"
                        title="فتح دليل الأصناف والمنتجات (Space)"
                    >
                        <Package size={17} />
                        <span className="hidden sm:inline">دليل الأصناف</span>
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Space</span>
                    </button>

                    {/* PC Builder Trigger Button */}
                    <button
                        type="button"
                        onClick={() => setShowPcBuilderModal(true)}
                        className="h-10 px-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 active:scale-95"
                        title="بناء تجميعة كمبيوتر مخصصة قطعة قطعة (F8)"
                    >
                        <Cpu size={17} />
                        <span className="hidden sm:inline">بناء تجميعة</span>
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">F8</span>
                    </button>

                    {/* Scanner Input with Barcode Icon */}
                    <form onSubmit={handleBarcodeSubmit} className="flex-1 flex items-center gap-2 min-w-0">
                        <div className="flex-1 relative">
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none text-slate-400">
                                <Barcode size={20} className="text-[#24357a]" />
                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 hidden sm:inline">
                                    إدخال صنف سريع
                                </span>
                            </div>
                            <input
                                ref={barcodeInputRef}
                                type="text"
                                value={fastBarcode}
                                onChange={e => setFastBarcode(e.target.value)}
                                placeholder="امسح الباركود أو اكتب رقم الصنف ثم اضغط Enter"
                                className="w-full h-10 pr-12 sm:pr-36 pl-20 text-xs font-mono bg-slate-50 dark:bg-slate-850 border-2 border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#24357a] focus:ring-1 focus:ring-[#24357a]/20 placeholder:text-slate-400 transition-all font-bold"
                            />
                            <button
                                type="submit"
                                className="absolute left-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#24357a] text-white rounded-lg text-xs font-bold hover:bg-[#1a285a] transition-all cursor-pointer"
                            >
                                إدخال
                            </button>
                        </div>

                        {/* Fast Status Feedback Banner */}
                        {feedbackMessage && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 ${feedbackMessage.type === 'success'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                            >
                                {feedbackMessage.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                <span>{feedbackMessage.text}</span>
                            </motion.div>
                        )}
                    </form>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 5. POPUP MODAL: دليل الأصناف (Item Catalog Modal) */}
            {/* ========================================================================= */}
            <AnimatePresence>
                {showCatalogModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs select-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-5xl h-[92vh] sm:h-[88vh] mx-2 sm:mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-right"
                        >
                            {/* Modal Header */}
                            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCatalogModal(false)}
                                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all cursor-pointer"
                                        title="إغلاق (Esc)"
                                    >
                                        <X size={18} />
                                    </button>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl">
                                        <ShoppingCart size={14} className="text-[#24357a]" />
                                        <span>في الفاتورة:</span>
                                        <span className="font-mono text-blue-700 dark:text-blue-400 font-black">{cartItems.length} صنف</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 justify-end">
                                            <span>دليل الأصناف والمنتجات</span>
                                            <div className="w-7 h-7 rounded-lg bg-[#24357a] text-white flex items-center justify-center shadow-xs">
                                                <Package size={16} />
                                            </div>
                                        </h3>
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            انقر على أي صنف لإضافته مباشرة إلى الفاتورة الحالية ({products.length} صنف مسجل)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Search & Category Filter Bar */}
                            <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-2.5">
                                {/* Search Input */}
                                <div className="relative">
                                    <Search size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        ref={modalSearchInputRef}
                                        type="text"
                                        value={modalSearch}
                                        onChange={e => setModalSearch(e.target.value)}
                                        onKeyDown={handleModalKeyDown}
                                        placeholder="ابحث بالاسم، الباركود، أو رقم الصنف SKU... (تنقل بالأسهم ↑ ↓ واضغط Enter)"
                                        className="w-full h-11 pr-11 pl-9 text-sm bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-[#24357a] focus:ring-2 focus:ring-[#24357a]/15 placeholder:text-slate-400 transition-all font-medium"
                                    />
                                    {modalSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setModalSearch('')}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            <X size={15} />
                                        </button>
                                    )}
                                </div>

                                {/* Category Filter Pills */}
                                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setModalCategory('')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${!modalCategory
                                            ? 'bg-[#24357a] text-white shadow-2xs'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <span>كل الأصناف</span>
                                        <span className="text-[10px] opacity-80 font-mono">({products.length})</span>
                                    </button>
                                    {categories.map(cat => {
                                        const catKey = typeof cat === 'object' ? (cat._id || cat.name) : String(cat)
                                        const catName = typeof cat === 'object' ? (cat.name || cat._id) : String(cat)
                                        const count = products.filter(p => {
                                            const pCat = typeof p.category === 'object' ? (p.category.name || p.category._id) : p.category
                                            return pCat === catName || pCat === catKey
                                        }).length
                                        const isSelected = modalCategory === catName || modalCategory === catKey
                                        const displayName = getCategoryName(cat)
                                        return (
                                            <button
                                                key={catKey}
                                                type="button"
                                                onClick={() => setModalCategory(catName)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${isSelected
                                                    ? 'bg-[#24357a] text-white shadow-2xs'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                <span>{typeof displayName === 'object' ? (displayName.name || '-') : displayName}</span>
                                                <span className="text-[10px] opacity-80 font-mono">({count})</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Modal Items Table (Rows / صفوف) */}
                            <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-slate-900 min-h-0">
                                {modalFilteredProducts.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16">
                                        <Package size={42} className="mb-2 opacity-30 text-[#24357a]" />
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            لا توجد أصناف مطابقة للبحث
                                        </p>
                                        <p className="text-xs text-slate-400 mb-4">
                                            جرب البحث باسم صنف آخر أو اختر قسماً آخر
                                        </p>
                                        {addCustomItem && modalSearch.trim() && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const customId = addCustomItem({ name: modalSearch.trim(), qty: 1, price: 0 })
                                                    playBeep(false)
                                                    setShowCatalogModal(false)
                                                    setModalSearch('')
                                                    setFocusedItemId(customId)
                                                    setFocusedField('qty')
                                                }}
                                                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                                            >
                                                <Plus size={15} />
                                                <span>إضافة &quot;{modalSearch.trim()}&quot; كصنف حر للفاتورة</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <table className="w-full text-right border-collapse text-xs min-w-[620px]">
                                        <thead className="sticky top-0 bg-[#24357a] text-white font-bold z-10 select-none shadow-xs">
                                            <tr>
                                                <th className="py-2.5 px-3 w-12 text-center">م</th>
                                                <th className="hidden sm:table-cell py-2.5 px-3 w-32">رقم الصنف</th>
                                                <th className="py-2.5 px-3">اسم الصنف</th>
                                                <th className="hidden md:table-cell py-2.5 px-3 w-32">القسم / التصنيف</th>
                                                <th className="hidden sm:table-cell py-2.5 px-3 w-20 text-center">الوحدة</th>
                                                <th className="py-2.5 px-3 w-28 text-center">رصيد {warehouseDisplayName}</th>
                                                <th className="py-2.5 px-3 w-28 text-left font-mono">سعر البيع</th>
                                                <th className="hidden lg:table-cell py-2.5 px-3 w-36 text-center font-mono">المدى (أدنى - أعلى)</th>
                                                <th className="py-2.5 px-3 w-24 text-center">اختيار</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                            {modalFilteredProducts.map((product, idx) => {
                                                const bounds = getItemPriceBounds(product)
                                                const cartItem = cartItems.find(i => i.id === (product.id || product._id))
                                                const qtyInCart = cartItem ? cartItem.qty : 0
                                                const warehouseStock = product.stocks?.find(s => {
                                                    const sWhId = s.warehouse?._id || s.warehouse
                                                    return sWhId?.toString() === selectedWarehouseId?.toString()
                                                })
                                                const stockQty = warehouseStock != null ? Number(warehouseStock.qty) : 0
                                                const isSelectedRow = idx === modalSelectedIndex

                                                return (
                                                    <tr
                                                        key={product.id || product._id}
                                                        ref={el => { if (el) modalRowRefs.current[idx] = el }}
                                                        onMouseEnter={() => setModalSelectedIndex(idx)}
                                                        onClick={() => handleSelectProductFromModal(product)}
                                                        className={`cursor-pointer transition-colors group select-none ${
                                                            isSelectedRow
                                                                ? 'bg-blue-100/90 dark:bg-blue-900/50 ring-2 ring-[#24357a] ring-inset shadow-xs font-bold'
                                                                : (qtyInCart > 0 ? 'bg-blue-50/30 dark:bg-blue-950/20 hover:bg-blue-50/60' : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60')
                                                        }`}
                                                    >
                                                        {/* م */}
                                                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold text-xs">
                                                            {idx + 1}
                                                        </td>

                                                        {/* رقم الصنف */}
                                                        <td className="hidden sm:table-cell py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                            <span className={`px-2 py-0.5 rounded border text-xs ${
                                                                isSelectedRow
                                                                    ? 'bg-white dark:bg-slate-800 border-[#24357a] text-[#24357a] dark:text-blue-400 font-black'
                                                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                            }`}>
                                                                {product.sku || product.barcode || '-'}
                                                            </span>
                                                        </td>

                                                        {/* اسم الصنف */}
                                                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                                            <div className="flex items-center gap-2">
                                                                <span className={isSelectedRow ? 'text-[#24357a] dark:text-blue-400 font-black text-sm' : 'group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors'}>
                                                                    {product.name}
                                                                </span>
                                                                {qtyInCart > 0 && (
                                                                    <span className="px-2 py-0.5 rounded-full bg-[#24357a] text-white text-[10px] font-mono font-bold shrink-0">
                                                                        {qtyInCart} بالفاتورة
                                                                    </span>
                                                                )}
                                                                {isSelectedRow && (
                                                                    <span className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 font-sans font-bold flex items-center gap-1 shadow-2xs">
                                                                        <span>محدد</span>
                                                                        <span className="font-mono">⏎</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* القسم */}
                                                        <td className="hidden md:table-cell py-2.5 px-3 text-slate-500 dark:text-slate-400 text-xs">
                                                            {typeof getCategoryName(product.category) === 'object' ? (getCategoryName(product.category)?.name || '-') : getCategoryName(product.category)}
                                                        </td>

                                                        {/* الوحدة */}
                                                        <td className="hidden sm:table-cell py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                                                            <span className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
                                                                {product.unit || 'قطعة'}
                                                            </span>
                                                        </td>

                                                        {/* رصيد المخزن */}
                                                        <td className="py-2.5 px-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                                                stockQty <= 0
                                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                                                    : stockQty <= 5
                                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                                            }`}>
                                                                {stockQty}
                                                            </span>
                                                        </td>

                                                        {/* سعر البيع */}
                                                        <td className="py-2.5 px-3 text-left font-mono font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                                                            {formatCurrency(product.price)}
                                                        </td>

                                                        {/* المدى (أدنى - أعلى) */}
                                                        <td className="hidden lg:table-cell py-2.5 px-3 text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                                {bounds.min} - {bounds.max}
                                                            </span>
                                                        </td>

                                                        {/* زر اختيار */}
                                                        <td className="py-2.5 px-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleSelectProductFromModal(product)
                                                                }}
                                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 mx-auto cursor-pointer ${
                                                                    isSelectedRow
                                                                        ? 'bg-[#24357a] text-white ring-2 ring-blue-400 scale-105'
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 group-hover:bg-[#24357a] group-hover:text-white'
                                                                }`}
                                                            >
                                                                <Plus size={13} />
                                                                <span>اختيار</span>
                                                                {isSelectedRow && (
                                                                    <span className="text-[9px] bg-white/25 px-1 py-0.2 rounded font-mono">⏎</span>
                                                                )}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Modal Footer Bar */}
                            <div className="px-5 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCatalogModal(false)}
                                        className="px-5 py-2 bg-[#24357a] hover:bg-[#1a285a] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Check size={14} />
                                        <span>تم والعودة للفاتورة (Esc)</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                    {/* Keyboard Navigation Tip */}
                                    <div className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg font-medium select-none">
                                        <span>التنقل:</span>
                                        <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 font-mono font-bold text-[11px]">↑</span>
                                        <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600 font-mono font-bold text-[11px]">↓</span>
                                        <span>بالأسهم أو الماوس، و</span>
                                        <span className="px-1.5 py-0.5 bg-[#24357a] text-white rounded font-mono font-bold text-[11px]">Enter ⏎</span>
                                        <span>للاختيار</span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <span className="text-slate-400">الأصناف المطابقة:</span>
                                        <strong className="font-mono text-slate-800 dark:text-slate-200 font-black">
                                            {modalFilteredProducts.length}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom Reusable Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                cancelText={confirmDialog.cancelText}
                altText={confirmDialog.altText}
                type={confirmDialog.type}
                onConfirm={confirmDialog.onConfirm}
                onCancel={confirmDialog.onCancel || (() => setConfirmDialog(prev => ({ ...prev, isOpen: false })))}
                onAlt={confirmDialog.onAlt}
            />

            {/* Master Checkout & Payment Modal (عند إتمام البيع) */}
            <PaymentModal
                show={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                totalAfterDiscount={displayedTotal}
                subtotal={displayedSubtotal}
                globalDiscount={displayedDiscount}
                currency={currency}
                selectedPaymentMethod={selectedPaymentMethod}
                setSelectedPaymentMethod={setSelectedPaymentMethod}
                paidAmount={paidAmount}
                setPaidAmount={setPaidAmount}
                effectivePaidAmount={effectivePaidAmount}
                change={change}
                selectedTreasury={selectedTreasury}
                setSelectedTreasury={setSelectedTreasury}
                treasuries={treasuries}
                splitPayments={splitPayments}
                setSplitPayments={setSplitPayments}
                customerId={customerId}
                setCustomerId={setCustomerId}
                customers={customers}
                customerWalletBalance={customerWalletBalance}
                applyWalletCredit={applyWalletCredit}
                walletAmountToUse={walletAmountToUse}
                onConfirmSave={handleConfirmPaymentSave}
                saving={saving}
                invoiceNumber={currentInvoiceNumber}
                customerName={displayedCustomerName}
                warehouseName={warehouseDisplayName}
                cartItemsCount={cartItems.length}
                allowCredit={mode === 'customer'}
            />

            {/* Custom PC Builder Modal */}
            <PcBuilderModal
                isOpen={showPcBuilderModal}
                onClose={handleClosePcBuilder}
                products={products}
                selectedWarehouseId={selectedWarehouseId}
                currentWarehouse={currentWarehouse}
                onAddCustomBundle={handleAddCustomBundle}
                onUpdateCustomBundle={handleUpdateCustomBundle}
                editingBundle={editingBundleItem}
                userRole={currentUser?.role}
                currency={currency}
            />

            {/* Central USD Exchange Rate Modal */}
            <ExchangeRateModal
                isOpen={showExchangeRateModal}
                onClose={() => setShowExchangeRateModal(false)}
                currentRate={usdExchangeRate}
                updatedAt={exchangeRateUpdatedAt}
                onSave={updateExchangeRate}
            />

            {/* Item Movement & History Modal [F1] */}
            <ItemHistoryModal
                isOpen={showHistoryModal}
                onClose={() => {
                    setShowHistoryModal(false)
                    setHistoryModalItem(null)
                }}
                itemId={historyModalItem?._id || historyModalItem?.id || historyModalItem?.item}
                initialItem={historyModalItem}
            />
        </div>
    )
}

