import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, Barcode, Trash2, Plus, Minus, Save, Printer, ArrowRight,
    RotateCcw, CheckCircle2, AlertCircle, ShoppingCart, Package,
    Building2, Store, Calendar, CreditCard, Banknote, Sparkles,
    Hash, FileText, Check, X, ShieldAlert, ArrowUpRight, DollarSign
} from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useWarehouse } from '../context/WarehouseContext'
import { useSettings } from '../context/SettingsContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { TreasurySelector } from '../components/TreasurySelector'
import ItemHistoryModal from '../components/modals/ItemHistoryModal'

// Audio feedback helper
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
        // AudioContext error suppressed
    }
}

export default function PurchaseInvoiceView() {
    const { push } = useToast()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { warehouses, selectedWarehouseId } = useWarehouse()
    const { usdExchangeRate = 7.30 } = useSettings()

    // ── Master States ──────────────────────────────────────────────────────────
    const [suppliers, setSuppliers] = useState([])
    const [products, setProducts] = useState([])
    const [loadingData, setLoadingData] = useState(true)

    // Exchange Rate & Currency
    const [invoiceExchangeRate, setInvoiceExchangeRate] = useState(Number(usdExchangeRate) || 7.30)
    const [isEditingRate, setIsEditingRate] = useState(false)
    const [rateInput, setRateInput] = useState(String(usdExchangeRate || 7.30))
    const [invoiceCurrency, setInvoiceCurrency] = useState('LYD')

    // Sync exchange rate when settings load
    useEffect(() => {
        if (usdExchangeRate) {
            setInvoiceExchangeRate(prev => (prev === 7.30 ? Number(usdExchangeRate) : prev))
            setRateInput(prev => (prev === '7.3' || prev === '7.30' ? String(usdExchangeRate) : prev))
        }
    }, [usdExchangeRate])

    // Invoice Header Form
    const editId = searchParams.get('edit')
    const isEditMode = Boolean(editId)
    const [supplierId, setSupplierId] = useState(searchParams.get('supplier') || '')
    const [warehouseId, setWarehouseId] = useState(selectedWarehouseId || '')
    const [invoiceNumber, setInvoiceNumber] = useState('')
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
    const [note, setNote] = useState('')

    // Cart Items: [{ item: id, name, sku, barcode, qty, cost, costUSD, inputCurrency, total, totalUSD }]
    const [cart, setCart] = useState([])
    const [discount, setDiscount] = useState(0)

    // Payment Section
    const [paymentMethod, setPaymentMethod] = useState('credit') // 'credit' | 'cash'
    const [treasuryId, setTreasuryId] = useState('')

    // Search & Suggestions
    const [searchQuery, setSearchQuery] = useState('')
    const [suggestions, setSuggestions] = useState([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const searchInputRef = useRef(null)

    // Saving / Modal state
    const [saving, setSaving] = useState(false)
    const [savedInvoice, setSavedInvoice] = useState(null)
    const [showSuccessModal, setShowSuccessModal] = useState(false)

    // Item Movement & History Modal State (F1)
    const [historyModalItem, setHistoryModalItem] = useState(null)
    const [showHistoryModal, setShowHistoryModal] = useState(false)

    const openItemHistory = useCallback((product) => {
        setHistoryModalItem(product)
        setShowHistoryModal(true)
    }, [])

    // ── Initial Load ───────────────────────────────────────────────────────────
    useEffect(() => {
        const loadAll = async () => {
            try {
                setLoadingData(true)
                const [supRes, itemRes] = await Promise.all([
                    api.get('/procurement/suppliers'),
                    api.get('/inventory/items?limit=10000')
                ])
                setSuppliers(supRes.data || [])
                const itemsList = itemRes.data?.items || itemRes.data || []
                setProducts(itemsList)

                // If editing an existing purchase invoice
                if (editId) {
                    const { data: po } = await api.get(`/procurement/orders/${editId}`)
                    if (po) {
                        setSupplierId(po.supplier?._id || po.supplier || '')
                        setWarehouseId(po.warehouse?._id || po.warehouse || '')
                        setInvoiceNumber(po.number || '')
                        if (po.receivedAt) {
                            setInvoiceDate(new Date(po.receivedAt).toISOString().split('T')[0])
                        } else if (po.createdAt) {
                            setInvoiceDate(new Date(po.createdAt).toISOString().split('T')[0])
                        }
                        setNote(po.note || '')
                        setDiscount(Number(po.discount || 0))
                        setPaymentMethod(po.paymentMethod || 'credit')
                        setInvoiceCurrency(po.currency || 'LYD')
                        if (po.exchangeRate) {
                            setInvoiceExchangeRate(po.exchangeRate)
                            setRateInput(String(po.exchangeRate))
                        }
                        if (po.items && po.items.length) {
                            const rate = po.exchangeRate > 0 ? po.exchangeRate : 7.30
                            const loadedCart = po.items.map(it => {
                                const p = it.item || {}
                                const costVal = Number(it.cost || 0)
                                const costUSDVal = Number(it.costUSD || (rate > 0 ? costVal / rate : 0))
                                return {
                                    item: p._id || it.item,
                                    name: p.name || 'صنف',
                                    sku: p.sku || '',
                                    barcode: p.barcode || '',
                                    qty: Number(it.qty || 1),
                                    cost: costVal,
                                    costUSD: Number(costUSDVal.toFixed(2)),
                                    inputCurrency: it.currency || po.currency || 'LYD',
                                    total: Number((it.qty || 1) * costVal),
                                    totalUSD: Number(((it.qty || 1) * costUSDVal).toFixed(2))
                                }
                            })
                            setCart(loadedCart)
                        }
                    }
                }
            } catch (err) {
                console.error(err)
                push('error', 'فشل تحميل بيانات الموردين أو الأصناف أو الفاتورة')
            } finally {
                setLoadingData(false)
            }
        }
        loadAll()
    }, [editId])

    // Sync active warehouse if changed
    useEffect(() => {
        if (!warehouseId && selectedWarehouseId) {
            setWarehouseId(selectedWarehouseId)
        } else if (!warehouseId && warehouses.length > 0) {
            setWarehouseId(warehouses[0]._id)
        }
    }, [selectedWarehouseId, warehouses, warehouseId])

    // ── Selected Supplier Data ────────────────────────────────────────────────
    const selectedSupplier = useMemo(() => {
        return suppliers.find(s => s._id === supplierId)
    }, [suppliers, supplierId])

    // ── Autocomplete / Search Logic ───────────────────────────────────────────
    useEffect(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) {
            setSuggestions([])
            setShowSuggestions(false)
            return
        }

        const matches = products.filter(p => {
            const sku = (p.sku || '').toLowerCase()
            const barcode = (p.barcode || '').toLowerCase()
            const name = (p.name || '').toLowerCase()
            return sku.includes(q) || barcode.includes(q) || name.includes(q)
        }).slice(0, 8)

        setSuggestions(matches)
        setSelectedIndex(0)
        setShowSuggestions(matches.length > 0)
    }, [searchQuery, products])

    // Add item to cart
    const handleAddItem = useCallback((product, customQty = 1) => {
        const rate = invoiceExchangeRate > 0 ? invoiceExchangeRate : 7.30
        setCart(prev => {
            const existingIdx = prev.findIndex(item => item.item === product._id)
            if (existingIdx > -1) {
                const updated = [...prev]
                const newQty = updated[existingIdx].qty + customQty
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    qty: newQty,
                    total: newQty * updated[existingIdx].cost,
                    totalUSD: newQty * (updated[existingIdx].costUSD || 0)
                }
                playBeep(false)
                return updated
            }

            const initialCost = Number(product.cost || 0)
            const initialCostUSD = Number(
                product.costUSD || (initialCost > 0 && rate > 0 ? Number((initialCost / rate).toFixed(2)) : 0)
            )
            const newItem = {
                item: product._id,
                name: product.name,
                sku: product.sku || '',
                barcode: product.barcode || '',
                qty: customQty,
                cost: initialCost,
                costUSD: initialCostUSD,
                inputCurrency: product.pricingCurrency === 'USD' ? 'USD' : 'LYD',
                total: customQty * initialCost,
                totalUSD: customQty * initialCostUSD
            }
            playBeep(false)
            return [newItem, ...prev]
        })

        setSearchQuery('')
        setShowSuggestions(false)
        if (searchInputRef.current) searchInputRef.current.focus()
    }, [invoiceExchangeRate])

    // Barcode Direct Entry on Enter
    const handleSearchKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (suggestions.length > 0 && selectedIndex < suggestions.length) {
                handleAddItem(suggestions[selectedIndex])
            } else {
                // Check exact barcode match
                const exact = products.find(p => p.barcode === searchQuery.trim() || p.sku === searchQuery.trim())
                if (exact) {
                    handleAddItem(exact)
                } else {
                    playBeep(true)
                    push('error', 'لم يتم العثور على الصنف')
                }
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

    // Update line item in cart
    const handleUpdateQty = (index, delta) => {
        setCart(prev => {
            const updated = [...prev]
            const newQty = Math.max(1, (updated[index].qty || 1) + delta)
            updated[index].qty = newQty
            updated[index].total = newQty * updated[index].cost
            updated[index].totalUSD = newQty * (updated[index].costUSD || 0)
            return updated
        })
    }

    const handleSetQty = (index, val) => {
        const qty = Math.max(1, parseInt(val) || 1)
        setCart(prev => {
            const updated = [...prev]
            updated[index].qty = qty
            updated[index].total = qty * updated[index].cost
            updated[index].totalUSD = qty * (updated[index].costUSD || 0)
            return updated
        })
    }

    // Set Cost in LYD (د.ل) -> auto-sync USD
    const handleSetCostLYD = (index, val) => {
        const costLYD = Math.max(0, parseFloat(val) || 0)
        const rate = invoiceExchangeRate > 0 ? invoiceExchangeRate : 7.30
        const costUSD = rate > 0 ? parseFloat((costLYD / rate).toFixed(2)) : 0
        setCart(prev => {
            const updated = [...prev]
            updated[index].cost = costLYD
            updated[index].costUSD = costUSD
            updated[index].inputCurrency = 'LYD'
            updated[index].total = updated[index].qty * costLYD
            updated[index].totalUSD = updated[index].qty * costUSD
            return updated
        })
    }

    // Set Cost in USD ($) -> auto-sync LYD
    const handleSetCostUSD = (index, val) => {
        const costUSD = Math.max(0, parseFloat(val) || 0)
        const rate = invoiceExchangeRate > 0 ? invoiceExchangeRate : 7.30
        const costLYD = parseFloat((costUSD * rate).toFixed(2))
        setCart(prev => {
            const updated = [...prev]
            updated[index].costUSD = costUSD
            updated[index].cost = costLYD
            updated[index].inputCurrency = 'USD'
            updated[index].total = updated[index].qty * costLYD
            updated[index].totalUSD = updated[index].qty * costUSD
            return updated
        })
    }

    // Update Exchange Rate for invoice and optionally adjust items
    const handleApplyExchangeRate = (newRate) => {
        const rate = Math.max(0.01, parseFloat(newRate) || 7.30)
        setInvoiceExchangeRate(rate)
        setRateInput(String(rate))
        setIsEditingRate(false)

        setCart(prev => prev.map(item => {
            if (item.inputCurrency === 'USD') {
                const costLYD = parseFloat((item.costUSD * rate).toFixed(2))
                return {
                    ...item,
                    cost: costLYD,
                    total: item.qty * costLYD,
                    totalUSD: item.qty * item.costUSD
                }
            } else {
                const costUSD = rate > 0 ? parseFloat((item.cost / rate).toFixed(2)) : 0
                return {
                    ...item,
                    costUSD,
                    total: item.qty * item.cost,
                    totalUSD: item.qty * costUSD
                }
            }
        }))
        push('info', `تم تطبيق سعر الصرف 1$ = ${rate} د.ل وتحديث العمليات المتزامنة`)
    }

    const handleRemoveItem = (index) => {
        setCart(prev => prev.filter((_, i) => i !== index))
    }

    const handleClearCart = () => {
        if (cart.length > 0 && !window.confirm('هل تريد مسح الأصناف والبدء من جديد؟')) return
        setCart([])
        setDiscount(0)
        setNote('')
        setInvoiceNumber('')
        if (searchInputRef.current) searchInputRef.current.focus()
    }

    // ── Calculations ───────────────────────────────────────────────────────────
    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.qty * item.cost), 0)
    }, [cart])

    const subtotalUSD = useMemo(() => {
        const rate = invoiceExchangeRate > 0 ? invoiceExchangeRate : 7.30
        return cart.reduce((sum, item) => sum + (item.totalUSD || (rate > 0 ? item.total / rate : 0)), 0)
    }, [cart, invoiceExchangeRate])

    const totalPayable = useMemo(() => {
        return Math.max(0, subtotal - Number(discount || 0))
    }, [subtotal, discount])

    const totalPayableUSD = useMemo(() => {
        const rate = invoiceExchangeRate > 0 ? invoiceExchangeRate : 7.30
        return rate > 0 ? parseFloat((totalPayable / rate).toFixed(2)) : 0
    }, [totalPayable, invoiceExchangeRate])

    const projectedSupplierBalance = useMemo(() => {
        const cur = Number(selectedSupplier?.balance || 0)
        return paymentMethod === 'credit' ? cur + totalPayable : cur
    }, [selectedSupplier, paymentMethod, totalPayable])

    // ── Keyboard Shortcuts (F9 Save, F4 Payment Method, F2 Search, F1 Clear) ──
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F9') {
                e.preventDefault()
                handleSubmitInvoice()
            } else if (e.key === 'F4') {
                e.preventDefault()
                setPaymentMethod(prev => prev === 'credit' ? 'cash' : 'credit')
            } else if (e.key === 'F2') {
                e.preventDefault()
                if (searchInputRef.current) searchInputRef.current.focus()
            } else if (e.key === 'F1') {
                e.preventDefault()
                let target = null
                if (cart.length > 0) {
                    target = cart[cart.length - 1]
                } else if (products.length > 0) {
                    target = products[0]
                }
                openItemHistory(target)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [cart, products, supplierId, warehouseId, paymentMethod, treasuryId, totalPayable, openItemHistory])

    // ── Submit / Save Direct Purchase Invoice ──────────────────────────────────
    const handleSubmitInvoice = async () => {
        if (!supplierId) {
            playBeep(true)
            push('error', 'يجب اختيار المورد أولاً')
            return
        }
        if (!warehouseId) {
            playBeep(true)
            push('error', 'يجب تحديد المستودع المستهدف')
            return
        }
        if (cart.length === 0) {
            playBeep(true)
            push('error', 'يجب إضافة صنف واحد على الأقل في الفاتورة')
            return
        }
        if (paymentMethod === 'cash' && !treasuryId) {
            playBeep(true)
            push('error', 'يرجى تحديد الخزينة للدفع النقدي الفوري')
            return
        }

        setSaving(true)
        try {
            const payload = {
                supplier: supplierId,
                warehouse: warehouseId,
                invoiceNumber: invoiceNumber.trim() || undefined,
                date: invoiceDate,
                note,
                paymentMethod,
                discount: Number(discount || 0),
                treasuryId: paymentMethod === 'cash' ? treasuryId : undefined,
                exchangeRate: invoiceExchangeRate,
                currency: invoiceCurrency,
                items: cart.map(item => ({
                    item: item.item,
                    qty: item.qty,
                    cost: item.cost,
                    costUSD: item.costUSD,
                    currency: item.inputCurrency || 'LYD'
                }))
            }

            let resData
            if (isEditMode) {
                const { data } = await api.put(`/procurement/orders/${editId}`, payload)
                resData = data
                push('success', '✓ تم حفظ وتحديث تعديلات فاتورة المشتريات والمخزون بنجاح!')
            } else {
                const { data } = await api.post('/procurement/invoices/direct', payload)
                resData = data
                push('success', '✓ تم حفظ وترحيل فاتورة المشتريات ودخول المخزون بنجاح!')
            }
            playBeep(false)

            setSavedInvoice(resData.invoice)
            setShowSuccessModal(true)

            if (!isEditMode) {
                // Reset Form for next invoice
                setCart([])
                setDiscount(0)
                setNote('')
                setInvoiceNumber('')
            }
        } catch (err) {
            console.error(err)
            playBeep(true)
            push('error', err?.response?.data?.message || 'فشل حفظ وترحيل الفاتورة')
        } finally {
            setSaving(false)
        }
    }

    const fmt = (n) => Number(n || 0).toLocaleString('ar-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    // ── Print Voucher Function ────────────────────────────────────────────────
    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="flex flex-col gap-4 p-4 min-h-[calc(100vh-4rem)] max-w-[1600px] mx-auto animate-in fade-in" style={{ direction: 'rtl' }}>

            {/* ── Top Master Header ────────────────────────────────────────────── */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4 border border-blue-900/40">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <ShoppingCart size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-wide flex items-center gap-2">
                            {isEditMode ? `تعديل فاتورة مشتريات ${invoiceNumber ? '#' + invoiceNumber : ''}` : 'فاتورة مشتريات سريعة'}
                            <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${
                                isEditMode
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                    : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                            }`}>
                                {isEditMode ? 'وضع التعديل / EDIT MODE' : 'POS PURCHASE'}
                            </span>
                        </h1>
                        <p className="text-xs text-slate-400">إدخال بضاعة، تحديث تكلفة المخزون، وتسوية حسابات الموردين والخزائن فورياً</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Exchange Rate Badge with Quick Edit */}
                    <div className="flex items-center gap-2 bg-blue-900/60 border border-blue-400/40 rounded-xl px-3 py-1.5 text-xs shadow-inner">
                        <DollarSign size={15} className="text-emerald-400" />
                        <span className="text-slate-300 font-medium">سعر الصرف المعتمد:</span>
                        <span className="font-mono font-bold text-emerald-400">1$ =</span>
                        {isEditingRate ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.1"
                                    value={rateInput}
                                    onChange={e => setRateInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleApplyExchangeRate(rateInput)
                                        if (e.key === 'Escape') setIsEditingRate(false)
                                    }}
                                    autoFocus
                                    className="w-16 h-7 px-1 text-center font-mono font-black bg-slate-950 text-white rounded border border-emerald-400 outline-none text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleApplyExchangeRate(rateInput)}
                                    className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                                    title="تطبيق"
                                >
                                    <Check size={12} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsEditingRate(false)}
                                    className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                                    title="إلغاء"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setRateInput(String(invoiceExchangeRate))
                                    setIsEditingRate(true)
                                }}
                                className="font-black font-mono text-amber-300 hover:text-amber-200 underline decoration-dotted cursor-pointer px-1.5 py-0.5 rounded hover:bg-white/10 flex items-center gap-1 transition-all"
                                title="انقر لتعديل سعر الصرف لهذه الفاتورة"
                            >
                                <span>{invoiceExchangeRate} د.ل</span>
                                <span className="text-[10px] text-slate-400">✏️</span>
                            </button>
                        )}
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/purchase-orders')}
                        className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
                    >
                        <FileText size={15} />
                        سجل أوامر الشراء
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleClearCart}
                        disabled={cart.length === 0}
                        className="gap-1.5"
                    >
                        <RotateCcw size={15} />
                        تصفير [F1]
                    </Button>
                </div>
            </div>

            {/* ── Invoice Metadata Strip (Supplier, Warehouse, Date, Ref) ──────── */}
            <Card className="border-slate-200 shadow-sm bg-slate-50/70">
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    {/* Supplier Select */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Building2 size={14} className="text-blue-600" />
                            المورد <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full h-11 px-3 text-sm font-bold bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                            value={supplierId}
                            onChange={e => setSupplierId(e.target.value)}
                        >
                            <option value="">-- اختر المورد --</option>
                            {suppliers.map(s => (
                                <option key={s._id} value={s._id}>
                                    {s.name} ({s.code}) - {s.balance > 0 ? `له: ${fmt(s.balance)} د.ل` : s.balance < 0 ? `له دفعة: ${fmt(Math.abs(s.balance))} د.ل` : 'خالص'}
                                </option>
                            ))}
                        </select>
                        {selectedSupplier && (
                            <div className="text-[11px] font-medium flex justify-between px-1">
                                <span className="text-slate-500">الرصيد الحالي:</span>
                                <span className={selectedSupplier.balance > 0 ? 'text-red-600 font-bold' : selectedSupplier.balance < 0 ? 'text-blue-600 font-bold' : 'text-emerald-600 font-bold'}>
                                    {fmt(selectedSupplier.balance)} د.ل {selectedSupplier.balance > 0 ? '(مستحق له)' : selectedSupplier.balance < 0 ? '(دفعة مقدمة)' : ''}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Warehouse Select */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Store size={14} className="text-indigo-600" />
                            المستودع المستهدف <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full h-11 px-3 text-sm font-bold bg-white border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                            value={warehouseId}
                            onChange={e => setWarehouseId(e.target.value)}
                        >
                            <option value="">-- اختر المستودع --</option>
                            {warehouses.map(w => (
                                <option key={w._id} value={w._id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Manual Invoice Number (Supplier Invoice #) */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Hash size={14} className="text-slate-500" />
                            رقم فاتورة المورد (اختياري)
                        </label>
                        <Input
                            placeholder="مثال: INV-99824"
                            value={invoiceNumber}
                            onChange={e => setInvoiceNumber(e.target.value)}
                            className="h-11 bg-white font-mono"
                        />
                    </div>

                    {/* Date */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Calendar size={14} className="text-slate-500" />
                            تاريخ الفاتورة
                        </label>
                        <Input
                            type="date"
                            value={invoiceDate}
                            onChange={e => setInvoiceDate(e.target.value)}
                            className="h-11 bg-white"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ── Main Split Workstation ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">

                {/* Left (8 cols): Barcode Search + Items Table */}
                <div className="lg:col-span-8 flex flex-col gap-4">

                    {/* Fast Barcode & Search Bar */}
                    <div className="relative">
                        <div className="relative flex items-center">
                            <Barcode size={22} className="absolute right-4 text-blue-600" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="🔍 امسح الباركود أو اكتب اسم الصنف / الكود للبحث... [F2]"
                                className="w-full h-14 pr-12 pl-4 text-base font-bold bg-white border-2 border-blue-400/80 rounded-2xl shadow-md focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all placeholder:text-slate-400"
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute left-4 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Dropdown Suggestions */}
                        <AnimatePresence>
                            {showSuggestions && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="absolute top-full right-0 left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto"
                                >
                                    {suggestions.map((product, idx) => (
                                        <div
                                            key={product._id}
                                            onClick={() => handleAddItem(product)}
                                            className={`p-3.5 flex items-center justify-between border-b border-slate-100 cursor-pointer transition-colors ${idx === selectedIndex ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                                    <Package size={18} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{product.name}</div>
                                                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                                                        <span>الباركود: {product.barcode || '-'}</span>
                                                        <span>•</span>
                                                        <span>الكود: {product.sku || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left font-mono">
                                                <div className="text-xs text-slate-400">التكلفة السابقة</div>
                                                <div className="text-sm font-black text-blue-600">{fmt(product.cost)} د.ل</div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="p-2 bg-slate-50 text-center text-[11px] text-slate-400">
                                        استخدم الأسهم للتنقل • Enter للإضافة • Esc للإغلاق
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Cart Items Table */}
                    <Card className="flex-1 overflow-hidden border-slate-200 shadow-sm flex flex-col">
                        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                            <span className="font-bold text-sm flex items-center gap-2">
                                <Package size={16} className="text-blue-400" />
                                أصناف الفاتورة ({cart.length})
                            </span>
                            <span className="text-xs text-slate-400">
                                يمكنك تعديل الكمية وسعر الشراء مباشرة في السطر
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[500px]">
                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
                                    <ShoppingCart size={48} className="text-slate-200 stroke-1" />
                                    <p className="font-bold text-base">لا توجد أصناف في الفاتورة بعد</p>
                                    <p className="text-xs text-slate-400">امسح الباركود أو ابحث عن الأصناف من الشريط العلوي</p>
                                </div>
                            ) : (
                                <table className="w-full text-right border-collapse">
                                    <thead className="bg-slate-100 text-slate-700 text-xs font-bold border-b sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 w-8 text-center">#</th>
                                            <th className="p-3 min-w-[200px]">اسم الصنف والرمز</th>
                                            <th className="p-3 text-center w-32">الكمية</th>
                                            <th className="p-3 text-center w-32">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-emerald-700 font-black flex items-center gap-1">
                                                        <DollarSign size={13} /> التكلفة ($)
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-normal">بالدولار</span>
                                                </div>
                                            </th>
                                            <th className="p-3 text-center w-32">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-blue-700 font-black">التكلفة (د.ل)</span>
                                                    <span className="text-[10px] text-slate-400 font-normal">بالليبي</span>
                                                </div>
                                            </th>
                                            <th className="p-3 text-center w-32">الإجمالي</th>
                                            <th className="p-3 text-center w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {cart.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                                <td className="p-3 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-slate-800">{item.name}</div>
                                                        <button
                                                            type="button"
                                                            onClick={() => openItemHistory(item)}
                                                            className="px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                                                            title="سجل الصنف وتاريخ المشتريات والمبيعات [F1]"
                                                        >
                                                            <FileText size={10} />
                                                            <span>سجل [F1]</span>
                                                        </button>
                                                    </div>
                                                    <div className="text-xs text-slate-400 font-mono">{item.barcode || item.sku || '-'}</div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1 bg-slate-100 p-1 rounded-xl border">
                                                        <button
                                                            onClick={() => handleUpdateQty(idx, -1)}
                                                            className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center shadow-xs"
                                                        >
                                                            <Minus size={13} />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.qty}
                                                            onChange={e => handleSetQty(idx, e.target.value)}
                                                            className="w-14 text-center font-black text-sm bg-transparent outline-none"
                                                        />
                                                        <button
                                                            onClick={() => handleUpdateQty(idx, 1)}
                                                            className="w-7 h-7 bg-white hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center shadow-xs"
                                                        >
                                                            <Plus size={13} />
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Cost in USD ($) */}
                                                <td className="p-3 text-center">
                                                    <div className="relative flex items-center justify-center">
                                                        <span className="absolute left-2 text-xs text-emerald-600 font-bold">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.costUSD || ''}
                                                            onChange={e => handleSetCostUSD(idx, e.target.value)}
                                                            placeholder="0.00"
                                                            className="w-24 h-9 pl-5 pr-2 text-center font-bold font-mono bg-emerald-50/50 border border-emerald-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm text-emerald-950"
                                                            title="أدخل التكلفة بالدولار وسيتم التحويل لليبي فوراً"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Cost in LYD (د.ل) */}
                                                <td className="p-3 text-center">
                                                    <div className="relative flex items-center justify-center">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.cost}
                                                            onChange={e => handleSetCostLYD(idx, e.target.value)}
                                                            placeholder="0.00"
                                                            className="w-24 h-9 px-2 text-center font-bold font-mono bg-blue-50/40 border border-blue-300 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm text-blue-950"
                                                            title="أدخل التكلفة بالدينار الليبي وسيتم التحويل للدولار فوراً"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Total */}
                                                <td className="p-3 text-center">
                                                    <div className="font-black font-mono text-blue-700 text-base leading-tight">
                                                        {fmt(item.total)} <span className="text-[11px] font-normal">د.ل</span>
                                                    </div>
                                                    <div className="text-[11px] font-mono font-bold text-emerald-600">
                                                        ${Number(item.totalUSD || (invoiceExchangeRate > 0 ? item.total / invoiceExchangeRate : 0)).toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleRemoveItem(idx)}
                                                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="حذف الصنف"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right (4 cols): Summary, Payment Options, Post Button */}
                <div className="lg:col-span-4 flex flex-col gap-4">

                    {/* Summary & Totals Card */}
                    <Card className="border-2 border-slate-300 shadow-lg bg-white rounded-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-4">
                            <h3 className="font-bold text-base flex items-center justify-between">
                                <span>ملخص الفاتورة والحساب</span>
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">{cart.length} أصناف</span>
                            </h3>
                        </div>

                        <CardContent className="p-5 space-y-4">
                            {/* Subtotal */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">إجمالي البضاعة:</span>
                                <span className="font-bold font-mono text-slate-800">{fmt(subtotal)} د.ل</span>
                            </div>

                            {/* Discount */}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">خصم المورد:</span>
                                <div className="flex items-center gap-1.5 w-32">
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={discount}
                                        onChange={e => setDiscount(e.target.value)}
                                        className="h-8 text-center font-mono font-bold"
                                        placeholder="0.00"
                                    />
                                    <span className="text-xs text-slate-400">د.ل</span>
                                </div>
                            </div>

                            <div className="border-t border-dashed border-slate-200 pt-3">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-black text-slate-800 text-base">الصافي المستحق:</span>
                                    <span className="font-black font-mono text-3xl text-blue-700">{fmt(totalPayable)} <span className="text-sm font-normal">د.ل</span></span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-emerald-700 font-bold mt-2 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200">
                                    <span className="flex items-center gap-1">
                                        <DollarSign size={13} />
                                        المعادل بالدولار (USD):
                                    </span>
                                    <span className="font-mono font-black text-base text-emerald-800">${totalPayableUSD}</span>
                                </div>
                            </div>

                            {/* Payment Method Selector */}
                            <div className="space-y-2 pt-2 border-t border-slate-200">
                                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                    <span>طريقة السداد:</span>
                                    <span className="text-[10px] text-slate-400">[F4 للتبديل]</span>
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('credit')}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 text-xs font-bold transition-all ${paymentMethod === 'credit' ? 'border-orange-500 bg-orange-50 text-orange-800 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                                    >
                                        <CreditCard size={18} className={paymentMethod === 'credit' ? 'text-orange-600' : ''} />
                                        <span>📝 آجل (على الحساب)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 text-xs font-bold transition-all ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
                                    >
                                        <Banknote size={18} className={paymentMethod === 'cash' ? 'text-emerald-600' : ''} />
                                        <span>💵 نقدي فوري</span>
                                    </button>
                                </div>
                            </div>

                            {/* Treasury Selector when Cash */}
                            {paymentMethod === 'cash' && (
                                <div className="space-y-1.5 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 animate-in fade-in">
                                    <label className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                        <Banknote size={13} />
                                        الخزينة (مصدر الدفع النقدي) <span className="text-red-500">*</span>
                                    </label>
                                    <TreasurySelector
                                        value={treasuryId}
                                        onChange={setTreasuryId}
                                        required
                                    />
                                </div>
                            )}

                            {/* Credit Projected Balance Indicator */}
                            {paymentMethod === 'credit' && selectedSupplier && (
                                <div className="bg-orange-50/70 p-3 rounded-xl border border-orange-200 text-xs space-y-1 animate-in fade-in">
                                    <div className="flex justify-between text-orange-800 font-medium">
                                        <span>رصيد المورد بعد الترحيل:</span>
                                        <span className="font-bold font-mono">{fmt(projectedSupplierBalance)} د.ل</span>
                                    </div>
                                    <p className="text-[11px] text-orange-600">
                                        سيتم قيد المبلغ في حساب ذمم الموردين كمديونية آجلة.
                                    </p>
                                </div>
                            )}

                            {/* Notes */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">ملاحظات الفاتورة:</label>
                                <textarea
                                    rows={2}
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="أي ملاحظات حول البضاعة أو أمر التوريد..."
                                    className="w-full text-xs p-2 bg-slate-50 border rounded-xl outline-none resize-none focus:bg-white focus:ring-1 focus:ring-blue-400"
                                />
                            </div>

                            {/* BIG SUBMIT / POST BUTTON */}
                            <Button
                                onClick={handleSubmitInvoice}
                                disabled={saving || cart.length === 0}
                                className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-lg rounded-xl shadow-xl shadow-blue-500/20 gap-2 transition-all active:scale-[0.99]"
                            >
                                {saving ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        <span>{isEditMode ? 'جاري حفظ وتحديث التعديلات...' : 'جاري الترحيل ودخول المخزن...'}</span>
                                    </div>
                                ) : (
                                    <>
                                        <Save size={20} />
                                        <span>{isEditMode ? 'حفظ التعديلات على الفاتورة [F9]' : 'حفظ وترحيل الفاتورة [F9]'}</span>
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── Success & Receipt Modal ─────────────────────────────────────── */}
            {showSuccessModal && savedInvoice && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 text-center relative">
                            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                                <CheckCircle2 size={32} className="text-white" />
                            </div>
                            <h3 className="text-xl font-bold">تم ترحيل فاتورة الشراء بنجاح!</h3>
                            <p className="text-emerald-100 text-xs mt-1 font-mono">#{savedInvoice.number || savedInvoice._id.slice(-6)}</p>
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="absolute top-4 left-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <CardContent className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">المورد:</span>
                                    <span className="font-bold text-slate-800">{savedInvoice.supplier?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">المستودع:</span>
                                    <span className="font-bold text-slate-800">{savedInvoice.warehouse?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">طريقة الدفع:</span>
                                    <span className="font-bold text-slate-800">{savedInvoice.paymentMethod === 'cash' ? '💵 نقدي فوري' : '📝 آجل على الحساب'}</span>
                                </div>
                                <div className="flex justify-between border-t pt-2">
                                    <span className="font-bold text-slate-800">إجمالي الفاتورة:</span>
                                    <span className="font-black font-mono text-emerald-700 text-lg">{fmt(savedInvoice.totalAmount)} د.ل</span>
                                </div>
                            </div>

                            <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded-xl border border-blue-200 space-y-1">
                                <p className="font-bold text-blue-800">الأثر على النظام:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                                    <li>تم زيادة أرصدة الأصناف بالمستودع المحدد وتحديث متوسط التكلفة.</li>
                                    <li>تم إنشاء قيود دفتر اليومية العامة (Journal Entry) تلقائياً.</li>
                                    <li>تم تحديث رصيد {savedInvoice.paymentMethod === 'cash' ? 'الخزينة النقدية' : 'المورد'}.</li>
                                </ul>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={handlePrint}
                                    className="flex-1 gap-1.5"
                                >
                                    <Printer size={16} />
                                    طباعة الوصل
                                </Button>
                                <Button
                                    onClick={() => {
                                        setShowSuccessModal(false)
                                        if (isEditMode) {
                                            navigate('/purchase-orders')
                                        } else if (searchInputRef.current) {
                                            searchInputRef.current.focus()
                                        }
                                    }}
                                    className={`flex-1 font-bold text-white ${
                                        isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                                >
                                    {isEditMode ? 'العودة لسجل المشتريات' : 'فاتورة جديدة'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Item Movement & History Modal [F1] */}
            <ItemHistoryModal
                isOpen={showHistoryModal}
                onClose={() => {
                    setShowHistoryModal(false)
                    setHistoryModalItem(null)
                }}
                itemId={historyModalItem?.item || historyModalItem?._id}
                initialItem={historyModalItem}
            />
        </div>
    )
}
