import React, { useState, useEffect } from 'react'
import {
    Lock, Calendar, FileText, Trash2, Eye, Printer,
    DollarSign, CreditCard, Clock, CheckCircle, RefreshCw, Zap
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const formatCurrency = (amount) =>
    new Intl.NumberFormat('ar-LY', { style: 'currency', currency: 'LYD' }).format(amount || 0)

/**
 * DailyClosures - صفحة تقارير الإغلاق اليومي
 * 
 * تعرض قائمة بجميع تقارير الإغلاق السابقة مع إمكانية:
 * - عرض التفاصيل
 * - طباعة التقرير
 * - حذف التقرير (للمدير فقط)
 * - إغلاق يدوي
 */
export default function DailyClosures() {
    const { push } = useToast()
    const [closures, setClosures] = useState([])
    const [selectedClosure, setSelectedClosure] = useState(null)
    const [selectedDetails, setSelectedDetails] = useState(null)
    const [loading, setLoading] = useState(true)
    const [todaySummary, setTodaySummary] = useState(null)
    const [closingToday, setClosingToday] = useState(false)

    // Load closures from API
    useEffect(() => {
        loadClosures()
        loadTodaySummary()
    }, [])

    const loadClosures = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/daily-closures')
            setClosures(data)
        } catch (err) {
            console.error('Failed to load closures:', err)
            push('error', 'فشل تحميل تقارير الإغلاق')
        } finally {
            setLoading(false)
        }
    }

    const loadTodaySummary = async () => {
        try {
            const { data } = await api.get('/daily-closures/summary-today')
            setTodaySummary(data)
        } catch (err) {
            console.error('Failed to load today summary:', err)
        }
    }

    const handleSelectClosure = async (closure) => {
        setSelectedClosure(closure)
        try {
            // Fetch full details
            const dateStr = new Date(closure.date).toISOString().split('T')[0]
            const { data } = await api.get(`/daily-closures/${dateStr}`)
            setSelectedDetails(data)
        } catch (err) {
            console.error('Failed to load closure details:', err)
        }
    }

    const handleCloseToday = async () => {
        if (!window.confirm('هل تريد إغلاق حساب اليوم؟')) return
        setClosingToday(true)
        try {
            await api.post('/daily-closures', { date: new Date().toISOString().split('T')[0] })
            push('success', 'تم إغلاق حساب اليوم بنجاح')
            loadClosures()
            loadTodaySummary()
        } catch (err) {
            push('error', err?.response?.data?.message || 'فشل إغلاق حساب اليوم')
        } finally {
            setClosingToday(false)
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا التقرير؟')) return
        try {
            await api.delete(`/daily-closures/${id}`)
            push('success', 'تم حذف التقرير بنجاح')
            setClosures(prev => prev.filter(c => c._id !== id))
            setSelectedClosure(null)
            setSelectedDetails(null)
        } catch (err) {
            push('error', 'فشل حذف التقرير')
        }
    }

    const handlePrint = (closure) => {
        const details = selectedDetails || closure
        const printWindow = window.open('', '_blank')
        printWindow.document.write(`
            <html dir="rtl">
            <head>
                <title>تقرير إغلاق ${new Date(closure.date).toLocaleDateString('ar-LY')}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; color: #333; }
                    .summary { display: flex; justify-content: space-around; margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; }
                    .stat { text-align: center; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #4f46e5; }
                    .stat-label { color: #666; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; border: 1px solid #ddd; text-align: right; }
                    th { background: #f0f0f0; }
                    .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
                    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                    .auto { background: #fef3c7; color: #92400e; }
                    .manual { background: #dbeafe; color: #1e40af; }
                </style>
            </head>
            <body>
                <h1>🔒 تقرير إغلاق يوم ${new Date(closure.date).toLocaleDateString('ar-LY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h1>
                <p style="text-align: center">
                    <span class="badge ${closure.isAutomatic ? 'auto' : 'manual'}">${closure.isAutomatic ? '⚡ إغلاق تلقائي' : '👤 إغلاق يدوي'}</span>
                </p>
                <div class="summary">
                    <div class="stat">
                        <div class="stat-value">${closure.summary?.invoiceCount || 0}</div>
                        <div class="stat-label">عدد الفواتير</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${formatCurrency(closure.summary?.totalSales)}</div>
                        <div class="stat-label">إجمالي المبيعات</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" style="color: green">${formatCurrency(closure.summary?.totalPaid)}</div>
                        <div class="stat-label">المحصّل</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value" style="color: red">${formatCurrency(closure.summary?.totalDue)}</div>
                        <div class="stat-label">الآجل</div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>رقم الفاتورة</th>
                            <th>العميل</th>
                            <th>الإجمالي</th>
                            <th>المدفوع</th>
                            <th>الوقت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(details.invoiceDetails || []).map((inv, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>#${inv.number}</td>
                                <td>${inv.customer}</td>
                                <td>${formatCurrency(inv.total)}</td>
                                <td>${formatCurrency(inv.paid)}</td>
                                <td>${new Date(inv.createdAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    تم الإغلاق بتاريخ ${new Date(closure.closedAt).toLocaleString('ar-LY')}
                    ${closure.closedBy?.name ? ` بواسطة ${closure.closedBy.name}` : ''}
                </div>
            </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 flex flex-col gap-6 animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Lock className="text-orange-500" size={28} />
                        تقارير الإغلاق اليومي
                    </h1>
                    <p className="text-sm text-slate-500">سجل إغلاقات الحسابات اليومية</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={loadClosures} className="gap-2">
                        <RefreshCw size={16} />
                        تحديث
                    </Button>
                    {todaySummary && !todaySummary.isClosed && (
                        <Button
                            onClick={handleCloseToday}
                            disabled={closingToday}
                            className="gap-2 bg-orange-600 hover:bg-orange-700"
                        >
                            <Lock size={16} />
                            {closingToday ? 'جاري الإغلاق...' : `إغلاق اليوم (${todaySummary.summary?.invoiceCount || 0} فاتورة)`}
                        </Button>
                    )}
                </div>
            </div>

            {/* Today Summary Card */}
            {todaySummary && !todaySummary.isClosed && (
                <Card className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">ملخص اليوم (لم يُغلق بعد)</h3>
                                <p className="text-xs text-slate-500">{todaySummary.summary?.invoiceCount || 0} فاتورة</p>
                            </div>
                        </div>
                        <div className="flex gap-6 text-center">
                            <div>
                                <div className="text-lg font-bold text-emerald-600">{formatCurrency(todaySummary.summary?.totalSales)}</div>
                                <div className="text-[10px] text-slate-500">إجمالي المبيعات</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-blue-600">{formatCurrency(todaySummary.summary?.totalPaid)}</div>
                                <div className="text-[10px] text-slate-500">المحصّل</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-red-600">{formatCurrency(todaySummary.summary?.totalDue)}</div>
                                <div className="text-[10px] text-slate-500">الآجل</div>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Closures List */}
                <div className="lg:col-span-1">
                    <Card className="p-4 shadow-sm border bg-white">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar size={18} className="text-slate-500" />
                            الأيام المغلقة ({closures.length})
                        </h3>

                        {loading ? (
                            <div className="text-center py-8 text-slate-400">جاري التحميل...</div>
                        ) : closures.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Lock size={40} className="mx-auto mb-2 opacity-30" />
                                <p>لا توجد تقارير إغلاق</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                {closures.map(closure => (
                                    <div
                                        key={closure._id}
                                        onClick={() => handleSelectClosure(closure)}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedClosure?._id === closure._id
                                            ? 'bg-orange-50 border-orange-300'
                                            : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="font-bold text-slate-800 text-sm">
                                                {new Date(closure.date).toLocaleDateString('ar-LY', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {closure.isAutomatic ? (
                                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        <Zap size={10} />تلقائي
                                                    </span>
                                                ) : (
                                                    <CheckCircle size={16} className="text-emerald-500" />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>{closure.summary?.invoiceCount || 0} فاتورة</span>
                                            <span className="font-mono font-bold text-emerald-600">
                                                {formatCurrency(closure.summary?.totalSales)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Closure Details */}
                <div className="lg:col-span-2">
                    {selectedClosure && selectedDetails ? (
                        <Card className="shadow-sm border bg-white overflow-hidden">
                            {/* Detail Header */}
                            <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">
                                            تقرير يوم {new Date(selectedClosure.date).toLocaleDateString('ar-LY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </h3>
                                        <p className="text-xs text-slate-500 flex items-center gap-2">
                                            <Clock size={12} />
                                            تم الإغلاق: {new Date(selectedClosure.closedAt).toLocaleString('ar-LY')}
                                            {selectedClosure.isAutomatic && (
                                                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                                                    <Zap size={10} />إغلاق تلقائي
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handlePrint(selectedClosure)}
                                            className="gap-1"
                                        >
                                            <Printer size={14} />
                                            طباعة
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDelete(selectedClosure._id)}
                                            className="gap-1"
                                        >
                                            <Trash2 size={14} />
                                            حذف
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Stats */}
                            <div className="p-4 bg-slate-50 border-b grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                                    <div className="text-[10px] text-slate-500 font-bold mb-1">عدد الفواتير</div>
                                    <div className="text-2xl font-black text-slate-800">{selectedDetails.summary?.invoiceCount || 0}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-emerald-200 text-center">
                                    <div className="text-[10px] text-emerald-600 font-bold mb-1">إجمالي المبيعات</div>
                                    <div className="text-lg font-black text-emerald-600 font-mono">{formatCurrency(selectedDetails.summary?.totalSales)}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-blue-200 text-center">
                                    <div className="text-[10px] text-blue-600 font-bold mb-1">المحصّل</div>
                                    <div className="text-lg font-black text-blue-600 font-mono">{formatCurrency(selectedDetails.summary?.totalPaid)}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-red-200 text-center">
                                    <div className="text-[10px] text-red-600 font-bold mb-1">الآجل</div>
                                    <div className="text-lg font-black text-red-600 font-mono">{formatCurrency(selectedDetails.summary?.totalDue)}</div>
                                </div>
                            </div>

                            {/* Invoices Table */}
                            <div className="p-4 max-h-[50vh] overflow-y-auto">
                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <FileText size={16} />
                                    تفاصيل الفواتير ({selectedDetails.invoiceDetails?.length || 0})
                                </h4>
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600 font-bold">
                                        <tr>
                                            <th className="p-2 text-right">#</th>
                                            <th className="p-2 text-right">رقم الفاتورة</th>
                                            <th className="p-2 text-right">العميل</th>
                                            <th className="p-2 text-center">الإجمالي</th>
                                            <th className="p-2 text-center">المدفوع</th>
                                            <th className="p-2 text-left">الوقت</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(selectedDetails.invoiceDetails || []).map((inv, i) => (
                                            <tr key={inv._id || i} className="hover:bg-slate-50">
                                                <td className="p-2 text-slate-400 font-mono">{i + 1}</td>
                                                <td className="p-2 font-bold text-slate-800">#{inv.number}</td>
                                                <td className="p-2 text-slate-700">{inv.customer}</td>
                                                <td className="p-2 text-center font-mono font-bold">{formatCurrency(inv.total)}</td>
                                                <td className="p-2 text-center font-mono text-emerald-600">{formatCurrency(inv.paid)}</td>
                                                <td className="p-2 text-left text-slate-500 text-xs">
                                                    {new Date(inv.createdAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    ) : (
                        <Card className="shadow-sm border bg-white flex items-center justify-center h-64">
                            <div className="text-center text-slate-400">
                                <Eye size={40} className="mx-auto mb-2 opacity-30" />
                                <p>اختر يوم لعرض التفاصيل</p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
