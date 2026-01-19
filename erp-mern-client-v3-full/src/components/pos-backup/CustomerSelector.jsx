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
            console.error(e)
        }
    }

    const handleClearCustomer = () => {
        setCustomerId('')
        setCustomerSearch('')
        setSalesMode('retail')
    }

    return (
        <div className="bg-slate-50/80 p-1.5 rounded-2xl border border-slate-100 transition-all focus-within:bg-white focus-within:border-primary/20 focus-within:shadow-sm focus-within:ring-2 focus-within:ring-primary/5">
            {/* Search Input */}
            <div className="flex gap-2">
                <div className="relative flex-1 group">
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none">
                        <Users size={18} />
                    </div>
                    <Input
                        className="pr-14 h-10 text-sm bg-transparent border-0 focus:ring-0 placeholder:text-slate-400 font-medium"
                        placeholder="بحث عن عميل..."
                        value={customerSearch}
                        onChange={e => {
                            setCustomerSearch(e.target.value)
                            if (e.target.value === '') setCustomerId('')
                        }}
                    />

                    {/* Dropdown Results */}
                    {customerSearch && !customerId && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1">
                            {filteredCustomers.length > 0 ? (
                                filteredCustomers.map(c => (
                                    <div
                                        key={c._id}
                                        className="p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                                        onClick={() => handleSelectCustomer(c)}
                                    >
                                        <div>
                                            <div className="font-bold text-sm text-slate-700 group-hover:text-primary transition-colors">
                                                {c.name}
                                            </div>
                                            <div className="text-xs text-slate-400">{c.phone}</div>
                                        </div>
                                        {c.type === 'wholesale' && (
                                            <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                                جملة
                                            </span>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                                    <User size={24} className="opacity-20" />
                                    <span>لا يوجد عميل بهذا الاسم</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Add Customer Button */}
                <Button
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary hover:bg-primary/5 shadow-sm transition-all"
                    onClick={() => setShowAddCustomer(true)}
                    title="إضافة عميل جديد"
                >
                    <UserPlus size={18} />
                </Button>
            </div>

            {/* Selected Customer Badge - Walk-in vs Named */}
            <div className="flex items-center gap-2 mt-1.5 px-1">
                <div
                    className={`flex-1 text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all duration-200 ${!customerId
                            ? 'bg-white text-slate-600 border-slate-200 shadow-sm'
                            : 'bg-slate-100 text-slate-400 border-transparent hover:bg-white hover:shadow-sm'
                        }`}
                    onClick={handleClearCustomer}
                >
                    <span className="flex items-center gap-1.5">
                        <User size={14} className={!customerId ? "text-primary" : ""} />
                        عميل عابر
                    </span>
                    {!customerId && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    )}
                </div>

                {customerId && (
                    <div className="flex-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/5 text-primary border border-primary/20 flex items-center justify-between shadow-sm">
                        <span className="truncate max-w-[120px]">
                            {customers.find(c => c._id === customerId)?.name}
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    </div>
                )}
            </div>
        </div>
    )
}
