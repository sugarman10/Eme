import { useEffect, useState } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { usePermission } from '../hooks/usePermission'
import {
  Users as UsersIcon,
  Plus,
  Edit2,
  Trash2,
  Search,
  Shield,
  CheckCircle,
  XCircle,
  Lock,
  RefreshCw,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import ProtectedRoute from '../components/ProtectedRoute'

export default function Users() {
  const { push } = useToast()
  const { isAdmin } = usePermission()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'cashier',
    department: '',
    assignedWarehouse: ''
  })
  const [warehouses, setWarehouses] = useState([])
  const [saving, setSaving] = useState(false)

  // Load Users
  const loadUsers = async () => {
    setLoading(true)
    try {
      const [usersResponse, warehousesResponse] = await Promise.all([
        api.get('/users'),
        api.get('/inventory/warehouses')
      ])
      setUsers(usersResponse.data.items || [])
      setWarehouses(warehousesResponse.data || [])
    } catch (err) {
      console.error(err)
      push('error', 'فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  // Form Handling
  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingId(user._id)
      setFormData({
        name: user.name,
        username: user.username || '',
        password: '', // Leave empty for updates implies no change
        role: user.role,
        department: user.department?._id || '',
        assignedWarehouse: user.assignedWarehouse?._id || ''
      })
    } else {
      setEditingId(null)
      setFormData({
        name: '',
        username: '',
        password: '',
        role: 'cashier',
        department: '',
        assignedWarehouse: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        // Remove password if empty to avoid hashing empty string
        const payload = { ...formData }
        if (!payload.password) delete payload.password

        await api.put(`/users/${editingId}`, payload)
        push('success', 'تم تحديث بيانات المستخدم')
      } else {
        await api.post('/users', formData)
        push('success', 'تم إنشاء المستخدم بنجاح')
      }
      setShowModal(false)
      loadUsers()
    } catch (err) {
      push('error', err?.response?.data?.message || 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (user) => {
    if (!window.confirm(`هل أنت متأكد من ${user.isActive ? 'حظر' : 'تفعيل'} هذا المستخدم؟`)) return
    try {
      await api.patch(`/users/${user._id}/status`)
      push('success', `تم ${user.isActive ? 'حظر' : 'تفعيل'} المستخدم بنجاح`)
      loadUsers()
    } catch (err) {
      push('error', 'فشل تغيير الحالة')
    }
  }

  // Filter
  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  )

  // Role Badge
  const RoleBadge = ({ role }) => {
    const styles = {
      admin: 'bg-rose-100 text-rose-800 border-rose-200',
      manager: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      cashier: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
    const style = styles[role] || 'bg-gray-100 text-gray-800'

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${style} uppercase tracking-wider`}>
        {role}
      </span>
    )
  }

  return (
    <ProtectedRoute roles={['admin']}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">إدارة المستخدمين</h1>
            <p className="text-muted-foreground">صلاحيات النظام وحسابات الموظفين</p>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus size={18} className="mr-2" />
            حساب جديد
          </Button>
        </div>

        <Card>
          <CardHeader className="border-b bg-gray-50/50">
            <div className="relative w-full max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                className="!pr-14 bg-white"
                placeholder="بحث بالاسم أو اسم المستخدم..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>اسم المستخدم</TableHead>
                  <TableHead>الدور (Role)</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead>آخر تسجيل</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">لا يوجد مستخدمين</TableCell></TableRow>
                ) : (
                  filtered.map(user => (
                    <TableRow key={user._id} className={!user.isActive ? 'bg-red-50/50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${!user.isActive ? 'bg-gray-200 text-gray-500' : 'bg-primary/10 text-primary'}`}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{user.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{user.username || '-'}</TableCell>
                      <TableCell><RoleBadge role={user.role} /></TableCell>
                      <TableCell className="text-center">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            <CheckCircle size={12} /> نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                            <XCircle size={12} /> محظور
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ar-LY') : 'لم يتصل'}
                      </TableCell>
                      <TableCell>
                        <div className="flex bg-white border rounded-lg shadow-sm">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-l-none border-l hover:bg-blue-50 hover:text-blue-600" onClick={() => handleOpenModal(user)} title="تعديل">
                            <Edit2 size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 rounded-r-none hover:bg-opacity-50 ${user.isActive ? 'text-red-500 hover:bg-red-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                            onClick={() => toggleStatus(user)}
                            title={user.isActive ? 'حظر' : 'تفعيل'}
                          >
                            {user.isActive ? <Lock size={14} /> : <CheckCircle size={14} />}
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

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-lg shadow-2xl border-0">
              <CardHeader className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-xl flex flex-row justify-between items-center">
                <CardTitle className="text-white">{editingId ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="text-white hover:bg-white/20"><X size={20} /></Button>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">الاسم الكامل</label>
                      <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="الاسم" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">اسم المستخدم (للدخول) <span className="text-red-500">*</span></label>
                      <Input required value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder="username" />
                    </div>
                  </div>



                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">كلمة المرور {!editingId && <span className="text-red-500">*</span>}</label>
                      <Input
                        type="password"
                        required={!editingId}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        placeholder={editingId ? 'اتركه فارغاً للإبقاء عليه' : '********'}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">الدور (الصلاحية)</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                      >
                        <option value="cashier">كاشير (Cashier)</option>
                        <option value="manager">مدير فرع (Manager)</option>
                        <option value="admin">مدير نظام (Admin)</option>
                      </select>
                    </div>

                    {(formData.role === 'cashier' || formData.role === 'manager') && (
                      <div className="space-y-2 col-span-2">
                        <label className="text-sm font-medium">المستودع المخصص (للحماية)</label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData.assignedWarehouse}
                          onChange={e => setFormData({ ...formData, assignedWarehouse: e.target.value })}
                        >
                          <option value="">-- اختياري (حرية التنقل) --</option>
                          {warehouses.map(w => (
                            <option key={w._id} value={w._id}>{w.name}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500">
                          * إذا تم تحديده، سيتم إجبار المستخدم على البيع من هذا المستودع فقط ولن يرى غيره.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Additional permissions could go here */}

                </CardContent>
                <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>إلغاء</Button>
                  <Button type="submit" disabled={saving} className="min-w-[120px]">
                    {saving ? <RefreshCw className="animate-spin mr-2" size={16} /> : <CheckCircle className="mr-2" size={16} />}
                    {saving ? 'جاري الحفظ...' : 'حفظ البيانات'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
