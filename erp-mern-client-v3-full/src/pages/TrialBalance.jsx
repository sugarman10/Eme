import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import {
    Download, Calendar, Printer, FileText, TrendingUp, TrendingDown,
    ChevronDown, ChevronRight, Landmark
} from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';

/**
 * Safe number conversion helper
 * Handles null, undefined, strings with commas, "-", and NaN
 */
const toNumber = (v) => {
    if (v === null || v === undefined || v === '' || v === '-') return 0;
    if (typeof v === 'string') {
        const cleaned = v.replace(/[,\s]/g, '').replace(/[^\d.\-]/g, '');
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export default function TrialBalance() {
    const { push } = useToast();
    const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [expandedTypes, setExpandedTypes] = useState({
        asset: true,
        liability: true,
        equity: true,
        revenue: true,
        expense: true
    });

    // Fetch Trial Balance
    const { data: trialBalance, isLoading, refetch } = useQuery({
        queryKey: ['trial-balance', dateFrom, dateTo],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('from', dateFrom);
            params.append('to', dateTo);
            const { data } = await api.get(`/finance/reports/trial-balance?${params}`);
            return data;
        }
    });

    const handleExport = async () => {
        try {
            const params = new URLSearchParams();
            params.append('from', dateFrom);
            params.append('to', dateTo);

            const response = await api.get(`/finance/reports/trial-balance/export?${params}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `trial-balance-${dateFrom}-to-${dateTo}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            push('success', 'تم تحميل ميزان المراجعة بنجاح');
        } catch (error) {
            console.error('Export failed:', error);
            push('error', 'فشل تصدير التقرير');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const toggleType = (type) => {
        setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const typeLabels = {
        asset: { name: 'الأصول', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        liability: { name: 'الخصوم', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
        equity: { name: 'حقوق الملكية', icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50' },
        revenue: { name: 'الإيرادات', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        expense: { name: 'المصروفات', icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50' }
    };

    // Group accounts by type
    const groupedAccounts = trialBalance?.accounts?.reduce((acc, account) => {
        const type = account.type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(account);
        return acc;
    }, {}) || {};

    // Safely calculate totals with fallback to 0
    const rawTotals = trialBalance?.totals || { debit: 0, credit: 0 };
    const totals = {
        debit: toNumber(rawTotals.debit),
        credit: toNumber(rawTotals.credit)
    };
    const difference = Math.abs(totals.debit - totals.credit);
    const isBalanced = difference < 0.01;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-8">
            {/* Header */}
            <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-3xl shadow-xl border border-white/40 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                                <FileText className="w-7 h-7 text-white" />
                            </div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">ميزان المراجعة</h1>
                        </div>
                        <p className="text-gray-600 mt-2 text-base font-medium mr-16">
                            Trial Balance - عرض أرصدة الحسابات المدينة والدائنة
                        </p>
                    </div>

                    {/* Date Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 p-1.5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="relative">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="pl-3 !pr-14 py-2 bg-white rounded-lg border-none text-sm font-medium focus:ring-2 focus:ring-blue-500/30 outline-none shadow-sm"
                                />
                                <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            <span className="text-gray-400 font-bold px-1">→</span>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="pl-3 !pr-14 py-2 bg-white rounded-lg border-none text-sm font-medium focus:ring-2 focus:ring-blue-500/30 outline-none shadow-sm"
                                />
                                <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-lg font-semibold"
                        >
                            <Printer className="w-4 h-4" />
                            <span>طباعة</span>
                        </button>

                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg font-semibold"
                        >
                            <Download className="w-4 h-4" />
                            <span>تصدير Excel</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Balance Status */}
            <div className={`mb-6 p-4 rounded-2xl border-2 ${isBalanced
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isBalanced ? 'bg-green-200' : 'bg-red-200'}`}>
                        {isBalanced ? '✓' : '✗'}
                    </div>
                    <div>
                        <p className="font-bold text-lg">
                            {isBalanced ? 'الميزان متوازن' : 'الميزان غير متوازن'}
                        </p>
                        <p className="text-sm opacity-80">
                            إجمالي المدين: {totals.debit.toLocaleString()} د.ل |
                            إجمالي الدائن: {totals.credit.toLocaleString()} د.ل
                            {!isBalanced && ` | الفرق: ${difference.toLocaleString()} د.ل`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Trial Balance Table */}
            <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/40 overflow-hidden print:shadow-none">
                {isLoading ? (
                    <div className="p-8">
                        <SkeletonLoader rows={10} columns={4} type="table" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
                                <tr>
                                    <th className="px-6 py-4 text-right text-sm font-bold">كود الحساب</th>
                                    <th className="px-6 py-4 text-right text-sm font-bold">اسم الحساب</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold">مدين</th>
                                    <th className="px-6 py-4 text-left text-sm font-bold">دائن</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(groupedAccounts).map(([type, accounts]) => {
                                    const typeInfo = typeLabels[type] || { name: type, color: 'text-gray-600', bg: 'bg-gray-50' };
                                    const TypeIcon = typeInfo.icon || FileText;
                                    const isExpanded = expandedTypes[type];
                                    const typeTotal = accounts.reduce((acc, a) => ({
                                        debit: acc.debit + toNumber(a.debit),
                                        credit: acc.credit + toNumber(a.credit)
                                    }), { debit: 0, credit: 0 });

                                    return (
                                        <React.Fragment key={type}>
                                            {/* Type Header */}
                                            <tr
                                                className={`${typeInfo.bg} cursor-pointer hover:bg-opacity-80 transition-colors`}
                                                onClick={() => toggleType(type)}
                                            >
                                                <td colSpan="2" className="px-6 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                        <TypeIcon size={20} className={typeInfo.color} />
                                                        <span className={`font-bold ${typeInfo.color}`}>{typeInfo.name}</span>
                                                        <span className="text-gray-400 text-sm">({accounts.length} حساب)</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-left font-bold text-gray-700">
                                                    {typeTotal.debit.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-3 text-left font-bold text-gray-700">
                                                    {typeTotal.credit.toLocaleString()}
                                                </td>
                                            </tr>

                                            {/* Accounts under this type */}
                                            {isExpanded && accounts.map((account, idx) => (
                                                <tr key={account._id || idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-3 pr-12 text-sm text-gray-600 font-mono">
                                                        {account.code}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm text-gray-800 font-medium">
                                                        {account.name}
                                                    </td>
                                                    <td className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                                                        {toNumber(account.debit) > 0 ? toNumber(account.debit).toLocaleString() : '-'}
                                                    </td>
                                                    <td className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                                                        {toNumber(account.credit) > 0 ? toNumber(account.credit).toLocaleString() : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}

                                {/* Totals Row */}
                                <tr className="bg-gradient-to-r from-gray-800 to-gray-900 text-white font-bold">
                                    <td colSpan="2" className="px-6 py-4 text-right text-lg">
                                        الإجمالي
                                    </td>
                                    <td className="px-6 py-4 text-left text-lg">
                                        {totals.debit.toLocaleString()} د.ل
                                    </td>
                                    <td className="px-6 py-4 text-left text-lg">
                                        {totals.credit.toLocaleString()} د.ل
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Footer Note */}
            <div className="mt-6 text-center text-gray-500 text-sm print:mt-4">
                <p>تم إنشاء هذا التقرير في {new Date().toLocaleDateString('ar-LY')}</p>
            </div>
        </div>
    );
}
