import React from 'react'
import { Search, Filter } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ProductCard } from './ProductCard'

/**
 * ProductGrid - Product Catalog with Search & Filter
 * 
 * Features:
 * - Auto-focus search
 * - Category filtering with pill buttons
 * - Responsive grid
 * - Loading states
 * - Empty state
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
        <div className="flex flex-col gap-4 h-full overflow-hidden">
            <div className="flex-shrink-0 p-4 border-b flex flex-col gap-4 bg-card rounded-t-xl">
                {/* Search & Filter */}
                <div className="flex gap-3">
                    <Button variant="secondary" size="icon" className="shrink-0 w-10">
                        <Filter size={18} />
                    </Button>
                    <div className="relative flex-1">
                        <Search
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            size={18}
                        />
                        <Input
                            className="pr-14 bg-muted border-transparent focus:bg-white transition-all"
                            placeholder="بحث سريع عن منتج..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Category Pills */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <Button
                        variant={!selectedCategory ? "default" : "secondary"}
                        size="sm"
                        className="rounded-full px-6"
                        onClick={() => setSelectedCategory('')}
                    >
                        الكل
                    </Button>
                    {categories.map(cat => (
                        <Button
                            key={cat}
                            variant={selectedCategory === cat ? "default" : "secondary"}
                            size="sm"
                            className="rounded-full px-6 whitespace-nowrap"
                            onClick={() => setSelectedCategory(cat)}
                        >
                            {cat}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Product Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 bg-muted min-h-0">
                {loadingProducts ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <div className="animate-spin mb-4 w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                        <p>جاري تحميل المنتجات...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
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

                        {filteredProducts.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <Search size={48} className="mb-4 opacity-20" />
                                <p>لا توجد منتجات مطابقة للبحث</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
