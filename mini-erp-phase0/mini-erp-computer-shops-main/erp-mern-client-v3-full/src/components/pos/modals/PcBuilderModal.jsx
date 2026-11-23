import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Cpu, CircuitBoard, Monitor, Layers, HardDrive, Zap, Box, Fan,
    Plus, Minus, Trash2, X, Search, Check, Sparkles, AlertCircle,
    DollarSign, TrendingUp, CheckCircle2, RefreshCw,
    Wrench, ArrowRight, CornerDownLeft, Barcode, ShoppingCart, Tag
} from 'lucide-react'
import api from '../../../services/api'
import { formatCurrency } from '../../../lib/utils'

// Hardware Slot Categories configuration
const HARDWARE_SLOTS = [
    {
        id: 'cpu',
        name: 'المعالج (CPU)',
        icon: Cpu,
        color: 'from-blue-600 to-indigo-600',
        lightBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        keywords: ['معالج', 'cpu', 'processor', 'core i', 'ryzen', 'intel', 'amd', 'i5', 'i7', 'i9', 'r5', 'r7', 'r9'],
        description: 'وحدة المعالجة المركزية للحاسوب'
    },
    {
        id: 'motherboard',
        name: 'اللوحة الأم (Motherboard)',
        icon: CircuitBoard,
        color: 'from-purple-600 to-indigo-600',
        lightBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
        keywords: ['لوحة', 'motherboard', 'mb', 'b650', 'b760', 'z790', 'am4', 'am5', 'lga', 'b550', 'h610', 'asus', 'msi', 'gigabyte'],
        description: 'اللوحة الحاضنة لجميع المكونات'
    },
    {
        id: 'gpu',
        name: 'كرت الشاشة (GPU)',
        icon: Monitor,
        color: 'from-emerald-600 to-teal-600',
        lightBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
        keywords: ['كرت', 'gpu', 'graphics', 'vga', 'rtx', 'gtx', 'radeon', 'rx', 'geforce', 'nvidia'],
        description: 'بطاقة معالجة الرسوميات والألعاب'
    },
    {
        id: 'ram',
        name: 'الذاكرة العشوائية (RAM)',
        icon: Layers,
        color: 'from-amber-500 to-orange-600',
        lightBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
        keywords: ['رام', 'ram', 'memory', 'ddr4', 'ddr5', 'ذاكرة', 'fury', 'corsair', 'g.skill'],
        description: 'ذاكرة الوصول العشوائي'
    },
    {
        id: 'storage',
        name: 'وسائط التخزين (Storage)',
        icon: HardDrive,
        color: 'from-cyan-600 to-blue-600',
        lightBg: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
        keywords: ['تخزين', 'storage', 'ssd', 'm.2', 'nvme', 'hdd', 'hard', 'قرص', 'samsung', 'crucial', 'kingston'],
        description: 'أقراص SSD فائقة السرعة أو HDD'
    },
    {
        id: 'psu',
        name: 'مزود الطاقة (Power Supply)',
        icon: Zap,
        color: 'from-yellow-500 to-amber-600',
        lightBg: 'bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        keywords: ['مزود', 'طاقة', 'power', 'psu', 'باور', 'watt', 'واط', 'bronze', 'gold'],
        description: 'وحدة الإمداد بالطاقة الكهربائية'
    },
    {
        id: 'case',
        name: 'الصندوق (Case)',
        icon: Box,
        color: 'from-slate-600 to-slate-800',
        lightBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        keywords: ['كيس', 'صندوق', 'case', 'chassis', 'tower', 'nzxt', 'lian li', 'cooler master'],
        description: 'هيكل وحاوية الكمبيوتر'
    },
    {
        id: 'cooler',
        name: 'نظام التبريد (Cooling)',
        icon: Fan,
        color: 'from-sky-500 to-indigo-600',
        lightBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800',
        keywords: ['تبريد', 'cooling', 'cooler', 'مروحة', 'fan', 'liquid', 'مائي', 'هوائي', 'aio', 'deepcool'],
        description: 'مبرد المعالج ومراوح التبريد'
    },
    {
        id: 'accessories',
        name: 'ملحقات إضافية (Accessories)',
        icon: Plus,
        color: 'from-pink-600 to-rose-600',
        lightBg: 'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800',
        keywords: ['شاشة', 'monitor', 'كيبورد', 'keyboard', 'ماوس', 'mouse', 'سماعة', 'headset', 'ويندوز', 'windows'],
        description: 'شاشات، إكسسوارات، أو ملحقات أخرى'
    }
]

