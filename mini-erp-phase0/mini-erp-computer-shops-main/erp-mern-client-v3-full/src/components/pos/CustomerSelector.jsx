import React from 'react'
import { Users, User, UserPlus } from 'lucide-react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import api from '../../services/api'

/**
 * CustomerSelector - Customer Search & Selection Widget
 * 
 * Features:
 * - Real-time search with dropdown
 * - Selected customer badge
 * - Walk-in customer toggle
 * - Add customer button
 * - Automatic wholesale detection
 */
export const CustomerSelector = ({
    customerSearch,
    setCustomerSearch,
    customerId,
    setCustomerId,
    filteredCustomers,
    customers,
    setSalesMode,
    setShowAddCustomer,
    push
}) => {
    const handleSelectCustomer = async (customer) => {
        setCustomerId(customer._id)
        setCustomerSearch(customer.name)

        try {
            const { data } = await api.get(`/customers/${customer._id}`)
            if (data.type === 'wholesale') {
                setSalesMode('wholesale')
                push('success', `تم تفعيل أسعار الجملة للعميل: ${customer.name}`)
            } else {
                setSalesMode('retail')
            }
        } catch (e) {
            // Error handled by React Query
        }
    }

    const handleClearCustomer = () => {
        setCustomerId('')
        setCustomerSearch('')
        setSalesMode('retail')
    }

    return (
        <div className="flex items-center gap-1.5 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
                    <Users size={14} />
                </div>
                <input
                    type="text"
                    className="w-full h-10 pr-8 pl-3 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium transition-all shadow-xs"
                    placeholder="بحث عن عميل..."
                    value={customerSearch}
                    onChange={e => {
                        setCustomerSearch(e.target.value)
                        if (e.target.value === '') setCustomerId('')
                    }}
                />

                {/* Dropdown Results */}
                {customerSearch && !customerId && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        {filteredCustomers.length > 0 ? (
                            filteredCustomers.map(c => (
                                <div
                                    key={c._id}
                                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg cursor-pointer transition-colors flex items-center justify-between text-xs"
                                    onClick={() => handleSelectCustomer(c)}
                                >
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-slate-200">{c.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{c.phone || 'بدون هاتف'}</div>
                                    </div>
                                    {c.type === 'wholesale' && (
                                        <span className="text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">جملة</span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-center text-slate-400 text-xs">لم يتم العثور على عميل</div>
                        )}
                    </div>
                )}
            </div>

            {/* Selected Customer Badge OR Walk-in */}
            <div
                onClick={customerId ? handleClearCustomer : undefined}
                className={`h-10 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-bold shrink-0 transition-all select-none ${customerId
                    ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-300 border-primary-200 dark:border-primary-800 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                title={customerId ? 'انقر لإلغاء العميل' : 'عميل نقدي عابر'}
            >
                <User size={14} className={customerId ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'} />
                <span className="max-w-[85px] truncate">
                    {customerId ? (customers.find(c => c._id === customerId)?.name || customerSearch) : 'نقدي'}
                </span>
                {customerId && <span className="text-primary-500 font-bold ml-0.5">×</span>}
            </div>

            {/* Add Customer Button */}
            <button
                type="button"
                onClick={() => setShowAddCustomer(true)}
                className="h-10 w-10 shrink-0 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-700 flex items-center justify-center transition-all shadow-xs"
                title="إضافة عميل جديد"
            >
                <UserPlus size={16} />
            </button>
        </div>
    )
}
