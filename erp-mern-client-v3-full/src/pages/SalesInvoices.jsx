/**
 * SalesInvoices Page
 * 
 * Main page for managing sales invoices.
 * Refactored: Components extracted to src/components/sales-invoices/
 */

import { useEffect, useState } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { Plus, X, Minus, Printer } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import SalesInvoiceModal from '../components/modals/SalesInvoiceModal'
import { usePermission } from '../hooks/usePermission'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Button } from '../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '../components/ui/Dialog'
import { NativeSelect } from '../components/ui/Select'

// Extracted Components
import {
  InvoiceFilters,
  InvoicesTable,
  InvoicePagination
} from '../components/sales-invoices'

export default function SalesInvoices() {
  const { canDelete } = usePermission()
  const { me } = useAuth()
  const { push } = useToast()
  const { settings } = useSettings()

  // Helper to check print settings
  const show = (key) => settings[key] !== false

  // Data State
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [accounts, setAccounts] = useState([])
  const [list, setList] = useState([])
  const [stockMap, setStockMap] = useState({})
  const [loading, setLoading] = useState(false)

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [actionModal, setActionModal] = useState({ show: false, type: '', order: null })
  const [actionForm, setActionForm] = useState({ treasuryId: '', processPayment: true })
  const [returnModal, setReturnModal] = useState({ show: false, invoice: null })
  const [returnItems, setReturnItems] = useState([])
  const [returnWarehouse, setReturnWarehouse] = useState('')
  const [returnNote, setReturnNote] = useState('')
  const [viewModal, setViewModal] = useState({ show: false, invoice: null })
  const [printInvoice, setPrintInvoice] = useState(null)

  // Filter State
  const [searchParams, setSearchParams] = useState({ client: '', dateFrom: '', dateTo: '', item: '' })
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  // Table State
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // ============================================================
  // DATA LOADING
  // ============================================================

  const loadAll = async () => {
    try {
      const promises = [
        api.get('/customers'),
        api.get('/inventory/items'),
        api.get('/inventory/warehouses'),
        api.get('/sales/invoice?limit=5000'),
      ]

      const isRestricted = me?.role === 'cashier'
      if (!isRestricted) {
        promises.push(api.get('/finance/accounts'))
      }

      const results = await Promise.all(promises)

      setCustomers(results[0].data || [])
      setItems((results[1].data?.items) || [])
      setWarehouses(results[2].data || [])
      // Backend returns { docs: [...], totalDocs, ... } - extract docs array
      const invoiceData = results[3].data?.docs || results[3].data || []
      setList(Array.isArray(invoiceData) ? invoiceData : [])
      setAccounts(!isRestricted ? (results[4].data || []) : [])

    } catch (err) {
      console.error('Failed to load sales orders data', err)
      const msg = err?.response?.status === 403
        ? 'غير مصرح لك بعرض بعض البيانات'
        : (err?.response?.data?.message || 'فشل تحميل البيانات')
      push('error', msg)
    }
  }

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const { data } = await api.get(`/inventory/stock/balances?limit=5000`)
        const map = {}
        if (data.rows) {
          data.rows.forEach(row => {
            if (row.item?._id && row.warehouse) {
              if (!map[row.item._id]) map[row.item._id] = { total: 0, warehouses: {} }
              map[row.item._id].total += row.balance
              map[row.item._id].warehouses[row.warehouse._id] = { qty: row.balance, name: row.warehouse.name }
            }
          })
        }
        setStockMap(map)
      } catch (err) {
        console.error('Failed to load stock', err)
      }
    }
    fetchStock()
  }, [])

  // ============================================================
  // FILTERING, SORTING & PAGINATION
  // ============================================================

  const filteredList = (Array.isArray(list) ? list : []).filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false

    const total = inv.totals?.grand || 0
    const paid = inv.totals?.paid || 0
    const remaining = total - paid

    if (paymentFilter === 'paid' && remaining > 0.01) return false
    if (paymentFilter === 'unpaid' && paid > 0.01) return false
    if (paymentFilter === 'partial' && (remaining <= 0.01 || paid <= 0.01)) return false

    const matchClient = !searchParams.client || (inv.customer?.name || '').toLowerCase().includes(searchParams.client.toLowerCase())
    const matchItem = !searchParams.item || (inv.items || []).some(i => {
      const itemName = typeof i.item === 'object' ? i.item.name : ''
      const itemSku = typeof i.item === 'object' ? i.item.sku : ''
      return itemName.toLowerCase().includes(searchParams.item.toLowerCase()) || itemSku.toLowerCase().includes(searchParams.item.toLowerCase())
    })

    let matchDate = true
    const invDate = inv.date || inv.createdAt
    if (searchParams.dateFrom) matchDate = matchDate && new Date(invDate) >= new Date(searchParams.dateFrom)
    if (searchParams.dateTo) {
      const nextDay = new Date(searchParams.dateTo)
      nextDay.setDate(nextDay.getDate() + 1)
      matchDate = matchDate && new Date(invDate) < nextDay
    }

    return matchClient && matchItem && matchDate
  })

  const sortedList = [...filteredList].sort((a, b) => {
    const { key, direction } = sortConfig
    let aVal, bVal

    switch (key) {
      case 'createdAt': aVal = new Date(a.date || a.createdAt).getTime(); bVal = new Date(b.date || b.createdAt).getTime(); break
      case 'total': aVal = a.totals?.grand || 0; bVal = b.totals?.grand || 0; break
      case 'remaining': aVal = (a.totals?.grand || 0) - (a.totals?.paid || 0); bVal = (b.totals?.grand || 0) - (b.totals?.paid || 0); break
      case 'id': aVal = a._id; bVal = b._id; break
      default: return 0
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1
    if (aVal > bVal) return direction === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = Math.ceil(sortedList.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedList = sortedList.slice(startIndex, endIndex)

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  // ============================================================
  // ACTION HANDLERS
  // ============================================================

  const handleActionClick = (order, type) => {
    setActionModal({ show: true, type, order })
    setActionForm({ treasuryId: '', processPayment: true })
  }

  const executeAction = async () => {
    const { type, order } = actionModal
    const { treasuryId, processPayment } = actionForm

    if (processPayment && !treasuryId) return push('error', 'اختر الخزينة')

    setLoading(true)
    try {
      await api.patch(`/sales/invoice/${order._id}/status`, { status: type })

      if (processPayment) {
        const amount = order.totals?.grand || order.items.reduce((acc, item) => acc + (item.qty * item.price), 0)

        if (type === 'confirmed') {
          await api.post('/finance/receipts', {
            customer: order.customer?._id || order.customer,
            date: new Date().toISOString().split('T')[0],
            amount, method: 'cash', accountId: treasuryId,
            note: `تحصيل تلقائي من فاتورة مبيعات #${order._id.slice(-6)}`,
            invoices: [order._id]
          })
        } else if (type === 'cancelled') {
          await api.post('/finance/payments', {
            supplier: null, beneficiary: order.customer?.name || 'Customer',
            date: new Date().toISOString().split('T')[0],
            amount, method: 'cash', accountId: treasuryId,
            note: `استرجاع قيمة فاتورة مبيعات #${order._id.slice(-6)}`
          })
        }
      }

      push('success', type === 'confirmed' ? 'تم تأكيد الفاتورة' : 'تم إلغاء الفاتورة')
      setActionModal({ show: false, type: '', order: null })
      await loadAll()
    } catch (e) {
      console.error(e)
      push('error', 'حدث خطأ أثناء تنفيذ العملية')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenReturn = (invoice) => {
    const items = (invoice.items || []).map(i => ({
      item: typeof i.item === 'object' ? i.item._id : i.item,
      name: typeof i.item === 'object' ? i.item.name : 'منتج',
      sku: typeof i.item === 'object' ? i.item.sku : '',
      originalQty: i.qty, price: i.price, returnQty: 0, alreadyReturned: 0
    }))

    if (invoice.returns?.length) {
      invoice.returns.forEach(ret => {
        const itemId = typeof ret.item === 'object' ? ret.item._id : ret.item
        const found = items.find(i => i.item === itemId)
        if (found) found.alreadyReturned += ret.qty
      })
    }

    setReturnItems(items)
    setReturnWarehouse('')
    setReturnNote('')
    setReturnModal({ show: true, invoice })
  }

  const handleReturnSubmit = async () => {
    const itemsToReturn = returnItems.filter(i => i.returnQty > 0).map(i => ({ item: i.item, qty: i.returnQty }))

    if (!itemsToReturn.length) return push('error', 'اختر الأصناف المراد إرجاعها')
    if (!returnWarehouse) return push('error', 'اختر المستودع')

    setLoading(true)
    try {
      await api.post(`/sales/invoice/${returnModal.invoice._id}/return`, {
        items: itemsToReturn, warehouse: returnWarehouse, note: returnNote
      })
      push('success', 'تم استرجاع الأصناف بنجاح')
      setReturnModal({ show: false, invoice: null })
      await loadAll()
    } catch (e) {
      push('error', e?.response?.data?.message || 'فشل استرجاع الأصناف')
    } finally {
      setLoading(false)
    }
  }

  const updateReturnQty = (index, qty) => {
    setReturnItems(prev => prev.map((item, i) => {
      if (i === index) {
        const maxReturn = item.originalQty - item.alreadyReturned
        return { ...item, returnQty: Math.min(Math.max(0, qty), maxReturn) }
      }
      return item
    }))
  }

  const handlePrint = (order) => {
    setPrintInvoice(order)
    setTimeout(() => window.print(), 300)
  }

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================

  const exportToExcel = () => {
    const dataToExport = sortedList.map((inv, index) => ({
      'الرقم': index + 1,
      'رقم الفاتورة': inv._id.slice(-6),
      'التاريخ': new Date(inv.date || inv.createdAt).toLocaleDateString('ar-SA'),
      'العميل': inv.customer?.name || 'عميل عابر',
      'الإجمالي': (inv.totals?.grand || 0).toFixed(2),
      'المدفوع': (inv.totals?.paid || 0).toFixed(2),
      'المتبقي': ((inv.totals?.grand || 0) - (inv.totals?.paid || 0)).toFixed(2),
      'الحالة': inv.status
    }))

    const ws = XLSX.utils.json_to_sheet(dataToExport)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'فواتير المبيعات')
    XLSX.writeFile(wb, `فواتير_المبيعات_${new Date().toISOString().split('T')[0]}.xlsx`)
    push('success', `تم تصدير ${sortedList.length} فاتورة إلى Excel`)
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    doc.setFont('helvetica')
    doc.setFontSize(16)
    doc.text('Sales Invoices Report', 105, 15, { align: 'center' })

    const tableData = sortedList.map((inv, index) => [
      index + 1, inv._id.slice(-6),
      new Date(inv.date || inv.createdAt).toLocaleDateString(),
      inv.customer?.name || 'Walk-in',
      (inv.totals?.grand || 0).toFixed(2),
      ((inv.totals?.grand || 0) - (inv.totals?.paid || 0)).toFixed(2),
      inv.status
    ])

    autoTable(doc, {
      startY: 25,
      head: [['#', 'Invoice', 'Date', 'Customer', 'Total', 'Remaining', 'Status']],
      body: tableData,
      styles: { font: 'helvetica', fontSize: 8 }
    })

    doc.save(`sales_invoices_${new Date().toISOString().split('T')[0]}.pdf`)
    push('success', `تم تصدير ${sortedList.length} فاتورة إلى PDF`)
  }

  const formatCurrency = (value) => Number(value || 0).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD' })

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="h2">فواتير المبيعات</h1>
          <p className="muted">إدارة عروض الأسعار وفواتير البيع</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button className="px-4 py-2 rounded-md text-sm font-medium bg-white shadow text-primary-600">
            قائمة الفواتير
          </button>
          <button
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-white/50"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} className="inline-block ml-1" />
            إنشاء فاتورة آجلة
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="card flex-1 flex flex-col min-h-0 shadow-md border-0">
        {/* Filters */}
        <InvoiceFilters
          searchParams={searchParams}
          onSearchChange={setSearchParams}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          paymentFilter={paymentFilter}
          onPaymentChange={setPaymentFilter}
          totalResults={sortedList.length}
          onExportExcel={exportToExcel}
          onExportPDF={exportToPDF}
        />

        {/* Table */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <InvoicesTable
            invoices={paginatedList}
            selectedInvoices={selectedInvoices}
            sortConfig={sortConfig}
            canDelete={canDelete}
            onSort={handleSort}
            onSelectAll={setSelectedInvoices}
            onSelectInvoice={setSelectedInvoices}
            onView={(inv) => setViewModal({ show: true, invoice: inv })}
            onPrint={handlePrint}
            onConfirm={(inv) => handleActionClick(inv, 'confirmed')}
            onCancel={(inv) => handleActionClick(inv, 'cancelled')}
            onReturn={handleOpenReturn}
          />

          {/* Pagination */}
          {paginatedList.length > 0 && (
            <InvoicePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedList.length}
              startIndex={startIndex}
              endIndex={endIndex}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(value) => { setItemsPerPage(value); setCurrentPage(1) }}
            />
          )}
        </div>
      </div>

      {/* Create Invoice Modal */}
      <SalesInvoiceModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async () => { await loadAll(); setShowCreateModal(false) }}
        customers={customers}
        warehouses={warehouses}
        treasuries={accounts}
        items={items}
        stockMap={stockMap}
      />

      {/* Action Modal - Modern Dialog */}
      <Dialog open={actionModal.show} onOpenChange={(open) => !open && setActionModal({ show: false, type: '', order: null })}>
        <DialogContent className="max-w-sm" onClose={() => setActionModal({ show: false, type: '', order: null })}>
          <DialogHeader>
            <DialogTitle className="text-center">
              {actionModal.type === 'confirmed' ? 'تأكيد الفاتورة' : 'إلغاء الفاتورة'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                id="processPayment"
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={actionForm.processPayment}
                onChange={e => setActionForm({ ...actionForm, processPayment: e.target.checked })}
              />
              <label htmlFor="processPayment" className="font-medium text-slate-700 cursor-pointer">
                {actionModal.type === 'confirmed' ? 'تحصيل للخزينة' : 'استرجاع المبلغ'}
              </label>
            </div>
            {actionForm.processPayment && (
              <NativeSelect
                value={actionForm.treasuryId}
                onChange={e => setActionForm({ ...actionForm, treasuryId: e.target.value })}
              >
                <option value="">اختر الخزينة...</option>
                {accounts.filter(a => a.type === 'asset').map(acc => (
                  <option key={acc._id} value={acc._id}>{acc.name}</option>
                ))}
              </NativeSelect>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionModal({ show: false, type: '', order: null })}
            >
              إلغاء
            </Button>
            <Button
              variant={actionModal.type === 'confirmed' ? 'default' : 'destructive'}
              onClick={executeAction}
              loading={loading}
            >
              {actionModal.type === 'confirmed' ? 'تأكيد' : 'إلغاء الفاتورة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Modal */}
      {returnModal.show && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold mb-2">إرجاع فاتورة #{returnModal.invoice?._id.slice(-6)}</h3>
                  <p className="text-sm text-indigo-100">العميل: {returnModal.invoice?.customer?.name || 'عميل عابر'}</p>
                </div>
                <button onClick={() => setReturnModal({ show: false, invoice: null })} className="p-2 hover:bg-white/20 rounded-lg">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">المستودع *</label>
                  <select value={returnWarehouse} onChange={e => setReturnWarehouse(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">اختر المستودع...</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">سبب الإرجاع</label>
                  <input value={returnNote} onChange={e => setReturnNote(e.target.value)} placeholder="اختياري..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr className="text-right">
                      <th className="p-3 text-sm font-bold">اسم المنتج</th>
                      <th className="p-3 text-sm font-bold text-center">السعر</th>
                      <th className="p-3 text-sm font-bold text-center">المشتراة</th>
                      <th className="p-3 text-sm font-bold text-center">كمية الإرجاع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {returnItems.map((item, index) => {
                      const available = item.originalQty - item.alreadyReturned
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="font-bold text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-500">{item.sku}</div>
                          </td>
                          <td className="p-3 text-center font-medium">{item.price.toFixed(2)} د.ل</td>
                          <td className="p-3 text-center">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">{item.originalQty}</span>
                            {item.alreadyReturned > 0 && <div className="text-xs text-purple-600 mt-1">(مُرتجع: {item.alreadyReturned})</div>}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => updateReturnQty(index, item.returnQty - 1)} disabled={item.returnQty === 0} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-30">
                                <Minus size={16} />
                              </button>
                              <input type="number" min="0" max={available} value={item.returnQty} onChange={e => updateReturnQty(index, Number(e.target.value))} className="w-16 px-2 py-1 text-center border-2 rounded-lg font-bold text-lg" />
                              <button onClick={() => updateReturnQty(index, item.returnQty + 1)} disabled={item.returnQty >= available} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-30">
                                <Plus size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                <span className="text-lg font-bold text-gray-700">إجمالي المبلغ المُرتجع:</span>
                <span className="text-2xl font-bold text-purple-600">{returnItems.reduce((sum, item) => sum + (item.returnQty * item.price), 0).toFixed(2)} د.ل</span>
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button onClick={() => setReturnModal({ show: false, invoice: null })} className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100" disabled={loading}>إلغاء</button>
              <button onClick={handleReturnSubmit} className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold hover:from-indigo-700 hover:to-purple-700 shadow-lg disabled:opacity-50" disabled={loading || returnItems.every(i => i.returnQty === 0) || !returnWarehouse}>
                {loading ? 'جاري الإرجاع...' : 'تأكيد الإرجاع'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {viewModal.show && viewModal.invoice && (
        <div className="modal-overlay">
          <div className="modal-content max-w-4xl">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold mb-2">تفاصيل الفاتورة #{viewModal.invoice._id.slice(-6)}</h3>
                  <div className="flex gap-4 text-sm text-blue-100">
                    <span>العميل: {viewModal.invoice.customer?.name || 'عميل عابر'}</span>
                    <span>التاريخ: {new Date(viewModal.invoice.date || viewModal.invoice.createdAt).toLocaleDateString('ar-LY')}</span>
                  </div>
                </div>
                <button onClick={() => setViewModal({ show: false, invoice: null })} className="p-2 hover:bg-white/20 rounded-lg">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <div className="text-xs text-emerald-600 font-bold mb-1">الإجمالي</div>
                  <div className="text-2xl font-bold text-emerald-700">{(viewModal.invoice.totals?.grand || 0).toFixed(2)} د.ل</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-xs text-blue-600 font-bold mb-1">المدفوع</div>
                  <div className="text-2xl font-bold text-blue-700">{(viewModal.invoice.totals?.paid || 0).toFixed(2)} د.ل</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="text-xs text-orange-600 font-bold mb-1">المتبقي</div>
                  <div className="text-2xl font-bold text-orange-700">{Math.max(0, (viewModal.invoice.totals?.grand || 0) - (viewModal.invoice.totals?.paid || 0)).toFixed(2)} د.ل</div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-lg mb-3">الأصناف</h4>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr className="text-right">
                        <th className="p-3 text-sm font-bold">#</th>
                        <th className="p-3 text-sm font-bold">اسم الصنف</th>
                        <th className="p-3 text-sm font-bold text-center">الكمية</th>
                        <th className="p-3 text-sm font-bold text-center">السعر</th>
                        <th className="p-3 text-sm font-bold text-center">المجموع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(viewModal.invoice.items || []).map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-3 text-gray-600">{index + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-gray-900">{typeof item.item === 'object' ? item.item.name : 'منتج'}</div>
                            <div className="text-xs text-gray-500">{typeof item.item === 'object' ? item.item.sku : ''}</div>
                          </td>
                          <td className="p-3 text-center font-medium">{item.qty}</td>
                          <td className="p-3 text-center font-medium">{item.price.toFixed(2)} د.ل</td>
                          <td className="p-3 text-center font-bold text-indigo-600">{(item.qty * item.price).toFixed(2)} د.ل</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-b-2xl flex justify-between items-center border-t">
              <div className="text-sm text-gray-600">آخر تحديث: {new Date(viewModal.invoice.updatedAt || viewModal.invoice.createdAt).toLocaleString('ar-LY')}</div>
              <div className="flex gap-3">
                <button onClick={() => setViewModal({ show: false, invoice: null })} className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100">إغلاق</button>
                <button onClick={() => handlePrint(viewModal.invoice)} className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 shadow-lg flex items-center gap-2">
                  <Printer size={18} />
                  طباعة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Area */}
      <div className="fixed top-0 left-0 w-full invisible print:visible print:z-9999">
        {printInvoice && (
          <div id="receipt-print" className="bg-white text-black font-sans w-full max-w-[210mm] mx-auto min-h-[297mm] flex flex-col p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
              <div>
                {/* Logo */}
                {show('print_showLogo') && settings.logo && (
                  <img src={settings.logo} alt="Logo" className="h-12 mb-2 object-contain" />
                )}

                {/* Company Name */}
                {show('print_showCompanyName') && (
                  <h1 className="text-2xl font-black text-slate-900 mb-1">
                    {settings.companyName || 'اسم المتجر'}
                  </h1>
                )}

                <div className="text-xs text-slate-600 space-y-0.5 font-medium">
                  {/* Address */}
                  {show('print_showAddress') && settings.address && (
                    <p>العنوان: {settings.address}</p>
                  )}

                  {/* Phone */}
                  {show('print_showPhone') && settings.phone && (
                    <p>هاتف: {settings.phone}</p>
                  )}

                  {/* Commercial Register */}
                  {show('print_showCommercialRegister') && settings.commercialRegister && (
                    <p>سجل تجاري: {settings.commercialRegister}</p>
                  )}
                </div>
              </div>

              <div className="text-left">
                <h2 className="text-xl font-bold text-slate-400 uppercase tracking-wider">فاتورة مبيعات</h2>

                {/* Invoice Number */}
                {show('print_showInvoiceNumber') && (
                  <p className="text-lg font-bold mt-1 font-mono text-slate-900">#{printInvoice.invoiceNumber || printInvoice._id.slice(-6)}</p>
                )}
              </div>
            </div>

            {/* Invoice Info - Customer & Date */}
            <div className="flex justify-between mb-6 text-xs">
              <div className="flex-1">
                {/* Customer Info */}
                {printInvoice.customer && (
                  <>
                    {show('print_showCustomerName') && printInvoice.customer.name && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-500 w-12">العميل:</span>
                        <span className="font-bold text-slate-900 text-sm">{printInvoice.customer.name}</span>
                      </div>
                    )}

                    {show('print_showCustomerPhone') && printInvoice.customer.phone && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-500 w-12">الهاتف:</span>
                        <span className="font-mono text-slate-700">{printInvoice.customer.phone}</span>
                      </div>
                    )}

                    {show('print_showCustomerAddress') && printInvoice.customer.address && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 w-12">العنوان:</span>
                        <span className="text-slate-700">{printInvoice.customer.address}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Date/Time */}
              {show('print_showDateTime') && (
                <div className="flex gap-8 text-left">
                  <div>
                    <span className="block font-bold text-slate-400 mb-0.5">التاريخ</span>
                    <span className="font-bold text-slate-900">{new Date(printInvoice.date || printInvoice.createdAt).toLocaleDateString('ar-LY')}</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-400 mb-0.5">الوقت</span>
                    <span className="font-bold text-slate-900 font-mono">{new Date(printInvoice.date || printInvoice.createdAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="flex-1">
              <table className="w-full text-right mb-4 border-collapse border border-slate-900/10">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-900 text-xs uppercase tracking-tight">
                    {show('print_showRowNumber') && (
                      <th className="py-1.5 px-2 text-center border-l border-slate-200 w-8 font-black text-slate-700">#</th>
                    )}
                    {show('print_showItemCode') && (
                      <th className="py-1.5 px-2 text-right border-l border-slate-200 font-black text-slate-700 w-32">الكود</th>
                    )}
                    {show('print_showItemName') && (
                      <th className="py-1.5 px-2 text-right border-l border-slate-200 font-black text-slate-700">الصنف</th>
                    )}
                    {show('print_showQuantity') && (
                      <th className="py-1.5 px-2 text-center border-l border-slate-200 font-black text-slate-700 w-16">الكمية</th>
                    )}
                    {show('print_showUnitPrice') && (
                      <th className="py-1.5 px-2 text-center border-l border-slate-200 font-black text-slate-700 w-24">السعر</th>
                    )}
                    {show('print_showItemTotal') && (
                      <th className="py-1.5 px-2 text-left font-black text-slate-700 w-24">الإجمالي</th>
                    )}
                  </tr>
                </thead>
                <tbody className="text-[11px] leading-tight">
                  {(printInvoice.items || []).map((item, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                      {show('print_showRowNumber') && (
                        <td className="py-1 px-2 text-center border-l border-slate-100 font-mono text-slate-400">{i + 1}</td>
                      )}
                      {show('print_showItemCode') && (
                        <td className="py-1 px-2 font-mono text-slate-600 border-l border-slate-100">{typeof item.item === 'object' ? (item.item.sku || '-') : '-'}</td>
                      )}
                      {show('print_showItemName') && (
                        <td className="py-1 px-2 font-bold text-slate-800 border-l border-slate-100">{typeof item.item === 'object' ? item.item.name : 'منتج'}</td>
                      )}
                      {show('print_showQuantity') && (
                        <td className="py-1 px-2 text-center font-mono font-bold text-slate-700 border-l border-slate-100">{item.qty}</td>
                      )}
                      {show('print_showUnitPrice') && (
                        <td className="py-1 px-2 text-center font-mono text-slate-600 border-l border-slate-100">{formatCurrency(item.price)}</td>
                      )}
                      {show('print_showItemTotal') && (
                        <td className="py-1 px-2 text-left font-bold font-mono text-slate-900">{formatCurrency(item.qty * item.price)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Totals */}
            <div className="mt-4 pt-4 border-t-2 border-slate-900 flex justify-end">
              <div className="w-64 flex flex-col gap-1.5 text-xs">
                {/* Subtotal */}
                {show('print_showSubtotal') && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="font-medium">المجموع الفرعي:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency((printInvoice.items || []).reduce((acc, i) => acc + (i.qty * i.price), 0))}</span>
                  </div>
                )}

                {/* Discount */}
                {show('print_showDiscount') && printInvoice.totals?.discount > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <span className="font-medium">خصم:</span>
                    <span className="font-mono font-bold">-{formatCurrency(printInvoice.totals.discount)}</span>
                  </div>
                )}

                <div className="my-1 border-t border-slate-200"></div>

                {/* Grand Total */}
                {show('print_showGrandTotal') && (
                  <div className="flex justify-between items-center text-lg font-black text-slate-900">
                    <span>الإجمالي:</span>
                    <span className="font-mono">{formatCurrency(printInvoice.totals?.grand || 0)}</span>
                  </div>
                )}

                {/* Paid Amount */}
                {show('print_showPaidAmount') && (
                  <div className="flex justify-between items-center text-slate-500 mt-1">
                    <span>المدفوع:</span>
                    <span className="font-mono font-bold text-slate-700">{formatCurrency(printInvoice.totals?.paid || 0)}</span>
                  </div>
                )}

                {/* Remaining Amount */}
                {show('print_showRemainingAmount') && (printInvoice.totals?.grand || 0) - (printInvoice.totals?.paid || 0) > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-bold">
                    <span>المتبقي:</span>
                    <span className="font-mono">{formatCurrency(Math.max(0, (printInvoice.totals?.grand || 0) - (printInvoice.totals?.paid || 0)))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Note */}
            {show('print_showThankYouMessage') && (
              <div className="mt-8 pt-4 border-t border-slate-200 flex justify-center text-[10px] text-slate-400">
                <span>{settings.thankYouMessage || 'شكراً لتعاملكم معنا'}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
                @media print {
                    body { visibility: hidden; overflow: hidden; }
                    #receipt-print, #receipt-print * { visibility: visible; }
                    #receipt-print { position: absolute; left: 0; top: 0; width: 100%; max-width: 210mm; padding: 20px; margin: 0 auto; }
                    @page { size: A4; margin: 0; }
                }
            `}</style>
    </div>
  )
}
