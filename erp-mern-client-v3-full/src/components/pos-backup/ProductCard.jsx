import React from 'react'
import { motion } from 'framer-motion'
import { Package, Plus } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { animations } from '../../lib/posDesignTokens'

/**
 * ProductCard - Apple-Style Premium Card
 * 
 * Features:
 * - Hover animations with Framer Motion 
 * - Stock badge with color coding
 * - Clean typography
 * - Responsive image handling
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

    return (
        <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={animations.spring}
            onClick={() => onAdd(product)}
            className="group cursor-pointer transition-all flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-white hover:border-primary/50 hover:shadow-lg"
        >
            {/* Image Area */}
            <div className="relative h-24 bg-slate-50 flex items-center justify-center overflow-hidden">
                {product.image ? (
                    <img
                        src={getImageUrl(product.image)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                ) : (
                    <Package size={20} className="text-slate-300" />
                )}

                {/* Stock Badge */}
                <div
                    className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm border ${isOutOfStock
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-white/90 text-slate-700'
                        }`}
                >
                    {warehouseStock}
                </div>
            </div>

            {/* Content Area */}
            <div className="p-2 flex flex-col gap-1">
                <h3
                    className="font-bold text-xs line-clamp-1 text-slate-800 group-hover:text-primary transition-colors"
                    title={product.name}
                >
                    {product.name}
                </h3>

                <div className="flex justify-between items-end">
                    <div className="font-bold text-sm text-primary font-mono tabular-nums">
                        {formatCurrency(price)}
                    </div>
                    <motion.div
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        transition={{ type: 'spring', stiffness: 400 }}
                        className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors"
                    >
                        <Plus size={14} />
                    </motion.div>
                </div>
            </div>
        </motion.div>
    )
})

ProductCard.displayName = 'ProductCard'
