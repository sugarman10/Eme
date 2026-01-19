import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/utils';
import {
    Users, Phone, Calendar, Briefcase, DollarSign,
    ArrowLeft, Wallet, FileText, CheckCircle, Clock, XCircle
} from 'lucide-react';

export default function EmployeeDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { push } = useToast();
    const [employee, setEmployee] = useState(null);
    const [loans, setLoans] = useState([]);
    const [payrolls, setPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Employee Basic
                const empRes = await api.get(`/hr/employees`);
                // Note: Better to have /hr/employees/:id, but for now filtering locally or using a new endpoint if available
                // Actually, I should check if I have a single employee endpoint. 
                // Looking at routes, I only have list, create, update, delete.
                // I'll filter for now or add getById later. Filtering is safe for small lists but not scalable.
                // Let's rely on finding in list for now to avoid creating another backend endpoint if not needed immediately.

                // Wait, update: Standard REST usually has GET /:id.
                // HR routes file viewed earlier shows: 
                // router.put('/employees/:id', ...)
                // router.delete('/employees/:id', ...)
                // But maybe no GET /employees/:id?
                // I will add a GET /employees/:id to be clean or filter. 
                // Let's filter from the list call for safety as I didn't explicitly add GET /:id in this session.

                const allEmps = empRes.data;
                const found = allEmps.find(e => e._id === id);
                if (!found) throw new Error('الموظف غير موجود');
                setEmployee(found);

                // Fetch Loans
                const loansRes = await api.get(`/hr/loans?employeeId=${id}&status=ALL`);
                setLoans(loansRes.data);

                // Fetch Payrolls
                const payRes = await api.get(`/hr/employees/${id}/payroll`);
                setPayrolls(payRes.data);

            } catch (error) {
                console.error(error);
                push('error', 'فشل تحميل بيانات الموظف');
                navigate('/employees');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate, push]);

    if (loading) return <div className="p-10 text-center text-slate-400">جاري التحميل...</div>;
    if (!employee) return null;

    const totalLoans = loans.reduce((sum, l) => sum + l.amount, 0);
    const pendingLoans = loans.filter(l => l.status === 'PENDING').reduce((sum, l) => sum + l.amount, 0);
    const totalPaidSalary = payrolls.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.totals.netSalary, 0);

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-rose-500"></div>
                <button
                    onClick={() => navigate('/employees')}
                    className="absolute top-6 left-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mt-4">
                    <div className="w-24 h-24 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-3xl font-black border-4 border-white shadow-lg">
                        {employee.name.charAt(0)}
                    </div>
                    <div className="text-center md:text-right flex-1">
                        <h1 className="text-3xl font-black text-slate-800 mb-2">{employee.name}</h1>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-slate-500 font-medium">
                            <span className="flex items-center gap-1"><Briefcase size={16} /> {employee.position}</span>
                            <span className="flex items-center gap-1"><Phone size={16} dir="ltr" /> {employee.phone}</span>
                            <span className="flex items-center gap-1"><Calendar size={16} /> {new Date(employee.joinDate).toLocaleDateString('ar-LY')}</span>
                        </div>
                    </div>

                    {/* Salary Card */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 min-w-[200px]">
                        <p className="text-slate-400 text-xs font-bold mb-1">الراتب الأساسي</p>
                        <p className="text-xl font-black text-slate-800">{formatCurrency(employee.salaryDetails?.baseSalary || 0)}</p>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">سكن</span>
                                <span className="font-bold text-slate-700">{formatCurrency(employee.salaryDetails?.housingAllowance || 0)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-500">نقل</span>
                                <span className="font-bold text-slate-700">{formatCurrency(employee.salaryDetails?.transportAllowance || 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-6 mt-8 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 font-bold text-sm transition-colors relative ${activeTab === 'overview' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        نظرة عامة
                        {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-pink-600 rounded-t-full"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('loans')}
                        className={`pb-3 font-bold text-sm transition-colors relative ${activeTab === 'loans' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        سجل السلف ({loans.length})
                        {activeTab === 'loans' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-pink-600 rounded-t-full"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('payroll')}
                        className={`pb-3 font-bold text-sm transition-colors relative ${activeTab === 'payroll' ? 'text-pink-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        قسائم الراتب ({payrolls.length})
                        {activeTab === 'payroll' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-pink-600 rounded-t-full"></div>}
                    </button>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4"><DollarSign /></div>
                        <p className="text-slate-500 text-sm font-bold">إجمالي الرواتب المصروفة</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrency(totalPaidSalary)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4"><Wallet /></div>
                        <p className="text-slate-500 text-sm font-bold">إجمالي السلف المطلوبة</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{formatCurrency(totalLoans)}</p>
                    </div>
                </div>
            )}

            {activeTab === 'loans' && (
                <div className="space-y-4">
                    {loans.length === 0 ? <p className="text-center py-10 text-slate-400">لا يوجد سجل سلف</p> : (
                        loans.map(loan => (
                            <div key={loan._id} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${loan.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                                            loan.status === 'DEDUCTED' ? 'bg-blue-100 text-blue-600' :
                                                'bg-amber-100 text-amber-600'
                                        }`}>
                                        <Wallet size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">سلفة مالية</p>
                                        <p className="text-xs text-slate-500">شهر الخصم: {loan.repaymentMonth}</p>
                                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                            {new Date(loan.requestDate || loan.createdAt).toLocaleDateString('ar-LY')}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-slate-800">{formatCurrency(loan.amount)}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${loan.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                                            loan.status === 'DEDUCTED' ? 'bg-blue-50 text-blue-600' :
                                                'bg-amber-50 text-amber-600'
                                        }`}>
                                        {loan.status === 'APPROVED' ? 'مدفوعة' : loan.status === 'DEDUCTED' ? 'تم الخصم' : 'قيد المراجعة'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'payroll' && (
                <div className="space-y-4">
                    {payrolls.length === 0 ? <p className="text-center py-10 text-slate-400">لا يوجد قسائم راتب</p> : (
                        payrolls.map(slip => (
                            <div key={slip._id} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-pink-50 text-pink-600">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">راتب شهر {slip.month}</p>
                                        <p className="text-xs text-slate-500">
                                            أساسي: {formatCurrency(slip.totals.grossSalary)} | خصم: {formatCurrency(slip.totals.totalDeductions)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-emerald-600">{formatCurrency(slip.totals.netSalary)}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${slip.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {slip.status === 'PAID' ? 'تم التحويل' : 'مسودة'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
