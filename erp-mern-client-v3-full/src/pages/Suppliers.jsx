import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { Plus, Edit2, Trash2, Search, Truck, Phone, Mail, MapPin, Building2, Receipt, FileText, Hash, DollarSign } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '../components/ui/Dialog'
import SupplierStatementModal from '../components/modals/SupplierStatementModal'

export default function Suppliers() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [showStatementModal, setShowStatementModal] = useState(false)
  const [statementSupplierId, setStatementSupplierId] = useState(null)
  const [editingItem, setEditingItem] = useState(null)

  // Form State
  const [form, setForm] = useState({
    code: '',
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    openingBalance: ''
  })

  // --- React Query Hooks ---

  // 1. Fetch Suppliers
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', q],
    queryFn: async () => {
      const { data } = await api.get(`/procurement/suppliers?q=${encodeURIComponent(q)}`)
      return data || []
    },
    placeholderData: (prev) => prev,
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل جلب المورّدين')
    }
  })

  // 2. Create/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      const payload = { ...formData }
      if (payload.openingBalance === '') delete payload.openingBalance

      if (editingItem) {
        return api.put(`/procurement/suppliers/${editingItem._id}`, payload)
      } else {
        return api.post('/procurement/suppliers', payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['suppliers'])
      push('success', editingItem ? 'تم تحديث بيانات المورّد' : 'تم إنشاء المورّد بنجاح')
      handleCloseModal()
    },
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل الحفظ')
    }
  })

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return api.delete(`/procurement/suppliers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['suppliers'])
      push('success', 'تم حذف المورّد')
    },
    onError: () => {
      push('error', 'فشل الحذف')
    }
  })

  // --- Handlers ---

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item)
      setForm({
        code: item.code,
        name: item.name,
        company: item.company || '',
        phone: item.phone || '',
        email: item.email || '',
        address: item.address || '',
        taxNumber: item.taxNumber || '',
        openingBalance: '' // Not editable in edit mode
      })
    } else {
      setEditingItem(null)
      // Generate code suggestion or leave empty
      setForm({
        code: '',
        name: '',
        company: '',
        phone: '',
        email: '',
        address: '',
        taxNumber: '',
        openingBalance: ''
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  const handleDelete = (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المورّد؟')) return
    deleteMutation.mutate(id)
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">المورّدون</h1>
          <p className="text-muted-foreground">إدارة بيانات المورّدين، الأرصدة، والمعاملات</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="shadow-lg">
          <Plus size={18} className="mr-2" />
          مورّد جديد
        </Button>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div className="relative w-full max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="pr-14 bg-gray-50/50 focus:bg-white transition-colors"
              placeholder="بحث بالاسم، الكود، الشركة..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="text-right">الكود</TableHead>
                <TableHead className="text-right">المورّد</TableHead>
                <TableHead className="text-right">الشركة</TableHead>
                <TableHead className="text-right">الاتصال</TableHead>
                <TableHead className="text-right">الرصيد</TableHead>
                <TableHead className="text-center w-[100px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">لا توجد بيانات.</TableCell></TableRow>
              ) : (
                suppliers.map(s => (
                  <TableRow key={s._id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600 border border-slate-200">
                        {s.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center border border-blue-200">
                          <Truck size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{s.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            {s.address && <><MapPin size={10} /> {s.address.substring(0, 20)}</>}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.company ? (
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Building2 size={14} className="text-slate-400" />
                          {s.company}
                        </div>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm space-y-1">
                        {s.phone ? (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone size={14} className="text-slate-400" />
                            <span className="font-mono text-xs">{s.phone}</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`font-bold font-mono text-sm ${(s.balance || 0) > 0 ? 'text-red-600' :
                        (s.balance || 0) < 0 ? 'text-blue-600' : 'text-emerald-600'
                        }`}>
                        {Number(s.balance || 0).toLocaleString()} د.ل
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {(s.balance || 0) > 0 ? 'مستحق له' : (s.balance || 0) < 0 ? 'دفعة مقدمة' : 'خالص'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => { setStatementSupplierId(s._id); setShowStatementModal(true); }}
                          title="كشف حساب"
                        >
                          <FileText size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-primary hover:bg-primary/10"
                          onClick={() => handleOpenModal(s)}
                          title="تعديل"
                        >
                          <Edit2 size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(s._id)}
                          title="حذف"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl" onClose={handleCloseModal}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
                <Truck size={20} />
              </div>
              {editingItem ? 'تعديل بيانات المورّد' : 'إضافة مورّد جديد'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <DialogBody className="space-y-6 max-h-[65vh] overflow-y-auto">

              {/* Basic Info Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Receipt size={16} className="text-blue-500" />
                  البيانات الأساسية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">
                      كود المورّد <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="code"
                      required
                      value={form.code}
                      onChange={e => setForm({ ...form, code: e.target.value })}
                      placeholder="مثال: SUP-2024-001"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      اسم المورّد <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="الاسم التجاري أو الشخصي"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">اسم الشركة</Label>
                    <Input
                      id="company"
                      value={form.company}
                      onChange={e => setForm({ ...form, company: e.target.value })}
                      placeholder="اسم الشركة (اختياري)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxNumber">الرقم الضريبي</Label>
                    <Input
                      id="taxNumber"
                      value={form.taxNumber}
                      onChange={e => setForm({ ...form, taxNumber: e.target.value })}
                      placeholder="الرقم الضريبي..."
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Info Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Phone size={16} className="text-emerald-500" />
                  التواصل والعنوان
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input
                      id="phone"
                      className="font-mono"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="09X-XXXXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      placeholder="example@company.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">العنوان</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    placeholder="المدينة، الشارع، أقرب نقطة دالة"
                  />
                </div>
              </div>

              {/* Financial Section */}
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <DollarSign size={16} className="text-amber-500" />
                  البيانات المالية
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {editingItem ? (
                    <div className="space-y-2">
                      <Label className="text-slate-500">الرصيد الحالي (للعرض فقط)</Label>
                      <div className={`text-xl font-bold font-mono ${(editingItem.balance || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {Number(editingItem.balance || 0).toLocaleString()} د.ل
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="openingBalance">الرصيد الافتتاحـي</Label>
                      <Input
                        id="openingBalance"
                        type="number"
                        step="0.01"
                        value={form.openingBalance}
                        onChange={e => setForm({ ...form, openingBalance: e.target.value })}
                        placeholder="0.00"
                        className="font-mono font-bold"
                      />
                      <p className="text-xs text-slate-500">
                        موجب: دائن (له) | سالب: مدين (عليه)
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleCloseModal} disabled={saveMutation.isPending}>
                إلغاء
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'جاري الحفظ...' : '💾 حفظ البيانات'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SupplierStatementModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        supplierId={statementSupplierId}
      />
    </div>
  )
}
