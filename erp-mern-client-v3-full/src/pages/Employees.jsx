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
    X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'

export default function Employees() {
    const { push } = useToast()
    const navigate = useNavigate()
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')

    // Modal & Form
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({
        name: '',
        position: '',
        phone: '',
        baseSalary: 0,
        housingAllowance: 0,
        transportAllowance: 0,
        joinDate: new Date().toISOString().split('T')[0]
    })
    const [saving, setSaving] = useState(false)

    const loadEmployees = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/hr/employees')
            setEmployees(data || [])
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

    useEffect(() => { loadEmployees() }, [])

    const handleOpenModal = (emp = null) => {
        if (emp) {
            setEditingId(emp._id)
            setForm({
                name: emp.name,
                position: emp.position,
                phone: emp.phone,
                baseSalary: emp.salaryDetails?.baseSalary || 0,
                housingAllowance: emp.salaryDetails?.housingAllowance || 0,
                transportAllowance: emp.salaryDetails?.transportAllowance || 0,
                joinDate: emp.joinDate ? emp.joinDate.split('T')[0] : ''
            })
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
        }
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const payload = {
                name: form.name,
                position: form.position,
                phone: form.phone,
                joinDate: form.joinDate,
                salaryDetails: {
                    baseSalary: Number(form.baseSalary),
                    housingAllowance: Number(form.housingAllowance),
                    transportAllowance: Number(form.transportAllowance)
                }
            };

            if (editingId) {
                await api.put(`/hr/employees/${editingId}`, payload)
                push('success', 'تم تحديث بيانات الموظف')
            } else {
                await api.post('/hr/employees', payload)
                push('success', 'تم إضافة الموظف بنجاح')
            }
            setShowModal(false)
            loadEmployees()
        } catch (err) {
            console.error(err)
            push('error', err?.response?.data?.message || 'فشل الحفظ')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) return
        try {
            await api.delete(`/hr/employees/${id}`)
            push('success', 'تم حذف الموظف')
            loadEmployees()
        } catch (err) {
            push('error', 'فشل الحذف')
        }
    }

    const filtered = employees.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.phone.includes(search)
    )

    const formatCurrency = (val) => Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$', '') + ' د.ل';

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">الموظفين</h1>
                    <p className="text-muted-foreground">إدارة الموارد البشرية وشؤون الموظفين</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <Plus size={18} className="mr-2" />
                    إضافة موظف
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input
                            className="!pr-14"
                            placeholder="بحث بالاسم أو الهاتف..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الاسم</TableHead>
                                <TableHead>الوظيفة</TableHead>
                                <TableHead>الهاتف</TableHead>
                                <TableHead>الراتب الإجمالي</TableHead>
                                <TableHead>تاريخ التعيين</TableHead>
                                <TableHead className="w-24">إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center p-8 text-muted-foreground">لا يوجد موظفين</TableCell></TableRow>
                            ) : (
                                filtered.map(emp => {
                                    const totalSalary =
                                        (emp.salaryDetails?.baseSalary || 0) +
                                        (emp.salaryDetails?.housingAllowance || 0) +
                                        (emp.salaryDetails?.transportAllowance || 0);

                                    return (
                                        <TableRow key={emp._id}>
                                            <TableCell className="font-medium">
                                                <div
                                                    onClick={() => navigate(`/employees/${emp._id}`)}
                                                    className="flex items-center gap-2 hover:text-pink-600 transition-colors cursor-pointer"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                        {emp.name.charAt(0)}
                                                    </div>
                                                    {emp.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 gap-1">
                                                    <Briefcase size={12} /> {emp.position}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-muted-foreground">{emp.phone}</TableCell>
                                            <TableCell className="font-bold text-emerald-600 font-mono" dir="ltr">{formatCurrency(totalSalary)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{new Date(emp.joinDate).toLocaleDateString('ar-LY')}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenModal(emp)}
                                                        className="text-primary"
                                                    >
                                                        <Edit2 size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(emp._id)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 size={16} />
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

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg shadow-xl animate-in fade-in zoom-in duration-200">
                        <CardHeader className="flex flex-row justify-between items-center border-b">
                            <CardTitle>{editingId ? 'تعديل بيانات موظف' : 'إضافة موظف جديد'}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}><X size={20} /></Button>
                        </CardHeader>
                        <form onSubmit={handleSubmit}>
                            <CardContent className="space-y-4 pt-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">الاسم الكامل</label>
                                    <div className="relative">
                                        <Users className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                        <Input required className="!pr-14" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="اسم الموظف" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">المسمى الوظيفي</label>
                                        <div className="relative">
                                            <Briefcase className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                            <Input required className="!pr-14" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="مثال: محاسب" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">رقم الهاتف</label>
                                        <div className="relative">
                                            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                            <Input className="!pr-14" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09XXXXXXXX" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">الأساسي</label>
                                        <Input type="number" min="0" value={form.baseSalary} onChange={e => setForm({ ...form, baseSalary: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">بدل سكن</label>
                                        <Input type="number" min="0" value={form.housingAllowance} onChange={e => setForm({ ...form, housingAllowance: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">بدل نقل</label>
                                        <Input type="number" min="0" value={form.transportAllowance} onChange={e => setForm({ ...form, transportAllowance: e.target.value })} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">تاريخ التعيين</label>
                                    <div className="relative">
                                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                        <Input type="date" required className="!pr-14" value={form.joinDate} onChange={e => setForm({ ...form, joinDate: e.target.value })} />
                                    </div>
                                </div>
                            </CardContent>
                            <div className="p-6 border-t bg-muted/20 flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>إلغاء</Button>
                                <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ البيانات'}</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    )
}
