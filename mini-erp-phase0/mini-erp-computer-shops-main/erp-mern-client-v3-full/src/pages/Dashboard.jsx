import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { exportDashboardPdf } from '../utils/exportDashboard'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  AlertTriangle, Clock, ArrowRight,
  FileText, Users, CreditCard, Filter, Save, Bookmark, Trash2, X,
  RotateCcw // V2.0: Returns icon
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useWarehouse } from '../context/WarehouseContext'
import DrillDownModal from '../components/DrillDownModal'
import SkeletonLoader from '../components/SkeletonLoader'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308']

export default function Dashboard() {
  const navigate = useNavigate()
  const { push } = useToast()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState(null)

  const [dateRange, setDateRange] = useState('week') // 'today', 'week', 'month'
  const { warehouses } = useWarehouse()
  const [warehouseFilter, setWarehouseFilter] = useState('')

  // Drill-down modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState('invoices')
  const [modalFilters, setModalFilters] = useState({})

  // Saved Filters state
  const [savedViews, setSavedViews] = useState([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [filterName, setFilterName] = useState('')

  // PDF Export refs
  const salesByDayRef = useRef(null)
  const categoryShareRef = useRef(null)

  // Chart rendering delay state - fixes Recharts width(-1) error
  const [chartsReady, setChartsReady] = useState(false)

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true)
      try {
        const today = new Date().toISOString().split('T')[0]
        let fromDate = today

        if (dateRange === 'week') {
          const d = new Date()
          d.setDate(d.getDate() - 7)
          fromDate = d.toISOString().split('T')[0]
        } else if (dateRange === 'month') {
          const d = new Date()
          d.setDate(d.getDate() - 30)
          fromDate = d.toISOString().split('T')[0]
        }

        // Unified Dashboard API Call - optimized queries
        const res = await api.get('/dashboard/summary', {
          params: {
            from: fromDate,
            to: today,
            ...(warehouseFilter && { warehouseId: warehouseFilter })
          }
        })

        setDashboardData(res.data)

      } catch (err) {
        console.error('Dashboard error:', err)
        push('error', 'فشل تحميل بيانات لوحة التحكم')
      } finally {
        setLoading(false)
      }
    }
    loadDashboardData()
  }, [dateRange, warehouseFilter])

  // Load saved views on mount
  useEffect(() => {
    const loadSavedViews = async () => {
      try {
        const res = await api.get('/dashboard/views')
        setSavedViews(res.data || [])
      } catch (err) {
        console.error('Failed to load saved views:', err)
      }
    }
    loadSavedViews()
  }, [])

  // Delay chart rendering to ensure container has dimensions
  useEffect(() => {
    if (!loading && dashboardData) {
      const timer = setTimeout(() => {
        setChartsReady(true)
      }, 100) // Small delay to ensure layout is complete
      return () => clearTimeout(timer)
    } else {
      setChartsReady(false)
    }
  }, [loading, dashboardData])

  const saveCurrentFilter = async () => {
    if (!filterName.trim()) {
      push('error', 'اسم الفلتر مطلوب')
      return
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      let from = today

      if (dateRange === 'week') {
        from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      } else if (dateRange === 'month') {
        from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }

      const res = await api.post('/dashboard/views', {
        name: filterName.trim(),
        params: {
          from,
          to: today,
          warehouseId: warehouseFilter || null,
          comparePrevious: false
        }
      })

      setSavedViews(prev => [res.data, ...prev])
      setFilterName('')
      setShowSaveDialog(false)
      push('success', 'تم حفظ الفلتر بنجاح')
    } catch (err) {
      console.error('Save filter error:', err)
      push('error', 'فشل حفظ الفلتر')
    }
  }

  const applySavedView = (view) => {
    if (view.params) {
      if (view.params.warehouseId) {
        setWarehouseFilter(view.params.warehouseId)
      } else {
        setWarehouseFilter('')
      }

      const from = view.params.from ? new Date(view.params.from) : null
      const to = view.params.to ? new Date(view.params.to) : new Date()

      if (from && to) {
        const diff = to - from
        const days = diff / (1000 * 60 * 60 * 24)

        if (days <= 1) {
          setDateRange('today')
        } else if (days <= 8) {
          setDateRange('week')
        } else {
          setDateRange('month')
        }
      }
    }
    push('info', `تم تطبيق الفلتر: ${view.name}`)
  }

  const deleteSavedView = async (id) => {
    try {
      await api.delete(`/dashboard/views/${id}`)
      setSavedViews(prev => prev.filter(v => v._id !== id))
      push('success', 'تم حذف الفلتر')
    } catch (err) {
      console.error('Delete filter error:', err)
      push('error', 'فشل حذف الفلتر')
    }
  }

  const formatCurrency = (val) => Number(val).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD' })

  // Extract data from unified response
  const kpis = dashboardData?.kpis || {}
  const trends = dashboardData?.trends || {}
  const charts = dashboardData?.charts || {}
  const tables = dashboardData?.tables || {}
  const alerts = dashboardData?.alerts || []

  const salesData = charts.salesByDay || []
  const topProducts = charts.topProducts || []
  const categoryData = charts.categoryShare || []
  const recentInvoices = tables.recentInvoices || []
  const lowStockItems = tables.lowStockAlerts || []

  const handleExportPdf = async () => {
    const today = new Date().toISOString().split('T')[0]
    let from = today

    if (dateRange === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      from = d.toISOString().split('T')[0]
    } else if (dateRange === 'month') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      from = d.toISOString().split('T')[0]
    }

    await exportDashboardPdf(
      { salesByDayRef, categoryShareRef },
      { from, to: today, warehouseId: warehouseFilter || null, includeAlerts: true },
      push
    )
  }

  return (
    <div className="flex flex-col gap-8 animate-in pb-8">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent tracking-tight">
            لوحة القيادة
          </h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">نظرة عامة على أداء المتجر والمخزون</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors" />
            <select
              className="h-10 rounded-xl border border-input bg-white/50 backdrop-blur-sm px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all pr-10 shadow-sm"
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
            >
              <option value="">كل المستودعات</option>
              {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200/60 shadow-sm">
            {['today', 'week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${dateRange === range
                  ? 'bg-gradient-primary text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
                  }`}
              >
                {range === 'today' ? 'اليوم' : range === 'week' ? 'أسبوع' : 'شهر'}
              </button>
            ))}
          </div>

          <Button onClick={handleExportPdf} variant="outline" className="flex items-center gap-2 btn-glow backdrop-blur-sm bg-white/50">
            <FileText size={18} />
            تصدير PDF
          </Button>

          {/* Save Filter Button */}
          <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} className="gap-2">
            <Save size={16} />
            حفظ الفلتر
          </Button>

          {/* Saved Filters Dropdown */}
          {savedViews.length > 0 && (
            <div className="relative group">
              <Button variant="outline" size="sm" className="gap-2">
                <Bookmark size={16} />
                الفلاتر المحفوظة ({savedViews.length})
              </Button>
              <div className="absolute left-0 top-full mt-2 w-64 bg-white border shadow-lg rounded-lg z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="p-2 max-h-64 overflow-y-auto">
                  {savedViews.map(view => (
                    <div key={view._id} className="flex items-center justify-between p-2 hover:bg-muted rounded gap-2">
                      <button
                        onClick={() => applySavedView(view)}
                        className="flex-1 text-right text-sm truncate hover:text-primary"
                      >
                        {view.name}
                      </button>
                      <button
                        onClick={() => deleteSavedView(view._id)}
                        className="p-1 hover:bg-destructive-light hover:text-destructive rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-bold">حفظ الفلتر</h3>
              <button onClick={() => setShowSaveDialog(false)} className="p-2 hover:bg-muted rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium mb-2">اسم الفلتر</label>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="مثال: فلتر ديسمبر"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && saveCurrentFilter()}
                autoFocus
              />
            </div>
            <div className="flex gap-3 p-6 border-t justify-end">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>إلغاء</Button>
              <Button onClick={saveCurrentFilter}>حفظ</Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid - V2.0: Financial Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Revenue (Gross Sales) - Blue */}
        <StatCard
          title="إجمالي المبيعات"
          value={formatCurrency(kpis.salesTotal || 0)}
          icon={DollarSign}
          iconColor="text-primary"
          trend={trends.salesTotal}
          loading={loading}
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            let from = today;
            if (dateRange === 'week') {
              from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            } else if (dateRange === 'month') {
              from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            }
            setModalFilters({ from, to: today, warehouseId: warehouseFilter });
            setModalTab('invoices');
            setIsModalOpen(true);
          }}
        />
        {/* 2. Total Returns - Red/Orange */}
        <StatCard
          title="المرتجعات"
          value={formatCurrency(kpis.returnsTotal || 0)}
          icon={RotateCcw}
          iconColor="text-destructive"
          loading={loading}
        />
        {/* 3. Net Sales (Revenue - Returns) - Green */}
        <StatCard
          title="صافي المبيعات"
          value={formatCurrency(kpis.netSales || 0)}
          icon={TrendingUp}
          iconColor="text-success"
          loading={loading}
        />
        {/* 4. Gross Profit - Purple */}
        <StatCard
          title="إجمالي الربح"
          value={formatCurrency(kpis.grossProfit || 0)}
          icon={DollarSign}
          iconColor="text-violet-600"
          loading={loading}
        />
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold">تنبيهات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.map((alert) => {
              const severityConfig = {
                high: { bg: 'bg-destructive-light', text: 'text-destructive', icon: AlertTriangle },
                medium: { bg: 'bg-warning-light', text: 'text-warning', icon: AlertTriangle },
                low: { bg: 'bg-info-light', text: 'text-info', icon: AlertTriangle }
              };
              const config = severityConfig[alert.severity] || severityConfig.medium;
              const Icon = config.icon;

              return (
                <Card key={alert.id} className={`${config.bg} border-none`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${config.text}`}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-bold ${config.text} mb-1`}>{alert.title}</h3>
                        <p className="text-sm text-foreground/80 mb-3">{alert.message}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const today = new Date().toISOString().split('T')[0];
                            let from = today;
                            if (dateRange === 'week') {
                              from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                            } else if (dateRange === 'month') {
                              from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                            }
                            setModalFilters({ from, to: today, warehouseId: warehouseFilter });
                            setModalTab(alert.action.tab);
                            setIsModalOpen(true);
                          }}
                          className="gap-1"
                        >
                          عرض التفاصيل <ArrowRight size={14} className="rotate-180" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Sales vs Returns Chart (2 Cols) - V2.0 Dual-Line */}
        <Card variant="premium" className="xl:col-span-2 border-none ring-1 ring-white/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">تحليل المبيعات والمرتجعات</CardTitle>
              <p className="text-sm text-muted-foreground">مقارنة أداء المبيعات والمرتجعات</p>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary animate-pulse-ring">
              <TrendingUp size={22} />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div ref={salesByDayRef} className="rounded-xl overflow-hidden">
              <div className="w-full" style={{ height: 380, minHeight: 380 }} dir="ltr">
                {chartsReady && salesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={380} minWidth={0}>
                    <ComposedChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="tooltip-modern">
                                <p className="font-bold border-b border-white/10 pb-1 mb-1">{label}</p>
                                {payload.map((pld, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs py-0.5">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color }}></span>
                                    <span className="opacity-90">{pld.name === 'sales' ? 'المبيعات' : 'المرتجعات'}:</span>
                                    <span className="font-bold font-mono">{Number(pld.value).toLocaleString()} د.ل</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => value === 'sales' ? 'المبيعات' : 'المرتجعات'}
                      />
                      {/* Sales Line - Green */}
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6, fill: '#10b981' }}
                        name="sales"
                      />
                      {/* Returns Line - Red */}
                      <Line
                        type="monotone"
                        dataKey="returns"
                        stroke="#ef4444"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: '#ef4444', r: 3 }}
                        activeDot={{ r: 5, fill: '#ef4444' }}
                        name="returns"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : loading || !chartsReady ? (
                  <div className="flex items-center justify-center h-full">
                    <SkeletonLoader rows={6} columns={1} type="card" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp size={48} className="mx-auto mb-2 opacity-30" />
                      <p>لا توجد بيانات مبيعات لهذه الفترة</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Category Chart (1 Col) */}
        <div className="flex flex-col gap-6">

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <QuickActionBtn
              icon={ShoppingCart}
              label="نقطة بيع"
              onClick={() => navigate('/pos')}
              className="bg-gradient-to-br from-primary to-primary-600 text-white border-none shadow-lg hover:shadow-primary/25"
            />
            <QuickActionBtn
              icon={FileText}
              label="فاتورة"
              onClick={() => navigate('/sales-invoices/new')}
              className="bg-white hover:bg-slate-50 text-slate-700 border-none shadow-sm hover:shadow-md"
            />
            <QuickActionBtn
              icon={CreditCard}
              label="شراء"
              onClick={() => navigate('/purchase-orders')}
              className="bg-white hover:bg-slate-50 text-slate-700 border-none shadow-sm hover:shadow-md"
            />
            <QuickActionBtn
              icon={Users}
              label="عميل"
              onClick={() => navigate('/customers')}
              className="bg-white hover:bg-slate-50 text-slate-700 border-none shadow-sm hover:shadow-md"
            />
          </div>

          {/* Category Chart */}
          <Card variant="premium" className="flex-1 border-none ring-1 ring-white/20">
            <CardHeader className="border-b border-white/5 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package size={20} className="text-accent" />
                توزيع المبيعات
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div ref={categoryShareRef} className="rounded-xl relative">
                <div className="w-full" style={{ height: 320, minHeight: 320 }} dir="ltr">
                  {chartsReady && categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320} minWidth={0}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="45%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                          cornerRadius={6}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                              stroke="rgba(255,255,255,0.2)"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="tooltip-modern">
                                  <p className="font-bold border-b border-white/10 pb-1 mb-1 text-xs">{data.name}</p>
                                  <p className="font-mono font-bold text-sm">{Number(data.value).toLocaleString()} د.ل</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={60}
                          iconType="circle"
                          iconSize={8}
                          formatter={(value, entry) => (
                            <span className="text-xs font-semibold text-slate-600 ms-1">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : loading || !chartsReady ? (
                    <div className="flex items-center justify-center h-full">
                      <SkeletonLoader rows={3} columns={1} type="card" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Package size={48} className="mx-auto mb-2 opacity-30" />
                        <p>لا توجد بيانات توزيع</p>
                        <p className="text-xs mt-1 opacity-70">قم بإضافة مبيعات لرؤية التوزيع</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Recent, Low Stock & Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock size={20} className="text-primary" />
              أحدث الفواتير
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/sales-invoices')} className="gap-1">
              عرض الكل <ArrowRight size={16} className="rotate-180" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {recentInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد فواتير حديثة</div>
              ) : (
                recentInvoices.map((inv) => (
                  <div key={inv._id || inv.number} className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors border border-transparent hover:border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center font-bold text-xs">
                        #{inv.number || inv._id?.slice(-4)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{inv.customer?.name || 'عميل نقدي'}</p>
                        <p className="text-xs text-muted-foreground">{new Date(inv.date).toLocaleDateString('ar-LY')}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold">{formatCurrency(inv.totals?.grand || 0)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'posted' ? 'bg-success-light' : 'bg-warning-light'
                        }`}>
                        {inv.status === 'posted' ? 'مرحل' : 'مسودة'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-warning" />
              تنبيهات المخزون ({kpis.lowStockCount || 0})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/stock-balances')} className="gap-1">
              إدارة المخزون <ArrowRight size={16} className="rotate-180" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="table-container">
              <table className="table">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-right">الصنف</th>
                    <th className="text-center">الحالي</th>
                    <th className="text-center">الحد الأدنى</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">المخزون في حالة ممتازة</td></tr>
                  ) : (
                    lowStockItems.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground">
                              <Package size={14} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-center">
                          <span className="text-destructive font-bold bg-destructive-light px-2 py-1 rounded text-xs">
                            {item.totalStock}
                          </span>
                        </td>
                        <td className="text-center text-xs text-muted-foreground font-medium">
                          {item.minStock || 5}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Financial Alerts Card - NEW in bottom grid */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-warning" />
              تنبيهات مالية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                  <p>لا توجد تنبيهات حالياً</p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const severityConfig = {
                    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' },
                    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
                    low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' }
                  };
                  const config = severityConfig[alert.severity] || severityConfig.medium;

                  return (
                    <div key={alert.id} className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${config.bg}`}>
                          <AlertTriangle size={18} className={config.icon} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-sm ${config.text} mb-1`}>{alert.title}</h4>
                          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{alert.message}</p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const today = new Date().toISOString().split('T')[0];
                              let from = today;
                              if (dateRange === 'week') {
                                from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                              } else if (dateRange === 'month') {
                                from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                              }
                              setModalFilters({ from, to: today, warehouseId: warehouseFilter });
                              setModalTab(alert.action?.tab || 'invoices');
                              setIsModalOpen(true);
                            }}
                            className="h-7 text-xs gap-1 px-2"
                          >
                            عرض التفاصيل <ArrowRight size={12} className="rotate-180" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Drill-down Modal */}
      <DrillDownModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialTab={modalTab}
        filters={modalFilters}
      />
    </div>
  )
}

