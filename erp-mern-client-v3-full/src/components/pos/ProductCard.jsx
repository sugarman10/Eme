import React from 'react'
import { motion } from 'framer-motion'
import { Package, Plus, AlertCircle } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

/**
 * ProductCard V3 - Clean & Clear Edition
 * 
 * Features:
 * - Clear image display (square aspect ratio)
 * - Visible product name and price
 * - Clean stock indicator
 * - Simple add button
 */
export const ProductCard = React.memo(({
    product,
    selectedWarehouseId,
    salesMode,
    onAdd,
    getImageUrl
}) => {
    // Get warehouse-specific stock
    const warehouseStock = selectedWarehouseId
        ? (product.stocks?.find(s => {
            const wId = s.warehouse?._id || s.warehouse
            return wId?.toString() === selectedWarehouseId?.toString()
        })?.qty || 0)
        : product.stock

    const isOutOfStock = !selectedWarehouseId || warehouseStock <= 0
    const price = salesMode === 'wholesale' ? product.wholesalePrice : product.price
    const isLowStock = warehouseStock > 0 && warehouseStock < 10

    return (
        <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => !isOutOfStock && onAdd(product)}
            className={`group cursor-pointer bg-white rounded-xl overflow-hidden border-2 shadow-sm transition-all duration-200
                ${isOutOfStock
                    ? 'opacity-50 cursor-not-allowed border-slate-200'
                    : 'border-slate-200 hover:border-indigo-400 hover:shadow-xl'
                }`}
        >
            {/* Image Container - Square */}
            <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
                {product.image ? (
                    <img
                        src={getImageUrl(product.image)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Package size={40} className="text-slate-300" strokeWidth={1.5} />
                    </div>
                )}

                {/* Stock Badge - Bottom Left */}
                <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md
                    ${warehouseStock === 0
                        ? 'bg-slate-500 text-white'
                        : isLowStock
                            ? 'bg-red-500 text-white'
                            : 'bg-emerald-500 text-white'
                    }`}
                >
                    {warehouseStock === 0 ? 'نفذ' : warehouseStock}
                </div>

                {/* Quick Add Overlay on Hover */}
                {!isOutOfStock && (
                    <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/20 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Plus size={24} className="text-indigo-600" strokeWidth={2.5} />
                        </div>
                    </div>
                )}
            </div>

            {/* Content - Name + Price */}
            <div className="p-2.5">
                {/* Product Name */}
                <h3
                    className="font-bold text-xs text-slate-700 line-clamp-2 leading-tight mb-1.5 min-h-[2em]"
                    title={product.name}
                >
                    {product.name}
                </h3>

                {/* Price Row */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-indigo-600 font-mono">
                            {formatCurrency(price)}
                        </span>
                        {salesMode === 'wholesale' && product.price !== product.wholesalePrice && (
                            <span className="text-[10px] text-slate-400 line-through font-mono">
                                {formatCurrency(product.price)}
                            </span>
                        )}
                    </div>

                    {/* Add Button - Small Circle */}
                    {!isOutOfStock && (
                        <motion.div
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shadow-md transition-colors"
                        >
                            <Plus size={16} strokeWidth={3} />
                        </motion.div>
                    )}

                    {/* Out of Stock Icon */}
                    {isOutOfStock && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">
                            <AlertCircle size={14} />
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
})

ProductCard.displayName = 'ProductCard'

