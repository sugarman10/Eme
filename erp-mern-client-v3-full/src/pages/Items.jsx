import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useWarehouse } from '../context/WarehouseContext'
import { usePermission } from '../hooks/usePermission'
import { StockBreakdownTooltip } from '../components/StockBreakdownTooltip'
import { QuickAdjustmentModal } from '../components/QuickAdjustmentModal'
import { BulkPriceModal } from '../components/BulkPriceModal'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  Image as ImageIcon,
  X,
  Settings,
  Barcode,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Items() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const { warehouses: contextWarehouses } = useWarehouse()
  const { isAdmin, isManager } = usePermission()
  const canViewCost = isAdmin || isManager
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [activeTab, setActiveTab] = useState('details') // details, stock
  const [showQuickAdjust, setShowQuickAdjust] = useState(false)
  const [adjustingItem, setAdjustingItem] = useState(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)

  // Form State
  const [form, setForm] = useState({
    sku: '',
    name: '',
    barcode: '',
    category: '',
    uom: 'pcs',
    cost: 0,
    price: 0,
    wholesalePrice: 0,
    reorderLevel: 0,
    initialStock: 0,
    warehouse: ''
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')

  // --- React Query Hooks ---

  // 1. Fetch Items
  const { data: queryData, isLoading } = useQuery({
    queryKey: ['items', page, search],
    queryFn: async () => {
      const { data } = await api.get('/inventory/items', {
        params: { page, limit: 20, q: search }
      })
      return data
    },
    onError: (err) => {
      console.error('Failed to fetch items', err)
      push('error', err?.response?.data?.message || 'فشل تحميل العناصر')
    }
  })

  const items = queryData?.items || []
  const totalPages = queryData?.pages || 1

  // 1b. Fetch Stock Balances (for main table display)
  const { data: stockBalances = [] } = useQuery({
    queryKey: ['stock-balances'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/stock/balances?limit=5000')
      return data.rows || []
    }
  })

  // Calculate total stock per item using Backend V2 data
  const itemsWithStock = items.map(item => {
    // V2: Calculate from stockBalances ledger (Source of Truth)
    const stockEntries = stockBalances.filter(sb => (sb.item?._id || sb.item) === item._id)
    const hasV2Data = stockEntries.length > 0
    const v2Stock = stockEntries.reduce((sum, sb) => sum + (sb.balance || 0), 0)

    // Fallback: Use backend provided total or legacy stocks array
    const legacyStock = item.totalStock ?? item.stocks?.reduce((sum, s) => sum + (s.qty || 0), 0) ?? 0

    const finalStock = hasV2Data ? v2Stock : legacyStock

    return {
      ...item,
      stock: finalStock,
      totalStock: finalStock
    }
  })

  // 2. Create/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      // Use FormData for image upload support
      if (editingItem) {
        return api.put(`/inventory/items/${editingItem._id}`, formData)
      } else {
        return api.post('/inventory/items', formData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['items'])
      queryClient.invalidateQueries(['stock-balances'])
      push('success', editingItem ? 'تم تحديث الصنف بنجاح' : 'تمت إضافة الصنف بنجاح')
      handleCloseModal()
    },
    onError: (err) => {
      const resp = err?.response?.data
      if (resp?.errors && Array.isArray(resp.errors)) {
        push('error', resp.errors[0].msg || 'بيانات غير صحيحة')
      } else {
        push('error', resp?.message || 'فشل الحفظ')
      }
    }
  })

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return api.delete(`/inventory/items/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['items'])
      queryClient.invalidateQueries(['stock-balances'])
      push('success', 'تم حذف الصنف')
    },
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل الحذف')
    }
  })

  // 4. Fetch Warehouses (for dropdowns)
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/warehouses')
      return data || []
    },
    enabled: showModal // Only fetch when needed
  })

  // 5. Fetch Item Stock Details (for Stock Tab in Modal)
  const { data: itemStock = [], refetch: refetchStock } = useQuery({
    queryKey: ['item-stock', editingItem?._id],
    queryFn: async () => {
      if (!editingItem) return []
      const { data } = await api.get(`/inventory/stock/balances?item=${editingItem._id}`)

      // Group by warehouse to avoid duplicates
      const balancesByWarehouse = {}
        ; (data.rows || []).forEach(stock => {
          const whId = stock.warehouseId || stock.warehouse?._id
          const whName = stock.warehouse?.name || 'مستودع غير معروف'

          if (whId) {
            if (!balancesByWarehouse[whId]) {
              balancesByWarehouse[whId] = {
                warehouse: { _id: whId, name: whName },
                balance: 0
              }
            }
            balancesByWarehouse[whId].balance += (stock.balance || 0)
          }
        })
      return Object.values(balancesByWarehouse)
    },
    enabled: !!editingItem && showModal
  })

  // 6. Add Stock Mutation (Quick Adjustment)
  const addStockMutation = useMutation({
    mutationFn: async (data) => {
      return api.post('/inventory/movements', {
        type: 'IN',
        item: editingItem._id,
        warehouse: data.warehouseId,
        qty: Number(data.qty),
        note: 'تعديل سريع للمخزون من صفحة المنتجات'
      })
    },
    onSuccess: () => {
      refetchStock()
      queryClient.invalidateQueries(['items'])
      queryClient.invalidateQueries(['stock-balances'])
      push('success', 'تم إضافة المخزون بنجاح')
    },
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل إضافة المخزون')
    }
  })

  // 7. Bulk Update Mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (data) => {
      return api.post('/inventory/items/bulk-price', data)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['items'])
      push('success', `تم التحديث بنجاح. تم تعديل ${data.data.modifiedCount} منتج.`)
      setShowBulkModal(false)
    },
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل التحديث')
    }
  })

  // Helper for Image URLs
  // Helper for Image URLs
  const getImageUrl = (path) => {
    if (!path) return ''
    if (path.startsWith('http')) return path

    // Dynamic Server URL (Support LAN/Cloud)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
    const serverUrl = apiUrl.replace(/\/api\/?$/, '') // Remove /api or /api/

    return `${serverUrl}${path}`
  }

  // --- Handlers ---
  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item)
      setForm({
        sku: item.sku,
        name: item.name,
        barcode: item.barcode || '',
        category: item.category || '',
        uom: item.uom || 'pcs',
        cost: item.cost || 0,
        price: item.price || 0,
        wholesalePrice: item.wholesalePrice || 0,
        reorderLevel: item.reorderLevel || item.minStock || 0,
        initialStock: 0,
        warehouse: ''
      })
      setImagePreview(getImageUrl(item.image))
      setImageFile(null)
      setActiveTab('details')
    } else {
      setEditingItem(null)
      setForm({
        sku: '',
        name: '',
        barcode: '',
        category: '',
        uom: 'pcs',
        cost: 0,
        price: 0,
        wholesalePrice: 0,
        reorderLevel: 0,
        initialStock: 0,
        warehouse: ''
      })
      setImagePreview('')
      setImageFile(null)
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setImageFile(null)
    setImagePreview('')
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('sku', form.sku)
    formData.append('name', form.name)
    formData.append('barcode', form.barcode)
    formData.append('category', form.category)
    formData.append('uom', form.uom)
    formData.append('cost', form.cost)
    formData.append('price', form.price)
    formData.append('wholesalePrice', form.wholesalePrice)
    formData.append('reorderLevel', form.reorderLevel)

    if (!editingItem && form.initialStock > 0 && form.warehouse) {
      formData.append('initialStock', form.initialStock)
      formData.append('warehouse', form.warehouse)
    }

    if (imageFile) {
      formData.append('image', imageFile)
    }

    saveMutation.mutate(formData)
  }

  const handleDelete = (item) => {
    setItemToDelete(item)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete._id)
      setItemToDelete(null)
    }
  }

  const filteredItems = itemsWithStock

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-100px)] animate-in p-6 max-w-7xl mx-auto font-sans" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">المنتجات</h1>
          <p className="text-slate-500">إدارة مخزون المنتجات والأسعار</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulkModal(true)}>
            تحديث أسعار جماعي
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <Plus size={18} className="ml-2" />
            إضافة منتج جديد
          </Button>
        </div>
      </div>

      {!showModal ? (
        <Card className="flex-1 flex flex-col min-h-0 shadow-md border-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="relative w-[400px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                className="pr-14! pl-4"
                placeholder="بحث باسم المنتج أو الكود (SKU)..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="text-sm text-slate-500">
              عدد المنتجات: {queryData?.total || 0}
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '80px' }}>صورة</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>الباركود</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>التصنيف</TableHead>
                  {canViewCost && <TableHead>التكلفة</TableHead>}
                  <TableHead>سعر البيع</TableHead>
                  {canViewCost && <TableHead>سعر الجملة</TableHead>}
                  <TableHead>المخزون</TableHead>
                  <TableHead style={{ width: '100px' }}>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center p-8 text-slate-500">جاري التحميل...</TableCell></TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center p-8 text-slate-500">لا توجد منتجات.</TableCell></TableRow>
                ) : (
                  filteredItems.map(item => (
                    <TableRow key={item._id}>
                      <TableCell>
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border flex items-center justify-center overflow-hidden">
                          {item.image ? (
                            <img src={getImageUrl(item.image)} alt={item.name} className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                          ) : (
                            <Package size={20} className="text-slate-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 font-mono">{item.sku}</TableCell>
                      <TableCell className="text-xs text-slate-400 font-mono">
                        {item.barcode ? (
                          <div className="flex items-center gap-1">
                            <Barcode size={12} />
                            {item.barcode}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {item.name}
                          {/* Low Stock Badge */}
                          {(item.minStock > 0 || item.reorderLevel > 0) && (item.totalStock || 0) <= (item.minStock || item.reorderLevel || 0) && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                              <AlertTriangle size={10} />
                              مخزون منخفض
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.category ? (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-800">{item.category}</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      {canViewCost && <TableCell>{Number(item.cost).toLocaleString()} د.ل</TableCell>}
                      <TableCell className="text-green-600 font-bold">{Number(item.price).toLocaleString()} د.ل</TableCell>
                      {canViewCost && <TableCell className="text-amber-600">{Number(item.wholesalePrice || 0).toLocaleString()} د.ل</TableCell>}
                      <TableCell>
                        <StockBreakdownTooltip
                          item={item}
                          warehouses={contextWarehouses}
                        />
                        {item.reorderLevel > 0 && (item.totalStock || 0) <= item.reorderLevel && (
                          <span className="text-xs text-red-500 font-medium block mt-1">منخفض</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenModal(item)}
                            title="تعديل"
                          >
                            <Edit2 size={16} className="text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setAdjustingItem(item)
                              setShowQuickAdjust(true)
                            }}
                            title="تعديل سريع للمخزون"
                          >
                            <Settings size={16} className="text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            title="حذف"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          <div className="p-4 border-t bg-slate-50 flex items-center justify-between shrink-0">
            <div className="text-sm text-slate-500">
              صفحة {page} من {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                size="sm"
              >
                السابق
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isLoading}
                size="sm"
              >
                التالي
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <form id="item-form" onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden font-sans">
          <CardContent className="space-y-6 overflow-y-auto pt-6 flex-1 px-8">

            {/* --- Section 1: Basic Information --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Image & Basic Ids */}
              <div className="space-y-6">
                {/* Image Upload */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-slate-700">صورة المنتج</label>
                  <div className="flex gap-4 items-start">
                    <div className="relative group w-32 h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-blue-500 hover:bg-white transition-all cursor-pointer">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="text-slate-400 group-hover:text-blue-500 transition-colors" size={32} />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileChange}
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <p className="text-white text-xs font-bold">تغيير الصورة</p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 pt-2 space-y-1">
                      <p>انقر لتحميل صورة جديدة.</p>
                      <p>يفضل أبعاد مربعة (500x500).</p>
                    </div>
                  </div>
                </div>

                {/* SKU & Name */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الاسم <span className="text-red-500">*</span></label>
                    <Input
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="font-bold focus-visible:ring-blue-500"
                      placeholder="مثال: قميص قطني فاخر"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رمز المنتج (SKU) <span className="text-red-500">*</span></label>
                    <Input
                      required
                      value={form.sku}
                      onChange={e => setForm({ ...form, sku: e.target.value })}
                      className="font-mono text-sm uppercase focus-visible:ring-blue-500"
                      placeholder="ITEM-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Barcode size={14} />
                      الباركود
                    </label>
                    <Input
                      value={form.barcode}
                      onChange={e => setForm({ ...form, barcode: e.target.value })}
                      className="font-mono text-sm focus-visible:ring-blue-500"
                      placeholder="5901234123457"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Pricing & Categorization */}
              <div className="space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-4 flex items-center gap-2">
                  <Settings size={16} /> تفاصيل التسعير والتصنيف
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">التصنيف</label>
                    <Input
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="bg-white"
                      placeholder="سوبر ماركت، ملابس..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">وحدة القياس</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.uom}
                      onChange={e => setForm({ ...form, uom: e.target.value })}
                    >
                      <option value="pcs">قطعة (pcs)</option>
                      <option value="kg">كيلوجرام (kg)</option>
                      <option value="box">كرتون (box)</option>
                      <option value="m">متر (m)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">سعر التكلفة</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.cost}
                      onChange={e => setForm({ ...form, cost: e.target.value })}
                      className="bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">سعر البيع</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={e => setForm({ ...form, price: e.target.value })}
                      className="bg-white font-mono text-green-700 font-bold"
                    />
                  </div>
                </div>
                {canViewCost && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">سعر الجملة</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.wholesalePrice}
                      onChange={e => setForm({ ...form, wholesalePrice: e.target.value })}
                      className="bg-white font-mono text-purple-700 font-bold"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-200 my-4" />

            {/* --- Section 2: V2 Stock Management Logic --- */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package size={20} className="text-blue-600" /> إدارة المخزون
              </h3>

              {editingItem ? (
                // === EDIT MODE: Read Only + Breakdown ===
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500">إجمالي المخزون (للقراءة فقط)</label>
                      <div className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-100 items-center px-4 text-lg font-black text-slate-700">
                        {Number(editingItem.totalStock || 0).toLocaleString()} <span className="text-xs font-medium text-slate-400 mr-2">{form.uom}</span>
                      </div>
                      <p className="text-[11px] text-amber-600 font-medium">⚠ لا يمكن تعديل المخزون من هنا. استخدم "تعديل سريع" أو المعاملات المخزنية.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500">حد إعادة الطلب</label>
                      <Input
                        type="number"
                        min="0"
                        value={form.reorderLevel}
                        onChange={e => setForm({ ...form, reorderLevel: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Stock Breakdown Mini-Table */}
                  <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600">توزيع المخزون حسب المستودع</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                          <TableHead className="h-8 text-xs">المستودع</TableHead>
                          <TableHead className="h-8 text-xs text-center">الكمية</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {warehouses.length > 0 ? (
                          warehouses.map((w, i) => {
                            // Create a map for faster and safer lookup
                            // We do this outside the map ideally, but inside is also fine for small lists
                            // Let's rely on the map created in the render scope if possible, 
                            // but here we just do a robust find for now to be safe.

                            // Robust ID normalization
                            const wId = String(w._id || w.id);

                            const stockEntry = itemStock.find(s => {
                              const sId = String(s.warehouse?._id || s.warehouse?.id || s.warehouseId);
                              return sId === wId;
                            });

                            const balance = stockEntry?.balance || 0;

                            return (
                              <TableRow key={w._id} className="hover:bg-slate-50 h-9">
                                <TableCell className="py-2 font-medium text-xs">{w.name}</TableCell>
                                <TableCell className="py-2 text-center text-xs font-bold font-mono">
                                  {balance > 0 ? (
                                    <span className="text-green-600">{balance}</span>
                                  ) : (
                                    <span className="text-slate-400">0</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-xs text-slate-500 py-4">
                              {isLoading ? 'جاري التحميل...' : 'لا توجد مستودعات معرفة'}
                            </TableCell>
                          </TableRow>
                        )}

                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                // === CREATE MODE: Initial Stock ===
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 space-y-4 animate-in fade-in">
                  <p className="text-sm text-blue-800 font-medium">إعداد الرصيد الافتتاحي (اختياري)</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">الكمية الافتتاحية</label>
                      <Input
                        type="number"
                        min="0"
                        value={form.initialStock}
                        onChange={e => setForm({ ...form, initialStock: e.target.value })}
                        placeholder="0"
                        className="bg-white border-blue-200 focus-visible:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                        المستودع المستهدف
                        {Number(form.initialStock) > 0 && <span className="text-red-500 text-xs">* (مطلوب)</span>}
                      </label>
                      <select
                        className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${Number(form.initialStock) > 0 && !form.warehouse
                          ? 'border-red-300 ring-2 ring-red-100'
                          : 'border-slate-300'
                          }`}
                        value={form.warehouse}
                        onChange={e => setForm({ ...form, warehouse: e.target.value })}
                        disabled={!form.initialStock || Number(form.initialStock) <= 0}
                        required={Number(form.initialStock) > 0}
                      >
                        <option value="">-- اختر المستودع --</option>
                        {warehouses.map(w => (
                          <option key={w._id} value={w._id}>{w.name}</option>
                        ))}
                      </select>
                      {Number(form.initialStock) > 0 && !form.warehouse && (
                        <p className="text-[10px] text-red-500 font-bold animate-pulse">يجب اختيار مستودع لإيداع الكمية الافتتاحية</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </CardContent>
          <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={handleCloseModal}>
              إلغاء
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
              {editingItem ? 'حفظ التغييرات' : 'إنشاء المنتج'}
            </Button>
          </div>
        </form>
      )
      }

      {/* Quick Adjustment Modal */}
      <QuickAdjustmentModal
        item={adjustingItem}
        warehouses={contextWarehouses}
        onClose={() => {
          setShowQuickAdjust(false)
          setAdjustingItem(null)
        }}
        onSubmit={({ warehouseId, qty }) => {
          addStockMutation.mutate({ warehouseId, qty })
          setShowQuickAdjust(false)
          setAdjustingItem(null)
        }}
        isSubmitting={addStockMutation.isPending}
      />

      {/* Bulk Price Modal */}
      <BulkPriceModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSubmit={(data) => bulkUpdateMutation.mutate(data)}
        isSubmitting={bulkUpdateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setItemToDelete(null)
        }}
        onConfirm={confirmDelete}
        title="حذف المنتج"
        message={`هل أنت متأكد من حذف المنتج "${itemToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        danger={true}
      />
    </div>
  )
}


