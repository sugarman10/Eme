import { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
    Plus,
    FolderOpen,
    Edit2,
    X,
    Check,
    AlertCircle
} from 'lucide-react';

export default function ExpenseCategories() {
    const { push } = useToast();

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        code: '',
        name: '',
        accountCode: '5020',
        description: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/expenses/categories');
            setCategories(data || []);
        } catch (err) {
            console.error('Failed to load categories:', err);
            push('error', 'فشل في تحميل الفئات');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.code || !form.name) {
            return push('error', 'الرمز والاسم مطلوبان');
        }

        try {
            setIsSubmitting(true);

            if (editingId) {
                await api.put(`/expenses/categories/${editingId}`, {
                    name: form.name,
                    accountCode: form.accountCode,
                    description: form.description,
                });
                push('success', 'تم تحديث الفئة بنجاح');
            } else {
                await api.post('/expenses/categories', form);
                push('success', 'تم إنشاء الفئة بنجاح');
            }

            resetForm();
            loadCategories();
        } catch (err) {
            const errorMsg = err?.response?.data?.message || 'فشل في حفظ الفئة';
            push('error', errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (category) => {
        setEditingId(category._id);
        setForm({
            code: category.code,
            name: category.name,
            accountCode: category.accountCode || '5020',
            description: category.description || '',
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm({
            code: '',
            name: '',
            accountCode: '5020',
            description: '',
        });
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">فئات المصروفات</h1>
                    <p className="text-muted-foreground text-sm">إدارة تصنيفات المصروفات وربطها بالحسابات</p>
                </div>
                {!showForm && (
                    <Button
                        onClick={() => setShowForm(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Plus size={18} className="ml-2" />
                        فئة جديدة
                    </Button>
                )}
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <Card className="p-6 bg-blue-50 border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-blue-800">
                            {editingId ? 'تعديل فئة' : 'إنشاء فئة جديدة'}
                        </h3>
                        <button onClick={resetForm} className="text-gray-400 hover:text-red-500">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold">الرمز <span className="text-red-500">*</span></label>
                            <Input
                                placeholder="EXP-01"
                                value={form.code}
                                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                disabled={!!editingId}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold">الاسم <span className="text-red-500">*</span></label>
                            <Input
                                placeholder="إيجار المحل"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold">رمز الحساب المحاسبي</label>
                            <Input
                                placeholder="5020"
                                value={form.accountCode}
                                onChange={e => setForm({ ...form, accountCode: e.target.value })}
                            />
                            <p className="text-xs text-gray-500">رمز حساب المصروفات في شجرة الحسابات</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold">الوصف</label>
                            <Input
                                placeholder="وصف اختياري..."
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-2 flex gap-3 justify-end pt-2">
                            <Button type="button" variant="ghost" onClick={resetForm}>
                                إلغاء
                            </Button>
                            <Button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'جاري الحفظ...' : (
                                    <>
                                        <Check size={16} className="ml-1" />
                                        {editingId ? 'تحديث' : 'حفظ'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Categories List */}
            <Card>
                <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
                    <FolderOpen size={20} className="text-slate-600" />
                    <span className="font-bold text-slate-700">الفئات ({categories.length})</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 border-b text-sm text-gray-600">
                            <tr>
                                <th className="p-4">الرمز</th>
                                <th className="p-4">الاسم</th>
                                <th className="p-4">حساب المصروفات</th>
                                <th className="p-4">الوصف</th>
                                <th className="p-4">الحالة</th>
                                <th className="p-4">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">جاري التحميل...</td></tr>
                            ) : categories.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle size={32} className="text-gray-400" />
                                            <p>لا توجد فئات. أنشئ فئة جديدة للبدء.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                categories.map(cat => (
                                    <tr key={cat._id} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-mono text-sm font-bold">{cat.code}</td>
                                        <td className="p-4 font-bold">{cat.name}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-mono">
                                                {cat.accountCode}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">{cat.description || '-'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${cat.isActive
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {cat.isActive ? 'نشط' : 'معطل'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {!cat.isSystem && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleEdit(cat)}
                                                >
                                                    <Edit2 size={14} className="ml-1" />
                                                    تعديل
                                                </Button>
                                            )}
                                            {cat.isSystem && (
                                                <span className="text-xs text-gray-400">فئة نظام</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
