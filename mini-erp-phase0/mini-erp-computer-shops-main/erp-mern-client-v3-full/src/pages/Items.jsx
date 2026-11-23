import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useWarehouse } from '../context/WarehouseContext'
import { useSettings } from '../context/SettingsContext'
import { useSocket } from '../context/SocketContext'
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
  AlertTriangle,
  Layers,
  Cpu,
  Check,
  CircuitBoard,
  Monitor,
  HardDrive,
  Zap,
  Box,
  Fan,
  Headphones,
  Laptop,
  Tag,
  Filter,
  DollarSign,
  FileText,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  FolderPlus,
  FolderTree,
  Folder
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'
import ConfirmDialog from '../components/ConfirmDialog'
import ItemHistoryModal from '../components/modals/ItemHistoryModal'
import { CategoryManagementModal } from '../components/modals/CategoryManagementModal'

// قطع التجميعات الأساسية المعتمدة لنظام بناء الـ PC (تقتصر على أجزاء الجهاز فقط)
export const PC_BUILDER_CATEGORIES = [
  { id: 'cpu', name: 'معالجات (CPU)', icon: Cpu, desc: 'Intel Core, AMD Ryzen...' },
  { id: 'motherboard', name: 'لوحات أم (Motherboard)', icon: CircuitBoard, desc: 'Asus, MSI, Gigabyte, ASRock...' },
  { id: 'gpu', name: 'كروت شاشة (GPU)', icon: Monitor, desc: 'Nvidia RTX, AMD Radeon...' },
  { id: 'ram', name: 'ذاكرة عشوائية (RAM)', icon: Layers, desc: 'DDR4, DDR5, RGB...' },
  { id: 'storage', name: 'وسائط تخزين (Storage)', icon: HardDrive, desc: 'NVMe M.2 SSD, SATA, HDD...' },
  { id: 'psu', name: 'مزودات طاقة (Power Supply)', icon: Zap, desc: 'Power Supply 550W, 650W, 750W+...' },
  { id: 'case', name: 'صناديق كيس (Case)', icon: Box, desc: 'صناديق كيس Gaming & Workstation...' },
  { id: 'cooler', name: 'أنظمة تبريد (Cooling)', icon: Fan, desc: 'مبردات مائية AIO ومبردات هوائية...' },
]

