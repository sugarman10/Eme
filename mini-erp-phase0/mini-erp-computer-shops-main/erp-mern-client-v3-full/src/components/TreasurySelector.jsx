import { useState, useEffect, useMemo } from 'react'
import { Landmark, Vault, ChevronDown, Check } from 'lucide-react'
import api from '../services/api'

export function TreasurySelector({ value, onChange, required = false, className = '', filterType = null }) {
    const [treasuries, setTreasuries] = useState([])
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        const fetchTreasuries = async () => {
            try {
                // Fetch from the dedicated treasuries endpoint
                const { data } = await api.get('/finance/treasuries')
                setTreasuries(data || [])
            } catch (error) {
                console.error('Failed to load treasuries:', error)
                setTreasuries([])
            } finally {
                setLoading(false)
            }
        }

        fetchTreasuries()
    }, []) // Run once on mount

    // Filter treasuries based on filterType prop
    const displayedTreasuries = useMemo(() => {
        if (!filterType) return treasuries
        return treasuries.filter(t =>
            t.type && t.type.toLowerCase() === filterType.toLowerCase()
        )
    }, [treasuries, filterType])

    // Auto-select logic
    useEffect(() => {
        if (loading || displayedTreasuries.length === 0) return

        // Check if current value is valid in the displayed list
        const isValid = displayedTreasuries.some(t => t._id === value)

        if (!value || !isValid) {
            if (onChange) {
                // Priority: 'safe' type if no specific filter, otherwise first available
                // If filterType is set, just take the first one (since they are all the same type)
                let defaultTreasury

                if (filterType) {
                    defaultTreasury = displayedTreasuries[0]
                } else {
                    defaultTreasury = displayedTreasuries.find(t => t.type === 'safe') || displayedTreasuries[0]
                }

                if (defaultTreasury) {
                    onChange(defaultTreasury._id)
                }
            }
        }
    }, [displayedTreasuries, value, loading, onChange, filterType])

    const getTreasuryIcon = (treasury) => {
        return treasury.type === 'bank' || treasury.type === 'Bank' ? Landmark : Vault
    }

    const selectedTreasury = treasuries.find(t => t._id === value)
    const SelectedIcon = selectedTreasury ? getTreasuryIcon(selectedTreasury) : null

    if (loading) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg animate-pulse ${className}`}>
                <div className="w-4 h-4 bg-slate-200 rounded-full"></div>
                <div className="h-4 w-24 bg-slate-200 rounded"></div>
            </div>
        )
    }

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 bg-white border rounded-lg hover:border-blue-500 transition-all ${required && !value ? 'border-red-300 bg-red-50' : 'border-slate-300'
                    }`}
            >
                <div className="flex items-center gap-2">
                    {selectedTreasury ? (
                        <>
                            <SelectedIcon size={18} className="text-blue-600" />
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-bold text-slate-800">{selectedTreasury.name}</span>
                                {selectedTreasury.balance !== undefined && (
                                    <span className="text-xs text-slate-500 font-medium">
                                        رصيد: {new Intl.NumberFormat('en-US').format(selectedTreasury.balance)}
                                    </span>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <Vault size={18} className="text-slate-400" />
                            <span className="text-sm text-slate-400">اختر الخزينة...</span>
                        </>
                    )}
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto w-full min-w-[200px]">
                        <div className="p-2 border-b bg-slate-50 sticky top-0">
                            <p className="text-xs font-bold text-slate-500">
                                {filterType === 'safe' ? 'الخزائن النقدية' : filterType === 'bank' ? 'الحسابات البنكية' : 'الخزائن والبنوك'}
                            </p>
                        </div>
                        {displayedTreasuries.map((treasury) => {
                            const Icon = getTreasuryIcon(treasury)
                            const isSelected = treasury._id === value
                            return (
                                <button
                                    key={treasury._id}
                                    type="button"
                                    onClick={() => {
                                        onChange(treasury._id)
                                        setIsOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-3 border-b border-slate-50 last:border-0 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="flex flex-col items-start text-right">
                                            <span className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {treasury.name}
                                            </span>
                                            <div className="flex gap-2">
                                                <span className="text-xs text-slate-500 font-mono">
                                                    {treasury.type === 'bank' || treasury.type === 'Bank' ? 'حساب بنكي' : 'خزينة نقدية'}
                                                </span>
                                                {treasury.accountNumber && (
                                                    <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-600 font-mono">
                                                        {treasury.accountNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isSelected && <Check size={16} className="text-blue-600" />}
                                </button>
                            )
                        })}
                        {displayedTreasuries.length === 0 && (
                            <div className="p-4 text-center text-sm text-slate-400">
                                لا توجد خيارات متاحة
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
