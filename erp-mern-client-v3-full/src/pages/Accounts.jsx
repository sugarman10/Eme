import { useEffect, useState, useMemo } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  MoreHorizontal,
  Edit,
  Trash2,
  PlusCircle,
  Search,
  Filter
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const ACCOUNT_TYPES = {
  asset: { label: 'أصول', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  liability: { label: 'خصوم', color: 'text-red-600 bg-red-50 border-red-200' },
  equity: { label: 'حقوق ملكية', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  revenue: { label: 'إيرادات', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  expense: { label: 'مصروفات', color: 'text-amber-600 bg-amber-50 border-amber-200' }
}

export default function Accounts() {
  const { push } = useToast()
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

  // Load Data
  const loadAccounts = async () => {
    try {
      setLoading(true)
      const { data } = await api.get('/finance/accounts')
      setAccounts(data || [])
    } catch (err) {
      console.error(err)
      push('error', 'فشل تحميل دليل الحسابات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAccounts() }, [])

  // Tree Logic
  const treeData = useMemo(() => {
    const map = {}
    const roots = []

    // 1. Map all items
    accounts.forEach(acc => {
      map[acc._id] = { ...acc, children: [] }
    })

    // 2. Connect parents
    accounts.forEach(acc => {
      if (acc.parentId && map[acc.parentId]) {
        map[acc.parentId].children.push(map[acc._id])
      } else {
        roots.push(map[acc._id])
      }
    })

    // 3. Sort by Code
    const sortNodes = (nodes) => {
      return nodes.sort((a, b) => a.code.localeCompare(b.code)).map(node => {
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
      code: parent ? `${parent.code}` : '', // Pre-fill prefix could be smarter
      name: '',
      type: parent ? parent.type : 'asset', // Inherit type
      parentId: parentId || '',
      description: ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) return
    try {
      await api.delete(`/finance/accounts/${id}`) // Ensure this route exists or implement generic delete
      push('success', 'تم الحذف بنجاح')
      loadAccounts()
    } catch (err) {
      push('error', 'لا يمكن حذف حساب لديه عمليات أو حسابات فرعية')
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
      push('success', 'تم الحفظ بنجاح')
      setShowModal(false)
      loadAccounts()
    } catch (err) {
      push('error', err?.response?.data?.message || 'فشل الحفظ')
    }
  }

  // Recursive Row Component
  const AccountRow = ({ node, level = 0 }) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expanded[node._id]

    // Filter logic (if searching, auto-expand relevant paths)
    if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase()) && !node.code.includes(searchTerm)) {
      // Simple filter: if node doesn't match, check children. 
      // This is complex for a recursive tree. For now, simple client-side search matches top-level or exact.
      // Better: Just highlight matches or flatten list for search.
      // Let's stick to simple render for now.
    }

    return (
      <>
        <div
          className="flex items-center border-b border-slate-100 hover:bg-slate-50 transition-colors h-14 group"
        >
          {/* Account Name & Tree Control */}
          <div className="flex-1 flex items-center pr-4" style={{ paddingRight: `${level * 24 + 16}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => handleExpand(node._id)}
                  className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} className="rtl:rotate-180" />}
                </button>
              ) : (
                <span className="w-6" /> // Spacer
              )}

              <div className={`p-1.5 rounded-lg ${hasChildren ? 'bg-amber-100/50 text-amber-600' : 'bg-blue-100/50 text-blue-600'}`}>
                {hasChildren ? <Folder size={16} /> : <FileText size={16} />}
              </div>

              <div className="flex flex-col">
                <span className="font-bold text-sm text-slate-800">{node.name}</span>
                {level === 0 && <span className="text-[10px] text-slate-400">حساب رئيسي</span>}
              </div>
            </div>
          </div>

          {/* Code */}
          <div className="w-32 font-mono text-sm text-slate-600 text-left pl-4 border-l border-slate-100 h-full flex items-center">
            {node.code}
          </div>

          {/* Type */}
          <div className="w-32 flex items-center justify-center border-l border-slate-100 h-full">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ACCOUNT_TYPES[node.type]?.color}`}>
              {ACCOUNT_TYPES[node.type]?.label || node.type}
            </span>
          </div>

          {/* Balance */}
          <div className="w-40 flex items-center justify-end pl-6 border-l border-slate-100 h-full font-mono font-bold text-sm">
            <span dir="ltr">{formatCurrency(node.balance)}</span>
          </div>

          {/* Actions */}
          <div className="w-32 flex items-center justify-center gap-1 border-l border-slate-100 h-full opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              title="إضافة حساب فرعي"
              onClick={() => handleAddSub(node._id)}
              className="p-1.5 hover:bg-primary/10 text-primary rounded-md transition-colors"
            >
              <PlusCircle size={16} />
            </button>
            <button
              title="تعديل"
              onClick={() => handleEdit(node)}
              className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-md transition-colors"
            >
              <Edit size={16} />
            </button>
            {!hasChildren && (
              <button
                title="حذف"
                onClick={() => handleDelete(node._id)}
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
      </>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 flex flex-col gap-6 animate-in fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">دليل الحسابات</h1>
          <p className="text-sm text-slate-500">إدارة الشجرة المالية للنظام</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => handleAddSub(null)} className="gap-2">
            <Plus size={18} />
            حساب جديد
          </Button>
        </div>
      </div>

      {/* Stats Cards (Optional - can be added later) */}

      {/* Main Content */}
      <Card className="flex flex-col border shadow-sm bg-white overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center h-12 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 px-0">
          <div className="flex-1 pr-6">اسم الحساب</div>
          <div className="w-32 text-left pl-4 border-l border-slate-200 h-full flex items-center">كود الحساب</div>
          <div className="w-32 text-center border-l border-slate-200 h-full flex items-center justify-center">النوع</div>
          <div className="w-40 text-left pl-6 border-l border-slate-200 h-full flex items-center">الرصيد (LYD)</div>
          <div className="w-32 text-center border-l border-slate-200 h-full flex items-center justify-center">إجراءات</div>
        </div>

        {/* Tree Body */}
        <div className="flex-1 overflow-auto min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              جاري التحميل...
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Folder size={48} strokeWidth={1} className="mb-2 opacity-50" />
              <p>لا توجد حسابات مضافة.</p>
              <Button variant="outline" size="sm" onClick={() => handleAddSub(null)} className="mt-4">
                بدء الدليل المحاسبي
              </Button>
            </div>
          ) : (
            treeData.map(node => (
              <AccountRow key={node._id} node={node} />
            ))
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg">
                {editingAccount ? 'تعديل حساب' : 'إضافة حساب جديد'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <Filter size={18} className="rotate-45" /> {/* Using Filter as X icon replacement if X not imported, wait X is not imported? I will replace with text or correct icon */}
                X
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">كود الحساب</label>
                  <Input
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="مثال: 10101"
                    required
                    dir="ltr"
                    className="font-mono text-left"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">نوع الحساب</label>
                  <select
                    className="w-full h-10 rounded-md border border-slate-200 px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.type}
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
                  placeholder="مثال: الصندوق الرئيسي"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">الحساب الرئيسي (اختياري)</label>
                <select
                  className="w-full h-10 rounded-md border border-slate-200 px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.parentId}
                  onChange={e => {
                    const pid = e.target.value
                    const parent = accounts.find(a => a._id === pid)
                    setFormData({ ...formData, parentId: pid, type: parent ? parent.type : formData.type })
                  }}
                >
                  <option value="">-- حساب جذري (بدون أب) --</option>
                  {accounts.map(acc => (
                    <option key={acc._id} value={acc._id}>
                      {acc.code} - {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3">
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
