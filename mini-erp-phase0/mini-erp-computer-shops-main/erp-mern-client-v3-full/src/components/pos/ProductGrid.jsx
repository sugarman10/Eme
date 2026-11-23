import React from 'react'
import { Search, Grid3x3, LayoutGrid, Layers } from 'lucide-react'
import { ProductCard } from './ProductCard'

/**
 * ProductGrid - Modern Retail Catalog
 * 
 * Features:
 * - Sleek category tabs with active count
 * - High-speed instant rendering
 * - Dark mode compatible
 * - Optimized grid density for touch and mouse
 */
export const ProductGrid = ({
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    categories = [],
    filteredProducts = [],
    loadingProducts,
    addToCart,
    selectedWarehouseId,
    salesMode,
    getImageUrl,
    searchInputRef,
    showInternalSearch = false
}) => {
    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* 1. Category Bar Header */}
            <div className="shrink-0 px-3 sm:px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs z-10">
                {showInternalSearch && (
                    <div className="relative mb-2">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            ref={searchInputRef}
                            className="w-full h-9 pr-9 pl-4 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 placeholder:text-slate-400"
                            placeholder="تصفية حسب الاسم أو الرمز..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </div>
                )}

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    <button
                        type="button"
                        onClick={() => setSelectedCategory('')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer select-none ${!selectedCategory
                            ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
                            }`}
                    >
                        <Layers size={13} />
                        <span>كافة الأقسام</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal ${!selectedCategory ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                            {filteredProducts.length}
                        </span>
                    </button>

                    {categories.map(cat => {
                        const catKey = typeof cat === 'object' ? (cat._id || cat.name) : String(cat)
                        const catName = typeof cat === 'object' ? (cat.name || cat._id) : String(cat)
                        const isSelected = selectedCategory === catName || selectedCategory === cat
                        return (
                            <button
                                key={catKey}
                                type="button"
                                onClick={() => setSelectedCategory(catName)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer select-none ${isSelected
                                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60'
                                    }`}
                            >
                                <span>{catName}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 2. Product Grid - Scrollable Container */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 min-h-0 custom-scrollbar">
                {loadingProducts ? (
                    <div className="h-full flex flex-col items-center justify-center min-h-[300px]">
                        <div className="relative">
                            <div className="animate-spin mb-4 w-12 h-12 border-3 border-primary-200 dark:border-primary-950 border-t-primary-600 rounded-full" />
                            <LayoutGrid className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-500 dark:text-primary-400" size={20} />
                        </div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">جاري تحميل كتالوج الأصناف...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-16 min-h-[300px]">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                            <Search size={28} className="text-slate-400 dark:text-slate-500" />
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">لم يتم العثور على أي منتج</p>
                        <p className="text-xs text-slate-400">
                            {query ? 'جرب البحث باسم أو باركود آخر' : 'لا توجد منتجات مسجلة في هذا القسم'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5 pb-8">
                        {filteredProducts.map(product => (
                            <ProductCard
                                key={product._id || product.id}
                                product={product}
                                selectedWarehouseId={selectedWarehouseId}
                                salesMode={salesMode}
                                onAdd={addToCart}
                                getImageUrl={getImageUrl}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
