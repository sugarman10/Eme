import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { TreasurySelector } from '../components/TreasurySelector';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import VoucherPrintModal from '../components/modals/VoucherPrintModal';
import {
    Search,
    Plus,
    Receipt,
    TrendingDown,
    Calendar,
    X,
    Filter,
    RefreshCw,
    Printer
} from 'lucide-react';

export default function Expenses() {
    const { push } = useToast();

    // State
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

    // Filters
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        categoryId: '',
        treasuryId: '',
        amount: '',
        description: '',
        beneficiary: '',
        date: new Date().toISOString().split('T')[0],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [printVoucher, setPrintVoucher] = useState(null);
    const [printAfterSave, setPrintAfterSave] = useState(false);

    useEffect(() => {
        loadCategories();
        loadStats();
    }, []);

    useEffect(() => {
        loadExpenses();
    }, [pagination.page, filterCategory, filterStartDate, filterEndDate]);

    const loadCategories = async () => {
        try {
            const { data } = await api.get('/expenses/categories?active=true');
            setCategories(data || []);
        } catch (err) {
            console.error('Failed to load categories:', err);
        }
    };

    const loadStats = async () => {
        try {
            const { data } = await api.get('/expenses/stats');
            setStats(data);
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    };

    const loadExpenses = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
            });

            if (filterCategory) params.append('category', filterCategory);
            if (filterStartDate) params.append('startDate', filterStartDate);
            if (filterEndDate) params.append('endDate', filterEndDate);
            if (search) params.append('search', search);

            const { data } = await api.get(`/expenses?${params}`);
            setExpenses(data.expenses || []);
            setPagination(prev => ({ ...prev, ...data.pagination }));
        } catch (err) {
            console.error('Failed to load expenses:', err);
            push('error', 'فشل في تحميل المصروفات');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPagination(prev => ({ ...prev, page: 1 }));
        loadExpenses();
    };

    const handleCreateExpense = async (e) => {
        e.preventDefault();

        if (!form.categoryId) return push('error', 'اختر فئة المصروف');
        if (!form.treasuryId) return push('error', 'اختر الخزينة');
        if (!form.amount || Number(form.amount) <= 0) return push('error', 'أدخل مبلغ صحيح');

        try {
            setIsSubmitting(true);
            const { data } = await api.post('/expenses', {
                categoryId: form.categoryId,
                treasuryId: form.treasuryId,
                amount: Number(form.amount),
                description: form.description,
                beneficiary: form.beneficiary,
                date: form.date,
            });

            push('success', 'تم تسجيل المصروف بنجاح');
            if (printAfterSave) {
                const catName = categories.find(c => c._id === form.categoryId)?.name || 'مصروفات';
                setPrintVoucher({
                    ...(data || {}),
                    voucherType: 'payment',
                    number: data?.number || `#${String(data?._id || '').slice(-6).toUpperCase()}`,
                    amount: Number(form.amount),
                    beneficiary: form.beneficiary || catName,
                    partyName: form.beneficiary || catName,
                    description: form.description ? `${catName} — ${form.description}` : catName,
                    treasury: data?.treasury,
                    date: form.date,
                });
                setPrintAfterSave(false);
            }
            setShowModal(false);
            setForm({
                categoryId: '',
                treasuryId: '',
                amount: '',
                description: '',
                beneficiary: '',
                date: new Date().toISOString().split('T')[0],
            });
            loadExpenses();
            loadStats();
        } catch (err) {
            setPrintAfterSave(false);
            const errorMsg = err?.response?.data?.message || 'فشل في تسجيل المصروف';
            push('error', errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetFilters = () => {
        setSearch('');
        setFilterCategory('');
        setFilterStartDate('');
        setFilterEndDate('');
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">المصروفات</h1>
                    <p className="text-muted-foreground text-sm">تسجيل ومتابعة مصروفات الشركة</p>
                </div>
                <Button
                    onClick={() => setShowModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                >
                    <Plus size={18} className="ml-2" />
                    تسجيل مصروف
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 bg-red-50 border-red-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-red-600 mb-1">مصروفات اليوم</p>
                            <h3 className="text-2xl font-bold text-red-700">
                                {stats.today?.total?.toLocaleString() || 0} د.ل
                            </h3>
                            <span className="text-xs text-red-500">{stats.today?.count || 0} عملية</span>
                        </div>
                        <div className="p-3 bg-red-100 rounded-full text-red-600">
                            <TrendingDown size={24} />
                        </div>
                    </Card>

                    <Card className="p-4 bg-orange-50 border-orange-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-orange-600 mb-1">مصروفات الشهر</p>
                            <h3 className="text-2xl font-bold text-orange-700">
                                {stats.thisMonth?.total?.toLocaleString() || 0} د.ل
                            </h3>
                            <span className="text-xs text-orange-500">{stats.thisMonth?.count || 0} عملية</span>
                        </div>
                        <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                            <Calendar size={24} />
                        </div>
                    </Card>

                    <Card className="p-4 bg-purple-50 border-purple-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-purple-600 mb-1">مصروفات السنة</p>
                            <h3 className="text-2xl font-bold text-purple-700">
                                {stats.thisYear?.total?.toLocaleString() || 0} د.ل
                            </h3>
                            <span className="text-xs text-purple-500">{stats.thisYear?.count || 0} عملية</span>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-full text-purple-600">
                            <Receipt size={24} />
                        </div>
                    </Card>
                </div>
            )}

            {/* Expenses Table */}
            <Card>
                {/* Filters */}
                <div className="p-4 border-b bg-slate-50 space-y-3">
                    <form onSubmit={handleSearch} className="flex gap-3 items-center flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <Input
                                className="pr-10!"
                                placeholder="بحث برقم المصروف أو الوصف..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <select
                            className="px-3 py-2 border rounded-lg text-sm min-w-[150px]"
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="">كل الفئات</option>
                            {categories.map(cat => (
                                <option key={cat._id} value={cat._id}>{cat.name}</option>
                            ))}
                        </select>

                        <Input
                            type="date"
                            className="w-40"
                            value={filterStartDate}
                            onChange={e => setFilterStartDate(e.target.value)}
                            placeholder="من تاريخ"
                        />

                        <Input
                            type="date"
                            className="w-40"
                            value={filterEndDate}
                            onChange={e => setFilterEndDate(e.target.value)}
                            placeholder="إلى تاريخ"
                        />

                        <Button type="submit" variant="outline" size="sm">
                            <Filter size={16} className="ml-1" /> فلترة
                        </Button>

                        <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                            <RefreshCw size={16} className="ml-1" /> إعادة تعيين
                        </Button>
                    </form>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 border-b text-sm text-gray-600">
                            <tr>
                                <th className="p-4">رقم المصروف</th>
                                <th className="p-4">التاريخ</th>
                                <th className="p-4">الفئة</th>
                                <th className="p-4">الوصف</th>
                                <th className="p-4">المستفيد</th>
                                <th className="p-4">الخزينة</th>
                                <th className="p-4">المبلغ</th>
                                <th className="p-4 text-center">طباعة السند</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-500">جاري التحميل...</td></tr>
                            ) : expenses.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-500">لا توجد مصروفات</td></tr>
                            ) : (
                                expenses.map(exp => (
                                    <tr key={exp._id} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-mono text-sm">{exp.number}</td>
                                        <td className="p-4 text-sm">{new Date(exp.date).toLocaleDateString('ar-LY')}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                                                {exp.category?.name || '-'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 max-w-[200px] truncate">
                                            {exp.description || '-'}
                                        </td>
                                        <td className="p-4 text-sm">{exp.beneficiary || '-'}</td>
                                        <td className="p-4 text-sm text-gray-600">{exp.treasury?.name || '-'}</td>
                                        <td className="p-4 font-bold text-red-600">
                                            {exp.amount?.toLocaleString()} د.ل
                                        </td>
                                        <td className="p-4 text-center">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-2.5 text-xs gap-1.5 border-slate-300 hover:bg-slate-100"
                                                onClick={() => setPrintVoucher({
                                                    ...exp,
                                                    voucherType: 'payment',
                                                    partyName: exp.beneficiary || exp.category?.name || 'مصروفات عامة',
                                                    description: exp.description
                                                        ? `${exp.category?.name ? exp.category.name + ' — ' : ''}${exp.description}`
                                                        : (exp.category?.name || 'مصروفات عامة'),
                                                })}
                                            >
                                                <Printer size={13} />
                                                طباعة السند
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="p-4 border-t flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                            صفحة {pagination.page} من {pagination.pages} (إجمالي: {pagination.total})
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page <= 1}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            >
                                السابق
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.pages}
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            >
                                التالي
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Create Expense Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-lg bg-white shadow-2xl">
                        <div className="p-4 border-b bg-red-50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-red-800">تسجيل مصروف جديد</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
                            {/* Category */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">فئة المصروف <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full px-3 py-2 border rounded-lg"
                                    value={form.categoryId}
                                    onChange={e => setForm({ ...form, categoryId: e.target.value })}
                                    required
                                >
                                    <option value="">اختر فئة المصروف...</option>
                                    {categories.map(cat => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Treasury */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">الخزينة (مصدر الدفع) <span className="text-red-500">*</span></label>
                                <TreasurySelector
                                    value={form.treasuryId}
                                    onChange={val => setForm({ ...form, treasuryId: val })}
                                    required
                                />
                            </div>

                            {/* Amount */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">المبلغ <span className="text-red-500">*</span></label>
                                <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    className="text-center font-bold text-lg"
                                    placeholder="0.00"
                                    value={form.amount}
                                    onChange={e => setForm({ ...form, amount: e.target.value })}
                                    required
                                />
                            </div>

                            {/* Date */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">التاريخ</label>
                                <Input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                />
                            </div>

                            {/* Beneficiary */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">المستفيد</label>
                                <Input
                                    placeholder="اسم المستفيد (شركة، شخص...)"
                                    value={form.beneficiary}
                                    onChange={e => setForm({ ...form, beneficiary: e.target.value })}
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold">الوصف</label>
                                <Input
                                    placeholder="وصف تفصيلي للمصروف..."
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setShowModal(false)}
                                >
                                    إلغاء
                                </Button>
                                <Button
                                    type="submit"
                                    onClick={() => setPrintAfterSave(false)}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                    disabled={isSubmitting || !form.categoryId || !form.treasuryId || !form.amount}
                                >
                                    {isSubmitting && !printAfterSave ? 'جاري التسجيل...' : 'تسجيل المصروف'}
                                </Button>
                                <Button
                                    type="submit"
                                    onClick={() => setPrintAfterSave(true)}
                                    className="flex-[1.3] bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
                                    disabled={isSubmitting || !form.categoryId || !form.treasuryId || !form.amount}
                                >
                                    <Printer size={15} />
                                    حفظ وطباعة السند
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Unified Voucher Print Modal */}
            <VoucherPrintModal
                isOpen={!!printVoucher}
                voucher={printVoucher}
                voucherType="payment"
                onClose={() => setPrintVoucher(null)}
            />
        </div>
    );
}
