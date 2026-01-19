import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XCircle, ClipboardList, Play, Trash2 } from 'lucide-react'
import { Card } from '../../ui/Card'
import { formatCurrency } from '../../../lib/utils'
import { animations } from '../../../lib/posDesignTokens'

/**
 * HeldBillsModal - Manage Held/Paused Bills
 * 
 * Features:
 * - List of held bills with date/time
 * - Restore bill (loads into cart)
 * - Delete bill
 * - Empty state
 */
export const HeldBillsModal = ({
    show,
    onClose,
    heldBills,
    onRestore,
    onDelete
}) => {
    if (!show) return null

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <motion.div
                initial={animations.scaleIn.initial}
                animate={animations.scaleIn.animate}
                exit={animations.scaleIn.exit}
                className="w-full max-w-2xl max-h-[80vh] flex flex-col"
            >
                <Card className="flex flex-col shadow-2xl bg-white rounded-xl overflow-hidden border-0 ring-1 ring-black/5">
                    {/* Header */}
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <ClipboardList size={18} className="text-orange-600" />
                            <h2 className="text-base font-bold text-slate-800">
                                الفواتير المعلقة ({heldBills.length})
                            </h2>
                        </div>
                        <button
                            className="hover:bg-slate-200 rounded-full p-1 transition-colors"
                            onClick={onClose}
                        >
                            <XCircle size={18} className="text-slate-500" />
                        </button>
                    </div>

                    {/* Body - Scrollable */}
                    <div className="flex-1 p-4 overflow-y-auto">
                        <AnimatePresence mode="popLayout">
                            {heldBills.length === 0 ? (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-12 text-slate-400"
                                >
                                    <ClipboardList size={48} className="mb-4 opacity-20" />
                                    <p className="font-bold text-lg">لا توجد فواتير معلقة</p>
                                    <p className="text-sm mt-1">قم بتعليق فاتورة لحفظها مؤقتاً</p>
                                </motion.div>
                            ) : (
                                <div className="space-y-3">
                                    {heldBills.map(bill => (
                                        <motion.div
                                            key={bill.id}
                                            layout
                                            initial={animations.slideIn.initial}
                                            animate={animations.slideIn.animate}
                                            exit={animations.slideIn.exit}
                                            className="bg-white border border-slate-200 rounded-xl p-4 hover:border-orange-300 hover:shadow-md transition-all group"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    {/* Customer */}
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xs border border-orange-100">
                                                            {bill.items.length}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-800">
                                                                {bill.customer?.name || 'عميل عابر'}
                                                            </span>
                                                            <span className="text-xs text-slate-400">
                                                                {new Date(bill.date).toLocaleString('ar-LY', {
                                                                    dateStyle: 'short',
                                                                    timeStyle: 'short'
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Total */}
                                                    <div className="text-lg font-bold text-primary font-mono tabular-nums">
                                                        {formatCurrency(bill.total)}
                                                    </div>

                                                    {/* Discount if any */}
                                                    {bill.discount > 0 && (
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            خصم: {formatCurrency(bill.discount)}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-2">
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => onRestore(bill)}
                                                        className="h-9 w-9 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white flex items-center justify-center transition-colors border border-orange-100"
                                                        title="استرجاع"
                                                    >
                                                        <Play size={16} fill="currentColor" />
                                                    </motion.button>

                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => {
                                                            if (confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
                                                                onDelete(bill.id)
                                                            }
                                                        }}
                                                        className="h-9 w-9 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors border border-red-100"
                                                        title="حذف"
                                                    >
                                                        <Trash2 size={16} />
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </Card>
            </motion.div>
        </div>
    )
}
