import { useEffect, useState } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { Plus, Edit2, Trash2, Search, Warehouse, MapPin } from 'lucide-react'
import { Button } from '../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '../components/ui/Dialog'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { NativeSelect } from '../components/ui/Select'

export default function Warehouses() {
  const { push } = useToast()
  const [warehouses, setWarehouses] = useState([])
  const [warehouseStats, setWarehouseStats] = useState({})
  const [loading, setLoading] = useState(false)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form State
  const [form, setForm] = useState({
    code: '',
    name: '',
    address: '',
    type: 'main'
  })

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/inventory/warehouses')
      setWarehouses(data || [])

      // Fetch stats for each warehouse
      const stats = {}
      await Promise.all(data.map(async (wh) => {
        try {
          const { data: stockData } = await api.get(`/inventory/stock/balances?warehouse=${wh._id}&limit=5000`)
          const rows = stockData.rows || []
          stats[wh._id] = {
            totalItems: rows.length,
            totalValue: rows.reduce((sum, r) => sum + (r.balance * (r.item?.cost || 0)), 0)
          }
        } catch (e) {
          console.error(`Failed to fetch stats for warehouse ${wh.name}`, e)
          stats[wh._id] = { totalItems: 0, totalValue: 0 }
        }
      }))
      setWarehouseStats(stats)

    } catch (err) {
      console.error('Failed to fetch warehouses', err)
      push('error', err?.response?.data?.message || 'فشل تحميل المستودعات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item)
      setForm({
        code: item.code,
        name: item.name,
        address: item.address || '',
        type: item.type || 'main'
      })
    } else {
      setEditingItem(null)
      setForm({ code: '', name: '', address: '', type: 'main' })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingItem) {
        await api.put(`/inventory/warehouses/${editingItem._id}`, form)
        push('success', 'تم تحديث المستودع')
      } else {
        await api.post('/inventory/warehouses', form)
        push('success', 'تمت إضافة المستودع')
      }
      handleCloseModal()
      fetchData()
    } catch (e) {
      push('error', e?.response?.data?.message || 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستودع؟')) return
    try {
      await api.delete(`/inventory/warehouses/${id}`)
      push('success', 'تم حذف المستودع')
      fetchData()
    } catch (err) {
      push('error', 'فشل الحذف')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="h2">المستودعات</h1>
          <p className="muted">إدارة مواقع التخزين والمستودعات</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn btn-primary">
          <Plus size={18} />
          مستودع جديد
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="muted">
            عدد المستودعات: {warehouses.length}
          </div>
        </div>

        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>النوع</th>
                  <th>العنوان</th>
                  <th>عدد الأصناف</th>
                  <th>القيمة الإجمالية</th>
                  <th style={{ width: '100px' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center p-8 muted">جاري التحميل...</td></tr>
                ) : warehouses.length === 0 ? (
                  <tr><td colSpan="5" className="text-center p-8 muted">لا توجد مستودعات.</td></tr>
                ) : (
                  warehouses.map(w => (
                    <tr key={w._id}>
                      <td className="font-mono text-sm">{w.code}</td>
                      <td className="font-bold flex items-center gap-2">
                        <Warehouse size={16} className="text-muted" />
                        {w.name}
                      </td>
                      <td>
                        <span className={`badge ${w.type === 'main' ? 'badge-info' : 'badge-secondary'}`}>
                          {w.type === 'main' ? 'رئيسي' : 'فرعي'}
                        </span>
                      </td>
                      <td className="text-sm muted">
                        {w.address ? (
                          <div className="flex items-center gap-1">
                            <MapPin size={14} />
                            {w.address}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="font-bold text-center">
                        {warehouseStats[w._id]?.totalItems || 0}
                      </td>
                      <td className="font-bold text-center text-emerald-600">
                        {(warehouseStats[w._id]?.totalValue || 0).toFixed(2)} د.ل
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-ghost p-2"
                            onClick={() => handleOpenModal(w)}
                            title="تعديل"
                          >
                            <Edit2 size={16} className="text-blue-600" />
                          </button>
                          <button
                            className="btn btn-ghost p-2"
                            onClick={() => handleDelete(w._id)}
                            title="حذف"
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Warehouse Dialog */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg" onClose={handleCloseModal}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white">
                <Warehouse size={20} />
              </div>
              {editingItem ? 'تعديل مستودع' : 'إضافة مستودع جديد'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <DialogBody className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">كود المستودع</Label>
                  <Input
                    id="code"
                    required
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    placeholder="WH-01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">اسم المستودع</Label>
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="المستودع الرئيسي"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">نوع المستودع</Label>
                <NativeSelect
                  id="type"
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                >
                  <option value="main">رئيسي</option>
                  <option value="sub">فرعي</option>
                  <option value="van">سيارة توزيع</option>
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  placeholder="المدينة، الحي، الشارع..."
                />
              </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleCloseModal} disabled={saving}>
                إلغاء
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'جاري الحفظ...' : editingItem ? 'حفظ التغييرات' : 'إضافة المستودع'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div >
  )
}
