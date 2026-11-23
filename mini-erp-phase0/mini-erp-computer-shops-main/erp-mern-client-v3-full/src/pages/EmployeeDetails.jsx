import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Phone, Calendar, Briefcase, DollarSign,
    ArrowLeft, Wallet, FileText, CheckCircle, Clock, XCircle,
    Building2, Mail, MapPin, Key
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

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div>
        </div>
    );
    if (!employee) return null;

    const totalLoans = loans.reduce((sum, l) => sum + l.amount, 0);
    const totalPaidSalary = payrolls.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.totals.netSalary, 0);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 font-sans">
            {/* Creates a blurred background blob for effect */}
            <div className="fixed top-0 left-0 w-full h-96 bg-gradient-to-br from-indigo-50/50 to-pink-50/50 -z-10 blur-3xl pointer-events-none" />

            {/* Header Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white/50 relative overflow-hidden group">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-700" />

                {/* Back Button */}
                <button
                    onClick={() => navigate('/employees')}
                    className="absolute top-6 left-6 p-2.5 rounded-xl bg-white/50 hover:bg-white text-slate-400 hover:text-slate-700 hover:shadow-md transition-all border border-transparent hover:border-slate-100 backdrop-blur-sm z-10"
                >
                    <ArrowLeft size={20} strokeWidth={2.5} />
                </button>

                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 z-10 relative">
                    {/* Avatar */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative"
                    >
                        <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-4xl font-black shadow-2xl shadow-indigo-200 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                            {employee.name.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center ${employee.active ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                            {employee.active ? <CheckCircle size={14} className="text-white" /> : <XCircle size={14} className="text-white" />}
                        </div>
                    </motion.div>

                    {/* Info */}
                    <div className="text-center md:text-right flex-1 min-w-0">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight">{employee.name}</h1>
                            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-100">
                                {employee.code || `#EMP-${employee._id.slice(-4)}`}
                            </span>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-y-2 gap-x-6 text-sm text-slate-500 font-medium mb-6">
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                <Briefcase size={16} className="text-indigo-500" /> {employee.position}
                            </span>
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                <Phone size={16} className="text-emerald-500" dir="ltr" /> {employee.phone}
                            </span>
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                <Building2 size={16} className="text-amber-500" /> {employee.department || 'القسم العام'}
                            </span>
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                                <Calendar size={16} className="text-pink-500" /> {new Date(employee.joinDate).toLocaleDateString('ar-LY')}
                            </span>
                        </div>

                        {/* Salary Badges */}
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            <div className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100 flex items-center gap-3">
                                <div className="p-1.5 bg-emerald-500 rounded-lg text-white shadow-sm">
                                    <DollarSign size={14} strokeWidth={3} />
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">الأساسي</p>
                                    <p className="font-bold text-emerald-900 font-mono">{formatCurrency(employee.salaryDetails?.baseSalary || 0)}</p>
                                </div>
                            </div>

                            {(employee.salaryDetails?.housingAllowance > 0 || employee.salaryDetails?.transportAllowance > 0) && (
                                <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 flex items-center gap-3 hover:border-indigo-200 transition-colors">
                                    <div className="text-left">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">البدلات</p>
                                        <p className="font-bold text-slate-700 font-mono">
                                            {formatCurrency((employee.salaryDetails?.housingAllowance || 0) + (employee.salaryDetails?.transportAllowance || 0))}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {employee.user && (
                                <div className="px-4 py-2 bg-purple-50 rounded-xl border border-purple-200 flex items-center gap-3">
                                    <div className="p-1.5 bg-purple-600 rounded-lg text-white shadow-sm">
                                        <Key size={14} strokeWidth={3} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase font-bold text-purple-600 tracking-wider">حساب المنظومة</p>
                                        <p className="font-bold text-purple-900 font-mono text-xs">@{employee.user.username} ({employee.user.role})</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex justify-center md:justify-start gap-1 mt-10 p-1 bg-slate-100/80 rounded-xl md:w-fit backdrop-blur-sm">
                    {[
                        { id: 'overview', label: 'نظرة عامة', icon: Briefcase },
                        { id: 'loans', label: `السلف (${loans.length})`, icon: Wallet },
                        { id: 'payroll', label: `الرواتب (${payrolls.length})`, icon: FileText },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                relative px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2
                                ${activeTab === tab.id
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
                            `}
                        >
                            <tab.icon size={16} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Summary Cards */}
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <FileText size={24} />
                                </div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">الرواتب المصروفة</p>
                                <p className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(totalPaidSalary)}</p>
                            </div>

                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Wallet size={24} />
                                </div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">إجمالي السلف</p>
                                <p className="text-3xl font-black text-slate-800 tracking-tight">{formatCurrency(totalLoans)}</p>
                            </div>

                            {/* Contact Card */}
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-lg text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Users size={18} /> بيانات التواصل</h3>
                                <div className="space-y-3 relative z-10">
                                    <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                                        <Phone size={16} className="text-emerald-400" />
                                        <span className="font-mono text-sm">{employee.phone}</span>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                                        <Mail size={16} className="text-blue-400" />
                                        <span className="font-mono text-sm truncate">{employee.email || 'لا يوجد بريد'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                                        <MapPin size={16} className="text-rose-400" />
                                        <span className="text-sm truncate">{employee.address || 'العنوان غير مسجل'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'loans' && (
                        <div className="space-y-4">
                            {loans.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
                                    <Wallet size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-medium">لا يوجد سجل سلف لهذا الموظف</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {loans.map(loan => (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            key={loan._id}
                                            className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${loan.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                                                        loan.status === 'DEDUCTED' ? 'bg-blue-50 text-blue-600' :
                                                            'bg-amber-50 text-amber-600'
                                                    }`}>
                                                    <Wallet size={24} strokeWidth={2} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-slate-800 text-lg">سلفة مالية</h4>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${loan.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                                                loan.status === 'DEDUCTED' ? 'bg-blue-100 text-blue-700' :
                                                                    'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {loan.status === 'APPROVED' ? 'موافق عليها' : loan.status === 'DEDUCTED' ? 'تم الخصم' : 'قيد الانتظار'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(loan.requestDate).toLocaleDateString()}</span>
                                                        <span className="flex items-center gap-1"><Clock size={12} /> شهر الخصم: {loan.repaymentMonth}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-2xl font-black text-slate-800 font-mono tracking-tight">{formatCurrency(loan.amount)}</p>
                                                <p className="text-xs text-slate-400 font-bold uppercase mt-1">القيمة</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'payroll' && (
                        <div className="space-y-4">
                            {payrolls.length === 0 ? (
                                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed">
                                    <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-medium">لا يوجد قسائم راتب مصدرة</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {payrolls.map(slip => (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            key={slip._id}
                                            className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-pink-100 hover:shadow-lg transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center group-hover:bg-pink-100 transition-colors">
                                                    <FileText size={24} strokeWidth={2} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-slate-800 text-lg">راتب شهر {slip.month}</h4>
                                                        {slip.status === 'PAID' && <CheckCircle size={16} className="text-emerald-500" />}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        <span className="bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                            الأساسي: <span className="font-bold font-mono">{formatCurrency(slip.totals.grossSalary)}</span>
                                                        </span>
                                                        <span className="bg-red-50 px-2 py-1 rounded border border-red-100 text-red-600">
                                                            الخصومات: <span className="font-bold font-mono">{formatCurrency(slip.totals.totalDeductions)}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-2xl font-black text-emerald-600 font-mono tracking-tight">{formatCurrency(slip.totals.netSalary)}</p>
                                                <p className="text-xs text-slate-400 font-bold uppercase mt-1">الصافي</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