export default function Items() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const { warehouses: contextWarehouses } = useWarehouse()
  const { settings, usdExchangeRate: directRate } = useSettings() || {}
  const usdExchangeRate = Number(directRate || settings?.usdExchangeRate) || 7.30
  const { isAdmin, isManager } = usePermission()
  const canViewCost = isAdmin
  const { socket } = useSocket()

  // Real-time sync when exchange rate or stock updates
  React.useEffect(() => {
    if (!socket) return
    const handleExchangeRateUpdated = () => {
      queryClient.invalidateQueries(['items'])
    }
    socket.on('exchange_rate_updated', handleExchangeRateUpdated)
    socket.on('stock:update', handleExchangeRateUpdated)
    return () => {
      socket.off('exchange_rate_updated', handleExchangeRateUpdated)
      socket.off('stock:update', handleExchangeRateUpdated)
    }
  }, [socket, queryClient])

  const [editingItem, setEditingItem] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tableCategoryFilter, setTableCategoryFilter] = useState('')
  const [stockStatusFilter, setStockStatusFilter] = useState('all') // 'all', 'in_stock', 'low_stock', 'out_of_stock'
  const [modalTab, setModalTab] = useState('basic') // 'basic', 'pricing', 'stock', 'bundle'
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [activeTab, setActiveTab] = useState('details') // details, stock
  const [showQuickAdjust, setShowQuickAdjust] = useState(false)
  const [adjustingItem, setAdjustingItem] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)

  // Item History Modal State (F1)
  const [historyItem, setHistoryItem] = useState(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const openItemHistory = (item) => {
    setHistoryItem(item)
    setShowHistoryModal(true)
  }

  // Form State
  const [form, setForm] = useState({
    sku: '',
    name: '',
    barcode: '',
    category: '',
    uom: 'pcs',
    pricingCurrency: 'LYD', // 'LYD' | 'USD'
    cost: 0,
    price: 0,
    wholesalePrice: 0,
    minPrice: 0,
    maxPrice: 0,
    costUSD: 0,
    priceUSD: 0,
    wholesalePriceUSD: 0,
    minPriceUSD: 0,
    maxPriceUSD: 0,
    reorderLevel: 0,
    initialStock: 0,
    warehouse: '',
    isBundle: false,
    bundleComponents: []
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [selectedCompId, setSelectedCompId] = useState('')
  const [compQty, setCompQty] = useState(1)

  // Category Management & Quick Category Inline State
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [isAddingQuickCat, setIsAddingQuickCat] = useState(false)
  const [quickCatInline, setQuickCatInline] = useState('')

  // Dynamic Categories from DB
  const { data: dbCategories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/inventory/categories')
      return res.data || []
    }
  })

  // Quick Category Creation Mutation (from item wizard)
  const quickCreateCatMutation = useMutation({
    mutationFn: async (catName) => {
      const res = await api.post('/inventory/categories', { name: catName, type: 'general' })
      return res.data
    },
    onSuccess: (newCat) => {
      queryClient.invalidateQueries(['categories'])
      push('success', `تم إنشاء التصنيف "${newCat.name}" واختياره بنجاح`)
      setForm(f => ({ ...f, category: newCat.name }))
      setQuickCatInline('')
      setIsAddingQuickCat(false)
    },
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل إنشاء التصنيف')
    }
  })

  // --- React Query Hooks ---

  // 1. Fetch Items - Automatically refetches when exchange rate changes
  const { data: queryData, isLoading } = useQuery({
    queryKey: ['items', page, search, usdExchangeRate],
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

  // Pre-index stock balances by item ID for O(1) lookups
  const stockBalanceMap = React.useMemo(() => {
    const map = new Map();
    for (const sb of stockBalances) {
      const id = (sb.item?._id || sb.item)?.toString();
      if (id) {
        map.set(id, (map.get(id) || 0) + (Number(sb.balance) || 0));
      }
    }
    return map;
  }, [stockBalances]);

  // Calculate total stock per item using memoized O(1) lookup
  const itemsWithStock = React.useMemo(() => {
    return items.map(item => {
      if (item.isBundle) {
        return {
          ...item,
          stock: item.totalStock || 0,
          totalStock: item.totalStock || 0
        };
      }
      const itemIdStr = item._id?.toString();
      const v2Stock = stockBalanceMap.get(itemIdStr);
      const hasV2Data = v2Stock !== undefined;

      // Fallback: Use backend provided total or legacy stocks array
      const legacyStock = item.totalStock ?? item.stocks?.reduce((sum, s) => sum + (s.qty || 0), 0) ?? 0;
      const finalStock = hasV2Data ? v2Stock : legacyStock;

      return {
        ...item,
        stock: finalStock,
        totalStock: finalStock
      };
    });
  }, [items, stockBalanceMap]);

  // 1c. Fetch all items for bundle component selection
  const { data: allItemsList = [] } = useQuery({
    queryKey: ['all-items-for-bundles'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/items', { params: { limit: 1000 } })
      const list = Array.isArray(data) ? data : (data.items || [])
      return list.filter(i => !i.isBundle)
    },
    enabled: showModal && form.isBundle
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
      const isUsd = item.pricingCurrency === 'USD' || Number(item.priceUSD) > 0
      const calculatedCost = isUsd && Number(item.costUSD) > 0
        ? Number((Number(item.costUSD) * usdExchangeRate).toFixed(2))
        : (item.cost || 0)
      const calculatedPrice = isUsd && Number(item.priceUSD) > 0
        ? Number((Number(item.priceUSD) * usdExchangeRate).toFixed(2))
        : (item.price || 0)
      const calculatedWholesale = isUsd && Number(item.wholesalePriceUSD) > 0
        ? Number((Number(item.wholesalePriceUSD) * usdExchangeRate).toFixed(2))
        : (item.wholesalePrice || 0)
      const calculatedMin = isUsd && Number(item.minPriceUSD) > 0
        ? Number((Number(item.minPriceUSD) * usdExchangeRate).toFixed(2))
        : (item.minPrice || 0)
      const calculatedMax = isUsd && Number(item.maxPriceUSD) > 0
        ? Number((Number(item.maxPriceUSD) * usdExchangeRate).toFixed(2))
        : (item.maxPrice || 0)

      setForm({
        sku: item.sku,
        name: item.name,
        barcode: item.barcode || '',
        category: typeof item.category === 'object' ? (item.category?.name || '') : (item.category || ''),
        uom: item.uom || 'pcs',
        pricingCurrency: item.pricingCurrency || (Number(item.priceUSD) > 0 ? 'USD' : 'LYD'),
        cost: calculatedCost,
        price: calculatedPrice,
        wholesalePrice: calculatedWholesale,
        minPrice: calculatedMin,
        maxPrice: calculatedMax,
        costUSD: item.costUSD || (Number(item.cost) > 0 && usdExchangeRate > 0 ? Number((item.cost / usdExchangeRate).toFixed(2)) : 0),
        priceUSD: item.priceUSD || (Number(item.price) > 0 && usdExchangeRate > 0 ? Number((item.price / usdExchangeRate).toFixed(2)) : 0),
        wholesalePriceUSD: item.wholesalePriceUSD || (Number(item.wholesalePrice) > 0 && usdExchangeRate > 0 ? Number((item.wholesalePrice / usdExchangeRate).toFixed(2)) : 0),
        minPriceUSD: item.minPriceUSD || (Number(item.minPrice) > 0 && usdExchangeRate > 0 ? Number((item.minPrice / usdExchangeRate).toFixed(2)) : 0),
        maxPriceUSD: item.maxPriceUSD || (Number(item.maxPrice) > 0 && usdExchangeRate > 0 ? Number((item.maxPrice / usdExchangeRate).toFixed(2)) : 0),
        reorderLevel: item.reorderLevel || item.minStock || 0,
        initialStock: 0,
        warehouse: '',
        isBundle: !!item.isBundle,
        bundleComponents: (item.bundleComponents || []).map(c => ({
          item: c.item?._id || c.item,
          name: c.item?.name || c.name || '',
          sku: c.item?.sku || c.sku || '',
          cost: c.item?.cost ?? c.cost ?? 0,
          price: c.item?.price ?? c.price ?? 0,
          qty: Number(c.qty) || 1
        }))
      })
      setImagePreview(getImageUrl(item.image))
      setImageFile(null)
      setActiveTab('details')
      setModalTab('basic')
    } else {
      setEditingItem(null)
      setForm({
        sku: '',
        name: '',
        barcode: '',
        category: '',
        uom: 'pcs',
        pricingCurrency: 'LYD',
        cost: 0,
        price: 0,
        wholesalePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        costUSD: 0,
        priceUSD: 0,
        wholesalePriceUSD: 0,
        minPriceUSD: 0,
        maxPriceUSD: 0,
        reorderLevel: 0,
        initialStock: 0,
        warehouse: '',
        isBundle: false,
        bundleComponents: []
      })
      setImagePreview('')
      setImageFile(null)
      setModalTab('basic')
    }
    setSelectedCompId('')
    setCompQty(1)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingItem(null)
    setImageFile(null)
    setImagePreview('')
    setSelectedCompId('')
    setCompQty(1)
    setModalTab('basic')
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
      warehouse: '',
      isBundle: false,
      bundleComponents: []
    })
  }

  const handleAddComponent = () => {
    if (!selectedCompId) return
    const compItem = allItemsList.find(i => String(i._id || i.id) === String(selectedCompId))
    if (!compItem) return

    setForm(prev => {
      const exists = prev.bundleComponents.find(c => String(c.item) === String(selectedCompId))
      let updated
      if (exists) {
        updated = prev.bundleComponents.map(c =>
          String(c.item) === String(selectedCompId)
            ? { ...c, qty: c.qty + (Number(compQty) || 1) }
            : c
        )
      } else {
        updated = [
          ...prev.bundleComponents,
          {
            item: compItem._id || compItem.id,
            name: compItem.name,
            sku: compItem.sku,
            cost: compItem.cost || 0,
            price: compItem.price || 0,
            qty: Number(compQty) || 1
          }
        ]
      }
      return { ...prev, bundleComponents: updated }
    })
    setSelectedCompId('')
    setCompQty(1)
  }

  const handleRemoveComponent = (compItemId) => {
    setForm(prev => ({
      ...prev,
      bundleComponents: prev.bundleComponents.filter(c => String(c.item) !== String(compItemId))
    }))
  }

  const handleUpdateComponentQty = (compItemId, newQty) => {
    const qty = Math.max(1, parseInt(newQty, 10) || 1)
    setForm(prev => ({
      ...prev,
      bundleComponents: prev.bundleComponents.map(c =>
        String(c.item) === String(compItemId) ? { ...c, qty } : c
      )
    }))
  }

  const suggestedBundleCost = (form.bundleComponents || []).reduce(
    (sum, c) => sum + (Number(c.cost || 0) * Number(c.qty || 1)),
    0
  )

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (form.isBundle && (!form.bundleComponents || form.bundleComponents.length === 0)) {
      push('error', 'يجب إضافة مكون واحد على الأقل للتجميعة')
      return
    }

    const formData = new FormData()
    formData.append('sku', form.sku)
    formData.append('name', form.name)
    formData.append('barcode', form.barcode)
    formData.append('category', form.category)
    formData.append('uom', form.uom)
    formData.append('cost', form.cost)
    formData.append('price', form.price)
    formData.append('wholesalePrice', form.wholesalePrice)
    formData.append('minPrice', form.minPrice || 0)
    formData.append('maxPrice', form.maxPrice || 0)
    formData.append('pricingCurrency', form.pricingCurrency || 'LYD')
    formData.append('costUSD', form.costUSD || 0)
    formData.append('priceUSD', form.priceUSD || 0)
    formData.append('wholesalePriceUSD', form.wholesalePriceUSD || 0)
    formData.append('minPriceUSD', form.minPriceUSD || 0)
    formData.append('maxPriceUSD', form.maxPriceUSD || 0)
    formData.append('reorderLevel', form.reorderLevel)
    formData.append('isBundle', form.isBundle ? 'true' : 'false')

    if (form.isBundle) {
      formData.append('bundleComponents', JSON.stringify(
        form.bundleComponents.map(c => ({
          item: c.item,
          name: c.name,
          qty: Number(c.qty) || 1
        }))
      ))
    }

    if (!editingItem && !form.isBundle && form.initialStock > 0 && form.warehouse) {
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

  const kpiStats = React.useMemo(() => {
    const totalCount = queryData?.total ?? itemsWithStock.length
    let totalStockVal = 0
    let lowStockCount = 0
    let bundlesCount = 0

    itemsWithStock.forEach(item => {
      const stock = Number(item.totalStock || item.stock || 0)
      const cost = Number(item.cost || 0)
      totalStockVal += stock * cost
      const minStock = Number(item.minStock || item.reorderLevel || 0)
      if (minStock > 0 && stock <= minStock) {
        lowStockCount++
      }
      if (item.isBundle) {
        bundlesCount++
      }
    })

    const totalStockValUSD = usdExchangeRate > 0 ? totalStockVal / usdExchangeRate : 0

    return {
      totalCount,
      totalStockVal,
      totalStockValUSD,
      lowStockCount,
      bundlesCount
    }
  }, [itemsWithStock, queryData, usdExchangeRate])

  const categoryCounts = React.useMemo(() => {
    const counts = {}
    itemsWithStock.forEach(item => {
      const catName = typeof item.category === 'object' ? (item.category?.name || '') : (item.category || '')
      if (catName) {
        counts[catName] = (counts[catName] || 0) + 1
      }
    })
    return counts
  }, [itemsWithStock])

  // التصنيفات العامة والملحقات اليدوية (المخزنة في قاعدة البيانات أو المستخدمة في الأصناف وتختلف عن قطع التجميعات)
  const generalCategories = React.useMemo(() => {
    const list = []
    const seen = new Set()

    // 1. من قاعدة البيانات (ما لم يكن محدد كقطعة تجميعة)
    dbCategories.forEach(cat => {
      if (cat.type !== 'pc_builder' && !seen.has(cat.name.toLowerCase())) {
        seen.add(cat.name.toLowerCase())
        list.push({
          id: cat._id,
          name: cat.name,
          description: cat.description || '',
          type: 'general',
          itemCount: cat.itemCount ?? (categoryCounts[cat.name] || 0),
        })
      }
    })

    // 2. الأصناف التي تحتوي على تصنيفات عامة مخصصة لم تسجل بعد
    itemsWithStock.forEach(item => {
      const cName = typeof item.category === 'object' ? (item.category?.name || '') : (item.category || '')
      if (cName && !seen.has(cName.toLowerCase())) {
        const isPcPart = PC_BUILDER_CATEGORIES.some(
          p => p.name.toLowerCase() === cName.toLowerCase() || p.id === cName.toLowerCase()
        )
        if (!isPcPart) {
          seen.add(cName.toLowerCase())
          list.push({
            id: cName,
            name: cName,
            description: '',
            type: 'general',
            itemCount: categoryCounts[cName] || 0,
          })
        }
      }
    })

    return list
  }, [dbCategories, itemsWithStock, categoryCounts])

  const filteredItems = React.useMemo(() => {
    return itemsWithStock.filter(item => {
      // 1. Category Filter
      if (tableCategoryFilter) {
        const catName = typeof item.category === 'object' ? (item.category?.name || '') : (item.category || '')
        if (!catName.toLowerCase().includes(tableCategoryFilter.toLowerCase())) {
          return false
        }
      }

      // 2. Stock Status Filter
      const stock = Number(item.totalStock || item.stock || 0)
      const minStock = Number(item.minStock || item.reorderLevel || 0)

      if (stockStatusFilter === 'in_stock' && stock <= 0) return false
      if (stockStatusFilter === 'out_of_stock' && stock > 0) return false
      if (stockStatusFilter === 'low_stock' && !(minStock > 0 && stock <= minStock)) return false

      return true
    })
  }, [itemsWithStock, tableCategoryFilter, stockStatusFilter])

  // F1 Shortcut to open item movement & history card
  React.useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault()
        const targetItem = editingItem || filteredItems[0] || items[0] || null
        setHistoryItem(targetItem)
        setShowHistoryModal(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editingItem, filteredItems, items])

  // Margin calculations for pricing tab
  const activePriceNum = Number(form.pricingCurrency === 'USD' ? form.priceUSD : form.price) || 0
  const activeCostNum = Number(form.pricingCurrency === 'USD' ? form.costUSD : form.cost) || 0
  const activeProfitNum = activePriceNum - activeCostNum
  const activeMarginPercent = activePriceNum > 0 ? ((activeProfitNum / activePriceNum) * 100).toFixed(1) : '0.0'

  // Wizard Step Navigation handlers
  const handleNextStep = (e) => {
    if (e) e.preventDefault()
    if (modalTab === 'basic') {
      if (!form.name?.trim()) {
        push('error', 'يرجى إدخال اسم الصنف أولاً للمتابعة')
        return
      }
      if (!form.sku?.trim()) {
        push('error', 'يرجى إدخال رمز الصنف (SKU) أولاً للمتابعة')
        return
      }
      setModalTab('pricing')
    } else if (modalTab === 'pricing') {
      setModalTab('stock')
    }
  }

  const handlePrevStep = () => {
    if (modalTab === 'stock') setModalTab('pricing')
    else if (modalTab === 'pricing') setModalTab('basic')
  }

  return (
    <div className="flex flex-col gap-6 animate-in p-6 max-w-7xl mx-auto font-sans" dir="rtl">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">دليل الأصناف والمنتجات</h1>
              <p className="text-xs text-slate-500 font-medium">إدارة الكتالوج، المخزون، تجميعات الكمبيوتر، والتسعير بالدينار والدولار</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Exchange Rate Badge */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 shadow-xs">
            <DollarSign size={14} className="text-emerald-600" />
            <span>سعر الصرف:</span>
            <span className="font-mono bg-emerald-100/80 px-2 py-0.5 rounded text-emerald-900">1$ = {usdExchangeRate} د.ل</span>
          </div>

          <Button
            variant="outline"
            onClick={() => setShowBulkModal(true)}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold h-10 px-4"
          >
            <RefreshCw size={15} className="ml-2 text-slate-500" />
            تحديث أسعار جماعي
          </Button>

          <Button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-4 shadow-sm"
          >
            <Plus size={16} className="ml-2" />
            إضافة صنف جديد
          </Button>
        </div>
      </div>

      {/* 2. Top Summary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Items */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">إجمالي الأصناف</p>
            <p className="text-2xl font-black text-slate-900">{kpiStats.totalCount.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400 font-medium">أصناف معرفة في الدليل</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Package size={24} />
          </div>
        </div>

        {/* Card 2: Inventory Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">قيمة المخزون التقديرية</p>
            <p className="text-2xl font-black text-emerald-600 font-mono">
              {Math.round(kpiStats.totalStockVal).toLocaleString()} <span className="text-xs">د.ل</span>
            </p>
            <p className="text-[11px] text-emerald-700 font-mono font-bold">
              ≈ ${Math.round(kpiStats.totalStockValUSD).toLocaleString()} USD
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Card 3: Low Stock Alerts */}
        <div
          onClick={() => setStockStatusFilter(prev => prev === 'low_stock' ? 'all' : 'low_stock')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between ${
            stockStatusFilter === 'low_stock'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200/80 hover:border-amber-200'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-slate-500">تنبيهات النواقص</p>
              {kpiStats.lowStockCount > 0 && (
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <p className={`text-2xl font-black ${kpiStats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {kpiStats.lowStockCount}
            </p>
            <p className="text-[11px] text-amber-700 font-medium">
              {stockStatusFilter === 'low_stock' ? '✓ تم تفعيل التصفية' : 'انقر لعرض النواقص'}
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <AlertCircle size={24} />
          </div>
        </div>

        {/* Card 4: In-Stock Available Items */}
        <div
          onClick={() => setStockStatusFilter(prev => prev === 'in_stock' ? 'all' : 'in_stock')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between ${
            stockStatusFilter === 'in_stock'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/30'
              : 'bg-white border-slate-200/80 hover:border-blue-200'
          }`}
        >
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">الأصناف المتوفرة بالمخزن</p>
            <p className="text-2xl font-black text-blue-700">
              {itemsWithStock.filter(i => Number(i.totalStock || i.stock || 0) > 0).length}
            </p>
            <p className="text-[11px] text-blue-600 font-medium">
              {stockStatusFilter === 'in_stock' ? '✓ تم تفعيل التصفية' : 'جاهزة للبيع والتسليم'}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Box size={24} />
          </div>
        </div>
      </div>

      {/* 3. Category Filter Chips (Pills) Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Tag size={14} className="text-blue-600" />
              تصفية الكتالوج حسب التصنيف:
            </span>
            {tableCategoryFilter && (
              <button
                type="button"
                onClick={() => setTableCategoryFilter('')}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200"
              >
                <X size={12} />
                إلغاء التصفية ({tableCategoryFilter})
              </button>
            )}
          </div>

          {/* Button to open Category Management Modal */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCategoryModal(true)}
            className="h-8 px-3 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FolderPlus size={14} className="text-indigo-600" />
            <span>إدارة وتخصيص التصنيفات</span>
            {generalCategories.length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {generalCategories.length}
              </span>
            )}
          </Button>
        </div>

        {/* Category Chips Scroll Area */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {/* 'All' Chip */}
          <button
            type="button"
            onClick={() => setTableCategoryFilter('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
              !tableCategoryFilter
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span>جميع التصنيفات</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${!tableCategoryFilter ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {itemsWithStock.length}
            </span>
          </button>

          {/* Section 1: Custom & Manual Categories (Screens, Keyboards, Mice, etc.) */}
          {generalCategories.length > 0 && (
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200/80 mr-1">
              <span className="text-[11px] font-bold text-emerald-800 whitespace-nowrap flex items-center gap-1">
                <Tag size={12} className="text-emerald-600" />
                <span>الملحقات اليدوية:</span>
              </span>
              {generalCategories.map(cat => {
                const isSelected = tableCategoryFilter === cat.name
                const count = categoryCounts[cat.name] || cat.itemCount || 0
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setTableCategoryFilter(isSelected ? '' : cat.name)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    <Tag size={12} className={isSelected ? 'text-white' : 'text-emerald-600'} />
                    <span>{cat.name}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isSelected ? 'bg-emerald-750 text-white' : 'bg-white text-emerald-800'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Quick Add Custom Category Chip */}
          <button
            type="button"
            onClick={() => setShowCategoryModal(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1 cursor-pointer border border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300 bg-slate-50/50"
            title="إضافة تصنيف يدوي جديد (شاشات، كيبوردات، طابعات...)"
          >
            <Plus size={12} />
            <span>+ تصنيف يدوي</span>
          </button>

          {/* Section 2: PC Builder Hardware Slots */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200/80 mr-1">
            <span className="text-[11px] font-bold text-blue-800 whitespace-nowrap flex items-center gap-1">
              <Cpu size={12} className="text-blue-600" />
              <span>قطع التجميعات:</span>
            </span>
            {PC_BUILDER_CATEGORIES.map(cat => {
              const isSelected = tableCategoryFilter === cat.name
              const CatIcon = cat.icon
              const count = categoryCounts[cat.name] || 0
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setTableCategoryFilter(isSelected ? '' : cat.name)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <CatIcon size={12} className={isSelected ? 'text-white' : 'text-blue-600'} />
                  <span>{cat.name}</span>
                  {count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 4. Products Table Card */}
      <Card className="flex flex-col shadow-xs border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
        {/* Table Toolbar */}
        <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input
                className="pr-10 pl-8 bg-white h-10 text-xs border-slate-200 rounded-xl"
                placeholder="بحث بالاسم، كود الصنف (SKU)، أو الباركود..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Stock Status Pills */}
            <div className="bg-slate-100/90 p-1 rounded-xl flex items-center gap-1 border border-slate-200/70 text-xs">
              <button
                type="button"
                onClick={() => setStockStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  stockStatusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('in_stock')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  stockStatusFilter === 'in_stock'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                متوفر
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('low_stock')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  stockStatusFilter === 'low_stock'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                منخفض
              </button>
              <button
                type="button"
                onClick={() => setStockStatusFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  stockStatusFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                نفد
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>عرض {filteredItems.length} من أصل {queryData?.total || 0} صنف</span>
            {(tableCategoryFilter || stockStatusFilter !== 'all' || search) && (
              <button
                type="button"
                onClick={() => {
                  setTableCategoryFilter('')
                  setStockStatusFilter('all')
                  setSearch('')
                }}
                className="text-blue-600 font-bold hover:underline mr-2 cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            )}
          </div>
        </CardHeader>

        {/* Table Content */}
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-b border-slate-200">
                <TableHead style={{ width: '70px' }} className="text-center">صورة</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>الباركود</TableHead>
                <TableHead className="min-w-[200px]">اسم الصنف / التجميعة</TableHead>
                <TableHead>التصنيف</TableHead>
                {canViewCost && <TableHead>التكلفة</TableHead>}
                <TableHead>سعر البيع (قطاعي)</TableHead>
                {canViewCost && <TableHead>سعر الجملة</TableHead>}
                <TableHead>المخزون المتوفر</TableHead>
                <TableHead style={{ width: '130px' }} className="text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-blue-600" />
                      <span>جاري تحميل بيانات الأصناف...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                    <Package size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">لا توجد منتجات مطابقة لخيارات البحث أو التصفية.</p>
                    <p className="text-xs text-slate-400 mt-1">جرّب مسح البحث أو تغيير تصنيف القطع المحددة.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map(item => {
                  const stock = Number(item.totalStock || item.stock || 0)
                  const minStock = Number(item.minStock || item.reorderLevel || 0)
                  const isLow = minStock > 0 && stock <= minStock
                  const isOutOfStock = stock <= 0

                  return (
                    <TableRow key={item._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Image Preview */}
                      <TableCell className="text-center">
                        <div className="w-11 h-11 mx-auto rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden shadow-2xs">
                          {item.image ? (
                            <img
                              src={getImageUrl(item.image)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                          ) : (
                            <Package size={20} className="text-slate-400" />
                          )}
                        </div>
                      </TableCell>

                      {/* SKU */}
                      <TableCell className="text-xs font-mono font-bold text-slate-700">
                        {item.sku}
                      </TableCell>

                      {/* Barcode */}
                      <TableCell className="text-xs text-slate-500 font-mono">
                        {item.barcode ? (
                          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60 w-fit">
                            <Barcode size={13} className="text-slate-400" />
                            <span>{item.barcode}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>

                      {/* Name & Bundle Badges */}
                      <TableCell className="font-medium">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                            {item.isBundle && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                <Layers size={11} />
                                تجميعة PC
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isOutOfStock && !item.isBundle ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                <AlertTriangle size={10} />
                                نفد من المخزون
                              </span>
                            ) : isLow && !item.isBundle ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                <AlertTriangle size={10} />
                                مخزون منخفض (حد الطلب: {minStock})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      {/* Category Badge */}
                      <TableCell>
                        {item.category ? (
                          <span className="inline-flex items-center rounded-xl border border-blue-200 px-2.5 py-1 text-xs font-bold bg-blue-50/70 text-blue-800">
                            {typeof item.category === 'object' ? (item.category?.name || '-') : item.category}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Cost (LYD + USD) */}
                      {canViewCost && (
                        <TableCell>
                          <div className="font-mono text-xs font-bold text-slate-700">
                            {Number(
                              (item.pricingCurrency === 'USD' && Number(item.costUSD) > 0)
                                ? (Number(item.costUSD) * usdExchangeRate)
                                : (item.cost || 0)
                            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ل
                          </div>
                          {(Number(item.costUSD) > 0 || item.pricingCurrency === 'USD') && (
                            <div className="text-[10px] font-mono text-slate-400">
                              {Number(item.costUSD || (Number(item.cost || 0) / usdExchangeRate)).toFixed(2)} $
                            </div>
                          )}
                        </TableCell>
                      )}

                      {/* Retail Price (LYD + USD) */}
                      <TableCell>
                        <div className="font-mono font-black text-sm text-emerald-600">
                          {Number(
                            (item.pricingCurrency === 'USD' && Number(item.priceUSD) > 0)
                              ? (Number(item.priceUSD) * usdExchangeRate)
                              : (item.price || 0)
                          ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ل
                        </div>
                        {(item.pricingCurrency === 'USD' || Number(item.priceUSD) > 0) && (
                          <div className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded w-fit mt-0.5">
                            {Number(item.priceUSD || (Number(item.price || 0) / usdExchangeRate)).toFixed(2)} $
                          </div>
                        )}
                        {(Number(item.minPrice) > 0 || Number(item.maxPrice) > 0 || (item.pricingCurrency === 'USD' && (Number(item.minPriceUSD) > 0 || Number(item.maxPriceUSD) > 0))) && (
                          <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit border border-slate-200/60" title="حدود سعر البيع المسموح">
                            <span className="text-slate-400">الحدود:</span>
                            <span className="font-bold text-rose-600">
                              {Number(
                                (item.pricingCurrency === 'USD' && Number(item.minPriceUSD) > 0)
                                  ? (Number(item.minPriceUSD) * usdExchangeRate)
                                  : (item.minPrice || 0)
                              ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span>-</span>
                            <span className="font-bold text-blue-600">
                              {Number(
                                (item.pricingCurrency === 'USD' && Number(item.maxPriceUSD) > 0)
                                  ? (Number(item.maxPriceUSD) * usdExchangeRate)
                                  : (item.maxPrice || 0)
                              ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </TableCell>

                      {/* Wholesale Price */}
                      {canViewCost && (
                        <TableCell>
                          <div className="font-mono text-xs font-bold text-amber-600">
                            {Number(
                              (item.pricingCurrency === 'USD' && Number(item.wholesalePriceUSD) > 0)
                                ? (Number(item.wholesalePriceUSD) * usdExchangeRate)
                                : (item.wholesalePrice || 0)
                            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ل
                          </div>
                        </TableCell>
                      )}

                      {/* Stock Breakdown */}
                      <TableCell>
                        {item.isBundle ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
                            <Layers size={13} />
                            <span>محسوب ديناميكياً</span>
                          </div>
                        ) : (
                          <div>
                            <StockBreakdownTooltip
                              item={item}
                              warehouses={contextWarehouses}
                            />
                          </div>
                        )}
                      </TableCell>

                      {/* Action Buttons */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openItemHistory(item)}
                            title="سجل الصنف وحركة المشتريات والمبيعات [F1]"
                            className="h-8 w-8 text-purple-600 hover:bg-purple-50 rounded-lg"
                          >
                            <FileText size={15} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenModal(item)}
                            title="تعديل الصنف"
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 size={15} />
                          </Button>

                          {!item.isBundle && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setAdjustingItem(item)
                                setShowQuickAdjust(true)
                              }}
                              title="تعديل سريع للمخزون"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            >
                              <Settings size={15} />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item)}
                            title="حذف الصنف"
                            disabled={deleteMutation.isPending}
                            className="h-8 w-8 text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Table Pagination */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            صفحة <span className="font-bold text-slate-700">{page}</span> من <span className="font-bold text-slate-700">{totalPages || 1}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              size="sm"
              className="text-xs font-bold h-8"
            >
              السابق
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              size="sm"
              className="text-xs font-bold h-8"
            >
              التالي
            </Button>
          </div>
        </div>
      </Card>

      {/* 5. Tabbed Modal Dialog for Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                  <Package size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingItem ? `تعديل: ${form.name || editingItem.name}` : 'إضافة صنف جديد إلى الدليل'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    أدخل بيانات الصنف، التسعير، والرصيد المخزني
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Stepped Wizard Header */}
            <div className="bg-slate-50/90 border-b border-slate-200 px-6 py-3 shrink-0">
              <div className="flex items-center justify-between max-w-xl mx-auto">
                {/* Step 1 */}
                <button
                  type="button"
                  onClick={() => setModalTab('basic')}
                  className="flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer group"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    modalTab === 'basic'
                      ? 'bg-blue-600 text-white shadow-xs ring-4 ring-blue-100'
                      : (form.name && form.sku)
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                  }`}>
                    {(form.name && form.sku && modalTab !== 'basic') ? <Check size={14} /> : '1'}
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${modalTab === 'basic' ? 'text-blue-700 font-black' : 'text-slate-700'}`}>
                      البيانات الأساسية
                    </p>
                    <p className="text-[10px] text-slate-400 font-normal">الاسم والكود والتصنيف</p>
                  </div>
                </button>

                {/* Connector 1 */}
                <div className={`flex-1 h-0.5 mx-3 transition-all ${
                  modalTab === 'pricing' || modalTab === 'stock' ? 'bg-blue-500' : 'bg-slate-200'
                }`} />

                {/* Step 2 */}
                <button
                  type="button"
                  onClick={() => {
                    if (!form.name || !form.sku) {
                      push('error', 'يرجى إدخال اسم الصنف والكود أولاً للمتابعة')
                      return
                    }
                    setModalTab('pricing')
                  }}
                  className="flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer group"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    modalTab === 'pricing'
                      ? 'bg-blue-600 text-white shadow-xs ring-4 ring-blue-100'
                      : modalTab === 'stock'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                  }`}>
                    {modalTab === 'stock' ? <Check size={14} /> : '2'}
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${modalTab === 'pricing' ? 'text-blue-700 font-black' : 'text-slate-700'}`}>
                      التسعير والعملات
                    </p>
                    <p className="text-[10px] text-slate-400 font-normal">دينار/دولار وهامش الربح</p>
                  </div>
                </button>

                {/* Connector 2 */}
                <div className={`flex-1 h-0.5 mx-3 transition-all ${
                  modalTab === 'stock' ? 'bg-blue-500' : 'bg-slate-200'
                }`} />

                {/* Step 3 */}
                <button
                  type="button"
                  onClick={() => {
                    if (!form.name || !form.sku) {
                      push('error', 'يرجى إدخال اسم الصنف والكود أولاً للمتابعة')
                      return
                    }
                    setModalTab('stock')
                  }}
                  className="flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer group"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    modalTab === 'stock'
                      ? 'bg-blue-600 text-white shadow-xs ring-4 ring-blue-100'
                      : 'bg-slate-200 text-slate-600 group-hover:bg-slate-300'
                  }`}>
                    3
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${modalTab === 'stock' ? 'text-blue-700 font-black' : 'text-slate-700'}`}>
                      المخزون والتنبيهات
                    </p>
                    <p className="text-[10px] text-slate-400 font-normal">حد الطلب ومتابعة الأرصدة</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Scrollable Modal Form Body */}
            <form id="item-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: BASIC INFO */}
              {modalTab === 'basic' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Image, SKU, Barcode */}
                    <div className="space-y-4">
                      {/* Image Upload */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-700">صورة المنتج</label>
                        <div className="flex gap-4 items-center">
                          <div className="relative group w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden hover:border-blue-500 hover:bg-white transition-all cursor-pointer shrink-0">
                            {imagePreview ? (
                              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="text-slate-400 group-hover:text-blue-500 transition-colors" size={28} />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              onChange={handleFileChange}
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <p className="text-white text-[10px] font-bold">تغيير</p>
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 space-y-1">
                            <p className="font-bold text-slate-700">اختر صورة واضحة للصنف</p>
                            <p className="text-[11px] text-slate-400">يفضل أبعاد مربعة (500x500 بكسل) بصيغة PNG أو JPG.</p>
                          </div>
                        </div>
                      </div>

                      {/* SKU */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          رمز المنتج (SKU) <span className="text-red-500">*</span>
                        </label>
                        <Input
                          required
                          value={form.sku}
                          onChange={e => setForm({ ...form, sku: e.target.value })}
                          className="font-mono text-sm uppercase focus-visible:ring-blue-500"
                          placeholder="مثال: CPU-I5-13400F"
                        />
                      </div>

                      {/* Barcode */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Barcode size={14} className="text-slate-500" />
                          الباركود الدولي (EAN / UPC)
                        </label>
                        <Input
                          value={form.barcode}
                          onChange={e => setForm({ ...form, barcode: e.target.value })}
                          className="font-mono text-sm focus-visible:ring-blue-500"
                          placeholder="مثال: 5901234123457"
                        />
                      </div>
                    </div>

                    {/* Right Column: Name, Category, UOM */}
                    <div className="space-y-4">
                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">
                          اسم المنتج / التجميعة <span className="text-red-500">*</span>
                        </label>
                        <Input
                          required
                          value={form.name}
                          onChange={e => setForm({ ...form, name: e.target.value })}
                          className="font-bold text-sm focus-visible:ring-blue-500"
                          placeholder="مثال: معالج Intel Core i5 13400F"
                        />
                      </div>

                      {/* Category Selection with Quick Custom Add */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Tag size={13} className="text-blue-600" />
                            <span>تصنيف الصنف</span>
                            <span className="text-slate-400 font-normal">(اختر أو أضف يدوياً)</span>
                          </label>
                          <div className="flex items-center gap-2">
                            {form.category && (
                              <button
                                type="button"
                                onClick={() => setForm(f => ({ ...f, category: '' }))}
                                className="text-[11px] text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                مسح
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setIsAddingQuickCat(prev => !prev)}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200"
                            >
                              <Plus size={11} />
                              <span>+ تصنيف سريع</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Quick Add Category Input */}
                        {isAddingQuickCat && (
                          <div className="p-2 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center gap-1.5 animate-in fade-in">
                            <Input
                              value={quickCatInline}
                              onChange={(e) => setQuickCatInline(e.target.value)}
                              placeholder="اسم التصنيف (مثل: شاشات Gaming، كيبوردات وماوس)..."
                              className="bg-white border-indigo-200 text-xs font-bold h-8 rounded-lg flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  if (quickCatInline.trim()) {
                                    quickCreateCatMutation.mutate(quickCatInline.trim())
                                  }
                                }
                              }}
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!quickCatInline.trim() || quickCreateCatMutation.isPending}
                              onClick={() => {
                                if (quickCatInline.trim()) {
                                  quickCreateCatMutation.mutate(quickCatInline.trim())
                                }
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-8 px-3 rounded-lg"
                            >
                              {quickCreateCatMutation.isPending ? 'جاري الإضافة...' : 'حفظ واختيار'}
                            </Button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingQuickCat(false)
                                setQuickCatInline('')
                              }}
                              className="text-slate-400 hover:text-slate-600 p-1"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        )}

                        <input
                          list="pc-hardware-categories-modal"
                          value={form.category}
                          onChange={e => setForm({ ...form, category: e.target.value })}
                          className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                          placeholder="اختر أو اكتب تصنيف الصنف..."
                        />
                        <datalist id="pc-hardware-categories-modal">
                          {/* General Categories */}
                          {generalCategories.map(cat => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name} (تصنيف عام / ملحقات)
                            </option>
                          ))}
                          {/* PC Hardware Slots */}
                          {PC_BUILDER_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name} - {cat.desc}
                            </option>
                          ))}
                        </datalist>
                      </div>

                      {/* Quick Category Selection Chips */}
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2.5">
                        {/* 1. Custom General Categories (Screens, Keyboards, Mice, etc.) */}
                        {generalCategories.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                              <Tag size={12} className="text-emerald-600" />
                              <span>تصنيفاتك اليدوية (شاشات، كيبوردات، ملحقات):</span>
                            </div>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
                              {generalCategories.map(cat => {
                                const isSelected = form.category === cat.name
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, category: cat.name }))}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                        : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <Tag size={10} className={isSelected ? 'text-white' : 'text-emerald-600'} />
                                    <span>{cat.name}</span>
                                    {isSelected && <Check size={11} />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2. PC Builder Hardware Slots */}
                        <div className="space-y-1 pt-1.5 border-t border-slate-200/60">
                          <div className="text-[11px] font-bold text-blue-800 flex items-center gap-1">
                            <Cpu size={12} className="text-blue-600" />
                            <span>قطع تجميعات الكمبيوتر (PC Builder):</span>
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-0.5">
                            {PC_BUILDER_CATEGORIES.map(cat => {
                              const isSelected = form.category === cat.name
                              const CatIcon = cat.icon
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => setForm(f => ({ ...f, category: cat.name }))}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                                    isSelected
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <CatIcon size={10} className={isSelected ? 'text-white' : 'text-blue-600'} />
                                  <span>{cat.name}</span>
                                  {isSelected && <Check size={11} />}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      {/* UOM */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">وحدة القياس</label>
                        <select
                          className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                          value={form.uom}
                          onChange={e => setForm({ ...form, uom: e.target.value })}
                        >
                          <option value="pcs">قطعة (pcs)</option>
                          <option value="تجميعة">تجميعة / جهاز (Build)</option>
                          <option value="box">كرتون (box)</option>
                          <option value="kg">كيلوجرام (kg)</option>
                          <option value="m">متر (m)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRICING & CURRENCIES */}
              {modalTab === 'pricing' && (
                <div className="space-y-6 animate-in fade-in">
                  {/* Currency Switcher */}
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <DollarSign size={15} className="text-emerald-600" />
                        <span>عملة تسعير الصنف الأساسية</span>
                      </label>
                      <span className="text-xs font-mono text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-lg font-bold">
                        سعر الصرف المعتمد: 1$ = {usdExchangeRate} د.ل
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm(f => {
                          const pLyd = f.price || (Number(f.priceUSD) > 0 ? Number((f.priceUSD * usdExchangeRate).toFixed(2)) : 0)
                          const cLyd = f.cost || (Number(f.costUSD) > 0 ? Number((f.costUSD * usdExchangeRate).toFixed(2)) : 0)
                          const wLyd = f.wholesalePrice || (Number(f.wholesalePriceUSD) > 0 ? Number((f.wholesalePriceUSD * usdExchangeRate).toFixed(2)) : 0)
                          const minLyd = f.minPrice || (Number(f.minPriceUSD) > 0 ? Number((f.minPriceUSD * usdExchangeRate).toFixed(2)) : 0)
                          const maxLyd = f.maxPrice || (Number(f.maxPriceUSD) > 0 ? Number((f.maxPriceUSD * usdExchangeRate).toFixed(2)) : 0)
                          return {
                            ...f,
                            pricingCurrency: 'LYD',
                            price: pLyd,
                            cost: cLyd,
                            wholesalePrice: wLyd,
                            minPrice: minLyd,
                            maxPrice: maxLyd,
                            priceUSD: usdExchangeRate > 0 ? Number((pLyd / usdExchangeRate).toFixed(2)) : 0,
                            costUSD: usdExchangeRate > 0 ? Number((cLyd / usdExchangeRate).toFixed(2)) : 0,
                            wholesalePriceUSD: usdExchangeRate > 0 ? Number((wLyd / usdExchangeRate).toFixed(2)) : 0,
                            minPriceUSD: usdExchangeRate > 0 ? Number((minLyd / usdExchangeRate).toFixed(2)) : 0,
                            maxPriceUSD: usdExchangeRate > 0 ? Number((maxLyd / usdExchangeRate).toFixed(2)) : 0,
                          }
                        })}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                          form.pricingCurrency === 'LYD'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>🇱🇾 تسعير بالدينار الليبي (LYD)</span>
                        {form.pricingCurrency === 'LYD' && <Check size={14} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setForm(f => {
                            const pUsd = f.priceUSD || (Number(f.price) > 0 ? Number((f.price / usdExchangeRate).toFixed(2)) : 0)
                            const cUsd = f.costUSD || (Number(f.cost) > 0 ? Number((f.cost / usdExchangeRate).toFixed(2)) : 0)
                            const wUsd = f.wholesalePriceUSD || (Number(f.wholesalePrice) > 0 ? Number((f.wholesalePrice / usdExchangeRate).toFixed(2)) : 0)
                            const minUsd = f.minPriceUSD || (Number(f.minPrice) > 0 ? Number((f.minPrice / usdExchangeRate).toFixed(2)) : 0)
                            const maxUsd = f.maxPriceUSD || (Number(f.maxPrice) > 0 ? Number((f.maxPrice / usdExchangeRate).toFixed(2)) : 0)
                            return {
                              ...f,
                              pricingCurrency: 'USD',
                              priceUSD: pUsd,
                              costUSD: cUsd,
                              wholesalePriceUSD: wUsd,
                              minPriceUSD: minUsd,
                              maxPriceUSD: maxUsd,
                              price: (pUsd * usdExchangeRate).toFixed(2),
                              cost: (cUsd * usdExchangeRate).toFixed(2),
                              wholesalePrice: (wUsd * usdExchangeRate).toFixed(2),
                              minPrice: (minUsd * usdExchangeRate).toFixed(2),
                              maxPrice: (maxUsd * usdExchangeRate).toFixed(2)
                            }
                          })
                        }}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                          form.pricingCurrency === 'USD'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span>💵 تسعير بالدولار الأمريكي (USD)</span>
                        {form.pricingCurrency === 'USD' && <Check size={14} />}
                      </button>
                    </div>

                    {form.pricingCurrency === 'USD' && (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-medium leading-relaxed">
                        💡 عند التسعير بالدولار، يُحدّث النظام تلقائياً سعر البيع بالدينار في شاشات الكاشير ونقاط البيع وفقاً لسعر الصرف اليومي.
                      </div>
                    )}
                  </div>

                  {/* Pricing Inputs */}
                  {form.pricingCurrency === 'USD' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Cost USD */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">سعر التكلفة بالدولار ($)</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.costUSD}
                            onChange={e => {
                              const val = e.target.value
                              const num = Number(val) || 0
                              setForm({
                                ...form,
                                costUSD: val,
                                cost: (num * usdExchangeRate).toFixed(2)
                              })
                            }}
                            className="bg-white font-mono font-bold"
                            placeholder="0.00 $"
                          />
                          <p className="text-[11px] text-slate-400 font-mono">
                            يعادل بالدينار: {Number(form.cost || 0).toLocaleString()} د.ل
                          </p>
                        </div>

                        {/* Retail Price USD */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">سعر البيع بالدولار ($) <span className="text-red-500">*</span></label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.priceUSD}
                            onChange={e => {
                              const val = e.target.value
                              const num = Number(val) || 0
                              setForm({
                                ...form,
                                priceUSD: val,
                                price: (num * usdExchangeRate).toFixed(2)
                              })
                            }}
                            className="bg-white font-mono font-black text-emerald-700"
                            placeholder="0.00 $"
                          />
                          <p className="text-[11px] text-emerald-600 font-mono font-bold">
                            يعادل للعميل: {Number(form.price || 0).toLocaleString()} د.ل
                          </p>
                        </div>
                      </div>

                      {/* Wholesale USD */}
                      {canViewCost && (
                        <div className="space-y-1.5 max-w-md">
                          <label className="text-xs font-bold text-slate-700">سعر الجملة بالدولار ($)</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.wholesalePriceUSD}
                            onChange={e => {
                              const val = e.target.value
                              const num = Number(val) || 0
                              setForm({
                                ...form,
                                wholesalePriceUSD: val,
                                wholesalePrice: (num * usdExchangeRate).toFixed(2)
                              })
                            }}
                            className="bg-white font-mono font-bold text-purple-700"
                            placeholder="0.00 $"
                          />
                          <p className="text-[11px] text-purple-600 font-mono">
                            يعادل للجملة: {Number(form.wholesalePrice || 0).toLocaleString()} د.ل
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Cost LYD */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">سعر التكلفة (د.ل)</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.cost}
                            onChange={e => {
                              const val = e.target.value
                              const num = Number(val) || 0
                              setForm({
                                ...form,
                                cost: val,
                                costUSD: usdExchangeRate > 0 ? (num / usdExchangeRate).toFixed(2) : 0
                              })
                            }}
                            className="bg-white font-mono font-bold"
                            placeholder="0.00 د.ل"
                          />
                          <p className="text-[11px] text-slate-400 font-mono">
                            يعادل: {(Number(form.cost || 0) / (usdExchangeRate || 1)).toFixed(2)} $
                          </p>
                        </div>

                        {/* Retail Price LYD */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">سعر البيع (د.ل) <span className="text-red-500">*</span></label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.price}
                            onChange={e => {
                              const val = e.target.value
                              const num = Number(val) || 0
                              setForm({
                                ...form,
                                price: val,
                                priceUSD: usdExchangeRate > 0 ? (num / usdExchangeRate).toFixed(2) : 0
                              })
                            }}
                            className="bg-white font-mono font-black text-emerald-600"
                            placeholder="0.00 د.ل"
                          />
                          <p className="text-[11px] text-emerald-600 font-mono">
                            يعادل: {(Number(form.price || 0) / (usdExchangeRate || 1)).toFixed(2)} $
                          </p>
                        </div>
                      </div>

                      {/* Wholesale LYD */}
                      {canViewCost && (
                        <div className="space-y-1.5 max-w-md">
                          <label className="text-xs font-bold text-slate-700">سعر الجملة (د.ل)</label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.wholesalePrice}
                            onChange={e => {
                              const val = e.target.value
                              const num = Number(val) || 0
                              setForm({
                                ...form,
                                wholesalePrice: val,
                                wholesalePriceUSD: usdExchangeRate > 0 ? (num / usdExchangeRate).toFixed(2) : 0
                              })
                            }}
                            className="bg-white font-mono font-bold text-purple-700"
                            placeholder="0.00 د.ل"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Price Boundaries (Min / Max Selling Price) */}
                  <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                          <Tag size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">حدود سعر البيع المسموح به (حماية الكاشير)</h4>
                          <p className="text-[11px] text-slate-500">تحديد أدنى وأعلى سعر يمكن للكاشير البيع به لهذا المنتج</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                        اختياري (0 = بدون قيود)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      {/* Min Price */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>أدنى سعر للبيع (الحد الأدنى)</span>
                          <span className="text-[10px] text-rose-500 font-medium">أقل سعر مسموح</span>
                        </label>
                        {form.pricingCurrency === 'USD' ? (
                          <>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.minPriceUSD || ''}
                              onChange={e => {
                                const val = e.target.value
                                const num = Number(val) || 0
                                setForm({
                                  ...form,
                                  minPriceUSD: val,
                                  minPrice: num > 0 ? (num * usdExchangeRate).toFixed(2) : 0
                                })
                              }}
                              className="bg-white font-mono font-bold text-rose-600"
                              placeholder="0.00 $"
                            />
                            <p className="text-[11px] text-slate-400 font-mono">
                              يعادل بالدينار: {Number(form.minPrice || 0).toLocaleString()} د.ل
                            </p>
                          </>
                        ) : (
                          <>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.minPrice || ''}
                              onChange={e => {
                                const val = e.target.value
                                const num = Number(val) || 0
                                setForm({
                                  ...form,
                                  minPrice: val,
                                  minPriceUSD: (num > 0 && usdExchangeRate > 0) ? (num / usdExchangeRate).toFixed(2) : 0
                                })
                              }}
                              className="bg-white font-mono font-bold text-rose-600"
                              placeholder="0.00 د.ل"
                            />
                            <p className="text-[11px] text-slate-400 font-mono">
                              يعادل: {Number(form.minPrice || 0) > 0 && usdExchangeRate > 0 ? (Number(form.minPrice) / usdExchangeRate).toFixed(2) : '0.00'} $
                            </p>
                          </>
                        )}
                        <p className="text-[10px] text-slate-400">
                          لن يتمكن الكاشير من تقديم تخفيض يقل عن هذا الحد.
                        </p>
                      </div>

                      {/* Max Price */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>أعلى سعر للبيع (الحد الأقصى)</span>
                          <span className="text-[10px] text-blue-500 font-medium">أعلى سعر مسموح</span>
                        </label>
                        {form.pricingCurrency === 'USD' ? (
                          <>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.maxPriceUSD || ''}
                              onChange={e => {
                                const val = e.target.value
                                const num = Number(val) || 0
                                setForm({
                                  ...form,
                                  maxPriceUSD: val,
                                  maxPrice: num > 0 ? (num * usdExchangeRate).toFixed(2) : 0
                                })
                              }}
                              className="bg-white font-mono font-bold text-blue-600"
                              placeholder="0.00 $"
                            />
                            <p className="text-[11px] text-slate-400 font-mono">
                              يعادل بالدينار: {Number(form.maxPrice || 0).toLocaleString()} د.ل
                            </p>
                          </>
                        ) : (
                          <>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.maxPrice || ''}
                              onChange={e => {
                                const val = e.target.value
                                const num = Number(val) || 0
                                setForm({
                                  ...form,
                                  maxPrice: val,
                                  maxPriceUSD: (num > 0 && usdExchangeRate > 0) ? (num / usdExchangeRate).toFixed(2) : 0
                                })
                              }}
                              className="bg-white font-mono font-bold text-blue-600"
                              placeholder="0.00 د.ل"
                            />
                            <p className="text-[11px] text-slate-400 font-mono">
                              يعادل: {Number(form.maxPrice || 0) > 0 && usdExchangeRate > 0 ? (Number(form.maxPrice) / usdExchangeRate).toFixed(2) : '0.00'} $
                            </p>
                          </>
                        )}
                        <p className="text-[10px] text-slate-400">
                          أقصى سعر مسموح به في الفاتورة لحماية السعر من الإدخال الخاطئ.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Profit Margin Indicator */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={20} className="text-emerald-700" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900">هامش الربح المتوقع</p>
                        <p className="text-[11px] text-emerald-700 font-medium">الربح للقطعة الواحدة مقارنة بالتكلفة</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-black text-emerald-800">
                        {activeProfitNum > 0 ? activeProfitNum.toFixed(2) : '0.00'} {form.pricingCurrency === 'USD' ? '$' : 'د.ل'}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        Number(activeMarginPercent) >= 20
                          ? 'bg-emerald-600 text-white'
                          : Number(activeMarginPercent) > 0
                          ? 'bg-amber-500 text-white'
                          : 'bg-rose-500 text-white'
                      }`}>
                        {activeMarginPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: STOCK & WAREHOUSES */}
              {modalTab === 'stock' && (
                <div className="space-y-6 animate-in fade-in">
                  {editingItem ? (
                    /* Edit Mode: Read Only Stock & Warehouse Breakdown */
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">إجمالي المخزون الحالي (للقراءة فقط)</label>
                          <div className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-100 items-center px-4 text-lg font-black text-slate-800 font-mono">
                            {Number(editingItem.totalStock || 0).toLocaleString()} <span className="text-xs font-medium text-slate-400 mr-2">{form.uom}</span>
                          </div>
                          <p className="text-[11px] text-amber-600 font-medium">
                            ⚠ لتعديل الرصيد، استخدم خيار "تعديل سريع" أو أذونات الإضافة/الصرف المخزني.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700">حد إعادة الطلب (تنبيه النواقص)</label>
                          <Input
                            type="number"
                            min="0"
                            value={form.reorderLevel}
                            onChange={e => setForm({ ...form, reorderLevel: e.target.value })}
                            className="bg-white font-mono"
                            placeholder="مثال: 5"
                          />
                        </div>
                      </div>

                      {/* Stock Breakdown per Warehouse */}
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-700">توزيع المخزون في المستودعات</span>
                        </div>
                        <Table>
                          <TableHeader className="bg-slate-50/50">
                            <TableRow>
                              <TableHead className="h-9 text-xs">المستودع</TableHead>
                              <TableHead className="h-9 text-xs text-center">الكمية المتوفرة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {warehouses.length > 0 ? (
                              warehouses.map(w => {
                                const wId = String(w._id || w.id)
                                const stockEntry = itemStock.find(s => {
                                  const sId = String(s.warehouse?._id || s.warehouse?.id || s.warehouseId)
                                  return sId === wId
                                })
                                const balance = stockEntry?.balance || 0
                                return (
                                  <TableRow key={w._id} className="h-9 hover:bg-slate-50">
                                    <TableCell className="py-2 font-medium text-xs text-slate-800">{w.name}</TableCell>
                                    <TableCell className="py-2 text-center text-xs font-bold font-mono">
                                      {balance > 0 ? (
                                        <span className="text-emerald-600 font-bold">{balance} {form.uom}</span>
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
                    /* Create Mode: Simplified Stock Setup without initial stock */
                    <div className="space-y-5">
                      <div className="space-y-1.5 max-w-sm">
                        <label className="text-xs font-bold text-slate-700">حد إعادة الطلب (تنبيه النواقص)</label>
                        <Input
                          type="number"
                          min="0"
                          value={form.reorderLevel}
                          onChange={e => setForm({ ...form, reorderLevel: e.target.value })}
                          className="bg-white font-mono"
                          placeholder="مثال: 5"
                        />
                        <p className="text-[11px] text-slate-400">
                          سيتم إرسال تنبيه عندما يصل إجمالي المخزون إلى هذا الحد أو أقل منه.
                        </p>
                      </div>

                      {/* Informative Workflow Guidance Card */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                          <Package size={16} className="text-blue-600" />
                          <span>إدارة رصيد الصنف في المستودعات:</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          سيتم تعريف الصنف في النظام بدون رصيد مبدئي (0). يمكنك توريد وإيداع كمياته الفعلية لاحقاً بكل مرونة عبر:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-2 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>فواتير المشتريات (شراء من موردين بالدينار أو الدولار)</span>
                          </div>
                          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-2 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                            <span>أذونات الإضافة أو التعديل السريع للمخزون</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Modal Fixed Footer - Guided Stepper Controls */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" onClick={handleCloseModal} className="text-xs font-bold text-slate-500">
                  إلغاء
                </Button>

                {modalTab !== 'basic' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevStep}
                    className="text-xs font-bold h-9 flex items-center gap-1.5 border-slate-300 hover:bg-white"
                  >
                    <ArrowRight size={14} />
                    <span>السابق</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {modalTab !== 'stock' ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[130px] text-xs font-bold shadow-sm h-9 flex items-center gap-1.5"
                  >
                    <span>
                      {modalTab === 'basic' ? 'التالي: التسعير والعملات' : 'التالي: إعدادات المخزون'}
                    </span>
                    <ArrowLeft size={14} />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    form="item-modal-form"
                    disabled={saveMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px] text-xs font-bold shadow-sm h-9 flex items-center gap-1.5"
                  >
                    {saveMutation.isPending ? (
                      <div className="flex items-center gap-1.5">
                        <RefreshCw size={14} className="animate-spin" />
                        <span>جاري الحفظ...</span>
                      </div>
                    ) : (
                      <>
                        <Check size={15} />
                        <span>{editingItem ? 'حفظ التغييرات' : 'إنشاء المنتج وحفظه'}</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Item Movement & History Modal [F1] */}
      <ItemHistoryModal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false)
          setHistoryItem(null)
        }}
        itemId={historyItem?._id}
        initialItem={historyItem}
      />

      {/* Category Management Modal */}
      <CategoryManagementModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSelectCategory={(catName) => setForm(f => ({ ...f, category: catName }))}
      />
    </div>
  )
}


