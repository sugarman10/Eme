import React, { forwardRef, useState, useRef, useEffect, createContext, useContext } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Custom Select Component
 * Replaces native <select> with styled dropdown
 * 
 * @example
 * <Select value={value} onValueChange={setValue}>
 *   <SelectTrigger>
 *     <SelectValue placeholder="اختر..." />
 *   </SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="1">الخيار الأول</SelectItem>
 *     <SelectItem value="2">الخيار الثاني</SelectItem>
 *   </SelectContent>
 * </Select>
 */

const SelectContext = createContext(null)

const Select = ({ value, onValueChange, children, disabled = false }) => {
    const [open, setOpen] = useState(false)
    const [selectedLabel, setSelectedLabel] = useState('')
    const containerRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <SelectContext.Provider value={{
            value,
            onValueChange,
            open,
            setOpen,
            disabled,
            selectedLabel,
            setSelectedLabel
        }}>
            <div ref={containerRef} className="relative">
                {children}
            </div>
        </SelectContext.Provider>
    )
}

const SelectTrigger = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(SelectContext)

    return (
        <button
            ref={ref}
            type="button"
            onClick={() => !ctx.disabled && ctx.setOpen(!ctx.open)}
            disabled={ctx.disabled}
            className={cn(
                'flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors',
                'hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100',
                className
            )}
            {...props}
        >
            {children}
            <ChevronDown
                size={16}
                className={cn(
                    'text-slate-500 transition-transform',
                    ctx.open && 'rotate-180'
                )}
            />
        </button>
    )
})
SelectTrigger.displayName = 'SelectTrigger'

const SelectValue = ({ placeholder }) => {
    const ctx = useContext(SelectContext)
    return (
        <span className={cn(!ctx.selectedLabel && 'text-slate-400')}>
            {ctx.selectedLabel || placeholder}
        </span>
    )
}

const SelectContent = forwardRef(({ className, children, ...props }, ref) => {
    const ctx = useContext(SelectContext)

    if (!ctx.open) return null

    return (
        <div
            ref={ref}
            className={cn(
                'absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg animate-in fade-in zoom-in-95 duration-150',
                'max-h-60 overflow-auto',
                className
            )}
            {...props}
        >
            <div className="p-1">
                {children}
            </div>
        </div>
    )
})
SelectContent.displayName = 'SelectContent'

const SelectItem = forwardRef(({ className, value, children, ...props }, ref) => {
    const ctx = useContext(SelectContext)
    const isSelected = ctx.value === value

    useEffect(() => {
        if (isSelected) {
            ctx.setSelectedLabel(children)
        }
    }, [isSelected, children])

    return (
        <button
            ref={ref}
            type="button"
            onClick={() => {
                ctx.onValueChange?.(value)
                ctx.setSelectedLabel(children)
                ctx.setOpen(false)
            }}
            className={cn(
                'relative flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors',
                'hover:bg-slate-100 focus:bg-slate-100 focus:outline-none',
                isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700',
                className
            )}
            {...props}
        >
            <span className="flex-1 text-right">{children}</span>
            {isSelected && (
                <Check size={16} className="text-blue-600 ms-2" />
            )}
        </button>
    )
})
SelectItem.displayName = 'SelectItem'

// Simple native select wrapper for forms
const NativeSelect = forwardRef(({ className, children, ...props }, ref) => (
    <select
        ref={ref}
        className={cn(
            'flex h-10 w-full items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-100',
            className
        )}
        {...props}
    >
        {children}
    </select>
))
NativeSelect.displayName = 'NativeSelect'

export {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    NativeSelect,
}
