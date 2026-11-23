import React, { useState } from 'react'
import { X, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

export function BulkPriceModal({ isOpen, onClose, onSubmit, isSubmitting }) {
    const [field, setField] = useState('price')
    const [action, setAction] = useState('increase')
    const [value, setValue] = useState(10)

    if (!isOpen) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit({ field, action, value })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden m-4" dir="rtl">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        تحديث أسعار جماعي
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3 text-amber-800 text-xs font-bold leading-relaxed">
                        <AlertTriangle className="shrink-0" size={18} />
                        <p>
                            تحذير: سيقوم هذا الإجراء بتعديل أسعار **جميع** المنتجات في النظام دفعة واحدة.
                            لا يمكن التراجع عن هذا الإجراء تلقائياً.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">نوع العملية</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAction('increase')}
                                    className={`flex items-center justify-center gap-2 h-10 rounded-xl font-bold text-sm border transition-all ${action === 'increase'
                                            ? 'bg-green-100 border-green-300 text-green-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <ArrowUp size={16} /> زيادة
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAction('decrease')}
                                    className={`flex items-center justify-center gap-2 h-10 rounded-xl font-bold text-sm border transition-all ${action === 'decrease'
                                            ? 'bg-red-100 border-red-300 text-red-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <ArrowDown size={16} /> تخفيض (خصم)
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">الحقل المستهدف</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={field}
                                    onChange={e => setField(e.target.value)}
                                >
                                    <option value="price">سعر البيع</option>
                                    <option value="cost">سعر التكلفة</option>
                                    <option value="wholesalePrice">سعر الجملة</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">النسبة المئوية %</label>
                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    value={value}
                                    onChange={e => setValue(e.target.value)}
                                    className="font-bold text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            className="flex-1"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            إلغاء
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'جاري التنفيذ...' : 'تأكيـد التحديث'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
