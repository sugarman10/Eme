import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { RotateCcw, Plus, CheckCircle, Clock, XCircle, Check, FileDown, Search, Users, Zap } from 'lucide-react';

// Status Badge Component
const StatusBadge = ({ status }) => {
    const config = {
        draft: { label: 'مسودة', className: 'bg-slate-100 text-slate-700' },
        pending_approval: { label: 'بانتظار الموافقة', className: 'bg-yellow-100 text-yellow-700' },
        returned: { label: 'تم الإرجاع', className: 'bg-green-100 text-green-700' },
        rejected: { label: 'مرفوض', className: 'bg-red-100 text-red-700' },
        reversed: { label: 'reversed', className: 'bg-purple-100 text-purple-700' }
    };
    const { label, className } = config[status] || { label: status, className: 'bg-slate-100' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
};

export default function SalesReturns() {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [approving, setApproving] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchReturns();
    }, [statusFilter]);

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
            const res = await api.get(`/sales/returns${params}`);
            const data = res?.data;
            const list = data?.returns || data?.docs || (Array.isArray(data) ? data : []);
            setReturns(list);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (returnId) => {
        if (!confirm('هل تريد الموافقة على هذا المرتجع؟ سيتم زيادة المخزون وخصم رصيد العميل.')) return;

        setApproving(returnId);
        try {
            await api.post(`/sales/returns/${returnId}/post`);
            alert('Return posted');
            fetchReturns();
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        } finally {
            setApproving(null);
        }
    };

    const handleReject = async (returnId) => {
        const reason = prompt('Void reason:');
        if (reason === null) return;

        try {
            await api.post(`/sales/returns/${returnId}/void`, { note: reason });
            alert('Return voided');
            fetchReturns();
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleReverse = async (returnId) => {
        if (!confirm('Reverse this return?')) return;

        setApproving(returnId);
        try {
            await api.post(`/sales/returns/${returnId}/reverse`);
            alert('Return reversed');
            fetchReturns();
        } catch (error) {
            alert('Error: ' + (error.response?.data?.message || error.message));
        } finally {
            setApproving(null);
        }
    };

    const handleDownloadPdf = async (returnId) => {
        try {
            const response = await api.get(`/sales/returns/${returnId}/pdf`, {
                responseType: 'blob',
                timeout: 120000 // 2 minutes for large PDFs
            });

            // Check if response is actually a PDF
            const contentType = response.headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                // Error response came as JSON
                const text = await response.data.text();
                const error = JSON.parse(text);
                throw new Error(error.message || 'Failed to generate PDF');
            }

            // Create download link
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `CreditNote_${returnId.slice(-6)}.pdf`);
            document.body.appendChild(link);
            link.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

        } catch (error) {
            console.error('PDF Download Error:', error);
            alert('Error: ' + (error.response?.data?.message || error.message));
        }
    };

    const formatCurrency = (val) => Number(val || 0).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD' });

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="text-blue-600" size={26} />
                        <span>مردودات مبيعات العملاء</span>
                    </h1>
                    <p className="text-muted-foreground text-sm">إدارة المرتجعات للعملاء المسجلين، إشعارات دائنة، وتسوية حسابات الآجل</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Link to="/pos-return">
                        <Button variant="outline" className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-bold">
                            <Zap size={15} /> مردود نقدي سريع (كاشير)
                        </Button>
                    </Link>
                    <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-primary">
                        <Plus size={18} /> تسجيل مردود عميل
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">الحالة:</label>
                        <select
                            className="input w-40"
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                        >
                            <option value="all">الكل</option>
                            <option value="draft">مسودة</option>
                            <option value="pending_approval">بانتظار الموافقة</option>
                            <option value="returned">تم الإرجاع</option>
                            <option value="rejected">مرفوض</option>
                            <option value="reversed">reversed</option>
                        </select>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        عدد النتائج: <strong>{returns.length}</strong>
                    </div>
                </div>
            </Card>

            <Card>
                <CardContent className="p-0">
                    <div className="table-container">
                        <table className="table">
                            <thead className="bg-muted">
                                <tr>
                                    <th>رقم المرجع</th>
                                    <th>العميل</th>
                                    <th>الفاتورة الأصلية</th>
                                    <th>المستودع</th>
                                    <th>قيمة الاسترجاع</th>
                                    <th>الحالة</th>
                                    <th>التاريخ</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="text-center p-8">جاري التحميل...</td></tr>
                                ) : returns.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">لا توجد مردودات سابقة</td></tr>
                                ) : (
                                    returns.map((ret) => (
                                        <tr key={ret._id} className="hover:bg-muted/50">
                                            <td className="font-mono text-primary font-bold">#{ret._id.slice(-6)}</td>
                                            <td>{ret.customer?.name}</td>
                                            <td className="font-mono text-xs">
                                                {ret.originalInvoice?.number || `#${ret.originalInvoice?._id?.slice(-6) || 'N/A'}`}
                                            </td>
                                            <td>{ret.warehouse?.name}</td>
                                            <td className="font-bold text-destructive">
                                                {formatCurrency(ret.totalAmount)}
                                            </td>
                                            <td><StatusBadge status={ret.status} /></td>
                                            <td>{new Date(ret.date || ret.createdAt).toLocaleDateString('ar-LY')}</td>
                                            <td>
                                                <div className="flex gap-1">
                                                    {(ret.status === 'draft' || ret.status === 'pending_approval') && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={() => handleApprove(ret._id)}
                                                                disabled={approving === ret._id}
                                                                className="gap-1 text-xs"
                                                            >
                                                                {approving === ret._id ? (
                                                                    <Clock size={14} className="animate-spin" />
                                                                ) : (
                                                                    <Check size={14} />
                                                                )}
                                                                موافقة
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleReject(ret._id)}
                                                                className="gap-1 text-xs"
                                                            >
                                                                <XCircle size={14} />
                                                                رفض
                                                            </Button>
                                                        </>
                                                    )}
                                                    {ret.status === 'returned' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDownloadPdf(ret._id)}
                                                                className="gap-1 text-xs"
                                                                title="Download PDF"
                                                            >
                                                                <FileDown size={14} />
                                                                PDF
                                                            </Button>
                                                            {!ret.isRefunded ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="secondary"
                                                                    onClick={() => handleReverse(ret._id)}
                                                                    disabled={approving === ret._id}
                                                                    className="gap-1 text-xs"
                                                                >
                                                                    {approving === ret._id ? (
                                                                        <Clock size={14} className="animate-spin" />
                                                                    ) : (
                                                                        <RotateCcw size={14} />
                                                                    )}
                                                                    Reverse
                                                                </Button>
                                                            ) : (
                                                                <span className="text-xs text-green-600 font-medium">Refunded</span>
                                                            )}
                                                        </>
                                                    )}
                                                    {ret.status === 'reversed' && (
                                                        <span className="text-xs text-purple-600 font-medium">Reversed</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {isModalOpen && <CreateReturnModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); fetchReturns(); }} />}
        </div>
    );
}

