import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, Minus, Search } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

/**
 * SpreadsheetCart V2 - Excel/Ledger Style Cart with Autocomplete
 * 
 * Features:
 * - Fixed number of visible rows (like spreadsheet)
 * - Autocomplete suggestions when typing code
 * - Type product code in الرمز column to add
 * - Auto-populate row when product found
 */
export const SpreadsheetCart = ({
    cartItems,
    products,
    addToCartBySku,
    addToCart,
    updateQty,
    updateItemDiscount,
    removeFromCart,
    subtotal,
    currency
}) => {
    const VISIBLE_ROWS = 10
    const MAX_SUGGESTIONS = 5
    const [skuInputs, setSkuInputs] = useState({})
    const [activeRow, setActiveRow] = useState(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRefs = useRef({})
    const dropdownRefs = useRef({})

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
        if (addToCart) {
            addToCart(product)
        } else if (addToCartBySku) {
            addToCartBySku(product.sku || product.barcode)
        }
        setSkuInputs(prev => ({ ...prev, [rowIndex]: '' }))
        setActiveRow(null)
        // Focus next empty row
        setTimeout(() => {
            const nextRow = cartItems.length + 1
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
            } else {
                // Try exact match
                const sku = skuInputs[rowIndex]?.trim()
                if (sku && addToCartBySku) {
                    const success = addToCartBySku(sku)
                    if (success) {
                        setSkuInputs(prev => ({ ...prev, [rowIndex]: '' }))
                        setActiveRow(null)
                    }
                }
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

    // Generate rows (filled + empty)
    const rows = []

    cartItems.forEach((item, index) => {
        rows.push({ type: 'filled', index: index + 1, item })
    })

    for (let i = cartItems.length; i < Math.max(VISIBLE_ROWS, cartItems.length + 3); i++) {
        rows.push({ type: 'empty', index: i + 1 })
    }

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden border border-slate-300 rounded-lg">
            {/* Spreadsheet Table */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <table className="w-full border-collapse text-sm" style={{ direction: 'rtl' }}>
                    {/* Header Row */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-gradient-to-b from-emerald-500 to-emerald-600 text-white text-xs font-bold">
                            <th className="py-2 px-1 text-center border-l border-emerald-400 w-8">#</th>
                            <th className="py-2 px-2 text-center border-l border-emerald-400 min-w-[140px]">المادة</th>
                            <th className="py-2 px-2 text-center border-l border-emerald-400 w-28">الرمز</th>
                            <th className="py-2 px-1 text-center border-l border-emerald-400 w-16">الكمية</th>
                            <th className="py-2 px-2 text-center border-l border-emerald-400 w-20">الواحدة</th>
                            <th className="py-2 px-2 text-center border-l border-emerald-400 w-24">الإجمالي</th>
                            <th className="py-2 px-1 text-center border-l border-emerald-400 w-14">خصم%</th>
                            <th className="py-2 px-1 text-center w-8">×</th>
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
                                    <td className="py-1.5 px-1 text-center border-l border-slate-200 text-slate-400 text-xs font-mono">
                                        {row.index}
                                    </td>

                                    {/* Product Name - المادة */}
                                    <td className="py-1.5 px-2 border-l border-slate-200">
                                        {row.type === 'filled' ? (
                                            <span className="text-slate-700 font-medium text-xs truncate block">
                                                {row.item.name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Product Code - الرمز (Editable with Autocomplete) */}
                                    <td className="py-1 px-1 border-l border-slate-200 relative">
                                        {row.type === 'filled' ? (
                                            <span className="text-slate-500 text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded block text-center">
                                                {row.item.sku || row.item.barcode || '-'}
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
                                                    placeholder="🔍 ابحث..."
                                                    className="w-full h-7 px-2 text-xs text-center border border-slate-200 rounded focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                                                    autoComplete="off"
                                                />

                                                {/* Autocomplete Dropdown */}
                                                <AnimatePresence>
                                                    {showDropdown && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -5 }}
                                                            ref={el => dropdownRefs.current[row.index - 1] = el}
                                                            className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 overflow-hidden"
                                                            style={{ minWidth: '250px' }}
                                                        >
                                                            {suggestions.map((product, i) => (
                                                                <div
                                                                    key={product._id || product.id || i}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault()
                                                                        handleSelectSuggestion(product, row.index - 1)
                                                                    }}
                                                                    className={`
                                                                        px-3 py-2 cursor-pointer flex items-center gap-2 border-b border-slate-100 last:border-0
                                                                        ${i === selectedIndex ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'}
                                                                    `}
                                                                >
                                                                    <div className="flex-1 text-right">
                                                                        <div className="text-xs font-medium text-slate-700 truncate">
                                                                            {product.name}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 font-mono">
                                                                            {product.sku || product.barcode || '-'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-xs font-bold text-emerald-600 font-mono shrink-0">
                                                                        {product.retailPrice?.toLocaleString() || product.price?.toLocaleString()}
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

                                    {/* Quantity - الكمية */}
                                    <td className="py-1 px-1 border-l border-slate-200">
                                        {row.type === 'filled' ? (
                                            <div className="flex items-center justify-center gap-0.5">
                                                <button
                                                    onClick={() => updateQty(row.item.id, row.item.qty - 1)}
                                                    disabled={row.item.qty <= 1}
                                                    className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 disabled:opacity-30"
                                                >
                                                    <Minus size={10} />
                                                </button>
                                                <input
                                                    type="number"
                                                    value={row.item.qty}
                                                    onChange={(e) => updateQty(row.item.id, parseInt(e.target.value) || 1)}
                                                    className="w-8 h-5 text-center text-xs font-bold border border-slate-200 rounded mx-0.5"
                                                    min="1"
                                                />
                                                <button
                                                    onClick={() => updateQty(row.item.id, row.item.qty + 1)}
                                                    className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600"
                                                >
                                                    <Plus size={10} />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs block text-center">—</span>
                                        )}
                                    </td>

                                    {/* Unit Price - الواحدة */}
                                    <td className="py-1.5 px-2 border-l border-slate-200 text-center">
                                        {row.type === 'filled' ? (
                                            <span className="text-slate-600 text-xs font-mono">
                                                {row.item.price?.toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Total - الإجمالي */}
                                    <td className="py-1.5 px-2 border-l border-slate-200 text-center">
                                        {row.type === 'filled' ? (
                                            <span className="text-emerald-600 font-bold text-xs font-mono">
                                                {(row.item.price * row.item.qty).toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Discount % - خصم% */}
                                    <td className="py-1 px-1 border-l border-slate-200 text-center">
                                        {row.type === 'filled' ? (
                                            <input
                                                type="number"
                                                value={row.item.discount || 0}
                                                onChange={(e) => updateItemDiscount?.(row.item.id, parseFloat(e.target.value) || 0)}
                                                className="w-10 h-5 text-center text-xs border border-slate-200 rounded"
                                                min="0"
                                                max="100"
                                            />
                                        ) : (
                                            <span className="text-slate-300 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Delete Button */}
                                    <td className="py-1.5 px-1 text-center">
                                        {row.type === 'filled' && (
                                            <button
                                                onClick={() => removeFromCart(row.item.id)}
                                                className="w-5 h-5 flex items-center justify-center rounded bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors mx-auto"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Footer Summary */}
            {cartItems.length > 0 && (
                <div className="shrink-0 bg-gradient-to-r from-slate-100 to-slate-50 border-t-2 border-slate-300 p-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-bold">
                            الإجمالي ({cartItems.length} {cartItems.length === 1 ? 'صنف' : 'أصناف'})
                        </span>
                        <span className="text-emerald-600 font-bold text-lg font-mono">
                            {subtotal?.toLocaleString()} {currency}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
