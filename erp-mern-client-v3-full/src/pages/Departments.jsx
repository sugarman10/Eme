import { useEffect, useState } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { Plus, Building2 } from 'lucide-react'

export default function Departments() {
  const { push } = useToast()
  const [list, setList] = useState([])
  const [form, setForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      const { data } = await api.get('/departments')
      setList(data?.items || data || [])
    } catch (err) {
      console.error('Failed to load departments', err)
      push('error', err?.response?.data?.message || 'فشل تحميل الأقسام')
    }
  }

  useEffect(() => { load() }, [])

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/departments', form)
      push('success', 'تمت إضافة القسم بنجاح')
      setForm({ name: '', description: '' })
      await load()
    } catch (e) {
      push('error', 'فشل إضافة القسم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="h2">الأقسام</h1>
          <p className="muted">إدارة الهيكل التنظيمي والأقسام</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="card h-fit">
          <div className="card-header">
            <h3 className="font-bold flex items-center gap-2">
              <Plus size={18} />
              إضافة قسم جديد
            </h3>
          </div>
          <div className="card-body">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold">اسم القسم</label>
                <input
                  className="input w-full"
                  placeholder="مثال: الموارد البشرية"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">الوصف</label>
                <textarea
                  className="input w-full h-24 resize-none"
                  placeholder="وصف مختصر للقسم..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <button disabled={loading} className="btn btn-primary w-full">
                {loading ? 'جاري الحفظ...' : 'حفظ القسم'}
              </button>
            </form>
          </div>
        </div>

        {/* List Section */}
        <div className="card md:col-span-2">
          <div className="card-header">
            <h3 className="font-bold flex items-center gap-2">
              <Building2 size={18} />
              قائمة الأقسام
            </h3>
          </div>
          <div className="card-body p-0">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th>اسم القسم</th>
                    <th>الوصف</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center p-8 text-gray-500">لا توجد أقسام مضافة بعد.</td>
                    </tr>
                  ) : (
                    list.map(d => (
                      <tr key={d._id} className="hover:bg-gray-50">
                        <td className="font-bold">{d.name}</td>
                        <td className="text-gray-500">{d.description || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
