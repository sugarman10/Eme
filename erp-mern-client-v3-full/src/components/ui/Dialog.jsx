import { forwardRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Dialog/Modal Component
 * Uses portal for proper stacking, supports backdrop blur and animations
 * 
 * @example
 * <Dialog open={isOpen} onOpenChange={setIsOpen}>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>العنوان</DialogTitle>
 *       <DialogDescription>الوصف</DialogDescription>
 *     </DialogHeader>
 *     <div>المحتوى</div>
 *     <DialogFooter>
 *       <Button onClick={() => setIsOpen(false)}>إلغاء</Button>
 *       <Button>حفظ</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 */

const Dialog = ({ open, onOpenChange, children }) => {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [open])

    if (!mounted || !open) return null

    return createPortal(
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => onOpenChange?.(false)}
            />
            {/* Content Container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                {children}
            </div>
        </div>,
        document.body
    )
}

const DialogContent = forwardRef(({ className, children, onClose, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'relative bg-white rounded-xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200',
            className
        )}
        onClick={(e) => e.stopPropagation()}
        {...props}
    >
        {onClose && (
            <button
                onClick={onClose}
                className="absolute top-4 left-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors z-10"
            >
                <X size={18} />
            </button>
        )}
        {children}
    </div>
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('p-6 border-b border-slate-200', className)}
        {...props}
    />
))
DialogHeader.displayName = 'DialogHeader'

const DialogTitle = forwardRef(({ className, ...props }, ref) => (
    <h2
        ref={ref}
        className={cn('text-xl font-bold text-slate-900', className)}
        {...props}
    />
))
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = forwardRef(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('text-sm text-slate-500 mt-1', className)}
        {...props}
    />
))
DialogDescription.displayName = 'DialogDescription'

const DialogBody = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex-1 overflow-y-auto p-6', className)}
        {...props}
    />
))
DialogBody.displayName = 'DialogBody'

const DialogFooter = forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50',
            className
        )}
        {...props}
    />
))
DialogFooter.displayName = 'DialogFooter'

export {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogBody,
    DialogFooter,
}
