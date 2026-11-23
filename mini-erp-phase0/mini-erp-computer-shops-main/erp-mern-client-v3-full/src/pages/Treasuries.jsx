import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
    Plus, Search, Trash2, Edit2, Wallet, Eye,
    Landmark, ArrowRightLeft, Building2, History,
    TrendingUp, TrendingDown, MoreVertical, Printer,
    ArrowDownLeft, ArrowUpRight
} from 'lucide-react'
import { formatCurrency } from '../lib/utils'
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
import VoucherPrintModal from '../components/modals/VoucherPrintModal'

export default function Treasuries() {
    const { push } = useToast()
    const [treasuries, setTreasuries] = useState([])
    const [loading, setLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    // Schema: name, type, balance, accountNumber
    const [form, setForm] = useState({ name: '', type: 'safe', balance: 0, accountNumber: '' })
    const [isEditing, setIsEditing] = useState(false)
    const [editId, setEditId] = useState(null)
    const [transactions, setTransactions] = useState([])
    const [loadingTransactions, setLoadingTransactions] = useState(false)
    const [allTransactions, setAllTransactions] = useState([])
    const [loadingAllTx, setLoadingAllTx] = useState(false)
    const [showDetailsModal, setShowDetailsModal] = useState(false)
    const [selectedTreasury, setSelectedTreasury] = useState(null)
    const [printVoucher, setPrintVoucher] = useState(null)

    const loadTreasuries = async () => {
        setLoading(true)
        try {
            // Correct Endpoint: /finance/treasuries
            const { data } = await api.get('/finance/treasuries')
            setTreasuries(data)
        } catch (err) {
            push('error', 'فشل تحميل الخزائن')
        } finally {
            setLoading(false)
        }
    }

    const loadAllTransactions = async () => {
        setLoadingAllTx(true)
        try {
            const { data } = await api.get('/finance/treasuries/transactions/all?limit=50')
            setAllTransactions(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoadingAllTx(false)
        }
    }

    useEffect(() => {
        loadTreasuries()
        loadAllTransactions()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (isEditing) {
                await api.put(`/finance/treasuries/${editId}`, form)
                push('success', 'تم تحديث الخزينة بنجاح')
            } else {
                await api.post('/finance/treasuries', form)
                push('success', 'تم إضافة الخزينة بنجاح')
            }
            setShowModal(false)
            setForm({ name: '', type: 'safe', balance: 0, accountNumber: '' })
            setIsEditing(false)
            setEditId(null)
            loadTreasuries()
        } catch (err) {
            push('error', err?.response?.data?.message || 'فشل حفظ البيانات')
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه الخزينة؟')) return
        try {
            await api.delete(`/finance/treasuries/${id}`)
            push('success', 'تم الحذف بنجاح')
            loadTreasuries()
        } catch (err) {
            push('error', 'لا يمكن حذف الخزينة (قد تكون مرتبطة بمعاملات)')
        }
    }

    const openEdit = (treasury) => {
        setForm({
            name: treasury.name,
            type: treasury.type || 'safe',
            balance: treasury.balance || 0,
            accountNumber: treasury.accountNumber || ''
        })
        setEditId(treasury._id)
        setIsEditing(true)
        setShowModal(true)
    }

    const loadTransactions = async (treasuryId, treasuryObj) => {
        setLoadingTransactions(true)
        try {
            const { data } = await api.get(`/finance/treasuries/${treasuryId}/transactions?limit=50`)
            if (Array.isArray(data) && data.length > 0) {
                setTransactions(data)
                return
            }
            // Fallback to journals if no Transaction records exist
            const { data: journals } = await api.get('/finance/journals')
            const targetName = treasuryObj?.name || selectedTreasury?.name
            const filtered = (journals || []).filter(entry =>
                entry.lines?.some(line => line.account === treasuryId || line.account === targetName)
            ).slice(0, 20)
            setTransactions(filtered)
        } catch (err) {
            console.error(err)
            setTransactions([])
        } finally {
            setLoadingTransactions(false)
        }
    }

    const openDetails = async (treasury) => {
        setSelectedTreasury(treasury)
        setShowDetailsModal(true)
        await loadTransactions(treasury._id, treasury)
    }

    const buildVoucherFromTx = (entry, fallbackTreasury) => {
        const tre = entry.treasury || fallbackTreasury
        // Check if it's a Transaction record (type: 'income' | 'expense') or a JournalEntry
        if (entry.type === 'income' || entry.type === 'expense') {
            const isReceipt = entry.type === 'income'
            // Extract party name from description if formatted like "تحصيل من العميل: ..." or "دفعة للمورد: ..."
            let partyName = entry.partyName || entry.beneficiary || ''
            const desc = entry.description || ''
            if (!partyName && desc.includes(':')) {
                const afterColon = desc.split(':')[1]?.split('-')[0]?.split('(')[0]?.trim()
                if (afterColon) partyName = afterColon
            }
            return {
                _id: entry._id,
                number: entry.reference || `#${String(entry._id).slice(-6).toUpperCase()}`,
                voucherType: isReceipt ? 'receipt' : 'payment',
                type: entry.type,
                amount: Number(entry.amount || 0),
                partyName: partyName || (isReceipt ? 'عميل / جهة إيداع' : 'مستفيد / جهة صرف'),
                treasury: tre,
                treasuryName: tre?.name || '-',
                method: (tre?.type === 'bank' || tre?.type === 'Bank') ? 'bank' : 'cash',
                description: desc || (isReceipt ? 'سند قبض خزينة' : 'سند صرف خزينة'),
                date: entry.date || entry.createdAt
            }
        }

        // Journal entry fallback
        const line = entry.lines?.find(l => l.account === fallbackTreasury?.name || l.account === fallbackTreasury?._id) || entry.lines?.[0]
        const isReceipt = Number(line?.debit || 0) > 0
        const amount = isReceipt ? Number(line?.debit || 0) : Number(line?.credit || 0)
        return {
            _id: entry._id,
            number: entry.ref || `#${String(entry._id).slice(-6).toUpperCase()}`,
            voucherType: isReceipt ? 'receipt' : 'payment',
            amount,
            partyName: isReceipt ? 'جهة الإيداع' : 'جهة الصرف',
            treasury: tre,
            treasuryName: tre?.name || '-',
            method: (tre?.type === 'bank' || tre?.type === 'Bank') ? 'bank' : 'cash',
            description: entry.description || '-',
            date: entry.date || entry.createdAt
        }
    }

    const filteredTreasuries = treasuries.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Calculations
    const totalLiquidity = treasuries.reduce((sum, t) => sum + (t.balance || 0), 0)
    const safeLiquidity = treasuries
        .filter(t => t.type === 'safe')
        .reduce((sum, t) => sum + (t.balance || 0), 0)
    const bankLiquidity = treasuries
        .filter(t => t.type === 'bank')
        .reduce((sum, t) => sum + (t.balance || 0), 0)

    return (
        <div className="space-y-8 animate-in fade-in p-6 max-w-7xl mx-auto font-sans">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">الخزائن والحسابات</h1>
                    <p className="text-slate-500 mt-1">لوحة التحكم المالية وإدارة السيولة</p>
                </div>
                <button
                    onClick={() => {
                        setForm({ name: '', type: 'safe', balance: 0, accountNumber: '' })
                        setIsEditing(false)
                        setShowModal(true)
                    }}
                    className="btn bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:scale-[1.02]"
                >
                    <Plus size={20} />
                    <span className="font-bold">إضافة حساب جديد</span>
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Liquidity */}
                <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 p-6 text-white shadow-xl">
                    <div className="absolute top-0 left-0 p-4 opacity-10">
                        <Building2 size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm">
                                <TrendingUp size={24} className="text-emerald-400" />
                            </div>
                            <span className="font-medium text-slate-300">إجمالي السيولة</span>
                        </div>
                        <div className="text-3xl font-black tracking-tight">
                            {formatCurrency(totalLiquidity)}
                        </div>
                    </div>
                </div>

                {/* Cash on Hand */}
                <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2">
                            <Wallet size={24} className="text-emerald-600" />
                        </div>
                        <span className="font-bold text-slate-600">الخزائن النقدية</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 tracking-tight">
                        {formatCurrency(safeLiquidity)}
                    </div>
                </div>

                {/* Bank Accounts */}
                <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2">
                            <Landmark size={24} className="text-blue-600" />
                        </div>
                        <span className="font-bold text-slate-600">الحسابات البنكية</span>
                    </div>
                    <div className="text-3xl font-black text-slate-900 tracking-tight">
                        {formatCurrency(bankLiquidity)}
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="بحث عن خزينة..."
                    className="w-full rounded-xl border-slate-200 py-3 pr-12 pl-4 text-sm font-bold shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse"></div>
                    ))
                ) : filteredTreasuries.length === 0 ? (
                    <div className="col-span-full py-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                            <Building2 size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">لا توجد خزائن</h3>
                        <p className="text-slate-500">قم بإضافة خزينة أو حساب بنكي للبدء.</p>
                    </div>
                ) : (
                    filteredTreasuries.map(treasury => {
                        const isBank = treasury.type === 'bank' || treasury.type === 'Bank';
                        const balance = treasury.balance || 0;

                        return (
                            <div key={treasury._id} className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                <div className={`absolute top-0 right-0 h-1 w-full ${isBank ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className={`rounded-xl p-3 ${isBank ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {isBank ? <Landmark size={24} /> : <Wallet size={24} />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800">{treasury.name}</h3>
                                                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                                                    {isBank && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">BANK</span>}
                                                </div>
                                                {isBank && treasury.accountNumber && (
                                                    <div className="text-[10px] text-slate-400 font-mono mt-1 w-full truncate">
                                                        {treasury.accountNumber}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="dropdown dropdown-end">
                                            <button className="btn btn-ghost btn-circle btn-sm text-slate-400">
                                                <MoreVertical size={18} />
                                            </button>
                                            <ul tabIndex={0} className="dropdown-content menu p-2 shadow-lg bg-white rounded-xl w-40 border border-slate-100 z-10">
                                                <li><button onClick={() => openEdit(treasury)} className="text-xs font-bold"><Edit2 size={14} /> تعديل</button></li>
                                                <li><button onClick={() => handleDelete(treasury._id)} className="text-xs font-bold text-red-600"><Trash2 size={14} /> حذف</button></li>
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <div className="text-xs font-bold text-slate-400 mb-1">الرصيد الحالي</div>
                                        <div className={`text-3xl font-black tracking-tight ${balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                                            {formatCurrency(balance)}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openDetails(treasury)}
                                            className="btn btn-sm w-full bg-slate-50 hover:bg-slate-100 border-0 text-slate-600 font-bold"
                                        >
                                            <History size={16} className="mr-1" />
                                            السجل وطباعة السندات
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Recent Financial Operations Log across all Treasuries */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                            <History size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">سجل الخزينة والعمليات المالية الأخيرة</h2>
                            <p className="text-xs text-slate-500">حركات القبض والصرف المسجلة على الخزائن والحسابات مع إمكانية طباعة السند</p>
                        </div>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                        {allTransactions.length} عملية
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b text-slate-600">
                            <tr>
                                <th className="p-3.5 text-right font-bold">التاريخ</th>
                                <th className="p-3.5 text-right font-bold">المرجع</th>
                                <th className="p-3.5 text-right font-bold">نوع السند</th>
                                <th className="p-3.5 text-right font-bold">الخزينة</th>
                                <th className="p-3.5 text-right font-bold">البيان</th>
                                <th className="p-3.5 text-right font-bold">المبلغ</th>
                                <th className="p-3.5 text-center font-bold">طباعة السند</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loadingAllTx ? (
                                <tr><td colSpan="7" className="p-8 text-center text-slate-500">جاري تحميل العمليات المالية...</td></tr>
                            ) : allTransactions.length === 0 ? (
                                <tr><td colSpan="7" className="p-8 text-center text-slate-500">لا توجد عمليات مالية مسجلة بعد</td></tr>
                            ) : (
                                allTransactions.map((tx, idx) => {
                                    const isIncome = tx.type === 'income'
                                    return (
                                        <tr key={tx._id || idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3.5 text-xs text-slate-600 whitespace-nowrap">
                                                {new Date(tx.date || tx.createdAt).toLocaleDateString('ar-LY')}
                                            </td>
                                            <td className="p-3.5 font-mono text-xs font-bold text-slate-700">
                                                {tx.reference || `#${String(tx._id).slice(-6).toUpperCase()}`}
                                            </td>
                                            <td className="p-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                    isIncome ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                                }`}>
                                                    {isIncome ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                                                    {isIncome ? 'سند قبض' : 'سند صرف'}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-xs font-bold text-slate-700">
                                                {tx.treasury?.name || '-'}
                                            </td>
                                            <td className="p-3.5 text-xs text-slate-600 max-w-[260px] truncate" title={tx.description}>
                                                {tx.description || '-'}
                                            </td>
                                            <td className={`p-3.5 font-bold ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {formatCurrency(tx.amount || 0)}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-3 text-xs gap-1.5 border-slate-300 hover:bg-slate-100"
                                                    onClick={() => setPrintVoucher(buildVoucherFromTx(tx, tx.treasury))}
                                                >
                                                    <Printer size={13} />
                                                    طباعة السند
                                                </Button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Account Dialog */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-md" onClose={() => setShowModal(false)}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${form.type === 'bank' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}`}>
                                {form.type === 'bank' ? <Landmark size={20} /> : <Wallet size={20} />}
                            </div>
                            {isEditing ? 'تعديل الحساب' : 'إضافة حساب جديد'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit}>
                        <DialogBody className="space-y-5">
                            {/* Account Type Toggle */}
                            <div className="space-y-2">
                                <Label>نوع الحساب</Label>
                                <div className="flex p-1 bg-slate-100 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, type: 'safe' })}
                                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${form.type === 'safe' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Wallet size={16} />
                                        خزينة نقدية
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, type: 'bank' })}
                                        className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${form.type === 'bank' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Landmark size={16} />
                                        حساب بنكي
                                    </button>
                                </div>
                            </div>

                            {/* Account Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">
                                    اسم الحساب <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    required
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder={form.type === 'bank' ? 'مصرف الجمهورية - فرع طرابلس' : 'الخزينة الرئيسية'}
                                />
                            </div>

                            {/* Bank Account Number (conditional) */}
                            {form.type === 'bank' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <Label htmlFor="accountNumber">رقم الحساب البنكي</Label>
                                    <Input
                                        id="accountNumber"
                                        className="font-mono"
                                        value={form.accountNumber}
                                        onChange={e => setForm({ ...form, accountNumber: e.target.value })}
                                        placeholder="LY..."
                                    />
                                </div>
                            )}

                            {/* Opening Balance */}
                            <div className="space-y-2">
                                <Label htmlFor="balance">الرصيد الافتتاحي</Label>
                                <Input
                                    id="balance"
                                    type="number"
                                    min="0"
                                    className="font-mono"
                                    value={form.balance}
                                    onChange={e => setForm({ ...form, balance: Number(e.target.value) })}
                                />
                            </div>
                        </DialogBody>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>
                                إلغاء
                            </Button>
                            <Button type="submit">
                                {isEditing ? 'حفظ التغييرات' : 'إنشاء الحساب'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Details Modal */}
            {showDetailsModal && selectedTreasury && (
                <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
                    <div className="modal-content max-w-4xl rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-slate-900 text-white p-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-2 opacity-80">
                                        {selectedTreasury.type === 'bank' ? <Landmark size={18} /> : <Wallet size={18} />}
                                        <h3 className="text-2xl font-bold inline-block ml-2">{selectedTreasury.name}</h3>
                                    </div>
                                    {selectedTreasury.accountNumber && (
                                        <div className="text-indigo-200 font-mono text-sm mt-1">{selectedTreasury.accountNumber}</div>
                                    )}
                                </div>
                                <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <span className="text-2xl">×</span>
                                </button>
                            </div>
                            <div className="mt-6 flex gap-8">
                                <div>
                                    <div className="text-xs text-slate-400 mb-1">الرصيد الحالي</div>
                                    <div className="text-3xl font-bold">{formatCurrency(selectedTreasury.balance)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <History size={18} />
                                سجل المعاملات الأخيرة
                            </h4>

                            <div className="border rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b sticky top-0">
                                        <tr>
                                            <th className="p-3 text-right font-bold text-slate-600">التاريخ</th>
                                            <th className="p-3 text-right font-bold text-slate-600">المرجع</th>
                                            <th className="p-3 text-right font-bold text-slate-600">البيان</th>
                                            <th className="p-3 text-right font-bold text-slate-600">وارد (قبض)</th>
                                            <th className="p-3 text-right font-bold text-slate-600">صادر (صرف)</th>
                                            <th className="p-3 text-center font-bold text-slate-600">طباعة السند</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {loadingTransactions ? (
                                            <tr><td colSpan="6" className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
                                        ) : transactions.length === 0 ? (
                                            <tr><td colSpan="6" className="p-8 text-center text-slate-500">لا توجد حركات مسجلة</td></tr>
                                        ) : (
                                            transactions.map((entry, idx) => {
                                                const isTxModel = entry.type === 'income' || entry.type === 'expense'
                                                const line = !isTxModel
                                                    ? entry.lines?.find(l => l.account === selectedTreasury.name || l.account === selectedTreasury._id)
                                                    : null
                                                const debitAmount = isTxModel
                                                    ? (entry.type === 'income' ? entry.amount : 0)
                                                    : (line?.debit || 0)
                                                const creditAmount = isTxModel
                                                    ? (entry.type === 'expense' ? entry.amount : 0)
                                                    : (line?.credit || 0)

                                                return (
                                                    <tr key={entry._id || idx} className="hover:bg-slate-50">
                                                        <td className="p-3 font-medium text-slate-700">
                                                            {new Date(entry.date || entry.createdAt).toLocaleDateString('ar-LY')}
                                                        </td>
                                                        <td className="p-3 font-mono text-xs text-blue-600">
                                                            {entry.reference || entry.ref || entry._id?.slice(-6).toUpperCase()}
                                                        </td>
                                                        <td className="p-3 text-slate-600">{entry.description || '-'}</td>
                                                        <td className="p-3 font-bold text-emerald-600">
                                                            {debitAmount ? formatCurrency(debitAmount) : '-'}
                                                        </td>
                                                        <td className="p-3 font-bold text-red-600">
                                                            {creditAmount ? formatCurrency(creditAmount) : '-'}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 px-2.5 text-xs gap-1"
                                                                onClick={() => setPrintVoucher(buildVoucherFromTx(entry, selectedTreasury))}
                                                            >
                                                                <Printer size={12} />
                                                                طباعة السند
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-slate-50 flex justify-end">
                            <button onClick={() => setShowDetailsModal(false)} className="btn bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50">
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unified Voucher Print Modal */}
            <VoucherPrintModal
                isOpen={!!printVoucher}
                voucher={printVoucher}
                voucherType={printVoucher?.voucherType}
                onClose={() => setPrintVoucher(null)}
            />
        </div>
    )
}
