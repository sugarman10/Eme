import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import {
    Download, Calendar, Printer, FileText, TrendingUp, TrendingDown,
    ChevronDown, ChevronRight, Landmark, Activity, DollarSign, Filter,
    Layers, PieChart as PieChartIcon, ArrowRightLeft
} from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';

/**
 * Helper to safely parse numbers
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

// ==========================================
// 1. TRIAL BALANCE TAB
// ==========================================
const TrialBalanceTab = ({ dateFrom, dateTo }) => {
    const [expandedTypes, setExpandedTypes] = useState({
        asset: true, liability: true, equity: true, revenue: true, expense: true
    });

    const { data: trialBalance, isLoading } = useQuery({
        queryKey: ['trial-balance', dateFrom, dateTo],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateFrom) params.append('from', dateFrom);
            if (dateTo) params.append('to', dateTo);
            const { data } = await api.get(`/finance/reports/trial-balance?${params}`);
            return data;
        }
    });

    const toggleType = (type) => setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));

    const typeLabels = {
        asset: { name: 'الأصول', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        liability: { name: 'الخصوم', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
        equity: { name: 'حقوق الملكية', icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50' },
        revenue: { name: 'الإيرادات', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        expense: { name: 'المصروفات', icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50' }
    };

    const groupedAccounts = trialBalance?.accounts?.reduce((acc, account) => {
        const type = account.type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(account);
        return acc;
    }, {}) || {};

    const totals = {
        debit: toNumber(trialBalance?.totals?.totalDebit),
        credit: toNumber(trialBalance?.totals?.totalCredit)
    };
    const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

    if (isLoading) return <SkeletonLoader rows={10} columns={4} type="table" />;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status Card */}
            <div className={`p-4 rounded-2xl border-2 ${isBalanced
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isBalanced ? 'bg-green-200' : 'bg-red-200'}`}>
                        {isBalanced ? '✓' : '✗'}
                    </div>
                    <div>
                        <p className="font-bold text-lg">{isBalanced ? 'الميزان متوازن' : 'الميزان غير متوازن'}</p>
                        <p className="text-sm opacity-90">
                            إجمالي المدين: {totals.debit.toLocaleString()} د.ل | إجمالي الدائن: {totals.credit.toLocaleString()} د.ل
                        </p>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-right">
                    <thead className="bg-gray-100/50 text-gray-700">
                        <tr>
                            <th className="px-6 py-3 font-bold text-sm">كود الحساب</th>
                            <th className="px-6 py-3 font-bold text-sm">اسم الحساب</th>
                            <th className="px-6 py-3 font-bold text-sm">مدين</th>
                            <th className="px-6 py-3 font-bold text-sm">دائن</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {Object.entries(groupedAccounts).map(([type, accounts]) => {
                            const typeInfo = typeLabels[type] || { name: type, color: 'text-gray-600', bg: 'bg-gray-50' };
                            const TypeIcon = typeInfo.icon || FileText;
                            const isExpanded = expandedTypes[type];
                            const typeTotal = accounts.reduce((acc, a) => ({
                                debit: acc.debit + toNumber(a.debitTotal),
                                credit: acc.credit + toNumber(a.creditTotal)
                            }), { debit: 0, credit: 0 });

                            return (
                                <React.Fragment key={type}>
                                    <tr className={`${typeInfo.bg} cursor-pointer hover:bg-opacity-80 transition-colors`} onClick={() => toggleType(type)}>
                                        <td colSpan="2" className="px-6 py-2.5">
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                <TypeIcon size={18} className={typeInfo.color} />
                                                <span className={`font-bold ${typeInfo.color}`}>{typeInfo.name}</span>
                                                <span className="text-xs text-gray-500">({accounts.length})</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-2.5 font-bold text-gray-700">{typeTotal.debit.toLocaleString()}</td>
                                        <td className="px-6 py-2.5 font-bold text-gray-700">{typeTotal.credit.toLocaleString()}</td>
                                    </tr>
                                    {isExpanded && accounts.map((account, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-2 text-sm text-gray-500 font-mono">{account.code}</td>
                                            <td className="px-6 py-2 text-sm font-medium text-gray-700">{account.name}</td>
                                            <td className="px-6 py-2 text-sm text-gray-600">{toNumber(account.debitTotal) ? toNumber(account.debitTotal).toLocaleString() : '-'}</td>
                                            <td className="px-6 py-2 text-sm text-gray-600">{toNumber(account.creditTotal) ? toNumber(account.creditTotal).toLocaleString() : '-'}</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                        <tr className="bg-gray-800 text-white font-bold text-base">
                            <td colSpan="2" className="px-6 py-4 text-center">الإجمالي النهائي</td>
                            <td className="px-6 py-4">{totals.debit.toLocaleString()} د.ل</td>
                            <td className="px-6 py-4">{totals.credit.toLocaleString()} د.ل</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ==========================================
// 2. INCOME STATEMENT TAB (P&L)
// ==========================================
const IncomeStatementTab = ({ dateFrom, dateTo }) => {
    const { data: incomeStatement, isLoading } = useQuery({
        queryKey: ['income-statement', dateFrom, dateTo],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateFrom) params.append('from', dateFrom);
            if (dateTo) params.append('to', dateTo);
            const { data } = await api.get(`/finance/reports/income-statement?${params}`);
            return data;
        }
    });

    if (isLoading) return <SkeletonLoader rows={8} columns={3} type="table" />;

    // Map backend response to expected format
    const revenueAccounts = incomeStatement?.حسابات_الإيرادات || [];
    const expenseAccounts = incomeStatement?.حسابات_المصروفات_التشغيلية || [];
    const totals = incomeStatement?.الإجماليات || {};

    const revenues = {
        الإجمالي: totals.إجمالي_الإيرادات || 0,
        الحسابات: revenueAccounts
    };

    const expenses = {
        الإجمالي: totals.المصروفات_التشغيلية || 0,
        الحسابات: expenseAccounts
    };

    const Section = ({ title, data, icon: Icon, colorClass, bgClass }) => (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mb-6">
            <div className={`px-6 py-4 border-b ${bgClass} flex justify-between items-center`}>
                <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${colorClass}`} />
                    <h3 className={`font-bold text-lg ${colorClass}`}>{title}</h3>
                </div>
                <span className={`font-bold text-lg ${colorClass}`}>
                    {Number(data?.الإجمالي || 0).toLocaleString()} د.ل
                </span>
            </div>
            <div className="p-0">
                <table className="w-full text-right">
                    <tbody className="divide-y divide-gray-50">
                        {data?.الحسابات?.map((acc, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                                <td className="px-6 py-3 text-sm text-gray-600 font-mono w-32">{acc.code}</td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-800">{acc.name}</td>
                                <td className="px-6 py-3 text-sm font-bold text-gray-700 text-left">
                                    {Number(acc.balance).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                        {(!data?.الحسابات || data.الحسابات.length === 0) && (
                            <tr><td colSpan="3" className="px-6 py-4 text-center text-gray-400">لا توجد حركات</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const netProfit = Number(totals.صافي_الربح || 0);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary Header */}
            <div className="mb-8 text-center p-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-gray-400 text-sm font-medium mb-1">صافي الربح / الخسارة</h2>
                    <h1 className={`text-5xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {netProfit.toLocaleString()} <span className="text-2xl text-gray-400">د.ل</span>
                    </h1>
                    <p className="text-sm text-gray-400 mt-2 font-light">للفترة من {dateFrom} إلى {dateTo}</p>
                </div>
                <Activity className="absolute right-0 bottom-0 text-white/5 w-48 h-48 -mr-10 -mb-10 rotate-12" />
            </div>

            <Section
                title="الإيرادات (Revenues)"
                data={revenues}
                icon={TrendingUp}
                colorClass="text-emerald-700"
                bgClass="bg-emerald-50 border-emerald-100"
            />
            <Section
                title="المصروفات (Expenses)"
                data={expenses}
                icon={TrendingDown}
                colorClass="text-rose-700"
                bgClass="bg-rose-50 border-rose-100"
            />
        </div>
    );
};


// ==========================================
// 3. BALANCE SHEET TAB
// ==========================================
const BalanceSheetTab = ({ dateTo }) => {
    const { data: balanceSheet, isLoading } = useQuery({
        queryKey: ['balance-sheet', dateTo],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateTo) params.append('to', dateTo);
            const { data } = await api.get(`/finance/reports/balance-sheet?${params}`);
            return data;
        }
    });

    if (isLoading) return <SkeletonLoader rows={12} columns={3} type="table" />;

    const { الأصول, الخصوم, حقوق_الملكية, الإجماليات } = balanceSheet || {};

    const BSSection = ({ title, data, icon: Icon, color, totalColor }) => (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col h-full">
            <div className={`px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2`}>
                <div className={`p-1.5 rounded-lg ${color.bg}`}>
                    <Icon className={`w-5 h-5 ${color.text}`} />
                </div>
                <h3 className="font-bold text-gray-800">{title}</h3>
            </div>
            <div className="flex-1">
                <table className="w-full text-right">
                    <tbody className="divide-y divide-gray-50">
                        {data?.الحسابات?.map((acc, idx) => (
                            <tr key={idx} className={`hover:bg-gray-50/50 ${acc.isCalculated ? 'bg-yellow-50/50' : ''}`}>
                                <td className="px-4 py-2 text-xs text-gray-500 font-mono w-20">{acc.code}</td>
                                <td className="px-4 py-2 text-sm">
                                    <div className="font-medium text-gray-800">{acc.name}</div>
                                    {acc.isCalculated && <span className="text-[10px] text-yellow-600 font-bold px-1.5 py-0.5 bg-yellow-100 rounded-md">محسوب تلقائياً</span>}
                                </td>
                                <td className="px-4 py-2 text-sm font-bold text-gray-700 text-left">
                                    {Number(acc.balance).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className={`px-5 py-3 border-t border-gray-100 ${totalColor} text-white flex justify-between items-center font-bold`}>
                <span>الإجمالي</span>
                <span>{Number(data?.الإجمالي || 0).toLocaleString()} د.ل</span>
            </div>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <BSSection
                    title="الأصول (Assets)"
                    data={الأصول}
                    icon={PieChartIcon}
                    color={{ bg: 'bg-blue-100', text: 'text-blue-600' }}
                    totalColor="bg-blue-600"
                />

                <div className="space-y-6">
                    <BSSection
                        title="الخصوم (Liabilities)"
                        data={الخصوم}
                        icon={ArrowRightLeft}
                        color={{ bg: 'bg-red-100', text: 'text-red-600' }}
                        totalColor="bg-red-600"
                    />
                    <BSSection
                        title="حقوق الملكية (Equity)"
                        data={حقوق_الملكية}
                        icon={Landmark}
                        color={{ bg: 'bg-purple-100', text: 'text-purple-600' }}
                        totalColor="bg-purple-600"
                    />
                </div>
            </div>

            {/* Balancing Check */}
            <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-right">
                    <div className="text-gray-400 text-sm mb-1">إجمالي الأصول</div>
                    <div className="text-3xl font-bold font-mono text-blue-400">{Number(الإجماليات?.إجمالي_الأصول || 0).toLocaleString()}</div>
                </div>

                <div className="hidden md:block text-2xl font-black text-gray-600">=</div>

                <div className="text-center md:text-right">
                    <div className="text-gray-400 text-sm mb-1">إجمالي الخصوم + حقوق الملكية</div>
                    <div className="text-3xl font-bold font-mono text-purple-400">{Number(الإجماليات?.إجمالي_الخصوم_وحقوق_الملكية || 0).toLocaleString()}</div>
                </div>

                <div className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 ${الإجماليات?.متوازن ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    {الإجماليات?.متوازن ? (
                        <><span>✓</span> متوازن</>
                    ) : (
                        <><span>⚠</span> غير متوازن (الفرق: {الإجماليات?.الفرق})</>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================
export default function FinancialReports() {
    const { push } = useToast();
    const [activeTab, setActiveTab] = useState('trial-balance');
    const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    const handlePrint = () => {
        window.print();
    };

    const handleExport = async () => {
        try {
            const params = new URLSearchParams();
            if (dateFrom) params.append('from', dateFrom);
            if (dateTo) params.append('to', dateTo);

            let endpoint = `/finance/reports/${activeTab}/export`;
            // Balance sheet export endpoint fix if naming differs
            if (activeTab === 'balance-sheet') endpoint = '/finance/reports/balance-sheet/export'; // Assuming backend support

            // Note: Backend might not support balance-sheet export yet based on file view earlier
            // I'll stick to a generic export try
            if (activeTab === 'balance-sheet') {
                push('info', 'تصدير الميزانية العمومية غير مدعوم حالياً، يرجى استخدام الطباعة');
                return;
            }

            const response = await api.get(`${endpoint}?${params}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${activeTab}-report.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            push('success', 'تم تحميل التقرير بنجاح');
        } catch (error) {
            console.error('Export failed:', error);
            push('error', 'فشل تصدير التقرير');
        }
    };

    const tabs = [
        { id: 'trial-balance', label: 'ميزان المراجعة', icon: Layers },
        { id: 'income-statement', label: 'قائمة الدخل', icon: Activity },
        { id: 'balance-sheet', label: 'الميزانية العمومية', icon: Landmark },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 p-6 md:p-8 print:p-0 print:bg-white">
            <style>
                {`
                @media print {
                    .no-print, .sidebar, nav, button, input { display: none !important; }
                    .print-only { display: block !important; }
                    body { background: white !important; }
                    .app-layout { padding: 0 !important; margin: 0 !important; }
                    .main-content { margin: 0 !important; padding: 0 !important; }
                    .card { border: none !important; shadow: none !important; }
                    .bg-gradient-to-br { background: none !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
                `}
            </style>

            {/* Header Controls (Hidden in Print) */}
            <div className="no-print space-y-6 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">التقارير المالية</h1>
                            <p className="text-gray-500 text-sm font-medium mt-1">القوائم المالية الختامية والتحليل المالي</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Date Filters */}
                    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="relative">
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                disabled={activeTab === 'balance-sheet'} // Balance Sheet is "As of" usually, but here we support range for TB derived calc, though typically just 'To' matters for BS stocks. However, P&L needs range.
                                className={`pl-3 !pr-10 py-2 bg-transparent rounded-lg border-none text-sm font-bold focus:ring-0 outline-none ${activeTab === 'balance-sheet' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <span className="text-gray-300 font-bold px-1">→</span>
                        <div className="relative">
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="pl-3 !pr-10 py-2 bg-transparent rounded-lg border-none text-sm font-bold focus:ring-0 outline-none"
                            />
                            <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors shadow-lg shadow-gray-200 font-bold text-sm"
                        >
                            <Printer size={16} />
                            طباعة
                        </button>
                        {activeTab !== 'balance-sheet' && (
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 font-bold text-sm"
                            >
                                <Download size={16} />
                                تصدير Excel
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Print Header (Visible ONLY in Print) */}
            <div className="hidden print:block text-center mb-8 border-b-2 border-gray-800 pb-4">
                <h1 className="text-3xl font-black mb-2">
                    {tabs.find(t => t.id === activeTab)?.label}
                </h1>
                <p className="text-gray-600">
                    للفترة من {dateFrom} إلى {dateTo}
                </p>
                <p className="text-xs text-gray-400 mt-2">تاريخ الطباعة: {new Date().toLocaleString('ar-LY')}</p>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {activeTab === 'trial-balance' && <TrialBalanceTab dateFrom={dateFrom} dateTo={dateTo} />}
                {activeTab === 'income-statement' && <IncomeStatementTab dateFrom={dateFrom} dateTo={dateTo} />}
                {activeTab === 'balance-sheet' && <BalanceSheetTab dateTo={dateTo} />}
            </div>

            {/* Print Footer */}
            <div className="hidden print:block mt-12 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
                <p>نهاية التقرير - ERP System Pro</p>
            </div>
        </div>
    );
}
