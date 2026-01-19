import { useState, useEffect } from 'react'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { NativeSelect } from '../components/ui/Select'
import {
    Settings as SettingsIcon,
    Save,
    Building2,
    Phone,
    Mail,
    MapPin,
    Globe,
    Image as ImageIcon,
    Wallet,
    Printer,
    Palette,
    FileText,
    Hash,
    MessageSquare,
    Moon,
    Sun,
    Check,
    Loader2,
    Users
} from 'lucide-react'

// Tab Button Component
const TabButton = ({ active, icon: Icon, label, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className={`
            flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm transition-all w-full text-right
            ${active
                ? 'bg-gradient-to-l from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 hover:border-blue-300'}
        `}
    >
        <Icon size={20} className={active ? 'text-white' : 'text-slate-400'} />
        <span>{label}</span>
    </button>
)

// Section Header Component
const SectionHeader = ({ icon: Icon, title, description, color = 'blue' }) => (
    <div className="flex items-start gap-4 mb-6">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${color}-500 to-${color}-600 flex items-center justify-center text-white shadow-lg`}>
            <Icon size={24} />
        </div>
        <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500">{description}</p>
        </div>
    </div>
)

export default function Settings() {
    const { push } = useToast()
    const { darkMode, setDarkMode } = useTheme()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState('company')

    const [settings, setSettings] = useState({
        // Company Info
        companyName: '',
        commercialRegister: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        logo: '',

        // Financial
        currency: 'LYD',
        defaultCreditLimit: 0,
        invoicePrefix: 'INV-',
        purchaseOrderPrefix: 'PO-',

        // Print
        printTemplate: 'a4',
        thankYouMessage: 'شكراً لتعاملكم معنا',
        showLogo: true,
        showAddress: true,
        showPhone: true,

        // Appearance
        darkMode: false,
        primaryColor: 'blue'
    })

    const [logoFile, setLogoFile] = useState(null)
    const [logoPreview, setLogoPreview] = useState('')

    const loadSettings = async () => {
        setLoading(true)
        try {
            const { data } = await api.get('/settings')
            if (data) {
                setSettings(prev => ({
                    ...prev,
                    companyName: data.companyName || '',
                    commercialRegister: data.commercialRegister || '',
                    address: data.address || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    website: data.website || '',
                    logo: data.logo || '',
                    currency: data.currency || 'LYD',
                    defaultCreditLimit: data.defaultCreditLimit || 0,
                    invoicePrefix: data.invoicePrefix || 'INV-',
                    purchaseOrderPrefix: data.purchaseOrderPrefix || 'PO-',
                    printTemplate: data.printTemplate || 'a4',
                    thankYouMessage: data.thankYouMessage || 'شكراً لتعاملكم معنا',
                    showLogo: data.showLogo !== false,
                    showAddress: data.showAddress !== false,
                    showPhone: data.showPhone !== false,
                    darkMode: data.darkMode || false,
                    primaryColor: data.primaryColor || 'blue'
                }))
                if (data.logo) setLogoPreview(data.logo)
            }
        } catch (err) {
            console.error('Failed to load settings', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadSettings() }, [])

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            setLogoFile(file)
            setLogoPreview(URL.createObjectURL(file))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            // Prepare data object (send JSON, not FormData)
            const dataToSend = { ...settings }

            // Handle logo file separately if needed
            if (logoFile) {
                // Convert file to base64 for simple upload
                const reader = new FileReader()
                reader.onloadend = async () => {
                    dataToSend.logo = reader.result
                    await api.post('/settings', dataToSend)
                    push('success', 'تم حفظ الإعدادات بنجاح')
                    setSaving(false)
                }
                reader.readAsDataURL(logoFile)
            } else {
                await api.post('/settings', dataToSend)
                push('success', 'تم حفظ الإعدادات بنجاح')
                setSaving(false)
            }
        } catch (err) {
            console.error(err)
            push('error', 'فشل حفظ الإعدادات')
            setSaving(false)
        }
    }

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    const tabs = [
        { id: 'company', label: 'بيانات الشركة', icon: Building2 },
        { id: 'financial', label: 'الإعدادات المالية', icon: Wallet },
        { id: 'print', label: 'إعدادات الطباعة', icon: Printer },
        { id: 'appearance', label: 'المظهر', icon: Palette }
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={40} className="animate-spin text-blue-500" />
                    <span className="text-slate-500">جاري تحميل الإعدادات...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center text-white shadow-xl">
                        <SettingsIcon size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">إعدادات النظام</h1>
                        <p className="text-slate-500">تخصيص بيانات الشركة والمظهر العام</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-6">
                {/* Sidebar Tabs */}
                <div className="w-64 shrink-0 space-y-2">
                    {tabs.map(tab => (
                        <TabButton
                            key={tab.id}
                            active={activeTab === tab.id}
                            icon={tab.icon}
                            label={tab.label}
                            onClick={() => setActiveTab(tab.id)}
                        />
                    ))}

                    {/* Save Button in Sidebar */}
                    <div className="pt-4 border-t border-slate-200 mt-4">
                        <Button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                        >
                            {saving ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 size={18} className="animate-spin" />
                                    جاري الحفظ...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Save size={18} />
                                    حفظ التغييرات
                                </span>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <Card className="flex-1 p-6">
                    {/* Company Tab */}
                    {activeTab === 'company' && (
                        <div className="animate-in fade-in duration-200">
                            <SectionHeader
                                icon={Building2}
                                title="بيانات الشركة"
                                description="المعلومات الأساسية التي ستظهر في الفواتير والتقارير"
                            />

                            {/* Logo Section */}
                            <div className="flex items-start gap-6 mb-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-white overflow-hidden relative group cursor-pointer hover:border-blue-400 transition-colors">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <ImageIcon className="text-slate-300" size={36} />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                    />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold pointer-events-none rounded-xl">
                                        تغيير الشعار
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-800 mb-1">شعار الشركة</h4>
                                    <p className="text-sm text-slate-500 mb-3">يظهر في الفواتير والتقارير. يُفضل PNG بخلفية شفافة.</p>
                                    <div className="flex gap-2">
                                        <label className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-200 transition-colors">
                                            اختر صورة
                                            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                        </label>
                                        {logoPreview && (
                                            <button
                                                type="button"
                                                onClick={() => { setLogoFile(null); setLogoPreview('') }}
                                                className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
                                            >
                                                حذف
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Building2 size={16} className="text-blue-500" />
                                        اسم الشركة <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        required
                                        value={settings.companyName}
                                        onChange={e => updateSetting('companyName', e.target.value)}
                                        placeholder="مثال: شركة الأفق للتجارة"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Hash size={16} className="text-purple-500" />
                                        السجل التجاري
                                    </Label>
                                    <Input
                                        value={settings.commercialRegister}
                                        onChange={e => updateSetting('commercialRegister', e.target.value)}
                                        placeholder="رقم السجل التجاري"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Phone size={16} className="text-emerald-500" />
                                        رقم الهاتف
                                    </Label>
                                    <Input
                                        value={settings.phone}
                                        onChange={e => updateSetting('phone', e.target.value)}
                                        placeholder="0912345678"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Mail size={16} className="text-rose-500" />
                                        البريد الإلكتروني
                                    </Label>
                                    <Input
                                        type="email"
                                        value={settings.email}
                                        onChange={e => updateSetting('email', e.target.value)}
                                        placeholder="info@company.ly"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <Label className="flex items-center gap-2">
                                        <MapPin size={16} className="text-orange-500" />
                                        العنوان
                                    </Label>
                                    <Input
                                        value={settings.address}
                                        onChange={e => updateSetting('address', e.target.value)}
                                        placeholder="طرابلس، شارع عمر المختار"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Globe size={16} className="text-cyan-500" />
                                        الموقع الإلكتروني
                                    </Label>
                                    <Input
                                        value={settings.website}
                                        onChange={e => updateSetting('website', e.target.value)}
                                        placeholder="www.company.ly"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Financial Tab */}
                    {activeTab === 'financial' && (
                        <div className="animate-in fade-in duration-200">
                            <SectionHeader
                                icon={Wallet}
                                title="الإعدادات المالية"
                                description="تخصيص العملة وإعدادات الفواتير"
                                color="emerald"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Wallet size={16} className="text-emerald-500" />
                                        العملة الافتراضية
                                    </Label>
                                    <NativeSelect
                                        value={settings.currency}
                                        onChange={e => updateSetting('currency', e.target.value)}
                                    >
                                        <option value="LYD">دينار ليبي (د.ل)</option>
                                        <option value="USD">دولار أمريكي ($)</option>
                                        <option value="EUR">يورو (€)</option>
                                    </NativeSelect>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Wallet size={16} className="text-blue-500" />
                                        سقف الائتمان الافتراضي
                                    </Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={settings.defaultCreditLimit}
                                        onChange={e => updateSetting('defaultCreditLimit', Number(e.target.value))}
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-slate-400">يُطبق تلقائياً على العملاء الجدد</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <FileText size={16} className="text-indigo-500" />
                                        بادئة فواتير البيع
                                    </Label>
                                    <Input
                                        value={settings.invoicePrefix}
                                        onChange={e => updateSetting('invoicePrefix', e.target.value)}
                                        placeholder="INV-"
                                    />
                                    <p className="text-xs text-slate-400">مثال: INV-0001، FAT-0001</p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <FileText size={16} className="text-orange-500" />
                                        بادئة أوامر الشراء
                                    </Label>
                                    <Input
                                        value={settings.purchaseOrderPrefix}
                                        onChange={e => updateSetting('purchaseOrderPrefix', e.target.value)}
                                        placeholder="PO-"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Print Tab */}
                    {activeTab === 'print' && (
                        <div className="animate-in fade-in duration-200">
                            <SectionHeader
                                icon={Printer}
                                title="إعدادات الطباعة"
                                description="تخصيص شكل الفواتير المطبوعة"
                                color="purple"
                            />

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Printer size={16} className="text-purple-500" />
                                        قالب الطباعة
                                    </Label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { id: 'a4', label: 'A4 كامل', desc: 'للفواتير الرسمية' },
                                            { id: 'a5', label: 'A5 نصفي', desc: 'فواتير متوسطة' },
                                            { id: 'thermal', label: 'حراري 80mm', desc: 'طابعة الكاشير' }
                                        ].map(template => (
                                            <button
                                                key={template.id}
                                                type="button"
                                                onClick={() => updateSetting('printTemplate', template.id)}
                                                className={`p-4 rounded-xl border-2 text-right transition-all ${settings.printTemplate === template.id
                                                    ? 'border-purple-500 bg-purple-50'
                                                    : 'border-slate-200 hover:border-purple-300'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${settings.printTemplate === template.id
                                                        ? 'border-purple-500 bg-purple-500'
                                                        : 'border-slate-300'
                                                        }`}>
                                                        {settings.printTemplate === template.id && (
                                                            <Check size={12} className="text-white" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800">{template.label}</div>
                                                        <div className="text-xs text-slate-500">{template.desc}</div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <MessageSquare size={16} className="text-pink-500" />
                                        رسالة الشكر
                                    </Label>
                                    <Input
                                        value={settings.thankYouMessage}
                                        onChange={e => updateSetting('thankYouMessage', e.target.value)}
                                        placeholder="شكراً لتعاملكم معنا"
                                    />
                                    <p className="text-xs text-slate-400">يظهر أسفل الفاتورة المطبوعة</p>
                                </div>

                                {/* Header - Company Info */}
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-blue-600">
                                        <Building2 size={16} />
                                        رأس الفاتورة (بيانات الشركة)
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'print_showLogo', label: 'الشعار' },
                                            { key: 'print_showCompanyName', label: 'اسم الشركة' },
                                            { key: 'print_showAddress', label: 'العنوان' },
                                            { key: 'print_showPhone', label: 'رقم الهاتف' },
                                            { key: 'print_showCommercialRegister', label: 'السجل التجاري' },
                                            { key: 'print_showInvoiceNumber', label: 'رقم الفاتورة' },
                                            { key: 'print_showDateTime', label: 'التاريخ والوقت' }
                                        ].map(item => (
                                            <label
                                                key={item.key}
                                                className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors border border-blue-100"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={settings[item.key] !== false}
                                                    onChange={e => updateSetting(item.key, e.target.checked)}
                                                    className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-blue-800">{item.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-emerald-600">
                                        <Users size={16} />
                                        بيانات العميل
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'print_showCustomerName', label: 'اسم العميل' },
                                            { key: 'print_showCustomerPhone', label: 'هاتف العميل' },
                                            { key: 'print_showCustomerAddress', label: 'عنوان العميل' }
                                        ].map(item => (
                                            <label
                                                key={item.key}
                                                className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-lg cursor-pointer hover:bg-emerald-100 transition-colors border border-emerald-100"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={settings[item.key] !== false}
                                                    onChange={e => updateSetting(item.key, e.target.checked)}
                                                    className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className="text-sm font-medium text-emerald-800">{item.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-purple-600">
                                        <FileText size={16} />
                                        جدول الأصناف
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'print_showRowNumber', label: 'رقم الصف (#)' },
                                            { key: 'print_showItemCode', label: 'كود الصنف' },
                                            { key: 'print_showItemName', label: 'اسم الصنف' },
                                            { key: 'print_showQuantity', label: 'الكمية' },
                                            { key: 'print_showUnitPrice', label: 'سعر الوحدة' },
                                            { key: 'print_showItemTotal', label: 'إجمالي الصنف' }
                                        ].map(item => (
                                            <label
                                                key={item.key}
                                                className="flex items-center gap-2 p-2.5 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors border border-purple-100"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={settings[item.key] !== false}
                                                    onChange={e => updateSetting(item.key, e.target.checked)}
                                                    className="w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                                />
                                                <span className="text-sm font-medium text-purple-800">{item.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Totals Summary */}
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-amber-600">
                                        <Wallet size={16} />
                                        ملخص الفاتورة
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'print_showSubtotal', label: 'المجموع الفرعي' },
                                            { key: 'print_showDiscount', label: 'الخصم' },
                                            { key: 'print_showPaidAmount', label: 'المبلغ المدفوع' },
                                            { key: 'print_showRemainingAmount', label: 'المتبقي' },
                                            { key: 'print_showGrandTotal', label: 'الإجمالي النهائي' }
                                        ].map(item => (
                                            <label
                                                key={item.key}
                                                className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors border border-amber-100"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={settings[item.key] !== false}
                                                    onChange={e => updateSetting(item.key, e.target.checked)}
                                                    className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                <span className="text-sm font-medium text-amber-800">{item.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="space-y-3">
                                    <Label className="flex items-center gap-2 text-rose-600">
                                        <MessageSquare size={16} />
                                        تذييل الفاتورة
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'print_showThankYouMessage', label: 'رسالة الشكر' },
                                            { key: 'print_showNotes', label: 'الملاحظات' }
                                        ].map(item => (
                                            <label
                                                key={item.key}
                                                className="flex items-center gap-2 p-2.5 bg-rose-50 rounded-lg cursor-pointer hover:bg-rose-100 transition-colors border border-rose-100"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={settings[item.key] !== false}
                                                    onChange={e => updateSetting(item.key, e.target.checked)}
                                                    className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                                                />
                                                <span className="text-sm font-medium text-rose-800">{item.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Appearance Tab */}
                    {activeTab === 'appearance' && (
                        <div className="animate-in fade-in duration-200">
                            <SectionHeader
                                icon={Palette}
                                title="المظهر"
                                description="تخصيص شكل النظام وألوانه"
                                color="rose"
                            />

                            <div className="space-y-6">
                                {/* Dark Mode Toggle */}
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-3">
                                        {darkMode ? (
                                            <Moon size={24} className="text-indigo-500" />
                                        ) : (
                                            <Sun size={24} className="text-amber-500" />
                                        )}
                                        <div>
                                            <div className="font-bold text-slate-800">الوضع الليلي</div>
                                            <div className="text-sm text-slate-500">
                                                {darkMode ? 'مُفعّل - ألوان داكنة' : 'مُعطّل - ألوان فاتحة'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setDarkMode(!darkMode)}
                                        className={`relative w-14 h-8 rounded-full transition-colors ${darkMode ? 'bg-indigo-500' : 'bg-slate-300'
                                            }`}
                                    >
                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${darkMode ? 'right-1' : 'left-1'
                                            }`} />
                                    </button>
                                </div>

                                {/* Primary Color */}
                                <div className="space-y-3">
                                    <Label>اللون الأساسي</Label>
                                    <div className="flex gap-3 flex-wrap">
                                        {[
                                            { id: 'blue', color: 'bg-blue-500' },
                                            { id: 'indigo', color: 'bg-indigo-500' },
                                            { id: 'purple', color: 'bg-purple-500' },
                                            { id: 'rose', color: 'bg-rose-500' },
                                            { id: 'emerald', color: 'bg-emerald-500' },
                                            { id: 'amber', color: 'bg-amber-500' },
                                            { id: 'slate', color: 'bg-slate-700' }
                                        ].map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => updateSetting('primaryColor', c.id)}
                                                className={`w-10 h-10 rounded-full ${c.color} flex items-center justify-center transition-transform hover:scale-110 ${settings.primaryColor === c.id ? 'ring-4 ring-offset-2 ring-slate-300' : ''
                                                    }`}
                                            >
                                                {settings.primaryColor === c.id && (
                                                    <Check size={18} className="text-white" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400">* يتطلب إعادة تحميل الصفحة للتطبيق</p>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            </form>
        </div>
    )
}
