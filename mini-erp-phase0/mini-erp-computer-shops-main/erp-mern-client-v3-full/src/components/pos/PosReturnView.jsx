import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Barcode, Trash2, Plus, Minus, Save, Printer,
    RotateCcw, ArrowRight, ArrowLeft, LogOut, CheckCircle2, AlertCircle,
    Archive, ShoppingCart, Package, Layers, FileText, ChevronDown, Check,
    Sparkles, Clock, Calendar, User, Building2, Store, Zap, RefreshCw, X,
    Menu, LayoutDashboard, SlidersHorizontal, UserPlus, Users, Banknote, CreditCard, Wallet,
    Receipt, Cpu
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../lib/utils'
import { ReturnPaymentModal } from './modals/ReturnPaymentModal'
import { AddCustomerModal } from './modals/AddCustomerModal'
import { BundleDeconstructModal } from './modals/BundleDeconstructModal'

/**
 * PosReturnView - Master Sales Return Workstation
 * 
 * Millimeter-for-millimeter equivalent to the POS FastInvoiceView,
 * specifically customized for Sales Returns:
 * - Supports "مردود نقدي" (Cash Return) and "مردود مبيعات" (Customer Return)
 * - Deep Crimson / Rose visual identity so cashier clearly distinguishes returns
 * - Barcode scanner & quick product grid
 * - Direct return or reference to original invoice
 * - Restocks returned items into warehouse
 * - Refunds cash from treasury or credits customer account (Credit Note)
 */
