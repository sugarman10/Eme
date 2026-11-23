import { useEffect, useState, useMemo } from 'react'
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
  ShieldCheck,
  CheckCircle,
  XCircle,
  Lock,
  RefreshCw,
  X,
  Sparkles,
  Warehouse,
  Briefcase,
  Layers,
  Key,
  Check,
  Zap,
  Building2,
  Package,
  Wallet,
  Landmark
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import ProtectedRoute from '../components/ProtectedRoute'
import { PERMISSION_MODULES, ROLE_PRESETS, ALL_PERMISSION_KEYS } from '../constants/permissions'

export default function Users() {
  const { push } = useToast()
  const { isAdmin } = usePermission()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [permissionSearch, setPermissionSearch] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'cashier',
    isAdminAccount: false,
    permissions: ROLE_PRESETS['cashier'] || [],
    department: '',
    assignedWarehouse: ''
  })
  const [warehouses, setWarehouses] = useState([])
  const [saving, setSaving] = useState(false)

  // Load Users & Warehouses
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
      push('error', 'فشل تحميل بيانات المستخدمين')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  // Form Handling
  const handleOpenModal = (user = null) => {
    setPermissionSearch('')
    if (user) {
      const isAdm = user.role === 'admin'
      setEditingId(user._id)
      setFormData({
        name: user.name || '',
        username: user.username || '',
        password: '', // Leave empty for updates
        role: user.role || 'cashier',
        isAdminAccount: isAdm,
        permissions: isAdm ? [...ALL_PERMISSION_KEYS] : (user.permissions?.length > 0 ? user.permissions : (ROLE_PRESETS[user.role || 'cashier'] || [])),
        department: user.department?._id || '',
        assignedWarehouse: user.assignedWarehouse?._id || user.assignedWarehouse || ''
      })
    } else {
      setEditingId(null)
      setFormData({
        name: '',
        username: '',
        password: '',
        role: 'cashier',
        isAdminAccount: false,
        permissions: ROLE_PRESETS['cashier'] || [],
        department: '',
        assignedWarehouse: ''
      })
    }
    setShowModal(true)
  }

  // Toggle Admin vs Staff Account
  const handleAccountTypeChange = (isAdminType) => {
    setFormData(prev => ({
      ...prev,
      isAdminAccount: isAdminType,
      role: isAdminType ? 'admin' : (prev.role === 'admin' ? 'cashier' : prev.role),
      permissions: isAdminType ? [...ALL_PERMISSION_KEYS] : (prev.permissions.length > 0 ? prev.permissions : ROLE_PRESETS['cashier'])
    }))
  }

  // Apply Pre-defined Role Templates
  const handleApplyPreset = (presetKey) => {
    const presetPerms = ROLE_PRESETS[presetKey] || []
    setFormData(prev => ({
      ...prev,
      isAdminAccount: false,
      role: presetKey,
      permissions: [...presetPerms]
    }))
    push('info', `تم تطبيق قالب (${presetKey === 'cashier' ? 'كاشير' : presetKey === 'accountant' ? 'محاسب' : presetKey === 'storekeeper' ? 'أمين مخزن' : 'مدير فرع'})`)
  }

  // Toggle individual permission
  const handleTogglePermission = (permKey) => {
    if (formData.isAdminAccount) return
    setFormData(prev => {
      const perms = prev.permissions || []
      const next = perms.includes(permKey)
        ? perms.filter(k => k !== permKey)
        : [...perms, permKey]
      return { ...prev, permissions: next }
    })
  }

  // Toggle all permissions in a specific module
  const handleToggleModuleAll = (modulePerms, shouldSelect) => {
    if (formData.isAdminAccount) return
    const keys = modulePerms.map(p => p.key)
    setFormData(prev => {
      const current = new Set(prev.permissions || [])
      keys.forEach(k => {
        if (shouldSelect) current.add(k)
        else current.delete(k)
      })
      return { ...prev, permissions: Array.from(current) }
    })
  }

  // Select/Deselect All
  const handleSelectAllPermissions = () => {
    setFormData(prev => ({ ...prev, permissions: [...ALL_PERMISSION_KEYS] }))
  }

  const handleDeselectAllPermissions = () => {
    if (formData.isAdminAccount) return
    setFormData(prev => ({ ...prev, permissions: [] }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        username: formData.username,
        role: formData.isAdminAccount ? 'admin' : (formData.role === 'admin' ? 'cashier' : formData.role),
        permissions: formData.isAdminAccount ? ALL_PERMISSION_KEYS : formData.permissions,
        department: formData.department || null,
        assignedWarehouse: formData.assignedWarehouse || null
      }

      if (formData.password) {
        payload.password = formData.password
      }

      if (editingId) {
        await api.put(`/users/${editingId}`, payload)
        push('success', 'تم تحديث بيانات وصلاحيات المستخدم بنجاح')
      } else {
        if (!formData.password) {
          push('error', 'كلمة المرور مطلوبة لإنشاء حساب جديد')
          setSaving(false)
          return
        }
        await api.post('/users', payload)
        push('success', 'تم إنشاء المستخدم وتعيين الصلاحيات بنجاح')
      }

      setShowModal(false)
      loadUsers()
    } catch (err) {
      push('error', err?.response?.data?.message || 'فشل حفظ بيانات المستخدم')
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
      push('error', 'فشل تغيير حالة المستخدم')
    }
  }

  // Search Filter for Users Table
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  )

  // Filtered permission modules inside modal based on permissionSearch
  const filteredModules = useMemo(() => {
    if (!permissionSearch.trim()) return PERMISSION_MODULES
    const term = permissionSearch.toLowerCase().trim()
    return PERMISSION_MODULES.map(mod => {
      const matchedPerms = mod.permissions.filter(p =>
        p.label.toLowerCase().includes(term) ||
        p.desc.toLowerCase().includes(term) ||
        p.key.toLowerCase().includes(term)
      )
      if (matchedPerms.length === 0) return null
      return { ...mod, permissions: matchedPerms }
    }).filter(Boolean)
  }, [permissionSearch])

  return (
    <ProtectedRoute roles={['admin']}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-300">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">المستخدمين وإدارة الصلاحيات</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">التحكم الدقيق في حسابات الموظفين، الأدوار، وقفل الفروع والمخازن</p>
              </div>
            </div>
          </div>
          <Button onClick={() => handleOpenModal()} className="bg-primary hover:bg-primary/90 text-white font-bold gap-2">
            <Plus size={18} />
            إضافة مستخدم جديد
          </Button>
        </div>

        {/* Users Table Card */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                className="!pr-10 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs"
                placeholder="بحث بالاسم أو اسم المستخدم..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold text-xs">
                  <TableHead className="text-right">الموظف / الاسم</TableHead>
                  <TableHead className="text-right">اسم المستخدم</TableHead>
                  <TableHead className="text-right">نوع الحساب والصلاحيات</TableHead>
                  <TableHead className="text-right">الفرع / المستودع المخصص</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center w-28">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center p-12 text-slate-500 font-bold text-xs">جاري التحميل...</TableCell></TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center p-12 text-slate-500 font-bold text-xs">لا يوجد مستخدمين مطابقين</TableCell></TableRow>
                ) : (
                  filteredUsers.map(user => {
                    const isAdm = user.role === 'admin'
                    const permCount = isAdm ? ALL_PERMISSION_KEYS.length : (user.permissions?.length || 0)

                    return (
                      <TableRow key={user._id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${!user.isActive ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shadow-xs ${
                              isAdm
                                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                                : 'bg-primary/10 text-primary border border-primary/20'
                            }`}>
                              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-black text-xs text-slate-900 dark:text-white">{user.name}</div>
                              {user.department && (
                                <div className="text-[10px] text-slate-400 font-medium">{user.department.name || ''}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            @{user.username}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isAdm ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Sparkles size={12} className="text-amber-600 dark:text-amber-400" />
                                مدير نظام (كامل الصلاحيات)
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  <Key size={11} className="text-primary" />
                                  {permCount} صلاحية مخصصة
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {user.assignedWarehouse ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <Warehouse size={12} className="text-purple-600 dark:text-purple-400" />
                              <span>{user.assignedWarehouse.name || 'مستودع مخصص'}</span>
                              <Lock size={10} className="text-purple-500" />
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">كل المستودعات (غير مقيد)</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {user.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle size={11} /> نشط
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                              <XCircle size={11} /> محظور
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenModal(user)}
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="تعديل الصلاحيات والبيانات"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleStatus(user)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                user.isActive
                                  ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                              title={user.isActive ? 'حظر الحساب' : 'تفعيل الحساب'}
                            >
                              {user.isActive ? <Lock size={14} /> : <CheckCircle size={14} />}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create / Edit User & Permissions Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-primary-400">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-base">
                      {editingId ? 'تعديل بيانات وصلاحيات المستخدم' : 'إنشاء حساب مستخدم جديد'}
                    </h3>
                    <p className="text-xs text-slate-300 font-medium">بناء الصلاحيات الدقيقة وتحديد الفرع المخصص</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 space-y-4 overflow-y-auto max-h-[66vh]">
                  {/* Basic Credentials */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الاسم الكامل <span className="text-rose-500">*</span></label>
                      <Input
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="اسم الموظف أو المستخدم"
                        className="text-xs bg-slate-50 dark:bg-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم المستخدم (للدخول) <span className="text-rose-500">*</span></label>
                      <Input
                        required
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                        placeholder="username"
                        className="text-xs font-mono bg-slate-50 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        كلمة المرور {!editingId && <span className="text-rose-500">*</span>}
                      </label>
                      <Input
                        type="password"
                        required={!editingId}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                        placeholder={editingId ? 'اتركه فارغاً للإبقاء على الحالية' : '********'}
                        className="text-xs bg-slate-50 dark:bg-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        الفرع / المخزن المخصص (العزل الجغرافي)
                      </label>
                      <select
                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary outline-none"
                        value={formData.assignedWarehouse}
                        onChange={e => setFormData({ ...formData, assignedWarehouse: e.target.value })}
                      >
                        <option value="">-- غير مقيد (حرية الوصول لكافة الفروع) --</option>
                        {warehouses.map(w => (
                          <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        * عند تحديد فرع معين، سيتم قفل نقطة البيع والأرصدة على هذا الفرع فقط ولن يرى غيره.
                      </p>
                    </div>
                  </div>

                  {/* Account Type Selection (No legacy role dropdown!) */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="text-xs font-black text-slate-800 dark:text-white flex items-center justify-between">
                      <span>نوع الحساب ومستوى الوصول:</span>
                      {formData.isAdminAccount ? (
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                          مدير نظام (شامل)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {formData.permissions?.length || 0} من {ALL_PERMISSION_KEYS.length} صلاحية
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Option 1: Custom Staff */}
                      <button
                        type="button"
                        onClick={() => handleAccountTypeChange(false)}
                        className={`p-3 rounded-xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                          !formData.isAdminAccount
                            ? 'bg-primary/10 border-primary text-primary-950 dark:text-primary-200 ring-2 ring-primary/30'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                          <UsersIcon size={16} />
                        </div>
                        <div>
                          <div className="font-black text-xs">موظف بصلاحيات مخصصة</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            تحديد الصلاحيات بدقة أو عبر القوالب الجاهزة
                          </div>
                        </div>
                      </button>

                      {/* Option 2: System Admin */}
                      <button
                        type="button"
                        onClick={() => handleAccountTypeChange(true)}
                        className={`p-3 rounded-xl border text-right transition-all flex items-start gap-3 cursor-pointer ${
                          formData.isAdminAccount
                            ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/30'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <div className="font-black text-xs flex items-center gap-1">
                            <span>مدير نظام (Admin)</span>
                            <span className="text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-1 rounded">كامل الصلاحيات</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            وصول مطلق لكافة الإعدادات والتقارير والعمليات
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Smart Presets & Fine-grained Permissions Matrix (Active for Staff) */}
                  {!formData.isAdminAccount ? (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 space-y-4">
                      {/* One-Click Presets Toolbar */}
                      <div className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Zap size={14} className="text-amber-500" />
                          <span>قوالب الصلاحيات السريعة (تطبيق بنقرة واحدة):</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplyPreset('cashier')}
                            className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>⚡</span>
                            <span>كاشير مبيعات</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPreset('accountant')}
                            className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>💼</span>
                            <span>محاسب مالي</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPreset('storekeeper')}
                            className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>📦</span>
                            <span>أمين مخزن</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPreset('manager')}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>🏢</span>
                            <span>مدير فرع</span>
                          </button>
                          <div className="mr-auto flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={handleSelectAllPermissions}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-[11px] font-bold cursor-pointer"
                            >
                              تحديد الكل
                            </button>
                            <button
                              type="button"
                              onClick={handleDeselectAllPermissions}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded text-[11px] font-bold cursor-pointer"
                            >
                              تفريغ الكل
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Permission Search Filter */}
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                          type="text"
                          value={permissionSearch}
                          onChange={e => setPermissionSearch(e.target.value)}
                          placeholder="ابحث عن صلاحية معينة (مثل: سعر الصرف، فواتير، حذف، رواتب)..."
                          className="w-full pr-9 pl-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none focus:border-primary"
                        />
                      </div>

                      {/* Grouped Modules */}
                      <div className="space-y-3">
                        {filteredModules.map(module => {
                          const moduleKeys = module.permissions.map(p => p.key)
                          const activeCount = moduleKeys.filter(k => formData.permissions?.includes(k)).length
                          const isAllActive = activeCount === moduleKeys.length

                          return (
                            <div key={module.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                                  <span className="font-black text-xs text-slate-900 dark:text-white">{module.category}</span>
                                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">
                                    {activeCount} / {moduleKeys.length}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleModuleAll(module.permissions, !isAllActive)}
                                  className="text-[11px] font-bold text-slate-500 hover:text-primary transition-colors cursor-pointer"
                                >
                                  {isAllActive ? 'إلغاء القسم' : 'تحديد كل القسم'}
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                {module.permissions.map(perm => {
                                  const isChecked = formData.permissions?.includes(perm.key)
                                  return (
                                    <label
                                      key={perm.key}
                                      className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                                        isChecked
                                          ? 'bg-primary/5 dark:bg-primary/10 border-primary/40 text-slate-900 dark:text-white font-bold shadow-2xs'
                                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleTogglePermission(perm.key)}
                                        className="mt-0.5 accent-primary rounded cursor-pointer shrink-0"
                                      />
                                      <div className="flex-1">
                                        <div className="text-xs leading-snug">{perm.label}</div>
                                        <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">{perm.desc}</div>
                                      </div>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
                        <Sparkles size={24} />
                      </div>
                      <h4 className="text-sm font-black text-amber-900 dark:text-amber-200">حساب مدير نظام بصلاحيات كاملة</h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 max-w-md mx-auto leading-relaxed">
                        يتمتع هذا المستخدم بكامل الصلاحيات الإدارية والمالية والتشغيلية المتاحة في النظام، دون أي قيود أو حجب.
                      </p>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex justify-end gap-2 shrink-0">
                  <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={saving} className="text-xs">
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={saving} className="min-w-[130px] font-bold text-xs bg-primary hover:bg-primary/90 text-white gap-1.5">
                    {saving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                    {saving ? 'جاري الحفظ...' : 'حفظ البيانات والصلاحيات'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}
