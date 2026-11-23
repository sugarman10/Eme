import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Search, X, TrendingUp, TrendingDown, ArrowUpRight,
  ArrowDownLeft, ArrowRightLeft, ShoppingBag, ShoppingCart, Package, Building2,
  Calendar, Layers, Printer, RefreshCw, AlertCircle, CheckCircle2,
  Tag, Barcode, DollarSign, Store, Clock, ExternalLink
} from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

function fmt(n) {
  return Number(n || 0).toLocaleString('ar-LY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export default function ItemHistoryModal({
  isOpen,
  onClose,
  itemId,
  initialItem = null
}) {
  const { me } = useAuth()
  const isAdmin = me?.role === 'admin'
  const { push } = useToast()
  const [selectedItemId, setSelectedItemId] = useState(itemId || initialItem?._id || '')
  const [activeTab, setActiveTab] = useState(isAdmin ? 'purchases' : 'sales') // 'purchases' | 'sales' | 'movements' | 'warehouses'
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  // In-modal quick search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showSearchDrop, setShowSearchDrop] = useState(false)
  const searchInputRef = useRef(null)

  // Sync prop changes
  useEffect(() => {
    if (itemId) {
      setSelectedItemId(itemId)
    } else if (initialItem?._id) {
      setSelectedItemId(initialItem._id)
    }
  }, [itemId, initialItem])

  // Fetch Item History
  useEffect(() => {
    if (!isOpen || !selectedItemId) {
      setData(null)
      return
    }

    const fetchHistory = async () => {
      try {
        setLoading(true)
        const res = await api.get(`/inventory/items/${selectedItemId}/history`)
        setData(res.data)
      } catch (err) {
        console.error('Failed to load item history', err)
        push('error', err?.response?.data?.message || 'فشل تحميل سجل الصنف')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [isOpen, selectedItemId])

  // In-modal search autocomplete
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q || q.length < 2) {
      setSearchResults([])
      setShowSearchDrop(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true)
        const res = await api.get(`/inventory/items?q=${encodeURIComponent(q)}&limit=8`)
        const items = res.data?.items || res.data || []
        setSearchResults(items)
        setShowSearchDrop(items.length > 0)
      } catch (err) {
        console.error(err)
      } finally {
        setSearching(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Global escape key to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Enforce tab security for non-admin
  useEffect(() => {
    if (!isAdmin && activeTab === 'purchases') {
      setActiveTab('sales')
    }
  }, [isAdmin, activeTab])

  if (!isOpen) return null

  const item = data?.item || initialItem || {}
  const stats = data?.stats || {}
  const purchases = data?.purchases || []
  const sales = data?.sales || []
  const movements = data?.movements || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-sans"
        dir="rtl"
      >
        {/* ── Top Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300 flex items-center justify-center">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  سجل وحركة الصنف: {item.name || 'جاري التحميل...'}
                </h2>
                {item.sku && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
                    {item.sku}
                  </span>
                )}
                {item.isBundle && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700 font-bold">
                    تجميعة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAdmin
                  ? 'تاريخ المشتريات والمبيعات وحركات المخزون مع تحليل فروق التكلفة والأرباح'
                  : 'تاريخ مبيعات الصنف وحركات المخزون والرصيد الحالي'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Switch Item Search */}
            <div className="relative w-72">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث أو امسح صنف آخر..."
                className="w-full pr-8 pl-3 py-1.5 text-xs rounded-lg bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 focus:outline-hidden focus:border-purple-500 focus:bg-slate-800"
              />
              {showSearchDrop && searchResults.length > 0 && (
                <div className="absolute top-full right-0 left-0 mt-1 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                  <div className="p-1.5 max-h-56 overflow-y-auto">
                    {searchResults.map(p => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => {
                          setSelectedItemId(p._id)
                          setSearchQuery('')
                          setShowSearchDrop(false)
                        }}
                        className="w-full text-right px-3 py-2 text-xs rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-between gap-2 border-b border-slate-100 last:border-0"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{p.sku} | {p.barcode || 'بدون باركود'}</div>
                        </div>
                        <div className="text-left font-mono font-bold text-purple-700">
                          {fmt(p.price)} د.ل
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="طباعة السجل"
            >
              <Printer size={18} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
              title="إغلاق [Esc]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── KPI Summary Strip ──────────────────────────────────────── */}
        <div className={`grid ${isAdmin ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'} gap-3 p-4 bg-slate-50 border-b border-slate-200 shrink-0`}>
          {/* Card 1: Current Stock */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>الرصيد بالمخزن</span>
              <Package size={15} className="text-blue-500" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900">
                {stats.currentStock ?? item.totalStock ?? 0}
              </span>
              <span className="text-xs text-slate-500">{item.unit || 'قطعة'}</span>
            </div>
            {isAdmin && (
              <div className="text-[11px] text-slate-500 mt-1 font-mono">
                القيمة بالتكلفة: <strong className="text-slate-800">{fmt(stats.currentStockValue)}</strong> د.ل
              </div>
            )}
          </div>

          {/* Card 2: Cost Analysis (Admin Only) */}
          {isAdmin && (
            <div className="bg-white p-3.5 rounded-xl border border-purple-100 bg-purple-50/20 shadow-xs">
              <div className="flex items-center justify-between text-xs text-purple-700 font-medium">
                <span>متوسط التكلفة الحالي</span>
                <Tag size={15} className="text-purple-600" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-purple-900">
                  {fmt(item.cost)}
                </span>
                <span className="text-xs text-purple-700 font-medium">د.ل</span>
                {item.costUSD > 0 && (
                  <span className="text-xs text-emerald-700 font-bold font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    (${Number(item.costUSD).toFixed(2)})
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                <span>أدنى شراء: <strong className="font-mono text-emerald-700">{fmt(stats.lowestPurchaseCost)}</strong></span>
                <span>أعلى: <strong className="font-mono text-red-700">{fmt(stats.highestPurchaseCost)}</strong></span>
              </div>
            </div>
          )}

          {/* Card 3: Last Purchase (Admin Only) */}
          {isAdmin && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>آخر شراء تم توريده</span>
                <ShoppingBag size={15} className="text-amber-500" />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-slate-900">
                  {fmt(stats.lastPurchaseCost)}
                </span>
                <span className="text-xs text-slate-500">د.ل</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 truncate">
                {stats.lastSupplierName ? (
                  <span>من: <strong>{stats.lastSupplierName}</strong></span>
                ) : 'لا توجد مشتريات سابقة'}
              </div>
            </div>
          )}

          {/* Card 4: Selling & Profit */}
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-xs">
            <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
              <span>سعر البيع{isAdmin ? ' وهامش الربح' : ''}</span>
              <TrendingUp size={15} className="text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-900">
                {fmt(item.price)}
              </span>
              <span className="text-xs text-emerald-700 font-medium">د.ل</span>
            </div>
            {isAdmin ? (
              <div className="text-[10px] text-slate-600 mt-1 flex items-center justify-between">
                <span>الربح التقديري: <strong className="text-emerald-700 font-mono">+{fmt(stats.unitMargin)}</strong> د.ل</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded font-mono">
                  {stats.unitMarginPct}%
                </span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 mt-1">
                السعر المعتمد للبيع المباشر
              </div>
            )}
          </div>
        </div>

        {/* ── Navigation Tabs ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('purchases')}
                className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'purchases'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShoppingBag size={15} />
                سجل المشتريات والتكلفة ({purchases.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sales'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShoppingCart size={15} />
              {isAdmin ? `سجل المبيعات والأرباح (${sales.length})` : `سجل المبيعات (${sales.length})`}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('movements')}
              className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'movements'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers size={15} />
              حركة المخزون الشاملة ({movements.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('warehouses')}
              className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'warehouses'
                  ? 'border-slate-800 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Store size={15} />
              أرصدة المستودعات ({item.warehouses?.length || 0})
            </button>
          </div>

          <div className="text-xs text-slate-400 pb-3">
            اضغط <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[10px] font-mono text-slate-700">Esc</kbd> للإغلاق
          </div>
        </div>

        {/* ── Tab Content Area (Scrollable) ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={28} className="animate-spin text-purple-600" />
              <p className="text-sm font-medium">جاري استرجاع سجل وحركات الصنف...</p>
            </div>
          ) : (
            <>
              {/* ── TAB 1: PURCHASES ─────────────────────────────────── */}
              {activeTab === 'purchases' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>
                      إجمالي المشتريات: <strong className="font-mono text-purple-800">{stats.totalPurchasedQty || 0}</strong> {item.unit || 'قطعة'} بقيمة <strong className="font-mono text-purple-800">{fmt(stats.totalPurchasedAmount)}</strong> د.ل
                    </span>
                    <span className="text-slate-400">
                      * يوضح العمود الأخير فارق سعر شراء كل فاتورة مقارنة بمتوسط التكلفة الحالي ({fmt(item.cost)} د.ل)
                    </span>
                  </div>

                  {purchases.length === 0 ? (
                    <div className="py-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
                      لم يتم تسجيل أي فواتير أو أوامر شراء لهذا الصنف بعد.
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">رقم الفاتورة</th>
                            <th className="p-3">المورد</th>
                            <th className="p-3">المستودع</th>
                            <th className="p-3 text-center">الكمية</th>
                            <th className="p-3">سعر الشراء</th>
                            <th className="p-3">الإجمالي</th>
                            <th className="p-3 text-center">مقارنة التكلفة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchases.map(p => {
                            const isHigher = p.costDiff > 0.01
                            const isLower = p.costDiff < -0.01
                            return (
                              <tr key={p._id + p.orderNumber} className="hover:bg-slate-50/70 transition-colors">
                                <td className="p-3 font-mono text-slate-600">
                                  {new Date(p.date).toLocaleDateString('ar-LY')}
                                </td>
                                <td className="p-3 font-mono font-bold text-purple-800">
                                  {p.orderNumber}
                                </td>
                                <td className="p-3 font-medium text-slate-800">
                                  {p.supplierName}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {p.warehouseName}
                                </td>
                                <td className="p-3 font-mono font-bold text-center">
                                  {p.qty}
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-900">
                                  <div>{fmt(p.cost)} <span className="text-[10px] font-normal text-slate-500">د.ل</span></div>
                                  {p.costUSD > 0 && (
                                    <div className="text-[11px] font-semibold text-emerald-600 font-mono">
                                      ${Number(p.costUSD).toFixed(2)}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 font-mono text-slate-700">
                                  {fmt(p.total)} د.ل
                                </td>
                                <td className="p-3 text-center">
                                  {isHigher ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono">
                                      <TrendingUp size={12} />
                                      أعلى بـ {fmt(p.costDiff)} (+{p.costDiffPct}%)
                                    </span>
                                  ) : isLower ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                      <TrendingDown size={12} />
                                      أقل بـ {fmt(Math.abs(p.costDiff))} ({p.costDiffPct}%)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                      مطابق للمتوسط
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: SALES ─────────────────────────────────────── */}
              {activeTab === 'sales' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>
                      إجمالي المبيعات: <strong className="font-mono text-emerald-800">{stats.totalSoldQty || 0}</strong> {item.unit || 'قطعة'}
                      {isAdmin && (
                        <> بمبلغ <strong className="font-mono text-emerald-800">{fmt(stats.totalSalesAmount)}</strong> د.ل | إجمالي الربح المحقق: <strong className="font-mono text-emerald-700">+{fmt(stats.totalProfit)} د.ل</strong> ({stats.avgProfitMarginPct}%)</>
                      )}
                    </span>
                    {isAdmin && (
                      <span className="text-slate-400">
                        * يوضح الجدول سعر البيع الفعلي والتكلفة المسجلة والربح المحقق لكل فاتورة
                      </span>
                    )}
                  </div>

                  {sales.length === 0 ? (
                    <div className="py-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
                      لم يتم تسجيل أي عمليات بيع لهذا الصنف حتى الآن.
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">رقم الفاتورة</th>
                            <th className="p-3">العميل</th>
                            <th className="p-3 text-center">الكمية</th>
                            <th className="p-3">سعر البيع</th>
                            {isAdmin && <th className="p-3">التكلفة</th>}
                            <th className="p-3">الإجمالي</th>
                            {isAdmin && <th className="p-3 text-center">الربح المحقق</th>}
                            {isAdmin && <th className="p-3 text-center">هامش الربح</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sales.map(s => (
                            <tr key={s._id + s.invoiceNumber} className="hover:bg-slate-50/70 transition-colors">
                              <td className="p-3 font-mono text-slate-600">
                                {new Date(s.date).toLocaleDateString('ar-LY')}
                              </td>
                              <td className="p-3 font-mono font-bold text-blue-700">
                                {s.invoiceNumber}
                              </td>
                              <td className="p-3 font-medium text-slate-800">
                                {s.customerName}
                              </td>
                              <td className="p-3 font-mono font-bold text-center">
                                {s.qty}
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-900">
                                {fmt(s.price)} د.ل
                              </td>
                              {isAdmin && (
                                <td className="p-3 font-mono text-slate-500">
                                  {fmt(s.cost)} د.ل
                                </td>
                              )}
                              <td className="p-3 font-mono font-bold text-slate-800">
                                {fmt(s.total)} د.ل
                              </td>
                              {isAdmin && (
                                <td className="p-3 font-mono font-bold text-center text-emerald-700">
                                  +{fmt(s.profit)} د.ل
                                </td>
                              )}
                              {isAdmin && (
                                <td className="p-3 text-center">
                                  <span className={`inline-block font-mono font-bold text-[11px] px-2 py-0.5 rounded-full ${
                                    s.profitMarginPct >= 20
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : s.profitMarginPct > 0
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-red-50 text-red-800 border border-red-200'
                                  }`}>
                                    {s.profitMarginPct}%
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: MOVEMENTS ─────────────────────────────────── */}
              {activeTab === 'movements' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500">
                    سجل حركات المخزن التفصيلية (توريد، إخراج، بيع، شراء، مردودات، تسويات جردية) من دفتر أستاذ المخزون
                  </div>

                  {movements.length === 0 ? (
                    <div className="py-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
                      لا توجد حركات مخزنية مسجلة لهذا الصنف.
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">التاريخ والوقت</th>
                            <th className="p-3">نوع الحركة</th>
                            <th className="p-3">المستودع</th>
                            <th className="p-3 text-center">الكمية</th>
                            <th className="p-3">المرجع</th>
                            <th className="p-3">الملاحظات</th>
                            <th className="p-3">المستخدم</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {movements.map(m => {
                            const isPositive = m.qty > 0
                            return (
                              <tr key={m._id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="p-3 font-mono text-slate-600">
                                  {new Date(m.date).toLocaleString('ar-LY')}
                                </td>
                                <td className="p-3 font-medium">
                                  {m.type === 'MOVE' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      <ArrowRightLeft size={12} className="text-indigo-600" />
                                      تحويل مخزني {isPositive ? '(وارد)' : '(صادر)'}
                                    </span>
                                  ) : (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                      m.type === 'IN' || m.type === 'PURCHASE'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : m.type === 'OUT' || m.type === 'SALE'
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : m.type === 'PURCHASE_RETURN' || m.type === 'SALES_RETURN'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {m.type === 'PURCHASE' ? 'فاتورة مشتريات' :
                                       m.type === 'SALE' ? 'فاتورة مبيعات' :
                                       m.type === 'IN' ? 'إدخال مخزني' :
                                       m.type === 'OUT' ? 'صرف مخزني' :
                                       m.type === 'SALES_RETURN' ? 'مرتجع مبيعات' :
                                       m.type === 'PURCHASE_RETURN' ? 'مرتجع مشتريات' :
                                       m.type}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-700 font-medium">
                                  {m.warehouseName || 'المستودع الرئيسي'}
                                </td>
                                <td className="p-3 font-mono font-bold text-center">
                                  <span className={isPositive ? 'text-emerald-700' : 'text-rose-600'}>
                                    {isPositive ? `+${m.qty}` : m.qty}
                                  </span>
                                </td>
                                <td className="p-3 font-mono">
                                  {m.ref?.startsWith('TRF-') ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[11px]">
                                      {m.ref}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">{m.ref || '-'}</span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-500">
                                  {m.note || '-'}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {m.userName || '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 4: WAREHOUSES ───────────────────────────────── */}
              {activeTab === 'warehouses' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500">
                    توزيع الرصيد الحالي المتوفر للصنف عبر مختلف المستودعات والفروع
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(item.warehouses || []).map(w => (
                      <div key={w.warehouseId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-800">{w.warehouseName}</span>
                          <Building2 size={16} className="text-slate-400" />
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-2xl font-black font-mono text-blue-700">
                            {w.qty}
                          </span>
                          <span className="text-xs text-slate-500">{item.unit || 'قطعة'}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-2 font-mono">
                          القيمة: {fmt(w.qty * (item.cost || 0))} د.ل
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
            {item.barcode && <span>الباركود: <strong>{item.barcode}</strong></span>}
            {item.category && <span>التصنيف: <strong>{typeof item.category === 'object' ? item.category?.name : item.category}</strong></span>}
          </div>

          <Button variant="outline" onClick={onClose} className="px-5">
            إغلاق النافذة
          </Button>
        </div>
      </div>
    </div>
  )
}
