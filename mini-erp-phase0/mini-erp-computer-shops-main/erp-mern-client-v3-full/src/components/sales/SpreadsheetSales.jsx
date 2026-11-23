import React, { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Search, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

/**
 * SpreadsheetSales - Excel/Ledger Style for Sales Invoices
 * 
 * Features:
 * - Fixed number of visible rows (like spreadsheet)
 * - Autocomplete suggestions when typing code
 * - Type product code in الرمز column to add
 * - Editable qty and price columns
 * - Stock availability display
 * - Customer type pricing (wholesale/retail)
 */
export const SpreadsheetSales = ({
    rows,
    items,
    warehouse,
    stockMap,
    customer,
    customers,
    onAddRow,
    onUpdateRow,
    onRemoveRow,
    currency = 'د.ل'
}) => {
    const VISIBLE_ROWS = 10
    const MAX_SUGGESTIONS = 6
    const [skuInputs, setSkuInputs] = useState({})
    const [activeRow, setActiveRow] = useState(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const inputRefs = useRef({})

    // Get available stock for an item in warehouse
    const getAvailableStock = (item) => {
        if (!warehouse) return item.totalStock || 0
        const stockEntry = item.stocks?.find(s =>
            (s.warehouse._id || s.warehouse).toString() === warehouse.toString()
        )
        return stockEntry ? stockEntry.qty : 0
    }

    // Determine price based on customer type
    const getPriceForCustomer = (item) => {
        const selectedCustomer = customers?.find(c => c._id === customer)
        const isWholesale = selectedCustomer?.type === 'wholesale'
        if (isWholesale) {
            return item.wholesalePrice || item.price || 0
        }
        return item.price || item.retailPrice || 0
    }

    // Filter products based on input
    const getSuggestions = (rowIndex) => {
        const query = (skuInputs[rowIndex] || '').trim().toLowerCase()
        if (!query || query.length < 1 || !items) return []

        return items.filter(p => {
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
        const price = getPriceForCustomer(product)
        const cost = Number(product.cost) || 0

        if (onAddRow) {
            onAddRow({
                item: product._id,
                name: product.name,
                sku: product.sku || product.barcode,
                qty: 1,
                price: Number(price),
                cost: cost,
                searchTerm: `${product.sku} — ${product.name}`,
                showDropdown: false
            })
        }
        setSkuInputs(prev => ({ ...prev, [rowIndex]: '' }))
        setActiveRow(null)
        // Focus next empty row
        setTimeout(() => {
            const nextRow = rows.filter(r => r.item).length + 1
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
        return rows.reduce((sum, row) => sum + ((row.qty || 0) * (row.price || 0)), 0)
    }, [rows])

    // Generate display rows (filled + empty)
    const filledRows = rows.filter(r => r.item)
    const displayRows = []

    filledRows.forEach((row, index) => {
        displayRows.push({ type: 'filled', index: index + 1, row, rowIndex: index })
    })

    for (let i = filledRows.length; i < Math.max(VISIBLE_ROWS, filledRows.length + 3); i++) {
        displayRows.push({ type: 'empty', index: i + 1, emptyIndex: i })
    }

    return (
        <div className="flex flex-col bg-white overflow-hidden border-2 border-slate-300 rounded-xl shadow-sm">
            {/* Spreadsheet Table */}
            <div className="overflow-y-auto max-h-[450px]">
                <table className="w-full border-collapse" style={{ direction: 'rtl' }}>
                    {/* Header Row */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-gradient-to-b from-indigo-500 to-indigo-600 text-white text-sm font-bold">
                            <th className="py-3 px-2 text-center border-l border-indigo-400 w-12">#</th>
                            <th className="py-3 px-3 text-center border-l border-indigo-400 w-36">الرمز / الباركود</th>
                            <th className="py-3 px-3 text-center border-l border-indigo-400 min-w-[220px]">اسم الصنف</th>
                            <th className="py-3 px-2 text-center border-l border-indigo-400 w-24">المتاح</th>
                            <th className="py-3 px-2 text-center border-l border-indigo-400 w-24">الكمية</th>
                            <th className="py-3 px-3 text-center border-l border-indigo-400 w-28">السعر</th>
                            <th className="py-3 px-3 text-center border-l border-indigo-400 w-32">الإجمالي</th>
                            <th className="py-3 px-2 text-center w-12">حذف</th>
                        </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody>
                        {displayRows.map((displayRow, idx) => {
                            const suggestions = displayRow.type === 'empty' ? getSuggestions(displayRow.emptyIndex) : []
                            const showDropdown = activeRow === displayRow.emptyIndex && suggestions.length > 0

                            // For filled rows, get stock info
                            let stockInfo = null
                            let isStockError = false
                            if (displayRow.type === 'filled') {
                                const itemObj = items.find(it => it._id === displayRow.row.item)
                                if (itemObj) {
                                    stockInfo = getAvailableStock(itemObj)
                                    isStockError = displayRow.row.qty > stockInfo
                                }
                            }

                            return (
                                <tr
                                    key={idx}
                                    className={`
                                        border-b border-slate-200 transition-colors
                                        ${displayRow.type === 'filled' ? (isStockError ? 'bg-red-50' : 'bg-indigo-50/30 hover:bg-indigo-100/50') : 'hover:bg-slate-50'}
                                        ${idx % 2 === 0 ? 'bg-slate-50/30' : ''}
                                    `}
                                >
                                    {/* Row Number */}
                                    <td className="py-3 px-2 text-center border-l border-slate-200 text-slate-500 text-sm font-mono font-bold">
                                        {displayRow.index}
                                    </td>

                                    {/* Product Code - الرمز (Editable with Autocomplete) */}
                                    <td className="py-2 px-2 border-l border-slate-200 relative">
                                        {displayRow.type === 'filled' ? (
                                            <span className="text-slate-700 text-sm font-mono bg-slate-100 px-3 py-1.5 rounded-lg block text-center font-bold">
                                                {displayRow.row.sku || '-'}
                                            </span>
                                        ) : (
                                            <div className="relative">
                                                <input
                                                    ref={el => inputRefs.current[displayRow.emptyIndex] = el}
                                                    type="text"
                                                    value={skuInputs[displayRow.emptyIndex] || ''}
                                                    onChange={(e) => handleSkuChange(displayRow.emptyIndex, e.target.value)}
                                                    onKeyDown={(e) => handleSkuKeyDown(e, displayRow.emptyIndex)}
                                                    onFocus={() => setActiveRow(displayRow.emptyIndex)}
                                                    onBlur={() => handleBlur(displayRow.emptyIndex)}
                                                    placeholder="🔍 اكتب للبحث..."
                                                    className="w-full h-10 px-3 text-sm text-center border-2 border-dashed border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-indigo-50/50 hover:bg-white transition-colors"
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
                                                            style={{ minWidth: '320px' }}
                                                        >
                                                            {suggestions.map((product, i) => {
                                                                const prodStock = getAvailableStock(product)
                                                                return (
                                                                    <div
                                                                        key={product._id || i}
                                                                        onMouseDown={(e) => {
                                                                            e.preventDefault()
                                                                            handleSelectSuggestion(product, displayRow.emptyIndex)
                                                                        }}
                                                                        className={`
                                                                            px-3 py-2.5 cursor-pointer flex items-center gap-2 border-b border-slate-100 last:border-0
                                                                            ${i === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}
                                                                        `}
                                                                    >
                                                                        <div className="flex-1 text-right">
                                                                            <div className="text-sm font-bold text-slate-700 truncate">
                                                                                {product.name}
                                                                            </div>
                                                                            <div className="text-xs text-slate-400 font-mono">
                                                                                {product.sku || product.barcode || '-'}
                                                                            </div>
                                                                        </div>
                                                                        <div className={`text-xs font-bold px-2 py-1 rounded-full ${prodStock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                            {prodStock > 0 ? `${prodStock} متاح` : 'نفذ'}
                                                                        </div>
                                                                        <div className="text-sm font-bold text-indigo-600 font-mono shrink-0 bg-indigo-50 px-2 py-1 rounded">
                                                                            {getPriceForCustomer(product).toLocaleString()} {currency}
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
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
                                        {displayRow.type === 'filled' ? (
                                            <span className="text-slate-800 font-bold text-base truncate block">
                                                {displayRow.row.name || displayRow.row.searchTerm?.split('—')[1]?.trim() || '-'}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-sm">—</span>
                                        )}
                                    </td>

                                    {/* Available Stock - المتاح */}
                                    <td className="py-2 px-2 border-l border-slate-200 text-center">
                                        {displayRow.type === 'filled' ? (
                                            <span className={`text-sm font-bold px-2 py-1 rounded-full ${stockInfo > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {stockInfo || 0}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-sm">-</span>
                                        )}
                                    </td>

                                    {/* Quantity - الكمية */}
                                    <td className="py-2 px-2 border-l border-slate-200">
                                        {displayRow.type === 'filled' ? (
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={displayRow.row.qty || 1}
                                                    onChange={(e) => onUpdateRow(displayRow.rowIndex, 'qty', parseInt(e.target.value) || 1)}
                                                    className={`w-full h-10 text-center text-base font-bold border-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${isStockError ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 bg-white'}`}
                                                />
                                                {isStockError && (
                                                    <div className="absolute -bottom-4 left-0 right-0 text-[9px] font-bold text-red-500 text-center">
                                                        max: {stockInfo}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-sm block text-center">-</span>
                                        )}
                                    </td>

                                    {/* Price - السعر */}
                                    <td className="py-2 px-2 border-l border-slate-200">
                                        {displayRow.type === 'filled' ? (
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={displayRow.row.price || 0}
                                                onChange={(e) => onUpdateRow(displayRow.rowIndex, 'price', parseFloat(e.target.value) || 0)}
                                                className="w-full h-10 text-center text-base font-mono border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                            />
                                        ) : (
                                            <span className="text-slate-300 text-sm block text-center">-</span>
                                        )}
                                    </td>

                                    {/* Total - الإجمالي */}
                                    <td className="py-2 px-3 border-l border-slate-200 text-center">
                                        {displayRow.type === 'filled' ? (
                                            <span className="font-black text-lg text-indigo-600 font-mono">
                                                {formatCurrency((displayRow.row.qty || 0) * (displayRow.row.price || 0))}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300 text-sm">-</span>
                                        )}
                                    </td>

                                    {/* Delete */}
                                    <td className="py-2 px-2 text-center">
                                        {displayRow.type === 'filled' && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveRow(displayRow.rowIndex)}
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
            <div className="border-t-2 border-indigo-300 bg-gradient-to-b from-indigo-100 to-indigo-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="text-base text-slate-700">
                        عدد الأصناف: <span className="font-black text-indigo-600 text-xl">{filledRows.length}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <span className="text-base font-bold text-slate-600">إجمالي الفاتورة:</span>
                        <span className="text-3xl font-black text-indigo-700 font-mono bg-white px-4 py-2 rounded-xl shadow-inner border-2 border-indigo-300">
                            {formatCurrency(total)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SpreadsheetSales
