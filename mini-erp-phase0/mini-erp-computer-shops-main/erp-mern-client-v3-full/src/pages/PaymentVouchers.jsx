import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
    ArrowUpRight, Search, X, Eye, Check, FileText, Calendar,
    Building2, Hash, User, Users, Banknote, Receipt, ShoppingCart,
    Split, Trash2, Plus, ChevronDown, XCircle, TrendingDown, Printer
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { TreasurySelector } from '../components/TreasurySelector'
import VoucherPrintModal from '../components/modals/VoucherPrintModal'

// ── helpers ────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('ar-LY') }

const BENEFICIARY_TYPES = [
    { value: 'customer',  label: 'عميل',       icon: Users,       color: 'text-blue-600',   badge: 'bg-blue-50 text-blue-700 border-blue-200'     },
    { value: 'supplier',  label: 'مورد',        icon: Building2,   color: 'text-orange-600', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
    { value: 'expense',   label: 'مصاريف',      icon: Banknote,    color: 'text-red-600',    badge: 'bg-red-50 text-red-700 border-red-200'         },
    { value: 'other',     label: 'أخرى',        icon: FileText,    color: 'text-slate-600',  badge: 'bg-slate-50 text-slate-700 border-slate-200'   },
]

function BeneficiaryBadge({ type }) {
    const t = BENEFICIARY_TYPES.find(b => b.value === type) || BENEFICIARY_TYPES[3]
    const Icon = t.icon
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${t.badge}`}>
            <Icon size={11} />{t.label}
        </span>
    )
}

const methodLabel = (m) => ({
    cash:  { l: 'نقدي',       icon: '💵' },
    bank:  { l: 'تحويل بنكي', icon: '🏦' },
    check: { l: 'شيك',        icon: '📝' },
    split: { l: 'مختلط',      icon: '🔀' },
}[m] || { l: m, icon: '—' })

const EMPTY_FORM = {
    beneficiaryType: 'customer',
    customer: '', supplier: '', beneficiary: '',
    amount: '', method: 'cash', treasury: '', note: '',
    date: new Date().toISOString().split('T')[0],
}

export default function PaymentVouchers() {
    const { push } = useToast()
    const queryClient = useQueryClient()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const customerParam = searchParams.get('customer')
    const supplierParam = searchParams.get('supplier')

    const [view, setView]         = useState('list')  // 'list' | 'new'
    const [q, setQ]               = useState('')
    const [typeTab, setTypeTab]   = useState('all')
    const [viewVoucher, setViewV] = useState(null)
    const [printVoucher, setPrintVoucher] = useState(null)
    const [printAfterSave, setPrintAfterSave] = useState(false)
    const [form, setForm]         = useState(EMPTY_FORM)
    const [splitRows, setSplitRows] = useState([
        { method: 'cash', amount: '', treasury: '' },
        { method: 'bank', amount: '', treasury: '' },
    ])

    useEffect(() => {
        if (customerParam) {
            setForm(f => ({ ...f, beneficiaryType: 'customer', customer: customerParam }))
            setView('new')
        } else if (supplierParam) {
            setForm(f => ({ ...f, beneficiaryType: 'supplier', supplier: supplierParam }))
            setView('new')
        }
    }, [customerParam, supplierParam])

    const setF = (patch) => setForm(f => ({ ...f, ...patch }))

    // ── Data ──────────────────────────────────────────────────────────────
    const { data: vouchers = [], isLoading } = useQuery({
        queryKey: ['payment-vouchers'],
        queryFn: async () => {
            const { data } = await api.get('/finance/payments')
            return data || []
        },
        staleTime: 30_000
    })

    const { data: customers = [] } = useQuery({
        queryKey: ['customers-slim'],
        queryFn: async () => {
            const { data } = await api.get('/customers')
            return (data || []).filter(c => !c.isCashCustomer)
        },
        staleTime: 2 * 60_000,
        enabled: form.beneficiaryType === 'customer' || view === 'new',
    })

    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers-slim'],
        queryFn: async () => {
            const { data } = await api.get('/procurement/suppliers')
            return data || []
        },
        staleTime: 2 * 60_000,
        enabled: form.beneficiaryType === 'supplier' || view === 'new',
    })

    // ── Selected customer/supplier balance ────────────────────────────────
    const selectedCustomer = customers.find(c => c._id === form.customer)
    const selectedSupplier = suppliers.find(s => s._id === form.supplier)

    // ── KPIs ──────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const now = new Date(); now.setHours(0, 0, 0, 0)
        const ms = new Date(now.getFullYear(), now.getMonth(), 1)
        const today = vouchers.filter(v => { const d = new Date(v.date); d.setHours(0,0,0,0); return d.getTime() === now.getTime() && v.status !== 'void' })
        const month = vouchers.filter(v => new Date(v.date) >= ms && v.status !== 'void')
        return {
            today: today.reduce((s, v) => s + (v.amount || 0), 0),
            month: month.reduce((s, v) => s + (v.amount || 0), 0),
            count: vouchers.filter(v => v.status !== 'void').length,
        }
    }, [vouchers])

    // ── Filter ────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        return vouchers.filter(v => {
            if (typeTab !== 'all' && v.beneficiaryType !== typeTab) return false
            if (!q) return true
            const s = q.toLowerCase()
            const name = (v.customer?.name || v.supplier?.name || v.beneficiary || '').toLowerCase()
            return name.includes(s) || (v.note || '').toLowerCase().includes(s) || v._id.includes(s) || (v.number || '').toLowerCase().includes(s)
        })
    }, [vouchers, q, typeTab])

    // ── Mutations ─────────────────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            const { data } = await api.post('/finance/payments', payload)
            return data
        },
        onSuccess: (savedData) => {
            push('success', 'تم حفظ سند الدفع بنجاح ✓')
            queryClient.invalidateQueries(['payment-vouchers'])
            queryClient.invalidateQueries(['customers'])
            queryClient.invalidateQueries(['customer-payments'])
            queryClient.invalidateQueries(['customer'])
            queryClient.invalidateQueries(['suppliers-balance'])
            queryClient.invalidateQueries(['treasuries'])
            queryClient.invalidateQueries(['transactions'])
            if (printAfterSave && savedData) {
                setPrintVoucher({ ...savedData, voucherType: 'payment' })
                setPrintAfterSave(false)
            }
            resetForm()
            setView('list')
        },
        onError: (err) => {
            setPrintAfterSave(false)
            const msg = err?.response?.data?.errors?.map(e => e.msg).join('، ')
                || err?.response?.data?.message || 'فشل حفظ السند'
            push('error', msg)
        }
    })

    const voidMutation = useMutation({
        mutationFn: (id) => api.post(`/finance/payments/${id}/void`),
        onSuccess: () => {
            push('success', 'تم إلغاء السند')
            queryClient.invalidateQueries(['payment-vouchers'])
            setViewV(null)
        },
        onError: () => push('error', 'فشل الإلغاء')
    })

    const resetForm = () => {
        setForm(EMPTY_FORM)
        setSplitRows([
            { method: 'cash', amount: '', treasury: '' },
            { method: 'bank', amount: '', treasury: '' },
        ])
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const amount = Number(form.amount)
        if (!amount || amount <= 0) return push('error', 'أدخل مبلغ صحيح')
        if (form.beneficiaryType === 'customer' && !form.customer) return push('error', 'اختر العميل')
        if (form.beneficiaryType === 'supplier' && !form.supplier) return push('error', 'اختر المورد')
        if (['expense', 'other'].includes(form.beneficiaryType) && !form.beneficiary) return push('error', 'أدخل اسم المستفيد')

        if (form.method === 'split') {
            const total = splitRows.reduce((s, r) => s + Number(r.amount || 0), 0)
            if (Math.abs(total - amount) > 0.01) return push('error', `مجموع الدفعات (${fmt(total)}) لا يساوي المبلغ (${fmt(amount)})`)
            const missing = splitRows.find(r => Number(r.amount) > 0 && !r.treasury)
            if (missing) return push('error', 'حدد الخزينة لكل دفعة')
        } else {
            if (!form.treasury) return push('error', 'اختر الخزينة')
        }

        saveMutation.mutate({
            beneficiaryType: form.beneficiaryType,
            customer:    form.beneficiaryType === 'customer' ? form.customer : undefined,
            supplier:    form.beneficiaryType === 'supplier' ? form.supplier : undefined,
            beneficiary: ['expense', 'other'].includes(form.beneficiaryType) ? form.beneficiary : undefined,
            amount,
            method: form.method,
            treasury: form.method === 'split'
                ? (splitRows.find(r => r.method === 'cash')?.treasury || splitRows[0]?.treasury)
                : form.treasury,
            splitDetails: form.method === 'split' ? splitRows.filter(r => Number(r.amount) > 0).map(r => ({ method: r.method, amount: Number(r.amount), treasury: r.treasury })) : [],
            note: form.note,
            date: form.date,
        })
    }

    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-5 animate-in fade-in duration-300">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ArrowUpRight size={22} className="text-orange-600" />
                        سندات الدفع
                    </h1>
                    <p className="text-muted-foreground text-sm">تسجيل الدفعات الخارجة — عملاء، موردين، مصاريف</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-1.5"
                        onClick={() => navigate('/customer-receipts')}
                    >
                        <Receipt size={15} />
                        سندات القبض
                    </Button>
                    <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => { setView('list'); resetForm() }}>
                        السجل
                    </Button>
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white gap-1" onClick={() => setView('new')}>
                        <Plus size={16} />سند جديد
                    </Button>
                </div>
            </div>

            {/* ── KPI ─────────────────────────────────────────────────── */}
            {view === 'list' && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'إجمالي اليوم', val: fmt(kpis.today), unit: 'د.ل', color: 'orange' },
                        { label: 'إجمالي الشهر', val: fmt(kpis.month), unit: 'د.ل', color: 'red'    },
                        { label: 'عدد السندات',  val: kpis.count,      unit: 'سند', color: 'slate'  },
                    ].map(({ label, val, unit, color }) => (
                        <Card key={label} className={`bg-${color}-50/60 border-${color}-100`}>
                            <CardContent className="pt-4 pb-4 px-4">
                                <div className={`text-xs font-medium text-${color}-600 mb-1`}>{label}</div>
                                <div className={`text-2xl font-black text-${color}-900`}>
                                    {val} <span className={`text-sm font-normal text-${color}-600`}>{unit}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ══════════════════ LIST ════════════════════════════════ */}
            {view === 'list' && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 max-w-sm">
                                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input className="pr-9 h-9" placeholder="بحث..." value={q} onChange={e => setQ(e.target.value)} />
                            </div>
                            {q && <button onClick={() => setQ('')} className="text-muted-foreground"><X size={16} /></button>}
                            {/* Type filter */}
                            <div className="flex gap-1 mr-auto">
                                {[{ v: 'all', l: 'الكل' }, ...BENEFICIARY_TYPES.map(t => ({ v: t.value, l: t.label }))].map(({ v, l }) => (
                                    <button
                                        key={v}
                                        onClick={() => setTypeTab(v)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${typeTab === v ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30 text-muted-foreground hover:bg-muted'}`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>رقم السند</TableHead>
                                    <TableHead>النوع</TableHead>
                                    <TableHead>المستفيد</TableHead>
                                    <TableHead>التاريخ</TableHead>
                                    <TableHead>المبلغ</TableHead>
                                    <TableHead>طريقة الدفع</TableHead>
                                    <TableHead>البيان</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="text-center p-10">
                                        <div className="w-6 h-6 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
                                    </TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center p-10 text-muted-foreground text-sm">
                                        لا توجد سندات دفع.
                                    </TableCell></TableRow>
                                ) : (
                                    filtered.map(v => {
                                        const m = methodLabel(v.method)
                                        const name = v.customer?.name || v.supplier?.name || v.beneficiary || '—'
                                        return (
                                            <TableRow key={v._id} className={`hover:bg-muted/30 transition-colors ${v.status === 'void' ? 'opacity-50' : ''}`}>
                                                <TableCell className="font-mono text-xs font-bold text-orange-600">
                                                    {v.number || `#${v._id.slice(-6).toUpperCase()}`}
                                                </TableCell>
                                                <TableCell><BeneficiaryBadge type={v.beneficiaryType} /></TableCell>
                                                <TableCell className="font-medium">{name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    <span className="flex items-center gap-1 text-xs">
                                                        <Calendar size={11} />
                                                        {new Date(v.date).toLocaleDateString('ar-LY')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold text-orange-700">
                                                    {fmt(v.amount)} <span className="text-xs font-normal">د.ل</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                        {m.icon} {m.l}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                                                    {v.note || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setPrintVoucher({ ...v, voucherType: 'payment' })}
                                                            className="p-1.5 rounded hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                                                            title="طباعة سند الصرف"
                                                        >
                                                            <Printer size={15} />
                                                        </button>
                                                        <button
                                                            onClick={() => setViewV(v)}
                                                            className="p-1.5 rounded hover:bg-orange-50 text-orange-500 transition-colors cursor-pointer"
                                                            title="عرض التفاصيل"
                                                        >
                                                            <Eye size={15} />
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
            )}

            {/* ══════════════════ NEW VOUCHER FORM ════════════════════ */}
            {view === 'new' && (
                <Card className="max-w-2xl mx-auto w-full">
                    <CardHeader className="border-b bg-orange-50/40 rounded-t-xl">
                        <CardTitle className="flex items-center gap-2 text-base text-orange-800">
                            <ArrowUpRight size={18} />
                            إنشاء سند دفع جديد
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* Beneficiary type */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">نوع المستفيد <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-4 gap-2">
                                    {BENEFICIARY_TYPES.map(({ value, label, icon: Icon }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setF({ beneficiaryType: value, customer: '', supplier: '', beneficiary: '' })}
                                            className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-xs font-medium transition-all ${form.beneficiaryType === value
                                                ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                                                : 'bg-background border-input hover:border-orange-400 hover:bg-orange-50'}`}
                                        >
                                            <Icon size={18} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Beneficiary selector */}
                            {form.beneficiaryType === 'customer' && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">العميل <span className="text-red-500">*</span></label>
                                    <select
                                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        value={form.customer}
                                        onChange={e => setF({ customer: e.target.value })}
                                        required
                                    >
                                        <option value="">— اختر العميل —</option>
                                        {customers.map(c => (
                                            <option key={c._id} value={c._id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {selectedCustomer && (
                                        <div className={`text-xs px-3 py-1.5 rounded-lg border ${Number(selectedCustomer.balance) < 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            رصيد العميل: <strong>{fmt(Math.abs(selectedCustomer.balance))} د.ل</strong>
                                            {Number(selectedCustomer.balance) < 0 ? ' ✓ باقي لك (يستحق استرداد)' : Number(selectedCustomer.balance) > 0 ? ' ✗ باقي عليه' : ' — متصفي'}
                                        </div>
                                    )}
                                </div>
                            )}

                            {form.beneficiaryType === 'supplier' && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">المورد <span className="text-red-500">*</span></label>
                                    <select
                                        className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        value={form.supplier}
                                        onChange={e => setF({ supplier: e.target.value })}
                                        required
                                    >
                                        <option value="">— اختر المورد —</option>
                                        {suppliers.map(s => (
                                            <option key={s._id} value={s._id}>{s.name}</option>
                                        ))}
                                    </select>
                                    {selectedSupplier && Number(selectedSupplier.balance) > 0 && (
                                        <div className="text-xs px-3 py-1.5 rounded-lg border bg-red-50 border-red-200 text-red-700">
                                            مستحق للمورد: <strong>{fmt(selectedSupplier.balance)} د.ل</strong>
                                        </div>
                                    )}
                                </div>
                            )}

                            {['expense', 'other'].includes(form.beneficiaryType) && (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">اسم المستفيد <span className="text-red-500">*</span></label>
                                    <Input
                                        value={form.beneficiary}
                                        onChange={e => setF({ beneficiary: e.target.value })}
                                        placeholder={form.beneficiaryType === 'expense' ? 'مثال: إيجار، كهرباء، رواتب...' : 'اسم المستفيد'}
                                        required
                                    />
                                </div>
                            )}

                            {/* Amount + Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">المبلغ <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <Input
                                            type="number" step="0.01" min="0" required
                                            value={form.amount}
                                            onChange={e => setF({ amount: e.target.value })}
                                            placeholder="0.000"
                                            className="h-12 text-xl font-bold text-center pr-14"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">د.ل</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">التاريخ</label>
                                    <Input type="date" value={form.date} onChange={e => setF({ date: e.target.value })} className="h-12" />
                                </div>
                            </div>

                            {/* Payment method */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">طريقة الدفع</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { v: 'cash',  l: 'نقدي',       icon: '💵' },
                                        { v: 'bank',  l: 'تحويل بنكي', icon: '🏦' },
                                        { v: 'check', l: 'شيك',        icon: '📝' },
                                        { v: 'split', l: 'مختلط',      icon: '🔀' },
                                    ].map(({ v, l, icon }) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => setF({ method: v, treasury: '' })}
                                            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${form.method === v
                                                ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                                                : 'bg-background border-input hover:border-orange-400 hover:bg-orange-50'}`}
                                        >
                                            <span className="text-base">{icon}</span>{l}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Treasury / Split */}
                            {form.method === 'split' ? (
                                <div className="space-y-2 bg-slate-50 border rounded-lg p-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-bold text-slate-700 flex items-center gap-1"><Split size={14} />تفاصيل الدفع المختلط</span>
                                        <span className={`text-xs font-bold ${Math.abs(splitRows.reduce((s, r) => s + Number(r.amount || 0), 0) - Number(form.amount)) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {fmt(splitRows.reduce((s, r) => s + Number(r.amount || 0), 0))} / {fmt(form.amount)} د.ل
                                        </span>
                                    </div>
                                    {splitRows.map((row, i) => (
                                        <div key={i} className="grid grid-cols-3 gap-2 items-end bg-white p-2 rounded border">
                                            <select
                                                className="h-9 rounded border border-slate-200 px-2 text-sm"
                                                value={row.method}
                                                onChange={e => { const rows = [...splitRows]; rows[i] = { ...rows[i], method: e.target.value, treasury: '' }; setSplitRows(rows) }}
                                            >
                                                <option value="cash">💵 نقدي</option>
                                                <option value="bank">🏦 تحويل</option>
                                                <option value="check">📝 شيك</option>
                                            </select>
                                            <Input
                                                type="number" value={row.amount} placeholder="المبلغ"
                                                onChange={e => { const rows = [...splitRows]; rows[i] = { ...rows[i], amount: e.target.value }; setSplitRows(rows) }}
                                                className="h-9 text-center font-bold"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setSplitRows(splitRows.filter((_, j) => j !== i))}
                                                disabled={splitRows.length <= 1}
                                                className="h-9 flex items-center justify-center text-slate-400 hover:text-red-500 disabled:opacity-30"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                            <div className="col-span-3">
                                                <TreasurySelector
                                                    value={row.treasury}
                                                    onChange={val => { const rows = [...splitRows]; rows[i] = { ...rows[i], treasury: val }; setSplitRows(rows) }}
                                                    filterType={row.method === 'cash' ? 'safe' : 'bank'}
                                                    required={Number(row.amount) > 0}
                                                    placeholder="اختر الخزينة..."
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setSplitRows([...splitRows, { method: 'cash', amount: '', treasury: '' }])}
                                        className="w-full py-2 border border-dashed border-slate-300 rounded text-sm text-slate-500 hover:bg-slate-100 flex items-center justify-center gap-1"
                                    >
                                        <Plus size={14} />إضافة دفعة
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">الخزينة <span className="text-red-500">*</span></label>
                                    <TreasurySelector
                                        value={form.treasury}
                                        onChange={val => setF({ treasury: val })}
                                        filterType={form.method === 'cash' ? 'safe' : form.method !== 'split' ? 'bank' : null}
                                        required
                                    />
                                </div>
                            )}

                            {/* Note */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">البيان</label>
                                <textarea
                                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    value={form.note}
                                    onChange={e => setF({ note: e.target.value })}
                                    placeholder="وصف اختياري للسند..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2.5 pt-2 flex-wrap">
                                <Button type="button" variant="outline" className="flex-1" onClick={() => { setView('list'); resetForm() }}>
                                    إلغاء
                                </Button>
                                <Button
                                    type="submit"
                                    onClick={() => setPrintAfterSave(false)}
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold h-11"
                                    disabled={saveMutation.isPending}
                                >
                                    {saveMutation.isPending && !printAfterSave
                                        ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />جاري الحفظ...</div>
                                        : <div className="flex items-center gap-1.5"><Check size={17} />حفظ سند الدفع</div>
                                    }
                                </Button>
                                <Button
                                    type="submit"
                                    onClick={() => setPrintAfterSave(true)}
                                    className="flex-[1.3] bg-slate-900 hover:bg-slate-800 text-white font-bold h-11"
                                    disabled={saveMutation.isPending}
                                >
                                    {saveMutation.isPending && printAfterSave
                                        ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />جاري الحفظ...</div>
                                        : <div className="flex items-center gap-1.5"><Printer size={17} />حفظ وطباعة السند</div>
                                    }
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* ══════════════════ VIEW MODAL ═══════════════════════════ */}
            {viewVoucher && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <Card className="w-full max-w-md shadow-2xl overflow-hidden">
                        <div className={`text-white p-5 flex items-center justify-between ${viewVoucher.status === 'void' ? 'bg-slate-600' : 'bg-gradient-to-r from-orange-600 to-orange-700'}`}>
                            <div>
                                <div className="font-bold text-lg">سند دفع {viewVoucher.number || `#${viewVoucher._id.slice(-6).toUpperCase()}`}</div>
                                <div className="text-orange-100 text-sm">
                                    {new Date(viewVoucher.date).toLocaleDateString('ar-LY')}
                                    {viewVoucher.status === 'void' && <span className="mr-2 bg-white/20 px-2 py-0.5 rounded text-xs">ملغي</span>}
                                </div>
                            </div>
                            <button onClick={() => setViewV(null)} className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground mb-1">النوع</div>
                                    <BeneficiaryBadge type={viewVoucher.beneficiaryType} />
                                </div>
                                <div className="bg-orange-50 rounded-lg p-3">
                                    <div className="text-xs text-orange-600 mb-1">المبلغ المدفوع</div>
                                    <div className="font-bold text-xl text-orange-700">{fmt(viewVoucher.amount)} <span className="text-sm font-normal">د.ل</span></div>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground mb-1">المستفيد</div>
                                    <div className="font-bold text-sm">{viewVoucher.customer?.name || viewVoucher.supplier?.name || viewVoucher.beneficiary || '—'}</div>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground mb-1">طريقة الدفع</div>
                                    <span className="text-sm">{methodLabel(viewVoucher.method).icon} {methodLabel(viewVoucher.method).l}</span>
                                </div>
                            </div>
                            {viewVoucher.note && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                                    <span className="font-bold text-amber-800">البيان: </span>
                                    <span className="text-amber-900">{viewVoucher.note}</span>
                                </div>
                            )}
                        </CardContent>
                        <div className="border-t p-4 flex gap-2 justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
                                    onClick={() => {
                                        const target = viewVoucher
                                        setViewV(null)
                                        setPrintVoucher({ ...target, voucherType: 'payment' })
                                    }}
                                >
                                    <Printer size={15} />
                                    طباعة السند
                                </Button>
                                {viewVoucher.status === 'posted' && (
                                    <Button
                                        variant="destructive" size="sm"
                                        onClick={() => window.confirm('هل أنت متأكد من إلغاء السند؟') && voidMutation.mutate(viewVoucher._id)}
                                        disabled={voidMutation.isPending}
                                        className="gap-1"
                                    >
                                        <XCircle size={15} />إلغاء السند
                                    </Button>
                                )}
                            </div>
                            <Button variant="outline" onClick={() => setViewV(null)} className="mr-auto">
                                إغلاق
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* ══════════════════ PRINT VOUCHER MODAL ══════════════════ */}
            {printVoucher && (
                <VoucherPrintModal
                    voucher={printVoucher}
                    isOpen={!!printVoucher}
                    onClose={() => setPrintVoucher(null)}
                />
            )}
        </div>
    )
}
