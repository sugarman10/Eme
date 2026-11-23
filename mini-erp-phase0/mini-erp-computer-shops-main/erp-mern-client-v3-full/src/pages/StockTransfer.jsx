import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useToast } from '../context/ToastContext'
import { useWarehouse } from '../context/WarehouseContext'
import {
  ArrowRightLeft, Package, Warehouse, AlertCircle, CheckCircle2,
  Search, Plus, Minus, Trash2, Printer, RefreshCw, Barcode,
  FileText, Calendar, Clock, ArrowLeft, Layers, ShieldCheck, X,
  History, Eye, User, RotateCcw, Edit, Ban, AlertTriangle
} from 'lucide-react'
import api from '../services/api'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function StockTransfer() {
  const { push } = useToast()
  const { activeWarehouse } = useWarehouse() || {}

  // Invoice Header State
  const [fromWarehouse, setFromWarehouse] = useState('')
  const [toWarehouse, setToWarehouse] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [transferRef, setTransferRef] = useState(`TRF-${Date.now().toString().slice(-6)}`)
  const [generalNote, setGeneralNote] = useState('')

  // Transfer Lines (Items in Transfer Invoice)
  const [transferItems, setTransferItems] = useState([])

  // Raw Data Lists
  const [items, setItems] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Search & Barcode Scanner State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchInputRef = useRef(null)

  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printedTransfer, setPrintedTransfer] = useState(null)

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState('new') // 'new' | 'history'

  // History State
  const [historyTransfers, setHistoryTransfers] = useState([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

  // Fetch History of Transfers
  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await api.get('/inventory/stock/transfers', {
        params: { page: historyPage, limit: 15, q: historySearch }
      })
      setHistoryTransfers(res.data?.transfers || [])
      setHistoryTotal(res.data?.total || 0)
    } catch (error) {
      console.error('Failed to load transfers history:', error)
      push('error', 'فشل تحميل سجل التحويلات')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [activeTab, historyPage, historySearch])

  // Open Transfer Print Modal from History
  const openTransferPrint = (trf) => {
    setPrintedTransfer({
      ref: trf.transferNumber,
      date: new Date(trf.date || trf.createdAt).toISOString().split('T')[0],
      fromWarehouse: trf.fromWarehouse?.name || 'المخزن المصدر',
      toWarehouse: trf.toWarehouse?.name || 'المخزن المستلم',
      note: trf.note || '',
      status: trf.status || 'completed',
      cancelReason: trf.cancelReason || '',
      cancelledAt: trf.cancelledAt,
      items: (trf.items || []).map(li => ({
        item: {
          name: li.item?.name || li.name || 'صنف',
          sku: li.item?.sku || li.sku || '',
          uom: li.item?.uom || 'قطعة'
        },
        qty: li.qty,
        note: li.note || ''
      })),
      totalPieces: trf.totalQuantity || (trf.items || []).reduce((acc, i) => acc + (i.qty || 0), 0)
    })
    setShowPrintModal(true)
  }

  // Cancel & Edit Modal State
  const [cancellingTransfer, setCancellingTransfer] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [actionType, setActionType] = useState('cancel') // 'cancel' | 'edit'

  // Confirm Cancellation or Edit Reversal
  const handleCancelConfirm = async () => {
    if (!cancellingTransfer) return
    setCancelLoading(true)
    try {
      const res = await api.post(`/inventory/stock/transfers/${cancellingTransfer._id}/cancel`, {
        reason: cancelReason || (actionType === 'edit' ? 'إلغاء بغرض التعديل وإعادة الترحيل' : 'إلغاء وتراجع عن التحويل')
      })

      push('success', res.data?.message || 'تم إلغاء إذن التحويل وعكس الكميات بنجاح')

      // If action was edit: populate the form with the transfer data!
      if (actionType === 'edit') {
        const trf = cancellingTransfer
        const sourceWhId = trf.fromWarehouse?._id || trf.fromWarehouse || ''
        const destWhId = trf.toWarehouse?._id || trf.toWarehouse || ''
        setFromWarehouse(sourceWhId)
        setToWarehouse(destWhId)
        setGeneralNote(trf.note ? `تعديل للإذن ${trf.transferNumber}: ${trf.note}` : `تعديل للإذن ${trf.transferNumber}`)
        setTransferRef(`TRF-${Date.now().toString().slice(-6)}`)

        // Format items
        const loadedLines = (trf.items || []).map((li) => {
          const itemObj = items.find(i => i._id === (li.item?._id || li.item)) || li.item || {}
          return {
            item: {
              ...itemObj,
              _id: li.item?._id || li.item,
              name: li.item?.name || li.name || itemObj.name || 'صنف',
              sku: li.item?.sku || li.sku || itemObj.sku || '',
              uom: li.item?.uom || itemObj.uom || 'قطعة',
              stocks: itemObj.stocks || []
            },
            qty: li.qty,
            note: li.note || ''
          }
        })
        setTransferItems(loadedLines)
        setActiveTab('new')
        push('info', 'تم تحميل بنود الإذن في شاشة التحويل لتعديلها وإعادة الترحيل')
      }

      // Reload items to get updated stocks
      const itemsRes = await api.get('/inventory/items', { params: { limit: 2000 } })
      const loadedItems = Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data?.items || [])
      setItems(loadedItems)

      // Refresh history
      fetchHistory()

      setCancellingTransfer(null)
      setCancelReason('')
    } catch (error) {
      console.error('Cancel transfer failed:', error)
      push('error', error?.response?.data?.message || 'فشل إلغاء إذن التحويل')
    } finally {
      setCancelLoading(false)
    }
  }

  // Load Initial Items & Warehouses
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [itemsRes, warehousesRes] = await Promise.all([
          api.get('/inventory/items', { params: { limit: 2000 } }),
          api.get('/inventory/warehouses')
        ])

        const loadedItems = Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data?.items || [])
        const loadedWarehouses = Array.isArray(warehousesRes.data) ? warehousesRes.data : (warehousesRes.data?.warehouses || [])

        setItems(loadedItems)
        setWarehouses(loadedWarehouses)

        // Set default fromWarehouse from active warehouse or first available
        if (loadedWarehouses.length > 0) {
          const defaultSource = activeWarehouse?._id || loadedWarehouses[0]._id
          setFromWarehouse(defaultSource)
          if (loadedWarehouses.length > 1) {
            const defaultDest = loadedWarehouses.find(w => w._id !== defaultSource)?._id || ''
            setToWarehouse(defaultDest)
          }
        }
      } catch (error) {
        console.error('Failed to load inventory data:', error)
        push('error', 'فشل تحميل بيانات المخازن والأصناف')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [push, activeWarehouse])

  // Helper: get available stock for an item in a specific warehouse
  const getItemStockInWarehouse = (itemDoc, whId) => {
    if (!itemDoc || !whId) return 0
    const match = itemDoc.stocks?.find(s => {
      const id = s.warehouse?._id || s.warehouse
      return id?.toString() === whId?.toString()
    })
    return Number(match?.qty || 0)
  }

  // Image URL Resolver
  const getImageUrl = (imagePath) => {
    if (!imagePath) return ''
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath
    return `${api.defaults.baseURL.replace('/api', '')}${imagePath}`
  }

  // Live Search & Barcode Matching
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }

    const q = searchQuery.toLowerCase().trim()
    const matches = items.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q) ||
      (i.barcode || '').toLowerCase().includes(q)
    ).slice(0, 8)

    setSearchResults(matches)
    setShowSearchDropdown(matches.length > 0)
  }, [searchQuery, items])

  // Add Item to Transfer Invoice
  const addItemToTransfer = (itemDoc, customQty = 1) => {
    if (!fromWarehouse) {
      push('error', 'يرجى اختيار المخزن المصدر أولاً')
      return
    }

    const availableStock = getItemStockInWarehouse(itemDoc, fromWarehouse)
    if (availableStock <= 0) {
      push('error', `الصنف "${itemDoc.name}" رصيده 0 في المخزن المصدر المختار`)
      return
    }

    setTransferItems(prev => {
      const existingIndex = prev.findIndex(line => line.item._id === itemDoc._id)
      if (existingIndex > -1) {
        // Increment quantity if within stock
        const updated = [...prev]
        const currentQty = updated[existingIndex].qty
        const newQty = currentQty + customQty
        if (newQty > availableStock) {
          push('error', `لا يمكن إضافة كمية تفوق الرصيد المتاح بالمخزن (${availableStock})`)
          return prev
        }
        updated[existingIndex].qty = newQty
        return updated
      } else {
        // Add new line
        return [
          ...prev,
          {
            item: itemDoc,
            qty: customQty,
            note: ''
          }
        ]
      }
    })

    setSearchQuery('')
    setShowSearchDropdown(false)
    if (searchInputRef.current) searchInputRef.current.focus()
  }

  // Barcode Scanner Keydown Handler (Enter to pick exact match)
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const q = searchQuery.trim().toLowerCase()
      if (!q) return

      // Exact barcode or SKU match
      const exactMatch = items.find(i =>
        (i.barcode && i.barcode.toLowerCase() === q) ||
        (i.sku && i.sku.toLowerCase() === q)
      )

      if (exactMatch) {
        addItemToTransfer(exactMatch, 1)
      } else if (searchResults.length > 0) {
        addItemToTransfer(searchResults[0], 1)
      } else {
        push('error', 'لم يتم العثور على صنف مطابق للباركود المدخل')
      }
    }
  }

  // Update Line Quantity
  const updateLineQty = (itemId, newQty) => {
    const qty = Number(newQty)
    if (isNaN(qty) || qty < 1) return

    setTransferItems(prev => prev.map(line => {
      if (line.item._id === itemId) {
        return { ...line, qty }
      }
      return line
    }))
  }

  // Update Line Note
  const updateLineNote = (itemId, note) => {
    setTransferItems(prev => prev.map(line => {
      if (line.item._id === itemId) {
        return { ...line, note }
      }
      return line
    }))
  }

  // Remove Line
  const removeLine = (itemId) => {
    setTransferItems(prev => prev.filter(line => line.item._id !== itemId))
  }

  // Invoice Calculations & Validations
  const invoiceStats = useMemo(() => {
    let totalPieces = 0
    let hasStockError = false

    transferItems.forEach(line => {
      totalPieces += Number(line.qty || 0)
      const available = getItemStockInWarehouse(line.item, fromWarehouse)
      if (Number(line.qty) > available) {
        hasStockError = true
      }
    })

    const isSameWarehouse = fromWarehouse && toWarehouse && fromWarehouse === toWarehouse
    const isValid = transferItems.length > 0 && fromWarehouse && toWarehouse && !isSameWarehouse && !hasStockError

    return {
      totalLines: transferItems.length,
      totalPieces,
      hasStockError,
      isSameWarehouse,
      isValid
    }
  }, [transferItems, fromWarehouse, toWarehouse])

  // Reset / New Invoice
  const handleReset = () => {
    if (transferItems.length > 0 && !confirm('هل أنت متأكد من مسح جميع البنود والبدء بإذن تحويل جديد؟')) {
      return
    }
    setTransferItems([])
    setGeneralNote('')
    setTransferRef(`TRF-${Date.now().toString().slice(-6)}`)
    setTransferDate(new Date().toISOString().split('T')[0])
  }

  // Submit Transfer Invoice
  const handleSubmitInvoice = async (e) => {
    if (e) e.preventDefault()

    if (!fromWarehouse || !toWarehouse) {
      push('error', 'يرجى تحديد المخزن المصدر والمخزن المستلم')
      return
    }

    if (fromWarehouse === toWarehouse) {
      push('error', 'لا يمكن التحويل لنفس المخزن، يجب اختيار مخزنين مختلفين')
      return
    }

    if (transferItems.length === 0) {
      push('error', 'يرجى إضافة صنف واحد على الأقل في فاتورة التحويل')
      return
    }

    if (invoiceStats.hasStockError) {
      push('error', 'توجد بنود تتجاوز الكميات المتوفرة بالمخزن المصدر. يرجى تصحيحها أولاً')
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        fromWarehouse,
        toWarehouse,
        ref: transferRef,
        note: generalNote,
        items: transferItems.map(line => ({
          item: line.item._id,
          qty: Number(line.qty),
          note: line.note
        }))
      }

      const res = await api.post('/inventory/stock/transfer-batch', payload)

      push('success', res.data?.message || 'تم ترحيل إذن التحويل المخزني بنجاح!')

      // Prepare print data
      const fromWhDoc = warehouses.find(w => w._id === fromWarehouse)
      const toWhDoc = warehouses.find(w => w._id === toWarehouse)

      setPrintedTransfer({
        ref: transferRef,
        date: transferDate,
        fromWarehouse: fromWhDoc?.name || 'المخزن المصدر',
        toWarehouse: toWhDoc?.name || 'المخزن المستلم',
        note: generalNote,
        items: [...transferItems],
        totalPieces: invoiceStats.totalPieces
      })

      setShowPrintModal(true)
      fetchHistory()

      // Reload items to update stock in memory
      const itemsRes = await api.get('/inventory/items', { params: { limit: 2000 } })
      const loadedItems = Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data?.items || [])
      setItems(loadedItems)

      // Reset form
      setTransferItems([])
      setGeneralNote('')
      setTransferRef(`TRF-${Date.now().toString().slice(-6)}`)

    } catch (error) {
      console.error('Transfer submission failed:', error)
      push('error', error?.response?.data?.message || 'فشل ترحيل إذن التحويل')
    } finally {
      setSubmitting(false)
    }
  }

  // Print Document Trigger
  const handlePrint = () => {
    window.print()
  }

  const fromWarehouseDoc = warehouses.find(w => w._id === fromWarehouse)
  const toWarehouseDoc = warehouses.find(w => w._id === toWarehouse)

  return (
    <div className="flex flex-col gap-6 animate-in p-6 max-w-7xl mx-auto font-sans" dir="rtl">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">فاتورة وإذن تحويل مخزني</h1>
            <p className="text-xs text-slate-500 font-medium">
              نقل كميات متعددة من الأصناف دفعة واحدة بين الفروع والمخازن مع فحص الرصيد اللحظي والطباعة
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2">
          {printedTransfer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrintModal(true)}
              className="h-10 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Printer size={15} className="ml-1.5 text-indigo-600" />
              طباعة آخر إذن ({printedTransfer.ref})
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-10 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw size={15} className="ml-1.5 text-slate-500" />
            إذن تحويل جديد
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('new')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'new'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <Plus size={16} />
          <span>إذن تحويل جديد</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <History size={16} />
          <span>سجل أذونات التحويل السابقة</span>
          {historyTotal > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'history' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-700'
            }`}>
              {historyTotal}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'new' && (
        <>
          {/* 2. Transfer Document Header Card (المخزن المصدر، المخزن المستلم، والتاريخ) */}
          <Card className="border border-slate-200/80 shadow-xs rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Reference & Date */}
          <div className="md:col-span-3 space-y-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <FileText size={12} className="text-indigo-600" />
                رقم إذن التحويل
              </label>
              <Input
                value={transferRef}
                onChange={e => setTransferRef(e.target.value)}
                className="bg-white font-mono font-bold text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Calendar size={12} className="text-indigo-600" />
                تاريخ الإذن
              </label>
              <Input
                type="date"
                value={transferDate}
                onChange={e => setTransferDate(e.target.value)}
                className="bg-white text-xs h-9 font-bold"
              />
            </div>
          </div>

          {/* Warehouses Flow (Source ➔ Destination) */}
          <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-11 gap-3 items-center p-3.5 bg-indigo-50/30 rounded-xl border border-indigo-100">
            {/* From Warehouse */}
            <div className="sm:col-span-5 space-y-1">
              <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Warehouse size={14} className="text-indigo-600" />
                المخزن المصدر (صرف من) <span className="text-rose-500">*</span>
              </label>
              <select
                value={fromWarehouse}
                onChange={e => setFromWarehouse(e.target.value)}
                className="w-full h-10 px-3 border border-indigo-200 rounded-xl bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="">اختر المخزن المصدر...</option>
                {warehouses.map(w => (
                  <option key={w._id} value={w._id}>
                    {w.name} {w.code ? `(${w.code})` : ''}
                  </option>
                ))}
              </select>
              {fromWarehouseDoc && (
                <span className="text-[10px] text-emerald-700 font-bold block pt-0.5">
                  ✓ سيتم خصم الكميات من هذا المخزن
                </span>
              )}
            </div>

            {/* Transfer Direction Indicator */}
            <div className="sm:col-span-1 flex justify-center py-1">
              <div className="p-2 bg-indigo-600 text-white rounded-full shadow-xs">
                <ArrowLeft size={16} />
              </div>
            </div>

            {/* To Warehouse */}
            <div className="sm:col-span-5 space-y-1">
              <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Warehouse size={14} className="text-emerald-600" />
                المخزن المستلم (تحويل إلى) <span className="text-rose-500">*</span>
              </label>
              <select
                value={toWarehouse}
                onChange={e => setToWarehouse(e.target.value)}
                className="w-full h-10 px-3 border border-indigo-200 rounded-xl bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
              >
                <option value="">اختر المخزن المستلم...</option>
                {warehouses
                  .filter(w => w._id !== fromWarehouse)
                  .map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name} {w.code ? `(${w.code})` : ''}
                    </option>
                  ))}
              </select>
              {toWarehouseDoc && (
                <span className="text-[10px] text-indigo-700 font-bold block pt-0.5">
                  ✓ سيتم إيداع الكميات في هذا المخزن
                </span>
              )}
            </div>
          </div>

          {/* Notes & Purpose */}
          <div className="md:col-span-3 space-y-1">
            <label className="text-xs font-bold text-slate-700">ملاحظات / الغرض من التحويل</label>
            <textarea
              rows={3}
              value={generalNote}
              onChange={e => setGeneralNote(e.target.value)}
              placeholder="مثال: تعزيز رصيد فرع 2، توريد طلبيات عملاء..."
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Fast Item Search & Barcode Scanner Toolbar */}
      <div className="relative bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Barcode className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="امسح الباركود، أو اكتب اسم الصنف أو كود SKU ثم اضغط Enter..."
              className="pr-11 pl-10 h-11 bg-slate-50/70 border-slate-200 text-xs font-bold rounded-xl focus-visible:ring-indigo-500 focus-visible:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick Scanner Badge Indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold shrink-0">
            <ShieldCheck size={16} className="text-emerald-600" />
            <span>قارئ الباركود نشط (Enter للإضافة الفورية)</span>
          </div>
        </div>

        {/* Live Search Autocomplete Dropdown */}
        {showSearchDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-40 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {searchResults.map(prod => {
              const currentStock = getItemStockInWarehouse(prod, fromWarehouse)
              const hasStock = currentStock > 0

              return (
                <div
                  key={prod._id}
                  onClick={() => addItemToTransfer(prod)}
                  className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    hasStock ? 'hover:bg-indigo-50/60' : 'bg-slate-50/70 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {prod.image ? (
                        <img src={getImageUrl(prod.image)} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">{prod.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <span>SKU: {prod.sku}</span>
                        {prod.barcode && <span>• الباركود: {prod.barcode}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                        hasStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        المتاح بالمصدر: {currentStock} {prod.uom || 'قطعة'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      disabled={!hasStock}
                      className="h-8 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs"
                    >
                      <Plus size={13} className="ml-1" />
                      إضافة للفاتورة
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. Transfer Items Table Card */}
      <Card className="border border-slate-200/80 shadow-xs rounded-2xl overflow-hidden bg-white">
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <Layers size={16} className="text-indigo-600" />
              <span>بنود إذن التحويل المخزني</span>
            </CardTitle>
            <span className="text-xs font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full font-mono">
              {transferItems.length} بنود
            </span>
          </div>

          {invoiceStats.hasStockError && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
              <AlertCircle size={14} />
              <span>تنبيه: توجد أصناف تتجاوز الكمية المتوفرة بالمخزن المصدر</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {transferItems.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="p-4 bg-indigo-50 text-indigo-500 rounded-3xl inline-block shadow-inner">
                <Package size={40} />
              </div>
              <p className="text-sm font-black text-slate-800">فاتورة التحويل فارغة حالياً</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                استخدم شريط البحث أو قارئ الباركود أعلاه لإضافة المنتجات والقطع المراد تحويلها إلى المخزن المستلم.
              </p>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-14 text-center">صورة</th>
                  <th className="py-3 px-4 min-w-[220px]">بيانات الصنف (الاسم والـ SKU)</th>
                  <th className="py-3 px-4 text-center">الرصيد بالمخزن المصدر</th>
                  <th className="py-3 px-4 text-center min-w-[160px]">كمية التحويل</th>
                  <th className="py-3 px-4">الوحدة</th>
                  <th className="py-3 px-4">ملاحظة البند (اختياري)</th>
                  <th className="py-3 px-3 w-12 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transferItems.map((line, idx) => {
                  const available = getItemStockInWarehouse(line.item, fromWarehouse)
                  const isOverStock = Number(line.qty) > available

                  return (
                    <tr
                      key={line.item._id}
                      className={`transition-colors ${
                        isOverStock ? 'bg-rose-50/80 hover:bg-rose-50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Sequence */}
                      <td className="py-3 px-3 text-center font-bold font-mono text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Image */}
                      <td className="py-3 px-3 text-center">
                        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden">
                          {line.item.image ? (
                            <img src={getImageUrl(line.item.image)} alt={line.item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={16} className="text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* Product Info */}
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 text-xs">{line.item.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono pt-0.5">
                          <span>SKU: {line.item.sku}</span>
                          {line.item.barcode && <span>• باركود: {line.item.barcode}</span>}
                        </div>
                      </td>

                      {/* Available Stock in Source Warehouse */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${
                          available > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {available} {line.item.uom || 'قطعة'}
                        </span>
                      </td>

                      {/* Transfer Quantity Stepper */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateLineQty(line.item._id, Math.max(1, line.qty - 1))}
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold transition-all cursor-pointer shadow-2xs"
                          >
                            <Minus size={13} />
                          </button>
                          <Input
                            type="number"
                            min="1"
                            max={available}
                            value={line.qty}
                            onChange={e => updateLineQty(line.item._id, e.target.value)}
                            className={`w-20 text-center font-mono font-black text-xs h-8 rounded-lg ${
                              isOverStock ? 'border-rose-500 bg-rose-50 text-rose-700 ring-1 ring-rose-500' : 'bg-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => updateLineQty(line.item._id, line.qty + 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold transition-all cursor-pointer shadow-2xs"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        {isOverStock && (
                          <span className="text-[10px] text-rose-600 font-bold block pt-1">
                            تجاوز الرصيد المتاح!
                          </span>
                        )}
                      </td>

                      {/* UOM */}
                      <td className="py-3 px-4 text-slate-600 font-bold text-xs">
                        {line.item.uom || 'قطعة'}
                      </td>

                      {/* Row Note */}
                      <td className="py-3 px-4">
                        <Input
                          value={line.note}
                          onChange={e => updateLineNote(line.item._id, e.target.value)}
                          placeholder="ملاحظة للبند..."
                          className="h-8 text-[11px] bg-white border-slate-200 rounded-lg"
                        />
                      </td>

                      {/* Delete Action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.item._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="حذف البند من الفاتورة"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 5. Summary & Action Execution Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Metric Badges */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-0.5">
            <span className="text-[11px] font-bold text-slate-500 block">عدد البنود المختلفة</span>
            <span className="text-xl font-black text-slate-900 font-mono block">{invoiceStats.totalLines} صنف</span>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-xl space-y-0.5">
            <span className="text-[11px] font-bold text-indigo-700 block">إجمالي القطع المحولة</span>
            <span className="text-xl font-black text-indigo-900 font-mono block">{invoiceStats.totalPieces} قطعة</span>
          </div>

          {fromWarehouseDoc && toWarehouseDoc && (
            <div className="text-xs text-slate-500 font-medium hidden md:block">
              نقل من: <strong className="text-slate-800">{fromWarehouseDoc.name}</strong> ➔ إلى: <strong className="text-slate-800">{toWarehouseDoc.name}</strong>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={transferItems.length === 0}
            className="h-11 px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer"
          >
            تفريغ الفاتورة
          </Button>

          <Button
            type="button"
            onClick={handleSubmitInvoice}
            disabled={!invoiceStats.isValid || submitting}
            className="flex-1 sm:flex-none h-11 px-6 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm cursor-pointer"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <RefreshCw size={15} className="animate-spin" />
                <span>جاري الترحيل وتنفيذ النقل...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>ترحيل وتنفيذ إذن التحويل</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </>
  )}

  {/* 3. Stock Transfers History Tab */}
  {activeTab === 'history' && (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* History Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="بحث برقم الإذن أو الملاحظات..."
            value={historySearch}
            onChange={(e) => {
              setHistorySearch(e.target.value)
              setHistoryPage(1)
            }}
            className="w-full pr-10 pl-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHistory}
            disabled={historyLoading}
            className="text-xs font-bold text-slate-700 border-slate-200 h-9 cursor-pointer"
          >
            <RefreshCw size={14} className={`ml-1.5 ${historyLoading ? 'animate-spin' : ''}`} />
            تحديث السجل
          </Button>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {historyLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={28} className="animate-spin text-indigo-600" />
            <p className="text-sm font-medium">جاري استرجاع سجل أذونات التحويل...</p>
          </div>
        ) : historyTransfers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <FileText size={36} className="text-slate-300" />
            <p className="text-sm font-bold text-slate-600">لا توجد أذونات تحويل مسجلة بعد</p>
            <p className="text-xs text-slate-400">أي تحويل تقوم بترحيله سيتم حفظه هنا للرجوع إليه وإعادة طباعته في أي وقت</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                <tr>
                  <th className="p-3.5">رقم الإذن</th>
                  <th className="p-3.5">تاريخ الإذن</th>
                  <th className="p-3.5">مسار التحويل (من ➔ إلى)</th>
                  <th className="p-3.5 text-center">الحالة</th>
                  <th className="p-3.5 text-center">عدد الأصناف</th>
                  <th className="p-3.5 text-center">إجمالي القطع</th>
                  <th className="p-3.5">المستخدم المنفذ</th>
                  <th className="p-3.5">البيان والملاحظات</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyTransfers.map((trf) => (
                  <tr key={trf._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-indigo-700">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                        <FileText size={13} className="text-indigo-600" />
                        {trf.transferNumber}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">
                      {new Date(trf.date || trf.createdAt).toLocaleDateString('ar-LY')}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2 font-bold text-slate-800">
                        <span className="text-slate-700">{trf.fromWarehouse?.name || 'مخزن'}</span>
                        <ArrowLeft size={14} className="text-indigo-600 shrink-0" />
                        <span className="text-indigo-700">{trf.toWarehouse?.name || 'مخزن'}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      {trf.status === 'cancelled' ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200"
                          title={`ملغى بواسطة: ${trf.cancelledBy?.name || 'المستخدم'} | السبب: ${trf.cancelReason || 'تراجع'}`}
                        >
                          <Ban size={12} />
                          ملغى
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          مكتمل
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                      {trf.totalItems || trf.items?.length || 0} صنف
                    </td>
                    <td className="p-3.5 text-center font-mono font-black text-indigo-700 text-sm">
                      {trf.totalQuantity || (trf.items || []).reduce((acc, i) => acc + (i.qty || 0), 0)} قطعة
                    </td>
                    <td className="p-3.5 text-slate-600 font-medium">
                      {trf.user?.name || '-'}
                    </td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">
                      {trf.status === 'cancelled' && trf.cancelReason ? (
                        <span className="text-rose-600 font-medium">سبب الإلغاء: {trf.cancelReason}</span>
                      ) : (
                        trf.note || '-'
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTransferPrint(trf)}
                          className="h-8 px-2.5 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                          title="عرض وطباعة إذن التحويل"
                        >
                          <Eye size={13} className="ml-1 text-indigo-600" />
                          طباعة
                        </Button>

                        {trf.status !== 'cancelled' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCancellingTransfer(trf)
                                setActionType('edit')
                                setCancelReason('إلغاء بغرض التعديل وإعادة الترحيل')
                              }}
                              className="h-8 px-2.5 text-xs font-bold border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer"
                              title="تعديل الإذن: يقوم بعكس العملية وتحميل البنود في شاشة التحويل لتعديلها"
                            >
                              <Edit size={13} className="ml-1 text-amber-600" />
                              تعديل
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCancellingTransfer(trf)
                                setActionType('cancel')
                                setCancelReason('')
                              }}
                              className="h-8 px-2.5 text-xs font-bold border-rose-200 text-rose-700 hover:bg-rose-50 cursor-pointer"
                              title="إلغاء وعكس العملية وإرجاع الكميات للمخزن المصدر"
                            >
                              <RotateCcw size={13} className="ml-1 text-rose-600" />
                              إلغاء
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Cancel or Edit Reversal */}
      {cancellingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              actionType === 'edit' ? 'bg-amber-50 border-amber-100 text-amber-900' : 'bg-rose-50 border-rose-100 text-rose-900'
            }`}>
              <div className="flex items-center gap-2 font-black text-sm">
                {actionType === 'edit' ? <Edit size={18} className="text-amber-600" /> : <AlertTriangle size={18} className="text-rose-600" />}
                <span>{actionType === 'edit' ? 'تعديل إذن التحويل المخزني' : 'إلغاء وعكس إذن التحويل المخزني'}</span>
              </div>
              <button
                onClick={() => setCancellingTransfer(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">رقم الإذن:</span>
                  <span className="font-mono font-black text-indigo-700">{cancellingTransfer.transferNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">مسار التحويل:</span>
                  <span className="font-bold text-slate-800">من {cancellingTransfer.fromWarehouse?.name} إلى {cancellingTransfer.toWarehouse?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">إجمالي المنقول:</span>
                  <span className="font-mono font-black text-slate-900">{cancellingTransfer.totalQuantity} قطعة ({cancellingTransfer.totalItems} أصناف)</span>
                </div>
              </div>

              <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                actionType === 'edit'
                  ? 'bg-amber-50/70 border-amber-200 text-amber-900 font-medium'
                  : 'bg-rose-50/70 border-rose-200 text-rose-900 font-medium'
              }`}>
                {actionType === 'edit' ? (
                  <p>
                    سيقوم النظام بـ <strong>عكس الكميات المحولة فوراً</strong> وإرجاعها للمخزن المصدر، ثم فتح بنود هذا الإذن في شاشة <strong>"إذن تحويل جديد"</strong> لتتمكن من تعديل الكميات أو المخازن أو إضافة/حذف أصناف وإعادة الترحيل بكل سلاسة.
                  </p>
                ) : (
                  <p>
                    هل أنت متأكد من إلغاء هذا الإذن؟ سيتم <strong>خصم الكميات من المخزن المستلم وإعادتها فوراً إلى المخزن المصدر</strong>، وتوثيق حركة عكسية في دفتر أستاذ المخزون مع وسم الإذن كـ "ملغى".
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">سبب {actionType === 'edit' ? 'التعديل' : 'الإلغاء'} (اختياري):</label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={actionType === 'edit' ? 'مثال: خطأ في كمية صنف، تصحيح المخزن...' : 'مثال: تم إدخال الإذن بالخطأ...'}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancellingTransfer(null)}
                disabled={cancelLoading}
                className="text-xs font-bold text-slate-700 border-slate-200 cursor-pointer"
              >
                تراجع
              </Button>

              <Button
                size="sm"
                onClick={handleCancelConfirm}
                disabled={cancelLoading}
                className={`text-xs font-bold text-white px-5 h-9 rounded-xl shadow-xs cursor-pointer ${
                  actionType === 'edit' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {cancelLoading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>جاري عكس العملية...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    {actionType === 'edit' ? <Edit size={14} /> : <RotateCcw size={14} />}
                    <span>{actionType === 'edit' ? 'تأكيد وعكس للبدء بالتعديل' : 'تأكيد الإلغاء وعكس الرصيد'}</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

  {/* 6. Printable Stock Transfer Note Modal */}
      {showPrintModal && printedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Printer size={18} className="text-indigo-600" />
                معاينة وطباعة إذن التحويل المخزني
              </span>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Document Body */}
            <div id="printable-transfer-document" className="flex-1 overflow-y-auto p-8 space-y-6 bg-white text-slate-900">
              {/* Cancelled Alert Banner */}
              {printedTransfer.status === 'cancelled' && (
                <div className="p-3 bg-rose-50 border-2 border-rose-500 rounded-xl text-center text-rose-800 font-black text-xs flex items-center justify-center gap-2">
                  <Ban size={18} className="text-rose-600 shrink-0" />
                  <span>تنبيه: هذا الإذن ملغى رسمياً وتم عكس كمياته وإرجاعها للمخزن المصدر</span>
                  {printedTransfer.cancelReason && (
                    <span className="text-[11px] font-bold text-rose-700">({printedTransfer.cancelReason})</span>
                  )}
                </div>
              )}

              {/* Document Letterhead */}
              <div className="border-b-2 border-slate-900 pb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">إذن تحويل وتسليم بضاعة داخلي</h2>
                  <p className="text-xs text-slate-500 font-bold mt-1">STOCK TRANSFER & DELIVERY NOTE</p>
                </div>
                <div className="text-left space-y-1 font-mono text-xs">
                  <p>رقم الإذن: <strong className="text-sm font-black text-indigo-700">{printedTransfer.ref}</strong></p>
                  <p>التاريخ: <strong>{printedTransfer.date}</strong></p>
                </div>
              </div>

              {/* Warehouse Details Box */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold">المخزن المصدر (المُسلّم):</span>
                  <p className="font-black text-sm text-slate-900">{printedTransfer.fromWarehouse}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-500 font-bold">المخزن المستلم (المُستلم):</span>
                  <p className="font-black text-sm text-slate-900">{printedTransfer.toWarehouse}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-right text-xs border border-slate-300">
                <thead className="bg-slate-100 font-black border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 border-l border-slate-300 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 border-l border-slate-300">اسم الصنف والوصف</th>
                    <th className="py-2.5 px-3 border-l border-slate-300 w-32 font-mono">الباركود / SKU</th>
                    <th className="py-2.5 px-3 border-l border-slate-300 w-24 text-center">الكمية</th>
                    <th className="py-2.5 px-3 w-36">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printedTransfer.items.map((line, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-mono">{i + 1}</td>
                      <td className="py-2 px-3 border-l border-slate-200 font-bold">{line.item.name}</td>
                      <td className="py-2 px-3 border-l border-slate-200 font-mono text-[11px] text-slate-600">{line.item.sku}</td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-black font-mono text-sm">{line.qty} {line.item.uom || 'قطعة'}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-500">{line.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-black border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 text-left border-l border-slate-300">إجمالي كمية البضاعة المنقولة:</td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm text-indigo-700">{printedTransfer.totalPieces} قطعة</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>

              {printedTransfer.note && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold text-slate-600">البيان: </span>
                  <span>{printedTransfer.note}</span>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs font-bold text-slate-700 border-t border-slate-200">
                <div className="space-y-8">
                  <p>أمين المخزن المصدر (الصرف)</p>
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                </div>
                <div className="space-y-8">
                  <p>مسؤول النقل / السائق</p>
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                </div>
                <div className="space-y-8">
                  <p>أمين المخزن المستلم (الاستلام)</p>
                  <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrintModal(false)}
                className="text-xs font-bold border-slate-200 text-slate-700"
              >
                إغلاق
              </Button>

              <Button
                onClick={handlePrint}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 h-9 rounded-xl shadow-sm cursor-pointer"
              >
                <Printer size={15} className="ml-1.5" />
                طباعة المستند الآن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
