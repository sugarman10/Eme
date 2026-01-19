import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { ArrowRightLeft, Package, Warehouse, AlertCircle, CheckCircle2 } from 'lucide-react'
import api from '../services/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function StockTransfer() {
    const { push } = useToast()

    // Form State
    const [formData, setFormData] = useState({
        item: '',
        fromWarehouse: '',
        toWarehouse: '',
        qty: '',
        note: ''
    })

    // Data Lists
    const [items, setItems] = useState([])
    const [warehouses, setWarehouses] = useState([])

    // UI State
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Selected Item Details
    const selectedItem = items.find(i => i._id === formData.item)
    const sourceStock = selectedItem?.stocks?.find(s => {
        const wId = s.warehouse?._id || s.warehouse
        return wId?.toString() === formData.fromWarehouse?.toString()
    })
    const availableQty = sourceStock?.qty || 0

    // Load Data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const [itemsRes, warehousesRes] = await Promise.all([
                    api.get('/inventory/items'),
                    api.get('/inventory/warehouses')
                ])
                setItems(itemsRes.data || [])
                setWarehouses(warehousesRes.data || [])
            } catch (error) {
                console.error('Failed to load data:', error)
                push('error', 'فشل تحميل البيانات')
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [push])

    // Validation
    const canTransfer = () => {
        if (!formData.item || !formData.fromWarehouse || !formData.toWarehouse || !formData.qty) {
            return false
        }
        if (formData.fromWarehouse === formData.toWarehouse) {
            return false
        }
        if (Number(formData.qty) <= 0) {
            return false
        }
        if (Number(formData.qty) > availableQty) {
            return false
        }
        return true
    }

    // Handle Submit
    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!canTransfer()) {
            push('error', 'يرجى التحقق من البيانات المدخلة')
            return
        }

        try {
            setSubmitting(true)
            await api.post('/inventory/stock/transfer', {
                item: formData.item,
                fromWarehouse: formData.fromWarehouse,
                toWarehouse: formData.toWarehouse,
                qty: Number(formData.qty),
                note: formData.note
            })

            push('success', 'تم تحويل المخزون بنجاح')

            // Reset form
            setFormData({
                item: '',
                fromWarehouse: '',
                toWarehouse: '',
                qty: '',
                note: ''
            })

            // Reload items to get updated stock
            const { data } = await api.get('/inventory/items')
            setItems(data || [])

        } catch (error) {
            console.error('Transfer failed:', error)
            push('error', error?.response?.data?.message || 'فشل تحويل المخزون')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <ArrowRightLeft className="text-primary" size={32} />
                    تحويل المخزون بين المخازن
                </h1>
                <p className="text-slate-600 mt-2">نقل المنتجات من مخزن إلى آخر بشكل آمن</p>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Product Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Package size={16} />
                            المنتج
                            <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            value={formData.item}
                            onChange={(e) => setFormData({ ...formData, item: e.target.value, fromWarehouse: '', toWarehouse: '', qty: '' })}
                            required
                        >
                            <option value="">اختر المنتج...</option>
                            {items.map(item => (
                                <option key={item._id} value={item._id}>
                                    {item.name} ({item.sku}) - إجمالي: {item.totalStock || 0}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Warehouse Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Warehouse size={16} />
                                من مخزن
                                <span className="text-red-500">*</span>
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                value={formData.fromWarehouse}
                                onChange={(e) => setFormData({ ...formData, fromWarehouse: e.target.value })}
                                required
                                disabled={!formData.item}
                            >
                                <option value="">اختر المخزن المصدر...</option>
                                {warehouses.map(wh => {
                                    const stock = selectedItem?.stocks?.find(s => {
                                        const wId = s.warehouse?._id || s.warehouse
                                        return wId?.toString() === wh._id?.toString()
                                    })
                                    return (
                                        <option key={wh._id} value={wh._id}>
                                            {wh.name} - متوفر: {stock?.qty || 0}
                                        </option>
                                    )
                                })}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Warehouse size={16} />
                                إلى مخزن
                                <span className="text-red-500">*</span>
                            </label>
                            <select
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                value={formData.toWarehouse}
                                onChange={(e) => setFormData({ ...formData, toWarehouse: e.target.value })}
                                required
                                disabled={!formData.item}
                            >
                                <option value="">اختر المخزن الوجهة...</option>
                                {warehouses
                                    .filter(wh => wh._id !== formData.fromWarehouse)
                                    .map(wh => (
                                        <option key={wh._id} value={wh._id}>
                                            {wh.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* Quantity */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">
                            الكمية
                            <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="number"
                            min="1"
                            max={availableQty}
                            value={formData.qty}
                            onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                            placeholder="أدخل الكمية المراد تحويلها"
                            required
                            disabled={!formData.fromWarehouse}
                        />
                        {formData.fromWarehouse && (
                            <p className="text-xs text-slate-500">
                                الكمية المتوفرة في المخزن المصدر: <span className="font-bold text-primary">{availableQty}</span>
                            </p>
                        )}
                    </div>

                    {/* Note */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">ملاحظات</label>
                        <textarea
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                            rows="3"
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            placeholder="ملاحظات إضافية (اختياري)"
                        />
                    </div>

                    {/* Validation Messages */}
                    {formData.fromWarehouse && formData.toWarehouse && formData.fromWarehouse === formData.toWarehouse && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            <AlertCircle size={18} />
                            <span>لا يمكن التحويل من وإلى نفس المخزن</span>
                        </div>
                    )}

                    {formData.qty && Number(formData.qty) > availableQty && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            <AlertCircle size={18} />
                            <span>الكمية المطلوبة أكبر من المتوفر في المخزن المصدر</span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setFormData({ item: '', fromWarehouse: '', toWarehouse: '', qty: '', note: '' })}
                            disabled={submitting}
                        >
                            إعادة تعيين
                        </Button>
                        <Button
                            type="submit"
                            disabled={!canTransfer() || submitting}
                            className="flex items-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    جاري التحويل...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={18} />
                                    تأكيد التحويل
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}
