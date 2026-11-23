import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, Plus, Edit2, Trash2, Tag, Layers, Cpu, Check, AlertCircle,
  FolderPlus, Search, RefreshCw, FolderTree, Info
} from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export function CategoryManagementModal({ isOpen, onClose, onSelectCategory }) {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'general' // 'general' | 'pc_builder'
  })
  const [deletingId, setDeletingId] = useState(null)

  // Fetch categories from DB
  const { data: categories = [], isLoading, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/inventory/categories')
      return res.data || []
    },
    enabled: isOpen
  })

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post('/inventory/categories', payload)
      return res.data
    },
    onSuccess: (newCat) => {
      queryClient.invalidateQueries(['categories'])
      queryClient.invalidateQueries(['items'])
      push('success', `تم إضافة التصنيف "${newCat.name}" بنجاح`)
      setFormData({ name: '', description: '', type: 'general' })
      if (onSelectCategory) {
        onSelectCategory(newCat.name)
      }
    },
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل إضافة التصنيف')
    }
  })

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await api.put(`/inventory/categories/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categories'])
      queryClient.invalidateQueries(['items'])
      push('success', 'تم تعديل التصنيف بنجاح')
      setEditingCategory(null)
      setFormData({ name: '', description: '', type: 'general' })
    },
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل تعديل التصنيف')
    }
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/inventory/categories/${id}`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categories'])
      queryClient.invalidateQueries(['items'])
      push('success', 'تم حذف التصنيف بنجاح وتحديث الأصناف المرتبطة')
      setDeletingId(null)
    },
    onError: (err) => {
      push('error', err?.response?.data?.message || 'فشل حذف التصنيف')
      setDeletingId(null)
    }
  })

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      push('error', 'يرجى إدخال اسم التصنيف')
      return
    }

    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory._id,
        data: formData
      })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleStartEdit = (cat) => {
    setEditingCategory(cat)
    setFormData({
      name: cat.name || '',
      description: cat.description || '',
      type: cat.type || 'general'
    })
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setFormData({ name: '', description: '', type: 'general' })
  }

  const handleDelete = (cat) => {
    if (confirm(`هل أنت متأكد من حذف التصنيف "${cat.name}"؟ سيتم فك ارتباطه عن الأصناف التابعة له.`)) {
      setDeletingId(cat._id)
      deleteMutation.mutate(cat._id)
    }
  }

  const filteredCategories = categories.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const generalCats = filteredCategories.filter(c => c.type !== 'pc_builder')
  const pcCats = filteredCategories.filter(c => c.type === 'pc_builder')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
              <FolderTree size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">إدارة وتخصيص تصنيفات الأصناف</h2>
              <p className="text-xs text-slate-500 font-medium">
                إنشاء تصنيفات مخصصة (شاشات، كيبوردات، ماوس، طابعات...) وفصلها عن فتحات تجميعات الكمبيوتر
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form (Add / Edit) */}
          <div className="lg:col-span-5 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                {editingCategory ? <Edit2 size={16} className="text-amber-600" /> : <FolderPlus size={16} className="text-blue-600" />}
                {editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
              </span>
              {editingCategory && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  اسم التصنيف <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: شاشات Gaming، كيبوردات وماوس..."
                  className="bg-white border-slate-200 rounded-xl text-xs font-bold h-10"
                  required
                />
              </div>

              {/* Category Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  طبيعة التصنيف واستخدامه
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      formData.type === 'general'
                        ? 'bg-blue-50/80 border-blue-400 text-blue-950 ring-1 ring-blue-400'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="catType"
                      value="general"
                      checked={formData.type === 'general'}
                      onChange={() => setFormData({ ...formData, type: 'general' })}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-black block">تصنيف عام / ملحقات (يدوي)</span>
                      <span className="text-[11px] text-slate-500 block leading-tight">
                        شاشات، كيبوردات، ماوس، طابعات، سماعات (لن يظهر في فتحات بناء التجميعة)
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      formData.type === 'pc_builder'
                        ? 'bg-purple-50/80 border-purple-400 text-purple-950 ring-1 ring-purple-400'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="catType"
                      value="pc_builder"
                      checked={formData.type === 'pc_builder'}
                      onChange={() => setFormData({ ...formData, type: 'pc_builder' })}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-black block">قطعة تجميعة كمبيوتر (PC Builder)</span>
                      <span className="text-[11px] text-slate-500 block leading-tight">
                        معالجات، كروت شاشة، لوحات أم، رامات، وسائط تخزين، مزودات طاقة...
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">وصف أو ملاحظات (اختياري)</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف مختصر لمحتوى هذا التصنيف..."
                  className="bg-white border-slate-200 rounded-xl text-xs h-10"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 rounded-xl shadow-sm cursor-pointer"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <div className="flex items-center gap-1.5">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>جاري الحفظ...</span>
                  </div>
                ) : editingCategory ? (
                  <div className="flex items-center gap-1.5">
                    <Check size={15} />
                    <span>تحديث التصنيف</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Plus size={15} />
                    <span>إضافة التصنيف الآن</span>
                  </div>
                )}
              </Button>
            </form>

            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1 text-amber-800">
                <Info size={13} />
                <span>ملاحظة ذكية:</span>
              </div>
              <p>
                التصنيفات العامة تسمح لك بإنشاء أي عدد تريده من المجموعات مثل (شاشات، كيبوردات، طابعات) وتصفية الكتالوج بها دون التأثير على خيارات الـ PC Builder.
              </p>
            </div>
          </div>

          {/* Right Section: Categories List */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {/* Search and stats bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث في التصنيفات..."
                  className="pr-9 bg-white border-slate-200 rounded-xl text-xs h-9"
                />
              </div>
              <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                إجمالي التصنيفات: <span className="text-slate-900 font-mono">{categories.length}</span>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 border border-slate-200/80 rounded-2xl overflow-y-auto max-h-[500px] bg-white divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-500" />
                  جاري تحميل التصنيفات...
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl inline-block">
                    <FolderTree size={32} />
                  </div>
                  <p className="text-xs font-bold text-slate-600">لا توجد تصنيفات معرفة حتى الآن</p>
                  <p className="text-[11px] text-slate-400">
                    استخدم النموذج على اليمين لإنشاء تصنيفاتك اليدوية مثل (شاشات، كيبوردات وماوس...)
                  </p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {/* General Categories */}
                  {generalCats.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-black text-slate-500 px-2 flex items-center gap-1.5">
                        <Tag size={12} className="text-emerald-600" />
                        <span>التصنيفات العامة والملحقات اليدوية ({generalCats.length}):</span>
                      </div>
                      <div className="space-y-1">
                        {generalCats.map((cat) => (
                          <div
                            key={cat._id}
                            className="p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-slate-50/70 transition-all flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                                <Tag size={14} />
                              </div>
                              <div>
                                <span className="text-xs font-black text-slate-900 block">{cat.name}</span>
                                {cat.description && (
                                  <span className="text-[10px] text-slate-400 block">{cat.description}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Item Count Badge */}
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {cat.itemCount || 0} صنف
                              </span>

                              {/* Quick pick if picker mode */}
                              {onSelectCategory && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    onSelectCategory(cat.name)
                                    onClose()
                                  }}
                                  className="h-7 px-2 text-[11px] font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
                                >
                                  اختيار
                                </Button>
                              )}

                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleStartEdit(cat)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                                title="تعديل التصنيف"
                              >
                                <Edit2 size={13} />
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => handleDelete(cat)}
                                disabled={deletingId === cat._id}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="حذف التصنيف"
                              >
                                {deletingId === cat._id ? (
                                  <RefreshCw size={13} className="animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 size={13} />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PC Builder Categories */}
                  {pcCats.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="text-[11px] font-black text-slate-500 px-2 flex items-center gap-1.5">
                        <Cpu size={12} className="text-purple-600" />
                        <span>قطع التجميعات (PC Builder) ({pcCats.length}):</span>
                      </div>
                      <div className="space-y-1">
                        {pcCats.map((cat) => (
                          <div
                            key={cat._id}
                            className="p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                                <Cpu size={14} />
                              </div>
                              <div>
                                <span className="text-xs font-black text-slate-900 block">{cat.name}</span>
                                {cat.description && (
                                  <span className="text-[10px] text-slate-400 block">{cat.description}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                                {cat.itemCount || 0} صنف
                              </span>

                              {onSelectCategory && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    onSelectCategory(cat.name)
                                    onClose()
                                  }}
                                  className="h-7 px-2 text-[11px] font-bold border-purple-200 text-purple-700 hover:bg-purple-50"
                                >
                                  اختيار
                                </Button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleStartEdit(cat)}
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(cat)}
                                disabled={deletingId === cat._id}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            يمكنك تخصيص وتعديل أي تصنيف في أي وقت وسيتم تحديث الكتالوج فوراً.
          </span>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-200 text-slate-700 hover:bg-white text-xs font-bold h-9 px-4 cursor-pointer"
          >
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  )
}