// Helper to determine the best hardware slot for an existing component
const findSlotForComponent = (comp, prod) => {
    if (comp?.slotId) return comp.slotId
    const textToMatch = `${prod?.name || comp?.name || ''} ${prod?.category?.name || prod?.category || ''}`.toLowerCase()
    for (const slot of HARDWARE_SLOTS) {
        if (slot.keywords.some(kw => textToMatch.includes(kw.toLowerCase()))) {
            return slot.id
        }
    }
    return 'accessories'
}

export const PcBuilderModal = ({
    isOpen,
    onClose,
    products = [],
    selectedWarehouseId,
    currentWarehouse,
    onAddCustomBundle,
    onUpdateCustomBundle,
    editingBundle = null,
    userRole = 'user',
    currency = 'د.ل'
}) => {
    const isPrivileged = userRole === 'admin'

    // Selected components state: Array of { slotId, product, qty, serials: string[] }
    const [selectedComponents, setSelectedComponents] = useState([])
    
    // Active slot being inspected / picked
    const [activeSlotId, setActiveSlotId] = useState('cpu')
    
    // Search query for the product picker in active slot
    const [pickerSearch, setPickerSearch] = useState('')
    
    // Toggle whether to show only slot-matching products or all inventory items
    const [showAllInventory, setShowAllInventory] = useState(false)

    // Custom build name
    const [buildName, setBuildName] = useState('تجميعة كمبيوتر مخصصة')
    
    // Final custom bundle package price
    const [packagePrice, setPackagePrice] = useState('')
    
    // Submission status
    const [submitting, setSubmitting] = useState(false)
    const [errorAlert, setErrorAlert] = useState(null)

    // Helper: calculate available stock for a product in current warehouse
    const getStock = useCallback((p) => {
        if (!p) return 0
        if (selectedWarehouseId && p.stocks?.length) {
            const match = p.stocks.find(s => {
                const whId = s.warehouse?._id || s.warehouse
                return whId?.toString() === selectedWarehouseId?.toString()
            })
            if (match) return Number(match.qty || 0)
        }
        return Number(p.availableInWarehouse ?? p.stock ?? p.totalStock ?? 0)
    }, [selectedWarehouseId])

    // Current active slot definition
    const activeSlot = useMemo(() => {
        return HARDWARE_SLOTS.find(s => s.id === activeSlotId) || HARDWARE_SLOTS[0]
    }, [activeSlotId])

    // Safely extract category name string
    const getSafeCategoryStr = (cat) => {
        if (!cat) return ''
        if (typeof cat === 'object') return String(cat.name || cat.title || '')
        return String(cat)
    }

    // Filter products for the active slot
    const availableSlotProducts = useMemo(() => {
        if (!products || !products.length) return []

        const searchLower = pickerSearch.trim().toLowerCase()

        return products.filter(p => {
            // Exclude bundles and virtual packages from component choices
            if (p.isBundle || p.itemType === 'bundle' || p.sku === 'CUSTOM-BUNDLE') {
                return false
            }

            // Keyword match within slot if not "showAllInventory"
            let matchesSlot = true
            if (!showAllInventory && activeSlot && activeSlot.id !== 'accessories') {
                const pName = String(p.name || '').toLowerCase()
                const pCat = getSafeCategoryStr(p.category).toLowerCase()
                const pSku = String(p.sku || p.code || '').toLowerCase()
                
                const keywords = activeSlot.keywords || []
                matchesSlot = keywords.some(k => 
                    pName.includes(k) || pCat.includes(k) || pSku.includes(k)
                )
            }

            if (!matchesSlot) return false

            // Search query filter
            if (searchLower) {
                const name = String(p.name || '').toLowerCase()
                const sku = String(p.sku || p.code || '').toLowerCase()
                const barcode = String(p.barcode || '').toLowerCase()
                const category = getSafeCategoryStr(p.category).toLowerCase()
                return name.includes(searchLower) || sku.includes(searchLower) || barcode.includes(searchLower) || category.includes(searchLower)
            }

            return true
        })
    }, [products, activeSlot, pickerSearch, showAllInventory])

    // Financial calculations
    const totals = useMemo(() => {
        let sumRetail = 0
        let sumCost = 0
        let totalItemsCount = 0

        for (const item of selectedComponents) {
            const qty = Number(item.qty || 1)
            const price = Number(item.product.price || 0)
            const cost = Number(item.product.cost || 0)

            sumRetail += price * qty
            sumCost += cost * qty
            totalItemsCount += qty
        }

        const effectivePkgPrice = packagePrice !== '' ? Number(packagePrice) : sumRetail
        const customerSavings = Math.max(0, sumRetail - effectivePkgPrice)
        const savingsPercent = sumRetail > 0 ? ((customerSavings / sumRetail) * 100).toFixed(0) : 0
        const profit = effectivePkgPrice - sumCost
        const profitMargin = effectivePkgPrice > 0 ? ((profit / effectivePkgPrice) * 100).toFixed(1) : 0

        return {
            sumRetail,
            sumCost,
            totalItemsCount,
            effectivePkgPrice,
            customerSavings,
            savingsPercent,
            profit,
            profitMargin
        }
    }, [selectedComponents, packagePrice])

    // Auto update suggested packagePrice when selected components change and user hasn't explicitly set one
    useEffect(() => {
        if (packagePrice === '') {
            // Keep in sync with retail sum until user types
        }
    }, [totals.sumRetail, packagePrice])

    // Reset or initialize state on modal open
    useEffect(() => {
        if (isOpen) {
            if (editingBundle) {
                // Preload existing bundle for editing
                setBuildName(editingBundle.name || 'تجميعة كمبيوتر مخصصة')
                setPackagePrice(editingBundle.price != null ? editingBundle.price.toString() : '')
                
                const comps = (editingBundle.bundleComponents || []).map(comp => {
                    const compId = (comp.item?._id || comp.item || '').toString()
                    const matchedProd = products.find(p => (p._id || p.id)?.toString() === compId || (p.sku && p.sku === comp.sku) || p.name === comp.name)
                    const prod = matchedProd || {
                        _id: compId || `item-${Date.now()}-${Math.random()}`,
                        name: comp.name || comp.item?.name || 'مكون تجميعة',
                        sku: comp.sku || comp.item?.sku || '',
                        price: comp.price || 0,
                        retailPrice: comp.price || 0,
                        cost: comp.cost || 0,
                        availableInWarehouse: 999
                    }
                    const slot = comp.slotId || findSlotForComponent(comp, prod)
                    return {
                        slotId: slot,
                        product: prod,
                        qty: Number(comp.qty || 1),
                        serials: Array.isArray(comp.serials) ? comp.serials : []
                    }
                })
                setSelectedComponents(comps)
                setActiveSlotId(comps[0]?.slotId || 'cpu')
                setPickerSearch('')
                setShowAllInventory(false)
                setErrorAlert(null)
            } else {
                setSelectedComponents([])
                setActiveSlotId('cpu')
                setPickerSearch('')
                setShowAllInventory(false)
                setBuildName('تجميعة كمبيوتر مخصصة')
                setPackagePrice('')
                setErrorAlert(null)
            }
        }
    }, [isOpen, editingBundle, products])

    // Auto-suggest build name based on CPU + GPU
    const generateSmartName = () => {
        const cpuItem = selectedComponents.find(c => c.slotId === 'cpu')
        const gpuItem = selectedComponents.find(c => c.slotId === 'gpu')

        let generated = 'تجميعة كمبيوتر'
        if (cpuItem && gpuItem) {
            // Shorten names
            const cpuShort = cpuItem.product.name.split(' ').slice(0, 3).join(' ')
            const gpuShort = gpuItem.product.name.split(' ').slice(0, 3).join(' ')
            generated = `تجميعة احترافية (${cpuShort} + ${gpuShort})`
        } else if (cpuItem) {
            const cpuShort = cpuItem.product.name.split(' ').slice(0, 3).join(' ')
            generated = `تجميعة (${cpuShort})`
        } else if (gpuItem) {
            const gpuShort = gpuItem.product.name.split(' ').slice(0, 3).join(' ')
            generated = `تجميعة ألعاب (${gpuShort})`
        }
        setBuildName(generated)
    }

    // Add component to active slot
    const handleAddComponent = (product) => {
        const stock = getStock(product)
        if (stock <= 0) {
            setErrorAlert(`تنبيه: الصنف (${product.name}) غير متوفر حالياً في المخزن المحدد، تأكد من وجود رصيد قبل الحفظ`)
            setTimeout(() => setErrorAlert(null), 4000)
        }

        setSelectedComponents(prev => {
            // Check if already in this slot
            const existingIndex = prev.findIndex(c => c.slotId === activeSlotId && (c.product._id || c.product.id) === (product._id || product.id))
            if (existingIndex > -1) {
                const copy = [...prev]
                copy[existingIndex].qty += 1
                return copy
            }
            return [
                ...prev,
                {
                    slotId: activeSlotId,
                    product,
                    qty: 1,
                    serials: []
                }
            ]
        })
    }

    // Update quantity of selected component
    const handleUpdateQty = (index, delta) => {
        setSelectedComponents(prev => {
            const copy = [...prev]
            const target = copy[index]
            const newQty = target.qty + delta
            if (newQty <= 0) {
                return copy.filter((_, i) => i !== index)
            }
            target.qty = newQty
            return copy
        })
    }

    // Remove component
    const handleRemoveComponent = (index) => {
        setSelectedComponents(prev => prev.filter((_, i) => i !== index))
    }



    // Apply quick price discount preset
    const handlePricePreset = (type) => {
        const retail = totals.sumRetail
        if (type === 'retail') {
            setPackagePrice(retail.toString())
        } else if (type === '5pct') {
            setPackagePrice(Math.round(retail * 0.95).toString())
        } else if (type === '10pct') {
            setPackagePrice(Math.round(retail * 0.90).toString())
        } else if (type === 'round50') {
            setPackagePrice((Math.round(retail / 50) * 50).toString())
        }
    }

    // Handle Confirm & Add to Cart
    const handleConfirmBuild = async () => {
        if (!selectedComponents.length) {
            setErrorAlert('يرجى اختيار مكون واحد على الأقل لإتمام التجميعة')
            return
        }

        const finalPrice = packagePrice !== '' ? Number(packagePrice) : totals.sumRetail
        if (isNaN(finalPrice) || finalPrice < 0) {
            setErrorAlert('يرجى إدخال سعر حزمة صحيح للتجميعة')
            return
        }

        setSubmitting(true)
        setErrorAlert(null)

        // Format bundle components with quantities, serials, and slots
        const bundleComponents = selectedComponents.map(comp => {
            const prodId = comp.product._id || comp.product.id
            return {
                item: prodId,
                name: comp.product.name,
                sku: comp.product.sku || comp.product.code || '',
                qty: Number(comp.qty || 1),
                serials: comp.serials || [],
                slotId: comp.slotId,
                price: comp.product.price || 0,
                cost: comp.product.cost || 0
            }
        })

        // If in Edit Mode for an existing cart bundle, update and return immediately
        if (editingBundle && onUpdateCustomBundle) {
            const updatedBundleItem = {
                ...editingBundle,
                name: buildName.trim() || 'تجميعة كمبيوتر مخصصة',
                price: finalPrice,
                retailPrice: finalPrice,
                wholesalePrice: finalPrice,
                cost: totals.sumCost,
                bundleComponents
            }
            onUpdateCustomBundle(updatedBundleItem)
            setSubmitting(false)
            onClose()
            return
        }

        try {
            // 1. Fetch or create custom bundle template from backend
            const { data: template } = await api.get('/inventory/bundles/custom-template')

            if (!template || !template._id) {
                throw new Error('فشل جلب قالب التجميعة المعتمد من النظام')
            }

            // 2. Assemble complete bundle cart item
            const bundleCartItem = {
                id: `${template._id}-${Date.now()}`,
                _id: template._id,
                name: buildName.trim() || 'تجميعة كمبيوتر مخصصة',
                sku: 'CUSTOM-PC',
                barcode: template.barcode || '',
                unit: 'تجميعة',
                price: finalPrice,
                retailPrice: finalPrice,
                wholesalePrice: finalPrice,
                cost: totals.sumCost,
                qty: 1,
                availableInWarehouse: 9999, // Virtual bundle stock
                isBundle: true,
                bundleComponents
            }

            // 3. Send to POS
            onAddCustomBundle(bundleCartItem)
            onClose()
        } catch (err) {
            console.error('Error creating custom PC bundle:', err)
            setErrorAlert(err.response?.data?.message || err.message || 'حدث خطأ أثناء حفظ التجميعة')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs select-none">
            {/* Backdrop */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal Body */}
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 15 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-6xl max-h-[95vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-right z-10"
                dir="rtl"
            >
                {/* 1. HEADER */}
                <div className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-blue-900 via-[#24357a] to-indigo-900 text-white flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shadow-inner">
                            <Cpu size={22} className="text-blue-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black tracking-tight">
                                    {editingBundle ? 'تعديل تجميعة الكمبيوتر المخصصة' : 'منشئ التجميعات المخصصة التفاعلي'}
                                </h2>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    editingBundle
                                        ? 'bg-amber-400/30 text-amber-200 border border-amber-400/40'
                                        : 'bg-blue-400/20 text-blue-200 border border-blue-400/30'
                                }`}>
                                    {editingBundle ? 'وضع التعديل / Edit Mode' : 'Custom PC Builder'}
                                </span>
                            </div>
                            <p className="text-xs text-blue-200/80">
                                {editingBundle
                                    ? 'قم بتعديل أو استبدال القطع، أو ضبط الكميات وسعر الحزمة للتجميعة في السلة'
                                    : 'اختر قطع الكمبيوتر قطعة قطعة، واحسب السعر والتكلفة لحظياً، وقدم سعر حزمة مخصص للعميل'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentWarehouse && (
                            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-white text-xs border border-white/15 font-bold">
                                <span>المخزن الحالي:</span>
                                <span className="text-emerald-300 font-black">{currentWarehouse.name}</span>
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Error Banner */}
                {errorAlert && (
                    <div className="shrink-0 px-4 py-2 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in duration-200">
                        <AlertCircle size={16} className="shrink-0" />
                        <span className="flex-1">{errorAlert}</span>
                        <button onClick={() => setErrorAlert(null)} className="text-rose-500 hover:text-rose-700 p-0.5">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* 2. MAIN 3-COLUMN WORKSTATION */}
                <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-200 dark:divide-slate-800">
                    
                    {/* COLUMN A: HARDWARE SLOTS LIST (RIGHT) */}
                    <div className="w-full lg:w-64 shrink-0 bg-slate-50 dark:bg-slate-900/60 flex flex-col overflow-y-auto custom-scrollbar border-b lg:border-b-0">
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Wrench size={14} className="text-blue-600" />
                                <span>مكونات التجميعة</span>
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-full">
                                {selectedComponents.length} مضاف
                            </span>
                        </div>

                        <div className="p-2 space-y-1.5">
                            {HARDWARE_SLOTS.map(slot => {
                                const SlotIcon = slot.icon
                                const slotItems = selectedComponents.filter(c => c.slotId === slot.id)
                                const hasItems = slotItems.length > 0
                                const isCurrent = activeSlotId === slot.id

                                return (
                                    <button
                                        key={slot.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveSlotId(slot.id)
                                            setPickerSearch('')
                                        }}
                                        className={`w-full text-right p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                                            isCurrent
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 font-bold'
                                                : hasItems
                                                    ? 'bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-800 hover:border-blue-400'
                                                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                isCurrent
                                                    ? 'bg-white/20 text-white'
                                                    : slot.lightBg
                                            }`}>
                                                <SlotIcon size={16} />
                                            </div>
                                            <div className="truncate">
                                                <div className="text-xs font-bold truncate">
                                                    {slot.name}
                                                </div>
                                                <div className={`text-[10px] truncate ${
                                                    isCurrent ? 'text-blue-100' : 'text-slate-400'
                                                }`}>
                                                    {hasItems
                                                        ? `${slotItems.reduce((acc, i) => acc + i.qty, 0)} قطعة مختارة`
                                                        : 'لم يتم الاختيار بعد'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="shrink-0 mr-1">
                                            {hasItems ? (
                                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                    isCurrent
                                                        ? 'bg-white text-blue-600'
                                                        : 'bg-emerald-500 text-white'
                                                }`}>
                                                    ✓
                                                </span>
                                            ) : (
                                                <span className={`text-xs ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                                                    +
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* COLUMN B: COMPONENT SELECTOR (CENTER) */}
                    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
                        {/* Selector Header with Search & Filter */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                        اختيار: {activeSlot?.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                                        ({activeSlot?.description})
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={showAllInventory}
                                            onChange={e => setShowAllInventory(e.target.checked)}
                                            className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                        />
                                        <span>عرض جميع الأصناف</span>
                                    </label>
                                </div>
                            </div>

                            {/* Search Input */}
                            <div className="relative">
                                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={pickerSearch}
                                    onChange={e => setPickerSearch(e.target.value)}
                                    placeholder={`ابحث باسم القطعة، الرمز أو الباركود...`}
                                    className="w-full h-9 pr-9 pl-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-blue-600 transition-all font-medium text-slate-800 dark:text-slate-200"
                                />
                                {pickerSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setPickerSearch('')}
                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Product Cards Grid */}
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                            {availableSlotProducts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                                    <Box size={40} className="text-slate-300 dark:text-slate-700 mb-2" />
                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        لا توجد أصناف مطابقة لهذا القسم
                                    </p>
                                    <p className="text-[11px] text-slate-400 text-center max-w-xs mb-3">
                                        جرب تفعيل خيار "عرض جميع الأصناف" أو البحث بكلمة أخرى
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowAllInventory(true)}
                                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer"
                                    >
                                        عرض كامل المخزن
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                    {availableSlotProducts.map(p => {
                                        const stock = getStock(p)
                                        const inStock = stock > 0
                                        const isAlreadySelected = selectedComponents.some(
                                            c => (c.product._id || c.product.id) === (p._id || p.id)
                                        )

                                        return (
                                            <div
                                                key={p._id || p.id}
                                                className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                                                    isAlreadySelected
                                                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 shadow-xs'
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-700'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                                        <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-tight">
                                                            {p.name}
                                                        </div>
                                                        {isAlreadySelected && (
                                                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[9px] font-black">
                                                                مضاف
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mb-2">
                                                        <span>كود: {p.sku || p.code || '-'}</span>
                                                        {p.category && (
                                                            <span className="text-slate-500 dark:text-slate-400 truncate">
                                                                | {getSafeCategoryStr(p.category)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                                                    <div>
                                                        <div className="font-mono font-black text-xs text-blue-700 dark:text-blue-300">
                                                            {formatCurrency(p.price)} {currency}
                                                        </div>
                                                        <div className={`text-[10px] font-bold ${
                                                            inStock
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-rose-600 dark:text-rose-400'
                                                        }`}>
                                                            {inStock ? `متوفر: ${stock}` : 'غير متوفر'}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddComponent(p)}
                                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                                    >
                                                        <Plus size={13} />
                                                        <span>إضافة</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMN C: SELECTED COMPONENTS & LIVE PRICING (LEFT) */}
                    <div className="w-full lg:w-80 shrink-0 bg-slate-50 dark:bg-slate-900/90 flex flex-col overflow-hidden">
                        
                        {/* Header & Build Name */}
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                                    اسم التجميعة المخصصة
                                </span>
                                <button
                                    type="button"
                                    onClick={generateSmartName}
                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="اقتراح اسم تلقائي بناءً على المعالج وكرت الشاشة"
                                >
                                    <Sparkles size={11} />
                                    <span>اقتراح اسم</span>
                                </button>
                            </div>
                            <input
                                type="text"
                                value={buildName}
                                onChange={e => setBuildName(e.target.value)}
                                placeholder="مثال: تجميعة قيمنق - Core i7 RTX 4070"
                                className="w-full h-8 px-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-600 transition-all"
                            />
                        </div>

                        {/* Selected Items List with Serials */}
                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar min-h-0">
                            {selectedComponents.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8 text-center px-4">
                                    <ShoppingCart size={32} className="text-slate-300 dark:text-slate-700 mb-2" />
                                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        لم يتم إضافة أي قطع بعد
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        اختر القسم من اليمين ثم اضغط "إضافة" على القطعة المناسبة
                                    </div>
                                </div>
                            ) : (
                                selectedComponents.map((item, idx) => {
                                    const slotDef = HARDWARE_SLOTS.find(s => s.id === item.slotId)
                                    const itemTotal = (item.product.price || 0) * item.qty
                                    const itemStock = getStock(item.product)

                                    return (
                                        <div
                                            key={`${item.slotId}-${item.product._id || item.product.id}-${idx}`}
                                            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xs space-y-2"
                                        >
                                            {/* Item Title & Slot Tag */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                                                            {slotDef?.name?.split(' ')[0] || 'قطعة'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            {item.product.sku || ''}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                                        {item.product.name}
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveComponent(idx)}
                                                    className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                                                    title="حذف القطعة"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>

                                            {/* Quantity & Item Subtotal */}
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-750">
                                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateQty(idx, -1)}
                                                        className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                                                    >
                                                        <Minus size={10} />
                                                    </button>
                                                    <span className="w-6 text-center font-mono font-bold text-xs">
                                                        {item.qty}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateQty(idx, 1)}
                                                        className="w-5 h-5 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 cursor-pointer"
                                                    >
                                                        <Plus size={10} />
                                                    </button>
                                                </div>

                                                <div className="text-left font-mono">
                                                    <span className="font-bold text-slate-900 dark:text-white">
                                                        {formatCurrency(itemTotal)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 mr-1">{currency}</span>
                                                </div>
                                            </div>


                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* FINANCIAL SUMMARY & PACKAGE PRICING PANEL */}
                        <div className="shrink-0 p-3 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 space-y-2.5 shadow-lg">
                            {/* Breakdown Rows */}
                            <div className="space-y-1 text-xs">
                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                    <span>مجموع أسعار القطع الفردية:</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                        {formatCurrency(totals.sumRetail)} {currency}
                                    </span>
                                </div>

                                {isPrivileged && (
                                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <span>إجمالي التكلفة (Cost):</span>
                                        </span>
                                        <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                                            {formatCurrency(totals.sumCost)} {currency}
                                        </span>
                                    </div>
                                )}

                                {totals.customerSavings > 0 && (
                                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                                        <span>توفير العميل (خصم الحزمة):</span>
                                        <span className="font-mono">
                                            -{formatCurrency(totals.customerSavings)} {currency} ({totals.savingsPercent}%)
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Package Price Input Box */}
                            <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center gap-1">
                                        <Tag size={13} className="text-blue-600" />
                                        <span>سعر الحزمة النهائي للتجميعة:</span>
                                    </label>
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                                        Package Price
                                    </span>
                                </div>

                                <div className="relative">
                                    <input
                                        type="number"
                                        value={packagePrice}
                                        onChange={e => setPackagePrice(e.target.value)}
                                        placeholder={totals.sumRetail ? totals.sumRetail.toString() : '0'}
                                        className="w-full h-9 pr-3 pl-12 bg-white dark:bg-slate-900 border-2 border-blue-500 dark:border-blue-600 rounded-lg text-sm font-mono font-black text-blue-950 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                                    />
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                        {currency}
                                    </span>
                                </div>

                                {/* Quick Presets */}
                                <div className="flex items-center gap-1.5 mt-2 overflow-x-auto custom-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => handlePricePreset('retail')}
                                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer shrink-0"
                                    >
                                        سعر القطع
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePricePreset('5pct')}
                                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 cursor-pointer shrink-0"
                                    >
                                        خصم 5%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePricePreset('10pct')}
                                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 cursor-pointer shrink-0"
                                    >
                                        خصم 10%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePricePreset('round50')}
                                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer shrink-0"
                                    >
                                        تقريب لـ 50
                                    </button>
                                </div>
                            </div>

                            {/* Profit Margin indicator for Admins */}
                            {isPrivileged && totals.effectivePkgPrice > 0 && (
                                <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                                    <span>هامش الربح الإجمالي:</span>
                                    <span className={`font-bold ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        +{formatCurrency(totals.profit)} {currency} ({totals.profitMargin}%)
                                    </span>
                                </div>
                            )}

                            {/* Actions Buttons */}
                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    إلغاء
                                </button>

                                <button
                                    type="button"
                                    onClick={handleConfirmBuild}
                                    disabled={submitting || selectedComponents.length === 0}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                        submitting || selectedComponents.length === 0
                                            ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed text-slate-400'
                                            : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-emerald-600/25'
                                    }`}
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span>جاري التجهيز...</span>
                                        </>
                                    ) : (
                                        <>
                                            {editingBundle ? <CheckCircle2 size={15} /> : <ShoppingCart size={15} />}
                                            <span>{editingBundle ? 'حفظ التعديلات على التجميعة' : 'اعتماد وإضافة إلى الفاتورة'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
