import React from 'react'
import { motion } from 'framer-motion'
import { Package, Minus, Plus, X } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

/**
 * CompactCartItem - Horizontal Cart Item
 * 
 * Compact design for horizontal scrolling cart
 */
export const CompactCartItem = ({ item, onUpdateQty, onRemove }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200 hover:border-violet-300 transition-all min-w-[320px]"
        >
            {/* Image */}
            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                {item.image ? (
                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                ) : (
                    <Package size={20} className="text-slate-400" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-slate-800 truncate" title={item.name}>
                    {item.name}
                </div>
                <div className="text-xs text-slate-500">
                    {formatCurrency(item.price)} × {item.qty}
                </div>
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={() => onUpdateQty(item.id, item.qty - 1)}
                    disabled={item.qty <= 1}
                    className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Minus size={14} />
                </button>
                <div className="w-8 text-center font-bold text-sm">{item.qty}</div>
                <button
                    onClick={() => onUpdateQty(item.id, item.qty + 1)}
                    className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Total */}
            <div className="font-bold text-base text-slate-900 shrink-0 font-mono">
                {formatCurrency(item.price * item.qty)}
            </div>

            {/* Remove */}
            <button
                onClick={() => onRemove(item.id)}
                className="w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shrink-0"
            >
                <X size={16} />
            </button>
        </motion.div>
    )
}
