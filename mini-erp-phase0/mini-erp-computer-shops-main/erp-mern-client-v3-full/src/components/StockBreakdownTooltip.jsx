import { useState } from 'react'
import { Info } from 'lucide-react'

export function StockBreakdownTooltip({ item, warehouses = [] }) {
    const [showTooltip, setShowTooltip] = useState(false)

    // Get total stock
    const totalStock = item?.totalStock ?? item?.stock ?? 0

    // Get stocks breakdown
    const stocks = item?.stocks || []

    // If no breakdown available, just show total
    if (stocks.length === 0) {
        return (
            <span className="font-bold text-sm">
                {totalStock}
            </span>
        )
    }

    return (
        <div className="relative inline-block">
            <button
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors group"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <span className={`font-bold text-sm ${totalStock < 5 ? 'text-red-600' : 'text-slate-800'}`}>
                    {totalStock}
                </span>
                <Info size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            {showTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white rounded-lg shadow-xl z-50 p-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="text-xs font-bold mb-2 pb-2 border-b border-slate-700">
                        توزيع المخزون
                    </div>
                    <div className="space-y-2">
                        {stocks.map((stock, index) => {
                            const warehouse = warehouses.find(w => w._id === stock.warehouse)
                            return (
                                <div key={index} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300">
                                        {warehouse?.name || warehouse?.code || 'مخزن غير معروف'}
                                    </span>
                                    <span className={`font-bold ${stock.qty < 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {stock.qty}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-700 flex items-center justify-between text-xs">
                        <span className="text-slate-400">الإجمالي</span>
                        <span className="font-bold text-white">{totalStock}</span>
                    </div>

                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                        <div className="w-2 h-2 bg-slate-900 rotate-45"></div>
                    </div>
                </div>
            )}
        </div>
    )
}
