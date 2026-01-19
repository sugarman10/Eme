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
        <div className="flex items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Users size={14} />
                </div>
                <input
                    type="text"
                    className="w-full h-9 pr-8 pl-3 text-xs bg-white border border-slate-200 rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-slate-400 font-medium transition-all"
                    placeholder="بحث عن عميل..."
                    value={customerSearch}
                    onChange={e => {
                        setCustomerSearch(e.target.value)
                        if (e.target.value === '') setCustomerId('')
                    }}
                />

                {/* Dropdown Results */}
                {customerSearch && !customerId && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto p-1">
                        {filteredCustomers.length > 0 ? (
                            filteredCustomers.map(c => (
                                <div
                                    key={c._id}
                                    className="p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors flex items-center justify-between text-xs"
                                    onClick={() => handleSelectCustomer(c)}
                                >
                                    <div>
                                        <div className="font-bold text-slate-700">{c.name}</div>
                                        <div className="text-[10px] text-slate-400">{c.phone}</div>
                                    </div>
                                    {c.type === 'wholesale' && (
                                        <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">جملة</span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-3 text-center text-slate-400 text-xs">لا يوجد عميل</div>
                        )}
                    </div>
                )}
            </div>

            {/* Selected Customer Badge OR Walk-in */}
            <div
                onClick={customerId ? handleClearCustomer : undefined}
                className={`h-9 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-all ${customerId
                    ? 'bg-primary/10 text-primary border-primary/30 cursor-pointer hover:bg-primary/20'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                title={customerId ? 'اضغط لإلغاء العميل' : 'عميل عابر'}
            >
                <User size={14} />
                <span className="max-w-[80px] truncate">
                    {customerId ? customers.find(c => c._id === customerId)?.name : 'عابر'}
                </span>
                {customerId && <span className="text-primary/60">×</span>}
            </div>

            {/* Add Customer Button */}
            <button
                onClick={() => setShowAddCustomer(true)}
                className="h-9 w-9 shrink-0 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5 flex items-center justify-center transition-all"
                title="إضافة عميل جديد"
            >
                <UserPlus size={14} />
            </button>
        </div>
    )
}
