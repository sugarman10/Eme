import { Warehouse, ChevronDown, Check, Lock } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useWarehouse } from '../context/WarehouseContext'
import { useAuth } from '../context/AuthContext'

export function WarehouseSelector() {
    const { warehouses, selectedWarehouseId, currentWarehouse, selectWarehouse, loading } = useWarehouse()
    const { me } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    // Force lock if assigned
    useEffect(() => {
        if (me?.assignedWarehouse && warehouses.length > 0) {
            const assignedId = me.assignedWarehouse._id || me.assignedWarehouse
            if (selectedWarehouseId !== assignedId) {
                selectWarehouse(assignedId)
            }
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
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg animate-pulse">
                <Warehouse size={18} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">جاري التحميل...</span>
            </div>
        )
    }

    if (warehouses.length === 0) {
        return null
    }

    // Locked View
    if (me?.assignedWarehouse) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg opacity-75 cursor-not-allowed" title="أنت مقيد بهذا المستودع">
                <Lock size={16} className="text-amber-500" />
                <div className="flex flex-col items-start">
                    <span className="text-[10px] text-muted-foreground font-medium">المخزن المخصص</span>
                    <span className="text-sm font-bold text-slate-800">
                        {warehouses.find(w => w._id === (me.assignedWarehouse._id || me.assignedWarehouse))?.name || currentWarehouse?.name || 'مخصص'}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-all shadow-sm"
            >
                <Warehouse size={18} className="text-primary" />
                <div className="flex flex-col items-start">
                    <span className="text-[10px] text-muted-foreground font-medium">المخزن النشط</span>
                    <span className="text-sm font-bold text-slate-800">
                        {currentWarehouse?.name || 'اختر مخزن'}
                    </span>
                </div>
                <ChevronDown size={16} className={`text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b bg-slate-50">
                        <p className="text-xs font-bold text-slate-600">اختر المخزن النشط</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {warehouses.map((warehouse) => (
                            <button
                                key={warehouse._id}
                                onClick={() => {
                                    selectWarehouse(warehouse._id)
                                    setIsOpen(false)
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors ${warehouse._id === selectedWarehouseId ? 'bg-primary/5' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${warehouse._id === selectedWarehouseId ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        <Warehouse size={16} />
                                    </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-sm font-bold text-slate-800">{warehouse.name}</span>
                                        <span className="text-xs text-muted-foreground">{warehouse.code}</span>
                                    </div>
                                </div>
                                {warehouse._id === selectedWarehouseId && (
                                    <Check size={18} className="text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