export const PosReturnView = ({
    pos,
    mode = 'cash', // 'cash' (مردود نقدي) or 'customer' (مردود مبيعات)
    onExit,
    onSwitchMode,
    onToggleNav,
    showNavInPos
}) => {
    const isCustomerMode = mode === 'customer'

    // Destructure from usePosReturn hook
    const {
        me,
        warehouses = [],
        selectedWarehouseId,
        currentWarehouse,
        setWarehouse,
        products = [],
        loadingProducts,
        refreshProducts,
        customers = [],
        treasuries = [],
        currency = 'د.ل',
        cartItems = [],
        addToCart,
        addToCartBySku,
        updateQty,
        updatePrice,
        removeFromCart,
        clearCart,
        subtotal = 0,
        globalDiscount = 0,
        setGlobalDiscount,
        totalAfterDiscount = 0,
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
        showReturnModal,
        setShowReturnModal,
        showAddCustomer,
        setShowAddCustomer,
        customerSearch = '',
        setCustomerSearch,
        newCustomer,
        setNewCustomer,
        addingCustomer,
        handleAddCustomer,
        saving = false,
        lastReturn,
        showHistory,
        setShowHistory,
        historyList = [],
        loadingHistory,
        loadReturnHistory,
        selectedHistoryReturn,
        setSelectedHistoryReturn,
        nextReturnNumber,
        fetchNextReturnNumber,
        handleSaveReturn,

        // Invoices Sidebar Props
        recentInvoices = [],
        loadingInvoicesList = false,
        invoiceSearchQuery = '',
        setInvoiceSearchQuery,
        invoiceDateFilter = 'all',
        setInvoiceDateFilter,
        sidebarTab = 'invoices',
        setSidebarTab,
        fetchRecentInvoices,
        selectInvoice,
        addItemFromInvoice
    } = pos

    // User authentication
    const { me: authUser, user: authUserAlt } = useAuth() || {}
    const currentUser = authUser || authUserAlt || me
    const loggedInName = currentUser?.name || currentUser?.username || 'الكاشير'

    // Real-time clock & date
    const [currentTime, setCurrentTime] = useState('')
    const [currentDate, setCurrentDate] = useState('')

    useEffect(() => {
        const updateClock = () => {
            const now = new Date()
            setCurrentTime(now.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
            setCurrentDate(now.toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' }))
        }
        updateClock()
        const timer = setInterval(updateClock, 1000)
        return () => clearInterval(timer)
    }, [])

    // Barcode input focus
    const barcodeInputRef = useRef(null)
    const [barcodeInput, setBarcodeInput] = useState('')

    const handleBarcodeSubmit = (e) => {
        e.preventDefault()
        if (!barcodeInput.trim()) return
        const success = addToCartBySku(barcodeInput.trim())
        if (success) {
            setBarcodeInput('')
        }
    }

    // Customer picker state in customer return mode
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
    const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(0)

    const filteredCustomers = useMemo(() => {
        const q = (customerSearch || '').trim().toLowerCase()
        if (!q) return customers.slice(0, 30)
        return customers.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.phone && c.phone.includes(q)) ||
            (c.code && c.code.toLowerCase().includes(q))
        ).slice(0, 30)
    }, [customers, customerSearch])

    const handleSelectCustomer = (cust) => {
        setCustomerId(cust._id)
        setCustomerSearch(cust.name)
        setCustomCustomerName(cust.name)
        setCustomerDropdownOpen(false)
        if (barcodeInputRef.current) barcodeInputRef.current.focus()
    }

    // Catalog search & category filter
    const [catalogSearch, setCatalogSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('ALL')

    const categories = useMemo(() => {
        const set = new Set()
        products.forEach(p => {
            const catName = typeof p.category === 'object' ? p.category?.name : p.category
            if (catName) set.add(catName)
        })
        return ['ALL', ...Array.from(set)]
    }, [products])

    const filteredProducts = useMemo(() => {
        let list = products
        if (selectedCategory !== 'ALL') {
            list = list.filter(p => {
                const catName = typeof p.category === 'object' ? p.category?.name : p.category
                return catName === selectedCategory
            })
        }
        if (catalogSearch.trim()) {
            const q = catalogSearch.trim().toLowerCase()
            list = list.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q) ||
                (p.barcode || '').toLowerCase().includes(q)
            )
        }
        return list
    }, [products, selectedCategory, catalogSearch])

    // Current warehouse display
    const warehouseDisplayName = useMemo(() => {
        if (!selectedWarehouseId) return 'المخزن الرئيسي'
        const wh = warehouses.find(w => w._id === selectedWarehouseId)
        return wh ? wh.name : 'المخزن الرئيسي'
    }, [selectedWarehouseId, warehouses])

    // Focus barcode on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (barcodeInputRef.current) barcodeInputRef.current.focus()
        }, 300)
        return () => clearTimeout(timer)
    }, [mode])

    return (
        <div className="h-full w-full flex flex-col bg-[#fdf2f4]/60 dark:bg-slate-950 select-none overflow-hidden font-sans">
            {/* ==================== 1. TOP HEADER BAR ==================== */}
            <div className="h-12 bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white flex items-center justify-between px-3 sm:px-4 shadow-md shrink-0 border-b border-rose-800/50">
                {/* Right: Branding & Workstation Switcher */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-600/30 text-rose-300 flex items-center justify-center font-black border border-rose-500/40 shadow-xs">
                            <RotateCcw size={16} />
                        </div>
                        <div>
                            <div className="text-xs sm:text-sm font-black tracking-wide flex items-center gap-1.5">
                                <span>مردودات المبيعات</span>
                                <span className="text-[9px] bg-rose-600/40 text-rose-200 px-1.5 py-0.2 rounded border border-rose-500/30">
                                    إرجاع بضاعة
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="h-5 w-px bg-rose-800/60 hidden sm:block"></div>

                    {/* Workstation Mode Switcher (مردود نقدي vs مردود مبيعات) */}
                    <div className="flex items-center bg-black/30 p-0.5 rounded-lg border border-rose-800/40 text-xs">
                        <button
                            type="button"
                            onClick={() => onSwitchMode && onSwitchMode('fast')}
                            className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                !isCustomerMode
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-rose-200 hover:text-white'
                            }`}
                            title="شاشة المردود النقدي السريع (زبائن عابرين)"
                        >
                            <Zap size={13} />
                            <span>مردود نقدي</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onSwitchMode && onSwitchMode('split')}
                            className={`px-3 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                isCustomerMode
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-rose-200 hover:text-white'
                            }`}
                            title="شاشة مردودات عملاء الحسابات والآجل"
                        >
                            <Users size={13} />
                            <span>مردود مبيعات</span>
                        </button>
                    </div>
                </div>

                {/* Center: Receiving Warehouse Selector */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-black/25 px-2.5 py-1 rounded-lg border border-rose-800/40 text-xs">
                        <Building2 size={13} className="text-rose-300" />
                        <span className="text-rose-200 text-[10px] hidden md:inline">مخزن الاستلام:</span>
                        <select
                            value={selectedWarehouseId || ''}
                            onChange={e => setWarehouse(e.target.value)}
                            className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
                        >
                            {warehouses.map(w => (
                                <option key={w._id} value={w._id} className="bg-slate-900 text-white">
                                    {w.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Left: Clock, Cashier Name, Exit */}
                <div className="flex items-center gap-3 text-xs">
                    <div className="hidden lg:flex items-center gap-2 text-rose-200/90 font-mono text-[11px]">
                        <Calendar size={13} />
                        <span>{currentDate}</span>
                        <Clock size={13} className="ml-1" />
                        <span>{currentTime}</span>
                    </div>

                    <div className="h-5 w-px bg-rose-800/60 hidden lg:block"></div>

                    <div className="flex items-center gap-1.5 text-rose-100">
                        <User size={13} className="text-rose-400" />
                        <span className="font-bold text-xs max-w-[100px] truncate">{loggedInName}</span>
                    </div>

                    <button
                        type="button"
                        onClick={onExit}
                        className="p-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-800 text-rose-300 hover:text-white transition-colors cursor-pointer border border-rose-800/40"
                        title="خروج للرئيسية"
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>

            {/* ==================== 2. UPPER CARD (5 COLUMNS) ==================== */}
            <div className="px-3 pt-2.5 shrink-0">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-950/60 p-2.5 shadow-2xs">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                        {/* 1. Return Number */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <RotateCcw size={11} className="text-rose-600" />
                                <span>رقم المرتجع</span>
                            </span>
                            <div className="h-8 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg px-2 flex items-center font-mono font-bold text-rose-700 dark:text-rose-300 text-xs">
                                #{nextReturnNumber || 'RET-00001'}
                            </div>
                        </div>

                        {/* 2. Date */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Calendar size={11} className="text-slate-400" />
                                <span>التاريخ</span>
                            </span>
                            <div className="h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 flex items-center font-mono text-slate-700 dark:text-slate-300 text-xs">
                                {currentDate}
                            </div>
                        </div>

                        {/* 3. Time */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock size={11} className="text-slate-400" />
                                <span>الوقت</span>
                            </span>
                            <div className="h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 flex items-center font-mono text-slate-700 dark:text-slate-300 text-xs">
                                {currentTime}
                            </div>
                        </div>

                        {/* 4. Customer Field */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <User size={11} className="text-blue-600" />
                                    <span>العميل</span>
                                </span>
                                {isCustomerMode && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddCustomer(true)}
                                        className="text-[9px] text-blue-600 hover:underline flex items-center gap-0.5"
                                        title="إضافة عميل جديد"
                                    >
                                        <Plus size={10} /> جديد
                                    </button>
                                )}
                            </span>
                            {!isCustomerMode ? (
                                <input
                                    type="text"
                                    value={customCustomerName}
                                    onChange={e => setCustomCustomerName(e.target.value)}
                                    placeholder="عميل نقدي"
                                    className="h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500 transition-colors"
                                />
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={customerSearch}
                                        onChange={e => {
                                            setCustomerSearch(e.target.value)
                                            setCustomerDropdownOpen(true)
                                        }}
                                        onFocus={() => setCustomerDropdownOpen(true)}
                                        placeholder="🔍 ابحث عن عميل..."
                                        className="w-full h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pr-2 pl-6 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-rose-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setCustomerDropdownOpen(p => !p)}
                                        className="absolute left-1 top-2 text-slate-400"
                                    >
                                        <ChevronDown size={14} />
                                    </button>

                                    {customerDropdownOpen && (
                                        <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredCustomers.map(c => (
                                                <div
                                                    key={c._id}
                                                    onClick={() => handleSelectCustomer(c)}
                                                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-slate-800 rounded cursor-pointer flex items-center justify-between text-xs"
                                                >
                                                    <div>
                                                        <span className="font-bold text-slate-800 dark:text-white block">{c.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{c.phone || c.code}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-[10px] font-mono font-bold ${(c.balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            {formatCurrency(c.balance || 0)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 5. Original Invoice (Optional) / Notes */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <FileText size={11} className="text-slate-400" />
                                    <span>الفاتورة الأصلية (تجميعة أو صنف)</span>
                                </span>
                                {originalInvoice && (
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                                        ✓ محملة ({originalInvoice.items?.length || 0} صنف)
                                    </span>
                                )}
                            </span>
                            <div className="relative flex items-center gap-1">
                                <input
                                    type="text"
                                    value={originalInvoiceNumber}
                                    onChange={e => setOriginalInvoiceNumber(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') fetchOriginalInvoice(); }}
                                    placeholder="رقم الفاتورة أو الباركود..."
                                    className="flex-1 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 focus:border-rose-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => fetchOriginalInvoice()}
                                    disabled={loadingInvoice || !originalInvoiceNumber.trim()}
                                    className="px-2.5 h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50 transition-colors"
                                    title="استدعاء الفاتورة بالكامل"
                                >
                                    {loadingInvoice ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                                    <span className="hidden sm:inline">جلب</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Original Invoice Breakdown Banner */}
            {originalInvoice && (
                <div className="mx-3 mt-1.5 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-800/60 shadow-xs flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                                <Package size={14} className="text-purple-600" />
                                <span>أصناف الفاتورة الأصلية #{originalInvoice.number}:</span>
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                ({originalInvoice.customerName || 'عميل نقدي'} - إجمالي: {originalInvoice.totals?.grand || originalInvoice.total} {currency})
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setOriginalInvoice(null); setOriginalInvoiceNumber(''); }}
                            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                            إلغاء ربط الفاتورة ✕
                        </button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                        {originalInvoice.items?.map((invItem, idx) => {
                            const isBundle = Boolean(invItem.isBundle || invItem.bundleComponents?.length)
                            return (
                                <div
                                    key={idx}
                                    className="shrink-0 p-2 rounded-lg bg-white dark:bg-slate-850 border border-purple-200/80 dark:border-purple-800 flex items-center gap-2.5 shadow-2xs"
                                >
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                                                {invItem.name}
                                            </span>
                                            {isBundle && (
                                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                                    تجميعة ({invItem.bundleComponents?.length || 0} قطع)
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            كمية: {invItem.qty} | سعر: {invItem.price} {currency}
                                        </span>
                                    </div>

                                    {isBundle ? (
                                        <button
                                            type="button"
                                            onClick={() => setActiveDeconstructBundle(invItem)}
                                            className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs active:scale-98"
                                        >
                                            <Cpu size={13} />
                                            <span>تفكيك التجميعة (إرجاع / استبدال)</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => addItemFromInvoice ? addItemFromInvoice(invItem) : addToCart({
                                                id: invItem.item?._id || invItem.item || invItem._id,
                                                item: invItem.item?._id || invItem.item || invItem._id,
                                                name: invItem.name,
                                                sku: invItem.sku || '',
                                                price: invItem.price,
                                                qty: 1,
                                                unit: invItem.unit || 'قطعة'
                                            })}
                                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs active:scale-98"
                                        >
                                            <Plus size={12} />
                                            <span>إرجاع هذا الصنف</span>
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ==================== 3. MAIN SPLIT WORKSTATION ==================== */}
            <div className="flex-1 flex overflow-hidden px-3 pt-2.5 pb-2 gap-2.5">
                {/* A. RIGHT: RETURN ITEMS TABLE */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-950/60 shadow-xs overflow-hidden">
                    {/* Table Header Badge */}
                    <div className="px-3 py-2 bg-gradient-to-r from-rose-900 to-rose-950 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold">
                            <RotateCcw size={14} className="text-rose-300" />
                            <span>جدول الأصناف المرجعة</span>
                            <span className="text-[10px] bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-full">
                                {cartItems.length} صنف
                            </span>
                        </div>
                        {cartItems.length > 0 && (
                            <button
                                type="button"
                                onClick={clearCart}
                                className="text-[11px] text-rose-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                            >
                                <Trash2 size={12} /> تفريغ القائمة
                            </button>
                        )}
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 overflow-y-auto">
                        {cartItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 gap-2">
                                <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
                                    <Receipt size={28} />
                                </div>
                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                                    {originalInvoice ? 'اختر الأصناف المراد إرجاعها من الشريط أعلاه' : 'قائمة المرتجع فارغة'}
                                </span>
                                <span className="text-xs text-slate-400 max-w-sm text-center">
                                    {originalInvoice
                                        ? `الفاتورة #${originalInvoice.number} محملة الآن. اضغط على زر [إرجاع هذا الصنف] لإضافته هنا.`
                                        : '👈 اختر أي فاتورة من قائمة الفواتير الجانبية لعرض أصنافها والبدء في استرجاعها مباشرة.'}
                                </span>
                            </div>
                        ) : (
                            <table className="w-full text-right border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 text-[11px] font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="py-2 px-3 w-8">#</th>
                                        <th className="py-2 px-3">اسم الصنف المرتجع</th>
                                        <th className="py-2 px-3 text-center w-36">كمية المرتجع</th>
                                        <th className="py-2 px-3 text-center w-20">الوحدة</th>
                                        <th className="py-2 px-3 text-left w-28">سعر الإرجاع</th>
                                        <th className="py-2 px-3 text-left w-28">إجمالي المرتجع</th>
                                        <th className="py-2 px-2 text-center w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                                    {cartItems.map((item, idx) => {
                                        const lineTotal = Number(item.qty || 1) * Number(item.price || 0)
                                        return (
                                            <tr key={item.id || idx} className="hover:bg-rose-50/40 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span>{item.name}</span>
                                                        {item.isBundle && (
                                                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                                                                تجميعة كاملة
                                                            </span>
                                                        )}
                                                        {item.isComponentFromBundle && (
                                                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                                                قطعة من تجميعة ({item.parentBundleName || ''})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                                        <span>{item.sku}</span>
                                                        {item.serials && item.serials.length > 0 && (
                                                            <span className="text-amber-600 dark:text-amber-400">S/N: {item.serials.join(', ')}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Qty +/- */}
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQty(item.id, (item.qty || 1) - 1)}
                                                            className="w-6 h-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                                                        >
                                                            <Minus size={11} />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.qty}
                                                            onChange={e => updateQty(item.id, e.target.value)}
                                                            className="w-12 h-6 text-center font-mono font-bold text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQty(item.id, (item.qty || 1) + 1)}
                                                            className="w-6 h-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                                                        >
                                                            <Plus size={11} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-slate-500">{item.unit || 'قطعة'}</td>
                                                {/* Return Price */}
                                                <td className="py-2.5 px-3 text-left">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={item.price}
                                                        onChange={e => updatePrice(item.id, e.target.value)}
                                                        className="w-20 h-6 text-left font-mono font-bold text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 outline-none text-rose-600"
                                                    />
                                                </td>
                                                {/* Line Total */}
                                                <td className="py-2.5 px-3 text-left font-mono font-black text-rose-600 text-xs">
                                                    {formatCurrency(lineTotal)}
                                                </td>
                                                <td className="py-2.5 px-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                                        title="حذف الصنف"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Table Footer: Totals & Checkout Button */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">إجمالي المرتجع:</span>
                            <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                                {formatCurrency(totalAfterDiscount)}
                            </span>
                            <span className="text-xs font-bold text-rose-700">{currency}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowReturnModal(true)}
                                disabled={!cartItems.length || saving}
                                className="px-5 py-2.5 bg-gradient-to-r from-rose-800 to-rose-950 hover:from-rose-900 hover:to-slate-900 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ring-2 ring-rose-500/30"
                                title="إتمام عملية الإرجاع وصرف المبلغ (F9)"
                            >
                                <RotateCcw size={16} />
                                <span>إتمام الإرجاع والصرف (F9)</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* B. SIDEBAR: INVOICES NAVIGATOR (OR ITEM CATALOG) */}
                <div className="w-80 lg:w-96 flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-950/60 shadow-xs overflow-hidden shrink-0">
                    {/* Tab Selector */}
                    <div className="p-1 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex gap-1">
                        <button
                            type="button"
                            onClick={() => setSidebarTab('invoices')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                sidebarTab === 'invoices'
                                    ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <Receipt size={14} />
                            <span>سجل الفواتير ({recentInvoices.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSidebarTab('products')}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                sidebarTab === 'products'
                                    ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <Package size={14} />
                            <span>دليل الأصناف</span>
                        </button>
                    </div>

                    {sidebarTab === 'invoices' ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Invoices Search & Filter Header */}
                            <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
                                <div className="relative flex items-center gap-1">
                                    <div className="relative flex-1">
                                        <Search size={13} className="absolute right-2.5 top-2.5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={invoiceSearchQuery}
                                            onChange={e => setInvoiceSearchQuery(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') fetchRecentInvoices(invoiceSearchQuery, invoiceDateFilter)
                                            }}
                                            placeholder="رقم الفاتورة أو العميل..."
                                            className="w-full h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pr-8 pl-6 text-xs outline-none focus:border-rose-500 font-mono"
                                        />
                                        {invoiceSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setInvoiceSearchQuery('')
                                                    fetchRecentInvoices('', invoiceDateFilter)
                                                }}
                                                className="absolute left-2 top-2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fetchRecentInvoices(invoiceSearchQuery, invoiceDateFilter)}
                                        className="px-2.5 h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center justify-center cursor-pointer transition-colors"
                                        title="بحث"
                                    >
                                        {loadingInvoicesList ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                                    </button>
                                </div>

                                {/* Quick Filters */}
                                <div className="flex items-center justify-between text-[11px]">
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setInvoiceDateFilter('all')
                                                fetchRecentInvoices(invoiceSearchQuery, 'all')
                                            }}
                                            className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                                invoiceDateFilter === 'all'
                                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            الكل
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setInvoiceDateFilter('today')
                                                fetchRecentInvoices(invoiceSearchQuery, 'today')
                                            }}
                                            className={`px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                                                invoiceDateFilter === 'today'
                                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            ⚡ فواتير اليوم
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => fetchRecentInvoices(invoiceSearchQuery, invoiceDateFilter)}
                                        className="text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer text-[10px]"
                                        title="تحديث"
                                    >
                                        <RefreshCw size={11} className={loadingInvoicesList ? 'animate-spin' : ''} />
                                        <span>تحديث</span>
                                    </button>
                                </div>
                            </div>

                            {/* Invoices List */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                                {loadingInvoicesList ? (
                                    <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                                        <RefreshCw size={20} className="animate-spin text-rose-500" />
                                        <span>جاري جلب الفواتير...</span>
                                    </div>
                                ) : recentInvoices.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                                        <FileText size={24} className="text-slate-300" />
                                        <span>لا توجد فواتير مطابقة</span>
                                    </div>
                                ) : (
                                    recentInvoices.map((inv) => {
                                        const isSelected = originalInvoice?._id === inv._id
                                        const dateStr = inv.date ? new Date(inv.date).toLocaleDateString('ar-LY', { month: 'numeric', day: 'numeric' }) : ''
                                        const timeStr = inv.date ? new Date(inv.date).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }) : ''
                                        const totalLYD = inv.totals?.grand || inv.total || 0
                                        const custName = inv.customerName || inv.customer?.name || 'عميل نقدي'

                                        return (
                                            <div
                                                key={inv._id}
                                                onClick={() => selectInvoice(inv)}
                                                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 shadow-2xs relative ${
                                                    isSelected
                                                        ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-500 ring-1 ring-purple-400 dark:border-purple-600'
                                                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-700 hover:bg-rose-50/20'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`font-mono font-bold text-xs ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-900 dark:text-white'}`}>
                                                            #{inv.number}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-600 text-white">
                                                                محددة ✓
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="font-mono font-black text-xs text-rose-700 dark:text-rose-400">
                                                        {formatCurrency(totalLYD)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="truncate max-w-[170px] font-medium text-slate-700 dark:text-slate-300">
                                                        👤 {custName}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-400">
                                                        {dateStr} {timeStr}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                                    <span className="text-slate-400">
                                                        📦 {inv.items?.length || 0} أصناف
                                                    </span>
                                                    <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-0.5 hover:underline">
                                                        <span>اختيار الأصناف</span>
                                                        <ArrowLeft size={10} />
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Legacy Product Catalog */
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={catalogSearch}
                                        onChange={e => setCatalogSearch(e.target.value)}
                                        placeholder="🔍 بحث في الأصناف..."
                                        className="w-full h-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pr-2 pl-6 text-xs outline-none focus:border-rose-500"
                                    />
                                    {catalogSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setCatalogSearch('')}
                                            className="absolute left-2 top-2 text-slate-400"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                                    {categories.map(cat => {
                                        const catKey = typeof cat === 'object' ? (cat._id || cat.name) : String(cat)
                                        const catName = typeof cat === 'object' ? (cat.name || cat._id) : String(cat)
                                        return (
                                            <button
                                                key={catKey}
                                                type="button"
                                                onClick={() => setSelectedCategory(catName)}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                                                    selectedCategory === catName
                                                        ? 'bg-rose-600 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                                }`}
                                            >
                                                {catName === 'ALL' ? 'الكل' : catName}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {filteredProducts.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400">
                                        لا توجد أصناف مطابقة
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {filteredProducts.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => addToCart(p)}
                                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-600 bg-white dark:bg-slate-850 hover:bg-rose-50/30 cursor-pointer transition-all flex flex-col justify-between shadow-2xs group"
                                            >
                                                <div className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-2 mb-1 group-hover:text-rose-700 dark:group-hover:text-rose-400">
                                                    {p.name}
                                                </div>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="text-slate-400 font-mono">{p.sku}</span>
                                                    <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                                                        {formatCurrency(p.price)}
                                                    </span>
                                                </div>
                                                {Boolean(p.isBundle || p.bundleComponents?.length) && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveDeconstructBundle(p);
                                                        }}
                                                        className="mt-1.5 py-1 px-2 rounded-md bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-[10px] font-bold border border-purple-200 dark:border-purple-800 flex items-center justify-center gap-1 transition-colors"
                                                    >
                                                        <Cpu size={11} />
                                                        <span>تفكيك التجميعة</span>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* C. FAR LEFT: VERTICAL TOOL STRIP */}
                <div className="w-10 flex flex-col items-center justify-between py-2 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-950/60 shadow-2xs shrink-0">
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={clearCart}
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                            title="فاتورة مرتجع جديدة"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowReturnModal(true)}
                            disabled={!cartItems.length}
                            className="w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40"
                            title="إتمام المرتجع (F9)"
                        >
                            <Save size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowHistory(p => !p)}
                            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
                            title="سجل المردودات السابقة"
                        >
                            <FileText size={16} />
                        </button>
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={onToggleNav}
                            className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                            title="إظهار / إخفاء القوائم العلوية"
                        >
                            <Menu size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ==================== 4. BOTTOM BAR: BARCODE SCANNER ==================== */}
            <div className="px-3 pb-2.5 shrink-0">
                <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            ref={barcodeInputRef}
                            type="text"
                            value={barcodeInput}
                            onChange={e => setBarcodeInput(e.target.value)}
                            placeholder="مسح باركود الصنف المرتجع هنا (اضغط Enter للإضافة التلقائية)..."
                            className="w-full h-10 bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-800 rounded-xl pr-10 pl-3 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-rose-600 shadow-2xs"
                        />
                        <Barcode size={18} className="absolute right-3 top-2.5 text-rose-500" />
                    </div>
                    <button
                        type="submit"
                        className="h-10 px-5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                        <span>إدخال</span>
                    </button>
                </form>
            </div>

            {/* ==================== 5. MODALS ==================== */}
            {/* Master Return Finalization Modal */}
            <ReturnPaymentModal
                show={showReturnModal}
                onClose={() => setShowReturnModal(false)}
                totalRefundAmount={totalAfterDiscount}
                subtotal={subtotal}
                globalDiscount={globalDiscount}
                currency={currency}
                selectedRefundMethod={selectedRefundMethod}
                setSelectedRefundMethod={setSelectedRefundMethod}
                selectedTreasury={selectedTreasury}
                setSelectedTreasury={setSelectedTreasury}
                treasuries={treasuries}
                customerId={customerId}
                setCustomerId={setCustomerId}
                customers={customers}
                customerName={isCustomerMode ? (customCustomerName || 'عميل مسجل') : (customCustomerName || 'عميل نقدي')}
                onConfirmReturn={async (shouldPrint) => {
                    const success = await handleSaveReturn(shouldPrint)
                    if (success) {
                        setShowReturnModal(false)
                    }
                }}
                saving={saving}
                returnNumber={nextReturnNumber}
                originalInvoiceNumber={originalInvoiceNumber}
                setOriginalInvoiceNumber={setOriginalInvoiceNumber}
                returnReason={returnReason}
                setReturnReason={setReturnReason}
                returnNotes={returnNotes}
                setReturnNotes={setReturnNotes}
                warehouseName={warehouseDisplayName}
                returnItemsCount={cartItems.length}
            />

            {/* Add Customer Modal */}
            <AddCustomerModal
                show={showAddCustomer}
                onClose={() => setShowAddCustomer(false)}
                newCustomer={newCustomer}
                setNewCustomer={setNewCustomer}
                onAdd={handleAddCustomer}
                adding={addingCustomer}
            />

            {/* Return History Drawer */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex justify-end"
                        onClick={() => setShowHistory(false)}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25 }}
                            className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 bg-gradient-to-r from-rose-900 to-rose-950 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2 font-bold text-sm">
                                    <RotateCcw size={16} />
                                    <span>سجل المردودات السابقة</span>
                                </div>
                                <button type="button" onClick={() => setShowHistory(false)} className="text-rose-300 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-3 flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                {loadingHistory ? (
                                    <div className="p-6 text-center text-xs text-slate-400">جاري تحميل السجل...</div>
                                ) : historyList.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400">لا توجد مردودات سابقة</div>
                                ) : (
                                    historyList.map(ret => (
                                        <div key={ret._id} className="py-3 flex items-center justify-between text-xs">
                                            <div>
                                                <div className="font-bold font-mono text-rose-600">
                                                    #{ret.returnNumber || `RET-${ret._id.slice(-5)}`}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {ret.customer?.name || 'عميل نقدي'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {new Date(ret.createdAt).toLocaleDateString('ar-LY')}
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <div className="font-black font-mono text-sm text-slate-900 dark:text-white">
                                                    {formatCurrency(ret.totalAmount)} {currency}
                                                </div>
                                                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold">
                                                    {ret.status === 'returned' ? 'تم الإرجاع' : ret.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bundle Deconstruct Modal */}
            <BundleDeconstructModal
                isOpen={!!activeDeconstructBundle}
                onClose={() => setActiveDeconstructBundle(null)}
                bundleItem={activeDeconstructBundle}
                onConfirmReturn={addItemsToReturnCart}
            />
        </div>
    )
}
