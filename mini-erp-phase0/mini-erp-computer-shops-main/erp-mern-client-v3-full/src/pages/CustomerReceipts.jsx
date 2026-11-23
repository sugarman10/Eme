import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
    Receipt, Plus, Search, Eye, X, Check, Banknote, Building2,
    FileText, Calendar, User, ChevronDown, TrendingUp, Clock, Hash,
    AlertCircle, CheckCircle2, XCircle, Split, Trash2, ArrowUpRight, Printer
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { TreasurySelector } from '../components/TreasurySelector'
import VoucherPrintModal from '../components/modals/VoucherPrintModal'

// ── helpers ────────────────────────────────────────────────────────────────
const methodLabel = (m) => ({
    cash:  { label: 'نقدي',       icon: '💵', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    bank:  { label: 'تحويل بنكي', icon: '🏦', cls: 'bg-blue-100    text-blue-700    border-blue-200'    },
    check: { label: 'شيك',        icon: '📝', cls: 'bg-purple-100  text-purple-700  border-purple-200'  },
    split: { label: 'مختلط',      icon: '🔀', cls: 'bg-orange-100  text-orange-700  border-orange-200'  },
}[m] || { label: m, icon: '—', cls: 'bg-gray-100 text-gray-600 border-gray-200' })

function fmt(n) { return Number(n || 0).toLocaleString('ar-LY') }

const EMPTY_FORM = {
    customer: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    method: 'cash',
    treasury: '',
    note: '',
    invoices: [],
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CustomerReceipts() {
    const { push } = useToast()
    const queryClient = useQueryClient()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const customerParam = searchParams.get('customer')

    const [view, setView]           = useState('list')   // 'list' | 'new'
    const [q, setQ]                 = useState('')
    const [viewReceipt, setViewReceipt] = useState(null) // receipt object for view modal
    const [printReceipt, setPrintReceipt] = useState(null) // receipt object for print modal
    const [printAfterSave, setPrintAfterSave] = useState(false)

    // form state
    const [form, setForm]               = useState(EMPTY_FORM)
    const [splitRows, setSplitRows]     = useState([
        { method: 'cash', amount: '', treasury: '' },
        { method: 'bank', amount: '', treasury: '' },
    ])
    const [selectedInvoices, setSelectedInvoices] = useState([])

    useEffect(() => {
        if (customerParam) {
            setForm(f => ({ ...f, customer: customerParam }))
            setView('new')
        }
    }, [customerParam])

    // ── Data ──────────────────────────────────────────────────────────────
    const { data: customers = [] } = useQuery({
        queryKey: ['customers-slim'],
        queryFn: async () => {
            const { data } = await api.get('/customers')
            return (data || []).filter(c => !c.isCashCustomer)
        },
        staleTime: 2 * 60_000
    })

    const { data: receipts = [], isLoading } = useQuery({
        queryKey: ['receipts'],
        queryFn: async () => {
            const { data } = await api.get('/finance/receipts')
            return data || []
        },
        staleTime: 30_000
    })

    // invoices for selected customer
    const { data: customerInvoices = [], isFetching: fetchingInvoices } = useQuery({
        queryKey: ['customer-invoices-receipt', form.customer],
        queryFn: async () => {
            const { data } = await api.get(`/sales/invoice?customer=${form.customer}&limit=500`)
            const list = data?.docs || data || []
            return list
                .filter(inv => {
                    const remaining = (inv.totals?.grand || 0) - (inv.totals?.paid || 0)
                    return remaining > 0.01 && inv.status !== 'cancelled' && inv.status !== 'void'
                })
                .map(inv => ({
                    ...inv,
                    remaining: (inv.totals?.grand || 0) - (inv.totals?.paid || 0)
                }))
        },
        enabled: !!form.customer,
        staleTime: 60_000
    })

    // ── Auto-calculate amount from selected invoices ───────────────────────
    useEffect(() => {
        if (selectedInvoices.length > 0) {
            const total = selectedInvoices.reduce((s, inv) => s + inv.remaining, 0)
            setForm(f => ({ ...f, amount: total.toFixed(2) }))
        }
    }, [selectedInvoices])

    // ── Save receipt mutation ──────────────────────────────────────────────
    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            const { data } = await api.post('/finance/receipts', payload)
            return data
        },
        onSuccess: (savedData) => {
            push('success', 'تم حفظ سند القبض بنجاح ✓')
            queryClient.invalidateQueries(['receipts'])
            queryClient.invalidateQueries(['customers'])
            queryClient.invalidateQueries(['customers-slim'])
            queryClient.invalidateQueries(['customer-invoices-receipt'])
            if (printAfterSave && savedData) {
                setPrintReceipt({ ...savedData, voucherType: 'receipt' })
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

    // ── Void mutation ──────────────────────────────────────────────────────
    const voidMutation = useMutation({
        mutationFn: (id) => api.post(`/finance/receipts/${id}/void`),
        onSuccess: () => {
            push('success', 'تم إلغاء السند')
            queryClient.invalidateQueries(['receipts'])
            setViewReceipt(null)
        },
        onError: () => push('error', 'فشل الإلغاء')
    })

    const resetForm = () => {
        setForm(EMPTY_FORM)
        setSplitRows([
            { method: 'cash', amount: '', treasury: '' },
            { method: 'bank', amount: '', treasury: '' },
        ])
        setSelectedInvoices([])
    }

    // ── Submit ─────────────────────────────────────────────────────────────
    const handleSubmit = (e) => {
        e.preventDefault()
        if (!form.customer) return push('error', 'اختر العميل')
        const amount = Number(form.amount)
        if (!amount || amount <= 0) return push('error', 'أدخل مبلغ صحيح')

        if (form.method === 'split') {
            const splitTotal = splitRows.reduce((s, r) => s + Number(r.amount || 0), 0)
            if (Math.abs(splitTotal - amount) > 0.01) return push('error', `مجموع الدفعات (${fmt(splitTotal)}) لا يساوي المبلغ (${fmt(amount)})`)
            const missing = splitRows.find(r => Number(r.amount) > 0 && !r.treasury)
            if (missing) return push('error', 'حدد الخزينة لكل دفعة')
        } else {
            if (!form.treasury) return push('error', 'اختر الخزينة')
        }

        const payload = {
            customer: form.customer,
            date: form.date,
            amount,
            method: form.method,
            treasury: form.method === 'split'
                ? (splitRows.find(r => r.method === 'cash')?.treasury || splitRows[0]?.treasury)
                : form.treasury,
            note: form.note,
            invoices: selectedInvoices.map(i => i._id),
            splitDetails: form.method === 'split'
                ? splitRows.filter(r => Number(r.amount) > 0).map(r => ({ method: r.method, amount: Number(r.amount), treasury: r.treasury }))
                : [],
        }
        saveMutation.mutate(payload)
    }

    // ── Invoice toggle ─────────────────────────────────────────────────────
    const toggleInvoice = (inv) => {
        setSelectedInvoices(prev =>
            prev.some(i => i._id === inv._id)
                ? prev.filter(i => i._id !== inv._id)
                : [...prev, inv]
        )
    }

    // ── KPIs ──────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const now = new Date(); now.setHours(0, 0, 0, 0)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const today  = receipts.filter(r => { const d = new Date(r.date); d.setHours(0,0,0,0); return d.getTime() === now.getTime() })
        const month  = receipts.filter(r => new Date(r.date) >= monthStart)
        return {
            today:  today.reduce((s, r) => s + (r.amount || 0), 0),
            month:  month.reduce((s, r) => s + (r.amount || 0), 0),
            count:  receipts.length,
        }
    }, [receipts])

    // ── Filter ────────────────────────────────────────────────────────────
    const filtered = useMemo(() =>
        receipts.filter(r => {
            if (!q) return true
            const s = q.toLowerCase()
            return (r.customer?.name || '').toLowerCase().includes(s)
                || (r.note || '').toLowerCase().includes(s)
                || r._id.includes(s)
        })
    , [receipts, q])

    // ── treasury filter per method ────────────────────────────────────────
    const treasuryFilter = form.method === 'cash' ? 'safe' : ['bank','check'].includes(form.method) ? 'bank' : null

    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-5 animate-in fade-in duration-300">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Receipt size={22} className="text-emerald-600" />
                        سندات القبض
                    </h1>
                    <p className="text-muted-foreground text-sm">تسجيل مدفوعات العملاء وتسوية الفواتير</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-orange-200 text-orange-700 hover:bg-orange-50 gap-1.5"
                        onClick={() => navigate('/payment-vouchers')}
                    >
                        <ArrowUpRight size={15} />
                        سندات الدفع
                    </Button>
                    <Button
                        variant={view === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setView('list'); resetForm() }}
                    >
                        سجل السندات
                    </Button>
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        onClick={() => setView('new')}
                    >
                        <Plus size={16} />
                        سند جديد
                    </Button>
                </div>
            </div>

            {/* ── KPI cards — only on list view ───────────────────────── */}
            {view === 'list' && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'إجمالي اليوم',  val: fmt(kpis.today), unit: 'د.ل', color: 'emerald', Icon: TrendingUp },
                        { label: 'إجمالي الشهر',  val: fmt(kpis.month), unit: 'د.ل', color: 'blue',    Icon: Calendar  },
                        { label: 'عدد السندات',   val: kpis.count,      unit: 'سند', color: 'purple',  Icon: Hash      },
                    ].map(({ label, val, unit, color, Icon }) => (
                        <Card key={label} className={`bg-${color}-50/60 border-${color}-100`}>
                            <CardHeader className="pb-1 pt-4 px-4">
                                <CardTitle className={`text-xs font-medium text-${color}-700 flex items-center gap-2`}>
                                    <Icon size={14} />{label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-4 px-4">
                                <div className={`text-2xl font-black text-${color}-900`}>
                                    {val} <span className={`text-sm font-normal text-${color}-600`}>{unit}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ══════════════════ LIST VIEW ═══════════════════════════ */}
            {view === 'list' && (
                <Card>
                    <CardHeader className="pb-3 flex flex-row items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pr-9 h-9"
                                placeholder="بحث بالعميل أو الملاحظات..."
                                value={q}
                                onChange={e => setQ(e.target.value)}
                            />
                        </div>
                        {q && (
                            <button onClick={() => setQ('')} className="text-muted-foreground hover:text-foreground">
                                <X size={16} />
                            </button>
                        )}
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>رقم السند</TableHead>
                                    <TableHead>العميل</TableHead>
                                    <TableHead>التاريخ</TableHead>
                                    <TableHead>المبلغ</TableHead>
                                    <TableHead>طريقة الدفع</TableHead>
                                    <TableHead>ملاحظات</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center p-10">
                                        <div className="w-6 h-6 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" />
                                    </TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center p-10 text-muted-foreground text-sm">
                                        {q ? `لا توجد نتائج لـ "${q}"` : 'لا توجد سندات قبض بعد.'}
                                    </TableCell></TableRow>
                                ) : (
                                    filtered.map(r => {
                                        const m = methodLabel(r.method)
                                        return (
                                            <TableRow key={r._id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="font-mono text-xs font-bold text-indigo-600">
                                                    #{r._id.slice(-6).toUpperCase()}
                                                </TableCell>
                                                <TableCell className="font-medium">{r.customer?.name || '—'}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {new Date(r.date).toLocaleDateString('ar-LY')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold text-emerald-700">
                                                    {fmt(r.amount)} <span className="text-xs font-normal">د.ل</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
                                                        {m.icon} {m.label}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                                                    {r.note || '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setPrintReceipt({ ...r, voucherType: 'receipt' })}
                                                            className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors cursor-pointer"
                                                            title="طباعة سند القبض"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => setViewReceipt(r)}
                                                            className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500 transition-colors cursor-pointer"
                                                            title="عرض التفاصيل"
                                                        >
                                                            <Eye size={16} />
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

            {/* ══════════════════ NEW RECEIPT FORM ════════════════════ */}
            {view === 'new' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                    {/* ── Left: Form ─────────────────────────────────── */}
                    <Card className="lg:col-span-3">
                        <CardHeader className="border-b bg-emerald-50/50 rounded-t-xl">
                            <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
                                <Receipt size={18} />
                                بيانات سند القبض
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            <form onSubmit={handleSubmit} className="space-y-4">

                                {/* Customer + Date */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">العميل <span className="text-red-500">*</span></label>
                                        <select
                                            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                            value={form.customer}
                                            onChange={e => {
                                                setForm({ ...form, customer: e.target.value })
                                                setSelectedInvoices([])
                                            }}
                                            required
                                        >
                                            <option value="">— اختر العميل —</option>
                                            {customers.map(c => (
                                                <option key={c._id} value={c._id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">التاريخ</label>
                                        <Input
                                            type="date"
                                            value={form.date}
                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                            className="h-10"
                                        />
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">المبلغ <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            required
                                            value={form.amount}
                                            onChange={e => setForm({ ...form, amount: e.target.value })}
                                            placeholder="0.000"
                                            className="h-12 text-xl font-bold text-center pr-16"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">د.ل</span>
                                    </div>
                                </div>

                                {/* Payment method */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">طريقة الدفع</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { v: 'cash',  l: 'نقدي',        icon: '💵' },
                                            { v: 'bank',  l: 'تحويل بنكي',  icon: '🏦' },
                                            { v: 'check', l: 'شيك',         icon: '📝' },
                                            { v: 'split', l: 'مختلط',       icon: '🔀' },
                                        ].map(({ v, l, icon }) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setForm({ ...form, method: v, treasury: '' })}
                                                className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${form.method === v
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                                    : 'bg-background border-input hover:border-emerald-400 hover:bg-emerald-50'}`}
                                            >
                                                <span className="text-base">{icon}</span>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Treasury / Split */}
                                {form.method === 'split' ? (
                                    <div className="space-y-2 bg-slate-50 border rounded-lg p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                                <Split size={14} />
                                                تفاصيل الدفع المختلط
                                            </span>
                                            <span className={`text-xs font-bold ${Math.abs(splitRows.reduce((s, r) => s + Number(r.amount || 0), 0) - Number(form.amount)) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {fmt(splitRows.reduce((s, r) => s + Number(r.amount || 0), 0))} / {fmt(form.amount)} د.ل
                                            </span>
                                        </div>
                                        {splitRows.map((row, i) => (
                                            <div key={i} className="grid grid-cols-3 gap-2 items-end bg-white p-2 rounded border">
                                                <select
                                                    className="h-9 rounded border border-slate-200 px-2 text-sm"
                                                    value={row.method}
                                                    onChange={e => {
                                                        const rows = [...splitRows]
                                                        rows[i] = { ...rows[i], method: e.target.value, treasury: '' }
                                                        setSplitRows(rows)
                                                    }}
                                                >
                                                    <option value="cash">💵 نقدي</option>
                                                    <option value="bank">🏦 تحويل</option>
                                                    <option value="check">📝 شيك</option>
                                                </select>
                                                <Input
                                                    type="number"
                                                    value={row.amount}
                                                    onChange={e => {
                                                        const rows = [...splitRows]
                                                        rows[i] = { ...rows[i], amount: e.target.value }
                                                        setSplitRows(rows)
                                                    }}
                                                    placeholder="المبلغ"
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
                                                        onChange={val => {
                                                            const rows = [...splitRows]
                                                            rows[i] = { ...rows[i], treasury: val }
                                                            setSplitRows(rows)
                                                        }}
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
                                            <Plus size={14} /> إضافة دفعة
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">الخزينة <span className="text-red-500">*</span></label>
                                        <TreasurySelector
                                            value={form.treasury}
                                            onChange={val => setForm({ ...form, treasury: val })}
                                            filterType={treasuryFilter}
                                            required
                                        />
                                    </div>
                                )}

                                {/* Note */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">ملاحظات</label>
                                    <textarea
                                        className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                        value={form.note}
                                        onChange={e => setForm({ ...form, note: e.target.value })}
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
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                                        disabled={saveMutation.isPending}
                                    >
                                        {saveMutation.isPending && !printAfterSave
                                            ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الحفظ...</div>
                                            : <div className="flex items-center gap-1.5"><Check size={17} /> حفظ سند القبض</div>
                                        }
                                    </Button>
                                    <Button
                                        type="submit"
                                        onClick={() => setPrintAfterSave(true)}
                                        className="flex-[1.3] bg-slate-900 hover:bg-slate-800 text-white font-bold h-11"
                                        disabled={saveMutation.isPending}
                                    >
                                        {saveMutation.isPending && printAfterSave
                                            ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جاري الحفظ...</div>
                                            : <div className="flex items-center gap-1.5"><Printer size={17} /> حفظ وطباعة السند</div>
                                        }
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* ── Right: Pending invoices ──────────────────────── */}
                    <Card className="lg:col-span-2 flex flex-col">
                        <CardHeader className="border-b bg-slate-50/50 rounded-t-xl pb-3">
                            <CardTitle className="text-sm flex items-center justify-between">
                                <span className="flex items-center gap-2 text-slate-700">
                                    <FileText size={16} />
                                    الفواتير المستحقة
                                </span>
                                {selectedInvoices.length > 0 && (
                                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">
                                        {selectedInvoices.length} محددة
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto" style={{ maxHeight: '460px' }}>
                            {!form.customer ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    <User size={32} className="mx-auto mb-2 opacity-30" />
                                    اختر العميل أولاً لعرض فواتيره المستحقة
                                </div>
                            ) : fetchingInvoices ? (
                                <div className="p-8 text-center">
                                    <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin mx-auto" />
                                </div>
                            ) : customerInvoices.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                                    لا توجد فواتير مستحقة لهذا العميل
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {customerInvoices.map(inv => {
                                        const selected = selectedInvoices.some(i => i._id === inv._id)
                                        return (
                                            <div
                                                key={inv._id}
                                                onClick={() => toggleInvoice(inv)}
                                                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${selected ? 'bg-emerald-50 border-r-2 border-r-emerald-500' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                                        {selected && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-mono text-xs font-bold text-slate-600">
                                                            #{inv._id.slice(-6).toUpperCase()}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {new Date(inv.date || inv.createdAt).toLocaleDateString('ar-LY')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-bold text-red-600 text-sm">{fmt(inv.remaining)} د.ل</div>
                                                    <div className="text-xs text-muted-foreground">من {fmt(inv.totals?.grand)}</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                        {selectedInvoices.length > 0 && (
                            <div className="border-t p-3 bg-emerald-50">
                                <div className="flex justify-between text-sm font-bold">
                                    <span className="text-emerald-700">إجمالي المحدد:</span>
                                    <span className="text-emerald-800">
                                        {fmt(selectedInvoices.reduce((s, i) => s + i.remaining, 0))} د.ل
                                    </span>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* ══════════════════ VIEW MODAL ═══════════════════════════ */}
            {viewReceipt && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <Card className="w-full max-w-lg shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Receipt size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-lg">سند قبض #{viewReceipt._id.slice(-6).toUpperCase()}</div>
                                    <div className="text-emerald-100 text-sm">{new Date(viewReceipt.date).toLocaleDateString('ar-LY')}</div>
                                </div>
                            </div>
                            <button onClick={() => setViewReceipt(null)} className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <CardContent className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><User size={11} />العميل</div>
                                    <div className="font-bold">{viewReceipt.customer?.name || '—'}</div>
                                </div>
                                <div className="bg-emerald-50 rounded-lg p-3">
                                    <div className="text-xs text-emerald-600 mb-1">المبلغ المستلم</div>
                                    <div className="font-bold text-xl text-emerald-700">{fmt(viewReceipt.amount)} <span className="text-sm font-normal">د.ل</span></div>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground mb-1">طريقة الدفع</div>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${methodLabel(viewReceipt.method).cls}`}>
                                        {methodLabel(viewReceipt.method).icon} {methodLabel(viewReceipt.method).label}
                                    </span>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar size={11} />التاريخ</div>
                                    <div className="font-medium text-sm">{new Date(viewReceipt.date).toLocaleDateString('ar-LY')}</div>
                                </div>
                            </div>

                            {viewReceipt.note && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                                    <span className="font-bold text-amber-800">ملاحظات: </span>
                                    <span className="text-amber-900">{viewReceipt.note}</span>
                                </div>
                            )}

                            {viewReceipt.allocations?.length > 0 && (
                                <div>
                                    <div className="text-sm font-bold text-slate-700 mb-2">الفواتير المرتبطة:</div>
                                    <div className="rounded-lg border overflow-hidden">
                                        {viewReceipt.allocations.map((a, i) => (
                                            <div key={i} className="flex justify-between items-center px-3 py-2 text-sm border-b last:border-0 hover:bg-slate-50">
                                                <span className="font-mono text-xs text-slate-600">#{a.invoice?._id?.slice(-6) || '—'}</span>
                                                <span className="font-bold text-emerald-600">{fmt(a.amount)} د.ل</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>

                        <div className="border-t p-4 flex gap-2 justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                    onClick={() => {
                                        const target = viewReceipt
                                        setViewReceipt(null)
                                        setPrintReceipt({ ...target, voucherType: 'receipt' })
                                    }}
                                >
                                    <Printer size={15} />
                                    طباعة السند
                                </Button>
                                {!viewReceipt.void && viewReceipt.status !== 'void' && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => window.confirm('هل أنت متأكد من إلغاء السند؟') && voidMutation.mutate(viewReceipt._id)}
                                        disabled={voidMutation.isPending}
                                        className="gap-1"
                                    >
                                        <XCircle size={15} />
                                        إلغاء السند
                                    </Button>
                                )}
                            </div>
                            <Button variant="outline" onClick={() => setViewReceipt(null)} className="mr-auto">
                                إغلاق
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* ══════════════════ PRINT VOUCHER MODAL ══════════════════ */}
            {printReceipt && (
                <VoucherPrintModal
                    voucher={printReceipt}
                    isOpen={!!printReceipt}
                    onClose={() => setPrintReceipt(null)}
                />
            )}
        </div>
    )
}
