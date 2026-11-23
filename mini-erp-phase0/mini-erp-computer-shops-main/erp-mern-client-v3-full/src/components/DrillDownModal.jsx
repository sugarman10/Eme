import { useState } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Package, FileText, CreditCard, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useEffect } from 'react';
import SkeletonLoader from './SkeletonLoader';

const TABS = {
    invoices: { id: 'invoices', label: 'الفواتير', icon: FileText },
    receipts: { id: 'receipts', label: 'سندات القبض', icon: CreditCard },
    lowStock: { id: 'lowStock', label: 'المخزون المنخفض', icon: Package },
    alerts: { id: 'alerts', label: 'التنبيهات المالية', icon: AlertTriangle }
};

export default function DrillDownModal({ isOpen, onClose, initialTab, filters }) {
    const [activeTab, setActiveTab] = useState(initialTab || 'invoices');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [data, setData] = useState({ items: [], total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab || 'invoices');
            setSearch('');
            setPage(1);
        }
    }, [isOpen, initialTab]);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, activeTab, search, page, filters]);

    const loadData = async () => {
        setLoading(true);
        try {
            let endpoint = '';
            const params = { page, limit, search };

            if (activeTab === 'invoices') {
                endpoint = '/dashboard/drilldown/invoices';
                if (filters?.from) params.from = filters.from;
                if (filters?.to) params.to = filters.to;
                if (filters?.warehouseId) params.warehouseId = filters.warehouseId;
            } else if (activeTab === 'receipts') {
                endpoint = '/dashboard/drilldown/receipts';
                if (filters?.from) params.from = filters.from;
                if (filters?.to) params.to = filters.to;
            } else if (activeTab === 'lowStock') {
                endpoint = '/dashboard/drilldown/low-stock';
                if (filters?.warehouseId) params.warehouseId = filters.warehouseId;
            } else if (activeTab === 'alerts') {
                endpoint = '/dashboard/drilldown/alerts';
            }

            const res = await api.get(endpoint, { params });
            setData(res.data);
        } catch (error) {
            console.error('Drilldown error:', error);
            setData({ items: [], total: 0, totalPages: 0 });
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => Number(val).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD' });
    const formatDate = (date) => new Date(date).toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">تفاصيل البيانات</h2>
                        {filters?.from && filters?.to && (
                            <p className="text-sm text-slate-500 mt-1">
                                الفترة: {formatDate(filters.from)} - {formatDate(filters.to)}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-6 pt-4 border-b border-slate-200">
                    {Object.values(TABS).map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setPage(1); }}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="p-6 border-b border-slate-200">
                    <div className="relative">
                        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="بحث..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pr-10 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <SkeletonLoader rows={5} type="card" />
                    ) : data.items.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            لا توجد بيانات
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeTab === 'invoices' && data.items.map((inv) => (
                                <div key={inv._id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center font-bold text-xs">
                                                #{inv.number || inv._id?.slice(-4)}
                                            </div>
                                            <div>
                                                <p className="font-medium">{inv.customer?.name || 'عميل نقدي'}</p>
                                                <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold">{formatCurrency(inv.totals?.grand || 0)}</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === 'posted' ? 'bg-success-light' : 'bg-warning-light'
                                                }`}>
                                                {inv.status === 'posted' ? 'مرحل' : 'مؤكد'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {activeTab === 'receipts' && data.items.map((receipt) => (
                                <div key={receipt._id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{receipt.customer?.name || 'غير محدد'}</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(receipt.date)}</p>
                                            {receipt.note && <p className="text-xs text-muted-foreground mt-1">{receipt.note}</p>}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-success">{formatCurrency(receipt.amount)}</p>
                                            <p className="text-xs text-muted-foreground">{receipt.method === 'cash' ? 'نقدي' : receipt.method}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {activeTab === 'lowStock' && data.items.map((item) => (
                                <div key={item._id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                                <Package size={20} className="text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                                            </div>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-destructive font-bold">
                                                {item.totalStock} / {item.minStock}
                                            </p>
                                            <p className="text-xs text-muted-foreground">الحالي / الحد الأدنى</p>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {activeTab === 'alerts' && data.items.map((alert, idx) => {
                                const severityConfig = {
                                    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconBg: 'bg-red-100' },
                                    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', iconBg: 'bg-amber-100' },
                                    low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100' }
                                };
                                const config = severityConfig[alert.severity] || severityConfig.medium;

                                return (
                                    <div key={alert.id || idx} className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                                                <AlertTriangle size={20} className={config.text} />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`font-bold ${config.text} mb-1`}>{alert.title}</h4>
                                                <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                                                {alert.details && (
                                                    <div className="mt-3 space-y-2">
                                                        {alert.details.map((detail, i) => (
                                                            <div key={i} className="flex items-center justify-between p-2 bg-white/60 rounded-lg text-sm">
                                                                <span className="font-medium text-gray-700">{detail.name}</span>
                                                                <span className={`font-bold ${config.text}`}>{formatCurrency(detail.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {data.totalPages > 1 && (
                    <div className="flex items-center justify-between p-6 border-t border-slate-200 bg-slate-50">
                        <div className="text-sm text-slate-600">
                            صفحة {page} من {data.totalPages} · إجمالي {data.total}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-slate-700"
                            >
                                <ChevronRight size={18} />
                            </button>
                            <button
                                onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                                disabled={page === data.totalPages}
                                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-slate-700"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
