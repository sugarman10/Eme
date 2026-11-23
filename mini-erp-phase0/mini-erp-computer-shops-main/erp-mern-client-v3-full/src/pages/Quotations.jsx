import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileText, Plus, Search, Printer, Trash2, CheckCircle2, ArrowRight,
  Clock, AlertCircle, ShoppingCart, RefreshCw, X, Calendar, Warehouse,
  DollarSign, User, ShieldCheck, Layers, FileSpreadsheet, Eye, AlertTriangle,
  RotateCcw, Edit, Undo2
} from 'lucide-react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useSettings } from '../context/SettingsContext'
import { useWarehouse } from '../context/WarehouseContext'
import { formatCurrency } from '../lib/utils'

export default function Quotations() {
  const { push } = useToast()
  const { settings } = useSettings()
  const { activeWarehouse } = useWarehouse() || {}

  // Data lists
  const [quotations, setQuotations] = useState([])
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [treasuries, setTreasuries] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, active, converted
  const [dateFilter, setDateFilter] = useState('')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedQuotation, setSelectedQuotation] = useState(null)
  const [showRevertModal, setShowRevertModal] = useState(false)
  const [revertingQuotation, setRevertingQuotation] = useState(null)
  const [reverting, setReverting] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printQuotationData, setPrintQuotationData] = useState(null)
  const [converting, setConverting] = useState(false)

  // Convert Form State
  const [convertWarehouse, setConvertWarehouse] = useState('')
  const [convertPaymentMethod, setConvertPaymentMethod] = useState('cash')
  const [convertTreasury, setConvertTreasury] = useState('')
  const [convertPaidAmount, setConvertPaidAmount] = useState(0)

  // Exchange rate from settings or default
  const usdExchangeRate = Number(settings?.usdExchangeRate) || 7.30

  // Load all initial data
  const loadData = async () => {
    setLoading(true)
    try {
      const [quotesRes, custRes, itemsRes, whRes, trRes] = await Promise.all([
        api.get('/sales/invoice?type=proforma&limit=2000'),
        api.get('/customers').catch(() => ({ data: [] })),
        api.get('/inventory/items').catch(() => ({ data: { items: [] } })),
        api.get('/inventory/warehouses').catch(() => ({ data: [] })),
        api.get('/treasuries').catch(() => ({ data: [] })),
      ])

      const quotesData = quotesRes.data?.docs || quotesRes.data || []
      setQuotations(Array.isArray(quotesData) ? quotesData : [])
      setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data?.customers || [])
      setItems(itemsRes.data?.items || (Array.isArray(itemsRes.data) ? itemsRes.data : []))
      setWarehouses(Array.isArray(whRes.data) ? whRes.data : [])
      setTreasuries(Array.isArray(trRes.data) ? trRes.data : trRes.data?.treasuries || [])
    } catch (err) {
      console.error('Failed to load quotations data:', err)
      push('error', 'فشل تحميل بيانات عروض الأسعار')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchesSearch =
        !searchQuery ||
        q.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.note?.toLowerCase().includes(searchQuery.toLowerCase())

      const isConverted = q.isConverted || q.status === 'converted'
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'converted' && isConverted) ||
        (statusFilter === 'active' && !isConverted)

      const matchesDate =
        !dateFilter ||
        (q.date && q.date.startsWith(dateFilter))

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [quotations, searchQuery, statusFilter, dateFilter])

  // KPIs
  const stats = useMemo(() => {
    const total = quotations.length
    const converted = quotations.filter((q) => q.isConverted || q.status === 'converted').length
    const active = total - converted
    const activeValue = quotations
      .filter((q) => !q.isConverted && q.status !== 'converted')
      .reduce((sum, q) => sum + (q.totals?.grand || 0), 0)

    return { total, active, converted, activeValue }
  }, [quotations])

  // Handle Open Create / Edit Modal
  const handleOpenCreate = () => {
    setEditingQuotation(null)
    setShowCreateModal(true)
  }

  const handleOpenEdit = (quote) => {
    setEditingQuotation(quote)
    setShowCreateModal(true)
  }

  // Handle Open Convert Modal
  const handleOpenConvert = (quote) => {
    setSelectedQuotation(quote)
    setConvertWarehouse(quote.warehouse?._id || quote.warehouse || activeWarehouse?._id || (warehouses[0]?._id || ''))
    setConvertPaymentMethod('cash')
    setConvertTreasury(treasuries[0]?._id || '')
    setConvertPaidAmount(quote.totals?.grand || 0)
    setShowConvertModal(true)
  }

  // Handle Confirm Convert
  const handleConfirmConvert = async () => {
    if (!selectedQuotation) return
    if (!convertWarehouse) {
      push('error', 'يرجى اختيار المستودع لخصم البضاعة')
      return
    }
    if (convertPaymentMethod !== 'credit' && !convertTreasury) {
      push('error', 'يرجى اختيار الخزينة لاستلام المبلغ')
      return
    }

    setConverting(true)
    try {
      const res = await api.post(`/sales/proforma/${selectedQuotation._id}/convert`, {
        warehouse: convertWarehouse,
        paymentMethod: convertPaymentMethod,
        treasury: convertPaymentMethod !== 'credit' ? convertTreasury : undefined,
        paid: convertPaymentMethod === 'credit' ? 0 : Number(convertPaidAmount),
      })

      push('success', res.data?.message || 'تم تحويل عرض السعر إلى فاتورة مبيعات معتمدة بنجاح')
      setShowConvertModal(false)
      setSelectedQuotation(null)
      loadData()
    } catch (err) {
      console.error('Conversion error:', err)
      push('error', err.response?.data?.message || 'فشل تحويل عرض السعر')
    } finally {
      setConverting(false)
    }
  }

  // Handle Open Revert Modal
  const handleOpenRevert = (quote) => {
    setRevertingQuotation(quote)
    setShowRevertModal(true)
  }

  // Handle Confirm Revert Conversion
  const handleConfirmRevert = async () => {
    if (!revertingQuotation) return
    setReverting(true)
    try {
      const res = await api.post(`/sales/proforma/${revertingQuotation._id}/revert`)
      push('success', res.data?.message || 'تم التراجع عن التنزيل وإلغاء الفاتورة وإعادة فتح عرض السعر للتعديل بنجاح')
      setShowRevertModal(false)
      setRevertingQuotation(null)
      loadData()
    } catch (err) {
      console.error('Revert error:', err)
      push('error', err.response?.data?.message || 'فشل التراجع عن التنزيل')
    } finally {
      setReverting(false)
    }
  }

  // Handle Delete Quotation
  const handleDeleteQuotation = async (quote) => {
    if (quote.isConverted || quote.status === 'converted') {
      push('error', 'لا يمكن حذف عرض سعر تم تحويله إلى فاتورة مبيعات معتمدة. يمكنك التراجع عن التنزيل أولاً.')
      return
    }

    if (!window.confirm(`هل أنت متأكد من حذف عرض السعر رقم ${quote.number || quote._id}؟`)) {
      return
    }

    try {
      await api.delete(`/sales/proforma/${quote._id}`)
      push('success', 'تم حذف عرض السعر بنجاح')
      setQuotations((prev) => prev.filter((q) => q._id !== quote._id))
    } catch (err) {
      console.error('Delete quotation error:', err)
      push('error', err.response?.data?.message || 'فشل حذف عرض السعر')
    }
  }

  // Handle Print Quotation
  const handlePrint = (quote) => {
    setPrintQuotationData(quote)
    setShowPrintModal(true)
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto min-h-screen text-slate-800 dark:text-slate-100">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <FileSpreadsheet size={26} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              عروض الأسعار وفواتير العرض
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                مستقلة وقابلة للتعديل والتراجع
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              إصدار وتعديل عروض الأسعار، وتنزيلها كفواتير مبيعات معتمدة، مع إمكانية التراجع وإعادة الفتح للتعديل في أي وقت
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus size={18} />
            <span>إنشاء عرض سعر جديد</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <FileText size={22} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-bold">إجمالي عروض الأسعار</div>
            <div className="text-xl font-black text-slate-800 dark:text-slate-100 font-mono">{stats.total}</div>
          </div>
        </div>

        {/* Card 2: Active */}
        <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock size={22} />
          </div>
          <div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-bold">عروض سارية (نشطة)</div>
            <div className="text-xl font-black text-amber-700 dark:text-amber-300 font-mono">{stats.active}</div>
          </div>
        </div>

        {/* Card 3: Converted */}
        <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">محولة لمبيعات مؤكدة</div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{stats.converted}</div>
          </div>
        </div>

        {/* Card 4: Value */}
        <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="text-xs text-blue-600 dark:text-blue-400 font-bold">قيمة العروض السارية</div>
            <div className="text-lg font-black text-blue-700 dark:text-blue-300 font-mono">
              {formatCurrency(stats.activeValue)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم العرض، اسم العميل، أو الملاحظات..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              سارية
            </button>
            <button
              onClick={() => setStatusFilter('converted')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'converted'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              محولة لمبيعات
            </button>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="مسح التاريخ"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Quotations Table */}
      <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">
                <th className="py-3 px-4">رقم العرض</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">العميل</th>
                <th className="py-3 px-4">المستودع المرجعي</th>
                <th className="py-3 px-4 text-center">عدد الأصناف</th>
                <th className="py-3 px-4">إجمالي العرض</th>
                <th className="py-3 px-4 text-center">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
                    جاري تحميل عروض الأسعار...
                  </td>
                </tr>
              ) : filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <FileSpreadsheet size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    لا توجد عروض أسعار مطابقة لخيارات البحث
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((q) => {
                  const isConverted = q.isConverted || q.status === 'converted'
                  const quoteDate = q.date ? new Date(q.date).toLocaleDateString('ar-LY') : '-'
                  const itemsCount = q.items?.length || 0
                  const grandTotal = q.totals?.grand || 0
                  const customerDisplay = q.customer?.name || q.customerName || 'عميل نقدي'

                  return (
                    <tr
                      key={q._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <FileText size={15} className="text-amber-500" />
                        {q.number || `QUO-${q._id.slice(-6)}`}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-xs font-mono">
                        {quoteDate}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-100">
                        {customerDisplay}
                        {q.customer?.phone && (
                          <span className="block text-[11px] text-slate-400 font-mono">
                            {q.customer.phone}
                          </span>
                        )}
                      </td>

                      {/* Warehouse */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {q.warehouse?.name || 'الكل / غير محدد'}
                      </td>

                      {/* Items Count */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs">
                          {itemsCount} أصناف
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div>{formatCurrency(grandTotal)}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isConverted ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 size={13} />
                              تم التحويل لمبيعات
                            </span>
                            {q.convertedInvoiceNumber && (
                              <span className="text-[10px] text-emerald-600 font-mono mt-0.5">
                                فاتورة #{q.convertedInvoiceNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Clock size={13} />
                            عرض ساري
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print / Preview */}
                          <button
                            onClick={() => handlePrint(q)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="معاينة وطباعة عرض السعر"
                          >
                            <Printer size={16} />
                          </button>

                          {/* If ACTIVE: Edit + Convert + Delete */}
                          {!isConverted ? (
                            <>
                              {/* Edit Quotation Button */}
                              <button
                                onClick={() => handleOpenEdit(q)}
                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                                title="تعديل عرض السعر"
                              >
                                <Edit size={16} />
                              </button>

                              {/* Convert to Sales Invoice Button */}
                              <button
                                onClick={() => handleOpenConvert(q)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-colors cursor-pointer"
                                title="تحويل وتنزيل كفاتورة مبيعات معتمدة"
                              >
                                <ShoppingCart size={14} />
                                <span>تنزيل لمبيعات</span>
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDeleteQuotation(q)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title="حذف عرض السعر"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            /* If CONVERTED: Option to REVERT / REOPEN for modifications */
                            <button
                              onClick={() => handleOpenRevert(q)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs transition-colors cursor-pointer"
                              title="إلغاء التنزيل وإرجاع الفاتورة لإعادة فتح وتعديل عرض السعر"
                            >
                              <RotateCcw size={13} />
                              <span>تراجع عن التنزيل</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. CREATE / EDIT QUOTATION MODAL */}
      {/* ======================================================== */}
      {showCreateModal && (
        <CreateQuotationModal
          initialData={editingQuotation}
          onClose={() => {
            setShowCreateModal(false)
            setEditingQuotation(null)
          }}
          onSuccess={() => {
            setShowCreateModal(false)
            setEditingQuotation(null)
            loadData()
          }}
          customers={customers}
          items={items}
          warehouses={warehouses}
          defaultWarehouseId={activeWarehouse?._id || warehouses[0]?._id}
          usdExchangeRate={usdExchangeRate}
        />
      )}

      {/* ======================================================== */}
      {/* 6. CONVERT QUOTATION TO OFFICIAL SALES INVOICE MODAL */}
      {/* ======================================================== */}
      {showConvertModal && selectedQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                <ShoppingCart size={22} className="text-emerald-600" />
                <h3 className="font-bold text-base">تنزيل عرض السعر كفاتورة مبيعات معتمدة</h3>
              </div>
              <button
                onClick={() => setShowConvertModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-bold block">رقم العرض</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    {selectedQuotation.number || `QUO-${selectedQuotation._id.slice(-6)}`}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold block">العميل</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {selectedQuotation.customer?.name || selectedQuotation.customerName || 'عميل نقدي'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-bold block">إجمالي القيمة</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedQuotation.totals?.grand || 0)}
                  </span>
                </div>
              </div>

              {/* Warehouse selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  المستودع لخصم البضاعة منه <span className="text-rose-500">*</span>
                </label>
                <select
                  value={convertWarehouse}
                  onChange={(e) => setConvertWarehouse(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">اختر المستودع...</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} {w.code ? `(${w.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  طريقة السداد <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'نقدي' },
                    { id: 'card', label: 'بطاقة' },
                    { id: 'bank', label: 'حوالة' },
                    { id: 'credit', label: 'آجل' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setConvertPaymentMethod(m.id)
                        if (m.id === 'credit') {
                          setConvertPaidAmount(0)
                        } else {
                          setConvertPaidAmount(selectedQuotation.totals?.grand || 0)
                        }
                      }}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        convertPaymentMethod === m.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Treasury Selector (if not credit) */}
              {convertPaymentMethod !== 'credit' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    الخزينة المستهدفة لإيداع المبلغ <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={convertTreasury}
                    onChange={(e) => setConvertTreasury(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">اختر الخزينة...</option>
                    {treasuries.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Paid Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  المبلغ المدفوع (د.ل)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={convertPaidAmount}
                  onChange={(e) => setConvertPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>
                  عند التأكيد، سيتم خصم كميات الأصناف من المستودع المحدد، وتسجيل الدفعة المالية بالخزينة، وترحيل القيد المحاسبي المزدوج فورياً. (يمكن التراجع عن التنزيل لاحقاً في أي وقت).
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                disabled={converting}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {converting && <RefreshCw size={14} className="animate-spin" />}
                <span>تأكيد التنزيل وترحيل الفاتورة رسمياً</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. REVERT CONVERSION MODAL */}
      {/* ======================================================== */}
      {showRevertModal && revertingQuotation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <RotateCcw size={22} className="text-amber-600" />
                <h3 className="font-bold text-base">تراجع عن تنزيل الفاتورة وإعادة الفتح</h3>
              </div>
              <button
                onClick={() => setShowRevertModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                هل ترغب في إلغاء تنزيل عرض السعر{' '}
                <span className="font-bold font-mono text-amber-700 dark:text-amber-400">
                  {revertingQuotation.number || revertingQuotation._id}
                </span>{' '}
                وإرجاعه لحالة <span className="font-bold text-amber-600">عرض ساري</span>؟
              </p>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mb-1 text-amber-600">
                  <ShieldCheck size={15} />
                  ما سيقوم به النظام لضمان الدقة المحاسبية:
                </div>
                <div>1. إلغاء فاتورة المبيعات الرسمية المرتبطة وإعادة كميات الأصناف لمخزون المستودع.</div>
                <div>2. استرداد القيد المالي من الخزينة وتعديل رصيد العميل في حال البيع الآجل.</div>
                <div>3. إلغاء القيد اليومي المحاسبي للمبيعات وتكلفة البضاعة.</div>
                <div>4. إعادة فتح عرض السعر بالكامل لتتمكن من تعديل البنود والأسعار وإعادة تنزيله مجدداً.</div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setShowRevertModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                disabled={reverting}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {reverting && <RefreshCw size={14} className="animate-spin" />}
                <span>تأكيد التراجع وإعادة فتح العرض</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. PRINT QUOTATION MODAL */}
      {/* ======================================================== */}
      {showPrintModal && printQuotationData && (
        <PrintQuotationModal
          quotation={printQuotationData}
          onClose={() => {
            setShowPrintModal(false)
            setPrintQuotationData(null)
          }}
          settings={settings}
        />
      )}
    </div>
  )
}

/**
 * Component: CreateQuotationModal (Supports Create & Edit + Custom Items & 0-Stock Items)
 */
function CreateQuotationModal({ initialData, onClose, onSuccess, customers, items, warehouses, defaultWarehouseId, usdExchangeRate }) {
  const { push } = useToast()
  const [saving, setSaving] = useState(false)

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialData?.customer?._id || initialData?.customer || '')
  const [customCustomerName, setCustomCustomerName] = useState(initialData?.customerName || '')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialData?.warehouse?._id || initialData?.warehouse || defaultWarehouseId || '')
  const [quotationDate, setQuotationDate] = useState(
    initialData?.date ? initialData.date.split('T')[0] : new Date().toISOString().split('T')[0]
  )
  const [note, setNote] = useState(initialData?.note || 'عرض سعر صالح لمدة 15 يوماً من تاريخه')
  const [globalDiscount, setGlobalDiscount] = useState(initialData?.totals?.discount || initialData?.discountValue || 0)

  // Items State
  const [rows, setRows] = useState(
    initialData?.items?.length
      ? initialData.items.map((i) => ({
          item: i.item?._id || i.item || null,
          isCustom: Boolean(i.isCustom || !(i.item?._id || i.item)),
          name: i.name || i.item?.name || '',
          sku: i.sku || i.item?.sku || (i.isCustom || !(i.item?._id || i.item) ? 'حر' : ''),
          qty: i.qty || 1,
          price: i.price || 0,
          total: (i.price || 0) * (i.qty || 1),
          stock: 0,
          cost: i.cost || 0,
          isBundle: !!i.isBundle,
          bundleComponents: i.bundleComponents || [],
        }))
      : [{ item: null, isCustom: false, name: '', sku: '', qty: 1, price: 0, total: 0, stock: 0 }]
  )

  // Search in items
  const [itemSearchTerms, setItemSearchTerms] = useState({})
  const [activeDropdownIndex, setActiveDropdownIndex] = useState(null)

  // Add standard row
  const addRow = () => {
    setRows((prev) => [...prev, { item: null, isCustom: false, name: '', sku: '', qty: 1, price: 0, total: 0, stock: 0 }])
  }

  // Add custom/free item row directly
  const addCustomRow = () => {
    setRows((prev) => [...prev, { item: null, isCustom: true, name: '', sku: 'حر', qty: 1, price: 0, total: 0, stock: 0 }])
  }

  // Delete row
  const deleteRow = (index) => {
    if (rows.length === 1) return
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  // Select registered item in row (even if stock is 0)
  const handleSelectItem = (index, itm) => {
    const whStock =
      itm.stocks?.find((ws) => (ws.warehouse?._id || ws.warehouse)?.toString() === selectedWarehouseId?.toString())?.qty ??
      itm.warehouseStock?.find((ws) => ws.warehouse === selectedWarehouseId)?.quantity ??
      itm.totalStock ??
      0
    const price = Number(itm.price) || 0

    const updated = [...rows]
    updated[index] = {
      item: itm._id,
      isCustom: false,
      name: itm.name,
      sku: itm.sku || itm.code || '',
      qty: updated[index]?.qty || 1,
      price: price,
      total: price * (updated[index]?.qty || 1),
      stock: whStock,
      cost: itm.cost || 0,
      isBundle: !!itm.isBundle,
      bundleComponents: itm.bundleComponents || [],
    }
    setRows(updated)
    setItemSearchTerms((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    setActiveDropdownIndex(null)
  }

  // Confirm current typed text as a Custom/Free Item
  const handleSelectCustomText = (index, customName) => {
    const updated = [...rows]
    const currentQty = Number(updated[index]?.qty) || 1
    const currentPrice = Number(updated[index]?.price) || 0
    updated[index] = {
      ...updated[index],
      item: null,
      isCustom: true,
      name: customName.trim(),
      sku: 'حر',
      qty: currentQty,
      price: currentPrice,
      total: currentQty * currentPrice,
    }
    setRows(updated)
    setItemSearchTerms((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    setActiveDropdownIndex(null)
  }

  // Update row name (for custom items or editing selected item name)
  const handleUpdateRowName = (index, nameValue) => {
    const updated = [...rows]
    updated[index] = {
      ...updated[index],
      name: nameValue,
    }
    setRows(updated)
  }

  // Update row quantity or price
  const handleUpdateRow = (index, field, value) => {
    const updated = [...rows]
    const val = Number(value) || 0
    updated[index][field] = val
    updated[index].total = (updated[index].qty || 1) * (updated[index].price || 0)
    setRows(updated)
  }

  // Calculation
  const subtotal = rows.reduce((sum, r) => sum + (r.total || 0), 0)
  const discountVal = Math.min(subtotal, Number(globalDiscount) || 0)
  const grandTotal = Math.max(0, subtotal - discountVal)

  // Submit Quotation
  const handleSave = async () => {
    const validItems = rows.filter((r) => (r.item || (r.name && r.name.trim())) && Number(r.qty) > 0)
    if (validItems.length === 0) {
      push('error', 'يرجى إضافة صنف واحد على الأقل (مسجل أو حر) لعرض السعر')
      return
    }

    setSaving(true)
    try {
      const payload = {
        date: new Date(quotationDate).toISOString(),
        customer: selectedCustomerId || undefined,
        customerName: selectedCustomerId
          ? customers.find((c) => c._id === selectedCustomerId)?.name || 'عميل'
          : customCustomerName.trim() || 'عميل نقدي',
        warehouse: selectedWarehouseId || undefined,
        channel: 'retail',
        type: 'proforma',
        status: 'draft',
        note: note.trim(),
        discountValue: discountVal,
        currency: 'LYD',
        exchangeRate: usdExchangeRate,
        items: validItems.map((r) => ({
          item: r.item || null,
          isCustom: Boolean(r.isCustom || !r.item),
          name: (r.name || 'صنف حر').trim(),
          sku: r.sku || (r.isCustom || !r.item ? 'حر' : ''),
          qty: Number(r.qty) || 1,
          price: Number(r.price) || 0,
          priceUSD: (Number(r.price) || 0) / usdExchangeRate,
          cost: Number(r.cost) || 0,
          isBundle: !!r.isBundle,
          bundleComponents: r.bundleComponents || [],
        })),
        paid: 0,
        paymentMethod: 'cash',
      }

      if (initialData?._id) {
        await api.put(`/sales/proforma/${initialData._id}`, payload)
        push('success', 'تم حفظ تعديلات عرض السعر بنجاح')
      } else {
        await api.post('/sales/invoice-v2', payload)
        push('success', 'تم حفظ عرض السعر بنجاح')
      }

      onSuccess()
    } catch (err) {
      console.error('Failed to save proforma quotation:', err)
      push('error', err.response?.data?.message || 'فشل حفظ عرض السعر')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 shrink-0">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
            {initialData ? <Edit size={22} className="text-amber-600" /> : <FileSpreadsheet size={22} className="text-amber-600" />}
            <h3 className="font-bold text-base sm:text-lg">
              {initialData ? `تعديل عرض السعر (${initialData.number || initialData._id})` : 'إنشاء عرض سعر جديد (فاتورة عرض)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-sm">
          {/* Top Form Controls: Customer, Warehouse, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Customer */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                العميل
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value)
                  if (e.target.value) setCustomCustomerName('')
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">عميل نقدي / إدخال يدوي</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
              {!selectedCustomerId && (
                <input
                  type="text"
                  placeholder="اسم العميل (اختياري)..."
                  value={customCustomerName}
                  onChange={(e) => setCustomCustomerName(e.target.value)}
                  className="mt-1.5 w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              )}
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                المستودع المرجعي (اختياري)
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">اختر المستودع...</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                تاريخ العرض
              </label>
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-visible mt-4">
            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  بنود عرض السعر
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold">
                  يدعم الأصناف المسجلة (حتى رصيد 0) والأصناف الحرة غير المسجلة
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addCustomRow}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                  title="إضافة صنف حر/يدوي غير مسجل في المخزون"
                >
                  <Plus size={14} />
                  <span>إضافة صنف حر (يدوي)</span>
                </button>
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>إضافة سطر</span>
                </button>
              </div>
            </div>

            <div className="p-2 space-y-2">
              {rows.map((row, idx) => {
                const searchVal = itemSearchTerms[idx] !== undefined ? itemSearchTerms[idx] : row.name
                const isCustomRow = Boolean(row.isCustom || (!row.item && row.name))

                return (
                  <div
                    key={idx}
                    className="relative flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 bg-slate-50/50 dark:bg-slate-800/40 rounded-lg border border-slate-200/80 dark:border-slate-700/60"
                  >
                    {/* Badge: Custom vs Registered */}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...rows]
                        const nextCustom = !isCustomRow
                        updated[idx] = {
                          ...updated[idx],
                          item: nextCustom ? null : updated[idx].item,
                          isCustom: nextCustom,
                          sku: nextCustom ? 'حر' : updated[idx].sku,
                        }
                        setRows(updated)
                        if (nextCustom) setActiveDropdownIndex(null)
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold shrink-0 border transition-colors cursor-pointer ${
                        isCustomRow
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}
                      title="اضغط للتبديل بين صنف مسجل وصنف حر يدوي"
                    >
                      {isCustomRow ? 'صنف حر' : 'مخزني'}
                    </button>

                    {/* Item Search / Custom Name Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <input
                        type="text"
                        placeholder={
                          row.isCustom
                            ? 'اكتب اسم الصنف الحر هنا...'
                            : 'ابحث عن الصنف أو اكتب اسم صنف حر مباشرة...'
                        }
                        value={searchVal}
                        onFocus={() => {
                          if (!row.isCustom) setActiveDropdownIndex(idx)
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setActiveDropdownIndex((prev) => (prev === idx ? null : prev))
                          }, 200)
                        }}
                        onChange={(e) => {
                          const val = e.target.value
                          setItemSearchTerms({ ...itemSearchTerms, [idx]: val })
                          handleUpdateRowName(idx, val)
                          if (!row.isCustom) {
                            setActiveDropdownIndex(idx)
                          }
                        }}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />

                      {/* Autocomplete Dropdown */}
                      {activeDropdownIndex === idx && !row.isCustom && (
                        <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                          {searchVal && searchVal.trim() && (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                handleSelectCustomText(idx, searchVal)
                              }}
                              className="w-full px-3 py-2 text-right bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-between border-b border-indigo-100 dark:border-indigo-800 cursor-pointer"
                            >
                              <span>➕ اعتماد "{searchVal.trim()}" كصنف حر (غير مسجل بالمخزون)</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-200/70 dark:bg-indigo-800">صنف حر</span>
                            </button>
                          )}

                          {items
                            .filter((itm) => {
                              const term = (searchVal || '').toLowerCase()
                              return (
                                !term ||
                                itm.name?.toLowerCase().includes(term) ||
                                itm.sku?.toLowerCase().includes(term) ||
                                itm.code?.toLowerCase().includes(term)
                              )
                            })
                            .slice(0, 20)
                            .map((itm) => {
                              const whQty = selectedWarehouseId
                                ? (itm.stocks?.find(
                                    (s) => (s.warehouse?._id || s.warehouse)?.toString() === selectedWarehouseId?.toString()
                                  )?.qty ?? itm.totalStock ?? 0)
                                : (itm.totalStock ?? 0)

                              return (
                                <button
                                  key={itm._id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    handleSelectItem(idx, itm)
                                  }}
                                  className="w-full px-3 py-2 text-right hover:bg-slate-100 dark:hover:bg-slate-800 text-xs flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer"
                                >
                                  <div>
                                    <div className="font-bold text-slate-800 dark:text-slate-100">{itm.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {itm.sku || itm.code || 'بدون باركود'}
                                    </div>
                                  </div>
                                  <div className="text-left font-mono">
                                    <div className="font-bold text-amber-600">{formatCurrency(itm.price || 0)}</div>
                                    <div className={`text-[10px] ${whQty <= 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                                      مخزون: {whQty}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                        </div>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        placeholder="الكمية"
                        value={row.qty}
                        onChange={(e) => handleUpdateRow(idx, 'qty', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-center"
                      />
                    </div>

                    {/* Price */}
                    <div className="w-28">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="السعر"
                        value={row.price}
                        onChange={(e) => handleUpdateRow(idx, 'price', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-left"
                      />
                    </div>

                    {/* Total */}
                    <div className="w-28 text-left font-mono font-bold text-slate-800 dark:text-slate-100 text-xs px-2">
                      {formatCurrency(row.total || 0)}
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => deleteRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                      title="حذف السطر"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes and Terms */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              ملاحظات وشروط العرض
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: الأسعار سارية لمدة 15 يوماً وتخضع للتوفر لحظة التأكيد..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          {/* Calculation Footer */}
          <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
              <span>المجموع الفرعي:</span>
              <span className="font-mono font-bold">{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400">
              <span>الخصم (د.ل):</span>
              <input
                type="number"
                min="0"
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(e.target.value)}
                className="w-24 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-left"
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center">
              <div>
                <span className="font-bold text-sm text-slate-900 dark:text-white">الصافي الإجمالي:</span>
              </div>
              <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {saving && <RefreshCw size={14} className="animate-spin" />}
            <span>{initialData ? 'حفظ التعديلات' : 'حفظ عرض السعر'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Component: PrintQuotationModal
 */
function PrintQuotationModal({ quotation, onClose, settings }) {
  const printRef = useRef()

  const handleTriggerPrint = () => {
    window.print()
  }

  const quoteDate = quotation.date ? new Date(quotation.date).toLocaleDateString('ar-LY') : '-'
  const items = quotation.items || []
  const subtotal = quotation.totals?.subtotal || items.reduce((s, i) => s + (i.price * i.qty), 0)
  const discount = quotation.totals?.discount || quotation.discountValue || 0
  const grand = quotation.totals?.grand || (subtotal - discount)
  const customerName = quotation.customer?.name || quotation.customerName || 'عميل نقدي'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Controls Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800 print:hidden">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
            <Printer size={18} className="text-amber-500" />
            <span>معاينة طباعة عرض السعر</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerPrint}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer size={15} />
              <span>طباعة المستند</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div id="quotation-print" ref={printRef} className="p-8 bg-white text-slate-900 overflow-y-auto font-sans">
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {settings?.print_showLogo !== false && settings?.logo && (
                  <img
                    src={settings.logo}
                    alt="Logo"
                    className="h-16 w-auto max-w-[140px] object-contain shrink-0"
                  />
                )}
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    {settings?.companyName || 'شركة التجارة والتقنية'}
                  </h1>
                  <div className="text-xs text-slate-600 mt-1 space-y-0.5 font-medium">
                    {(settings?.address || settings?.companyAddress) && (
                      <p>العنوان: {settings?.address || settings?.companyAddress}</p>
                    )}
                    {(settings?.phone || settings?.companyPhone) && (
                      <p>هاتف: {settings?.phone || settings?.companyPhone}</p>
                    )}
                    {settings?.email && (
                      <p>البريد الإلكتروني: <span className="font-mono">{settings.email}</span></p>
                    )}
                    {settings?.website && (
                      <p>الموقع الإلكتروني: <span className="font-mono">{settings.website}</span></p>
                    )}
                    {settings?.commercialRegister && (
                      <p>سجل تجاري: {settings.commercialRegister}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-left">
                <div className="inline-block px-3 py-1 bg-amber-500 text-white font-black text-sm rounded-md tracking-wider">
                  فاتورة عرض أسعار
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1">
                  PROFORMA INVOICE
                </div>
              </div>
            </div>
          </div>

          {/* Meta Information */}
          <div className="grid grid-cols-2 gap-4 text-xs mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-slate-400 block font-bold">العميل المحترم:</span>
              <span className="text-sm font-bold text-slate-900 block mt-0.5">{customerName}</span>
              {quotation.customer?.phone && (
                <span className="text-slate-500 font-mono block">{quotation.customer.phone}</span>
              )}
            </div>

            <div className="text-left font-mono">
              <div>
                <span className="text-slate-400 font-bold ml-2">رقم العرض:</span>
                <span className="font-bold text-amber-700">{quotation.number || `QUO-${quotation._id.slice(-6)}`}</span>
              </div>
              <div className="mt-1">
                <span className="text-slate-400 font-bold ml-2">التاريخ:</span>
                <span>{quoteDate}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-right border-collapse text-xs mb-6">
            <thead>
              <tr className="bg-slate-800 text-white font-bold">
                <th className="py-2.5 px-3 rounded-r-md">#</th>
                <th className="py-2.5 px-3">البيان / الصنف</th>
                <th className="py-2.5 px-3 text-center">الكمية</th>
                <th className="py-2.5 px-3 text-left">سعر الوحدة</th>
                <th className="py-2.5 px-3 text-left rounded-l-md">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-slate-400 font-mono">{i + 1}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span>{row.name || row.item?.name || 'صنف'}</span>
                      {(row.isCustom || !row.item || row.sku === 'حر') && (
                        <span className="print:hidden text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                          صنف حر
                        </span>
                      )}
                    </div>
                    {(row.sku || row.item?.sku) && row.sku !== 'حر' && !row.isCustom && (
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {row.sku || row.item?.sku}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold">{row.qty}</td>
                  <td className="py-2.5 px-3 text-left font-mono">{formatCurrency(row.price)}</td>
                  <td className="py-2.5 px-3 text-left font-mono font-bold">
                    {formatCurrency((row.price || 0) * (row.qty || 1))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Box */}
          <div className="flex justify-end mb-8">
            <div className="w-64 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-500">
                <span>المجموع:</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>الخصم:</span>
                  <span className="font-mono">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-1.5 flex justify-between font-black text-sm text-slate-900">
                <span>الصافي المطلوب:</span>
                <span className="font-mono text-amber-700">{formatCurrency(grand)}</span>
              </div>
            </div>
          </div>

          {/* Terms and Signature */}
          <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 space-y-2">
            <p className="font-bold text-slate-700">الشروط والأحكام:</p>
            <p>1. {quotation.note || 'عرض السعر صالح لمدة 15 يوماً من تاريخ الإصدار.'}</p>
            <p>2. يتم اعتماد البيع رسمياً بإصدار فاتورة مبيعات معتمدة وسند تحصيل.</p>

            <div className="pt-8 text-xs font-bold text-slate-600 flex justify-start">
              <div className="w-48 text-center">
                <p className="border-t border-slate-300 pt-2">توقيع المسؤول / الختم</p>
              </div>
            </div>
          </div>

          {/* Footer Contact & Thank You */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
            <span>{settings?.thankYouMessage || 'شكراً لتعاملكم معنا'}</span>
            {(settings?.email || settings?.website) && (
              <div className="flex items-center gap-3 font-mono text-slate-500">
                {settings?.email && <span>{settings.email}</span>}
                {settings?.email && settings?.website && <span>|</span>}
                {settings?.website && <span>{settings.website}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { visibility: hidden; overflow: hidden; }
          #quotation-print, #quotation-print * { visibility: visible; }
          #quotation-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 210mm;
            min-height: 297mm;
            padding: 20px;
            margin: 0 auto;
            overflow: visible !important;
          }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  )
}
