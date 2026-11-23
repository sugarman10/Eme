import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/utils';
import { Wallet, Search, Plus, Calendar, CheckCircle, Clock, Trash2, X, AlertTriangle, Gift, HeartHandshake, RotateCcw } from 'lucide-react';
import { TreasurySelector } from '../components/TreasurySelector';

export default function Loans() {
    const { push } = useToast();
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('ALL');

    // Create Modal
    const [showCreate, setShowCreate] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [formData, setFormData] = useState({
        employeeId: '',
        amount: '',
        repaymentMonth: new Date().toISOString().slice(0, 7)
    });

    // Approve Modal
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [selectedTreasury, setSelectedTreasury] = useState('');
    const [processing, setProcessing] = useState(false);

    // Waive (Forgive) Modal
    const [showWaiveModal, setShowWaiveModal] = useState(false);
    const [loanToWaive, setLoanToWaive] = useState(null);
    const [waiveData, setWaiveData] = useState({ reason: '', waiveType: 'FORGIVE' });

    // Postpone Modal
    const [showPostponeModal, setShowPostponeModal] = useState(false);
    const [loanToPostpone, setLoanToPostpone] = useState(null);
    const [newPostponeMonth, setNewPostponeMonth] = useState('');

    const fetchLoans = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/hr/loans');
            setLoans(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const { data } = await api.get('/hr/employees');
            setEmployees(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchLoans();
        fetchEmployees();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setProcessing(true);
        try {
            await api.post('/hr/loans', formData);
            push('success', 'تم تقديم طلب السلفة بنجاح');
            setShowCreate(false);
            setFormData({ ...formData, amount: '', employeeId: '' });
            fetchLoans();
        } catch (error) {
            push('error', error?.response?.data?.message || 'فشل الطلب');
        } finally {
            setProcessing(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedTreasury) return push('error', 'اختر الخزينة');
        setProcessing(true);
        try {
            await api.post(`/hr/loans/${selectedLoan._id}/approve`, { treasuryId: selectedTreasury });
            push('success', 'تم اعتماد وصرف السلفة بنجاح');
            setSelectedLoan(null);
            fetchLoans();
        } catch (error) {
            push('error', error?.response?.data?.message || 'فشل الاعتماد');
        } finally {
            setProcessing(false);
        }
    };

    const handleConfirmWaive = async () => {
        if (!loanToWaive) return;
        setProcessing(true);
        try {
            const res = await api.post(`/hr/loans/${loanToWaive._id}/waive`, waiveData);
            push('success', res.data?.message || 'تم التغاضي عن السلفة وإعفاء الموظف بنجاح');
            setShowWaiveModal(false);
            setLoanToWaive(null);
            setWaiveData({ reason: '', waiveType: 'FORGIVE' });
            fetchLoans();
        } catch (error) {
            push('error', error?.response?.data?.message || 'فشل التغاضي عن السلفة');
        } finally {
            setProcessing(false);
        }
    };

    const handleConfirmPostpone = async () => {
        if (!loanToPostpone || !newPostponeMonth) return;
        setProcessing(true);
        try {
            const res = await api.post(`/hr/loans/${loanToPostpone._id}/postpone`, { repaymentMonth: newPostponeMonth });
            push('success', res.data?.message || 'تم تأجيل موعد استقطاع السلفة بنجاح');
            setShowPostponeModal(false);
            setLoanToPostpone(null);
            setNewPostponeMonth('');
            fetchLoans();
        } catch (error) {
            push('error', error?.response?.data?.message || 'فشل تأجيل السلفة');
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('هل أنت متأكد من الحذف؟')) return;
        try {
            await api.delete(`/hr/loans/${id}`);
            push('success', 'تم الحذف');
            fetchLoans();
        } catch (error) {
            push('error', 'فشل الحذف');
        }
    };

    const filteredLoans = loans.filter(l => {
        if (filterStatus === 'ALL') return true;
        return l.status === filterStatus;
    });

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Wallet className="text-pink-600" />
                        السلف والمقدمات
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">إدارة سلف الموظفين، السداد، والإعفاء والتغاضي بقرار الإدارة</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                    <Plus size={18} />
                    طلب سلفة جديدة
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                    { id: 'ALL', label: 'كافة السلف' },
                    { id: 'PENDING', label: 'بانتظار الصرف' },
                    { id: 'APPROVED', label: 'معتمدة سارية (بانتظار الخصم)' },
                    { id: 'WAIVED', label: 'تم الإعفاء والتغاضي عنها' },
                    { id: 'DEDUCTED', label: 'تم خصمها من الراتب' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilterStatus(tab.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            filterStatus === tab.id
                                ? 'bg-slate-800 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center py-10 text-slate-400">جاري التحميل...</div>
                ) : filteredLoans.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <Wallet size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-500 font-bold">لا توجد سلف مطابقة للفلتر المحدد</p>
                    </div>
                ) : (
                    filteredLoans.map(loan => (
                        <div key={loan._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                                    loan.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                                    loan.status === 'WAIVED' ? 'bg-purple-100 text-purple-600' :
                                    loan.status === 'DEDUCTED' ? 'bg-slate-100 text-slate-500' :
                                        'bg-amber-100 text-amber-600'
                                }`}>
                                    {loan.status === 'APPROVED' ? <CheckCircle size={24} /> :
                                        loan.status === 'WAIVED' ? <Gift size={24} /> :
                                        loan.status === 'DEDUCTED' ? <CheckCircle size={24} /> :
                                            <Clock size={24} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">{loan.employee?.name}</h3>
                                    <p className="text-xs text-slate-500">شهر الاستقطاع: <span className="font-mono font-bold text-slate-700">{loan.repaymentMonth}</span> - {loan.employee?.position}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                        تاريخ الطلب: {new Date(loan.requestDate || loan.createdAt).toLocaleDateString('ar-LY')}
                                    </p>
                                    {loan.status === 'WAIVED' && loan.waiveReason && (
                                        <p className="text-[11px] text-purple-700 font-medium mt-1 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 w-fit">
                                            💡 سبب التغاضي: {loan.waiveReason}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="font-black text-xl text-slate-800 font-mono">
                                {formatCurrency(loan.amount)}
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                    loan.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    loan.status === 'WAIVED' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    loan.status === 'DEDUCTED' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                                        'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                    {loan.status === 'APPROVED' ? 'معتمد (بانتظار الخصم)' :
                                        loan.status === 'WAIVED' ? 'تم الإعفاء والتغاضي' :
                                        loan.status === 'DEDUCTED' ? 'تم الخصم من الراتب' :
                                            'بانتظار الموافقة'}
                                </span>

                                {loan.status === 'PENDING' && (
                                    <>
                                        <button
                                            onClick={() => setSelectedLoan(loan)}
                                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                        >
                                            اعتماد وصرف
                                        </button>
                                        <button
                                            onClick={() => handleDelete(loan._id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                            title="حذف طلب السلفة"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}

                                {loan.status === 'APPROVED' && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setLoanToWaive(loan);
                                                setWaiveData({ reason: '', waiveType: 'FORGIVE' });
                                                setShowWaiveModal(true);
                                            }}
                                            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                            title="التغاضي عن السلفة وإعفاء الموظف من سدادها"
                                        >
                                            <Gift size={14} />
                                            إعفاء وتغاضي
                                        </button>
                                        <button
                                            onClick={() => {
                                                setLoanToPostpone(loan);
                                                setNewPostponeMonth(loan.repaymentMonth || '');
                                                setShowPostponeModal(true);
                                            }}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200"
                                            title="تأجيل استقطاع السلفة لشهر قادم"
                                        >
                                            <RotateCcw size={13} />
                                            تأجيل الخصم
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg">تسجيل سلفة جديدة</h3>
                            <button onClick={() => setShowCreate(false)}><X size={20} className="text-slate-400" /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">الموظف</label>
                                <select
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                    required
                                >
                                    <option value="">اختر الموظف...</option>
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">المبلغ</label>
                                    <input
                                        type="number"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">شهر الخصم</label>
                                    <input
                                        type="month"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-pink-500"
                                        value={formData.repaymentMonth}
                                        onChange={(e) => setFormData({ ...formData, repaymentMonth: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex gap-2 items-start text-xs text-amber-800 font-medium">
                                <AlertTriangle size={14} className="mt-0.5" />
                                <p>يجب ألا تتجاوز السلفة 50% من الراتب الأساسي، وسيتم خصمها تلقائياً عند إنشاء مسير الرواتب للشهر المحدد.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-black rounded-xl shadow-md transition-all mt-2"
                            >
                                {processing ? 'جاري الحفظ...' : 'حفظ الطلب'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Approve Modal */}
            {selectedLoan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-6 bg-slate-50 border-b border-slate-100">
                            <h3 className="font-bold text-lg text-slate-800">صرف السلفة</h3>
                            <p className="text-sm text-slate-500">سيتم خصم المبلغ من الخزينة وإنشاء قيد محاسبي</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
                                <div className="flex justify-between mb-2">
                                    <span className="text-slate-500">مبلغ السلفة</span>
                                    <span className="font-black text-slate-800">{formatCurrency(selectedLoan.amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">الموظف</span>
                                    <span className="font-bold text-slate-800">{selectedLoan.employee?.name}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">خزينة الصرف</label>
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
                                onClick={() => setSelectedLoan(null)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={processing}
                                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer"
                            >
                                {processing ? 'جاري المعالجة...' : 'تأكيد الصرف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Waive / Forgive Modal */}
            {showWaiveModal && loanToWaive && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-purple-50/60">
                            <h3 className="font-black text-lg text-purple-950 flex items-center gap-2">
                                <Gift size={22} className="text-purple-600" />
                                التغاضي عن السلفة وإعفاء الموظف
                            </h3>
                            <button onClick={() => { setShowWaiveModal(false); setLoanToWaive(null); }} className="cursor-pointer">
                                <X size={20} className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">الموظف:</span>
                                    <span className="font-bold text-slate-800 text-base">{loanToWaive.employee?.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">مبلغ السلفة:</span>
                                    <span className="font-mono font-black text-purple-700 text-lg">{formatCurrency(loanToWaive.amount)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">شهر الاستقطاع الأصلي:</span>
                                    <span className="font-mono font-bold text-slate-700">{loanToWaive.repaymentMonth}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع التغاضي / الإعفاء</label>
                                <select
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                    value={waiveData.waiveType}
                                    onChange={(e) => setWaiveData({ ...waiveData, waiveType: e.target.value })}
                                >
                                    <option value="FORGIVE">إسقاط سلفة وإعفاء مباشر (توجيه الإدارة)</option>
                                    <option value="BONUS">تحويل السلفة إلى مكافأة / منحة للموظف</option>
                                    <option value="OTHER">ظروف إنسانية واستثنائية</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">سبب التغاضي / ملاحظات (اختياري)</label>
                                <textarea
                                    rows={2}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="مثال: مكافأة تقديرية للجهود المتميزة / إعفاء بقرار الإدارة"
                                    value={waiveData.reason}
                                    onChange={(e) => setWaiveData({ ...waiveData, reason: e.target.value })}
                                />
                            </div>

                            <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-100 text-xs text-purple-900 leading-relaxed space-y-1.5">
                                <p className="font-bold flex items-center gap-1.5">
                                    <CheckCircle size={15} className="text-purple-600 shrink-0" />
                                    الأثر الإداري والمحاسبي للتغاضي:
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-[11px] text-purple-800 pr-1">
                                    <li>لن يتم خصم هذا المبلغ من راتب الموظف في مسير الرواتب.</li>
                                    <li>سيتم إنشاء قيد محاسبي تلقائي لإقفال مديونية السلفة وتحويلها لمصروف مكافآت.</li>
                                </ul>
                            </div>

                            <div className="flex gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowWaiveModal(false); setLoanToWaive(null); }}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm cursor-pointer"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmWaive}
                                    disabled={processing}
                                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-md transition-all text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <Gift size={16} />
                                    {processing ? 'جاري التنفيذ...' : 'تأكيد الإعفاء والتغاضي'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Postpone Modal */}
            {showPostponeModal && loanToPostpone && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-blue-50/60">
                            <h3 className="font-black text-lg text-blue-950 flex items-center gap-2">
                                <Calendar size={22} className="text-blue-600" />
                                تأجيل شهر استقطاع السلفة
                            </h3>
                            <button onClick={() => { setShowPostponeModal(false); setLoanToPostpone(null); }} className="cursor-pointer">
                                <X size={20} className="text-slate-400 hover:text-slate-600" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">الموظف:</span>
                                    <span className="font-bold text-slate-800 text-base">{loanToPostpone.employee?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">مبلغ السلفة:</span>
                                    <span className="font-mono font-bold text-slate-800">{formatCurrency(loanToPostpone.amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-medium">شهر الخصم الحالي:</span>
                                    <span className="font-mono font-bold text-rose-600">{loanToPostpone.repaymentMonth}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">الشهر الجديد للاستقطاع</label>
                                <input
                                    type="month"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    value={newPostponeMonth}
                                    onChange={(e) => setNewPostponeMonth(e.target.value)}
                                    required
                                />
                                <p className="text-[11px] text-slate-500 mt-1">
                                    سيتم ترحيل الاستقطاع إلى مسير رواتب الشهر الجديد المختار بدلاً من هذا الشهر.
                                </p>
                            </div>

                            <div className="flex gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowPostponeModal(false); setLoanToPostpone(null); }}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm cursor-pointer"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPostpone}
                                    disabled={processing || !newPostponeMonth}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition-all text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={16} />
                                    {processing ? 'جاري الحفظ...' : 'تأكيد التأجيل'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
