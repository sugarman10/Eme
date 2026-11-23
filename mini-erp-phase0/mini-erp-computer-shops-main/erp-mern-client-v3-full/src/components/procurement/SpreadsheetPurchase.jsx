import React, { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, Minus, Search } from 'lucide-react'

/**
 * SpreadsheetPurchase - Excel/Ledger Style for Purchase Orders
 * 
 * Features:
 * - Fixed number of visible rows (like spreadsheet)
 * - Autocomplete suggestions when typing code
 * - Type product code in الرمز column to add
 * - Editable qty and cost columns
 */
export const SpreadsheetPurchase = ({
    orderItems,
    products,
    onAddItem,
    onUpdateItem,
    onRemoveItem,
    currency = 'د.ل'
}) => {
    const VISIBLE_ROWS = 12
    const MAX_SUGGESTIONS = 5
    const [skuInputs, setSkuInputs] = useState({})
    const [activeRow, setActiveRow] = useState(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRefs = useRef({})

    // Filter products based on input
    const getSuggestions = (rowIndex) => {
        const query = (skuInputs[rowIndex] || '').trim().toLowerCase()
        if (!query || query.length < 1 || !products) return []

        return products.filter(p => {
            const sku = (p.sku || '').toLowerCase()
            const barcode = (p.barcode || '').toLowerCase()
            const name = (p.name || '').toLowerCase()
            return sku.includes(query) || barcode.includes(query) || name.includes(query)
        }).slice(0, MAX_SUGGESTIONS)
    }

    // Handle SKU input change
    const handleSkuChange = (rowIndex, value) => {
        setSkuInputs(prev => ({ ...prev, [rowIndex]: value }))
        setActiveRow(rowIndex)
        setSelectedIndex(0)
    }

    // Handle selecting a suggestion
    const handleSelectSuggestion = (product, rowIndex) => {
        if (onAddItem) {
            onAddItem({
                item: product._id,
                name: product.name,
                sku: product.sku || product.barcode,
                qty: 1,
                cost: product.cost || 0
            })
        }
        setSkuInputs(prev => ({ ...prev, [rowIndex]: '' }))
        setActiveRow(null)
        // Focus next empty row
        setTimeout(() => {
            const nextRow = orderItems.length + 1
            if (inputRefs.current[nextRow]) {
                inputRefs.current[nextRow].focus()
            }
        }, 100)
    }

    // Handle keyboard navigation
    const handleSkuKeyDown = (e, rowIndex) => {
        const suggestions = getSuggestions(rowIndex)

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedIndex(prev => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (suggestions.length > 0 && selectedIndex < suggestions.length) {
                handleSelectSuggestion(suggestions[selectedIndex], rowIndex)
            }
        } else if (e.key === 'Escape') {
            setActiveRow(null)
            setSkuInputs(prev => ({ ...prev, [rowIndex]: '' }))
        }
    }

    // Handle blur - close dropdown
    const handleBlur = (rowIndex) => {
        setTimeout(() => {
            if (activeRow === rowIndex) {
                setActiveRow(null)
            }
        }, 200)
    }

    // Calculate total
    const total = useMemo(() => {
        return orderItems.reduce((sum, item) => sum + (item.qty * item.cost), 0)
    }, [orderItems])

    // Generate rows (filled + empty)
    const rows = []
    orderItems.forEach((item, index) => {
        rows.push({ type: 'filled', index: index + 1, item, itemIndex: index })
    })
    for (let i = orderItems.length; i < Math.max(VISIBLE_ROWS, orderItems.length + 3); i++) {
        rows.push({ type: 'empty', index: i + 1 })
    }

    return (
        <div className="flex flex-col bg-white overflow-hidden border-2 border-slate-300 rounded-xl shadow-sm">
            {/* Spreadsheet Table */}
            <div className="overflow-y-auto max-h-[500px]">
                <table className="w-full border-collapse" style={{ direction: 'rtl' }}>
                    {/* Header Row */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-gradient-to-b from-blue-500 to-blue-600 text-white text-sm font-bold">
                            <th className="py-3 px-2 text-center border-l border-blue-400 w-12">#</th>
                            <th className="py-3 px-3 text-center border-l border-blue-400 w-40">الرمز / الباركود</th>
                            <th className="py-3 px-3 text-center border-l border-blue-400 min-w-[250px]">اسم الصنف</th>
                            <th className="py-3 px-2 text-center border-l border-blue-400 w-28">الكمية</th>
                            <th className="py-3 px-3 text-center border-l border-blue-400 w-32">سعر الشراء</th>
                            <th className="py-3 px-3 text-center border-l border-blue-400 w-36">الإجمالي</th>
                            <th className="py-3 px-2 text-center w-12">حذف</th>
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody>
                        {rows.map((row, idx) => {
                            const suggestions = row.type === 'empty' ? getSuggestions(row.index - 1) : []
                            const showDropdown = activeRow === (row.index - 1) && suggestions.length > 0

                            return (
                                <tr
                                    key={idx}
                                    className={`
                                        border-b border-slate-200 transition-colors
                                        ${row.type === 'filled' ? 'bg-blue-50/50 hover:bg-blue-100/50' : 'hover:bg-slate-50'}
                                        ${idx % 2 === 0 ? 'bg-slate-50/30' : ''}
                                    `}
                                >
                                    {/* Row Number */}
                                    <td className="py-3 px-2 text-center border-l border-slate-200 text-slate-500 text-sm font-mono font-bold">
                                        {row.index}
                                    </td>

                                    {/* Product Code - الرمز (Editable with Autocomplete) */}
                                    <td className="py-2 px-2 border-l border-slate-200 relative">
                                        {row.type === 'filled' ? (
                                            <span className="text-slate-700 text-sm font-mono bg-slate-100 px-3 py-1.5 rounded-lg block text-center font-bold">
                                                {row.item.sku || '-'}
                                            </span>
                                        ) : (
                                            <div className="relative">
                                                <input
                                                    ref={el => inputRefs.current[row.index - 1] = el}
                                                    type="text"
                                                    value={skuInputs[row.index - 1] || ''}
                                                    onChange={(e) => handleSkuChange(row.index - 1, e.target.value)}
                                                    onKeyDown={(e) => handleSkuKeyDown(e, row.index - 1)}
                                                    onFocus={() => setActiveRow(row.index - 1)}
                                                    onBlur={() => handleBlur(row.index - 1)}
                                                    placeholder="🔍 اكتب للبحث..."
                                                    className="w-full h-10 px-3 text-sm text-center border-2 border-dashed border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-blue-50/50 hover:bg-white transition-colors"
                                                    autoComplete="off"
                                                />

                                                {/* Autocomplete Dropdown */}
                                                <AnimatePresence>
                                                    {showDropdown && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -5 }}
                                                            className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 overflow-hidden"
                                                            style={{ minWidth: '280px' }}
                                                        >
                                                            {suggestions.map((product, i) => (
                                                                <div
                                                                    key={product._id || i}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault()
                                                                        handleSelectSuggestion(product, row.index - 1)
                                                                    }}
                                                                    className={`
                                                                        px-3 py-2.5 cursor-pointer flex items-center gap-2 border-b border-slate-100 last:border-0
                                                                        ${i === selectedIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'}
                                                                    `}
                                                                >
                                                                    <div className="flex-1 text-right">
                                                                        <div className="text-sm font-medium text-slate-700 truncate">
                                                                            {product.name}
                                                                        </div>
                                                                        <div className="text-xs text-slate-400 font-mono">
                                                                            {product.sku || product.barcode || '-'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-xs font-bold text-blue-600 font-mono shrink-0 bg-blue-50 px-2 py-1 rounded">
                                                                        {product.cost?.toLocaleString() || 0} {currency}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <div className="px-3 py-1.5 bg-slate-50 text-[10px] text-slate-400 text-center">
                                                                ↑↓ للتنقل • Enter للاختيار • Esc للإغلاق
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </td>

                                    {/* Product Name - الصنف */}
                                    <td className="py-2 px-3 border-l border-slate-200">
                                        {row.type === 'filled' ? (
                                            <span className="text-slate-800 font-bold text-base truncate block">
                                                {row.item.name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-sm">—</span>
                                        )}
                                    </td>

                                    {/* Quantity - الكمية */}
                                    <td className="py-2 px-2 border-l border-slate-200">
                                        {row.type === 'filled' ? (
                                            <input
                                                type="number"
                                                min="1"
                                                value={row.item.qty}
                                                onChange={(e) => onUpdateItem(row.itemIndex, 'qty', parseInt(e.target.value) || 1)}
                                                className="w-full h-10 text-center text-base font-bold border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                            />
                                        ) : (
                                            <span className="text-slate-300 text-sm block text-center">-</span>
                                        )}
                                    </td>

                                    {/* Cost - التكلفة */}
                                    <td className="py-2 px-2 border-l border-slate-200">
                                        {row.type === 'filled' ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={row.item.cost}
                                                onChange={(e) => onUpdateItem(row.itemIndex, 'cost', parseFloat(e.target.value) || 0)}
                                                className="w-full h-10 text-center text-base font-mono border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                                            />
                                        ) : (
                                            <span className="text-slate-300 text-sm block text-center">-</span>
                                        )}
                                    </td>

                                    {/* Total - الإجمالي */}
                                    <td className="py-2 px-3 border-l border-slate-200 text-center">
                                        {row.type === 'filled' ? (
                                            <span className="font-black text-lg text-blue-600 font-mono">
                                                {(row.item.qty * row.item.cost).toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-sm">-</span>
                                        )}
                                    </td>

                                    {/* Delete */}
                                    <td className="py-2 px-2 text-center">
                                        {row.type === 'filled' && (
                                            <button
                                                onClick={() => onRemoveItem(row.itemIndex)}
                                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-500 text-red-400 hover:text-white transition-all shadow-sm"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer - Total */}
            <div className="border-t-2 border-blue-300 bg-gradient-to-b from-blue-100 to-blue-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="text-base text-slate-700">
                        عدد الأصناف: <span className="font-black text-blue-600 text-xl">{orderItems.length}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-base font-bold text-slate-600">الإجمالي الكلي:</span>
                        <span className="text-3xl font-black text-blue-700 font-mono bg-white px-4 py-2 rounded-xl shadow-inner border-2 border-blue-300">
                            {total.toLocaleString()} {currency}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SpreadsheetPurchase
