import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import {
    FaPlus, FaLock, FaUnlock, FaCalendarAlt, FaCheck, FaTimes
} from 'react-icons/fa';

import Layout from '../../components/Layout';

const FiscalPeriods = () => {
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReopenModal, setShowReopenModal] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(null);

    // Create Form State
    const [newPeriod, setNewPeriod] = useState({
        name: '',
        startDate: '',
        endDate: '',
        note: ''
    });

    // Reopen Form State
    const [reopenReason, setReopenReason] = useState('');

    const fetchPeriods = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/fiscal-periods');
            setPeriods(data);
        } catch (error) {
            toast.error('فشل في جلب الفترات المالية');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPeriods();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/fiscal-periods', newPeriod);
            toast.success('تم إنشاء الفترة بنجاح');
            setShowCreateModal(false);
            setNewPeriod({ name: '', startDate: '', endDate: '', note: '' });
            fetchPeriods();
        } catch (error) {
            toast.error(error.response?.data?.message || 'فشل إنشاء الفترة');
        }
    };

    const handleClose = async (period) => {
        if (!window.confirm(`هل أنت متأكد من إغلاق الفترة "${period.name}"؟ لن يمكن إضافة قيود جديدة في هذه الفترة.`)) return;

        try {
            await api.post(`/fiscal-periods/${period._id}/close`);
            toast.success('تم إغلاق الفترة بنجاح');
            fetchPeriods();
        } catch (error) {
            toast.error('فشل إغلاق الفترة');
        }
    };

    const handleReopenSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/fiscal-periods/${selectedPeriod._id}/reopen`, { reason: reopenReason });
            toast.success('تم إعادة فتح الفترة بنجاح');
            setShowReopenModal(false);
            setReopenReason('');
            setSelectedPeriod(null);
            fetchPeriods();
        } catch (error) {
            toast.error('فشل إعادة فتح الفترة');
        }
    };

    return (
        <div className="animate-in fade-in">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FaCalendarAlt className="text-blue-600" />
                        إدارة الفترات المالية
                    </h1>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
                    >
                        <FaPlus />
                        فترة جديدة
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4 font-semibold text-gray-600">اسم الفترة</th>
                                <th className="p-4 font-semibold text-gray-600">من تاريخ</th>
                                <th className="p-4 font-semibold text-gray-600">إلى تاريخ</th>
                                <th className="p-4 font-semibold text-gray-600">الحالة</th>
                                <th className="p-4 font-semibold text-gray-600">تفاصيل</th>
                                <th className="p-4 font-semibold text-gray-600">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">جاري التحميل...</td></tr>
                            ) : periods.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500">لا توجد فترات مالية معرفة</td></tr>
                            ) : (
                                periods.map((period) => (
                                    <tr key={period._id} className="hover:bg-gray-50">
                                        <td className="p-4 font-medium">{period.name}</td>
                                        <td className="p-4 text-gray-600">{new Date(period.startDate).toLocaleDateString('ar-LY')}</td>
                                        <td className="p-4 text-gray-600">{new Date(period.endDate).toLocaleDateString('ar-LY')}</td>
                                        <td className="p-4">
                                            {period.isClosed ? (
                                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
                                                    <FaLock size={12} /> مغلقة
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                                                    <FaUnlock size={12} /> مفتوحة
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-gray-500">
                                            {period.isClosed && (
                                                <div>
                                                    <div>أغلقت بواسطة: {period.closedBy?.name || 'النظام'}</div>
                                                    <div className="text-xs">{new Date(period.closedAt).toLocaleString()}</div>
                                                    {period.reopenedBy && (
                                                        <div className="mt-1 text-orange-600">
                                                            تمت إعادة الفتح سابقاً
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {!period.isClosed && period.reopenedBy && (
                                                <div>
                                                    <div>فتح بواسطة: {period.reopenedBy?.name}</div>
                                                    <div className="text-xs">{new Date(period.reopenedAt).toLocaleString()}</div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {!period.isClosed ? (
                                                <button
                                                    onClick={() => handleClose(period)}
                                                    className="text-red-600 hover:bg-red-50 px-3 py-1 rounded border border-red-200 transition text-sm flex items-center gap-1"
                                                    title="إغلاق الفترة"
                                                >
                                                    <FaLock size={14} /> إغلاق
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => { setSelectedPeriod(period); setShowReopenModal(true); }}
                                                    className="text-orange-600 hover:bg-orange-50 px-3 py-1 rounded border border-orange-200 transition text-sm flex items-center gap-1"
                                                    title="إعادة فتح الفترة (للضرورة)"
                                                >
                                                    <FaUnlock size={14} /> إعادة فتح
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold">فترة مالية جديدة</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <FaTimes />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">اسم الفترة</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="مثال: السنة المالية 2025"
                                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                                    value={newPeriod.name}
                                    onChange={e => setNewPeriod({ ...newPeriod, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">من تاريخ</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full border rounded-lg p-2"
                                        value={newPeriod.startDate}
                                        onChange={e => setNewPeriod({ ...newPeriod, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">إلى تاريخ</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full border rounded-lg p-2"
                                        value={newPeriod.endDate}
                                        onChange={e => setNewPeriod({ ...newPeriod, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">ملاحظات</label>
                                <textarea
                                    className="w-full border rounded-lg p-2"
                                    rows="2"
                                    value={newPeriod.note}
                                    onChange={e => setNewPeriod({ ...newPeriod, note: e.target.value })}
                                ></textarea>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">إلغاء</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">حفظ</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reopen Modal */}
            {showReopenModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b bg-orange-50 flex justify-between items-center text-orange-800">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <FaUnlock />
                                إعادة فتح فترة مغلقة
                            </h2>
                            <button onClick={() => setShowReopenModal(false)} className="text-orange-600 hover:text-orange-800">
                                <FaTimes />
                            </button>
                        </div>
                        <form onSubmit={handleReopenSubmit} className="p-6 space-y-4">
                            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm text-orange-800">
                                تنبيه: إعادة فتح الفترة قد يؤدي إلى تغييرات في التقارير المالية التاريخية. يجب توخي الحذر.
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">سبب إعادة الفتح (مطلوب)</label>
                                <textarea
                                    required
                                    placeholder="اشرح سبب الحاجة لإعادة فتح الفترة... (سيتم تسجيله في سجلات التدقيق)"
                                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-orange-500"
                                    rows="3"
                                    value={reopenReason}
                                    onChange={e => setReopenReason(e.target.value)}
                                ></textarea>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button type="button" onClick={() => setShowReopenModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">إلغاء</button>
                                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">تأكيد الفتح</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FiscalPeriods;
