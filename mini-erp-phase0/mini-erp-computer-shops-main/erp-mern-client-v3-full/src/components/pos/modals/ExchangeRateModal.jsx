import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, X, Check, TrendingUp, AlertCircle, Sparkles, RefreshCw } from 'lucide-react'

/**
 * ExchangeRateModal - Fast Central USD Exchange Rate Controller
 * 
 * Allows cashier/admin to adjust the daily/hourly USD exchange rate:
 * - Real-time preview of conversion
 * - Quick increment/decrement buttons
 * - Instant broadcast to all screens via backend Socket.io
 */
export const ExchangeRateModal = ({
    isOpen,
    onClose,
    currentRate = 7.30,
    updatedAt = null,
    onSave
}) => {
    const [rate, setRate] = useState(String(currentRate))
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen) {
            setRate(String(currentRate || 7.30))
            setError('')
            setSaving(false)
        }
    }, [isOpen, currentRate])

    if (!isOpen) return null

    const handleSave = async (e) => {
        e?.preventDefault()
        const num = parseFloat(rate)
        if (!num || num <= 0) {
            setError('يرجى إدخال سعر صرف صالح أكبر من الصفر')
            return
        }
        setSaving(true)
        setError('')
        try {
            await onSave(num)
            onClose()
        } catch (err) {
            setError(err?.response?.data?.message || 'فشل تحديث سعر الصرف')
        } finally {
            setSaving(false)
        }
    }

    const adjustRate = (delta) => {
        const current = parseFloat(rate) || 7.30
        const updated = Math.max(0.1, Math.round((current + delta) * 100) / 100)
        setRate(String(updated))
    }

    const formattedUpdatedAt = updatedAt
        ? new Date(updatedAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
        : 'غير محدد'

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
                <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="px-5 py-4 bg-linear-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
                                <DollarSign size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-black text-base">سعر صرف الدولار (USD / LYD)</h3>
                                <p className="text-xs text-amber-100 font-medium">تسعير وحماية مبيعات الإلكترونيات</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body */}
                    <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
                        {/* Current Rate & Notice */}
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3 rounded-xl flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                                <TrendingUp size={16} className="shrink-0" />
                                <span>آخر تحديث معتمد:</span>
                            </div>
                            <span className="font-mono font-bold text-amber-900 dark:text-amber-200">{formattedUpdatedAt}</span>
                        </div>

                        {/* Input Field */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                <span>سعر صرف الدولار مقابل الدينار:</span>
                                <span className="text-[11px] font-normal text-slate-400">1 دولار أمريكي = X دينار</span>
                            </label>

                            <div className="relative flex items-center">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.1"
                                    autoFocus
                                    value={rate}
                                    onChange={e => setRate(e.target.value)}
                                    placeholder="7.30"
                                    className="w-full h-13 px-4 pl-16 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-2xl font-mono font-black text-slate-900 dark:text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-left transition-all"
                                />
                                <div className="absolute left-4 flex items-center gap-1 font-bold text-slate-400 text-xs select-none">
                                    <span>د.ل</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Adjust Buttons */}
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-400">تعديل سريع:</span>
                            <div className="flex items-center gap-1">
                                {[-0.20, -0.05, +0.05, +0.20, +0.50].map((delta) => (
                                    <button
                                        key={delta}
                                        type="button"
                                        onClick={() => adjustRate(delta)}
                                        className={`px-2 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                                            delta > 0
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                                        }`}
                                    >
                                        {delta > 0 ? `+${delta}` : delta}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Live Conversion Example */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                                <span>صنف بقيمة $100 :</span>
                                <strong className="font-mono text-slate-900 dark:text-white">
                                    {(100 * (parseFloat(rate) || 0)).toFixed(2)} د.ل
                                </strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                                <span>صنف بقيمة $500 :</span>
                                <strong className="font-mono text-slate-900 dark:text-white">
                                    {(500 * (parseFloat(rate) || 0)).toFixed(2)} د.ل
                                </strong>
                            </div>
                        </div>

                        {error && (
                            <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-2.5 rounded-lg flex items-center gap-1.5">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
                            💡 عند حفظ السعر الجديد، سيتم تحديث أسعار كافة المنتجات المسعرة بالدولار فوراً في جميع نقاط البيع والأجهزة المتصلة.
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-98"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>جاري التحديث والبث...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} />
                                        <span>تثبيت وتحديث سعر الصرف</span>
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="px-4 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                            >
                                إلغاء
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
