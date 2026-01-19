import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/utils';
import { Wallet, Search, Plus, Calendar, CheckCircle, Clock, Trash2, X, AlertTriangle } from 'lucide-react';
import { TreasurySelector } from '../components/TreasurySelector';

export default function Loans() {
    const { push } = useToast();
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(false);

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

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Wallet className="text-pink-600" />
                        السلف والمقدمات
                    </h1>
                    <p className="text-slate-500 mt-1 font-medium">إدارة سلف الموظفين والخصم الشهري</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                    <Plus size={18} />
                    طلب سلفة جديدة
                </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center py-10 text-slate-400">جاري التحميل...</div>
                ) : loans.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <Wallet size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-500 font-bold">لا توجد سلف حالياً</p>
                    </div>
                ) : (
                    loans.map(loan => (
                        <div key={loan._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${loan.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                                    loan.status === 'DEDUCTED' ? 'bg-slate-100 text-slate-500' :
                                        'bg-amber-100 text-amber-600'
                                    }`}>
                                    {loan.status === 'APPROVED' ? <CheckCircle size={24} /> :
                                        loan.status === 'DEDUCTED' ? <CheckCircle size={24} /> :
                                            <Clock size={24} />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{loan.employee?.name}</h3>
                                    <p className="text-xs text-slate-500">{loan.repaymentMonth} - {loan.employee?.position}</p>
                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                        {new Date(loan.requestDate || loan.createdAt).toLocaleDateString('ar-LY')} - {new Date(loan.requestDate || loan.createdAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>

                            <div className="font-black text-xl text-slate-800">
                                {formatCurrency(loan.amount)}
                            </div>

                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${loan.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    loan.status === 'DEDUCTED' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                                        'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                    {loan.status === 'APPROVED' ? 'معتمد (بانتظار الخصم)' :
                                        loan.status === 'DEDUCTED' ? 'تم الخصم' :
                                            'بانتظار الموافقة'}
                                </span>

                                {loan.status === 'PENDING' && (
                                    <>
                                        <button
                                            onClick={() => setSelectedLoan(loan)}
                                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors"
                                        >
                                            اعتماد وصرف
                                        </button>
                                        <button
                                            onClick={() => handleDelete(loan._id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
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
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={processing}
                                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg shadow-md transition-all"
                            >
                                {processing ? 'جاري المعالجة...' : 'تأكيد الصرف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
