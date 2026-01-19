import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
    TrendingUp, Package, DollarSign, ShoppingCart,
    Calendar, Filter, Download, ChevronDown, ArrowUpRight, ArrowDownRight, FileText, Printer, Users, Activity, X
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import SkeletonLoader from '../components/SkeletonLoader';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const GRADIENT_COLORS = {
    blue: ['#3b82f6', '#1d4ed8'],
    green: ['#10b981', '#059669'],
    orange: ['#f59e0b', '#d97706'],
    purple: ['#8b5cf6', '#7c3aed'],
    red: ['#ef4444', '#dc2626'],
    pink: ['#ec4899', '#db2777']
};

const ExportReportModal = ({ onClose }) => {
    const { push } = useToast();
    const [reportType, setReportType] = useState('trial-balance');
    const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [agingBucket, setAgingBucket] = useState('0-30');
    const [loading, setLoading] = useState(false);

    // Fetch Customers for Customer Statement
    const { data: customers } = useQuery({
        queryKey: ['customers-list'],
        queryFn: async () => {
            const { data } = await api.get('/customers');
            return data || [];
        },
        enabled: reportType === 'customer-statement'
    });

    const handleExport = async () => {
        setLoading(true);
        try {
            let endpoint = '';
            const params = new URLSearchParams();

            if (reportType === 'trial-balance') {
                endpoint = '/finance/reports/trial-balance/export';
                params.append('from', dateFrom);
                params.append('to', dateTo);
            } else if (reportType === 'income-statement') {
                endpoint = '/finance/reports/income-statement/export';
                params.append('from', dateFrom);
                params.append('to', dateTo);
            } else if (reportType === 'customer-statement') {
                if (!selectedCustomer) {
                    push('error', 'الرجاء اختيار العميل');
                    setLoading(false);
                    return;
                }
                endpoint = '/finance/reports/customer-statement/export';
                params.append('from', dateFrom);
                params.append('to', dateTo);
                params.append('customerId', selectedCustomer);
            } else if (reportType === 'aging-report') {
                endpoint = '/finance/reports/aging/export';
                params.append('to', dateTo); // Aging usually only needs "As of" date
                // params.append('bucket', agingBucket); // If backend supports bucket sizing
            }

            const response = await api.get(`${endpoint}?${params}`, {
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Extract filename from header or generate one
            const contentDisposition = response.headers['content-disposition'];
            let fileName = `${reportType}.xlsx`;
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (fileNameMatch && fileNameMatch.length === 2)
                    fileName = fileNameMatch[1];
            }

            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            push('success', 'تم تحميل التقرير بنجاح');
            onClose();

        } catch (error) {
            console.error('Export failed:', error);
            push('error', 'فشل تصدير التقرير، يرجى المحاولة مرة أخرى');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        تصدير التقارير المالية
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Report Type */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">نوع التقرير</label>
                        <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-medium"
                        >
                            <option value="trial-balance">ميزان المراجعة (Trial Balance)</option>
                            <option value="income-statement">قائمة الدخل (Income Statement)</option>
                            <option value="customer-statement">كشف حساب عميل (Customer Statement)</option>
                            <option value="aging-report">تقرير أعمار الديون (Aging Report)</option>
                        </select>
                    </div>

                    {/* Date Range - Show only "To" for Aging Report if preferred, or both */}
                    <div className="grid grid-cols-2 gap-4">
                        {reportType !== 'aging-report' && (
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">من تاريخ</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-medium"
                                />
                            </div>
                        )}
                        <div className={`space-y-2 ${reportType === 'aging-report' ? 'col-span-2' : ''}`}>
                            <label className="text-sm font-bold text-gray-700">
                                {reportType === 'aging-report' ? 'حتى تاريخ' : 'إلى تاريخ'}
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-medium"
                            />
                        </div>
                    </div>

                    {/* Customer Selection */}
                    {reportType === 'customer-statement' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                            <label className="text-sm font-bold text-gray-700">اختر العميل</label>
                            <select
                                value={selectedCustomer}
                                onChange={(e) => setSelectedCustomer(e.target.value)}
                                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none font-medium"
                            >
                                <option value="">-- اختر العميل --</option>
                                {customers?.map(c => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                جاري التصدير...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                تصدير Excel
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function Reports() {
    const { push } = useToast();
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const { warehouses } = useWarehouse();
    const [warehouseFilter, setWarehouseFilter] = useState('');
    const [timeRange, setTimeRange] = useState('month');
    const [showExportModal, setShowExportModal] = useState(false);

    // Profitability Report
    const { data: profitability, isLoading: loadingProfit } = useQuery({
        queryKey: ['profitability', dateRange, warehouseFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateRange.from) params.append('from', dateRange.from);
            if (dateRange.to) params.append('to', dateRange.to);
            if (warehouseFilter) params.append('warehouse', warehouseFilter);
            const { data } = await api.get(`/reports/profitability?${params}`);
            return data;
        }
    });

    // Top Products
    const { data: topProducts, isLoading: loadingProducts } = useQuery({
        queryKey: ['topProducts', dateRange, warehouseFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateRange.from) params.append('from', dateRange.from);
            if (dateRange.to) params.append('to', dateRange.to);
            if (warehouseFilter) params.append('warehouse', warehouseFilter);
            params.append('limit', '10');
            params.append('sortBy', 'revenue');
            const { data } = await api.get(`/reports/top-products?${params}`);
            return data;
        }
    });

    // Inventory Value
    const { data: inventoryValue, isLoading: loadingInventory } = useQuery({
        queryKey: ['inventoryValue', warehouseFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (warehouseFilter) params.append('warehouse', warehouseFilter);
            const { data } = await api.get(`/reports/inventory-value?${params}`);
            return data;
        }
    });

    // Cash Flow
    const { data: cashFlow, isLoading: loadingCash } = useQuery({
        queryKey: ['cashFlow', dateRange, warehouseFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateRange.from) params.append('from', dateRange.from);
            if (dateRange.to) params.append('to', dateRange.to);
            if (warehouseFilter) params.append('warehouse', warehouseFilter);
            const { data } = await api.get(`/reports/cash-flow?${params}`);
            return data;
        }
    });

    const handleExportPDF = () => {
        window.print();
    };

    const StatCard = ({ title, value, icon: Icon, gradient, subValue, trend }) => (
        <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-gray-50/50 p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all duration-500 group">
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
                style={{ backgroundImage: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` }} />

            {/* Floating Icon Background */}
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-5 group-hover:opacity-10 transition-all duration-500 transform group-hover:scale-110"
                style={{ backgroundColor: gradient[0] }} />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className={`p-3.5 rounded-2xl shadow-lg transform group-hover:scale-110 transition-transform duration-300`}
                        style={{
                            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
                            boxShadow: `0 4px 14px 0 ${gradient[0]}40`
                        }}>
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                    {trend !== undefined && (
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${trend > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {Math.abs(trend)}%
                        </div>
                    )}
                </div>
                <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-2">{title}</h3>
                <p className="text-3xl font-black text-gray-900 tracking-tight mb-1">{value}</p>
                {subValue && <p className="text-xs text-gray-400 font-medium">{subValue}</p>}
            </div>

            {/* Bottom Accent Line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]})` }} />
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-8 space-y-8">
            {/* Export Modal */}
            {showExportModal && <ExportReportModal onClose={() => setShowExportModal(false)} />}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/90 backdrop-blur-2xl p-8 rounded-3xl shadow-xl border border-white/40">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                            <Activity className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">التقارير والتحليلات</h1>
                    </div>
                    <p className="text-gray-600 mt-2 text-base font-medium mr-16">نظرة شاملة ومفصلة على أداء أعمالك وتحليل البيانات</p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-center">
                    <div className="relative">
                        <Filter className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                            value={warehouseFilter}
                            onChange={(e) => setWarehouseFilter(e.target.value)}
                            className="pl-3 !pr-9 py-2.5 bg-white rounded-xl border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none shadow-sm appearance-none hover:border-gray-300 transition-colors"
                        >
                            <option value="">كل المستودعات</option>
                            {warehouses.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 p-1.5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="relative">
                            <input
                                type="date"
                                value={dateRange.from}
                                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                className="pl-3 !pr-14 py-2 bg-white rounded-lg border-none text-sm font-medium focus:ring-2 focus:ring-blue-500/30 outline-none shadow-sm"
                            />
                            <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <span className="text-gray-400 font-bold px-1">→</span>
                        <div className="relative">
                            <input
                                type="date"
                                value={dateRange.to}
                                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                className="pl-3 !pr-14 py-2 bg-white rounded-lg border-none text-sm font-medium focus:ring-2 focus:ring-blue-500/30 outline-none shadow-sm"
                            />
                            <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    <button
                        onClick={() => setDateRange({ from: '', to: '' })}
                        className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-200 hover:shadow-sm"
                        title="إعادة تعيين"
                    >
                        <Filter className="w-5 h-5" />
                    </button>

                    <div className="h-8 w-px bg-gray-200" />

                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl transition-all shadow-lg shadow-purple-500/40 hover:shadow-xl hover:shadow-purple-500/50 font-semibold transform hover:scale-105"
                    >
                        <Printer className="w-4 h-4" />
                        <span>طباعة</span>
                    </button>

                    <button
                        onClick={() => setShowExportModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all shadow-lg shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-500/50 font-semibold transform hover:scale-105"
                    >
                        <Download className="w-4 h-4" />
                        <span>تصدير Excel</span>
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="إجمالي المبيعات"
                    value={loadingCash ? '...' : `${Number(cashFlow?.inflows?.totalSales || 0).toLocaleString()} د.ل`}
                    icon={DollarSign}
                    gradient={GRADIENT_COLORS.blue}
                    subValue="صافي التدفقات النقدية"
                    trend={8.2}
                />
                <StatCard
                    title="إجمالي الربح"
                    value={loadingProfit ? '...' : `${Number(profitability?.totals?.grossProfit || 0).toLocaleString()} د.ل`}
                    icon={TrendingUp}
                    gradient={GRADIENT_COLORS.green}
                    subValue="الأرباح قبل الخصم"
                    trend={12.5}
                />
                <StatCard
                    title="قيمة المخزون"
                    value={loadingInventory ? '...' : `${Number(inventoryValue?.totals?.totalInventoryValue || 0).toLocaleString()} د.ل`}
                    icon={Package}
                    gradient={GRADIENT_COLORS.purple}
                    subValue="إجمالي الأصول المخزنية"
                    trend={-3.1}
                />
                <StatCard
                    title="هامش الربح"
                    value={loadingProfit ? '...' : `${profitability?.totals?.margin || 0}%`}
                    icon={ShoppingCart}
                    gradient={GRADIENT_COLORS.orange}
                    subValue="متوسط الهامش العام"
                    trend={5.8}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Profitability Chart */}
                <div className="lg:col-span-2 bg-white/90 backdrop-blur-2xl p-8 rounded-3xl shadow-xl border border-white/40">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                    <TrendingUp className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-2xl font-black text-gray-900">تحليل الربحية</h2>
                            </div>
                            <p className="text-sm text-gray-500 font-medium mr-12">مقارنة الإيرادات والتكاليف حسب الفئة</p>
                        </div>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 text-sm font-semibold text-gray-700 rounded-xl py-2.5 px-4 focus:ring-2 focus:ring-blue-500/30 outline-none cursor-pointer hover:border-gray-300 transition-all shadow-sm"
                        >
                            <option value="week">هذا الأسبوع</option>
                            <option value="month">هذا الشهر</option>
                            <option value="quarter">آخر 3 أشهر</option>
                            <option value="year">هذا العام</option>
                        </select>
                    </div>

                    <div className="h-[400px] w-full">
                        {loadingProfit ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-gray-500 font-medium">جاري تحميل البيانات...</p>
                                </div>
                            </div>
                        ) : profitability?.byCategory?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={380} minWidth={0}>
                                <BarChart data={profitability.byCategory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        </linearGradient>
                                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.9} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                                    <XAxis
                                        dataKey="category"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 500 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6b7280', fontSize: 13, fontWeight: 500 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                            borderRadius: '16px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                            padding: '12px 16px',
                                            fontWeight: '600'
                                        }}
                                        cursor={{ fill: '#f3f4f6', radius: 8 }}
                                    />
                                    <Legend
                                        iconType="circle"
                                        wrapperStyle={{ paddingTop: '20px', fontWeight: '600' }}
                                    />
                                    <Bar dataKey="revenue" name="الإيرادات" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} maxBarSize={60} />
                                    <Bar dataKey="cost" name="التكلفة" fill="url(#colorCost)" radius={[8, 8, 0, 0]} maxBarSize={60} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                                        <Package className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 font-medium">لا توجد بيانات متاحة</p>
                                    <p className="text-gray-400 text-sm mt-1">قم بإضافة معاملات لرؤية التحليلات</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cash Flow Chart */}
                <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-3xl shadow-xl border border-white/40">
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900">التدفق النقدي</h2>
                        </div>
                        <p className="text-sm text-gray-500 font-medium mr-12">تحليل التدفقات المالية الواردة والصادرة</p>
                    </div>

                    <div className="h-[300px] w-full">
                        {loadingCash ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                    <p className="text-gray-500 font-medium">جاري تحميل البيانات...</p>
                                </div>
                            </div>
                        ) : cashFlow?.timeline?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280} minWidth={0}>
                                <AreaChart data={cashFlow.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="cashInflow" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="cashOutflow" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                            borderRadius: '16px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            padding: '12px 16px',
                                            fontWeight: '600'
                                        }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '15px', fontWeight: '600' }} />
                                    <Area type="monotone" dataKey="inflow" name="الواردات" stroke="#10b981" strokeWidth={3} fill="url(#cashInflow)" />
                                    <Area type="monotone" dataKey="outflow" name="الصادرات" stroke="#f59e0b" strokeWidth={3} fill="url(#cashOutflow)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                                        <Activity className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 font-medium">لا توجد بيانات متاحة</p>
                                    <p className="text-gray-400 text-sm mt-1">قم بإضافة معاملات مالية لرؤية التدفق النقدي</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Warehouse Distribution */}
                <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-3xl shadow-xl border border-white/40">
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <Package className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900">توزيع المخزون</h2>
                        </div>
                        <p className="text-sm text-gray-500 font-medium mr-12">القيمة حسب المستودع</p>
                    </div>

                    {/* PieChart Container */}
                    <div className="h-[240px] relative">
                        {loadingInventory ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                                    <p className="text-gray-500 font-medium">جاري تحميل البيانات...</p>
                                </div>
                            </div>
                        ) : inventoryValue?.byWarehouse?.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220} minWidth={0}>
                                <PieChart>
                                    <Pie
                                        data={inventoryValue.byWarehouse}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={85}
                                        paddingAngle={5}
                                        dataKey="totalValue"
                                    >
                                        {inventoryValue.byWarehouse.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                            borderRadius: '16px',
                                            border: 'none',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                            padding: '12px 16px',
                                            fontWeight: '600'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                                        <Package className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 font-medium">لا توجد بيانات</p>
                                    <p className="text-gray-400 text-sm mt-1">قم بإضافة منتجات إلى المخزون</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Custom Legend */}
                    {inventoryValue?.byWarehouse?.length > 0 && (
                        <div className="mt-4 space-y-2.5 border-t border-gray-100 pt-4">
                            {inventoryValue.byWarehouse.slice(0, 5).map((wh, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                        <span className="text-gray-700 font-medium">{wh.warehouse}</span>
                                    </div>
                                    <span className="font-bold text-gray-900">{Number(wh.totalValue).toLocaleString()} د.ل</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Top Products Table */}
            <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/40 overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-purple-50/50">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900">المنتجات الأكثر مبيعاً</h2>
                        </div>
                        <p className="text-sm text-gray-500 font-medium mr-12">أفضل 10 منتجات من حيث الإيرادات والأرباح</p>
                    </div>
                    <button className="px-4 py-2 bg-white hover:bg-gray-50 text-blue-600 text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md border border-gray-200">
                        عرض الكل ←
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-600 uppercase tracking-wider">المنتج</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-600 uppercase tracking-wider">الفئة</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-600 uppercase tracking-wider">الإيرادات</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-600 uppercase tracking-wider">الربح</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-600 uppercase tracking-wider">الكمية</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-gray-600 uppercase tracking-wider">الأداء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loadingProducts ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                                            <p className="text-gray-500 font-medium">جاري تحميل المنتجات...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : topProducts?.products?.length > 0 ? (
                                topProducts.products.map((product, idx) => (
                                    <tr key={idx} className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 transition-all duration-200 group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-md ${idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' :
                                                    idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                                                        idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white' :
                                                            'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600'
                                                    }`}>
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{product.productName}</div>
                                                    <div className="text-xs text-gray-400 mt-0.5 font-medium">{product.sku}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-sm text-gray-600">
                                            <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 text-xs font-bold shadow-sm">
                                                {product.category || 'عام'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-sm font-black text-gray-900">{Number(product.revenue).toLocaleString()} د.ل</td>
                                        <td className="px-6 py-5 text-sm font-black text-emerald-600">{Number(product.profit).toLocaleString()} د.ل</td>
                                        <td className="px-6 py-5 text-sm font-bold text-gray-700">{product.quantity}</td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                                                        style={{ width: `${Math.min((product.revenue / (topProducts.products[0].revenue || 1)) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-gray-600">
                                                    {Math.round((product.revenue / (topProducts.products[0].revenue || 1)) * 100)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                                                <ShoppingCart className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="text-gray-500 font-medium">لا توجد بيانات متاحة</p>
                                                <p className="text-gray-400 text-sm mt-1">قم بإضافة منتجات ومبيعات لرؤية التحليلات</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
