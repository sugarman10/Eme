import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
    Users,
    Plus,
    Edit2,
    Trash2,
    Search,
    Phone,
    Briefcase,
    DollarSign,
    Calendar,
    X,
    Shield,
    Lock,
    Key,
    CheckCircle,
    XCircle,
    UserCheck,
    Building,
    Check,
    Sparkles,
    Sliders,
    Eye,
    EyeOff
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { PERMISSION_MODULES, ROLE_PRESETS, ALL_PERMISSION_KEYS } from '../constants/permissions'

export default function Employees() {
    const { push } = useToast()
    const navigate = useNavigate()
    const [employees, setEmployees] = useState([])
    const [warehouses, setWarehouses] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    // Modal & Form State
    const [showModal, setShowModal] = useState(false)
    const [modalTab, setModalTab] = useState('basic') // 'basic' | 'account'
    const [editingId, setEditingId] = useState(null)
    const [showPassword, setShowPassword] = useState(false)

    // Form: Employee Info & Salary
    const [form, setForm] = useState({
        name: '',
        position: '',
        phone: '',
        baseSalary: 0,
        housingAllowance: 0,
        transportAllowance: 0,
        joinDate: new Date().toISOString().split('T')[0]
    })

    // Form: User Account & Permissions
    const [hasUserAccount, setHasUserAccount] = useState(false)
    const [userData, setUserData] = useState({
        username: '',
        password: '',
        role: 'cashier',
        permissions: ROLE_PRESETS['cashier'] || [],
        assignedWarehouse: ''
    })

    const [saving, setSaving] = useState(false)

    const loadData = async () => {
        setLoading(true)
        try {
            const [empsRes, whRes] = await Promise.all([
                api.get('/hr/employees'),
                api.get('/inventory/warehouses').catch(() => ({ data: [] }))
            ])
            setEmployees(empsRes.data || [])
            setWarehouses(whRes.data || [])
        } catch (err) {
            console.error('Failed to load employees', err)
            if (err?.response?.status === 404) {
                setEmployees([])
            } else {
                push('error', 'فشل تحميل بيانات الموظفين')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [])

    const handleOpenModal = (emp = null) => {
        setModalTab('basic')
        setShowPassword(false)
        if (emp) {
            setEditingId(emp._id)
            setForm({
                name: emp.name || '',
                position: emp.position || '',
                phone: emp.phone || '',
                baseSalary: emp.salaryDetails?.baseSalary || 0,
                housingAllowance: emp.salaryDetails?.housingAllowance || 0,
                transportAllowance: emp.salaryDetails?.transportAllowance || 0,
                joinDate: emp.joinDate ? emp.joinDate.split('T')[0] : new Date().toISOString().split('T')[0]
            })

            if (emp.user) {
                setHasUserAccount(true)
                setUserData({
                    username: emp.user.username || '',
                    password: '',
                    role: emp.user.role || 'cashier',
                    permissions: emp.user.permissions?.length > 0 ? emp.user.permissions : (ROLE_PRESETS[emp.user.role || 'cashier'] || []),
                    assignedWarehouse: emp.user.assignedWarehouse?._id || emp.user.assignedWarehouse || ''
                })
            } else {
                setHasUserAccount(false)
                setUserData({
                    username: '',
                    password: '',
                    role: 'cashier',
                    permissions: ROLE_PRESETS['cashier'] || [],
                    assignedWarehouse: ''
                })
            }
        } else {
            setEditingId(null)
            setForm({
                name: '',
                position: '',
                phone: '',
                baseSalary: 0,
                housingAllowance: 0,
                transportAllowance: 0,
                joinDate: new Date().toISOString().split('T')[0]
            })
            setHasUserAccount(false)
            setUserData({
                username: '',
                password: '',
                role: 'cashier',
                permissions: ROLE_PRESETS['cashier'] || [],
                assignedWarehouse: ''
            })
        }
        setShowModal(true)
    }

    const handleRoleChange = (newRole) => {
        setUserData(prev => ({
            ...prev,
            role: newRole,
            permissions: ROLE_PRESETS[newRole] || prev.permissions
        }))
    }

    const handleTogglePermission = (permKey) => {
        setUserData(prev => {
            const perms = prev.permissions || []
            const next = perms.includes(permKey)
                ? perms.filter(k => k !== permKey)
                : [...perms, permKey]
            return { ...prev, permissions: next }
        })
    }

    const handleToggleModuleAll = (modulePerms, shouldSelect) => {
        const keys = modulePerms.map(p => p.key)
        setUserData(prev => {
            const current = new Set(prev.permissions || [])
            keys.forEach(k => {
                if (shouldSelect) current.add(k)
                else current.delete(k)
            })
            return { ...prev, permissions: Array.from(current) }
        })
    }

    const handleSelectAllPermissions = () => {
        setUserData(prev => ({
            ...prev,
            permissions: [...ALL_PERMISSION_KEYS],
            role: prev.role === 'cashier' ? 'admin' : prev.role
        }))
    }

    const handleDeselectAllPermissions = () => {
        setUserData(prev => ({ ...prev, permissions: [] }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (hasUserAccount) {
            if (!userData.username?.trim()) {
                setModalTab('account')
                return push('error', 'يرجى كتابة اسم المستخدم للدخول')
            }
            if (!editingId && !userData.password?.trim()) {
                setModalTab('account')
                return push('error', 'يرجى كتابة كلمة المرور للمستخدم الجديد')
            }
        }

        setSaving(true)
        try {
            const payload = {
                name: form.name,
                position: form.position,
                phone: form.phone,
                joinDate: form.joinDate,
                salaryDetails: {
                    baseSalary: Number(form.baseSalary) || 0,
                    housingAllowance: Number(form.housingAllowance) || 0,
                    transportAllowance: Number(form.transportAllowance) || 0
                },
                hasUserAccount,
                userData: hasUserAccount ? userData : null
            }

            if (editingId) {
                await api.put(`/hr/employees/${editingId}`, payload)
                push('success', 'تم تحديث بيانات الموظف بنجاح')
            } else {
                await api.post('/hr/employees', payload)
                push('success', 'تم إضافة الموظف وحسابه بنجاح')
            }
            setShowModal(false)
            loadData()
        } catch (err) {
            console.error(err)
            push('error', err?.response?.data?.message || 'فشل حفظ بيانات الموظف')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الموظف؟ (سيتم تعطيل حسابه المرتبط إن وجد)')) return
        try {
            await api.delete(`/hr/employees/${id}`)
            push('success', 'تم حذف الموظف')
            loadData()
        } catch (err) {
            push('error', 'فشل الحذف')
        }
    }

    const filtered = employees.filter(e =>
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.phone?.includes(search) ||
        e.position?.toLowerCase().includes(search.toLowerCase()) ||
        e.user?.username?.toLowerCase().includes(search.toLowerCase())
    )

    const formatCurrency = (val) => Number(val || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$', '') + ' د.ل'

    const totalCalculatedSalary = (Number(form.baseSalary) || 0) + (Number(form.housingAllowance) || 0) + (Number(form.transportAllowance) || 0)

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin':
                return <span className="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full text-[11px] font-bold">مدير نظام</span>
            case 'manager':
                return <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full text-[11px] font-bold">مدير مسؤول</span>
            case 'accountant':
                return <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-bold">محاسب</span>
            case 'cashier':
            default:
                return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-bold">كاشير</span>
        }
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-100">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                        <Users className="text-pink-600" />
                        الموارد البشرية والموظفين
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">إدارة بيانات الموظفين، الرواتب والبدلات، وحسابات الدخول والصلاحيات الدقيقة في المنظومة</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md cursor-pointer flex items-center gap-2">
                    <Plus size={18} />
                    إضافة موظف جديد
                </Button>
            </div>

            {/* List Card */}
            <Card className="border-slate-100 shadow-xs">
                <CardHeader className="flex flex-row items-center justify-between pb-4 bg-slate-50/50 border-b border-slate-100">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                            className="!pr-14 bg-white"
                            placeholder="بحث بالاسم، المسمى، الهاتف، أو اسم المستخدم..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50">
                                <TableHead className="font-bold">الموظف</TableHead>
                                <TableHead className="font-bold">المسمى الوظيفي</TableHead>
                                <TableHead className="font-bold">الهاتف</TableHead>
                                <TableHead className="font-bold">الراتب والبدلات</TableHead>
                                <TableHead className="font-bold">حساب المنظومة والدور</TableHead>
                                <TableHead className="font-bold">تاريخ التعيين</TableHead>
                                <TableHead className="w-24 text-center font-bold">إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center p-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center p-8 text-muted-foreground">لا يوجد موظفين مطابقين</TableCell></TableRow>
                            ) : (
                                filtered.map(emp => {
                                    const totalSalary =
                                        (emp.salaryDetails?.baseSalary || 0) +
                                        (emp.salaryDetails?.housingAllowance || 0) +
                                        (emp.salaryDetails?.transportAllowance || 0);

                                    return (
                                        <TableRow key={emp._id} className="hover:bg-slate-50/70 transition-colors">
                                            <TableCell className="font-medium">
                                                <div
                                                    onClick={() => navigate(`/employees/${emp._id}`)}
                                                    className="flex items-center gap-2 hover:text-pink-600 transition-colors cursor-pointer"
                                                >
                                                    <div className="w-9 h-9 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-sm font-black shrink-0">
                                                        {emp.name?.charAt(0) || 'م'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800">{emp.name}</div>
                                                        {emp.salaryDetails?.baseSalary > 0 && (
                                                            <div className="text-[11px] text-slate-400 font-mono">أساسي: {formatCurrency(emp.salaryDetails.baseSalary)}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold border-slate-200 bg-slate-100/70 text-slate-700 gap-1.5">
                                                    <Briefcase size={12} className="text-pink-600" /> {emp.position}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-slate-600">{emp.phone || '-'}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <span className="font-black text-emerald-600 font-mono text-sm block" dir="ltr">{formatCurrency(totalSalary)}</span>
                                                    {(emp.salaryDetails?.housingAllowance > 0 || emp.salaryDetails?.transportAllowance > 0) && (
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            بدلات: +{formatCurrency((emp.salaryDetails.housingAllowance || 0) + (emp.salaryDetails.transportAllowance || 0))}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {emp.user ? (
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800">
                                                            <UserCheck size={13} className="text-emerald-600" />
                                                            <span>@{emp.user.username}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {emp.user.role === 'admin' ? (
                                                                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">مدير النظام</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">حساب نشط</span>
                                                            )}
                                                            <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md font-mono">
                                                                {emp.user.permissions?.length || 0} صلاحية
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                        <XCircle size={13} className="text-slate-300" /> بدون حساب دخول
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-500 font-mono">
                                                {emp.joinDate ? new Date(emp.joinDate).toLocaleDateString('ar-LY') : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenModal(emp)}
                                                        className="h-8 w-8 hover:bg-blue-50 text-blue-600 cursor-pointer"
                                                        title="تعديل الموظف والصلاحيات"
                                                    >
                                                        <Edit2 size={15} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(emp._id)}
                                                        className="h-8 w-8 hover:bg-red-50 text-red-500 cursor-pointer"
                                                        title="حذف"
                                                    >
                                                        <Trash2 size={15} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create/Edit Modal with Tabs */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border-0 overflow-hidden rounded-2xl bg-white">
                        {/* Modal Header */}
                        <CardHeader className="bg-gradient-to-r from-pink-600 via-pink-700 to-slate-900 text-white p-5 flex flex-row justify-between items-center shrink-0">
                            <div>
                                <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                                    {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
                                    {editingId ? 'تعديل بيانات الموظف وصلاحياته' : 'إضافة موظف جديد وتعيين الصلاحيات'}
                                </CardTitle>
                                <p className="text-xs text-pink-100 mt-0.5">تحكم كامل في الراتب، البدلات، وحساب المستخدم والصلاحيات الدقيقة</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowModal(false)} className="text-white hover:bg-white/20 rounded-xl cursor-pointer">
                                <X size={20} />
                            </Button>
                        </CardHeader>

                        {/* Tabs Switcher */}
                        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 pt-2 gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setModalTab('basic')}
                                className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                                    modalTab === 'basic'
                                        ? 'bg-white text-pink-700 border-pink-600 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 border-transparent'
                                }`}
                            >
                                <Users size={15} />
                                <span>البيانات الوظيفية والراتب</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setModalTab('account')}
                                className={`py-2.5 px-4 font-bold text-xs rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                                    modalTab === 'account'
                                        ? 'bg-white text-purple-700 border-purple-600 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 border-transparent'
                                }`}
                            >
                                <Shield size={15} />
                                <span>حساب المنظومة والصلاحيات</span>
                                {hasUserAccount && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                )}
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 overflow-y-auto space-y-5 flex-1 max-h-[62vh]">
                                {modalTab === 'basic' ? (
                                    <div className="space-y-4">
                                        {/* Personal & Position Info */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700">اسم الموظف الكامل <span className="text-rose-500">*</span></label>
                                                <div className="relative">
                                                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <Input
                                                        required
                                                        className="!pr-14 font-medium"
                                                        value={form.name}
                                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                                        placeholder="مثال: أحمد عبد الله"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700">المسمى الوظيفي <span className="text-rose-500">*</span></label>
                                                <div className="relative">
                                                    <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <Input
                                                        required
                                                        className="!pr-14 font-medium"
                                                        value={form.position}
                                                        onChange={e => setForm({ ...form, position: e.target.value })}
                                                        placeholder="مثال: كاشير مبيعات / محاسب"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700">رقم الهاتف</label>
                                                <div className="relative">
                                                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <Input
                                                        className="!pr-14 font-mono text-sm"
                                                        value={form.phone}
                                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                                        placeholder="09XXXXXXXX"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700">تاريخ التعيين</label>
                                                <div className="relative">
                                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <Input
                                                        type="date"
                                                        required
                                                        className="!pr-14 font-mono"
                                                        value={form.joinDate}
                                                        onChange={e => setForm({ ...form, joinDate: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Salary & Allowances Section */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                    <DollarSign size={16} className="text-emerald-600" />
                                                    الراتب والبدلات الشهرية
                                                </h4>
                                                <div className="text-xs font-black text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                                                    الإجمالي: {formatCurrency(totalCalculatedSalary)}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold text-slate-600">الراتب الأساسي</label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        className="font-mono font-bold text-slate-800"
                                                        value={form.baseSalary}
                                                        onChange={e => setForm({ ...form, baseSalary: e.target.value })}
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold text-slate-600">بدل السكن</label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        className="font-mono text-slate-700"
                                                        value={form.housingAllowance}
                                                        onChange={e => setForm({ ...form, housingAllowance: e.target.value })}
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-[11px] font-bold text-slate-600">بدل النقل</label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        className="font-mono text-slate-700"
                                                        value={form.transportAllowance}
                                                        onChange={e => setForm({ ...form, transportAllowance: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Account Enable Banner */}
                                        <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3.5 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                                                    <Shield size={16} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-purple-900">هل يحتاج هذا الموظف حساب دخول للمنظومة؟</div>
                                                    <div className="text-[11px] text-purple-700">تخصيص اسم مستخدم، كلمة سر، وصلاحيات دقيقة</div>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setHasUserAccount(!hasUserAccount)
                                                    setModalTab('account')
                                                }}
                                                className={`text-xs font-bold cursor-pointer ${
                                                    hasUserAccount ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-700 border-purple-300'
                                                }`}
                                            >
                                                {hasUserAccount ? 'مفعل (اضبط الصلاحيات)' : 'تفعيل الحساب الآن'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Tab 2: User Account & Fine-grained Permissions */
                                    <div className="space-y-5 animate-in fade-in duration-200">
                                        {/* Toggle Active Switch */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasUserAccount ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                    <Shield size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-sm text-slate-800">حساب تسجيل دخول للمنظومة</h4>
                                                    <p className="text-xs text-slate-500">تمكين الموظف من استخدام النظام بحساب وكلمة مرور وصلاحيات محددة</p>
                                                </div>
                                            </div>

                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={hasUserAccount}
                                                    onChange={e => setHasUserAccount(e.target.checked)}
                                                />
                                                <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                            </label>
                                        </div>

                                        {hasUserAccount && (
                                            <div className="space-y-4">
                                                {/* Credentials */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-700">اسم المستخدم للدخول <span className="text-rose-500">*</span></label>
                                                        <div className="relative">
                                                            <Key className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                            <Input
                                                                required={hasUserAccount}
                                                                className="!pr-14 font-mono font-bold text-purple-900"
                                                                value={userData.username}
                                                                onChange={e => setUserData({ ...userData, username: e.target.value })}
                                                                placeholder="username"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-bold text-slate-700">
                                                            كلمة المرور {!editingId && <span className="text-rose-500">*</span>}
                                                        </label>
                                                        <div className="relative">
                                                            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                            <Input
                                                                type={showPassword ? 'text' : 'password'}
                                                                required={hasUserAccount && !editingId}
                                                                className="!pr-14 !pl-10 font-mono"
                                                                value={userData.password}
                                                                onChange={e => setUserData({ ...userData, password: e.target.value })}
                                                                placeholder={editingId ? 'اتركه فارغاً للإبقاء على الحالية' : '********'}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPassword(!showPassword)}
                                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                                            >
                                                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Assigned Warehouse */}
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-bold text-slate-700">المستودع أو الفرع المخصص (اختياري)</label>
                                                    <select
                                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:ring-2 focus:ring-purple-500"
                                                        value={userData.assignedWarehouse}
                                                        onChange={e => setUserData({ ...userData, assignedWarehouse: e.target.value })}
                                                    >
                                                        <option value="">-- كافة المستودعات والفروع (حرية التنقل) --</option>
                                                        {warehouses.map(w => (
                                                            <option key={w._id} value={w._id}>{w.name}</option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[10px] text-slate-400">حصر عمليات البيع والصرف على مستودع محدد فقط (أو إتاحة كافة المستودعات حسب الصلاحيات).</p>
                                                </div>

                                                {/* Permissions Matrix */}
                                                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-200">
                                                        <div>
                                                            <h5 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                                                                <Sliders size={16} className="text-purple-600" />
                                                                التحكم الدقيق في الصلاحيات
                                                            </h5>
                                                            <p className="text-[11px] text-slate-500">
                                                                تم تفعيل <span className="font-bold text-purple-700 font-mono">{userData.permissions?.length || 0}</span> من أصل <span className="font-bold font-mono">{ALL_PERMISSION_KEYS.length}</span> صلاحية
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={handleSelectAllPermissions}
                                                                className="text-[11px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-lg cursor-pointer"
                                                            >
                                                                تحديد الكل
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleDeselectAllPermissions}
                                                                className="text-[11px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-lg cursor-pointer"
                                                            >
                                                                إلغاء الكل
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRoleChange(userData.role)}
                                                                className="text-[11px] font-bold bg-purple-100 text-purple-800 hover:bg-purple-200 px-2.5 py-1 rounded-lg cursor-pointer"
                                                                title="إعادة ضبط الصلاحيات حسب الدور المحدد"
                                                            >
                                                                ضبط للدور
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Modules Accordion / Cards */}
                                                    <div className="space-y-3">
                                                        {PERMISSION_MODULES.map(module => {
                                                            const moduleKeys = module.permissions.map(p => p.key)
                                                            const activeCount = moduleKeys.filter(k => userData.permissions?.includes(k)).length
                                                            const isAllActive = activeCount === moduleKeys.length

                                                            return (
                                                                <div key={module.id} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                                                                            <span className="font-black text-xs text-slate-800">{module.category}</span>
                                                                            <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-bold">
                                                                                {activeCount} / {moduleKeys.length}
                                                                            </span>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleToggleModuleAll(module.permissions, !isAllActive)}
                                                                            className="text-[10px] font-bold text-slate-500 hover:text-purple-600 underline cursor-pointer"
                                                                        >
                                                                            {isAllActive ? 'إلغاء القسم' : 'تحديد كل القسم'}
                                                                        </button>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                                                        {module.permissions.map(perm => {
                                                                            const isChecked = userData.permissions?.includes(perm.key)
                                                                            return (
                                                                                <label
                                                                                    key={perm.key}
                                                                                    className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                                                                        isChecked
                                                                                            ? 'bg-purple-50/60 border-purple-200 text-purple-950'
                                                                                            : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-100'
                                                                                    }`}
                                                                                >
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={() => handleTogglePermission(perm.key)}
                                                                                        className="mt-0.5 text-purple-600 rounded focus:ring-purple-500"
                                                                                    />
                                                                                    <div>
                                                                                        <div className="font-bold">{perm.label}</div>
                                                                                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{perm.desc}</div>
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
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-between items-center shrink-0">
                                <div className="text-xs text-slate-500">
                                    {modalTab === 'basic' ? (
                                        <span>الراتب الإجمالي: <strong className="text-emerald-700 font-mono">{formatCurrency(totalCalculatedSalary)}</strong></span>
                                    ) : (
                                        <span>الحساب: <strong className={hasUserAccount ? 'text-purple-700' : 'text-slate-400'}>{hasUserAccount ? 'مفعل ومربوط' : 'غير مفعل'}</strong></span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={saving} className="cursor-pointer">
                                        إلغاء
                                    </Button>
                                    <Button type="submit" disabled={saving} className="bg-pink-600 hover:bg-pink-700 text-white font-bold cursor-pointer">
                                        {saving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'إضافة الموظف')}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    )
}
