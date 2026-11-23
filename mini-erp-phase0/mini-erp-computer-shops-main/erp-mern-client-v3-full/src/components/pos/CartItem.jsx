import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Plus, Minus, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { animations, components } from '../../lib/posDesignTokens'

/**
 * CartItem V3 - Ledger Row Style
 * 
 * Features:
 * - Clean ledger/table row format
 * - Bordered cells
 * - Compact quantity controls
 * - Click name to delete
 */
export const CartItem = React.memo(({ item, index, onUpdateQty, onRemove }) => {
    return (
        <motion.tr
            layout
            initial={{ opacity: 0, backgroundColor: '#dcfce7' }}
            animate={{ opacity: 1, backgroundColor: '#ffffff' }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="group hover:bg-indigo-50/40 transition-colors"
        >
            {/* Row Number */}
            <td className="py-2.5 px-1 align-middle text-center border-l border-slate-100">
                <span className="text-[11px] text-slate-500 font-mono font-bold">{index}</span>
            </td>

            {/* Product Code/SKU */}
            <td className="py-2.5 px-2 align-middle text-center border-l border-slate-100">
                <span className="text-[10px] text-slate-500 font-mono truncate block bg-slate-50 rounded px-1 py-0.5">
                    {item.sku || item.barcode || '-'}
                </span>
            </td>

            {/* Product Name */}
            <td className="py-2.5 px-2 align-middle border-l border-slate-100">
                <div
                    className="font-medium text-[12px] text-slate-700 cursor-pointer hover:text-red-500 transition-colors flex items-center gap-1"
                    title={`${item.name} - انقر للحذف`}
                    onClick={() => onRemove(item.id)}
                >
                    <span className="truncate">{item.name}</span>
                    {item.isBundle && (
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1 rounded font-bold shrink-0">تجميعة</span>
                    )}
                    <Trash2 size={12} className="opacity-0 group-hover:opacity-100 text-red-400 shrink-0" />
                </div>
                {item.isBundle && item.bundleComponents?.length > 0 && (
                    <div className="text-[10px] text-slate-500 mt-0.5 space-y-0.5">
                        {item.bundleComponents.map((c, ci) => (
                            <div key={ci} className="text-[10px] text-slate-600 truncate">
                                └ {c.name || c.item?.name} <span className="font-mono">({c.qty * item.qty}x)</span>
                            </div>
                        ))}
                    </div>
                )}
            </td>

            {/* Quantity Controls */}
            <td className="py-2.5 px-1 align-middle border-l border-slate-100">
                <div className="flex items-center justify-center gap-1">
                    <button
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors"
                        onClick={() => onUpdateQty(item.id, item.qty - 1)}
                        disabled={item.qty <= 1}
                    >
                        <Minus size={12} />
                    </button>
                    <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => onUpdateQty(item.id, parseInt(e.target.value) || 1)}
                        className="w-10 h-6 text-center font-bold text-[12px] text-slate-800 font-mono border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                        min="1"
                    />
                    <button
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600 transition-colors"
                        onClick={() => onUpdateQty(item.id, item.qty + 1)}
                    >
                        <Plus size={12} />
                    </button>
                </div>
            </td>

            {/* Price */}
            <td className="py-2.5 px-2 align-middle text-left">
                <span className="font-bold text-[12px] text-emerald-600 font-mono">
                    {formatCurrency(item.price * item.qty)}
                </span>
            </td>
        </motion.tr>
    )
})

CartItem.displayName = 'CartItem'

