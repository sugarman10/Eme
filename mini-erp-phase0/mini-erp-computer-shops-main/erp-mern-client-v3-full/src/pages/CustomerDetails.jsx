import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import {
    ArrowRight, Users, Phone, Mail, MapPin, CreditCard, FileText,
    Calendar, DollarSign, CheckCircle2, TrendingDown, TrendingUp,
    ChevronLeft, ChevronRight, Coins, Receipt, RotateCcw, Filter,
    ArrowUpRight, Printer
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import { useSettings } from '../context/SettingsContext'
import VoucherPrintModal from '../components/modals/VoucherPrintModal'

const PAGE_SIZE = 40

// ── helpers ────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toLocaleString('ar-LY') }

const entryTypeMap = {
    invoice: { label: 'فاتورة مبيعات', icon: FileText,     color: 'text-red-600',     badge: 'bg-red-50 text-red-700 border-red-200',        side: 'debit'  },
    receipt: { label: 'سند قبض',       icon: Receipt,      color: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', side: 'credit' },
    payment: { label: 'سند دفع',       icon: ArrowUpRight, color: 'text-orange-600',  badge: 'bg-orange-50 text-orange-700 border-orange-200', side: 'debit'  },
    refund:  { label: 'مرتجع مبيعات',  icon: RotateCcw,    color: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200',        side: 'credit' },
}

function TypeBadge({ type }) {
    const t = entryTypeMap[type] || entryTypeMap.invoice
    const Icon = t.icon
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${t.badge}`}>
            <Icon size={11} />{t.label}
        </span>
    )
}

export default function CustomerDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { usdExchangeRate = 7.30 } = useSettings()

    const [page, setPage]           = useState(1)
    const [typeFilter, setTypeFilter] = useState('all')   // 'all' | 'invoice' | 'receipt' | 'refund'
    const [printVoucher, setPrintVoucher] = useState(null)

    // ── Data fetching ──────────────────────────────────────────────────────
    const { data: customer, isLoading: loadingCustomer } = useQuery({
        queryKey: ['customer', id],
        queryFn: async () => {
            const { data } = await api.get(`/customers/${id}`)
            return data
        },
        staleTime: 30_000
    })

    const { data: invoices = [], isLoading: loadingInv } = useQuery({
        queryKey: ['salesInvoices', id],
        queryFn: async () => {
            const { data } = await api.get(`/sales/invoice?customer=${id}&limit=5000`)
            return data?.docs || data || []
        },
        staleTime: 60_000
    })

    const { data: receipts = [], isLoading: loadingRec } = useQuery({
        queryKey: ['customer-receipts', id],
        queryFn: async () => {
            const { data } = await api.get(`/finance/receipts?customer=${id}`)
            return data || []
        },
        staleTime: 30_000
    })

    const { data: payments = [], isLoading: loadingPay } = useQuery({
        queryKey: ['customer-payments', id],
        queryFn: async () => {
            const { data } = await api.get(`/finance/payments?customer=${id}`)
            return data || []
        },
        staleTime: 30_000
    })

    // ── Build unified ledger ───────────────────────────────────────────────
    const ledger = useMemo(() => {
        const entries = []

        // Sales invoices → debit (increase balance owed)
        for (const inv of invoices) {
            if (inv.status === 'cancelled' || inv.status === 'void') continue
            const isRefund = inv.channel === 'return' || inv.status === 'refund' || inv.type === 'return'
            entries.push({
                _id: inv._id,
                date: new Date(inv.date || inv.createdAt),
                type: isRefund ? 'refund' : 'invoice',
                ref:  `#${inv._id.slice(-6).toUpperCase()}`,
                desc: isRefund ? 'مرتجع مبيعات' : `فاتورة مبيعات${inv.channel === 'wholesale' ? ' (جملة)' : ' (قطاعي)'}`,
                debit:  isRefund ? 0 : (inv.totals?.grand || 0),
                credit: isRefund ? (inv.totals?.grand || 0) : 0,
                status: inv.status,
            })
        }

        // Receipts → credit (decrease balance owed)
        for (const r of receipts) {
            if (r.status === 'void' || r.status === 'reversed') continue
            entries.push({
                _id: r._id,
                date: new Date(r.date || r.createdAt),
                type: 'receipt',
                ref:  `#${r._id.slice(-6).toUpperCase()}`,
                desc: `سند قبض — ${r.method === 'cash' ? 'نقدي' : r.method === 'bank' ? 'تحويل بنكي' : r.method === 'check' ? 'شيك' : r.method}`,
                debit:  0,
                credit: r.amount || 0,
                status: r.status,
                raw: r,
            })
        }

        // Payment vouchers → debit (money paid to customer, reduces credit / increases debit)
        for (const p of payments) {
            if (p.status === 'void') continue
            entries.push({
                _id: p._id,
                date: new Date(p.date || p.createdAt),
                type: 'payment',
                ref:  p.number || `#${p._id.slice(-6).toUpperCase()}`,
                desc: `سند دفع — ${p.note || (p.method === 'cash' ? 'نقدي' : p.method === 'bank' ? 'تحويل بنكي' : p.method)}`,
                debit:  p.amount || 0,
                credit: 0,
                status: p.status,
                raw: p,
            })
        }

        // Sort chronologically ascending (oldest first → running balance makes sense)
        entries.sort((a, b) => a.date - b.date)

        // Compute running balance
        let running = 0
        const withBalance = entries.map(e => {
            const prevBal = running
            running += (e.debit - e.credit)
            return { ...e, previousBalance: prevBal, runningBalance: running }
        })

        return withBalance.reverse() // show newest first in table
    }, [invoices, receipts, payments])

    // ── Financial summary ──────────────────────────────────────────────────
    const financials = useMemo(() => {
        const validInv  = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'void')
        const totalGrand = validInv.reduce((s, i) => s + (i.totals?.grand || 0), 0)
        const totalPaid  = validInv.reduce((s, i) => s + (i.totals?.paid  || 0), 0)
        const balance    = Number(customer?.balance || 0)
        return { totalGrand, totalPaid, balance }
    }, [invoices, customer])

    // ── Filtered + paginated ──────────────────────────────────────────────
    const filtered = useMemo(() => {
        if (typeFilter === 'all') return ledger
        return ledger.filter(e => e.type === typeFilter)
    }, [ledger, typeFilter])

    const totalPages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const paged         = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const handleFilter  = (f) => { setTypeFilter(f); setPage(1) }

    // ── Balance card theme ────────────────────────────────────────────────
    const bal = financials.balance
    let balTheme
    if (bal === 0) {
        balTheme = { bg: 'bg-slate-50 border-slate-200', title: 'text-slate-600', val: 'text-slate-700', Icon: Coins, label: 'الحساب متصفي', desc: 'لا يوجد رصيد مدين أو دائن' }
    } else if (bal < 0) {
        balTheme = { bg: 'bg-emerald-50/60 border-emerald-200', title: 'text-emerald-700', val: 'text-emerald-800', Icon: TrendingUp, label: '✓ باقي لك', desc: 'العميل دفع زيادة — هذا المبلغ مستحق له' }
    } else {
        balTheme = { bg: 'bg-red-50/60 border-red-200', title: 'text-red-700', val: 'text-red-800', Icon: TrendingDown, label: '✗ باقي عليه', desc: 'مبلغ مستحق على العميل لم يُسدَّد بعد' }
    }

    // ── Loading / not-found ───────────────────────────────────────────────
    if (loadingCustomer) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-muted-foreground text-sm">جاري تحميل بيانات العميل...</span>
                </div>
            </div>
        )
    }
    if (!customer) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="text-muted-foreground">لم يتم العثور على العميل</div>
                <Button onClick={() => navigate('/customers')}>
                    <ArrowRight size={18} className="ml-2" />العودة للعملاء
                </Button>
            </div>
        )
    }

    const isLoading = loadingInv || loadingRec || loadingPay

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
                        <ArrowRight size={20} />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{customer.name}</h1>
                        <p className="text-muted-foreground text-sm">كود: {customer.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                        onClick={() => navigate(`/customer-receipts?customer=${id}`)}
                    >
                        <Receipt size={16} />
                        سند قبض
                    </Button>
                    <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5 shadow-sm"
                        onClick={() => navigate(`/payment-vouchers?customer=${id}`)}
                    >
                        <ArrowUpRight size={16} />
                        سند دفع
                    </Button>
                </div>
            </div>

            {/* ── Customer info ────────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Users size={18} />معلومات العميل
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">النوع</div>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${customer.type === 'wholesale' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                                {customer.type === 'wholesale' ? 'جملة' : 'قطاعي'}
                            </span>
                        </div>
                        {customer.phone && (
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone size={11} />الهاتف</div>
                                <div className="font-medium text-sm">{customer.phone}</div>
                            </div>
                        )}
                        {customer.email && (
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={11} />البريد</div>
                                <div className="font-medium text-sm">{customer.email}</div>
                            </div>
                        )}
                        {customer.address && (
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} />العنوان</div>
                                <div className="font-medium text-sm">{customer.address}</div>
                            </div>
                        )}
                        {customer.creditLimit > 0 && (
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard size={11} />سقف الائتمان</div>
                                <div className="font-medium text-sm text-emerald-600">{fmt(customer.creditLimit)} د.ل</div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── 3 financial cards ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                            <DollarSign size={15} />إجمالي المشتريات
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">{fmt(financials.totalGrand)}<span className="text-sm font-normal text-blue-700 mr-1">د.ل</span></div>
                        <p className="text-xs text-blue-600 mt-1">{invoices.filter(i => i.status !== 'cancelled' && i.status !== 'void').length} فاتورة صالحة</p>
                    </CardContent>
                </Card>

                <Card className="bg-green-50/50 border-green-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                            <CheckCircle2 size={15} />إجمالي المدفوع
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900">{fmt(financials.totalPaid)}<span className="text-sm font-normal text-green-700 mr-1">د.ل</span></div>
                        <p className="text-xs text-green-600 mt-1">المبالغ المستلمة من العميل</p>
                    </CardContent>
                </Card>

                <Card className={`border ${balTheme.bg}`}>
                    <CardHeader className="pb-2">
                        <CardTitle className={`text-sm font-medium flex items-center gap-2 ${balTheme.title}`}>
                            <balTheme.Icon size={15} />{balTheme.label}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {customer.balanceUSD && Math.abs(customer.balanceUSD) > 0.01 ? (
                            <div>
                                <div className="text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
                                    ${Number(customer.balanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    <span className="text-xs font-normal text-slate-500 mr-1.5 font-sans">مثبت بالدولار</span>
                                </div>
                                <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1 font-mono">
                                    ≈ {(Math.abs(customer.balanceUSD) * (usdExchangeRate || 7.30)).toLocaleString('ar-LY')} د.ل
                                    <span className="text-xs font-normal text-slate-400 mr-1 font-sans">(سعر الصرف اليوم: {usdExchangeRate || 7.30})</span>
                                </div>
                                <p className="text-[11px] mt-1 text-slate-500 font-medium">أصل الدين مثبت بالدولار لحماية المستحقات من التضخم</p>
                            </div>
                        ) : (
                            <div>
                                <div className={`text-3xl font-black ${balTheme.val}`}>
                                    {fmt(Math.abs(bal))}<span className={`text-sm font-normal mr-1 ${balTheme.title}`}>د.ل</span>
                                </div>
                                <p className={`text-xs mt-1 ${balTheme.title}`}>{balTheme.desc}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── UNIFIED LEDGER ───────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText size={18} />
                            كشف الحساب
                            <span className="text-sm font-normal text-muted-foreground">
                                ({filtered.length} سجل)
                            </span>
                        </CardTitle>
                        {/* Filter tabs */}
                        <div className="flex gap-1 flex-wrap">
                            {[
                                { v: 'all',     l: 'الكل',          count: ledger.length },
                                { v: 'invoice', l: 'الفواتير',      count: ledger.filter(e => e.type === 'invoice').length },
                                { v: 'receipt', l: 'سندات القبض',   count: ledger.filter(e => e.type === 'receipt').length },
                                { v: 'payment', l: 'سندات الدفع',   count: ledger.filter(e => e.type === 'payment').length },
                                { v: 'refund',  l: 'المردودات',     count: ledger.filter(e => e.type === 'refund').length  },
                            ].map(({ v, l, count }) => (
                                <button
                                    key={v}
                                    onClick={() => handleFilter(v)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border flex items-center gap-1 ${typeFilter === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-muted-foreground/30 hover:bg-muted'}`}
                                >
                                    {l}
                                    {count > 0 && <span className={`inline-block px-1.5 rounded-full text-[10px] ${typeFilter === v ? 'bg-white/25' : 'bg-muted'}`}>{count}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-10 text-center">
                            <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                            <span className="text-muted-foreground text-sm">جاري التحميل...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-10 text-center text-muted-foreground text-sm">
                            لا توجد معاملات مطابقة للفلتر المحدد.
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40">
                                        <TableHead>التاريخ</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>المرجع</TableHead>
                                        <TableHead>البيان</TableHead>
                                        <TableHead className="text-right text-red-600">مدين</TableHead>
                                        <TableHead className="text-right text-emerald-600">دائن</TableHead>
                                        <TableHead className="text-right">الرصيد</TableHead>
                                        <TableHead className="text-center">طباعة</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paged.map(entry => {
                                        const runBal = entry.runningBalance
                                        return (
                                            <TableRow
                                                key={`${entry.type}-${entry._id}`}
                                                className={`hover:bg-muted/30 transition-colors text-sm ${
                                                    entry.type === 'receipt' ? 'bg-emerald-50/20' :
                                                    entry.type === 'payment' ? 'bg-orange-50/20'  :
                                                    entry.type === 'refund'  ? 'bg-blue-50/20'    : ''
                                                }`}
                                            >
                                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                                    <span className="flex items-center gap-1 text-xs">
                                                        <Calendar size={11} />
                                                        {entry.date.toLocaleDateString('ar-LY')}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <TypeBadge type={entry.type} />
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-bold text-indigo-600">
                                                    {entry.ref}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs max-w-[160px] truncate">
                                                    {entry.desc}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-red-700">
                                                    {entry.debit > 0 ? <span>{fmt(entry.debit)} <span className="text-xs font-normal">د.ل</span></span> : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-emerald-700">
                                                    {entry.credit > 0 ? <span>{fmt(entry.credit)} <span className="text-xs font-normal">د.ل</span></span> : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={`font-bold text-sm ${runBal > 0 ? 'text-red-600' : runBal < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                        {runBal === 0 ? '—' : `${fmt(Math.abs(runBal))} د.ل`}
                                                    </span>
                                                    {runBal !== 0 && (
                                                        <div className={`text-[10px] ${runBal > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                            {runBal > 0 ? 'مدين' : 'دائن'}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {(entry.type === 'receipt' || entry.type === 'payment') ? (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-xs gap-1 text-slate-600 hover:text-slate-900"
                                                            onClick={() => setPrintVoucher({
                                                                ...(entry.raw || {}),
                                                                _id: entry._id,
                                                                number: entry.ref,
                                                                voucherType: entry.type,
                                                                customer,
                                                                partyName: customer?.name,
                                                                partyType: 'customer',
                                                                amount: entry.type === 'receipt' ? entry.credit : entry.debit,
                                                                previousBalance: entry.previousBalance,
                                                                remainingBalance: entry.runningBalance,
                                                                date: entry.date,
                                                                note: entry.raw?.note || entry.desc
                                                            })}
                                                            title="طباعة السند"
                                                        >
                                                            <Printer size={13} />
                                                            طباعة السند
                                                        </Button>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">—</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                                    <span className="text-xs text-muted-foreground">
                                        صفحة {page} من {totalPages} ({filtered.length} سجل)
                                    </span>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 p-0">
                                            <ChevronRight size={14} />
                                        </Button>
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                                            return (
                                                <Button key={p} size="sm" variant={p === page ? 'default' : 'ghost'} onClick={() => setPage(p)} className="h-7 w-7 p-0 text-xs">
                                                    {p}
                                                </Button>
                                            )
                                        })}
                                        <Button size="sm" variant="ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 w-7 p-0">
                                            <ChevronLeft size={14} />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <VoucherPrintModal
                isOpen={!!printVoucher}
                voucher={printVoucher}
                voucherType={printVoucher?.voucherType}
                onClose={() => setPrintVoucher(null)}
            />
        </div>
    )
}
