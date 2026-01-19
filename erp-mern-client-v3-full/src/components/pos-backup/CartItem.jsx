import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Plus, Minus, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { animations } from '../../lib/posDesignTokens'

/**
 * CartItem - Individual Cart Item with Micro-Interactions
 * 
 * Features:
 * - Slide in/out delete button on hover
 * - Quantity controls with animations
 * - Image with fallback
 * - Line-clamp for long names
 * - Mono font for financial numbers
 */
export const CartItem = React.memo(({ item, onUpdateQty, onRemove }) => {
    return (
        <motion.div
            layout
            initial={animations.slideIn.initial}
            animate={animations.slideIn.animate}
            exit={animations.slideIn.exit}
            className="flex gap-3 items-center p-3 min-h-[88px] border border-slate-100 rounded-2xl bg-white shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 group relative overflow-hidden"
        >
            {/* Delete Button - Slide in on hover */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onRemove(item.id)}
                className="absolute left-0 top-0 bottom-0 w-12 bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300 transform -translate-x-full group-hover:translate-x-0 z-20"
                title="حذف"
            >
                <Trash2 size={20} strokeWidth={2} />
            </motion.button>

            {/* Thumbnail */}
            <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100 relative group-hover:ml-12 transition-all duration-300 shadow-inner">
                {item.image ? (
                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Package size={24} strokeWidth={1.5} />
                    </div>
                )}
            </div>

            {/* Item Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                <div
                    className="font-bold text-sm text-slate-800 line-clamp-2 leading-tight group-hover:text-primary transition-colors duration-300"
                    title={item.name}
                >
                    {item.name}
                </div>

                <div className="flex items-end justify-between mt-1">
                    <div className="flex flex-col">
                        {/* Total Price */}
                        <div className="font-bold text-sm text-emerald-600 font-mono tabular-nums tracking-tight">
                            {formatCurrency(item.price * item.qty)}
                        </div>
                        {/* Unit Price */}
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 tabular-nums">
                            <span>{item.qty}</span>
                            <span>×</span>
                            <span>{formatCurrency(item.price)}</span>
                        </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200 h-7 shadow-sm">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white hover:text-emerald-600 hover:shadow-sm transition-all text-slate-400"
                            onClick={() => onUpdateQty(item.id, item.qty + 1)}
                        >
                            <Plus size={14} strokeWidth={2.5} />
                        </motion.button>
                        <span className="w-7 text-center font-bold text-sm text-slate-700 font-mono tabular-nums">
                            {item.qty}
                        </span>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white hover:text-red-600 hover:shadow-sm transition-all text-slate-400"
                            onClick={() => onUpdateQty(item.id, item.qty - 1)}
                        >
                            <Minus size={14} strokeWidth={2.5} />
                        </motion.button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
})

CartItem.displayName = 'CartItem'