// Sub-components
function StatCard({ title, value, icon: Icon, iconColor, trend, loading, onClick }) {
  const trendValue = trend !== null && trend !== undefined ? Number(trend) : null
  const showTrend = trendValue !== null && !isNaN(trendValue)
  const isNew = trend === null

  return (
    <Card
      onClick={onClick}
      className={`stat-card ${onClick ? 'cursor-pointer' : ''}`}
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 ${iconColor}`}>
            <Icon size={24} className="animate-float" />
          </div>
          {isNew ? (
            <span className="flex items-center text-xs font-bold px-2 py-1 rounded-full bg-gradient-primary text-white">
              جديد
            </span>
          ) : showTrend ? (
            <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${trendValue > 0 ? 'bg-success-light text-success' : trendValue < 0 ? 'bg-destructive-light text-destructive' : 'bg-muted'}`}>
              {trendValue > 0 ? <TrendingUp size={12} className="me-1" /> : trendValue < 0 ? <TrendingDown size={12} className="me-1" /> : null}
              {trendValue > 0 ? '↑' : trendValue < 0 ? '↓' : ''}
              {Math.abs(trendValue).toFixed(1)}٪
            </span>
          ) : null}
        </div>
        <div>
          <h3 className="text-2xl font-bold tracking-tight number-display">
            {loading ? <span className="shimmer h-8 w-24 block rounded"></span> : value}
          </h3>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickActionBtn({ icon: Icon, label, onClick, className }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={`h-auto flex-col gap-2 p-4 btn-glow ${className}`}
    >
      <Icon size={24} />
      <span className="text-xs font-bold">{label}</span>
    </Button>
  )
}
