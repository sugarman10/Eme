import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { Plus, Edit2, Trash2, Search, Users, Phone, Mail, MapPin, X, CreditCard, Eye, Wallet, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import CustomerModal from '../components/modals/CustomerModal'


export default function Customers() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // --- React Query Hooks ---

  // 1. Fetch Customers
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', q],
    queryFn: async () => {
      const { data } = await api.get(`/customers?q=${encodeURIComponent(q)}`)
      return data || []
    },
    keepPreviousData: true,
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل جلب العملاء')
    }
  })

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return api.delete(`/customers/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['customers'])
      push('success', 'تم حذف العميل')
    },
    onError: () => {
      push('error', 'فشل الحذف')
    }
  })

  // --- Handlers ---

  // Selection State
  const [selectedId, setSelectedId] = useState(null)

  // ... React Query Hooks ...

  // ... Mutations ...

  // --- Handlers ---

  const handleOpenModal = (item = null) => {
    setEditingItem(item)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
  }

  const handleDelete = (id) => {
    deleteMutation.mutate(id)
  }

  const handleEditSelected = () => {
    if (!selectedId) return push('error', 'يرجى اختيار عميل أولاً')
    const item = customers.find(c => c._id === selectedId)
    if (item) handleOpenModal(item)
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">العملاء</h1>
          <p className="text-muted-foreground">إدارة بيانات العملاء وحدود الائتمان</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/customers/${selectedId}`)}
            disabled={!selectedId}
            className={!selectedId ? 'opacity-50' : ''}
          >
            <Eye size={18} className="mr-2" />
            تفاصيل
          </Button>
          <Button
            variant="outline"
            onClick={handleEditSelected}
            disabled={!selectedId || customers.find(c => c._id === selectedId)?.isSystem}
            className={(!selectedId || customers.find(c => c._id === selectedId)?.isSystem) ? 'opacity-50' : ''}
            title={customers.find(c => c._id === selectedId)?.isSystem ? 'لا يمكن تعديل عميل النظام' : ''}
          >
            {customers.find(c => c._id === selectedId)?.isSystem ? <Lock size={18} className="mr-2" /> : <Edit2 size={18} className="mr-2" />}
            تعديل
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm('هل أنت متأكد من حذف هذا العميل؟')) {
                handleDelete(selectedId)
                setSelectedId(null)
              }
            }}
            disabled={!selectedId || customers.find(c => c._id === selectedId)?.isSystem}
            className={(!selectedId || customers.find(c => c._id === selectedId)?.isSystem) ? 'opacity-50' : ''}
            title={customers.find(c => c._id === selectedId)?.isSystem ? 'لا يمكن حذف عميل النظام' : ''}
          >
            {customers.find(c => c._id === selectedId)?.isSystem ? <Lock size={18} className="mr-2" /> : <Trash2 size={18} className="mr-2" />}
            حذف
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <Plus size={18} className="mr-2" />
            عميل جديد
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="!pr-14"
              placeholder="بحث بالاسم، الكود، أو الهاتف..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الصنف</TableHead>
                <TableHead>الرصيد</TableHead>
                <TableHead>الاتصال</TableHead>
                <TableHead>سقف الائتمان</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              ) : customers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">لا توجد بيانات.</TableCell></TableRow>
              ) : (
                customers.map(c => (
                  <TableRow
                    key={c._id}
                    className={`cursor-pointer transition-colors ${selectedId === c._id ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedId(selectedId === c._id ? null : c._id)}
                  >
                    <TableCell className="font-mono text-sm text-muted-foreground">{c.code}</TableCell>
                    <TableCell className="font-medium flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Users size={16} />
                      </div>
                      {c.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* Type Badge: wholesale vs retail */}
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold border-transparent ${c.type === 'wholesale' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                          {c.type === 'wholesale' ? 'جملة' : 'قطاعي'}
                        </span>
                        {/* Cash Customer Badge */}
                        {c.isCashCustomer && (
                          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold border-amber-300 bg-amber-100 text-amber-700">
                            💵 نقدي
                          </span>
                        )}
                        {/* System Customer Lock */}
                        {c.isSystem && (
                          <Lock size={12} className="text-muted-foreground" title="عميل نظام" />
                        )}
                      </div>
                    </TableCell>
                    {/* Balance Column - Color Coded */}
                    <TableCell>
                      {c.balance !== undefined && c.balance !== 0 ? (
                        <div className={`flex items-center gap-1 font-bold ${c.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          <Wallet size={14} />
                          {Number(c.balance).toLocaleString('ar-LY')} د.ل
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">0.00</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm space-y-1">
                        {c.phone && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone size={12} />
                            {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail size={12} />
                            {c.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.creditLimit > 0 ? (
                        <div className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CreditCard size={14} />
                          {Number(c.creditLimit).toLocaleString()}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">-</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CustomerModal
        show={showModal}
        onClose={handleCloseModal}
        editingItem={editingItem}
        onDelete={handleDelete}
      />
    </div>
  )
}
