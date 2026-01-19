import { X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

export function QuickAdjustmentModal({
    item,
    warehouses,
    onClose,
    onSubmit,
    isSubmitting
}) {
    if (!item) return null

    const handleSubmit = (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        const warehouseId = formData.get('warehouseId')
        const qty = Number(formData.get('qty'))
        const direction = formData.get('direction')

        if (warehouseId && qty > 0) {
            const adjustmentQty = direction === 'out' ? -qty : qty
            onSubmit({ warehouseId, qty: adjustmentQty })
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md animate-in zoom-in-95 duration-200">
                <CardHeader className="flex flex-row justify-between items-center border-b">
                    <CardTitle className="text-lg">تعديل سريع للمخزون</CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X size={20} />
                    </Button>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
                        <div className="text-sm text-slate-600">المنتج</div>
                        <div className="font-bold text-lg">{item.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">المستودع</label>
                            <select
                                name="warehouseId"
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                                required
                            >
                                <option value="">اختر المستودع...</option>
                                {warehouses.map(w => (
                                    <option key={w._id} value={w._id}>{w.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">نوع التعديل</label>
                            <div className="flex gap-2">
                                <label className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-green-50 has-[:checked]:bg-green-50 has-[:checked]:border-green-500">
                                    <input type="radio" name="direction" value="in" defaultChecked className="text-green-600" />
                                    <span className="text-sm font-medium">إضافة (+)</span>
                                </label>
                                <label className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-red-50 has-[:checked]:bg-red-50 has-[:checked]:border-red-500">
                                    <input type="radio" name="direction" value="out" className="text-red-600" />
                                    <span className="text-sm font-medium">خصم (-)</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">الكمية</label>
                            <Input
                                name="qty"
                                type="number"
                                min="1"
                                placeholder="أدخل الكمية"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button
                                type="button"
                                variant="ghost"
                                className="flex-1"
                                onClick={onClose}
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'جاري التعديل...' : 'تأكيد'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
