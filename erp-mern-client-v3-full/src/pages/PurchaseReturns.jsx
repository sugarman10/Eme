import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { RotateCcw, Plus, Search, FileText, CheckCircle, Package, XCircle, Clock, Check } from 'lucide-react';

// Status Badge Component
const StatusBadge = ({ status }) => {
    const config = {
        draft: { label: 'مسودة', className: 'bg-slate-100 text-slate-700' },
        pending_approval: { label: 'بانتظار الموافقة', className: 'bg-yellow-100 text-yellow-700' },
        returned: { label: 'تم الإرجاع', className: 'bg-green-100 text-green-700' },
        rejected: { label: 'مرفوض', className: 'bg-red-100 text-red-700' }
    };
    const { label, className } = config[status] || { label: status, className: 'bg-slate-100' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
};

export default function PurchaseReturns() {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [approving, setApproving] = useState(null); // Track which return is being approved
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchReturns();
    }, [statusFilter]);

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const params = statusFilter !== 'all' ? `?status=${statusFilter}&limit=5000` : '?limit=5000';
            const { data } = await api.get(`/procurement/returns${params}`);
            setReturns(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (returnId) => {
        if (!confirm('هل تريد الموافقة على هذا المرتجع؟ سيتم خصم الأصناف من المخزون.')) return;

        setApproving(returnId);
        try {
            await api.post(`/procurement/returns/${returnId}/approve`);
            alert('✅ تمت الموافقة بنجاح');
            fetchReturns();
        } catch (error) {
            alert('❌ فشل: ' + (error.response?.data?.message || error.message));
        } finally {
            setApproving(null);
        }
    };

    const handleReject = async (returnId) => {
        const reason = prompt('سبب الرفض (اختياري):');
        if (reason === null) return; // canceled

        try {
            await api.patch(`/procurement/returns/${returnId}/status`, {
                status: 'rejected',
                rejectionReason: reason
            });
            alert('تم الرفض');
            fetchReturns();
        } catch (error) {
            alert('فشل: ' + (error.response?.data?.message || error.message));
        }
    };

    const formatCurrency = (val) => Number(val || 0).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD' });

    return (
        <div className="space-y-6 animate-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">مردودات المشتريات</h1>
                    <p className="text-muted-foreground">إدارة المرتجعات للموردين</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Plus size={18} /> مردود جديد
                </Button>
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
                                    <th>المورد</th>
                                    <th>الطلب الأصلي</th>
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
                                            <td>{ret.supplier?.name}</td>
                                            <td className="font-mono text-xs">
                                                {ret.originalPO?.number || `#${ret.originalPO?._id?.slice(-6) || 'N/A'}`}
                                            </td>
                                            <td>{ret.warehouse?.name}</td>
                                            <td className="font-bold text-destructive">
                                                {formatCurrency(ret.totalAmount || ret.totalRefundAmount)}
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
                                                    {ret.status === 'returned' && !ret.isRefunded && (
                                                        <span className="text-xs text-muted-foreground">لم يُسترد المبلغ</span>
                                                    )}
                                                    {ret.status === 'returned' && ret.isRefunded && (
                                                        <span className="text-xs text-green-600 font-medium">✅ تم الاسترداد</span>
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
    const [step, setStep] = useState(1);
    const [suppliers, setSuppliers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [selectedPO, setSelectedPO] = useState(null);

    const [returnItems, setReturnItems] = useState({});
    const [reasons, setReasons] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        api.get('/procurement/suppliers').then(res => setSuppliers(res.data));
    }, []);

    useEffect(() => {
        if (selectedSupplier) {
            setLoadingOrders(true);
            api.get('/procurement/orders?limit=5000').then(res => {
                const filtered = res.data.filter(o => o.supplier._id === selectedSupplier && o.status === 'received');
                setOrders(filtered);
            }).finally(() => setLoadingOrders(false));
        }
    }, [selectedSupplier]);

    const handleQtyChange = (itemId, qty, maxQty) => {
        const val = Math.max(0, Math.min(Number(qty), maxQty));
        setReturnItems(prev => ({ ...prev, [itemId]: val }));
    };

    const handleReasonChange = (itemId, reason) => {
        setReasons(prev => ({ ...prev, [itemId]: reason }));
    };

    const calculateTotalRefund = () => {
        if (!selectedPO) return 0;
        return selectedPO.items.reduce((sum, item) => {
            const qty = returnItems[item.item._id] || 0;
            return sum + (qty * item.cost);
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

            await api.post('/procurement/returns', {
                purchaseOrderId: selectedPO._id,
                items: itemsPayload,
                note: 'Return from Web UI'
            });

            alert('✅ تم إنشاء المسودة بنجاح');
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
        { value: 'quality_issue', label: 'مشكلة جودة' },
        { value: 'excess_stock', label: 'فائض مخزون' },
        { value: 'other', label: 'أخرى' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b bg-gradient-to-r from-primary/5 to-transparent">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <RotateCcw className="text-primary" size={24} />
                        تسجيل مردودات مشتريات
                    </h2>
                    {/* Wizard Steps */}
                    <div className="flex items-center gap-2 text-sm mt-4">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${step === 1 ? 'bg-primary text-white' : 'bg-slate-100'}`}>
                            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
                            اختيار المصدر
                        </div>
                        <div className="flex-1 h-0.5 bg-slate-200" />
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${step === 2 ? 'bg-primary text-white' : 'bg-slate-100'}`}>
                            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
                            تحديد الأصناف
                        </div>
                        <div className="flex-1 h-0.5 bg-slate-200" />
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${step === 3 ? 'bg-primary text-white' : 'bg-slate-100'}`}>
                            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
                            المراجعة
                        </div>
                    </div>
                </div>

                <div className="p-6 overflow-auto flex-1">
                    {/* Step 1: Select Supplier & PO */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="label">المورد *</label>
                                <select
                                    className="input"
                                    value={selectedSupplier}
                                    onChange={e => { setSelectedSupplier(e.target.value); setSelectedPO(null); }}
                                >
                                    <option value="">اختر المورد...</option>
                                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                                </select>
                            </div>

                            {selectedSupplier && (
                                <div>
                                    <label className="label">طلب الشراء (المستلم) *</label>
                                    {loadingOrders ? (
                                        <p className="text-sm text-muted-foreground p-4 text-center">جاري التحميل...</p>
                                    ) : orders.length === 0 ? (
                                        <p className="text-sm text-muted-foreground p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                            ⚠️ لا توجد طلبات مستلمة لهذا المورد.
                                        </p>
                                    ) : (
                                        <div className="grid gap-2 max-h-60 overflow-auto">
                                            {orders.map(o => (
                                                <div
                                                    key={o._id}
                                                    onClick={() => setSelectedPO(o)}
                                                    className={`p-4 border rounded-lg cursor-pointer transition-all flex justify-between items-center ${selectedPO?._id === o._id
                                                        ? 'border-primary bg-primary/5 ring-2 ring-primary'
                                                        : 'hover:bg-slate-50 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div>
                                                        <p className="font-bold">#{o.number || o._id.slice(-6)}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(o.createdAt).toLocaleDateString('ar-LY')} |
                                                            {o.items?.length || 0} أصناف
                                                        </p>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-bold text-primary">{Number(o.totalAmount).toLocaleString()} LYD</p>
                                                        {selectedPO?._id === o._id && <CheckCircle size={20} className="text-primary mt-1" />}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Select Items & Quantities */}
                    {step === 2 && selectedPO && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg">
                                <div>
                                    <p className="font-bold">الطلب #{selectedPO.number || selectedPO._id.slice(-6)}</p>
                                    <p className="text-sm text-muted-foreground">المستودع: {selectedPO.warehouse?.name || 'غير محدد'}</p>
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
                                            <th className="p-3 text-center">الكمية المستلمة</th>
                                            <th className="p-3 text-center w-28">كمية الارجاع</th>
                                            <th className="p-3 text-center w-40">السبب</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {selectedPO.items.map((line) => {
                                            const itemId = line.item._id;
                                            const maxQty = line.qty;

                                            return (
                                                <tr key={itemId} className={returnItems[itemId] > 0 ? 'bg-primary/5' : ''}>
                                                    <td className="p-3">
                                                        <p className="font-medium">{line.item.name}</p>
                                                        <p className="text-xs text-muted-foreground">{line.item.sku} | {line.cost} LYD/وحدة</p>
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
                    {step === 3 && selectedPO && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                <h3 className="font-bold text-green-800 mb-2">ملخص المرتجع</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">المورد:</span>
                                        <span className="font-medium mr-2">{suppliers.find(s => s._id === selectedSupplier)?.name}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">طلب الشراء:</span>
                                        <span className="font-medium mr-2">#{selectedPO.number || selectedPO._id.slice(-6)}</span>
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
                                        {selectedPO.items.filter(line => returnItems[line.item._id] > 0).map((line) => {
                                            const itemId = line.item._id;
                                            const qty = returnItems[itemId];
                                            const value = qty * line.cost;
                                            const reason = reasonOptions.find(r => r.value === (reasons[itemId] || 'other'))?.label;

                                            return (
                                                <tr key={itemId}>
                                                    <td className="p-3 font-medium">{line.item.name}</td>
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

                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm">
                                <strong>ملاحظة:</strong> سيتم إنشاء المرتجع كمسودة. يجب الموافقة عليه لتنفيذ خصم المخزون وتعديل رصيد المورد.
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-slate-50 flex justify-between">
                    {step === 1 && (
                        <>
                            <Button variant="outline" onClick={onClose}>إلغاء</Button>
                            <Button onClick={() => setStep(2)} disabled={!selectedPO}>التالي</Button>
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
                                <Button onClick={handleSubmit} disabled={submitting}>
                                    {submitting ? 'جاري الحفظ...' : '✅ إنشاء المسودة'}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
