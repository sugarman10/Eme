import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/utils';
import { Calendar, Users, DollarSign, CheckCircle, Clock, Search, Wallet } from 'lucide-react';
import { TreasurySelector } from '../components/TreasurySelector';

export default function Payroll() {
    const { push } = useToast();
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    // Bulk Payment State
    const [payAllModalOpen, setPayAllModalOpen] = useState(false);
    const [payingAll, setPayingAll] = useState(false);

    // Individual Payment State
    const [selectedTreasury, setSelectedTreasury] = useState('');
    const [selectedSlip, setSelectedSlip] = useState(null);
    const [paying, setPaying] = useState(false);

    const fetchPayroll = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/hr/payroll/${month}`);
            setPayrolls(data);
        } catch (error) {
            console.error(error);
            // Don't show error on 404 (just means no payroll generated yet)
            if (error?.response?.status !== 404) {
                push('error', 'فشل تحميل كشف الرواتب');
            } else {
                setPayrolls([]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayroll();
    }, [month]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await api.post('/hr/payroll/generate', { month });
            push('success', 'تم إنشاء مسير الرواتب بنجاح');
            fetchPayroll();
        } catch (error) {
            push('error', error?.response?.data?.message || 'فشل إنشاء المسير');
        } finally {
            setGenerating(false);
        }
    };

    const handlePayClick = (slip) => {
        setSelectedSlip(slip);
        setSelectedTreasury('');
    };

    const confirmPayment = async () => {
        if (!selectedTreasury) return push('error', 'يرجى اختيار الخزينة');
        setPaying(true);
        try {
            await api.post(`/hr/payroll/${selectedSlip._id}/pay`, { treasuryId: selectedTreasury });
            push('success', 'تم صرف الراتب بنجاح');
            setSelectedSlip(null);
            fetchPayroll();
        } catch (error) {
            push('error', error?.response?.data?.message || 'فشل عملية الصرف');
        } finally {
            setPaying(false);
        }
    };

    const handlePayAllClick = () => {
        if (payrolls.filter(p => p.status !== 'PAID').length === 0) {
            return push('info', 'جميع الرواتب مدفوعة بالفعل');
        }
        setPayAllModalOpen(true);
        setSelectedTreasury('');
    };

    const confirmPayAll = async () => {
        if (!selectedTreasury) return push('error', 'اختر الخزينة');
        setPayingAll(true);
        try {
            const { data } = await api.post('/hr/payroll/pay-all', { month, treasuryId: selectedTreasury });
            push('success', `تم دفع ${data.paid} راتب بنجاح`);
            if (data.skipped > 0) push('info', `تم تخطي ${data.skipped} راتب (صفر أو سالب)`);
            if (data.errors.length > 0) push('error', `فشل دفع ${data.errors.length} راتب`);

            setPayAllModalOpen(false);
            fetchPayroll();
        } catch (error) {
            push('error', error?.response?.data?.message || 'فشل عملية الدفع الجماعي');
        } finally {
            setPayingAll(false);
        }
    };

    const totals = payrolls.reduce((acc, p) => ({
        gross: acc.gross + (p.totals?.grossSalary || 0),
        net: acc.net + (p.totals?.netSalary || 0),
        count: acc.count + 1,
        unpaidCount: acc.unpaidCount + (p.status !== 'PAID' ? 1 : 0),
        unpaidAmount: acc.unpaidAmount + (p.status !== 'PAID' ? p.totals?.netSalary : 0)
    }), { gross: 0, net: 0, count: 0, unpaidCount: 0, unpaidAmount: 0 });

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Users className="text-blue-600" />
                        نظام الرواتب والأجور
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">إدارة رواتب الموظفين والمسيرات الشهرية</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="relative">
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 font-bold"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Calendar size={16} className="text-slate-400" />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-bold rounded-lg text-sm px-5 py-2.5 focus:outline-none transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {generating ? 'جاري المعالجة...' : 'إنشاء مسير الشهر'}
                    </button>

                    {totals.unpaidCount > 0 && (
                        <button
                            onClick={handlePayAllClick}
                            className="text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-300 font-bold rounded-lg text-sm px-5 py-2.5 focus:outline-none transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                        >
                            <DollarSign size={18} />
                            <span>صرف الكل ({totals.unpaidCount})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-100 font-medium mb-1">إجمالي الرواتب (Net)</p>
                            <h3 className="text-3xl font-black">{formatCurrency(totals.net)}</h3>
                        </div>
                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Wallet size={24} className="text-white" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 font-bold mb-1">المتبقي للصرف</p>
                            <h3 className="text-2xl font-black text-amber-600">{formatCurrency(totals.unpaidAmount)}</h3>
                            <p className="text-xs text-slate-400 mt-1">{totals.unpaidCount} موظف لم يتم الصرف لهم</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-xl">
                            <Clock size={24} className="text-amber-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 font-bold mb-1">إجمالي المستحق (Gross)</p>
                            <h3 className="text-2xl font-black text-slate-800">{formatCurrency(totals.gross)}</h3>
                        </div>
                        <div className="p-3 bg-slate-100 rounded-xl">
                            <DollarSign size={24} className="text-slate-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 font-bold mb-1">عدد الموظفين</p>
                            <h3 className="text-2xl font-black text-slate-800">{totals.count}</h3>
                        </div>
                        <div className="p-3 bg-slate-100 rounded-xl">
                            <Users size={24} className="text-slate-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-slate-600">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-black">الموظف</th>
                                <th className="px-6 py-4 font-black">الراتب الأساسي</th>
                                <th className="px-6 py-4 font-black">البدلات</th>
                                <th className="px-6 py-4 font-black">الإجمالي</th>
                                <th className="px-6 py-4 font-black">الخصومات</th>
                                <th className="px-6 py-4 font-black">الصافي</th>
                                <th className="px-6 py-4 font-black text-center">الحالة</th>
                                <th className="px-6 py-4 font-black text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-10">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        <p className="mt-2 text-slate-400 font-medium">جاري تحميل البيانات...</p>
                                    </td>
                                </tr>
                            ) : payrolls.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <div className="bg-slate-50 p-4 rounded-full mb-3">
                                                <Users size={32} strokeWidth={1.5} />
                                            </div>
                                            <p className="font-bold text-lg text-slate-600">لا توجد بيانات لهذا الشهر</p>
                                            <p className="text-sm mt-1">اضغط على "إنشاء مسير الشهر" لبدء العمل</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                payrolls.map((slip) => {
                                    const allowances = (slip.basics?.housingAllowance || 0) + (slip.basics?.transportAllowance || 0);
                                    return (
                                        <tr key={slip._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-900">
                                                {slip.employee?.name || 'Unknown'}
                                                <div className="text-xs text-slate-500 font-normal">{slip.employee?.position}</div>
                                            </td>
                                            <td className="px-6 py-4">{formatCurrency(slip.basics?.baseSalary || 0)}</td>
                                            <td className="px-6 py-4 text-emerald-600 bg-emerald-50/30 rounded-lg">{formatCurrency(allowances)}</td>
                                            <td className="px-6 py-4 font-bold">{formatCurrency(slip.totals?.grossSalary || 0)}</td>
                                            <td className="px-6 py-4 text-red-600 bg-red-50/30 rounded-lg">{formatCurrency(slip.totals?.totalDeductions || 0)}</td>
                                            <td className="px-6 py-4 font-black text-blue-700 text-lg">{formatCurrency(slip.totals?.netSalary || 0)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${slip.status === 'PAID'
                                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                                    }`}>
                                                    {slip.status === 'PAID' ? 'مدفوع' : 'مسودة'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {slip.status !== 'PAID' && (
                                                    <button
                                                        onClick={() => handlePayClick(slip)}
                                                        className="text-white bg-emerald-500 hover:bg-emerald-600 hover:shadow-md hover:-translate-y-0.5 transition-all px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto"
                                                    >
                                                        <DollarSign size={14} />
                                                        صرف
                                                    </button>
                                                )}
                                                {slip.status === 'PAID' && (
                                                    <div className="text-xs text-slate-400 font-medium flex justify-center items-center gap-1">
                                                        <CheckCircle size={14} />
                                                        تم الصرف
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Individual Payment Modal */}
            {selectedSlip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-slate-50 border-b border-slate-100">
                            <h3 className="font-bold text-lg text-slate-800">صرف راتب موظف</h3>
                            <p className="text-sm text-slate-500">سيتم تسجيل العملية وإنشاء قيد محاسبي تلقائياً</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <div className="flex justify-between mb-2">
                                    <span className="text-slate-600 font-medium">الموظف:</span>
                                    <span className="font-bold text-slate-900">{selectedSlip.employee?.name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-medium">صافي الراتب:</span>
                                    <span className="font-black text-xl text-blue-700">{formatCurrency(selectedSlip.totals?.netSalary)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">اختر خزينة الصرف</label>
                                <TreasurySelector
                                    value={selectedTreasury}
                                    onChange={setSelectedTreasury}
                                    className="w-full"
                                    required
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
                            <button
                                onClick={() => setSelectedSlip(null)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={confirmPayment}
                                disabled={paying}
                                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-2"
                            >
                                {paying ? 'جاري المعالجة...' : 'تأكيد الصرف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Payment Modal */}
            {payAllModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-slate-50 border-b border-slate-100">
                            <h3 className="font-bold text-lg text-slate-800">صرف رواتب {month} (الكل)</h3>
                            <p className="text-sm text-slate-500">سيتم صرف الرواتب لجميع الموظفين غير المدفوع لهم</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <div className="flex justify-between mb-2">
                                    <span className="text-slate-600 font-medium">عدد الموظفين:</span>
                                    <span className="font-bold text-slate-900">{totals.unpaidCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-medium">إجمالي المبلغ المطلوب:</span>
                                    <span className="font-black text-xl text-amber-700">{formatCurrency(totals.unpaidAmount)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">اختر خزينة الصرف</label>
                                <TreasurySelector
                                    value={selectedTreasury}
                                    onChange={setSelectedTreasury}
                                    className="w-full"
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-2">تأكد من وجود رصيد كافٍ في الخزينة المختارة.</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
                            <button
                                onClick={() => setPayAllModalOpen(false)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={confirmPayAll}
                                disabled={payingAll}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md transition-all flex items-center gap-2"
                            >
                                {payingAll ? 'جاري الصرف...' : 'تأكيد صرف الكل'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
