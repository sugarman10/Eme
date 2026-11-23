import React from 'react'
import { motion } from 'framer-motion'
import { XCircle, Calculator, Trash2, PlusCircle } from 'lucide-react'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { TreasurySelector } from '../../TreasurySelector'
import { formatCurrency } from '../../../lib/utils'
import { PAYMENT_METHODS } from '../../../constants/posConstants'
import { animations } from '../../../lib/posDesignTokens'

/**
 * SplitPaymentModal - Split Payment Configuration
 * 
 * Features:
 * - Multiple payment methods in one transaction
 * - Amount + Treasury per row
 * - Add/remove payment rows
 * - Total validation
 */
export const SplitPaymentModal = ({
    show,
    onClose,
    splitPayments,
    setSplitPayments,
    totalAfterDiscount
}) => {
    if (!show) return null

    const totalPaid = splitPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const remaining = totalAfterDiscount - totalPaid
    const isValid = totalPaid >= totalAfterDiscount

    const addPaymentRow = () => {
        setSplitPayments([...splitPayments, { method: PAYMENT_METHODS.CASH, amount: 0, treasury: '' }])
    }

    const removePaymentRow = (index) => {
        if (splitPayments.length === 1) return
        setSplitPayments(splitPayments.filter((_, i) => i !== index))
    }

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <motion.div
                initial={animations.scaleIn.initial}
                animate={animations.scaleIn.animate}
                exit={animations.scaleIn.exit}
            >
                <Card className="w-full max-w-[450px] flex flex-col shadow-2xl bg-white rounded-xl overflow-hidden border-0 ring-1 ring-black/5">
                    {/* Header */}
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <div className="flex items-center gap-2">
                            <Calculator size={18} className="text-primary" />
                            <h2 className="text-base font-bold text-slate-800">دفع مختلط</h2>
                        </div>
                        <button
                            className="hover:bg-slate-200 rounded-full p-1 transition-colors"
                            onClick={onClose}
                        >
                            <XCircle size={18} className="text-slate-500" />
                        </button>
                    </div>

                    <div className="p-4 flex flex-col gap-4">
                        {/* Total Amount Display */}
                        <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex justify-between items-center">
                            <span className="font-bold text-sm text-slate-700">المبلغ المطلوب</span>
                            <span className="text-xl font-bold text-primary font-mono tabular-nums">
                                {formatCurrency(totalAfterDiscount)}
                            </span>
                        </div>

                        {/* Payment Rows */}
                        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                            {splitPayments.map((payment, index) => (
                                <div
                                    key={index}
                                    className="flex flex-col gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 transition-colors hover:border-blue-200"
                                >
                                    {/* Method + Amount + Delete */}
                                    <div className="flex gap-3 items-center">
                                        <select
                                            className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow w-[120px]"
                                            value={payment.method}
                                            onChange={e => {
                                                const newPayments = [...splitPayments]
                                                newPayments[index].method = e.target.value
                                                newPayments[index].treasury = ''
                                                setSplitPayments(newPayments)
                                            }}
                                        >
                                            <option value={PAYMENT_METHODS.CASH}>نقدي</option>
                                            <option value={PAYMENT_METHODS.CARD}>بطاقة</option>
                                            <option value={PAYMENT_METHODS.BANK}>حوالة</option>
                                        </select>

                                        <input
                                            type="number"
                                            value={payment.amount}
                                            onChange={e => {
                                                const newPayments = [...splitPayments]
                                                newPayments[index].amount = Number(e.target.value)
                                                setSplitPayments(newPayments)
                                            }}
                                            className="flex-1 h-10 text-sm font-bold text-center bg-white border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono tabular-nums"
                                            placeholder="المبلغ"
                                        />

                                        <button
                                            className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            onClick={() => removePaymentRow(index)}
                                            disabled={splitPayments.length === 1}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Treasury Selector */}
                                    <TreasurySelector
                                        value={payment.treasury}
                                        onChange={(val) => {
                                            const newPayments = [...splitPayments]
                                            newPayments[index].treasury = val
                                            setSplitPayments(newPayments)
                                        }}
                                        filterType={payment.method === PAYMENT_METHODS.CASH ? 'safe' : 'bank'}
                                        className="w-full"
                                        required={payment.amount > 0}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Add Payment Button */}
                        <Button
                            variant="secondary"
                            onClick={addPaymentRow}
                            className="w-full flex items-center justify-center gap-2"
                        >
                            <PlusCircle size={16} />
                            إضافة دفعة
                        </Button>

                        {/* Summary */}
                        <div className={`p-3 rounded-lg border ${isValid
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-red-50 border-red-200'
                            }`}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-slate-700">مجموع الدفعات:</span>
                                <span className={`font-bold font-mono tabular-nums ${isValid ? 'text-emerald-700' : 'text-red-700'
                                    }`}>
                                    {formatCurrency(totalPaid)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-slate-700">المتبقي:</span>
                                <span className={`font-bold font-mono tabular-nums ${remaining <= 0 ? 'text-emerald-700' : 'text-red-700'
                                    }`}>
                                    {formatCurrency(Math.abs(remaining))}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t bg-slate-50 flex gap-3 justify-end">
                        <Button variant="secondary" onClick={onClose}>
                            إلغاء
                        </Button>
                        <Button onClick={onClose} disabled={!isValid}>
                            تأكيد
                        </Button>
                    </div>
                </Card>
            </motion.div>
        </div>
    )
}
