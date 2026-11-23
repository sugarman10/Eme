import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
    ArrowUpRight, Search, X, Eye, Check, FileText, Calendar,
    Building2, Hash, TrendingDown, AlertCircle, XCircle, Banknote, Users, Printer
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { TreasurySelector } from '../components/TreasurySelector'
import VoucherPrintModal from '../components/modals/VoucherPrintModal'

function fmt(n) { return Number(n || 0).toLocaleString('ar-LY') }

export default function SupplierPayments() {
    const { push } = useToast()
    const queryClient = useQueryClient()
    const [searchParams] = useSearchParams()
    const urlSupplierId = searchParams.get('supplier')

    const [q, setQ]             = useState('')
    const [showOnlyDebtors, setShowOnlyDebtors] = useState(!urlSupplierId)
    const [payModal, setPayModal] = useState(null)   // { supplier, invoices }
    const [payForm, setPayForm]   = useState({ treasuryId: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] })
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [printVoucher, setPrintVoucher] = useState(null)
    const [printAfterPay, setPrintAfterPay] = useState(false)

    // ── Data ──────────────────────────────────────────────────────────────
    const { data: allSuppliers = [], isLoading } = useQuery({
        queryKey: ['suppliers-balance'],
        queryFn: async () => {
            const { data } = await api.get('/procurement/suppliers')
            return (data || []).sort((a, b) => (b.balance || 0) - (a.balance || 0))
        },
        staleTime: 30_000
    })

    const { data: paymentHistory = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['supplier-payments-history'],
        queryFn: async () => {
            const { data } = await api.get('/procurement/orders/payments?limit=50')
            return data || []
        },
        staleTime: 30_000
    })

    const suppliers = useMemo(() => {
        if (showOnlyDebtors) {
            return allSuppliers.filter(s => (s.balance || 0) > 0)
        }
        return allSuppliers
    }, [allSuppliers, showOnlyDebtors])

    const { data: unpaidOrders = [], isFetching: fetchingOrders } = useQuery({
        queryKey: ['supplier-unpaid', payModal?.supplier?._id],
        queryFn: async () => {
            const { data } = await api.get(`/procurement/suppliers/${payModal.supplier._id}/unpaid-orders`)
            return data || []
        },
        enabled: !!payModal?.supplier?._id,
        staleTime: 30_000
    })

    // ── Pay mutation ──────────────────────────────────────────────────────
    const payMutation = useMutation({
        mutationFn: async (payload) => {
            const { data } = await api.post('/procurement/orders/payments', payload)
            return data
        },
        onSuccess: (data, variables) => {
            push('success', 'تم تسجيل الدفع بنجاح ✓')
            queryClient.invalidateQueries(['suppliers-balance'])
            queryClient.invalidateQueries(['supplier-unpaid'])
            queryClient.invalidateQueries(['supplier-payments-history'])
            if (printAfterPay) {
                const prevBal = Number(payModal?.supplier?.balance || 0)
                const paidAmt = Number(variables.amount || 0)
                setPrintVoucher(data?.voucher || {
                    voucherType: 'payment',
                    supplier: payModal?.supplier,
                    partyName: payModal?.supplier?.name,
                    partyType: 'supplier',
                    amount: paidAmt,
                    previousBalance: prevBal,
                    remainingBalance: prevBal - paidAmt,
                    note: variables.note || `دفعة للمورد: ${payModal?.supplier?.name || ''}`,
                    date: variables.date || new Date().toISOString()
                })
                setPrintAfterPay(false)
            }
            setPayModal(null)
            setPayForm({ treasuryId: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] })
            setSelectedOrder(null)
        },
        onError: (err) => {
            setPrintAfterPay(false)
            const msg = err?.response?.data?.errors?.map(e => e.msg).join('، ')
                || err?.response?.data?.message || 'فشل عملية الدفع'
            push('error', msg)
        }
    })

    const handlePaySubmit = (e) => {
        e.preventDefault()
        if (!payForm.treasuryId) return push('error', 'اختر الخزينة')
        const amount = Number(payForm.amount)
        if (!amount || amount <= 0) return push('error', 'أدخل مبلغ صحيح')

        payMutation.mutate({
            supplierId: payModal.supplier._id,
            treasuryId: payForm.treasuryId,
            amount,
            note: payForm.note,
            date: payForm.date,
            orderId: selectedOrder || undefined,
        })
    }

    const openPayModal = (supplier) => {
        setPayModal({ supplier })
        setPayForm({ treasuryId: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] })
        setSelectedOrder(null)
    }

    // Auto open pay modal if navigated from suppliers list with ?supplier=id
    useEffect(() => {
        if (urlSupplierId && allSuppliers.length > 0 && !payModal) {
            const matched = allSuppliers.find(s => s._id === urlSupplierId)
            if (matched) {
                openPayModal(matched)
            }
        }
    }, [urlSupplierId, allSuppliers])

    const selectOrderAmount = (order) => {
        setSelectedOrder(order._id)
        setPayForm(f => ({
            ...f,
            amount: order.remainingBalance,
            note: f.note || `سداد فاتورة ${order.number}`
        }))
    }

    // ── KPIs ──────────────────────────────────────────────────────────────
    const totalDebt     = useMemo(() => allSuppliers.reduce((s, sup) => s + (sup.balance > 0 ? sup.balance : 0), 0), [allSuppliers])
    const creditorsCount = useMemo(() => allSuppliers.filter(s => (s.balance || 0) > 0).length, [allSuppliers])
    const highestDebtor = useMemo(() => allSuppliers.find(s => (s.balance || 0) > 0), [allSuppliers])

    // ── Filter ────────────────────────────────────────────────────────────
    const filtered = useMemo(() =>
        suppliers.filter(s => s.name.toLowerCase().includes(q.toLowerCase()))
    , [suppliers, q])

    return (
        <div className="flex flex-col gap-5 animate-in fade-in duration-300">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <ArrowUpRight size={22} className="text-red-600" />
                    سندات الدفع للموردين
                </h1>
                <p className="text-muted-foreground text-sm">تسوية مديونيات الموردين وتسجيل الدفعات الخارجة والدفعات المقدمة</p>
            </div>

            {/* ── KPI cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-red-50/60 border-red-100">
                    <CardHeader className="pb-1 pt-4 px-4">
                        <CardTitle className="text-xs font-medium text-red-700 flex items-center gap-2">
                            <AlertCircle size={14} />إجمالي المستحق للموردين
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <div className="text-2xl font-black text-red-900">
                            {fmt(totalDebt)} <span className="text-sm font-normal text-red-600">د.ل</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50/60 border-orange-100">
                    <CardHeader className="pb-1 pt-4 px-4">
                        <CardTitle className="text-xs font-medium text-orange-700 flex items-center gap-2">
                            <Building2 size={14} />عدد الموردين الدائنين
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <div className="text-2xl font-black text-orange-900">
                            {creditorsCount} <span className="text-sm font-normal text-orange-600">مورد</span>
                        </div>
                    </CardContent>
                </Card>
                {highestDebtor && (
                    <Card className="bg-slate-50 border-slate-200">
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-slate-600 flex items-center gap-2">
                                <TrendingDown size={14} />أعلى رصيد مستحق
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <div className="font-bold text-slate-800 truncate">{highestDebtor.name}</div>
                            <div className="text-sm text-red-600 font-bold">{fmt(highestDebtor.balance)} د.ل</div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Suppliers table ─────────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pr-9 h-9"
                                placeholder="بحث عن مورد..."
                                value={q}
                                onChange={e => setQ(e.target.value)}
                            />
                        </div>
                        {q && <button onClick={() => setQ('')} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>}
                    </div>

                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium border">
                        <button
                            type="button"
                            onClick={() => setShowOnlyDebtors(true)}
                            className={`px-3 py-1.5 rounded-md transition-all ${showOnlyDebtors ? 'bg-white shadow text-red-600 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            الدائنين فقط ({creditorsCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowOnlyDebtors(false)}
                            className={`px-3 py-1.5 rounded-md transition-all ${!showOnlyDebtors ? 'bg-white shadow text-blue-600 font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            جميع الموردين ({allSuppliers.length})
                        </button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>المورد</TableHead>
                                <TableHead>الهاتف</TableHead>
                                <TableHead>الرصيد المستحق</TableHead>
                                <TableHead>الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={4} className="text-center p-10">
                                    <div className="w-6 h-6 border-4 border-red-200 border-t-red-500 rounded-full animate-spin mx-auto" />
                                </TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={4} className="text-center p-10 text-muted-foreground text-sm">
                                    {q ? `لا توجد نتائج لـ "${q}"` : 'لا توجد مديونيات مستحقة. ✓'}
                                </TableCell></TableRow>
                            ) : (
                                filtered.map(s => (
                                    <TableRow key={s._id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                                    <Building2 size={15} />
                                                </div>
                                                <div>
                                                    <div className="font-bold">{s.name}</div>
                                                    {s.code && <div className="text-xs text-muted-foreground font-mono">{s.code}</div>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{s.phone || '—'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-red-700 text-sm">{fmt(s.balance)} د.ل</span>
                                                <span className="text-xs text-red-400">✗ باقي عليك</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="sm"
                                                className="bg-red-600 hover:bg-red-700 text-white gap-1 h-8"
                                                onClick={() => openPayModal(s)}
                                            >
                                                <ArrowUpRight size={14} />
                                                سداد دفعة
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ══════════════════ PAY MODAL ═══════════════════════════ */}
            {payModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                        {/* Left: Payment form */}
                        <div className="flex-1 flex flex-col overflow-y-auto">
                            {/* Modal header */}
                            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                        <ArrowUpRight size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-lg">{payModal.supplier.name}</div>
                                        <div className="text-red-200 text-sm">باقي عليك: {fmt(payModal.supplier.balance)} د.ل</div>
                                    </div>
                                </div>
                                <button onClick={() => setPayModal(null)} className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handlePaySubmit} className="p-5 space-y-4 flex-1">
                                {/* Debt indicator */}
                                <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center justify-between">
                                    <span className="text-sm font-medium text-red-700">الرصيد المستحق للمورد</span>
                                    <span className="text-xl font-black text-red-800">{fmt(payModal.supplier.balance)} د.ل</span>
                                </div>

                                {/* Amount + Date */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">المبلغ المدفوع <span className="text-red-500">*</span></label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            required
                                            value={payForm.amount}
                                            onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                                            placeholder="0.000"
                                            className="h-11 text-lg font-bold text-center"
                                            autoFocus
                                        />
                                        {Number(payForm.amount) > payModal.supplier.balance && (
                                            <p className="text-[11px] text-blue-600 font-bold">
                                                ★ الزيادة ({fmt(Number(payForm.amount) - payModal.supplier.balance)} د.ل) ستُحتسب كدفعة مقدمة.
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">التاريخ</label>
                                        <Input
                                            type="date"
                                            value={payForm.date}
                                            onChange={e => setPayForm({ ...payForm, date: e.target.value })}
                                            className="h-11"
                                        />
                                    </div>
                                </div>

                                {/* Treasury */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">الخزينة (مصدر الأموال) <span className="text-red-500">*</span></label>
                                    <TreasurySelector
                                        value={payForm.treasuryId}
                                        onChange={val => setPayForm({ ...payForm, treasuryId: val })}
                                        required
                                    />
                                </div>

                                {/* Note */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">ملاحظات</label>
                                    <Input
                                        value={payForm.note}
                                        onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                                        placeholder="رقم إيصال، مرجع الدفعة..."
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPayModal(null)}>
                                        إلغاء
                                    </Button>
                                    <Button
                                        type="submit"
                                        onClick={() => setPrintAfterPay(false)}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-11"
                                        disabled={payMutation.isPending || !payForm.amount || !payForm.treasuryId}
                                    >
                                        {payMutation.isPending && !printAfterPay
                                            ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />جاري السداد...</div>
                                            : <div className="flex items-center gap-1.5"><Check size={16} />تأكيد الدفع</div>
                                        }
                                    </Button>
                                    <Button
                                        type="submit"
                                        onClick={() => setPrintAfterPay(true)}
                                        className="flex-[1.4] bg-slate-900 hover:bg-slate-800 text-white font-bold h-11"
                                        disabled={payMutation.isPending || !payForm.amount || !payForm.treasuryId}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Printer size={16} />
                                            حفظ وطباعة السند
                                        </div>
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* Right: Unpaid invoices */}
                        <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 flex flex-col max-h-[90vh]">
                            <div className="p-4 border-b border-slate-200 bg-slate-100 shrink-0">
                                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                                    <FileText size={15} />
                                    فواتير الشراء غير المسددة
                                </h4>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {fetchingOrders ? (
                                    <p className="text-center text-xs text-muted-foreground py-6">جاري التحميل...</p>
                                ) : unpaidOrders.length === 0 ? (
                                    <p className="text-center text-xs text-muted-foreground py-6">لا توجد فواتير مستحقة</p>
                                ) : (
                                    unpaidOrders.map(order => (
                                        <div
                                            key={order._id}
                                            className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedOrder === order._id ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200 hover:border-red-200'}`}
                                            onClick={() => selectOrderAmount(order)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className="font-mono text-xs font-bold text-slate-700">#{order.number}</span>
                                                <span className="text-[10px] text-muted-foreground">{new Date(order.date).toLocaleDateString('ar-LY')}</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1.5 text-xs">
                                                <span className="text-muted-foreground">الإجمالي: {fmt(order.totalAmount)}</span>
                                                <span className="font-bold text-red-600">باقي: {fmt(order.remainingBalance)} د.ل</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Supplier Payment Vouchers History ─────────────────── */}
            <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <FileText size={17} className="text-red-600" />
                        سجل سندات الصرف للموردين
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">{paymentHistory.length} سند</span>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم السند</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>المورد</TableHead>
                                <TableHead>المبلغ المدفوع</TableHead>
                                <TableHead>الخزينة</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead className="text-center">طباعة السند</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingHistory ? (
                                <TableRow><TableCell colSpan={7} className="text-center p-8 text-muted-foreground text-sm">جاري التحميل...</TableCell></TableRow>
                            ) : paymentHistory.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center p-8 text-muted-foreground text-sm">لا توجد سندات صرف مسجلة للموردين بعد</TableCell></TableRow>
                            ) : (
                                paymentHistory.map(v => (
                                    <TableRow key={v._id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-mono text-xs font-bold text-red-700">{v.number}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{new Date(v.date || v.createdAt).toLocaleDateString('ar-LY')}</TableCell>
                                        <TableCell className="font-bold text-sm">{v.partyName}</TableCell>
                                        <TableCell className="font-bold text-red-700">{fmt(v.amount)} د.ل</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{v.treasuryName}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{v.note}</TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 gap-1.5 text-xs border-slate-300 hover:bg-slate-100"
                                                onClick={() => setPrintVoucher(v)}
                                            >
                                                <Printer size={14} />
                                                طباعة السند
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ══════════════════ VOUCHER PRINT MODAL ═══════════════════════════ */}
            <VoucherPrintModal
                isOpen={!!printVoucher}
                voucher={printVoucher}
                voucherType="payment"
                onClose={() => setPrintVoucher(null)}
            />
        </div>
    )
}
