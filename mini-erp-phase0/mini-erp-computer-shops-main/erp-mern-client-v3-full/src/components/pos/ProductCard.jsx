import React from 'react'
import { motion } from 'framer-motion'
import { Package, Plus, AlertCircle, Layers } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

/**
 * ProductCard V3 - Clean & Clear Edition
 * 
 * Features:
 * - Clear image display (square aspect ratio)
 * - Visible product name and price
 * - Clean stock indicator
 * - Allows adding even if stock is 0 (negative stock / proforma support)
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
        })?.qty ?? 0)
        : (product.stock ?? 0)

    const isOutOfStock = warehouseStock <= 0
    const price = salesMode === 'wholesale' ? product.wholesalePrice : product.price
    const isLowStock = warehouseStock > 0 && warehouseStock < 10

    return (
        <motion.div
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onAdd(product)}
            className={`group cursor-pointer bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border transition-all duration-200 relative select-none shadow-xs hover:shadow-lg ${isOutOfStock
                    ? 'border-amber-200/80 dark:border-slate-700 hover:border-amber-400'
                    : 'border-slate-200/80 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-primary-500/5'
                }`}
        >
            {/* Image Container */}
            <div className="relative aspect-square bg-slate-50 dark:bg-slate-900/60 overflow-hidden">
                {product.image ? (
                    <img
                        src={getImageUrl(product.image)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                        <Package size={44} className="text-slate-300 dark:text-slate-600" strokeWidth={1.5} />
                    </div>
                )}

                {/* Subtle Hover Action Overlay */}
                <div className="absolute inset-0 bg-primary-950/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/95 dark:bg-slate-900/95 text-primary-600 dark:text-primary-400 font-bold px-3 py-1.5 rounded-full shadow-lg text-xs flex items-center gap-1.5 border border-primary-200/50">
                        <Plus size={14} className="stroke-[3]" /> إضافة
                    </div>
                </div>

                {/* Bundle Badge */}
                {product.isBundle && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[10px] font-black shadow-sm backdrop-blur-md border bg-indigo-600/90 text-white border-indigo-400 flex items-center gap-1">
                        <Layers size={11} />
                        تجميعة
                    </div>
                )}

                {/* Stock Badge */}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-black shadow-sm backdrop-blur-md border ${warehouseStock <= 0
                        ? 'bg-rose-600/90 text-white border-rose-500'
                        : isLowStock
                            ? 'bg-amber-500/90 text-white border-amber-400'
                            : 'bg-emerald-600/90 text-white border-emerald-500'
                    }`}
                >
                    {warehouseStock <= 0 ? `رصيد: ${warehouseStock}` : `متبقي: ${warehouseStock}`}
                </div>

                {/* SKU Pill */}
                {(product.sku || product.barcode) && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-slate-900/60 backdrop-blur-md text-[9px] font-mono text-white/90">
                        {product.sku || product.barcode}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-3 flex flex-col justify-between">
                <h3
                    className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug mb-2 min-h-[2.4em] group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                    title={product.name}
                >
                    {product.name}
                </h3>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="flex flex-col">
                        <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                            {formatCurrency(price)}
                        </span>
                        {salesMode === 'wholesale' && product.price !== product.wholesalePrice && (
                            <span className="text-[10px] text-slate-400 line-through font-mono">
                                {formatCurrency(product.price)}
                            </span>
                        )}
                    </div>

                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 group-hover:bg-primary-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
                        <Plus size={16} strokeWidth={2.5} />
                    </div>
                </div>
            </div>
        </motion.div>
    )
})

ProductCard.displayName = 'ProductCard'
