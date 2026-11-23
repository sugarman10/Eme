import React from 'react'
import {
    Search,
    Grid3x3,
    Table,
    Maximize2,
    Minimize2,
    Package,
    Barcode,
    FileText,
    Zap
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency } from '../../lib/utils'
import { INVOICE_TYPES } from '../../constants/posConstants'

/**
 * PosHeader - Master Cashier Top Bar
 * 
 * Features:
 * - Instant barcode / product search with dropdown
 * - View mode switcher (Split Touch Grid vs Fast Table)
 * - Fullscreen toggle
 * - Customer selection & cashier action shortcuts
 * - Invoice type badge / switcher (Official vs Proforma)
 */
export const PosHeader = ({
    searchTerm,
    onSearchChange,
    searchResults = [],
    onQuickAdd,
    searchInputRef,
    viewMode = 'split',
    setViewMode,
    isFullscreen = false,
    toggleFullscreen,
    invoiceType,
    setInvoiceType,
    // Slots for flexibility
    customerSection,
    actionsSection
}) => {
    const isProforma = invoiceType === INVOICE_TYPES.PROFORMA

    return (
        <header className="shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-30 shadow-xs transition-colors">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2">

                {/* 1. RIGHT SIDE (RTL): Fast Product & Barcode Search */}
                <div className="relative flex-1 max-w-lg min-w-[260px]">
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center gap-1">
                        <Search size={17} />
                    </div>

                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="امسح الباركود أو ابحث عن صنف... (اضغط /)"
                        className="w-full h-10 pr-10 pl-16 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all font-medium shadow-xs"
                    />

                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-slate-200/70 dark:bg-slate-700/70 rounded border border-slate-300 dark:border-slate-600">
                            /
                        </kbd>
                    </div>

                    {/* Quick Search Autocomplete Flyout */}
                    {searchResults.length > 0 && (
                        <div className="absolute top-full right-0 left-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 max-h-[65vh] overflow-y-auto p-1.5 animate-in fade-in slide-in-from-top-1">
                            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-100 dark:border-slate-700/60 mb-1 flex items-center justify-between">
                                <span>نتائج البحث ({searchResults.length})</span>
                                <span className="text-[10px] font-mono">انقر للإضافة الفورية للسلة</span>
                            </div>

                            <div className="space-y-1">
                                {searchResults.map(product => (
                                    <button
                                        key={product._id || product.id}
                                        type="button"
                                        onClick={() => onQuickAdd(product)}
                                        className="w-full flex items-center gap-3 p-2.5 hover:bg-primary-50/70 dark:hover:bg-slate-700/60 rounded-xl transition-colors text-right border border-transparent hover:border-primary-200 dark:hover:border-primary-800 group"
                                    >
                                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-slate-200/60 dark:border-slate-600">
                                            {product.image ? (
                                                <img src={product.image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Package size={18} className="text-slate-400" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs sm:text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                                {product.name}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {product.sku || product.barcode || 'بدون كود'}
                                                </span>
                                                {product.category && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                        {typeof product.category === 'object' ? (product.category?.name || '') : product.category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-left shrink-0">
                                            <div className="font-black text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                                                {formatCurrency(product.price)}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. CUSTOMER SELECTION SLOT */}
                {customerSection && (
                    <div className="hidden lg:block w-72 shrink-0">
                        {customerSection}
                    </div>
                )}

                {/* 4. VIEW MODE SWITCHER (Fast Invoice vs Split Grid vs Fast Table) */}
                {setViewMode && (
                    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('fast')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'fast'
                                ? 'bg-[#24357a] text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            title="واجهة البيع النقدي السريع"
                        >
                            <Zap size={14} className={viewMode === 'fast' ? 'text-amber-300' : 'text-amber-500'} />
                            <span>بيع نقدي</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('split')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'split'
                                ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            title="نقطة بيع خاصة بالعملاء والآجل والحسابات"
                        >
                            <Grid3x3 size={15} />
                            <span className="hidden md:inline">مبيعات (عملاء)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${viewMode === 'table'
                                ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            title="عرض جدول سريع: ماسح الباركود وإدخال إكسيل"
                        >
                            <Table size={15} />
                            <span className="hidden md:inline">جدول باركود</span>
                        </button>
                    </div>
                )}

                {/* 5. ACTIONS SECTION SLOT (Held Bills, Hold, History) */}
                {actionsSection && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        {actionsSection}
                    </div>
                )}

                {/* 6. FULLSCREEN BUTTON */}
                {toggleFullscreen && (
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs shrink-0"
                        title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة للكاشير'}
                    >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                )}
            </div>
        </header>
    )
}
