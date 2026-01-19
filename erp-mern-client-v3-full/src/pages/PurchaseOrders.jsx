import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useWarehouse } from '../context/WarehouseContext';
import { Plus, Eye, CheckCircle, Truck, ShoppingCart, Package, RotateCcw, XCircle, X } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { NativeSelect } from '../components/ui/Select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogBody,
    DialogFooter,
} from '../components/ui/Dialog';
import { SpreadsheetPurchase } from '../components/procurement/SpreadsheetPurchase';

export default function PurchaseOrders() {
    const { push } = useToast();
    const { warehouses } = useWarehouse(); // لجلب قائمة المستودعات

    const [orders, setOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [items, setItems] = useState([]);

    // Modal States
    const [showCreate, setShowCreate] = useState(false);
    const [showReceive, setShowReceive] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [viewingOrder, setViewingOrder] = useState(null);

    // Form States
    const [newOrder, setNewOrder] = useState({ supplier: '', items: [] });
    const [receivingOrder, setReceivingOrder] = useState(null);
    const [targetWarehouse, setTargetWarehouse] = useState('');

    // Load Data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [poRes, supRes, itemRes] = await Promise.all([
                api.get('/procurement/orders?limit=5000'),
                api.get('/procurement/suppliers'),
                api.get('/inventory/items')
            ]);
            setOrders(poRes.data);
            setSuppliers(supRes.data);
            setItems(itemRes.data.items || itemRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    // --- Create Logic (SpreadsheetPurchase Handlers) ---
    const handlePurchaseAddItem = (itemData) => {
        setNewOrder(prev => ({
            ...prev,
            items: [...prev.items, itemData]
        }));
    };

    const handlePurchaseUpdateItem = (index, field, value) => {
        setNewOrder(prev => {
            const updated = [...prev.items];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, items: updated };
        });
    };

    const handlePurchaseRemoveItem = (index) => {
        setNewOrder(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const submitOrder = async () => {
        if (!newOrder.supplier) {
            push('error', 'يجب اختيار المورد');
            return;
        }
        if (newOrder.items.length === 0) {
            push('error', 'يجب إضافة صنف واحد على الأقل');
            return;
        }
        try {
            await api.post('/procurement/orders', newOrder);
            push('success', 'تم إنشاء أمر الشراء بنجاح');
            setShowCreate(false);
            setNewOrder({ supplier: '', items: [] });
            loadData();
        } catch (err) {
            push('error', err.response?.data?.message || 'فشل إنشاء الطلب');
        }
    };


    // --- Details Logic ---
    const openDetailsModal = (order) => {
        setViewingOrder(order);
        setShowDetails(true);
    };

    // --- Receive Logic (The Critical Part) ---
    const openReceiveModal = (order) => {
        setReceivingOrder(order);
        setTargetWarehouse(order.warehouse || ''); // Default to pre-selected or empty
        setShowReceive(true);
    };

    const confirmReceive = async () => {
        if (!targetWarehouse) {
            push('error', 'يجب تحديد المستودع المستهدف لاستلام البضاعة');
            return;
        }

        try {
            // ✅ Call V2 Endpoint for Atomic Receive
            await api.post(`/procurement/orders/${receivingOrder._id}/post`, {
                warehouse: targetWarehouse
            });

            push('success', 'تم استلام البضاعة وتحديث المخزون ومتوسط التكلفة');
            setShowReceive(false);
            loadData();
        } catch (err) {
            push('error', err.response?.data?.message || 'فشل الاستلام');
        }
    };

    const statusConfig = {
        pending: { label: 'pending', className: 'bg-yellow-100 text-yellow-700' },
        approved: { label: 'approved', className: 'bg-blue-100 text-blue-700' },
        received: { label: 'received', className: 'bg-green-100 text-green-700' },
        cancelled: { label: 'cancelled', className: 'bg-red-100 text-red-700' },
        returned: { label: 'returned', className: 'bg-purple-100 text-purple-700' }
    };


    const handleVoid = async (order) => {
        if (!confirm('Void this order?')) return;

        try {
            await api.post(`/procurement/orders/${order._id}/void`);
            push('success', 'Order voided');
            loadData();
        } catch (err) {
            push('error', err.response?.data?.message || 'Failed to void order');
        }
    };

    const handleReverse = async (order) => {
        if (!confirm('Reverse this order?')) return;

        try {
            await api.post(`/procurement/orders/${order._id}/reverse`);
            push('success', 'Order reversed');
            loadData();
        } catch (err) {
            push('error', err.response?.data?.message || 'Failed to reverse order');
        }
    };


    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">أوامر الشراء</h1>
                <Button onClick={() => setShowCreate(true)}>
                    <Plus size={18} className="ml-2" /> طلب جديد
                </Button>
            </div>

            {/* Orders Table */}
            <Card>
                <table className="w-full text-right">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4">رقم الطلب</th>
                            <th className="p-4">التاريخ</th>
                            <th className="p-4">المورد</th>
                            <th className="p-4">الحالة</th>
                            <th className="p-4">الإجمالي</th>
                            <th className="p-4">المستودع المستهدف</th>
                            <th className="p-4">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map(order => {
                            const status = statusConfig[order.status] || { label: order.status, className: 'bg-slate-100 text-slate-700' };
                            return (
                                <tr key={order._id} className="border-b hover:bg-slate-50">
                                    <td className="p-4 font-mono">#{order.number || order._id.slice(-6)}</td>
                                    <td className="p-4 text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('ar-LY')}</td>
                                    <td className="p-4">{order.supplier?.name}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${status.className}`}>
                                            {status.label}
                                        </span>
                                    </td>
                                    <td className="p-4">{order.totalAmount} د.ل</td>
                                    <td className="p-4 text-sm text-gray-500">
                                        {order.warehouse?.name || '-'}
                                    </td>
                                    <td className="p-4 flex gap-2 justify-end">
                                        <Button size="sm" variant="ghost" onClick={() => openDetailsModal(order)} title="عرض التفاصيل">
                                            <Eye size={16} className="text-gray-600" />
                                        </Button>
                                        {['pending', 'approved'].includes(order.status) && (
                                            <>
                                                <Button size="sm" onClick={() => openReceiveModal(order)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                                    <Truck size={16} className="ml-2" /> ??????
                                                </Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleVoid(order)} className="gap-1">
                                                    <XCircle size={16} className="ml-2" /> Void
                                                </Button>
                                            </>
                                        )}
                                        {order.status === 'received' && (
                                            <Button size="sm" variant="secondary" onClick={() => handleReverse(order)} className="gap-1">
                                                <RotateCcw size={16} className="ml-2" /> Reverse
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </Card>

            {/* Create Order Dialog - Spreadsheet Style */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-[65vw] lg:max-w-[1000px] max-h-[10vh] overflow-y-auto" onClose={() => setShowCreate(false)}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
                                <ShoppingCart size={20} />
                            </div>
                            أمر شراء جديد
                        </DialogTitle>
                    </DialogHeader>

                    <DialogBody className="space-y-4">
                        {/* Supplier Select */}
                        <div className="space-y-2">
                            <Label htmlFor="supplier">
                                المورد <span className="text-red-500">*</span>
                            </Label>
                            <NativeSelect
                                id="supplier"
                                value={newOrder.supplier}
                                onChange={e => setNewOrder({ ...newOrder, supplier: e.target.value })}
                            >
                                <option value="">اختر المورد...</option>
                                {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </NativeSelect>
                        </div>

                        {/* Spreadsheet Purchase Items */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Package size={16} className="text-blue-500" />
                                الأصناف المطلوبة
                            </Label>
                            <SpreadsheetPurchase
                                orderItems={newOrder.items}
                                products={items}
                                onAddItem={handlePurchaseAddItem}
                                onUpdateItem={handlePurchaseUpdateItem}
                                onRemoveItem={handlePurchaseRemoveItem}
                            />
                        </div>
                    </DialogBody>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>
                            إلغاء
                        </Button>
                        <Button onClick={submitOrder} disabled={!newOrder.supplier || newOrder.items.length === 0}>
                            💾 حفظ الطلب
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Receive Modal (THE CRITICAL PART) */}
            {showReceive && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Truck className="text-blue-600" /> استلام البضاعة
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-gray-600 text-sm">
                                سيتم إضافة الكميات إلى المخزون وتحديث متوسط التكلفة وحساب المورد.
                            </p>

                            <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-sm text-yellow-800">
                                <strong>تنبيه:</strong> هذه العملية لا يمكن التراجع عنها.
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border max-h-60 overflow-y-auto">
                                <h3 className="font-bold text-sm mb-2">تفاصيل الفاتورة (للمراجعة):</h3>
                                <table className="w-full text-sm">
                                    <thead className="text-xs text-gray-500 bg-gray-100 uppercase">
                                        <tr>
                                            <th className="p-2 text-right">الصنف</th>
                                            <th className="p-2 text-center">الكمية</th>
                                            <th className="p-2 text-center">التكلفة</th>
                                            <th className="p-2 text-center">الإجمالي</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {receivingOrder?.items?.map((line, idx) => (
                                            <tr key={idx}>
                                                <td className="p-2">
                                                    <div className="font-medium">{line.item?.name || 'Unknown'}</div>
                                                    <div className="text-xs text-gray-500">{line.item?.sku}</div>
                                                </td>
                                                <td className="p-2 text-center font-mono">{line.qty}</td>
                                                <td className="p-2 text-center text-gray-600">{line.cost}</td>
                                                <td className="p-2 text-center font-bold">{(line.qty * line.cost).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-bold border-t">
                                        <tr>
                                            <td colSpan="3" className="p-2 text-left">الإجمالي الكلي:</td>
                                            <td className="p-2 text-center">{receivingOrder?.totalAmount?.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div>
                                <label className="block text-sm font-bold mb-1">المستودع المستهدف (للتخزين)</label>
                                <select
                                    className="w-full border p-2 rounded focus:ring-2 ring-blue-500"
                                    value={targetWarehouse}
                                    onChange={e => setTargetWarehouse(e.target.value)}
                                >
                                    <option value="">-- اختر المستودع --</option>
                                    {warehouses.map(w => (
                                        <option key={w._id} value={w._id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setShowReceive(false)}>إلغاء</Button>
                                <Button onClick={confirmReceive} disabled={!targetWarehouse} className="bg-green-600 hover:bg-green-700 text-white">
                                    <CheckCircle size={16} className="ml-2" /> تأكيد الاستلام ودخول المخزون
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* View Details Modal */}
            {showDetails && viewingOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <Card className="w-full max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Eye className="text-primary" /> تفاصيل الطلب #{viewingOrder.number || viewingOrder._id.slice(-6)}
                            </h2>
                            <button onClick={() => setShowDetails(false)} className="hover:bg-gray-100 p-1 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6">

                            {/* Header Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border">
                                <div>
                                    <p className="text-xs text-muted-foreground">المورد</p>
                                    <p className="font-bold">{viewingOrder.supplier?.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">التاريخ والوقت</p>
                                    <p className="font-bold">{new Date(viewingOrder.createdAt).toLocaleString('ar-LY', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">الحالة</p>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${viewingOrder.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {viewingOrder.status === 'received' ? 'مستلم' : viewingOrder.status}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">المستودع</p>
                                    <p className="font-bold">{viewingOrder.warehouse?.name || '-'}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-gray-700">
                                        <tr>
                                            <th className="p-3 text-right">الصنف</th>
                                            <th className="p-3 text-center">الكمية</th>
                                            <th className="p-3 text-center">التكلفة</th>
                                            <th className="p-3 text-center">الإجمالي</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {viewingOrder.items?.map((line, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="p-3">
                                                    <div className="font-medium">{line.item?.name}</div>
                                                    <div className="text-xs text-muted-foreground">{line.item?.sku}</div>
                                                </td>
                                                <td className="p-3 text-center font-mono">{line.qty}</td>
                                                <td className="p-3 text-center">{line.cost}</td>
                                                <td className="p-3 text-center font-bold">{(line.qty * line.cost).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold border-t">
                                        <tr>
                                            <td colSpan={3} className="p-3 text-left">الإجمالي الكلي</td>
                                            <td className="p-3 text-center text-primary text-lg">{viewingOrder.totalAmount?.toFixed(2)} د.ل</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {viewingOrder.note && (
                                <div className="bg-yellow-50 p-3 rounded border border-yellow-100 text-sm">
                                    <strong>ملاحظات:</strong> {viewingOrder.note}
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <Button variant="outline" onClick={() => setShowDetails(false)}>إغلاق</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
