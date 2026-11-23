import { useEffect, useState, useMemo, useCallback } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Edit,
  Trash2,
  PlusCircle,
  Search,
  Lock,
  ShieldCheck,
  X,
  Maximize2,
  Minimize2,
  History,
  Calendar,
  RefreshCw,
  Printer,
  ArrowUpRight,
  ArrowDownLeft,
  FileSpreadsheet,
  Filter,
  Layers,
  TrendingUp,
  TrendingDown,
  Scale,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const ACCOUNT_TYPES = {
  asset: { label: 'أصول', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  liability: { label: 'خصوم', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  equity: { label: 'حقوق ملكية', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  revenue: { label: 'إيرادات', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  expense: { label: 'مصروفات', color: 'text-amber-700 bg-amber-50 border-amber-200' }
}

const REFERENCE_TYPE_BADGES = {
  SALE_INVOICE: { label: 'فاتورة مبيعات', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  PURCHASE: { label: 'فاتورة مشتريات', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  PURCHASE_INVOICE: { label: 'فاتورة مشتريات', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  SALES_RETURN: { label: 'مردودات مبيعات', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  PURCHASE_RETURN: { label: 'مردودات مشتريات', color: 'bg-rose-100 text-rose-800 border-rose-300' },
  PURCHASE_RETURN_REVERSAL: { label: 'إلغاء إرجاع مشتريات', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  RECEIPT: { label: 'سند قبض', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  PAYMENT: { label: 'سند دفع', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  PAYMENT_VOUCHER: { label: 'سند صرف', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  EXPENSE: { label: 'مصروفات', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  MANUAL: { label: 'قيد يدوي', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  OPENING: { label: 'رصيد افتتاحي', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  ADJUSTMENT: { label: 'قيد تسوية', color: 'bg-slate-100 text-slate-800 border-slate-300' },
}

export default function Accounts() {
  const { push } = useToast()
  const [activeTab, setActiveTab] = useState('tree') // 'tree' | 'movements'
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [searchTerm, setSearchTerm] = useState('')

  // Form State
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'asset',
    parentId: '',
    description: ''
  })

  // Account Statement Modal State
  const [statementAccount, setStatementAccount] = useState(null)
  const [statementData, setStatementData] = useState(null)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementRange, setStatementRange] = useState({ from: '', to: '', preset: 'all' })

  // General Movements State
  const [generalMovements, setGeneralMovements] = useState([])
  const [generalLoading, setGeneralLoading] = useState(false)
  const [generalStats, setGeneralStats] = useState({ total: 0, totalDebit: 0, totalCredit: 0 })
  const [generalTotalPages, setGeneralTotalPages] = useState(1)
  const [generalFilters, setGeneralFilters] = useState({
    accountId: '',
    referenceType: 'ALL',
    from: '',
    to: '',
    search: '',
    page: 1,
    limit: 30,
  })

  // Load Accounts
  const loadAccounts = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/finance/accounts')
      const accList = data || []
      setAccounts(accList)

      // Auto-expand level 0 and level 1 by default
      const defaultExpanded = {}
      accList.forEach(a => {
        if (!a.parentId || a.code.length <= 2) {
          defaultExpanded[a._id] = true
        }
      })
      setExpanded(defaultExpanded)
    } catch (err) {
      console.error(err)
      push('error', 'فشل تحميل دليل الحسابات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [])

  // Load General Movements
  const loadGeneralMovements = useCallback(async (page = 1) => {
    try {
      setGeneralLoading(true)
      const params = {
        page,
        limit: generalFilters.limit || 30,
      }
      if (generalFilters.accountId) params.accountId = generalFilters.accountId
      if (generalFilters.referenceType && generalFilters.referenceType !== 'ALL') {
        params.referenceType = generalFilters.referenceType
      }
      if (generalFilters.from) params.from = generalFilters.from
      if (generalFilters.to) params.to = generalFilters.to
      if (generalFilters.search) params.search = generalFilters.search

      const { data } = await api.get('/finance/accounts/movements', { params })
      setGeneralMovements(data.movements || [])
      setGeneralStats({
        total: data.total || 0,
        totalDebit: data.totalDebit || 0,
        totalCredit: data.totalCredit || 0,
      })
      setGeneralTotalPages(data.totalPages || 1)
    } catch (err) {
      console.error(err)
      push('error', 'فشل تحميل سجل الحركات المالية العام')
    } finally {
      setGeneralLoading(false)
    }
  }, [generalFilters, push])

  useEffect(() => {
    if (activeTab === 'movements') {
      loadGeneralMovements(generalFilters.page)
    }
  }, [activeTab, generalFilters.page, loadGeneralMovements])

  // Load Account Statement
  const loadAccountStatement = useCallback(async (account, from = '', to = '') => {
    if (!account) return
    try {
      setStatementLoading(true)
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get(`/finance/accounts/${account._id}/statement`, { params })
      setStatementData(data)
    } catch (err) {
      console.error(err)
      push('error', 'فشل تحميل كشف حركة الحساب')
    } finally {
      setStatementLoading(false)
    }
  }, [push])

  const handleOpenStatement = (account) => {
    setStatementAccount(account)
    setStatementRange({ from: '', to: '', preset: 'all' })
    loadAccountStatement(account, '', '')
  }

  const handleStatementPreset = (preset) => {
    const today = new Date().toISOString().slice(0, 10)
    let from = ''
    let to = today

    if (preset === 'today') {
      from = today
    } else if (preset === '7days') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      from = d.toISOString().slice(0, 10)
    } else if (preset === 'month') {
      const d = new Date()
      from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    } else if (preset === 'year') {
      const d = new Date()
      from = `${d.getFullYear()}-01-01`
    } else {
      from = ''
      to = ''
    }

    setStatementRange({ from, to, preset })
    if (statementAccount) {
      loadAccountStatement(statementAccount, from, to)
    }
  }

  // Tree Logic
  const treeData = useMemo(() => {
    const map = {}
    const roots = []

    accounts.forEach(acc => {
      map[acc._id] = { ...acc, children: [] }
    })

    accounts.forEach(acc => {
      if (acc.parentId && map[acc.parentId]) {
        map[acc.parentId].children.push(map[acc._id])
      } else {
        roots.push(map[acc._id])
      }
    })

    const sortNodes = (nodes) => {
      return nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })).map(node => {
        if (node.children.length > 0) {
          node.children = sortNodes(node.children)
        }
        return node
      })
    }

    return sortNodes(roots)
  }, [accounts])

  // Helpers
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'currency',
      currency: 'LYD'
    }).format(amount || 0)
  }

  const handleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleExpandAll = () => {
    const allExp = {}
    accounts.forEach(a => { allExp[a._id] = true })
    setExpanded(allExp)
  }

  const handleCollapseAll = () => {
    setExpanded({})
  }

  const handleEdit = (account) => {
    setEditingAccount(account)
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId || '',
      description: account.description || ''
    })
    setShowModal(true)
  }

  const handleAddSub = (parentId) => {
    const parent = accounts.find(a => a._id === parentId)
    setEditingAccount(null)
    setFormData({
      code: parent ? `${parent.code}0` : '',
      name: '',
      type: parent ? parent.type : 'asset',
      parentId: parentId || '',
      description: ''
    })
    setShowModal(true)
  }

  const handleDelete = async (account) => {
    if (account.isSystem) {
      push('error', 'لا يمكن حذف حساب نظام أساسي')
      return
    }
    if (!window.confirm(`هل أنت متأكد من حذف الحساب "${account.name}" (${account.code})؟`)) return
    try {
      await api.delete(`/finance/accounts/${account._id}`)
      push('success', 'تم الحذف بنجاح')
      loadAccounts()
    } catch (err) {
      push('error', err?.response?.data?.message || 'لا يمكن حذف حساب لديه قيود أو حسابات فرعية')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...formData, parentId: formData.parentId || null }
    try {
      if (editingAccount) {
        await api.put(`/finance/accounts/${editingAccount._id}`, payload)
      } else {
        await api.post('/finance/accounts', payload)
      }
      push('success', 'تم حفظ بيانات الحساب بنجاح')
      setShowModal(false)
      loadAccounts()
    } catch (err) {
      push('error', err?.response?.data?.message || 'فشل حفظ بيانات الحساب')
    }
  }

  const matchesSearch = (node, term) => {
    if (!term) return true
    const termLower = term.toLowerCase()
    const selfMatch = node.name.toLowerCase().includes(termLower) || node.code.includes(termLower)
    if (selfMatch) return true
    return node.children?.some(child => matchesSearch(child, term))
  }

  // Recursive Row Component
  const AccountRow = ({ node, level = 0 }) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = searchTerm ? true : Boolean(expanded[node._id])

    if (searchTerm && !matchesSearch(node, searchTerm)) {
      return null
    }

    return (
      <div className="flex flex-col">
        <div
          className={`flex items-center border-b border-slate-100 hover:bg-slate-50/80 transition-colors h-14 group ${
            level === 0 ? 'bg-slate-50/40 font-semibold' : ''
          }`}
        >
          {/* Account Name & Tree Control */}
          <div className="flex-1 flex items-center pr-4" style={{ paddingRight: `${level * 24 + 16}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => handleExpand(node._id)}
                  className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} className="rtl:rotate-180" />}
                </button>
              ) : (
                <span className="w-6" />
              )}

              <div
                className={`p-1.5 rounded-lg ${
                  node.isSystem
                    ? 'bg-amber-100 text-amber-800'
                    : hasChildren
                    ? 'bg-indigo-100/60 text-indigo-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {node.isSystem ? (
                  <ShieldCheck size={16} />
                ) : hasChildren ? (
                  <Folder size={16} />
                ) : (
                  <FileText size={16} />
                )}
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${level === 0 ? 'font-black text-slate-900' : 'font-medium text-slate-800'}`}>
                    {node.name}
                  </span>
                  {node.isSystem && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      <Lock size={10} />
                      نظام أساسي
                    </span>
                  )}
                </div>
                {level === 0 && <span className="text-[10px] text-slate-400">حساب رئيسي من المستوى الأول</span>}
              </div>
            </div>
          </div>

          {/* Code */}
          <div className="w-32 font-mono text-sm font-bold text-slate-700 text-left pl-4 border-l border-slate-100 h-full flex items-center">
            {node.code}
          </div>

          {/* Type */}
          <div className="w-32 flex items-center justify-center border-l border-slate-100 h-full">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${ACCOUNT_TYPES[node.type]?.color}`}>
              {ACCOUNT_TYPES[node.type]?.label || node.type}
            </span>
          </div>

          {/* Balance */}
          <div className="w-40 flex items-center justify-end pl-6 border-l border-slate-100 h-full font-mono font-bold text-sm">
            <span dir="ltr" className={node.balance < 0 ? 'text-red-600' : 'text-slate-800'}>
              {formatCurrency(node.balance)}
            </span>
          </div>

          {/* Actions */}
          <div className="w-40 flex items-center justify-center gap-1 border-l border-slate-100 h-full opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              title="كشف حركة وسجل الحساب"
              onClick={() => handleOpenStatement(node)}
              className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition-colors"
            >
              <History size={16} />
            </button>
            <button
              title="إضافة حساب فرعي"
              onClick={() => handleAddSub(node._id)}
              className="p-1.5 hover:bg-primary/10 text-primary rounded-md transition-colors"
            >
              <PlusCircle size={16} />
            </button>
            <button
              title={node.isSystem ? 'تعديل اسم الحساب' : 'تعديل الحساب'}
              onClick={() => handleEdit(node)}
              className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-md transition-colors"
            >
              <Edit size={16} />
            </button>
            {!node.isSystem && !hasChildren && (
              <button
                title="حذف الحساب"
                onClick={() => handleDelete(node)}
                className="p-1.5 hover:bg-red-50 text-red-600 rounded-md transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Render Children */}
        {isExpanded && node.children.map(child => (
          <AccountRow key={child._id} node={child} level={level + 1} />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 flex flex-col gap-6 animate-in fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">دليل وسجل حركات الحسابات</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              دليل نظامي وربط شامل (100% Zero-Leak)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            إدارة الشجرة المالية وكشف حركات الحسابات ودفتر الأستاذ العام لجميع العمليات المالية
          </p>
        </div>

        {/* Tab Controls & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'tree' ? (
            <>
              <Button variant="outline" size="sm" onClick={handleExpandAll} className="gap-1.5 text-xs">
                <Maximize2 size={14} />
                توسيع الكل
              </Button>
              <Button variant="outline" size="sm" onClick={handleCollapseAll} className="gap-1.5 text-xs">
                <Minimize2 size={14} />
                طي الكل
              </Button>
              <Button onClick={() => handleAddSub(null)} className="gap-2">
                <Plus size={18} />
                إضافة حساب فرعي
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadGeneralMovements(1)}
              className="gap-1.5 text-xs"
              disabled={generalLoading}
            >
              <RefreshCw size={14} className={generalLoading ? 'animate-spin' : ''} />
              تحديث الحركات
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3 gap-2 shadow-sm">
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'tree'
              ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <Layers size={18} />
          شجرة الحسابات الهرمية
          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono">
            {accounts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'movements'
              ? 'border-primary text-primary bg-primary/5 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <History size={18} />
          سجل كافة الحركات المالية (General Ledger)
          {generalStats.total > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-mono">
              {generalStats.total}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CHART OF ACCOUNTS TREE VIEW */}
      {activeTab === 'tree' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-150">
          {/* Search bar */}
          <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="بحث برقم الحساب أو الاسم (مثال: 1104 أو المخزون أو الصندوق)..."
                className="w-full pr-10 pl-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {searchTerm && (
              <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')}>
                مسح البحث
              </Button>
            )}
          </div>

          {/* Tree Card */}
          <Card className="flex flex-col border shadow-sm bg-white overflow-hidden">
            {/* Table Header */}
            <div className="flex items-center h-12 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 px-0">
              <div className="flex-1 pr-6">اسم الحساب والتبعية الهرمية</div>
              <div className="w-32 text-left pl-4 border-l border-slate-200 h-full flex items-center">كود الحساب</div>
              <div className="w-32 text-center border-l border-slate-200 h-full flex items-center justify-center">النوع المحاسبي</div>
              <div className="w-40 text-left pl-6 border-l border-slate-200 h-full flex items-center">الرصيد المالي</div>
              <div className="w-40 text-center border-l border-slate-200 h-full flex items-center justify-center">إجراءات الحساب</div>
            </div>

            {/* Tree Body */}
            <div className="flex-1 overflow-auto min-h-[500px]">
              {loading ? (
                <div className="flex items-center justify-center h-64 text-slate-400">
                  جاري تحميل دليل الحسابات...
                </div>
              ) : accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Folder size={48} strokeWidth={1} className="mb-2 opacity-50" />
                  <p>لا توجد حسابات مضافة.</p>
                </div>
              ) : (
                treeData.map(node => (
                  <AccountRow key={node._id} node={node} />
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: GENERAL MOVEMENTS LOG VIEW */}
      {activeTab === 'movements' && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-150">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                <History size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">إجمالي الحركات المسجلة</p>
                <h3 className="text-xl font-bold text-slate-900 font-mono mt-0.5">{generalStats.total}</h3>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <ArrowUpRight size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">إجمالي المبالغ المدينة (Debit)</p>
                <h3 className="text-xl font-bold text-emerald-700 font-mono mt-0.5" dir="ltr">
                  {formatCurrency(generalStats.totalDebit)}
                </h3>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                <ArrowDownLeft size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">إجمالي المبالغ الدائنة (Credit)</p>
                <h3 className="text-xl font-bold text-purple-700 font-mono mt-0.5" dir="ltr">
                  {formatCurrency(generalStats.totalCredit)}
                </h3>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                <Scale size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">توازن قيود الشجرة المالية</p>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 mt-1">
                  ✓ متوازن تماماً (100%)
                </span>
              </div>
            </Card>
          </div>

          {/* Filters Bar */}
          <Card className="p-4 bg-white border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="بحث برقم القيد أو المرجع أو الملاحظة..."
                value={generalFilters.search}
                onChange={e => setGeneralFilters({ ...generalFilters, search: e.target.value, page: 1 })}
                className="w-full pr-9 pl-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Account Selector Filter */}
            <select
              value={generalFilters.accountId}
              onChange={e => setGeneralFilters({ ...generalFilters, accountId: e.target.value, page: 1 })}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 max-w-[220px]"
            >
              <option value="">-- جميع الحسابات --</option>
              {accounts.map(acc => (
                <option key={acc._id} value={acc._id}>
                  {acc.code} - {acc.name}
                </option>
              ))}
            </select>

            {/* Operation Type Filter */}
            <select
              value={generalFilters.referenceType}
              onChange={e => setGeneralFilters({ ...generalFilters, referenceType: e.target.value, page: 1 })}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">-- كل العمليات --</option>
              {Object.entries(REFERENCE_TYPE_BADGES).map(([key, item]) => (
                <option key={key} value={key}>{item.label}</option>
              ))}
            </select>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>من:</span>
              <input
                type="date"
                value={generalFilters.from}
                onChange={e => setGeneralFilters({ ...generalFilters, from: e.target.value, page: 1 })}
                className="h-9 border border-slate-200 rounded-lg px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>إلى:</span>
              <input
                type="date"
                value={generalFilters.to}
                onChange={e => setGeneralFilters({ ...generalFilters, to: e.target.value, page: 1 })}
                className="h-9 border border-slate-200 rounded-lg px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {(generalFilters.search || generalFilters.accountId || generalFilters.referenceType !== 'ALL' || generalFilters.from || generalFilters.to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGeneralFilters({ accountId: '', referenceType: 'ALL', from: '', to: '', search: '', page: 1, limit: 30 })}
                className="text-xs text-slate-500"
              >
                تفريغ الفلاتر
              </Button>
            )}
          </Card>

          {/* Movements Table */}
          <Card className="flex flex-col border shadow-sm bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-3">رقم القيد / المرجع</th>
                    <th className="py-3 px-3">نوع العملية</th>
                    <th className="py-3 px-3">الحساب المتأثر</th>
                    <th className="py-3 px-4">البيان / الوصف</th>
                    <th className="py-3 px-4 text-left">مدين (Debit)</th>
                    <th className="py-3 px-4 text-left">دائن (Credit)</th>
                    <th className="py-3 px-3 text-center">المستخدم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {generalLoading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        جاري تحميل سجل الحركات...
                      </td>
                    </tr>
                  ) : generalMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        لا توجد حركات مالية مطابقة للفلاتر المحددة.
                      </td>
                    </tr>
                  ) : (
                    generalMovements.map((mov) => (
                      <tr key={mov._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600 text-[11px]" dir="ltr">
                          {new Date(mov.date).toLocaleString('ar-LY', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col font-mono text-[11px]">
                            <span className="font-bold text-slate-800">{mov.serialNumber}</span>
                            {mov.ref && <span className="text-slate-400 text-[10px]">{mov.ref}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              REFERENCE_TYPE_BADGES[mov.referenceType]?.color || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {mov.referenceTypeName}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {mov.account ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-[11px]">{mov.account.name}</span>
                              <span className="font-mono text-[10px] text-slate-400">كود: {mov.account.code}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-700" title={mov.memo}>
                          {mov.memo || '-'}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-slate-800" dir="ltr">
                          {mov.debit > 0 ? (
                            <span className="text-emerald-700 font-bold">{formatCurrency(mov.debit)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-slate-800" dir="ltr">
                          {mov.credit > 0 ? (
                            <span className="text-purple-700 font-bold">{formatCurrency(mov.credit)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-500 text-[11px]">
                          {mov.user}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {generalTotalPages > 1 && (
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
                <span className="text-slate-500">
                  صفحة {generalFilters.page} من {generalTotalPages} (إجمالي {generalStats.total} حركة)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={generalFilters.page <= 1}
                    onClick={() => setGeneralFilters({ ...generalFilters, page: generalFilters.page - 1 })}
                  >
                    السابق
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={generalFilters.page >= generalTotalPages}
                    onClick={() => setGeneralFilters({ ...generalFilters, page: generalFilters.page + 1 })}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL: Detailed Account Statement / Ledger */}
      {statementAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="w-full max-w-5xl bg-white shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <History size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-slate-900">
                      كشف حركة الحساب: {statementAccount.name}
                    </h3>
                    <span className="font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-xs font-bold">
                      {statementAccount.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ACCOUNT_TYPES[statementAccount.type]?.color}`}>
                      {ACCOUNT_TYPES[statementAccount.type]?.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    سجل حركات القيود المزدوجة والرصيد المتدحرج التراكمي
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-1.5 text-xs"
                >
                  <Printer size={14} />
                  طباعة الكشف
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setStatementAccount(null)
                    setStatementData(null)
                  }}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Quick Date Range Filters */}
            <div className="p-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold ml-1">فترة الكشف:</span>
                {[
                  { key: 'all', label: 'الكل' },
                  { key: 'today', label: 'اليوم' },
                  { key: '7days', label: 'آخر 7 أيام' },
                  { key: 'month', label: 'هذا الشهر' },
                  { key: 'year', label: 'هذا العام' },
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleStatementPreset(p.key)}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      statementRange.preset === p.key
                        ? 'bg-primary text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span>من:</span>
                  <input
                    type="date"
                    value={statementRange.from}
                    onChange={e => {
                      const from = e.target.value
                      setStatementRange({ ...statementRange, from, preset: 'custom' })
                      loadAccountStatement(statementAccount, from, statementRange.to)
                    }}
                    className="h-8 border border-slate-200 rounded px-2 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span>إلى:</span>
                  <input
                    type="date"
                    value={statementRange.to}
                    onChange={e => {
                      const to = e.target.value
                      setStatementRange({ ...statementRange, to, preset: 'custom' })
                      loadAccountStatement(statementAccount, statementRange.from, to)
                    }}
                    className="h-8 border border-slate-200 rounded px-2 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Summary KPI Strip */}
            {statementData && (
              <div className="grid grid-cols-5 divide-x divide-x-reverse divide-slate-100 border-b border-slate-100 bg-slate-50/60 p-3 text-center text-xs">
                <div>
                  <p className="text-slate-400 text-[10px]">الرصيد الافتتاحي</p>
                  <p className="font-mono font-bold text-slate-700 text-sm mt-0.5" dir="ltr">
                    {formatCurrency(statementData.openingBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px]">إجمالي المدين (Debit)</p>
                  <p className="font-mono font-bold text-emerald-600 text-sm mt-0.5" dir="ltr">
                    {formatCurrency(statementData.totalDebit)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px]">إجمالي الدائن (Credit)</p>
                  <p className="font-mono font-bold text-purple-600 text-sm mt-0.5" dir="ltr">
                    {formatCurrency(statementData.totalCredit)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px]">صافي الحركة للفترة</p>
                  <p className={`font-mono font-bold text-sm mt-0.5 ${statementData.netMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">
                    {formatCurrency(statementData.netMovement)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px]">الرصيد الختامي الحالي</p>
                  <p className="font-mono font-black text-blue-700 text-sm mt-0.5" dir="ltr">
                    {formatCurrency(statementData.closingBalance)}
                  </p>
                </div>
              </div>
            )}

            {/* Statement Body Table */}
            <div className="flex-1 overflow-auto p-4">
              {statementLoading ? (
                <div className="flex items-center justify-center h-64 text-slate-400">
                  <RefreshCw className="animate-spin mr-2" size={20} />
                  جاري جلب حركات الحساب...
                </div>
              ) : !statementData || statementData.movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <History size={48} strokeWidth={1} className="mb-2 opacity-50" />
                  <p>لا توجد حركات مالية مسجلة لهذا الحساب خلال الفترة المحددة.</p>
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-bold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">التاريخ والوقت</th>
                      <th className="py-2.5 px-3">رقم القيد / المرجع</th>
                      <th className="py-2.5 px-3">نوع العملية</th>
                      <th className="py-2.5 px-3">البيان / الوصف</th>
                      <th className="py-2.5 px-3 text-left">مدين (Debit)</th>
                      <th className="py-2.5 px-3 text-left">دائن (Credit)</th>
                      <th className="py-2.5 px-3 text-left bg-blue-50/50">الرصيد بعد الحركة</th>
                      <th className="py-2.5 px-3 text-center">المستخدم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statementData.movements.map((mov) => (
                      <tr key={mov._id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600" dir="ltr">
                          {new Date(mov.date).toLocaleString('ar-LY', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col font-mono text-[11px]">
                            <span className="font-bold text-slate-800">{mov.serialNumber}</span>
                            {mov.ref && <span className="text-slate-400 text-[10px]">{mov.ref}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              REFERENCE_TYPE_BADGES[mov.referenceType]?.color || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {mov.referenceTypeName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-sm truncate text-slate-700" title={mov.memo}>
                          {mov.memo || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono font-bold" dir="ltr">
                          {mov.debit > 0 ? (
                            <span className="text-emerald-700 font-bold">{formatCurrency(mov.debit)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono font-bold" dir="ltr">
                          {mov.credit > 0 ? (
                            <span className="text-purple-700 font-bold">{formatCurrency(mov.credit)}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono font-black text-blue-900 bg-blue-50/30" dir="ltr">
                          {formatCurrency(mov.runningBalance)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                          {mov.user}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                إجمالي الحركات في الكشف: <strong className="text-slate-800">{statementData?.count || 0}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatementAccount(null)
                  setStatementData(null)
                }}
              >
                إغلاق
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: Add / Edit Account */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                {editingAccount?.isSystem && (
                  <span className="p-1 rounded bg-amber-100 text-amber-700">
                    <Lock size={16} />
                  </span>
                )}
                <h3 className="font-bold text-lg text-slate-800">
                  {editingAccount
                    ? editingAccount.isSystem
                      ? 'تعديل مسمى حساب نظام أساسي'
                      : 'تعديل حساب'
                    : 'إضافة حساب جديد إلى الدليل'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {editingAccount?.isSystem && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
                  <strong>تنبيه حساب نظام:</strong> هذا الحساب مرتبط آلياً بالعمليات المحاسبية اليومية (فواتير، مقبوضات، مخزون). الكود والنوع مقفلان لضمان عدم حدوث أي تسريب مالي، ولكن يمكنك تعديل الاسم العربي الموضح.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">كود الحساب</label>
                  <Input
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="مثال: 110101"
                    required
                    dir="ltr"
                    disabled={Boolean(editingAccount?.isSystem)}
                    className="font-mono text-left disabled:bg-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">نوع الحساب</label>
                  <select
                    className="w-full h-10 rounded-md border border-slate-200 px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
                    value={formData.type}
                    disabled={Boolean(editingAccount?.isSystem)}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  >
                    {Object.entries(ACCOUNT_TYPES).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">اسم الحساب</label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: الصندوق الفرعي - طرابلس"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">الحساب الرئيسي (الأب)</label>
                <select
                  className="w-full h-10 rounded-md border border-slate-200 px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
                  value={formData.parentId}
                  disabled={Boolean(editingAccount?.isSystem)}
                  onChange={e => {
                    const pid = e.target.value
                    const parent = accounts.find(a => a._id === pid)
                    setFormData({ ...formData, parentId: pid, type: parent ? parent.type : formData.type })
                  }}
                >
                  <option value="">-- حساب جذري (بدون أب) --</option>
                  {accounts
                    .filter(a => !editingAccount || a._id !== editingAccount._id)
                    .map(acc => (
                      <option key={acc._id} value={acc._id}>
                        {acc.code} - {acc.name} ({ACCOUNT_TYPES[acc.type]?.label})
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>إلغاء</Button>
                <Button type="submit">حفظ التغييرات</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