function CreateReturnModal({ isOpen, onClose }) {
    const [autoApprove, setAutoApprove] = useState(true);
    const [step, setStep] = useState(1);
    const [customers, setCustomers] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);

    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    const [returnItems, setReturnItems] = useState({});
    const [reasons, setReasons] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Cash Refund State
    const [refundMethod, setRefundMethod] = useState('credit'); // 'credit' | 'cash'
    const [treasuries, setTreasuries] = useState([]);
    const [selectedTreasury, setSelectedTreasury] = useState('');

    useEffect(() => {
        api.get('/customers').then(res => setCustomers(res.data));
        // Fetch Treasuries for Cash Refund
        api.get('/treasuries').then(res => {
            setTreasuries(res.data);
            if (res.data.length > 0) setSelectedTreasury(res.data[0]._id);
        });
    }, []);

    useEffect(() => {
        if (selectedCustomer) {
            setLoadingInvoices(true);
            const fetchCustInvoices = async () => {
                try {
                    let res;
                    try {
                        res = await api.get('/sales/invoices', { params: { customer: selectedCustomer, status: 'confirmed,posted,paid', limit: 500 } });
                    } catch {
                        res = await api.get('/sales/invoice', { params: { customer: selectedCustomer, status: 'confirmed,posted,paid', limit: 500 } });
                    }
                    const invoiceList = res?.data?.docs || res?.data?.invoices || (Array.isArray(res?.data) ? res.data : []);
                    setInvoices(invoiceList);
                } catch (err) {
                    console.error('Failed to load customer invoices:', err);
                } finally {
                    setLoadingInvoices(false);
                }
            };
            fetchCustInvoices();
        } else {
            setInvoices([]);
        }
    }, [selectedCustomer]);

    const handleQtyChange = (itemId, qty, maxQty) => {
        const val = Math.max(0, Math.min(Number(qty), maxQty));
        setReturnItems(prev => ({ ...prev, [itemId]: val }));
    };

    const handleReasonChange = (itemId, reason) => {
        setReasons(prev => ({ ...prev, [itemId]: reason }));
    };

    const calculateTotalRefund = () => {
        if (!selectedInvoice) return 0;
        return selectedInvoice.items.reduce((sum, item) => {
            const qty = returnItems[item.item._id] || 0;
            return sum + (qty * item.price);
        }, 0);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const itemsPayload = Object.entries(returnItems)
                .filter(([_, qty]) => qty > 0)
                .map(([item, qty]) => ({
                    item,
                    qty,
                    reason: reasons[item] || 'other'
                }));

            if (itemsPayload.length === 0) {
                alert("يجب تحديد كمية صنف واحد على الأقل");
                setSubmitting(false);
                return;
            }

            const payload = {
                invoiceId: selectedInvoice._id,
                items: itemsPayload,
                note: 'Sales Return via Web UI',
                autoApprove,
                refundMethod,
                treasury: refundMethod === 'cash' ? selectedTreasury : null
            };

            await api.post('/sales/returns', payload);

            if (autoApprove) {
                alert('✅ تم إنشاء المرتجع واعتماده بنجاح');
            } else {
                alert('✅ تم إنشاء المسودة بنجاح');
            }
            onClose();
        } catch (error) {
            console.error(error);
            alert("فشل الحفظ: " + (error.response?.data?.message || 'Unknown Error'));
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const reasonOptions = [
        { value: 'damaged', label: 'تالف' },
        { value: 'expired', label: 'منتهي الصلاحية' },
        { value: 'wrong_item', label: 'صنف خاطئ' },
        { value: 'customer_preference', label: 'رغبة العميل' },
        { value: 'other', label: 'أخرى' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-transparent">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <RotateCcw className="text-blue-600" size={24} />
                        تسجيل مردودات مبيعات
                    </h2>
                    {/* Wizard Steps */}
                    <div className="flex items-center gap-2 text-sm mt-4">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
                            اختيار العميل والفاتورة
                        </div>
                        <div className="flex-1 h-0.5 bg-slate-200" />
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
                            تحديد الأصناف
                        </div>
                        <div className="flex-1 h-0.5 bg-slate-200" />
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
                            المراجعة
                        </div>
                    </div>
                </div>

                <div className="p-6 overflow-auto flex-1 h-full min-h-[400px]">
                    {/* Step 1: Select Method */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* Search Method Tabs */}
                            <div className="flex p-1 bg-slate-100 rounded-lg">
                                <button
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${!selectedCustomer ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => { setSelectedCustomer(''); setSelectedInvoice(null); setInvoices([]); }}
                                >
                                    بحث برقم الفاتورة (POS)
                                </button>
                                <button
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${selectedCustomer ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    // We don't direct click to set customer, but we conceptually switch modes here. 
                                    // Simplified: Just clear invoice if switching methods logic is needed.
                                    // Actually, let's keep it simple: Mode State
                                    onClick={() => { /* Logic handled by UI selection below */ }}
                                >
                                    اختيار بالعميل
                                </button>
                            </div>

                            {/* Mode 1: Search by Invoice Number (Default if no customer selected) */}
                            {!selectedCustomer && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                className="input pr-10"
                                                placeholder="أدخل رقم الفاتورة (مثال: 0008)..."
                                                autoFocus
                                                onKeyDown={async (e) => {
                                                    if (e.key === 'Enter') {
                                                        const term = e.target.value?.trim();
                                                        if (term && term.length >= 2) {
                                                            setLoadingInvoices(true);
                                                            try {
                                                                let res;
                                                                try {
                                                                    res = await api.get('/sales/invoices', { params: { number: term, status: 'confirmed,posted,paid' } });
                                                                } catch {
                                                                    res = await api.get('/sales/invoice', { params: { number: term, status: 'confirmed,posted,paid' } });
                                                                }
                                                                const invoiceList = res?.data?.docs || res?.data?.invoices || (Array.isArray(res?.data) ? res.data : []);
                                                                setInvoices(invoiceList);
                                                            } catch (err) {
                                                                console.error(err);
                                                            } finally {
                                                                setLoadingInvoices(false);
                                                            }
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                        <Button
                                            onClick={async (e) => {
                                                const input = e.currentTarget.parentElement?.querySelector('input');
                                                const term = input?.value?.trim();
                                                if (term) {
                                                    setLoadingInvoices(true);
                                                    try {
                                                        let res;
                                                        try {
                                                            res = await api.get('/sales/invoices', { params: { number: term, status: 'confirmed,posted,paid' } });
                                                        } catch {
                                                            res = await api.get('/sales/invoice', { params: { number: term, status: 'confirmed,posted,paid' } });
                                                        }
                                                        const invoiceList = res?.data?.docs || res?.data?.invoices || (Array.isArray(res?.data) ? res.data : []);
                                                        setInvoices(invoiceList);
                                                    } catch (err) {
                                                        console.error(err);
                                                    } finally {
                                                        setLoadingInvoices(false);
                                                    }
                                                }
                                            }}
                                        >
                                            بحث
                                        </Button>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        💡 اضغط Enter للبحث. يدعم البحث الجزئي.
                                    </div>
                                </div>
                            )}

                            {/* Divider OR */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-slate-500">أو</span>
                                </div>
                            </div>

                            {/* Mode 2: Select Customer */}
                            <div>
                                <label className="label">اختيار العميل (للفواتير الآجلة/المسجلة)</label>
                                <select
                                    className="input"
                                    value={selectedCustomer}
                                    onChange={e => { setSelectedCustomer(e.target.value); setSelectedInvoice(null); }}
                                >
                                    <option value="">-- ابحث عن عميل --</option>
                                    {customers.map(c => <option key={c._id} value={c._id}>{c.name} ({c.phone || c.code})</option>)}
                                </select>
                            </div>

                            {/* Results Area */}
                            <div>
                                <label className="label">
                                    نتائج البحث:
                                    {loadingInvoices && <span className="text-xs text-muted-foreground mr-2">جاري التحميل...</span>}
                                </label>

                                {invoices.length > 0 ? (
                                    <div className="grid gap-2 max-h-60 overflow-auto border rounded-lg p-2 bg-slate-50">
                                        {invoices.map(inv => (
                                            <div
                                                key={inv._id}
                                                onClick={() => setSelectedInvoice(inv)}
                                                className={`p-3 border rounded-lg cursor-pointer transition-all flex justify-between items-center bg-white ${selectedInvoice?._id === inv._id
                                                    ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50'
                                                    : 'hover:border-blue-300'
                                                    }`}
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm">#{inv.number}</span>
                                                        <span className="text-[10px] bg-slate-100 px-1.5 rounded">{inv.customer?.name || 'Walk-in'}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {new Date(inv.date).toLocaleDateString('ar-LY')} • {inv.items?.length || 0} أصناف
                                                    </p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-bold text-blue-700 text-sm">
                                                        {(inv.totals?.grand || 0).toLocaleString()} <span className="text-[10px]">LYD</span>
                                                    </p>
                                                    {selectedInvoice?._id === inv._id && <CheckCircle size={16} className="text-blue-600 mt-1 ml-auto" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    !loadingInvoices && (selectedCustomer || invoices) && (
                                        <div className="text-center p-8 border-2 border-dashed rounded-xl ">
                                            <p className="text-slate-400 text-sm">قم بالبحث أو اختيار عميل لعرض الفواتير</p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Select Items & Quantities */}
                    {step === 2 && selectedInvoice && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <div>
                                    <p className="font-bold text-blue-900">فاتورة #{selectedInvoice.number || selectedInvoice._id.slice(-6)}</p>
                                    <p className="text-xs text-blue-700 mt-1">
                                        العميل: {selectedInvoice.customer?.name || 'زوبن عام'} • المستودع: {selectedInvoice.warehouse?.name || 'غير محدد'}
                                    </p>
                                </div>
                                <div className="text-left">
                                    <p className="text-sm text-muted-foreground">إجمالي الاسترجاع</p>
                                    <p className="font-bold text-destructive text-xl">{calculateTotalRefund().toLocaleString()} LYD</p>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="p-3 text-right">الصنف</th>
                                            <th className="p-3 text-center">الكمية المباعة</th>
                                            <th className="p-3 text-center w-28">كمية الارجاع</th>
                                            <th className="p-3 text-center w-40">السبب</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {selectedInvoice.items.map((line, index) => {
                                            const itemId = line.item._id || line.item; // Ensure we get ID
                                            const itemName = line.item.name || 'Unknown Item'; // Handle population
                                            // The backend populated invoices endpoint logic needs to populate items.item
                                            // Assuming it does. If not, we might see IDs.

                                            const maxQty = line.qty;
                                            // Use index for unique key since same item might appear multiple times
                                            const lineKey = `${index}-${itemId}`;

                                            return (
                                                <tr key={lineKey} className={returnItems[itemId] > 0 ? 'bg-blue-50' : ''}>
                                                    <td className="p-3">
                                                        <p className="font-medium">{itemName}</p>
                                                        <p className="text-xs text-muted-foreground">{line.price} LYD/وحدة</p>
                                                    </td>
                                                    <td className="p-3 text-center font-medium">{maxQty}</td>
                                                    <td className="p-3 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={maxQty}
                                                            className="input text-center h-9 w-20"
                                                            placeholder="0"
                                                            value={returnItems[itemId] || ''}
                                                            onChange={e => handleQtyChange(itemId, e.target.value, maxQty)}
                                                        />
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <select
                                                            className="input h-9 text-xs"
                                                            value={reasons[itemId] || 'other'}
                                                            onChange={e => handleReasonChange(itemId, e.target.value)}
                                                            disabled={!returnItems[itemId]}
                                                        >
                                                            {reasonOptions.map(r => (
                                                                <option key={r.value} value={r.value}>{r.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {step === 3 && selectedInvoice && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                <h3 className="font-bold text-green-800 mb-2">ملخص المرتجع</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">العميل:</span>
                                        <span className="font-medium mr-2">{customers.find(c => c._id === selectedCustomer)?.name}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">الفاتورة:</span>
                                        <span className="font-medium mr-2">#{selectedInvoice.number || selectedInvoice._id.slice(-6)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="p-3 text-right">الصنف</th>
                                            <th className="p-3 text-center">الكمية</th>
                                            <th className="p-3 text-center">السبب</th>
                                            <th className="p-3 text-left">القيمة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {selectedInvoice.items.filter(line => returnItems[line.item._id || line.item] > 0).map((line, index) => {
                                            const itemId = line.item._id || line.item;
                                            const itemName = line.item.name || 'Unknown Item';
                                            const qty = returnItems[itemId];
                                            const value = qty * line.price;
                                            const reason = reasonOptions.find(r => r.value === (reasons[itemId] || 'other'))?.label;
                                            const lineKey = `${index}-${itemId}`;

                                            return (
                                                <tr key={lineKey}>
                                                    <td className="p-3 font-medium">{itemName}</td>
                                                    <td className="p-3 text-center">{qty}</td>
                                                    <td className="p-3 text-center text-xs">{reason}</td>
                                                    <td className="p-3 text-left font-bold text-destructive">{value.toLocaleString()} LYD</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-50">
                                        <tr>
                                            <td colSpan={3} className="p-3 text-left font-bold">الإجمالي</td>
                                            <td className="p-3 text-left font-bold text-destructive text-lg">
                                                {calculateTotalRefund().toLocaleString()} LYD
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Refund Method Section */}
                            <div className="bg-slate-50 border p-4 rounded-lg space-y-3">
                                <h4 className="font-bold text-sm text-slate-800">طريقة الإرجاع</h4>
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="refundMethod"
                                            value="credit"
                                            checked={refundMethod === 'credit'}
                                            onChange={(e) => setRefundMethod(e.target.value)}
                                            className="accent-blue-600"
                                        />
                                        <span>رصيد للعميل (On Account)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="refundMethod"
                                            value="cash"
                                            checked={refundMethod === 'cash'}
                                            onChange={(e) => setRefundMethod(e.target.value)}
                                            className="accent-green-600"
                                        />
                                        <span>نقد (Cash Refund)</span>
                                    </label>
                                </div>

                                {refundMethod === 'cash' && (
                                    <div className="mt-2 p-3 bg-green-50 rounded border border-green-100 animate-in fade-in slide-in-from-top-2">
                                        <label className="block text-xs font-bold text-green-800 mb-1">الخزينة (صندوق الكاشير)</label>
                                        <select
                                            className="input w-full md:w-1/2 bg-white"
                                            value={selectedTreasury}
                                            onChange={e => setSelectedTreasury(e.target.value)}
                                        >
                                            <option value="">اختر الخزينة...</option>
                                            {treasuries.map(t => (
                                                <option key={t._id} value={t._id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-green-700 mt-1">سيتم إنشاء سنه صرف تلقائي وخصم المبلغ من الخزينة.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="autoApprove"
                                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                                    checked={autoApprove}
                                    onChange={e => setAutoApprove(e.target.checked)}
                                />
                                <label htmlFor="autoApprove" className="text-sm cursor-pointer select-none">
                                    <span className="font-bold block text-blue-900">اعتماد وإرجاع للمخزون فوراً</span>
                                    <span className="text-xs text-blue-700">عند التفعيل، سيتم إعادة الكميات للمخزون وتسجيل القيد المالي فور الحفظ دون الحاجة لموافقة إدارية.</span>
                                </label>
                            </div>

                            {!autoApprove && (
                                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm flex gap-2 items-center">
                                    <Clock size={16} className="text-yellow-600" />
                                    <span>سيتم إنشاء المرتجع كـ <strong>مسودة</strong> وسيتطلب موافقة لاحقة.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50 flex justify-between">
                    {step === 1 && (
                        <>
                            <Button variant="outline" onClick={onClose}>إلغاء</Button>
                            <Button onClick={() => setStep(2)} disabled={!selectedInvoice}>التالي</Button>
                        </>
                    )}
                    {step === 2 && (
                        <>
                            <Button variant="ghost" onClick={() => setStep(1)}>رجوع</Button>
                            <Button onClick={() => setStep(3)} disabled={calculateTotalRefund() === 0}>
                                مراجعة وتأكيد
                            </Button>
                        </>
                    )}
                    {step === 3 && (
                        <>
                            <Button variant="ghost" onClick={() => setStep(2)}>رجوع</Button>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={onClose}>إلغاء</Button>
                                <Button onClick={handleSubmit} disabled={submitting} className={autoApprove ? "bg-green-600 hover:bg-green-700" : ""}>
                                    {submitting ? 'جاري الحفظ...' : (autoApprove ? '✅ اعتماد وإرجاع' : 'حفظ كمسودة')}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
