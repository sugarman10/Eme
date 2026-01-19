import React from 'react'
import { Search, Grid3x3, LayoutGrid } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ProductCard } from './ProductCard'

/**
 * ProductGrid V2 - Enhanced Catalog
 * 
 * Features:
 * - Larger search bar
 * - Category tabs with underline
 * - Better empty states
 * - Responsive grid (3-7 columns)
 */
export const ProductGrid = ({
    query,
    setQuery,
    selectedCategory,
    setSelectedCategory,
    categories,
    filteredProducts,
    loadingProducts,
    addToCart,
    selectedWarehouseId,
    salesMode,
    getImageUrl
}) => {
    return (
        <div className="flex flex-col gap-4 h-full overflow-hidden bg-gradient-to-br from-slate-50 to-white rounded-2xl">
            {/* Header with Search */}
            <div className="shrink-0 p-5 border-b-2 border-slate-100 bg-white/80 backdrop-blur-sm">
                {/* Search Bar - Larger and more prominent */}
                <div className="relative mb-4">
                    <Search
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                        size={22}
                    />
                    <Input
                        className="pr-14 h-14 text-base bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm hover:border-slate-300 placeholder:text-slate-400"
                        placeholder="ابحث عن منتج بالاسم أو الكود..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                    {query && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                            {filteredProducts.length} نتيجة
                        </div>
                    )}
                </div>

                {/* Category Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Button
                        variant={!selectedCategory ? "default" : "secondary"}
                        size="sm"
                        className={`rounded-full px-6 font-bold transition-all ${!selectedCategory
                                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                : 'bg-white border-2 border-slate-200 hover:border-indigo-300'
                            }`}
                        onClick={() => setSelectedCategory('')}
                    >
                        <Grid3x3 size={14} className="ml-1" />
                        الكل
                    </Button>
                    {categories.map(cat => (
                        <Button
                            key={cat}
                            variant={selectedCategory === cat ? "default" : "secondary"}
                            size="sm"
                            className={`rounded-full px-6 whitespace-nowrap font-bold transition-all ${selectedCategory === cat
                                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                                    : 'bg-white border-2 border-slate-200 hover:border-indigo-300'
                                }`}
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Product Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0">
                {loadingProducts ? (
                    <div className="h-full flex flex-col items-center justify-center">
                        <div className="relative">
                            <div className="animate-spin mb-6 w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
                            <LayoutGrid className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400" size={24} />
                        </div>
                        <p className="text-slate-500 font-medium">جاري تحميل المنتجات...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <Search size={40} className="text-slate-300" />
                        </div>
                        <p className="text-lg font-bold text-slate-500 mb-2">لا توجد منتجات</p>
                        <p className="text-sm text-slate-400">
                            {query ? 'جرب البحث بكلمات مختلفة' : 'لا يوجد منتجات في هذا التصنيف'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                        {filteredProducts.map(product => (
                            <ProductCard
                                key={product.id}
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
