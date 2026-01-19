import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useWarehouse } from '../context/WarehouseContext'
import { Search, Download, ChevronLeft, ChevronRight, Package, Filter } from 'lucide-react'

export default function StockBalancesAll() {
  const { push } = useToast()
  const { warehouses } = useWarehouse()
  const [q, setQ] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async (_page = page, _limit = limit, _q = q, _wh = warehouseFilter) => {
    setLoading(true)
    try {
      const { data } = await api.get(`/inventory/stock/balances?q=${encodeURIComponent(_q)}&warehouse=${_wh}&page=${_page}&limit=${_limit}`)
      setRows(data.rows || [])
      setTotal(data.total || 0)
      setPage(data.page || 1)
    } catch (e) {
      push('error', e?.response?.data?.message || 'فشل جلب البيانات')
    } finally { setLoading(false) }
  }

  useEffect(() => { load(1, limit, q, warehouseFilter) }, []) // أول تحميل

  const pages = Math.max(1, Math.ceil(total / limit))

  const exportCSV = () => {
    const header = 'SKU,Item,Warehouse,Balance\n'
    const body = rows.map(r => `${r.item?.sku || ''},${r.item?.name || ''},${r.warehouse?.code || ''} - ${r.warehouse?.name || ''},${r.balance}`).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'stock_balances.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="h2">أرصدة المخزون</h1>
          <p className="muted">عرض وإدارة أرصدة جميع الأصناف في المستودعات</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn btn-secondary">
            <Download size={16} />
            تصدير CSV
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex gap-4 w-full">
            <div className="input-group" style={{ flex: 1, position: 'relative' }}>
              <input
                placeholder="بحث (SKU / اسم الصنف / المستودع)..."
                value={q}
                onChange={e => setQ(e.target.value)}
                className="input"
                style={{ paddingLeft: '2.5rem' }}
                onKeyDown={e => e.key === 'Enter' && load(1, limit, q)}
              />
              <Search size={18} className="text-muted" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            <div className="relative" style={{ minWidth: '200px' }}>
              <Filter size={18} className="text-muted absolute right-3 top-1/2 -translate-y-1/2" />
              <select
                value={warehouseFilter}
                onChange={e => {
                  const val = e.target.value
                  setWarehouseFilter(val)
                  load(1, limit, q, val)
                }}
                className="select w-full !pr-10"
              >
                <option value="">كل المستودعات</option>
                {warehouses.map(w => (
                  <option key={w._id} value={w._id}>{w.name}</option>
                ))}
              </select>
            </div>

            <button onClick={() => load(1, limit, q, warehouseFilter)} className="btn btn-primary" disabled={loading}>
              {loading ? 'جاري البحث...' : 'بحث'}
            </button>

            <select
              value={limit}
              onChange={e => { const v = Number(e.target.value); setLimit(v); load(1, v, q, warehouseFilter) }}
              className="select"
              style={{ width: 'auto' }}
            >
              {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / صفحة</option>)}
            </select>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>الصنف</th>
                  <th>المستودع</th>
                  <th>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center p-4">
                      <div className="muted">جاري التحميل...</div>
                    </td>
                  </tr>
                ) : rows.length > 0 ? (
                  rows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="font-bold">{r.item?.sku}</td>
                      <td>
                        <Link to={`/items?q=${r.item?.sku}`} className="flex items-center gap-2" style={{ color: 'var(--primary)' }}>
                          <Package size={16} />
                          {r.item?.name}
                        </Link>
                      </td>
                      <td>
                        <span className="badge badge-secondary">
                          {r.warehouse?.code}
                        </span>
                        <span className="muted" style={{ marginRight: '0.5rem' }}>{r.warehouse?.name}</span>
                      </td>
                      <td>
                        <span className={`badge ${r.balance > 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.875rem' }}>
                          {r.balance}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center p-4">
                      <div className="muted">لا توجد بيانات مطابقة للبحث.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-header" style={{ borderTop: '1px solid var(--border)', borderBottom: 'none', background: 'var(--surface)' }}>
          <div className="flex justify-between items-center w-full">
            <div className="muted">
              عرض {rows.length} من أصل {total} سجل
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                disabled={page <= 1 || loading}
                onClick={() => load(page - 1, limit, q, warehouseFilter)}
              >
                <ChevronRight size={16} />
                السابق
              </button>
              <div className="flex items-center px-2 font-bold">
                {page} / {pages}
              </div>
              <button
                className="btn btn-secondary"
                disabled={page >= pages || loading}
                onClick={() => load(page + 1, limit, q, warehouseFilter)}
              >
                التالي
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
