import { useState, useEffect } from 'react';
import { X, Printer, Calendar, FileText, ArrowUpRight, ArrowDownLeft, RotateCcw } from 'lucide-react';
import api from '../../services/api';
import { Button } from '../ui/Button';

export default function SupplierStatementModal({ isOpen, onClose, supplierId }) {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    useEffect(() => {
        if (isOpen && supplierId) {
            fetchStatement();
        } else {
            setData(null);
        }
    }, [isOpen, supplierId]);

    const fetchStatement = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/procurement/suppliers/${supplierId}/statement`);
            setData(data);
        } catch (error) {
            console.error("Failed to fetch statement", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (val) => Number(val).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD' });
    const formatDate = (date) => new Date(date).toLocaleDateString('ar-LY');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:p-0 print:static print:bg-white">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:w-full print:max-w-none print:max-h-none">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b print:border-none">
                    <div>
                        <h2 className="text-2xl font-bold">كشف حساب مورد</h2>
                        {data && <p className="text-muted-foreground mt-1">{data.supplier.name}</p>}
                    </div>
                    <div className="flex items-center gap-2 print:hidden">
                        <Button variant="outline" onClick={handlePrint} className="gap-2">
                            <Printer size={16} /> طباعة
                        </Button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 print:p-0 print:overflow-visible">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : data ? (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                                <div className="bg-slate-50 p-4 rounded-lg border">
                                    <p className="text-sm text-muted-foreground">الرصيد الحالي</p>
                                    <p className={`text-2xl font-bold ${data.supplier.currentBalance > 0 ? 'text-destructive' : 'text-success'}`}>
                                        {formatCurrency(data.supplier.currentBalance)}
                                    </p>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-right">التاريخ</th>
                                            <th className="px-4 py-3 text-right">نوع الحركة</th>
                                            <th className="px-4 py-3 text-right">المرجع</th>
                                            <th className="px-4 py-3 text-center">مدين (لنا)</th>
                                            <th className="px-4 py-3 text-center">دائن (علينا)</th>
                                            <th className="px-4 py-3 text-center">الرصيد</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {data.statement.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">لا توجد حركات مسجلة</td>
                                            </tr>
                                        ) : (
                                            data.statement.map((row) => (
                                                <tr key={row.id} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-medium">{formatDate(row.date)}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            {row.type === 'INVOICE' && <FileText size={14} className="text-blue-500" />}
                                                            {row.type === 'PAYMENT' && <ArrowUpRight size={14} className="text-green-500" />}
                                                            {row.type === 'RETURN' && <RotateCcw size={14} className="text-orange-500" />}
                                                            <span>
                                                                {row.type === 'INVOICE' ? 'فاتورة شراء' :
                                                                    row.type === 'PAYMENT' ? 'سند صرف' :
                                                                        row.type === 'RETURN' ? 'مردودات' : row.type}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs max-w-[100px] truncate" title={row.ref}>
                                                        {row.ref}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-green-600">
                                                        {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-red-500 font-medium">
                                                        {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold" dir="ltr">
                                                        {formatCurrency(row.balance)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="hidden print:block text-center mt-8 text-sm text-slate-400">
                                طبع بتاريخ {new Date().toLocaleString('ar-LY')}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            فشل تحميل كشف الحساب
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
