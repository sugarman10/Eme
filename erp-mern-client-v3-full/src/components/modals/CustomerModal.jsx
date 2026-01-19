import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { X, Trash2, Save, User, Phone, Mail, MapPin, CreditCard, Building2, FileText, CheckCircle2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export default function CustomerModal({ show, onClose, editingItem, onSuccess, onDelete }) {
    const { push } = useToast()
    const queryClient = useQueryClient()
    const [form, setForm] = useState({
        code: '',
        name: '',
        phone: '',
        email: '',
        address: '',
        type: 'retail',
        creditLimit: 0
    })

    useEffect(() => {
        if (show) {
            if (editingItem) {
                setForm({
                    code: editingItem.code,
                    name: editingItem.name,
                    phone: editingItem.phone || '',
                    email: editingItem.email || '',
                    address: editingItem.address || '',
                    type: editingItem.type || 'retail',
                    creditLimit: editingItem.creditLimit || 0
                })
            } else {
                setForm({
                    code: '',
                    name: '',
                    phone: '',
                    email: '',
                    address: '',
                    type: 'retail',
                    creditLimit: 0
                })
            }
        }
    }, [show, editingItem])

    const saveMutation = useMutation({
        mutationFn: async (formData) => {
            if (editingItem) {
                return api.put(`/customers/${editingItem._id}`, formData)
            } else {
                return api.post('/customers', formData)
            }
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries(['customers'])
            push('success', editingItem ? 'تم تحديث بيانات العميل' : 'تم إنشاء العميل بنجاح')
            if (onSuccess) onSuccess(res.data)
            onClose()
        },
        onError: (err) => {
            push('error', err?.response?.data?.message || 'فشل الحفظ')
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        saveMutation.mutate(form)
    }

    if (!show) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-2xl shadow-2xl bg-white rounded-2xl overflow-hidden border-0 ring-1 ring-black/5 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${editingItem ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {editingItem ? <User size={24} /> : <User size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingItem ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {editingItem ? 'تحديث المعلومات الشخصية والمالية' : 'إدخال بيانات عميل جديد للنظام'}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 text-slate-500" onClick={onClose}>
                        <X size={22} />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-6 space-y-6">
                        {/* Basic Info Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b">
                                <FileText size={16} className="text-primary" />
                                البيانات الأساسية
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">كود العميل <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                            <FileText size={16} />
                                        </div>
                                        <Input
                                            required
                                            value={form.code}
                                            onChange={e => setForm({ ...form, code: e.target.value })}
                                            placeholder="مثال: CUST-001"
                                            className="pr-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">اسم العميل <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                            <User size={16} />
                                        </div>
                                        <Input
                                            required
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="الاسم الكامل"
                                            className="pr-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b">
                                <Phone size={16} className="text-primary" />
                                معلومات الاتصال
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">رقم الهاتف</label>
                                    <div className="relative">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                            <Phone size={16} />
                                        </div>
                                        <Input
                                            value={form.phone}
                                            onChange={e => setForm({ ...form, phone: e.target.value })}
                                            placeholder="09X XXXXXXX"
                                            className="pr-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                            dir="ltr"
                                            style={{ textAlign: 'right' }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">البريد الإلكتروني</label>
                                    <div className="relative">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                            <Mail size={16} />
                                        </div>
                                        <Input
                                            type="email"
                                            value={form.email}
                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                            placeholder="example@domain.com"
                                            className="pr-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                            dir="ltr"
                                            style={{ textAlign: 'right' }}
                                        />
                                    </div>
                                </div>
                                <div className="col-span-1 md:col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-slate-700">العنوان</label>
                                    <div className="relative">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                            <MapPin size={16} />
                                        </div>
                                        <Input
                                            value={form.address}
                                            onChange={e => setForm({ ...form, address: e.target.value })}
                                            placeholder="المدينة، المنطقة، اسم الشارع"
                                            className="pr-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Financial Info Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b">
                                <CreditCard size={16} className="text-primary" />
                                البيانات المالية
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">نوع العميل</label>
                                    <div className="relative">
                                        <select
                                            className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                                            value={form.type}
                                            onChange={e => setForm({ ...form, type: e.target.value })}
                                        >
                                            <option value="retail">قطاعي (Retail)</option>
                                            <option value="wholesale">جملة (Wholesale)</option>
                                        </select>
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                            <Building2 size={16} />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">سقف الائتمان</label>
                                    <div className="relative">
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                            <CreditCard size={16} />
                                        </div>
                                        <Input
                                            type="number"
                                            value={form.creditLimit}
                                            onChange={e => setForm({ ...form, creditLimit: e.target.value })}
                                            className="pr-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors font-bold text-slate-700"
                                            placeholder="0 = لا يوجد سقف"
                                        />
                                    </div>
                                </div>
                                {/* Account linking removed - system uses parent accounts (1030, 2030) automatically */}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t bg-slate-50 flex justify-between gap-3 sticky bottom-0 z-10">
                        {editingItem && (
                            <Button
                                type="button"
                                variant="destructive"
                                className="gap-2 hover:bg-red-600"
                                onClick={() => {
                                    if (window.confirm('هل أنت متأكد من حذف هذا العميل؟')) {
                                        onDelete && onDelete(editingItem._id)
                                        onClose()
                                    }
                                }}
                            >
                                <Trash2 size={18} />
                                حذف
                            </Button>
                        )}
                        <div className="flex gap-3 ml-auto w-full md:w-auto">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={saveMutation.isPending}
                                className="flex-1 md:flex-none"
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                disabled={saveMutation.isPending}
                                className="flex-1 md:flex-none gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                            >
                                {saveMutation.isPending ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ البيانات'}
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>
        </div>
    )
}
