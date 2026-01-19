import React, { useEffect, useState, useMemo } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
  Plus,
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  FileText,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Bot,
  User,
  AlertTriangle
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

// Manual Entry Modal Component
const ManualEntryModal = ({ onClose, onSuccess }) => {
  const { push } = useToast()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    ref: '',
    note: '',
    lines: [
      { account: '', debit: 0, credit: 0, note: '' },
      { account: '', debit: 0, credit: 0, note: '' }
    ]
  })

  useEffect(() => {
    api.get('/finance/accounts').then(res => setAccounts(res.data || []))
  }, [])

  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines]
    newLines[index][field] = value
    setFormData({ ...formData, lines: newLines })
  }

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { account: '', debit: 0, credit: 0, note: '' }]
    })
  }

  const removeLine = (index) => {
    if (formData.lines.length <= 2) return
    setFormData({ ...formData, lines: formData.lines.filter((_, i) => i !== index) })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const totalDebit = formData.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0)
    const totalCredit = formData.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return push('error', `القيد غير متوازن! الفرق: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`)
    }

    if (formData.lines.some(l => !l.account)) {
      return push('error', 'يجب اختيار حساب لكل سطر')
    }

    try {
      setLoading(true)
      await api.post('/finance/journals', formData)
      push('success', 'تم إنشاء القيد اليدوي بنجاح')
      onSuccess()
    } catch (err) {
      push('error', err?.response?.data?.message || 'فشل الحفظ')
    } finally {
      setLoading(false)
    }
  }

  const totalDebit = formData.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0)
  const totalCredit = formData.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <Card className="w-full max-w-4xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Plus size={18} /> قيد يدوي جديد
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">التاريخ</label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">رقم المرجع (اختياري)</label>
                <Input value={formData.ref} onChange={e => setFormData({ ...formData, ref: e.target.value })} placeholder="REF-001" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">البيان</label>
                <Input value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder="شرح القيد..." />
              </div>
            </div>

            {/* Lines Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3 text-right">الحساب</th>
                    <th className="p-3 text-center w-32">مدين</th>
                    <th className="p-3 text-center w-32">دائن</th>
                    <th className="p-3 text-right">ملاحظة</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2">
                        <select
                          className="w-full p-2 border rounded focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                          value={line.account}
                          onChange={e => updateLine(idx, 'account', e.target.value)}
                          required
                        >
                          <option value="">-- اختر الحساب --</option>
                          {accounts.map(acc => (
                            <option key={acc._id} value={acc._id}>{acc.code} - {acc.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number" step="0.01" min="0"
                          className="text-center font-mono"
                          value={line.debit}
                          onChange={e => updateLine(idx, 'debit', e.target.value)}
                          onFocus={e => e.target.select()}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number" step="0.01" min="0"
                          className="text-center font-mono"
                          value={line.credit}
                          onChange={e => updateLine(idx, 'credit', e.target.value)}
                          onFocus={e => e.target.select()}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={line.note}
                          onChange={e => updateLine(idx, 'note', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        {formData.lines.length > 2 && (
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-800">
                  <tr>
                    <td className="p-3 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus size={14} className="ml-1" /> إضافة سطر</Button>
                    </td>
                    <td className="p-3 text-center text-emerald-600 font-mono">{totalDebit.toFixed(2)}</td>
                    <td className="p-3 text-center text-red-600 font-mono">{totalCredit.toFixed(2)}</td>
                    <td colSpan={2} className="p-3 text-center text-xs">
                      {Math.abs(totalDebit - totalCredit) < 0.01 ?
                        <span className="text-emerald-600 flex items-center justify-center gap-1">✅ متوازن</span> :
                        <span className="text-red-600 flex items-center justify-center gap-1">❌ فرق: {Math.abs(totalDebit - totalCredit).toFixed(2)}</span>
                      }
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={loading || Math.abs(totalDebit - totalCredit) > 0.01}>
              {loading ? 'جاري الحفظ...' : 'حفظ القيد'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// MAIN PAGE COMPONENT
export default function Journals() {
  const { push } = useToast()
  const [journals, setJournals] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Filters
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [filterType, setFilterType] = useState('all') // all, sales, purchase, manual
  const [selectedAccount, setSelectedAccount] = useState('all') // Filter by Account
  const [expandedRow, setExpandedRow] = useState(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const params = { limit: 5000 }
      if (dateRange.from) params.from = dateRange.from
      if (dateRange.to) params.to = dateRange.to

      const [jRes, accRes] = await Promise.all([
        api.get('/finance/journals', { params }),
        api.get('/finance/accounts')
      ])

      setJournals(jRes.data || [])
      setAccounts(accRes.data || [])

    } catch (err) {
      console.error(err)
      push('error', 'فشل تحميل القيود')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [dateRange])

  // Process & Filter Data Client-Side
  const processedData = useMemo(() => {
    let data = [...journals]

    // 1. Filter Type (Inferred from Ref)
    if (filterType !== 'all') {
      data = data.filter(item => {
        const ref = (item.ref || '').toUpperCase()
        if (filterType === 'sales') return ref.includes('INV') || ref.includes('RCPT')
        if (filterType === 'purchase') return ref.includes('PO') || ref.includes('PAY')
        if (filterType === 'manual') return !ref.includes('INV') && !ref.includes('PO') && !ref.includes('RCPT') && !ref.includes('PAY')
        return true
      })
    }

    // 2. Filter Account
    if (selectedAccount !== 'all') {
      data = data.filter(item =>
        item.lines.some(line => {
          // Handle populated vs manual structure just in case
          const accId = typeof line.account === 'object' ? line.account._id : line.account
          return accId === selectedAccount
        })
      )
    }

    return data
  }, [journals, filterType, selectedAccount])

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id)
  }

  const getTypeBadge = (ref) => {
    const r = (ref || '').toUpperCase()
    if (r.includes('INV')) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200"><Bot size={12} /> مبيعات آلي</span>
    if (r.includes('PO')) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200"><Bot size={12} /> مشتريات آلي</span>
    if (r.includes('RCPT')) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200"><Bot size={12} /> سند قبض</span>
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200"><User size={12} /> قيد يدوي</span>
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD' }).format(amount)
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 flex flex-col gap-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">دفتر اليومية العامة</h1>
          <p className="text-sm text-slate-500">سجل القيود المحاسبية (General Ledger Viewer)</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowModal(true)} className="gap-2 shadow-lg shadow-primary/20">
            <Plus size={18} /> قيد يدوي جديد
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 flex flex-col xl:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          {/* Source Filter */}
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white border px-3 py-2 rounded-md w-full md:w-auto">
            <Filter size={16} className="text-slate-400" />
            <span className="whitespace-nowrap">المصدر:</span>
            <select
              className="bg-transparent font-bold outline-none text-slate-900 w-full"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">الكل</option>
              <option value="sales">مبيعات (Sales)</option>
              <option value="purchase">مشترياتAnd Suppliers</option>
              <option value="manual">قيود يدوية (Manual)</option>
            </select>
          </div>

          {/* Account Filter */}
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white border px-3 py-2 rounded-md w-full md:w-auto min-w-[200px]">
            <Search size={16} className="text-slate-400" />
            <span className="whitespace-nowrap">الحساب:</span>
            <select
              className="bg-transparent font-bold outline-none text-slate-900 w-full"
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
            >
              <option value="all">كل الحسابات</option>
              {accounts.map(acc => (
                <option key={acc._id} value={acc._id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 w-full xl:w-auto bg-white border p-1 rounded-md">
          <Input
            type="date"
            className="w-full md:w-36 border-0 focus-visible:ring-0"
            value={dateRange.from}
            onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
          />
          <span className="text-slate-400">→</span>
          <Input
            type="date"
            className="w-full md:w-36 border-0 focus-visible:ring-0"
            value={dateRange.to}
            onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
          />
        </div>
      </Card>

      {/* Main Table */}
      <Card className="flex-1 border shadow-sm bg-white overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-4 w-12">#</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">المرجع</th>
                <th className="p-4">البيان</th>
                <th className="p-4 text-center">المستخدم</th>
                <th className="p-4 text-center">المصدر</th>
                <th className="p-4 text-left">إجمالي مدين</th>
                <th className="p-4 text-left">إجمالي دائن</th>
                <th className="p-4 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="p-12 text-center text-slate-400">جاري التحميل...</td></tr>
              ) : processedData.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center text-slate-400">لا توجد قيود مطابقة للفلاتر.</td></tr>
              ) : (
                processedData.map(journal => {
                  const totalDebit = journal.lines.reduce((s, l) => s + (l.debit || 0), 0)
                  const totalCredit = journal.lines.reduce((s, l) => s + (l.credit || 0), 0)
                  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01
                  const isExpanded = expandedRow === journal._id

                  return (
                    <React.Fragment key={journal._id}>
                      {/* Main Row */}
                      <tr
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                        onClick={() => toggleRow(journal._id)}
                      >
                        <td className="p-4 text-center text-slate-400">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} className="rtl:rotate-180" />}
                        </td>
                        <td className="p-4 font-mono text-slate-700">
                          {new Date(journal.date).toLocaleDateString('en-GB')}
                          <div className="text-[10px] text-slate-400">{new Date(journal.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="p-4 font-bold text-slate-800">{journal.ref || '-'}</td>
                        <td className="p-4 text-slate-600 max-w-xs truncate">{journal.note}</td>
                        <td className="p-4 text-center">
                          {journal.user ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                              <User size={10} /> {journal.user.name || 'مستخدم'}
                            </span>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-4 text-center">{getTypeBadge(journal.ref)}</td>
                        <td className="p-4 text-left font-mono font-bold text-slate-700">{formatCurrency(totalDebit)}</td>
                        <td className="p-4 text-left font-mono font-bold text-slate-700">{formatCurrency(totalCredit)}</td>
                        <td className="p-4 text-center">
                          {isBalanced
                            ? <span className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded text-xs font-bold">متزن</span>
                            : <span className="text-red-500 bg-red-50 px-2 py-1 rounded text-xs font-bold animate-pulse inline-flex items-center gap-1"><AlertTriangle size={12} /> خطأ</span>
                          }
                        </td>
                      </tr>

                      {/* Detailed Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50 border-b border-slate-200">
                          <td colSpan={9} className="p-0">
                            <div className="p-4 pr-12 animate-in slide-in-from-top-2 duration-200">
                              <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100 text-slate-500">
                                    <tr>
                                      <th className="p-2 w-1/3 text-right">الحساب</th>
                                      <th className="p-2 text-right">شرح السطر</th>
                                      <th className="p-2 text-left w-32">مدين</th>
                                      <th className="p-2 text-left w-32">دائن</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {journal.lines.map((line, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="p-2 flex items-center gap-2">
                                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                            {line.account?.code || '???'}
                                          </span>
                                          <span className="font-medium text-slate-800">
                                            {line.account?.name || 'Unknown Account'}
                                          </span>
                                        </td>
                                        <td className="p-2 text-slate-500 border-l border-slate-100">{line.note || '-'}</td>
                                        <td className="p-2 text-left font-mono border-l border-slate-100">
                                          {line.debit > 0 ? <span className="text-emerald-600 font-bold">{line.debit.toFixed(2)}</span> : '-'}
                                        </td>
                                        <td className="p-2 text-left font-mono border-l border-slate-100">
                                          {line.credit > 0 ? <span className="text-red-600 font-bold">{line.credit.toFixed(2)}</span> : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && <ManualEntryModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); loadData(); }} />}
    </div>
  )
}
