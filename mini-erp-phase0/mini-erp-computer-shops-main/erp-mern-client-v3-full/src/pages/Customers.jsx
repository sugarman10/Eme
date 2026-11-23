import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { Plus, Edit2, Trash2, Search, Users, Phone, CreditCard, Eye, Lock, TrendingDown, TrendingUp, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import CustomerModal from '../components/modals/CustomerModal'
import { useSettings } from '../context/SettingsContext'

// Simple debounce hook
function useDebounce(value, delay = 400) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(t)
    }, [value, delay])
    return debounced
}

export default function Customers() {
    const { push } = useToast()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [q, setQ] = useState('')
    const debouncedQ = useDebounce(q, 400)

    const [showModal, setShowModal] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [selectedId, setSelectedId] = useState(null)

    // Fetch Customers
    const { data: customers = [], isLoading } = useQuery({
        queryKey: ['customers', debouncedQ],
        queryFn: async () => {
            const { data } = await api.get(`/customers?q=${encodeURIComponent(debouncedQ)}`)
            return data || []
        },
        staleTime: 30_000,
        keepPreviousData: true,
        onError: (err) => push('error', err?.response?.data?.message || 'فشل جلب العملاء')
    })

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`/customers/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['customers'])
            push('success', 'تم حذف العميل')
            setSelectedId(null)
        },
        onError: () => push('error', 'فشل الحذف')
    })

    const selectedCustomer = customers.find(c => c._id === selectedId)
    const isSystemSelected = selectedCustomer?.isSystem

    const handleOpenModal = (item = null) => { setEditingItem(item); setShowModal(true) }
    const handleCloseModal = () => { setShowModal(false); setEditingItem(null) }

    const handleDelete = (id) => deleteMutation.mutate(id)

    const handleEditSelected = () => {
        if (!selectedId) return push('error', 'يرجى اختيار عميل أولاً')
        if (selectedCustomer) handleOpenModal(selectedCustomer)
    }

    const { usdExchangeRate = 7.30 } = useSettings()

    // Summary stats — balance only
    const totalDebt      = customers.reduce((s, c) => s + Math.max(0,  Number(c.balance || 0)), 0)
    const totalDebtUSD   = customers.reduce((s, c) => s + Math.max(0,  Number(c.balanceUSD || 0)), 0)
    const totalCredit    = customers.reduce((s, c) => s + Math.max(0, -Number(c.balance || 0)), 0)

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">

            {/* ── Page header ─────────────────────────────────────────────── */}
            <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">العملاء</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {customers.length} عميل &nbsp;·&nbsp;
                        <span className="text-red-600 font-medium">{totalDebt.toLocaleString('ar-LY')} د.ل ديون</span>
                        {totalDebtUSD > 0 && (
                            <span className="text-amber-600 font-medium font-mono"> (${totalDebtUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} مثبت بالدولار)</span>
                        )}
                        &nbsp;·&nbsp;
                        <span className="text-emerald-600 font-medium">{totalCredit.toLocaleString('ar-LY')} د.ل أرصدة دائنة</span>
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        variant="secondary"
                        onClick={() => navigate(`/customers/${selectedId}`)}
                        disabled={!selectedId}
                        className={!selectedId ? 'opacity-50' : ''}
                    >
                        <Eye size={16} className="mr-1" />
                        تفاصيل
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleEditSelected}
                        disabled={!selectedId || isSystemSelected}
                        className={(!selectedId || isSystemSelected) ? 'opacity-50' : ''}
                        title={isSystemSelected ? 'لا يمكن تعديل عميل النظام' : ''}
                    >
                        {isSystemSelected ? <Lock size={16} className="mr-1" /> : <Edit2 size={16} className="mr-1" />}
                        تعديل
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => {
                            if (window.confirm('هل أنت متأكد من حذف هذا العميل؟')) handleDelete(selectedId)
                        }}
                        disabled={!selectedId || isSystemSelected}
                        className={(!selectedId || isSystemSelected) ? 'opacity-50' : ''}
                    >
                        {isSystemSelected ? <Lock size={16} className="mr-1" /> : <Trash2 size={16} className="mr-1" />}
                        حذف
                    </Button>
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={16} className="mr-1" />
                        عميل جديد
                    </Button>
                </div>
            </div>

            {/* ── Table card ──────────────────────────────────────────────── */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input
                            className="!pr-10"
                            placeholder="بحث بالاسم أو الكود أو الهاتف..."
                            value={q}
                            onChange={e => setQ(e.target.value)}
                        />
                        {q && (
                            <button
                                onClick={() => setQ('')}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {selectedId && (
                        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full shrink-0">
                            محدد: {selectedCustomer?.name}
                        </span>
                    )}
                </CardHeader>

                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الكود</TableHead>
                                <TableHead>الاسم</TableHead>
                                <TableHead>الصنف</TableHead>
                                <TableHead>صافي الرصيد</TableHead>
                                <TableHead>الهاتف</TableHead>
                                <TableHead>سقف الائتمان</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center p-10">
                                        <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : customers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center p-10 text-muted-foreground">
                                        {q ? `لا يوجد عملاء مطابقون لـ "${q}"` : 'لا توجد بيانات.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                customers.map(c => {
                                    // balance > 0 → owes us | balance < 0 → we owe them
                                    const balance  = Number(c.balance || 0)
                                    const isCredit = balance < 0
                                    const isEven   = balance === 0

                                    return (
                                        <TableRow
                                            key={c._id}
                                            className={`cursor-pointer transition-colors ${selectedId === c._id ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'}`}
                                            onClick={() => setSelectedId(selectedId === c._id ? null : c._id)}
                                        >
                                            <TableCell className="font-mono text-xs text-muted-foreground">{c.code}</TableCell>

                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                        <Users size={14} />
                                                    </div>
                                                    <div>
                                                        <div>{c.name}</div>
                                                        {c.isSystem && <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock size={10} />نظام</span>}
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold border-transparent ${c.type === 'wholesale' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                                                        {c.type === 'wholesale' ? 'جملة' : 'قطاعي'}
                                                    </span>
                                                    {c.isCashCustomer && (
                                                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold border-amber-300 bg-amber-100 text-amber-700">
                                                            💵 نقدي
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Net balance column — balance and USD debt */}
                                            <TableCell>
                                                {isEven && (!c.balanceUSD || Math.abs(c.balanceUSD) < 0.01) ? (
                                                    <span className="text-xs text-muted-foreground">متصفي</span>
                                                ) : (c.balanceUSD && Math.abs(c.balanceUSD) > 0.01) ? (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1 text-red-600 font-bold text-sm font-mono">
                                                            <TrendingDown size={13} />
                                                            ${Number(c.balanceUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                        <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                                            ≈ {(Math.abs(c.balanceUSD) * (usdExchangeRate || 7.30)).toLocaleString('ar-LY')} د.ل
                                                        </span>
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">✓ مثبت بالدولار</span>
                                                    </div>
                                                ) : isCredit ? (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                                                            <TrendingUp size={13} />
                                                            {Math.abs(balance).toLocaleString('ar-LY')} د.ل
                                                        </div>
                                                        <span className="text-xs text-emerald-500">✓ باقي لك</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1 text-red-600 font-bold text-sm">
                                                            <TrendingDown size={13} />
                                                            {balance.toLocaleString('ar-LY')} د.ل
                                                        </div>
                                                        <span className="text-xs text-red-400">✗ باقي عليه</span>
                                                    </div>
                                                )}
                                            </TableCell>

                                            <TableCell>
                                                {c.phone ? (
                                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                        <Phone size={12} />
                                                        {c.phone}
                                                    </div>
                                                ) : <span className="text-muted-foreground text-xs">—</span>}
                                            </TableCell>

                                            <TableCell>
                                                {c.creditLimit > 0 ? (
                                                    <div className="flex items-center gap-1 text-emerald-600 font-medium text-sm">
                                                        <CreditCard size={13} />
                                                        {Number(c.creditLimit).toLocaleString('ar-LY')}
                                                    </div>
                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <CustomerModal
                show={showModal}
                onClose={handleCloseModal}
                editingItem={editingItem}
                onDelete={handleDelete}
            />
        </div>
    )
}
