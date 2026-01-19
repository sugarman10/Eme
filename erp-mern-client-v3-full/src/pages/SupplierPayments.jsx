import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { TreasurySelector } from '../components/TreasurySelector'; // Auto-import for payments
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Search, Wallet, Landmark, AlertCircle, ArrowUpRight, X, FileText } from 'lucide-react';

export default function SupplierPayments() {
    const { push } = useToast();

    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Payment Modal State
    const [payModal, setPayModal] = useState(null); // Supplier object if open
    const [payForm, setPayForm] = useState({ treasuryId: '', amount: '', note: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Unpaid Orders State
    const [unpaidOrders, setUnpaidOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        loadSuppliers();
    }, []);

    // Check fetch orders when modal opens
    useEffect(() => {
        if (payModal) {
            fetchUnpaidOrders(payModal._id);
        } else {
            setUnpaidOrders([]);
        }
    }, [payModal]);

    const loadSuppliers = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/procurement/suppliers');
            setSuppliers(data || []);
        } catch (err) {
            console.error(err);
            push('error', 'فشل تحميل بيانات الموردين');
        } finally {
            setLoading(false);
        }
    };

    const fetchUnpaidOrders = async (supplierId) => {
        try {
            setLoadingOrders(true);
            const { data } = await api.get(`/procurement/suppliers/${supplierId}/unpaid-orders`);
            setUnpaidOrders(data || []);
        } catch (err) {
            console.error('Failed to fetch unpaid orders:', err);
        } finally {
            setLoadingOrders(false);
        }
    };

    const handlePayClick = (supplier) => {
        setPayModal(supplier);
        setPayForm({ treasuryId: '', amount: '', note: '' });
    };

    const handlePayOrder = (order) => {
        setPayForm(prev => ({
            ...prev,
            amount: order.remainingBalance,
            note: `سداد فاتورة رقم ${order.number}`
        }));
    };

    const handlePaySubmit = async (e) => {
        e.preventDefault();
        if (!payForm.treasuryId) return push('error', 'اختر الخزينة للدفع');
        if (!payForm.amount || Number(payForm.amount) <= 0) return push('error', 'أدخل مبلغ صحيح');
        if (Number(payForm.amount) > payModal.balance) return push('error', 'المبلغ يتجاوز رصيد المورد');

        try {
            setIsSubmitting(true);
            await api.post('/procurement/orders/payments', {
                supplierId: payModal._id,
                treasuryId: payForm.treasuryId,
                amount: Number(payForm.amount),
                note: payForm.note
            });

            push('success', 'تم تسجيل الدفع بنجاح');
            setPayModal(null);
            loadSuppliers(); // Refresh balances
        } catch (err) {
            const errorMsg = err?.response?.data?.errors
                ? err.response.data.errors.map(e => e.msg).join(', ')
                : (err?.response?.data?.message || 'فشل عملية الدفع');
            push('error', errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculations
    const totalDebt = useMemo(() => suppliers.reduce((sum, s) => sum + (s.balance || 0), 0), [suppliers]);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s =>
            s.name.toLowerCase().includes(search.toLowerCase()) &&
            s.balance > 0 // Only show suppliers we owe money to? Or all? User said "List Suppliers with balance > 0" in plan, but let's show all and highlight debt. 
            // Actually user request: "List Suppliers with balance > 0" in plan features. Let's start with showing all but sorting debtors first or filtering.
            // Let's filter by search primarily, but visual focus on debts.
        ).sort((a, b) => b.balance - a.balance);
    }, [suppliers, search]);

    return (
        <div className="p-6 space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">سداد الموردين</h1>
                    <p className="text-muted-foreground text-sm">إدارة مديونيات الموردين والدفعات الخارجة</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-red-50 border-red-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-red-600 mb-1">إجمالي الديون المستحقة</p>
                        <h3 className="text-2xl font-bold text-red-700">{totalDebt.toLocaleString()} د.ل</h3>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full text-red-600">
                        <AlertCircle size={24} />
                    </div>
                </Card>

                <Card className="p-4 bg-blue-50 border-blue-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-blue-600 mb-1">عدد الموردين الدائنين</p>
                        <h3 className="text-2xl font-bold text-blue-700">{suppliers.filter(s => s.balance > 0).length}</h3>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                        <Wallet size={24} />
                    </div>
                </Card>
            </div>

            {/* Suppliers Table */}
            <Card>
                <div className="p-4 border-b bg-slate-50 flex gap-4 items-center">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                            className="pr-10!"
                            placeholder="بحث عن مورد..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 border-b text-sm text-gray-600">
                            <tr>
                                <th className="p-4">المورد</th>
                                <th className="p-4">الهاتف</th>
                                <th className="p-4">رصيد المورد (عليه/له)</th>
                                <th className="p-4">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-gray-500">جاري التحميل...</td></tr>
                            ) : filteredSuppliers.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-gray-500">لا توجد بيانات</td></tr>
                            ) : (
                                filteredSuppliers.map(s => (
                                    <tr key={s._id} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold">{s.name}</td>
                                        <td className="p-4 text-sm text-gray-600">{s.phone || '-'}</td>
                                        <td className="p-4">
                                            <span className={`font-bold px-2 py-1 rounded ${s.balance > 0 ? 'bg-red-100 text-red-700' :
                                                s.balance < 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {s.balance > 0 ? `${s.balance.toLocaleString()} د.ل (له)` :
                                                    s.balance < 0 ? `${Math.abs(s.balance).toLocaleString()} د.ل (عليه)` : '0 د.ل'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {s.balance > 0 && (
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                                    onClick={() => handlePayClick(s)}
                                                >
                                                    <ArrowUpRight size={16} className="ml-1" /> سداد دفعة
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Payment Modal */}
            {payModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                        {/* Left Side: Payment Form */}
                        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-lg">بيانات السداد</h3>
                                <button onClick={() => setPayModal(null)} className="md:hidden text-gray-400"><X /></button>
                            </div>

                            <div className="bg-red-50 p-4 rounded-lg flex justify-between items-center border border-red-100">
                                <span className="text-sm text-red-600 font-bold">الرصيد المستحق</span>
                                <span className="text-xl font-bold text-red-700">{payModal.balance.toLocaleString()} د.ل</span>
                            </div>

                            <form onSubmit={handlePaySubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold">المبلغ المدفوع <span className="text-red-500">*</span></label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max={payModal.balance}
                                        step="0.01"
                                        className="text-center font-bold text-lg h-12"
                                        placeholder="0.00"
                                        value={payForm.amount}
                                        onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold">الخزينة (مصدر الأموال) <span className="text-red-500">*</span></label>
                                    <TreasurySelector
                                        value={payForm.treasuryId}
                                        onChange={(val) => setPayForm({ ...payForm, treasuryId: val })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold">ملاحظات</label>
                                    <Input
                                        value={payForm.note}
                                        onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                                        placeholder="رقم إيصال، مرجع..."
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setPayModal(null)}>إلغاء</Button>
                                    <Button
                                        type="submit"
                                        className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white"
                                        disabled={isSubmitting || !payForm.amount || !payForm.treasuryId}
                                    >
                                        {isSubmitting ? 'جاري السداد...' : 'تأكيد السداد'}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* Right Side: Unpaid Invoices */}
                        <div className="w-full md:w-80 bg-slate-50 border-r border-slate-200 flex flex-col">
                            <div className="p-4 border-b border-slate-200 bg-slate-100 flex justify-between items-center">
                                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                                    <FileText size={16} /> فواتير غير مسددة
                                </h4>
                                <button onClick={() => setPayModal(null)} className="hidden md:block text-gray-400 hover:text-red-500"><X size={20} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {loadingOrders ? (
                                    <p className="text-center text-xs text-gray-500 py-4">جاري التحميل...</p>
                                ) : unpaidOrders.length === 0 ? (
                                    <p className="text-center text-xs text-gray-500 py-4">لا توجد فواتير مستحقة</p>
                                ) : (
                                    unpaidOrders.map(order => (
                                        <div key={order._id} className="bg-white p-3 rounded border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono text-xs font-bold text-slate-700">#{order.number}</span>
                                                <span className="text-[10px] text-gray-500">{new Date(order.date).toLocaleDateString('ar-EG')}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs mb-2">
                                                <span className="text-gray-600">القيمة: {order.totalAmount.toLocaleString()}</span>
                                                <span className="font-bold text-red-600">باقي: {order.remainingBalance.toLocaleString()}</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full h-7 text-xs bg-slate-50 hover:bg-blue-50 text-blue-600 border-dashed"
                                                onClick={() => handlePayOrder(order)}
                                            >
                                                سداد هذه الفاتورة
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                    </Card>
                </div>
            )}
        </div>
    );
}
