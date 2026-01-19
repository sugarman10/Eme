import { useEffect, useState, useMemo } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
    DollarSign,
    Search,
    Plus,
    User,
    CreditCard,
    Eye,
    Printer,
    TrendingUp,
    Receipt as ReceiptIcon,
    Split,
    Trash2,
    Calendar,
    FileText,
    Wallet,
    Landmark,
    Banknote
} from 'lucide-react'
import { TreasurySelector } from '../components/TreasurySelector'
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

export default function CustomerReceipts() {
    const { push } = useToast()

    // Data
    const [customers, setCustomers] = useState([])
    const [invoices, setInvoices] = useState([])
    const [receipts, setReceipts] = useState([])
    const [treasuries, setTreasuries] = useState([])
    const [loading, setLoading] = useState(false)

    // UI
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('list') // 'list' | 'new'
    const [searchTerm, setSearchTerm] = useState('')
    const [viewModal, setViewModal] = useState({ show: false, receipt: null })

    // Form
    const [form, setForm] = useState({
        customer: '',
        date: new Date().toISOString().split('T')[0],
        amount: '',
        method: 'cash', // cash, bank, check
        treasury: '',
        note: '',
        invoices: [] // Array of invoice IDs to link
    })
    const [selectedInvoices, setSelectedInvoices] = useState([]) // Array of full invoice objects
    const [availableInvoices, setAvailableInvoices] = useState([])

    // Split Payment State
    const [splitPayments, setSplitPayments] = useState([
        { method: 'cash', amount: 0, treasury: '' },
        { method: 'card', amount: 0, treasury: '' }
    ])

    // Smart Filter
    const treasuryFilter = useMemo(() => {
        if (form.method === 'cash') return 'safe'
        if (['bank', 'check'].includes(form.method)) return 'bank'
        return null
    }, [form.method])

    // Fetch invoices when customer changes
    useEffect(() => {
        if (!form.customer) {
            setAvailableInvoices([])
            return
        }
        const fetchInvoices = async () => {
            try {
                const { data } = await api.get(`/sales/invoice?customer=${form.customer}&limit=5000`)
                // API returns { docs: [...] } - extract the array
                const invoiceList = data?.docs || data || []

                const unpaid = (Array.isArray(invoiceList) ? invoiceList : [])
                    .filter(inv => {
                        const statusOk = ['confirmed', 'draft'].includes(inv.status)
                        return statusOk
                    })
                    .map(inv => {
                        const grand = inv.totals?.grand || 0
                        const paid = inv.totals?.paid || 0
                        const remaining = grand - paid

                        return {
                            ...inv,
                            _id: inv._id,
                            number: inv._id.slice(-6),
                            date: inv.date || inv.createdAt,
                            remaining,
                            totals: { grand, paid }
                        }
                    })
                    .filter(inv => inv.remaining > 0.01) // Filter out fully paid

                setAvailableInvoices(unpaid)
            } catch (err) {
                console.error('Failed to load invoices', err)
            }
        }
        fetchInvoices()
    }, [form.customer])

    const toggleInvoiceSelection = (invoice) => {
        const isSelected = selectedInvoices.some(i => i._id === invoice._id)
        let newSelected
        if (isSelected) {
            newSelected = selectedInvoices.filter(i => i._id !== invoice._id)
        } else {
            newSelected = [...selectedInvoices, invoice]
        }
        setSelectedInvoices(newSelected)

        // Calculate total amount
        const total = newSelected.reduce((sum, inv) => sum + (inv.remaining || inv.totals?.grand || 0), 0)

        setForm(prev => ({
            ...prev,
            amount: total > 0 ? total : '',
            invoices: newSelected.map(i => i._id)
        }))
    }

    // Load Initial Data
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [custRes, recRes, treasRes] = await Promise.all([
                api.get('/customers'),
                api.get('/finance/receipts').catch(() => ({ data: [] })), // Handle missing endpoint
                api.get('/finance/treasuries').catch(() => ({ data: [] }))
            ])
            setCustomers(custRes.data || [])
            setReceipts(recRes.data || [])
            setTreasuries(treasRes.data || [])
        } catch (err) {
            console.error('Failed to load data', err)
            if (err?.response?.status !== 404) {
                push('error', 'فشل تحميل البيانات')
            }
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.customer) return push('error', 'اختر العميل')
        if (!form.amount || Number(form.amount) <= 0) return push('error', 'أدخل مبلغ صحيح')

        // Validation for Split
        if (form.method === 'split') {
            const totalSplit = splitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
            if (Math.abs(totalSplit - Number(form.amount)) > 0.01) {
                return push('error', `مجموع الدفعات (${totalSplit}) لا يساوي مبلغ السند (${form.amount})`)
            }
            const invalidSplit = splitPayments.find(p => p.amount > 0 && !p.treasury)
            if (invalidSplit) {
                return push('error', 'يرجى تحديد الخزينة لكل دفعة في الدفع المختلط')
            }
        } else {
            if (!form.treasury) return push('error', 'اختر الخزينة / الحساب')
        }

        setSaving(true)
        try {
            const payload = {
                ...form,
                // If split, treasury is null/undefined in main field (or first one), and details are sent
                treasury: form.method === 'split'
                    ? (splitPayments.find(p => p.method === 'cash')?.treasury || splitPayments[0]?.treasury)
                    : form.treasury,
                splitDetails: form.method === 'split' ? splitPayments.map(p => ({
                    method: p.method,
                    amount: p.amount,
                    treasury: p.treasury
                })) : []
            }

            await api.post('/finance/receipts', payload)
            push('success', 'تم حفظ السند بنجاح')
            setForm({
                customer: '',
                date: new Date().toISOString().split('T')[0],
                amount: '',
                method: 'cash',
                treasury: '',
                note: '',
                invoices: []
            })
            setSplitPayments([
                { method: 'cash', amount: 0, treasury: '' },
                { method: 'card', amount: 0, treasury: '' }
            ])
            setSelectedInvoices([])
            setActiveTab('list')
            loadData()
        } catch (err) {
            const errorMsg = err?.response?.data?.errors
                ? err.response.data.errors.map(e => e.msg).join(', ')
                : (err?.response?.data?.message || 'فشل حفظ السند')
            push('error', errorMsg)
        } finally {
            setSaving(false)
        }
    }

    // Calculate KPIs
    const kpis = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)

        const todayReceipts = receipts.filter(r => {
            const rDate = new Date(r.date)
            rDate.setHours(0, 0, 0, 0)
            return rDate.getTime() === today.getTime()
        })

        const monthReceipts = receipts.filter(r => {
            const rDate = new Date(r.date)
            return rDate >= thisMonth
        })

        return {
            today: todayReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
            month: monthReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
            count: receipts.length,
            average: receipts.length > 0 ? monthReceipts.reduce((sum, r) => sum + (r.amount || 0), 0) / monthReceipts.length : 0
        }
    }, [receipts])

    // Filter receipts
    const filteredReceipts = useMemo(() => {
        return receipts.filter(r => {
            const customerName = r.customer?.name?.toLowerCase() || ''
            const note = r.note?.toLowerCase() || ''
            const search = searchTerm.toLowerCase()
            return customerName.includes(search) || note.includes(search) || r._id.includes(search)
        })
    }, [receipts, searchTerm])

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-100px)]">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="h2">سندات القبض</h1>
                    <p className="muted">تسجيل مدفوعات العملاء</p>
                </div>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('list')}
                    >
                        سجل السندات
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'new' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('new')}
                    >
                        <Plus size={16} className="inline-block ml-1" />
                        سند جديد
                    </button>
                </div>
            </div>

            {/* KPIs */}
            {activeTab === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-linear-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <DollarSign className="opacity-80" size={24} />
                            <span className="text-xs bg-white/20 px-2 py-1 rounded">اليوم</span>
                        </div>
                        <div className="text-3xl font-bold mb-1">{kpis.today.toLocaleString()} د.ل</div>
                        <div className="text-emerald-100 text-sm">إجمالي اليوم</div>
                    </div>

                    <div className="bg-linear-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <TrendingUp className="opacity-80" size={24} />
                            <span className="text-xs bg-white/20 px-2 py-1 rounded">الشهر</span>
                        </div>
                        <div className="text-3xl font-bold mb-1">{kpis.month.toLocaleString()} د.ل</div>
                        <div className="text-blue-100 text-sm">إجمالي الشهر</div>
                    </div>

                    <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <ReceiptIcon className="opacity-80" size={24} />
                            <span className="text-xs bg-white/20 px-2 py-1 rounded">العدد</span>
                        </div>
                        <div className="text-3xl font-bold mb-1">{kpis.count}</div>
                        <div className="text-purple-100 text-sm">عدد السندات</div>
                    </div>

                    <div className="bg-linear-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <CreditCard className="opacity-80" size={24} />
                            <span className="text-xs bg-white/20 px-2 py-1 rounded">متوسط</span>
                        </div>
                        <div className="text-3xl font-bold mb-1">{kpis.average.toFixed(0)} د.ل</div>
                        <div className="text-orange-100 text-sm">متوسط المبلغ</div>
                    </div>
                </div>
            )}

            {activeTab === 'list' ? (
                <div className="card flex-1 flex flex-col min-h-0 shadow-md border-0">
                    {/* Search Bar */}
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="بحث بالعميل، الملاحظات، أو رقم السند..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input pr-14! w-full"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="table w-full">
                            <thead className="sticky top-0 bg-gray-50 z-10">
                                <tr>
                                    <th className="text-right">رقم السند</th>
                                    <th className="text-right">العميل</th>
                                    <th className="text-right">التاريخ</th>
                                    <th className="text-right">المبلغ</th>
                                    <th className="text-center">طريقة الدفع</th>
                                    <th className="text-right">ملاحظات</th>
                                    <th className="text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="text-center p-8 text-gray-500">جاري التحميل...</td></tr>
                                ) : filteredReceipts.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center p-8 text-gray-500">
                                        {searchTerm ? 'لا توجد نتائج' : 'لا توجد سندات قبض.'}
                                    </td></tr>
                                ) : (
                                    filteredReceipts.map(r => (
                                        <tr key={r._id} className="hover:bg-gray-50">
                                            <td className="font-mono text-sm font-bold text-indigo-600">#{r._id.slice(-6)}</td>
                                            <td className="font-medium">{r.customer?.name || '-'}</td>
                                            <td className="text-sm text-gray-600">
                                                {new Date(r.date).toLocaleDateString('ar-LY')}
                                            </td>
                                            <td className="font-bold text-emerald-600">
                                                {Number(r.amount).toLocaleString()} د.ل
                                            </td>
                                            <td className="text-center">
                                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${r.method === 'cash' ? 'bg-green-100 text-green-700' :
                                                    r.method === 'bank' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {r.method === 'cash' ? 'نقدي' : r.method === 'bank' ? 'تحويل' : 'شيك'}
                                                </span>
                                            </td>
                                            <td className="text-sm text-gray-500 max-w-xs truncate">{r.note || '-'}</td>
                                            <td>
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setViewModal({ show: true, receipt: r })}
                                                        className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors"
                                                        title="عرض التفاصيل"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                                                        title="طباعة"
                                                    >
                                                        <Printer size={18} />
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
            ) : (
                <div className="card flex-1 flex flex-col min-h-0 shadow-md border-0 overflow-hidden">
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="card-body p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-5">
                                    {/* Section Header */}
                                    <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl flex items-center justify-center text-white">
                                            <ReceiptIcon size={20} />
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-800">بيانات السند</h3>
                                    </div>

                                    {/* Customer Select */}
                                    <div className="space-y-2">
                                        <Label htmlFor="customer">
                                            العميل <span className="text-red-500">*</span>
                                        </Label>
                                        <NativeSelect
                                            id="customer"
                                            required
                                            value={form.customer}
                                            onChange={e => setForm({ ...form, customer: e.target.value })}
                                        >
                                            <option value="">اختر العميل...</option>
                                            {customers
                                                .filter(c => !c.isCashCustomer)
                                                .map(c => (
                                                    <option key={c._id} value={c._id}>{c.name}</option>
                                                ))}
                                        </NativeSelect>
                                    </div>

                                    {/* Amount */}
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">
                                            المبلغ <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="amount"
                                            type="number"
                                            step="0.01"
                                            required
                                            className="font-bold text-lg"
                                            value={form.amount}
                                            onChange={e => setForm({ ...form, amount: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    {/* Date & Payment Method */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="date">التاريخ</Label>
                                            <Input
                                                id="date"
                                                type="date"
                                                required
                                                value={form.date}
                                                onChange={e => setForm({ ...form, date: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="method">طريقة الدفع</Label>
                                            <NativeSelect
                                                id="method"
                                                value={form.method}
                                                onChange={e => setForm({ ...form, method: e.target.value })}
                                            >
                                                <option value="cash">💵 نقدي</option>
                                                <option value="bank">🏦 تحويل بنكي</option>
                                                <option value="check">📝 شيك</option>
                                                <option value="split">🔀 مختلط (نقدي + بنك)</option>
                                            </NativeSelect>
                                        </div>
                                    </div>

                                    {form.method === 'split' ? (
                                        <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                    <Split size={16} />
                                                    تفاصيل الدفع المختلط
                                                </span>
                                                <span className={`text-xs font-bold ${Math.abs(splitPayments.reduce((s, p) => s + Number(p.amount), 0) - Number(form.amount)) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
                                                    المجموع: {splitPayments.reduce((s, p) => s + Number(p.amount), 0)} / {form.amount}
                                                </span>
                                            </div>

                                            {splitPayments.map((payment, index) => (
                                                <div key={index} className="flex flex-col gap-2 bg-white p-2 rounded border border-slate-200 shadow-sm">
                                                    <div className="flex gap-2 items-center">
                                                        <select
                                                            className="h-8 rounded border border-slate-300 bg-white px-2 text-sm focus:outline-none focus:border-blue-500 w-24"
                                                            value={payment.method}
                                                            onChange={e => {
                                                                const newPayments = [...splitPayments]
                                                                newPayments[index].method = e.target.value
                                                                newPayments[index].treasury = ''
                                                                setSplitPayments(newPayments)
                                                            }}
                                                        >
                                                            <option value="cash">نقدي</option>
                                                            <option value="card">بطاقة</option>
                                                            <option value="bank">حوالة</option>
                                                            <option value="check">شيك</option>
                                                        </select>

                                                        <input
                                                            type="number"
                                                            value={payment.amount}
                                                            onChange={e => {
                                                                const newPayments = [...splitPayments]
                                                                newPayments[index].amount = Number(e.target.value)
                                                                setSplitPayments(newPayments)
                                                            }}
                                                            className="flex-1 h-8 text-sm font-bold text-center bg-white border border-slate-300 rounded focus:border-blue-500 outline-none"
                                                            placeholder="المبلغ"
                                                        />

                                                        <button
                                                            type="button"
                                                            className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                            onClick={() => {
                                                                const newPayments = splitPayments.filter((_, i) => i !== index)
                                                                setSplitPayments(newPayments)
                                                            }}
                                                            disabled={splitPayments.length === 1}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>

                                                    <TreasurySelector
                                                        value={payment.treasury}
                                                        onChange={(val) => {
                                                            const newPayments = [...splitPayments]
                                                            newPayments[index].treasury = val
                                                            setSplitPayments(newPayments)
                                                        }}
                                                        filterType={payment.method === 'cash' ? 'safe' : 'bank'}
                                                        className="w-full"
                                                        required={Number(payment.amount) > 0}
                                                        placeholder={payment.method === 'cash' ? 'اختر الخزينة...' : 'اختر الحساب البنكي...'}
                                                    />
                                                </div>
                                            ))}

                                            <button
                                                type="button"
                                                className="w-full py-2 border border-dashed border-slate-300 rounded text-sm text-slate-600 hover:bg-slate-100 hover:text-primary transition-all flex justify-center items-center gap-2"
                                                onClick={() => setSplitPayments([...splitPayments, { method: 'cash', amount: 0, treasury: '' }])}
                                            >
                                                <Plus size={14} />
                                                إضافة طريقة دفع أخرى
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>الخزينة / الحساب</Label>
                                            <TreasurySelector
                                                value={form.treasury}
                                                onChange={val => setForm({ ...form, treasury: val })}
                                                required={true}
                                                filterType={treasuryFilter}
                                            />
                                        </div>
                                    )}

                                    {/* Notes */}
                                    <div className="space-y-2">
                                        <Label htmlFor="note">ملاحظات</Label>
                                        <textarea
                                            id="note"
                                            className="input h-24 resize-none"
                                            value={form.note}
                                            onChange={e => setForm({ ...form, note: e.target.value })}
                                            placeholder="وصف للسند..."
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <Button type="submit" className="w-full" disabled={saving}>
                                        {saving ? 'جاري الحفظ...' : '💾 حفظ السند'}
                                    </Button>
                                </div>

                                {/* Available Invoices Column */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-lg border-b pb-2">الفواتير المستحقة</h3>
                                    <div className="border rounded-lg overflow-hidden bg-gray-50 h-[calc(100%-3rem)] overflow-y-auto">
                                        {availableInvoices.length === 0 ? (
                                            <div className="p-8 text-center text-gray-400">
                                                {form.customer ? 'لا توجد فواتير مستحقة لهذا العميل' : 'اختر العميل أولاً'}
                                            </div>
                                        ) : (
                                            <table className="table w-full">
                                                <thead className="bg-gray-100 sticky top-0">
                                                    <tr>
                                                        <th className="w-8"></th>
                                                        <th className="text-right">رقم الفاتورة</th>
                                                        <th className="text-right">التاريخ</th>
                                                        <th className="text-right">المتبقي</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {availableInvoices.map(inv => {
                                                        const isSelected = selectedInvoices.some(i => i._id === inv._id)
                                                        return (
                                                            <tr
                                                                key={inv._id}
                                                                className={`cursor-pointer hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}
                                                                onClick={() => toggleInvoiceSelection(inv)}
                                                            >
                                                                <td>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => { }}
                                                                        className="checkbox checkbox-sm"
                                                                    />
                                                                </td>
                                                                <td className="font-mono text-xs">#{inv.number || inv._id.slice(-6)}</td>
                                                                <td className="text-xs">{new Date(inv.date).toLocaleDateString('ar-LY')}</td>
                                                                <td className="text-xs font-bold text-red-600">
                                                                    {Number(inv.remaining || inv.totals?.grand || 0).toLocaleString()} د.ل
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* View Receipt Dialog */}
            <Dialog
                open={viewModal.show && !!viewModal.receipt}
                onOpenChange={(open) => !open && setViewModal({ show: false, receipt: null })}
            >
                <DialogContent className="max-w-2xl" onClose={() => setViewModal({ show: false, receipt: null })}>
                    <DialogHeader className="bg-gradient-to-r from-emerald-600 to-green-600 text-white -m-6 mb-0 p-6 rounded-t-xl">
                        <DialogTitle className="flex items-center gap-3 text-white">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <ReceiptIcon size={24} />
                            </div>
                            <div>
                                <div className="text-xl font-bold">سند قبض #{viewModal.receipt?._id?.slice(-6)}</div>
                                <div className="text-emerald-100 text-sm font-normal">
                                    التاريخ: {viewModal.receipt && new Date(viewModal.receipt.date).toLocaleDateString('ar-LY')}
                                </div>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    <DialogBody className="space-y-6 pt-8">
                        {/* Receipt Details Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-sm text-slate-500 mb-1">العميل</div>
                                <div className="font-bold text-lg text-slate-800">{viewModal.receipt?.customer?.name || '-'}</div>
                            </div>
                            <div className="bg-emerald-50 rounded-xl p-4">
                                <div className="text-sm text-emerald-600 mb-1">المبلغ</div>
                                <div className="font-bold text-2xl text-emerald-600">{Number(viewModal.receipt?.amount || 0).toLocaleString()} د.ل</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-sm text-slate-500 mb-1">طريقة الدفع</div>
                                <div className="font-medium text-slate-800">
                                    {viewModal.receipt?.method === 'cash' ? '💵 نقدي' :
                                        viewModal.receipt?.method === 'bank' ? '🏦 تحويل بنكي' : '📝 شيك'}
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-sm text-slate-500 mb-1">تاريخ الإنشاء</div>
                                <div className="font-medium text-sm text-slate-800">
                                    {viewModal.receipt && new Date(viewModal.receipt.createdAt).toLocaleString('ar-LY')}
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {viewModal.receipt?.note && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <div className="text-sm font-bold text-amber-800 mb-1">📝 ملاحظات:</div>
                                <div className="text-amber-900">{viewModal.receipt.note}</div>
                            </div>
                        )}

                        {/* Linked Invoices */}
                        {viewModal.receipt?.allocations?.length > 0 && (
                            <div>
                                <div className="font-bold mb-3 text-slate-700">الفواتير المرتبطة:</div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-slate-100">
                                            <tr>
                                                <th className="p-3 text-sm font-bold text-right text-slate-600">رقم الفاتورة</th>
                                                <th className="p-3 text-sm font-bold text-right text-slate-600">المبلغ المدفوع</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {viewModal.receipt.allocations.map((alloc, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-3 font-mono text-sm">#{alloc.invoice?._id?.slice(-6) || '-'}</td>
                                                    <td className="p-3 font-bold text-emerald-600">{Number(alloc.amount).toLocaleString()} د.ل</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </DialogBody>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setViewModal({ show: false, receipt: null })}>
                            إغلاق
                        </Button>
                        <Button className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700">
                            <Printer size={18} className="ml-2" />
                            طباعة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
