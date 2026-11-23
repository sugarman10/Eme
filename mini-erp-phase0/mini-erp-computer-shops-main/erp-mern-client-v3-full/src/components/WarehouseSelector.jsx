import { Warehouse, ChevronDown, Check, Lock } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useWarehouse } from '../context/WarehouseContext'
import { useAuth } from '../context/AuthContext'

export function WarehouseSelector() {
    const { warehouses, selectedWarehouseId, currentWarehouse, selectWarehouse, loading, isWarehouseLocked } = useWarehouse()
    const { me } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    // Set default warehouse from assignedWarehouse if none selected yet
    useEffect(() => {
        if (me?.assignedWarehouse && warehouses.length > 0 && !selectedWarehouseId) {
            const assignedId = me.assignedWarehouse._id || me.assignedWarehouse
            selectWarehouse(assignedId)
        }
    }, [me, warehouses, selectedWarehouseId, selectWarehouse])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse">
                <Warehouse size={18} className="text-slate-400" />
                <span className="text-sm text-slate-500">جاري التحميل...</span>
            </div>
        )
    }

    if (warehouses.length === 0) {
        return null
    }

    // If locked to a single warehouse/branch, show locked indicator
    if (isWarehouseLocked) {
        return (
            <div 
                className="flex items-center gap-1.5 2xl:gap-2 h-9 px-2 2xl:px-3 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/70 rounded-xl text-[11px] 2xl:text-xs font-bold text-purple-900 dark:text-purple-200 shadow-2xs select-none"
                title="الفرع / المخزن المخصص لحسابك (مغلق للتعديل)"
            >
                <div className="p-1 rounded-md bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                    <Warehouse size={13} />
                </div>
                <span className="whitespace-nowrap max-w-[70px] 2xl:max-w-[110px] truncate">
                    {currentWarehouse?.name || warehouses[0]?.name || 'المخزن المخصص'}
                </span>
                <Lock size={10} className="text-purple-500 dark:text-purple-400 shrink-0" />
            </div>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 2xl:gap-2 h-9 px-2 2xl:px-3 bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/70 rounded-xl text-[11px] 2xl:text-xs font-bold text-emerald-900 dark:text-emerald-200 transition-all duration-150 shadow-2xs select-none cursor-pointer"
                title="المخزن النشط - اضغط لاختيار مخزن آخر"
            >
                <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                    <Warehouse size={13} />
                </div>
                <span className="whitespace-nowrap max-w-[70px] 2xl:max-w-[110px] truncate">
                    {currentWarehouse?.name || 'اختر مخزن'}
                </span>
                <ChevronDown size={12} className={`text-emerald-600 dark:text-emerald-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">اختر المخزن النشط</p>
                        <Warehouse size={15} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50 p-1">
                        {warehouses.map((warehouse) => (
                            <button
                                key={warehouse._id}
                                type="button"
                                onClick={() => {
                                    selectWarehouse(warehouse._id)
                                    setIsOpen(false)
                                }}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-colors cursor-pointer text-right ${
                                    warehouse._id === selectedWarehouseId 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200' 
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        warehouse._id === selectedWarehouseId 
                                            ? 'bg-emerald-600 text-white shadow-xs' 
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                    }`}>
                                        <Warehouse size={15} />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{warehouse.name}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">{warehouse.code}</span>
                                    </div>
                                </div>
                                {warehouse._id === selectedWarehouseId && (
                                    <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mr-1" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
