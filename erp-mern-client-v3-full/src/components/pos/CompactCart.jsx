import React from 'react'
import { AnimatePresence } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'
import { CompactCartItem } from './CompactCartItem'

/**
 * CompactCart - Horizontal Scrolling Cart
 * 
 * Displays cart items in a horizontal scrollable bar
 * Height: ~120px
 */
export const CompactCart = ({ cartItems, updateQty, removeFromCart }) => {
    return (
        <div className="h-[120px] bg-slate-50 border-b-2 border-slate-200 px-6 py-3 shrink-0">
            <div className="flex items-center gap-2 mb-2">
                <ShoppingCart size={18} className="text-slate-600" />
                <h3 className="font-bold text-sm text-slate-700">
                    السلة ({cartItems.length})
                </h3>
            </div>

            {cartItems.length === 0 ? (
                <div className="h-[70px] flex items-center justify-center text-slate-400 text-sm">
                    لم تضف أي منتج بعد
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto scrollbar-hide h-[70px] pb-1">
                    <AnimatePresence mode="popLayout">
                        {cartItems.map(item => (
                            <CompactCartItem
                                key={item.id}
                                item={item}
                                onUpdateQty={updateQty}
                                onRemove={removeFromCart}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}
