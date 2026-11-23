import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Plus, Minus, Search, Package } from 'lucide-react'
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
        const hasSuggestions = suggestions.length > 0

        if (e.key === 'ArrowDown') {
            if (hasSuggestions) {
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
            } else {
                // Move to next row
                e.preventDefault()
                const nextInput = inputRefs.current[rowIndex + 1]
                if (nextInput) nextInput.focus()
            }
        } else if (e.key === 'ArrowUp') {
            if (hasSuggestions) {
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
            } else {
                // Move to prev row
                e.preventDefault()
                const prevInput = inputRefs.current[rowIndex - 1]
                if (prevInput) prevInput.focus()
            }
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (hasSuggestions && selectedIndex < suggestions.length) {
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
        <div className="h-full flex flex-col bg-white overflow-hidden border border-slate-200 rounded-xl shadow-sm">
            {/* Spreadsheet Table */}
            <div className="flex-1 overflow-auto custom-scrollbar relative">
                <table className="w-full border-collapse text-sm" style={{ direction: 'rtl' }}>
                    {/* Header Row */}
                    <thead className="sticky top-0 z-30 shadow-sm">
                        <tr className="bg-slate-50 border-b border-slate-300">
                            {/* Sticky Columns Header */}
                            <th className="py-2 px-1 text-center font-bold text-slate-700 w-10 sticky right-0 z-30 bg-slate-100 border-l border-slate-300">#</th>
                            <th className="py-2 px-2 text-center font-bold text-slate-700 w-32 sticky right-10 z-30 bg-slate-100 border-l border-slate-300 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.1)]">الرمز</th>
                            <th className="py-2 px-2 text-right font-bold text-slate-700 min-w-[180px] sticky right-[168px] z-30 bg-slate-100 border-l border-slate-300">المنتج</th>

                            {/* Scrollable Columns Header */}
                            <th className="py-2 px-1 text-center font-bold text-slate-700 w-20 border-l border-slate-200">الكمية</th>
                            <th className="py-2 px-2 text-center font-bold text-slate-700 w-24 border-l border-slate-200">السعر</th>
                            <th className="py-2 px-1 text-center font-bold text-slate-700 w-20 border-l border-slate-200">خصم %</th>
                            <th className="py-2 px-1 text-center font-bold text-slate-700 w-20 border-l border-slate-200">ضريبة</th>
                            <th className="py-2 px-2 text-center font-bold text-slate-700 w-28 border-l border-slate-200 bg-slate-50">الإجمالي</th>
                            <th className="py-2 px-1 text-center w-10"></th>
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody>
                        {rows.map((row, idx) => {
                            const suggestions = row.type === 'empty' ? getSuggestions(row.index - 1) : []
                            const showDropdown = activeRow === (row.index - 1) && suggestions.length > 0
                            const isSticky = true

                            // Row Background Logic (Zebra)
                            const bgClass = row.type === 'filled'
                                ? (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')
                                : 'bg-white'

                            return (
                                <tr
                                    key={idx}
                                    className={`
                                        border-b border-slate-200 hover:bg-blue-50/30 transition-colors h-11 group
                                        ${row.type === 'empty' ? 'hover:bg-transparent' : ''}
                                        ${bgClass}
                                    `}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Delete' && row.type === 'filled') {
                                            removeFromCart(row.item.id)
                                        }
                                    }}
                                >
                                    {/* # (Sticky) */}
                                    <td className={`py-1 px-1 text-center text-slate-500 text-xs font-mono border-l border-slate-300 sticky right-0 z-20 ${bgClass} group-hover:bg-blue-50/30`}>
                                        {row.index}
                                    </td>

                                    {/* Code / Barcode (Sticky) */}
                                    <td className={`py-1 px-1 relative border-l border-slate-300 sticky right-10 z-20 ${bgClass} group-hover:bg-blue-50/30 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.05)]`}>
                                        {row.type === 'filled' ? (
                                            <span className="text-slate-600 text-xs font-mono font-bold block text-center select-all">
                                                {row.item.sku || row.item.barcode || '-'}
                                            </span>
                                        ) : (
                                            <div className="relative h-full">
                                                <input
                                                    ref={el => inputRefs.current[row.index - 1] = el}
                                                    type="text"
                                                    value={skuInputs[row.index - 1] || ''}
                                                    onChange={(e) => handleSkuChange(row.index - 1, e.target.value)}
                                                    onKeyDown={(e) => handleSkuKeyDown(e, row.index - 1)}
                                                    onFocus={() => setActiveRow(row.index - 1)}
                                                    onBlur={() => handleBlur(row.index - 1)}
                                                    placeholder={idx === cartItems.length ? "Scan..." : ""}
                                                    className="w-full h-8 px-2 text-sm text-center border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 rounded outline-none bg-transparent placeholder:text-slate-300"
                                                    autoComplete="off"
                                                />
                                                {/* Suggestions Dropdown */}
                                                <AnimatePresence>
                                                    {showDropdown && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 5 }}
                                                            ref={el => dropdownRefs.current[row.index - 1] = el}
                                                            className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden min-w-[240px]"
                                                        >
                                                            {suggestions.map((product, i) => (
                                                                <div
                                                                    key={product._id || product.id || i}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault()
                                                                        handleSelectSuggestion(product, row.index - 1)
                                                                    }}
                                                                    className={`px-3 py-2 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-0 ${i === selectedIndex ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                                                >
                                                                    <div className="text-sm font-medium text-slate-700 truncate max-w-[160px]">{product.name}</div>
                                                                    <div className="text-xs font-mono text-indigo-600">{product.price}</div>
                                                                </div>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </td>

                                    {/* Product Name (Sticky) */}
                                    <td className={`py-1 px-2 border-l border-slate-300 sticky right-[168px] z-20 ${bgClass} group-hover:bg-blue-50/30`}>
                                        {row.type === 'filled' ? (
                                            <span className="text-slate-800 font-bold text-sm truncate block max-w-[200px]" title={row.item.name}>
                                                {row.item.name}
                                            </span>
                                        ) : null}
                                    </td>

                                    {/* Quantity */}
                                    <td className="py-1 px-1 border-l border-slate-200">
                                        {row.type === 'filled' && (
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="number"
                                                    value={row.item.qty}
                                                    onChange={(e) => updateQty(row.item.id, parseInt(e.target.value) || 1)}
                                                    className="w-16 h-7 text-center text-sm font-bold border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded transition-colors bg-transparent outline-none"
                                                    min="1"
                                                />
                                            </div>
                                        )}
                                    </td>

                                    {/* Price */}
                                    <td className="py-1 px-2 text-center border-l border-slate-200">
                                        {row.type === 'filled' && (
                                            <span className="text-slate-600 text-sm font-mono">{row.item.price?.toLocaleString()}</span>
                                        )}
                                    </td>

                                    {/* Discount */}
                                    <td className="py-1 px-1 text-center border-l border-slate-200">
                                        {row.type === 'filled' && (
                                            <div className="flex justify-center">
                                                <input
                                                    type="number"
                                                    value={row.item.discount || ''}
                                                    placeholder="0"
                                                    onChange={(e) => updateItemDiscount?.(row.item.id, parseFloat(e.target.value) || 0)}
                                                    className="w-12 h-6 text-center text-xs border-b border-slate-200 focus:border-indigo-500 outline-none bg-transparent"
                                                />
                                            </div>
                                        )}
                                    </td>

                                    {/* Tax (Read Only) */}
                                    <td className="py-1 px-1 text-center border-l border-slate-200">
                                        {row.type === 'filled' && (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>

                                    {/* Subtotal */}
                                    <td className="py-1 px-2 text-center border-l border-slate-200 font-mono font-bold text-indigo-600 bg-slate-50/50">
                                        {row.type === 'filled' && (row.item.price * row.item.qty).toLocaleString()}
                                    </td>

                                    {/* Delete Action */}
                                    <td className="py-1 px-1 text-center">
                                        {row.type === 'filled' && (
                                            <button
                                                onClick={() => removeFromCart(row.item.id)}
                                                className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                tabIndex="-1"
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

            {/* Footer Summary (Simple) */}
            {cartItems.length > 0 && (
                <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
                    <span className="text-slate-500 text-xs font-medium">
                        {cartItems.length} صنف في السلة
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-600">المجموع</span>
                        <span className="text-xl font-black text-slate-800 font-mono tracking-tight">
                            {subtotal?.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{currency}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
