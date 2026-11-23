import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Cpu,
    X,
    Check,
    AlertCircle,
    CheckSquare,
    Square,
    RefreshCw,
    Shield,
    Layers,
    DollarSign,
    RotateCcw
} from 'lucide-react'

/**
 * BundleDeconstructModal - تفكيك تجميعة الحاسوب لمرتجع جزئي أو كلي
 * 
 * Allows cashier to deconstruct a sold PC bundle to:
 * 1. Return the entire bundle with all its components restored to warehouse
 * 2. Return or swap a SINGLE component (e.g. defective GPU, RAM upgrade)
 */
export const BundleDeconstructModal = ({
    isOpen,
    onClose,
    bundleItem,
    onConfirmReturn
}) => {
    // Component selection state: { [compIndex]: { selected: boolean, unitPrice: number, reason: string } }
    const [selectedMap, setSelectedMap] = useState({})

    const components = useMemo(() => {
        if (!bundleItem) return []
        return bundleItem.bundleComponents || []
    }, [bundleItem])

    // Initialize selections when modal opens
    useEffect(() => {
        if (isOpen && bundleItem) {
            const initial = {}
            const comps = bundleItem.bundleComponents || []
            const bundleTotal = Number(bundleItem.price || bundleItem.retailPrice || 0)

            // Estimate unit price per component if not explicitly defined
            // Sum of known component prices or distribute equally
            const knownSum = comps.reduce((sum, c) => sum + (Number(c.price || c.unitPrice || 0) * (c.qty || 1)), 0)

            comps.forEach((c, idx) => {
                let estimatedPrice = Number(c.price || c.unitPrice || 0)
                if (estimatedPrice <= 0 && comps.length > 0) {
                    estimatedPrice = Math.round((bundleTotal / comps.length) * 100) / 100
                }
                initial[idx] = {
                    selected: true, // Default to all selected (full return)
                    unitPrice: estimatedPrice,
                    reason: 'customer_preference'
                }
            })
            setSelectedMap(initial)
        }
    }, [isOpen, bundleItem])

    if (!isOpen || !bundleItem) return null

    const toggleSelectAll = (selectState) => {
        setSelectedMap(prev => {
            const updated = { ...prev }
            components.forEach((_, idx) => {
                if (updated[idx]) {
                    updated[idx] = { ...updated[idx], selected: selectState }
                }
            })
            return updated
        })
    }

    const toggleSingle = (idx) => {
        setSelectedMap(prev => ({
            ...prev,
            [idx]: {
                ...prev[idx],
                selected: !prev[idx]?.selected
            }
        }))
    }

    const updatePrice = (idx, newPrice) => {
        const p = parseFloat(newPrice) || 0
        setSelectedMap(prev => ({
            ...prev,
            [idx]: {
                ...prev[idx],
                unitPrice: p
            }
        }))
    }

    const updateReason = (idx, reason) => {
        setSelectedMap(prev => ({
            ...prev,
            [idx]: {
                ...prev[idx],
                reason
            }
        }))
    }

    // Calculations
    const selectedCount = Object.values(selectedMap).filter(v => v.selected).length
    const totalRefund = Object.entries(selectedMap).reduce((sum, [idx, v]) => {
        if (!v.selected) return sum
        const comp = components[idx]
        const qty = Number(comp?.qty || 1)
        return sum + (v.unitPrice * qty)
    }, 0)

    const isAllSelected = selectedCount === components.length && components.length > 0
    const isSingleSelected = selectedCount === 1

    const handleConfirm = () => {
        if (selectedCount === 0) return

        // Prepare selected items to return
        const returnPayloads = []

        if (isAllSelected) {
            // Full Bundle Return
            returnPayloads.push({
                id: bundleItem.id || bundleItem._id,
                item: bundleItem.item?._id || bundleItem.item || bundleItem.id || bundleItem._id,
                name: bundleItem.name || 'تجميعة كمبيوتر مخصصة',
                sku: bundleItem.sku || 'CUSTOM-PC',
                price: Number(bundleItem.price || bundleItem.retailPrice || 0),
                qty: Number(bundleItem.qty || 1),
                isBundle: true,
                bundleComponents: components.map((c, idx) => ({
                    item: c.item?._id || c.item || c.id,
                    name: c.name,
                    sku: c.sku,
                    qty: Number(c.qty || 1),
                    price: selectedMap[idx]?.unitPrice || 0,
                    serials: c.serials || []
                })),
                reason: selectedMap[0]?.reason || 'customer_return',
                isFullBundleReturn: true
            })
        } else {
            // Partial Return / Component Swap (Individual parts)
            components.forEach((c, idx) => {
                const sel = selectedMap[idx]
                if (sel?.selected) {
                    const itemId = c.item?._id || c.item || c.id
                    returnPayloads.push({
                        id: `${itemId}-from-bundle-${Date.now()}-${idx}`,
                        item: itemId,
                        name: c.name || 'مكون تجميعة',
                        sku: c.sku || '',
                        price: sel.unitPrice,
                        qty: Number(c.qty || 1),
                        parentBundle: bundleItem.item?._id || bundleItem.item || bundleItem._id,
                        parentBundleName: bundleItem.name || 'تجميعة مخصصة',
                        serials: c.serials || [],
                        reason: sel.reason,
                        isComponentFromBundle: true
                    })
                }
            })
        }

        onConfirmReturn(returnPayloads)
        onClose()
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs select-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 12 }}
                    transition={{ duration: 0.15 }}
                    className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="px-5 py-4 bg-linear-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
                                <Cpu size={22} className="text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-base">تفكيك تجميعة الحاسوب للإرجاع / الاستبدال</h3>
                                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-purple-100 text-[10px] font-mono font-bold">
                                        {bundleItem.name}
                                    </span>
                                </div>
                                <p className="text-xs text-purple-200">
                                    اختر إرجاع التجميعة كاملة أو تحديد قطعة واحدة فقط لاسترجاعها أو استبدالها وترقيتها
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Quick Action Toolbar */}
                    <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => toggleSelectAll(true)}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 cursor-pointer ${isAllSelected
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                <CheckSquare size={13} />
                                <span>تحديد الكل (إرجاع التجميعة كاملة)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => toggleSelectAll(false)}
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 font-bold flex items-center gap-1 cursor-pointer"
                            >
                                <Square size={13} />
                                <span>إلغاء التحديد</span>
                            </button>
                        </div>

                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                            تم تحديد: <span className="text-purple-600 dark:text-purple-400 font-black">{selectedCount}</span> من {components.length} قطع
                        </div>
                    </div>

                    {/* Components List / Table */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
                        {components.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                لا توجد مكونات مسجلة ضمن هذه التجميعة.
                            </div>
                        ) : (
                            components.map((comp, idx) => {
                                const sel = selectedMap[idx] || { selected: false, unitPrice: 0, reason: 'other' }
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => toggleSingle(idx)}
                                        className={`p-3 rounded-xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${sel.selected
                                            ? 'bg-purple-50/50 dark:bg-purple-950/30 border-purple-400 dark:border-purple-600 shadow-xs'
                                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                                            }`}
                                    >
                                        {/* Part Info */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${sel.selected
                                                ? 'bg-purple-600 text-white'
                                                : 'border border-slate-300 dark:border-slate-600 text-transparent'
                                                }`}>
                                                <Check size={14} />
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                                        {comp.name}
                                                    </span>
                                                    {comp.qty > 1 && (
                                                        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold shrink-0">
                                                            {comp.qty}x
                                                        </span>
                                                    )}
                                                </div>

                                                {comp.serials && comp.serials.length > 0 && (
                                                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 font-mono">
                                                        <Shield size={11} className="text-amber-500 shrink-0" />
                                                        <span>S/N: {comp.serials.join(', ')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Price & Reason Configuration */}
                                        <div
                                            className="flex items-center gap-2 shrink-0 self-end sm:self-auto"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <div className="flex flex-col items-end">
                                                <label className="text-[10px] font-bold text-slate-400">سعر الاسترجاع (د.ل):</label>
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        min="0"
                                                        disabled={!sel.selected}
                                                        value={sel.unitPrice}
                                                        onChange={e => updatePrice(idx, e.target.value)}
                                                        className="w-24 h-8 px-2 text-left font-mono font-bold text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-purple-500 disabled:opacity-40"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end">
                                                <label className="text-[10px] font-bold text-slate-400">سبب الإرجاع:</label>
                                                <select
                                                    disabled={!sel.selected}
                                                    value={sel.reason}
                                                    onChange={e => updateReason(idx, e.target.value)}
                                                    className="h-8 px-2 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-purple-500 disabled:opacity-40 font-medium"
                                                >
                                                    <option value="customer_preference">طلب العميل / استبدال</option>
                                                    <option value="damaged">عطل أو عيب مصنعي</option>
                                                    <option value="wrong_item">صنف غير متوافق</option>
                                                    <option value="other">أخرى</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Notice Banner for Component Swap */}
                    {isSingleSelected && (
                        <div className="mx-5 my-2 p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
                            <RotateCcw size={16} className="shrink-0 text-blue-600" />
                            <span>
                                💡 <strong>استبدال / ترقية قطعة:</strong> عند إرسال هذه القطعة لسلة الإرجاع، ستُسجل كقيمة دائنة للعميل ويمكنك بعدها اختيار القطعة البديلة لاحتساب الفرق فوراً.
                            </span>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold">إجمالي المبلغ المسترد:</span>
                            <span className="text-xl font-black font-mono text-purple-700 dark:text-purple-300">
                                {totalRefund.toFixed(2)} <span className="text-xs font-sans">د.ل</span>
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                disabled={selectedCount === 0}
                                onClick={handleConfirm}
                                className="px-5 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all disabled:opacity-40 cursor-pointer active:scale-98"
                            >
                                <Check size={16} />
                                <span>
                                    {isAllSelected
                                        ? 'إرجاع التجميعة كاملة'
                                        : `إرجاع القطع المحددة (${selectedCount})`}
                                </span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
