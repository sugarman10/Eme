import React from 'react'
import { Search, History, Archive, Package, UserCircle2, ChevronDown } from 'lucide-react'
import { CustomerSelector } from './CustomerSelector'

/**
 * PosHeader - Top Bar with Search & Quick Actions
 * 
 * Features:
 * - Search bar (60%)
 * - Customer selector
 * - Quick action buttons (Hold, Held Bills, History)
 */
export const PosHeader = ({
    query,
    setQuery,
    customerSearch,
    setCustomerSearch,
    filteredCustomers,
    customerId,
    setCustomerId,
    customers,
    setShowAddCustomer,
    salesMode,
    setSalesMode,
    handleHoldBill,
    setShowHeldBills,
    heldBills,
    setShowHistory,
    cartItems
}) => {
    const selectedCustomer = customerId ? customers.find(c => c._id === customerId) : null

    return (
        <div className="h-[70px] bg-white border-b-2 border-slate-200 px-6 flex items-center gap-4 shrink-0">
            {/* Search Bar - 50% */}
            <div className="flex-1 max-w-xl relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="🔍 ابحث عن منتج..."
                    className="w-full h-12 pr-12 pl-4 rounded-xl border-2 border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition-all text-base font-medium"
                    autoFocus
                />
            </div>

            {/* Customer Selector - Compact */}
            <div className="w-48">
                <CustomerSelector
                    customerSearch={customerSearch}
                    setCustomerSearch={setCustomerSearch}
                    filteredCustomers={filteredCustomers}
                    customerId={customerId}
                    setCustomerId={setCustomerId}
                    customers={customers}
                    setShowAddCustomer={setShowAddCustomer}
                    salesMode={salesMode}
                    setSalesMode={setSalesMode}
                />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
                {/* Hold Bill */}
                <button
                    onClick={handleHoldBill}
                    disabled={!cartItems.length}
                    className="h-12 px-4 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 font-bold text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Archive size={18} />
                    تعليق
                </button>

                {/* Held Bills */}
                <button
                    onClick={() => setShowHeldBills(true)}
                    className="relative h-12 px-4 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 font-bold text-sm text-slate-700"
                >
                    <Package size={18} />
                    معلقة
                    {heldBills.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs font-black rounded-full flex items-center justify-center">
                            {heldBills.length}
                        </span>
                    )}
                </button>

                {/* History */}
                <button
                    onClick={() => setShowHistory(true)}
                    className="h-12 px-4 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2 font-bold text-sm text-slate-700"
                >
                    <History size={18} />
                    سجل
                </button>
            </div>
        </div>
    )
}
