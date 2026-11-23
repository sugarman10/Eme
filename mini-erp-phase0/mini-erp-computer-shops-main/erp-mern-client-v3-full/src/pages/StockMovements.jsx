import { useEffect, useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
    ArrowRightLeft,
    ArrowUpCircle,
    ArrowDownCircle,
    Plus,
    Search,
    Filter,
    Calendar,
    FileText,
    Trash2,
    X
} from 'lucide-react'

export default function StockMovements() {
    const { push } = useToast()
    const queryClient = useQueryClient()

    // Data
    const [movements, setMovements] = useState([])
    const [items, setItems] = useState([])
    const [warehouses, setWarehouses] = useState([])
    const [loading, setLoading] = useState(false)

    // UI
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('list') // 'list' | 'new'

    // Filters
    const [filterType, setFilterType] = useState('')
    const [filterWarehouse, setFilterWarehouse] = useState('')
    const [search, setSearch] = useState('')

    // Form
    const [form, setForm] = useState({
        type: 'adjustment_in', // adjustment_in, adjustment_out, transfer
        date: new Date().toISOString().split('T')[0],
        warehouseSource: '',
        warehouseDest: '',
        note: '',
        items: [{ item: '', qty: 1, note: '' }]
    })

    const loadData = async () => {
        setLoading(true)
        try {
            const [movRes, itemsRes, whRes] = await Promise.all([
                api.get('/inventory/movements?limit=5000').catch(() => ({ data: [] })), // Handle if endpoint doesn't exist yet
                api.get('/inventory/items'),
                api.get('/inventory/warehouses')
            ])

            // Handle paginated response structure { movements: [], total: ... }
            const movementsData = movRes.data?.movements || (Array.isArray(movRes.data) ? movRes.data : [])
            setMovements(movementsData)
            setItems(Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data?.items || []))
            setWarehouses(whRes.data || [])
        } catch (err) {
            console.error('Failed to load inventory data', err)
            // Don't show error for movements if it's 404 (endpoint might not exist)
            if (err?.response?.status !== 404) {
                push('error', 'فشل تحميل بيانات المخزون')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [])

    // Form Handlers
    const addRow = () => {
        setForm(prev => ({
            ...prev,
            items: [...prev.items, { item: '', qty: 1, note: '' }]
        }))
    }

    const removeRow = (index) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }))
    }

    const updateRow = (index, field, value) => {
        setForm(prev => ({
            ...prev,
            items: prev.items.map((row, i) => i === index ? { ...row, [field]: value } : row)
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (form.type === 'transfer' && (!form.warehouseSource || !form.warehouseDest)) {
            return push('error', 'الرجاء اختيار المستودع المصدر والوجهة')
        }
        if (form.type !== 'transfer' && !form.warehouseSource) {
            return push('error', 'الرجاء اختيار المستودع')
        }
        if (form.items.some(r => !r.item || r.qty <= 0)) {
            return push('error', 'الرجاء استكمال بيانات الأصناف')
        }

        setSaving(true)
        try {
            const promises = form.items.map(row => {
                if (form.type === 'transfer') {
                    return api.post('/inventory/stock/transfer', {
                        item: row.item,
                        fromWarehouse: form.warehouseSource,
                        toWarehouse: form.warehouseDest,
                        qty: Number(row.qty),
                        note: row.note || form.note,
                        ref: `TRANS-${Date.now()}`
                    })
                } else {
                    return api.post('/inventory/movements', {
                        item: row.item,
                        warehouse: form.warehouseSource,
                        qty: Number(row.qty),
                        type: form.type === 'adjustment_in' ? 'IN' : 'OUT',
                        note: row.note || form.note,
                        ref: `ADJ-${Date.now()}`
                    })
                }
            })

            await Promise.all(promises)

            // Invalidate queries to refresh Items page and Dashboard
            queryClient.invalidateQueries({ queryKey: ['items'] })
            queryClient.invalidateQueries({ queryKey: ['stock-balances'] })

            push('success', 'تم حفظ الحركات المخزنية بنجاح')
            setForm({
                type: 'adjustment_in',
                date: new Date().toISOString().split('T')[0],
                warehouseSource: '',
                warehouseDest: '',
                note: '',
                items: [{ item: '', qty: 1, note: '' }]
            })
            setActiveTab('list')
            loadData()
        } catch (err) {
            console.error(err)
            push('error', err?.response?.data?.message || 'فشل حفظ بعض الحركات')
        } finally {
            setSaving(false)
        }
    }

    // Filter Logic
    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            const matchType = filterType ? m.type === filterType : true
            const matchWh = filterWarehouse ? (m.warehouse?._id === filterWarehouse || m.warehouseSource?._id === filterWarehouse || m.warehouseDest?._id === filterWarehouse) : true
            const matchSearch = search ? (
                m._id.includes(search) ||
                (m.note || '').toLowerCase().includes(search.toLowerCase()) ||
                (m.item?.name || '').toLowerCase().includes(search.toLowerCase())
            ) : true
            return matchType && matchWh && matchSearch
        }).sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
    }, [movements, filterType, filterWarehouse, search])

    const getTypeLabel = (type) => {
        switch (type) {
            case 'ADJ_IN':
            case 'IN':
                return <span className="badge badge-success flex items-center gap-1"><ArrowUpCircle size={12} /> إدخال</span>
            case 'ADJ_OUT':
            case 'OUT':
                return <span className="badge badge-error flex items-center gap-1"><ArrowDownCircle size={12} /> إخراج</span>
            case 'MOVE':
            case 'transfer':
                return <span className="badge badge-info flex items-center gap-1"><ArrowRightLeft size={12} /> تحويل</span>
            case 'SALE':
                return <span className="badge badge-secondary flex items-center gap-1"><ArrowDownCircle size={12} /> مبيعات</span>
            case 'PURCHASE':
                return <span className="badge badge-primary flex items-center gap-1"><ArrowUpCircle size={12} /> مشتريات</span>
            default: return <span className="badge badge-secondary">{type}</span>
        }
    }


    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-100px)]">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="h2">حركات المخزون</h1>
                    <p className="muted">إدارة التوريد والصرف والتحويل بين المستودعات</p>
                </div>
                <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'list' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('list')}
                    >
                        سجل الحركات
                    </button>
                    <button
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'new' ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('new')}
                    >
                        <Plus size={16} className="inline-block ml-1" />
                        حركة جديدة
                    </button>
                </div>
            </div>

            {activeTab === 'list' ? (
                <div className="card flex-1 flex flex-col min-h-0 shadow-md border-0">
                    <div className="card-header p-3 border-b space-y-3">
                        <div className="flex gap-2">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    className="input pr-14! py-1.5 text-sm"
                                    placeholder="بحث برقم الحركة، ملاحظات، أو اسم صنف..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <select
                                className="select py-1.5 text-sm w-32"
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                            >
                                <option value="">كل الأنواع</option>
                                <option value="ADJ_IN">إدخال</option>
                                <option value="ADJ_OUT">إخراج</option>
                                <option value="MOVE">تحويل</option>
                                <option value="SALE">مبيعات</option>
                            </select>
                            <select
                                className="select py-1.5 text-sm w-40"
                                value={filterWarehouse}
                                onChange={e => setFilterWarehouse(e.target.value)}
                            >
                                <option value="">كل المستودعات</option>
                                {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="table w-full">
                            <thead className="sticky top-0 bg-gray-50 z-10">
                                <tr>
                                    <th>رقم الحركة</th>
                                    <th>النوع</th>
                                    <th>التاريخ</th>
                                    <th>المستودع</th>
                                    <th>الصنف</th>
                                    <th>الكمية</th>
                                    <th>ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" className="text-center p-8 text-gray-500">جاري التحميل...</td></tr>
                                ) : filteredMovements.length === 0 ? (
                                    <tr><td colSpan="7" className="text-center p-8 text-gray-500">لا توجد حركات مخزنية.</td></tr>
                                ) : (
                                    filteredMovements.map(mov => (
                                        <tr key={mov._id} className="hover:bg-gray-50">
                                            <td className="font-mono text-xs font-bold text-gray-400">#{mov._id.slice(-6)}</td>
                                            <td>{getTypeLabel(mov.type)}</td>
                                            <td className="text-sm text-gray-500">
                                                {new Date(mov.createdAt).toLocaleDateString('ar-LY')}
                                                <span className="block text-xs text-slate-400">{new Date(mov.createdAt).toLocaleTimeString('ar-LY')}</span>
                                            </td>
                                            <td className="text-sm font-medium">
                                                {mov.warehouse?.name || 'غير محدد'}
                                            </td>
                                            <td className="text-sm">
                                                <span className="font-bold text-slate-700">{mov.item?.name}</span>
                                                <span className="text-xs text-slate-400 block font-mono">{mov.item?.sku}</span>
                                            </td>
                                            <td>
                                                <span className={`font-bold font-mono ${mov.qty > 0 ? 'text-green-600' : 'text-red-500'}`} dir="ltr">
                                                    {mov.qty > 0 ? '+' : ''}{mov.qty}
                                                </span>
                                            </td>
                                            <td className="text-sm text-gray-500 truncate max-w-xs">{mov.note || '-'}</td>
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">نوع الحركة</label>
                                    <select
                                        className="select"
                                        value={form.type}
                                        onChange={e => setForm({ ...form, type: e.target.value })}
                                    >
                                        <option value="adjustment_in">إدخال مخزني (Adjustment In)</option>
                                        <option value="adjustment_out">إخراج مخزني (Adjustment Out)</option>
                                        <option value="transfer">تحويل بين مستودعات (Transfer)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">التاريخ</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">ملاحظات عامة</label>
                                    <input
                                        className="input"
                                        value={form.note}
                                        onChange={e => setForm({ ...form, note: e.target.value })}
                                        placeholder="سبب الحركة..."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">
                                        {form.type === 'transfer' ? 'من مستودع' : 'المستودع'}
                                    </label>
                                    <select
                                        required
                                        className="select"
                                        value={form.warehouseSource}
                                        onChange={e => setForm({ ...form, warehouseSource: e.target.value })}
                                    >
                                        <option value="">اختر المستودع...</option>
                                        {warehouses.map(w => (
                                            <option key={w._id} value={w._id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {form.type === 'transfer' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold">إلى مستودع</label>
                                        <select
                                            required
                                            className="select"
                                            value={form.warehouseDest}
                                            onChange={e => setForm({ ...form, warehouseDest: e.target.value })}
                                        >
                                            <option value="">اختر المستودع...</option>
                                            {warehouses.filter(w => w._id !== form.warehouseSource).map(w => (
                                                <option key={w._id} value={w._id}>{w.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold">الأصناف</label>
                                    <button type="button" onClick={addRow} className="btn btn-sm btn-secondary">
                                        <Plus size={14} /> إضافة صنف
                                    </button>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                    <table className="table w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="w-1/2">الصنف</th>
                                                <th className="w-32">الكمية</th>
                                                <th>ملاحظة للصنف</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.map((row, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <select
                                                            required
                                                            className="input py-1 text-sm"
                                                            value={row.item}
                                                            onChange={e => updateRow(idx, 'item', e.target.value)}
                                                        >
                                                            <option value="">اختر صنف...</option>
                                                            {items.map(it => (
                                                                <option key={it._id} value={it._id}>{it.sku} - {it.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="input py-1 text-center"
                                                            value={row.qty}
                                                            onChange={e => updateRow(idx, 'qty', Number(e.target.value))}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            className="input py-1"
                                                            value={row.note}
                                                            onChange={e => updateRow(idx, 'note', e.target.value)}
                                                            placeholder="..."
                                                        />
                                                    </td>
                                                    <td>
                                                        {form.items.length > 1 && (
                                                            <button type="button" onClick={() => removeRow(idx)} className="text-red-500 hover:text-red-700">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="card-footer p-4 border-t bg-gray-50 flex justify-end gap-2">
                            <button type="button" onClick={() => setActiveTab('list')} className="btn btn-ghost" disabled={saving}>إلغاء</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'جاري الحفظ...' : 'حفظ الحركة'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div >
    )
}
