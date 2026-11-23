import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, AlertCircle, Info, Trash2, CheckCircle2, X } from 'lucide-react'

/**
 * ConfirmModal - Reusable Modern Confirmation Dialog for POS
 * 
 * Replaces native browser confirm() dialogs with an on-brand,
 * accessible, and animated dialog.
 */
export const ConfirmModal = ({
    isOpen,
    title = 'تأكيد الإجراء',
    message = 'هل أنت متأكد من رغبتك في متابعة هذا الإجراء؟',
    confirmText = 'تأكيد',
    cancelText = 'إلغاء',
    altText = null,
    type = 'warning', // 'danger' | 'warning' | 'info' | 'success'
    onConfirm,
    onCancel,
    onAlt = null,
    loading = false
}) => {
    // Keyboard listener for Escape to close
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !loading) {
                onCancel && onCancel()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, loading, onCancel])

    if (!isOpen) return null

    // Determine color schemes & icon by dialog type
    let icon = <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400" />
    let iconBg = 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/60'
    let confirmBtnClass = 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'

    if (type === 'danger') {
        icon = <Trash2 size={24} className="text-rose-600 dark:text-rose-400" />
        iconBg = 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60'
        confirmBtnClass = 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
    } else if (type === 'info') {
        icon = <Info size={24} className="text-blue-600 dark:text-blue-400" />
        iconBg = 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900/60'
        confirmBtnClass = 'bg-[#24357a] hover:bg-[#1a285a] text-white shadow-blue-900/20'
    } else if (type === 'success') {
        icon = <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
        iconBg = 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/60'
        confirmBtnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
                {/* Backdrop Click to Cancel */}
                <div
                    className="absolute inset-0"
                    onClick={() => {
                        if (!loading && onCancel) onCancel()
                    }}
                />

                {/* Dialog Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 12 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden text-right z-10"
                >
                    {/* Top Accent Stripe */}
                    <div
                        className={`h-1.5 w-full ${
                            type === 'danger'
                                ? 'bg-gradient-to-r from-rose-500 to-red-600'
                                : type === 'info'
                                ? 'bg-gradient-to-r from-blue-600 to-[#24357a]'
                                : type === 'success'
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                    />

                    <div className="p-5 sm:p-6">
                        {/* Header & Icon */}
                        <div className="flex items-start gap-4">
                            <div
                                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${iconBg} shadow-xs`}
                            >
                                {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                                    {title}
                                </h3>
                                <div className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {typeof message === 'string' ? (
                                        message.split('\n').map((line, idx) => (
                                            <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
                                                {line}
                                            </p>
                                        ))
                                    ) : (
                                        message
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                            {/* Cancel Button */}
                            {cancelText && (
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={loading}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                            )}

                            {/* Optional 3rd Alternative Button */}
                            {altText && onAlt && (
                                <button
                                    type="button"
                                    onClick={onAlt}
                                    disabled={loading}
                                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border border-rose-200 dark:border-rose-900/60 disabled:opacity-50"
                                >
                                    {altText}
                                </button>
                            )}

                            {/* Primary Confirm Button */}
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={loading}
                                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 ${confirmBtnClass}`}
                            >
                                {loading && (
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                )}
                                <span>{confirmText}</span>
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
