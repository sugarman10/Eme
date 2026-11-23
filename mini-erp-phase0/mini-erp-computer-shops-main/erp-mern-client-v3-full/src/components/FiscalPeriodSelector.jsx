import { Calendar, ChevronDown, Check, Lock, ShieldAlert, Settings } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useFiscalPeriod } from '../context/FiscalPeriodContext'
import { useToast } from '../context/ToastContext'

export function FiscalPeriodSelector() {
    const {
        periods,
        selectedPeriodId,
        currentPeriod,
        selectPeriod,
        canSwitchPeriod,
        canManagePeriods,
        loading
    } = useFiscalPeriod()

    const { push } = useToast()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

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
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-800/80 rounded-lg animate-pulse">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-xs text-slate-500">جاري التحميل...</span>
            </div>
        )
    }

    if (!periods || periods.length === 0) {
        return null
    }

    const handleClick = () => {
        if (!canSwitchPeriod) {
            push('info', 'السنة المالية الحالية محددة تلقائياً. تغيير الفترة يتطلب صلاحية التنقل بين الفترات المالية.')
            return
        }
        setIsOpen(!isOpen)
    }

    const handleSelect = (period) => {
        const success = selectPeriod(period._id)
        if (success) {
            push('success', `تم التبديل إلى: ${period.name}`)
            setIsOpen(false)
        } else {
            push('error', 'ليس لديك صلاحية التنقل بين الفترات المالية')
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={handleClick}
                className={`flex items-center gap-1.5 2xl:gap-2 h-9 px-2 2xl:px-3 rounded-xl border text-[11px] 2xl:text-xs font-bold transition-all duration-150 shadow-2xs select-none ${
                    canSwitchPeriod
                        ? 'bg-indigo-50/60 hover:bg-indigo-100/60 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60 border-indigo-200/80 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-200 cursor-pointer'
                        : 'border-slate-200/80 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 cursor-default'
                }`}
                title={canSwitchPeriod ? 'السنة المالية النشطة - انقر للتبديل' : 'السنة المالية النشطة (مغلقة للتعديل)'}
            >
                <div className={`p-1 rounded-md ${canSwitchPeriod ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                    <Calendar size={13} />
                </div>
                <span className="whitespace-nowrap max-w-[65px] 2xl:max-w-[110px] truncate">
                    {currentPeriod?.name || 'سنة 2026'}
                </span>
                {currentPeriod?.isClosed && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 rounded font-bold">مقفلة</span>
                )}

                {canSwitchPeriod ? (
                    <ChevronDown size={13} className={`text-indigo-600 dark:text-indigo-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                ) : (
                    <Lock size={11} className="text-slate-400 shrink-0" />
                )}
            </button>

            {/* Dropdown Popover */}
            {isOpen && canSwitchPeriod && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">التنقل بين الفترات المالية</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">اختر السنة أو الفترة المالية للعمل عليها</p>
                        </div>
                        <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50 p-1">
                        {periods.map((period) => {
                            const isSelected = period._id === selectedPeriodId
                            const isClosed = period.isClosed
                            const startYear = new Date(period.startDate).getFullYear()
                            const endYear = new Date(period.endDate).getFullYear()

                            return (
                                <button
                                    key={period._id}
                                    type="button"
                                    onClick={() => handleSelect(period)}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors cursor-pointer text-right ${
                                        isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : isClosed
                                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                        }`}>
                                            {isClosed ? <Lock size={14} /> : <Calendar size={14} />}
                                        </div>
                                        <div className="flex flex-col items-start">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold leading-tight">{period.name}</span>
                                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                                    isClosed
                                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                                        : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                                }`}>
                                                    {isClosed ? 'مقفلة' : 'نشطة ومفتوحة'}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                {new Date(period.startDate).toLocaleDateString('ar-LY')} - {new Date(period.endDate).toLocaleDateString('ar-LY')}
                                            </span>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <Check size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mr-1" />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {canManagePeriods && (
                        <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                            <Link
                                to="/fiscal-periods"
                                onClick={() => setIsOpen(false)}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/60 transition-colors"
                            >
                                <Settings size={13} />
                                <span>إدارة الفترات المالية والإقفالات</span>
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
