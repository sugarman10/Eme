import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { RefreshCw, Filter, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function SalesDaily() {
  const { push } = useToast()
  const [from, setFrom] = useState(() => new Date(Date.now() - 6 * 24 * 3600e3).toISOString().slice(0, 10)) // آخر 7 أيام
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [channel, setChannel] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ from, to, channel }).toString()
      const { data } = await api.get(`/reports/daily?${qs}`)
      setRows(data || [])
    } catch (e) { push('error', e?.response?.data?.message || 'فشل جلب التقرير') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, []) // أول مرة

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-100px)]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="h2">مبيعات يومية</h1>
          <p className="muted">تحليل المبيعات حسب القناة (جملة/قطاعي)</p>
        </div>
      </div>

      <div className="card shadow-md border-0">
        <div className="card-header bg-gray-50 border-b p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-bold mb-1 block">من تاريخ</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input w-full" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-bold mb-1 block">إلى تاريخ</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input w-full" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-bold mb-1 block">القناة</label>
              <select value={channel} onChange={e => setChannel(e.target.value)} className="select w-full">
                <option value="all">الكل</option>
                <option value="wholesale">جملة</option>
                <option value="retail">قطاعي</option>
              </select>
            </div>
            <div>
              <button onClick={load} className="btn btn-primary" disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'جاري التحميل...' : 'تحديث'}
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-6">
          {!rows.length ? (
            <div className="text-center py-12 text-gray-500">لا توجد بيانات في المدى المحدد.</div>
          ) : (
            <div className="space-y-8">
              {/* Chart */}
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <BarChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(val) => val.slice(5)} />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => Number(value).toLocaleString()}
                      labelFormatter={(label) => `التاريخ: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="wholesale" name="جملة" fill="#1e293b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="retail" name="قطاعي" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="table w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th>التاريخ</th>
                      <th>جملة</th>
                      <th>قطاعي</th>
                      <th>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.date} className="hover:bg-gray-50">
                        <td className="font-mono">{r.date}</td>
                        <td>{Number(r.wholesale || 0).toLocaleString()}</td>
                        <td>{Number(r.retail || 0).toLocaleString()}</td>
                        <td className="font-bold text-primary-700">{Number(r.grand || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
