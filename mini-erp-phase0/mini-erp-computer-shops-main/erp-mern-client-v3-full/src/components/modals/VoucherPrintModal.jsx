import React, { useRef } from 'react'
import { Printer, X, Receipt, ArrowUpRight, Building2, Phone, Mail, Globe, CheckCircle2 } from 'lucide-react'
import { useSettings } from '../../context/SettingsContext'
import { formatCurrency } from '../../lib/utils'

/**
 * تحويل الأرقام إلى حروف عربية (تفقيط المبلغ بالدينار الليبي والدرهم)
 */
function numberToArabicWords(num) {
    if (num === null || num === undefined || isNaN(num)) return ''
    const n = Math.abs(Number(num))
    if (n === 0) return 'صفر دينار ليبي'

    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

    const convertBelowThousand = (val) => {
        if (val === 0) return ''
        const h = Math.floor(val / 100)
        const rem = val % 100
        const parts = []
        if (h > 0) parts.push(hundreds[h])
        if (rem > 0) {
            if (rem < 20) {
                parts.push(ones[rem])
            } else {
                const u = rem % 10
                const t = Math.floor(rem / 10)
                if (u > 0) {
                    parts.push(`${ones[u]} و${tens[t]}`)
                } else {
                    parts.push(tens[t])
                }
            }
        }
        return parts.join(' و')
    }

    const intPart = Math.floor(n)
    const fracPart = Math.round((n - intPart) * 1000)

    const segments = []
    const millions = Math.floor(intPart / 1000000)
    const thousands = Math.floor((intPart % 1000000) / 1000)
    const remainder = intPart % 1000

    if (millions > 0) {
        if (millions === 1) segments.push('مليون')
        else if (millions === 2) segments.push('مليونان')
        else if (millions >= 3 && millions <= 10) segments.push(`${ones[millions]} ملايين`)
        else segments.push(`${convertBelowThousand(millions)} مليون`)
    }

    if (thousands > 0) {
        if (thousands === 1) segments.push('ألف')
        else if (thousands === 2) segments.push('ألفان')
        else if (thousands >= 3 && thousands <= 10) segments.push(`${ones[thousands]} آلاف`)
        else segments.push(`${convertBelowThousand(thousands)} ألف`)
    }

    if (remainder > 0) {
        segments.push(convertBelowThousand(remainder))
    }

    let result = ''
    if (segments.length > 0) {
        result = `فقط ${segments.join(' و')} دينار ليبي`
    }

    if (fracPart > 0) {
        result += `${result ? ' و' : 'فقط '}${fracPart} درهم`
    }

    return `${result} لا غير`
}

const METHOD_MAP = {
    cash: 'نقدي (Cash)',
    bank: 'تحويل بنكي (Bank Transfer)',
    transfer: 'تحويل بنكي (Bank Transfer)',
    check: 'شيك مصرفي (Check)',
    split: 'دفع مختلط (Split Payment)',
    wallet: 'محفظة العميل (Wallet)',
}

/**
 * توحيد بيانات السند من مختلف الشاشات (سندات القبض، سندات الدفع، سداد الموردين، الخزينة، المصروفات، كشوف الحساب)
 */
export function normalizeVoucherData(voucher) {
    if (!voucher) return null

    // تحديد نوع السند: قبض (receipt) أم صرف (payment)
    const isReceipt = Boolean(
        voucher.voucherType === 'receipt' ||
        voucher.type === 'receipt' ||
        voucher.type === 'income' ||
        voucher.flow === 'in' ||
        (!voucher.voucherType &&
            !voucher.type &&
            !voucher.flow &&
            !voucher.beneficiaryType &&
            !voucher.supplier &&
            !voucher.category &&
            (voucher.allocations !== undefined || voucher.customer))
    )

    const amount = Number(
        voucher.amount ??
        (isReceipt ? (voucher.credit || voucher.debit || 0) : (voucher.debit || voucher.credit || 0))
    )

    const rawId = voucher._id || voucher.id || ''
    const shortId = rawId ? String(rawId).slice(-6).toUpperCase() : '000001'
    const voucherNumber =
        voucher.number ||
        voucher.ref ||
        `${isReceipt ? 'RV' : 'PV'}-${shortId}`

    const voucherDate = voucher.date || voucher.createdAt || new Date()

    // بيانات الطرف (العميل / المورد / المستفيد)
    const customerObj = typeof voucher.customer === 'object' && voucher.customer ? voucher.customer : null
    const supplierObj = typeof voucher.supplier === 'object' && voucher.supplier ? voucher.supplier : null

    const partyName =
        voucher.partyName ||
        (isReceipt
            ? (customerObj?.name || voucher.customerName || voucher.beneficiary || 'عميل')
            : (supplierObj?.name || customerObj?.name || voucher.supplierName || voucher.beneficiary || voucher.category?.name || 'مستفيد'))

    const partyCode =
        voucher.partyCode ||
        customerObj?.code ||
        supplierObj?.code ||
        ''

    const partyPhone =
        voucher.partyPhone ||
        customerObj?.phone ||
        supplierObj?.phone ||
        ''

    const partyTypeLabel = isReceipt
        ? 'عميل'
        : voucher.beneficiaryType === 'supplier' || supplierObj
            ? 'مورد'
            : voucher.beneficiaryType === 'customer' || customerObj
                ? 'عميل'
                : voucher.beneficiaryType === 'expense' || voucher.category
                    ? 'مصروفات'
                    : 'مستفيد'

    // الخزينة وطريقة الدفع
    const treasuryObj = typeof voucher.treasury === 'object' && voucher.treasury ? voucher.treasury : null
    const treasuryName =
        voucher.treasuryName ||
        treasuryObj?.name ||
        (typeof voucher.treasury === 'string' && !/^[0-9a-fA-F]{24}$/.test(voucher.treasury) ? voucher.treasury : '')

    const rawMethod =
        voucher.method ||
        (treasuryObj?.type === 'bank' ? 'bank' : 'cash')
    const paymentMethodLabel = METHOD_MAP[rawMethod] || rawMethod || 'نقدي'

    // البيان ("وذلك عن")
    let description =
        voucher.note ||
        voucher.description ||
        voucher.desc ||
        ''

    if (!description) {
        if (isReceipt) {
            description = 'دفعة نقدية / تحصيل من حساب العميل'
        } else if (voucher.category?.name) {
            description = `سداد مصروفات (${voucher.category.name})`
        } else if (supplierObj || voucher.beneficiaryType === 'supplier') {
            description = 'دفعة مسددة من حساب المورد'
        } else {
            description = 'سند صرف مالي'
        }
    }

    // حساب الرصيد السابق والمتبقي إن توفر
    let remainingBalance = null
    let previousBalance = null

    if (voucher.remainingBalance !== undefined && voucher.remainingBalance !== null) {
        remainingBalance = Number(voucher.remainingBalance)
    } else if (voucher.runningBalance !== undefined && voucher.runningBalance !== null) {
        remainingBalance = Number(voucher.runningBalance)
    } else if (isReceipt && customerObj && customerObj.balance !== undefined) {
        remainingBalance = Number(customerObj.balance)
    } else if (!isReceipt && supplierObj && supplierObj.balance !== undefined) {
        remainingBalance = Number(supplierObj.balance)
    } else if (!isReceipt && customerObj && customerObj.balance !== undefined) {
        remainingBalance = Number(customerObj.balance)
    }

    if (voucher.previousBalance !== undefined && voucher.previousBalance !== null) {
        previousBalance = Number(voucher.previousBalance)
    } else if (remainingBalance !== null && !isNaN(remainingBalance)) {
        // في حالة سند القبض من عميل أو سند الصرف لمورد: الرصيد قبل الدفعة = الرصيد المتبقي + مبلغ الدفعة
        if (isReceipt || supplierObj || voucher.beneficiaryType === 'supplier') {
            previousBalance = remainingBalance + amount
        }
    }

    const allocations = Array.isArray(voucher.allocations) ? voucher.allocations : []
    const splitDetails = Array.isArray(voucher.splitDetails) ? voucher.splitDetails : []

    return {
        isReceipt,
        titleAr: isReceipt ? 'سند قبض' : 'سند صرف',
        titleEn: isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER',
        partyPrefix: isReceipt ? 'استلمنا من السيد / السادة:' : 'يصرف للسيد / السادة:',
        voucherNumber,
        voucherDate,
        amount,
        amountInWords: numberToArabicWords(amount),
        partyName,
        partyCode,
        partyPhone,
        partyTypeLabel,
        paymentMethodLabel,
        treasuryName,
        description,
        previousBalance,
        remainingBalance,
        allocations,
        splitDetails,
        status: voucher.status,
    }
}

/**
 * VoucherPrintTemplate - القالب الورقي لسند القبض / الصرف
 */
export function VoucherPrintTemplate({ voucher, printRef }) {
    const { settings } = useSettings()
    const data = normalizeVoucherData(voucher)

    if (!data) return null

    const show = (key) => settings?.[key] !== false
    const formattedDate = new Date(data.voucherDate).toLocaleDateString('ar-LY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
    const formattedTime = new Date(data.voucherDate).toLocaleTimeString('ar-LY', {
        hour: '2-digit',
        minute: '2-digit',
    })

    const hasBalanceInfo =
        data.remainingBalance !== null &&
        !isNaN(data.remainingBalance)

    return (
        <div
            id="voucher-print-sheet"
            ref={printRef}
            dir="rtl"
            className="bg-white text-slate-900 font-sans w-full max-w-[210mm] mx-auto p-6 sm:p-8 border border-slate-300 rounded-xl print:border-2 print:border-slate-900 print:rounded-none print:shadow-none"
        >
            {/* ── 1. الترويسة (Header) بنفس الهوية البصرية للفواتير ── */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4 mb-5">
                {/* يمين الترويسة: الشعار وبيانات الشركة */}
                <div className="flex items-start gap-4">
                    {show('print_showLogo') && settings?.logo && (
                        <img
                            src={settings.logo}
                            alt="Logo"
                            className="h-16 w-auto max-w-[130px] object-contain shrink-0"
                        />
                    )}
                    <div>
                        {show('print_showCompanyName') && (
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1">
                                {settings?.companyName || settings?.name || 'اسم الشركة / المتجر'}
                            </h1>
                        )}
                        <div className="text-xs text-slate-600 space-y-0.5 font-medium">
                            {show('print_showAddress') && (settings?.address || settings?.companyAddress) && (
                                <p>العنوان: {settings?.address || settings?.companyAddress}</p>
                            )}
                            {show('print_showPhone') && (settings?.phone || settings?.companyPhone) && (
                                <p>هاتف: <span className="font-mono">{settings?.phone || settings?.companyPhone}</span></p>
                            )}
                            {show('print_showEmail') && settings?.email && (
                                <p>البريد الإلكتروني: <span className="font-mono">{settings.email}</span></p>
                            )}
                            {show('print_showWebsite') && settings?.website && (
                                <p>الموقع الإلكتروني: <span className="font-mono">{settings.website}</span></p>
                            )}
                            {show('print_showCommercialRegister') && settings?.commercialRegister && (
                                <p>سجل تجاري: <span className="font-mono">{settings.commercialRegister}</span></p>
                            )}
                        </div>
                    </div>
                </div>

                {/* يسار الترويسة: نوع السند ورقمه والتاريخ */}
                <div className="text-left shrink-0">
                    <div
                        className={`inline-block px-4 py-1.5 rounded-lg border-2 font-black text-lg tracking-wide ${
                            data.isReceipt
                                ? 'bg-emerald-50 border-emerald-700 text-emerald-900'
                                : 'bg-rose-50 border-rose-700 text-rose-900'
                        }`}
                    >
                        {data.titleAr}
                    </div>
                    <div className="text-[10px] font-mono font-bold text-slate-500 tracking-widest mt-0.5">
                        {data.titleEn}
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs">
                        <div className="font-mono font-bold text-slate-900">
                            رقم السند: <span className="underline">{data.voucherNumber}</span>
                        </div>
                        <div className="font-mono text-slate-600">
                            التاريخ: {formattedDate} — {formattedTime}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 2. إطار المبلغ البارز (Prominent Amount Box) ── */}
            <div className="flex flex-col sm:flex-row items-stretch justify-between gap-3 mb-5">
                <div
                    className={`flex items-center justify-between gap-4 px-5 py-3 rounded-xl border-2 ${
                        data.isReceipt
                            ? 'bg-emerald-50/60 border-emerald-800 text-emerald-950'
                            : 'bg-rose-50/60 border-rose-800 text-rose-950'
                    } min-w-[240px]`}
                >
                    <span className="text-xs font-bold text-slate-700">المبلغ الإجمالي:</span>
                    <div className="text-2xl font-black font-mono tracking-tight">
                        {formatCurrency(data.amount)}
                    </div>
                </div>

                <div className="flex-1 flex items-center px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs">
                    <span className="font-bold text-slate-500 ml-2 shrink-0">مبلغ وقدره:</span>
                    <span className="font-bold text-slate-900">{data.amountInWords}</span>
                </div>
            </div>

            {/* ── 3. جسم السند وتفاصيل العملية (Voucher Body) ── */}
            <div className="border border-slate-300 rounded-xl overflow-hidden mb-5 divide-y divide-slate-200 text-xs sm:text-sm">
                {/* السطر الأول: استلمنا من / يصرف لـ */}
                <div className="p-3.5 bg-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600 min-w-[165px]">{data.partyPrefix}</span>
                        <span className="font-black text-base text-slate-900">{data.partyName}</span>
                        {data.partyCode && (
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                كود: {data.partyCode}
                            </span>
                        )}
                    </div>
                    {data.partyPhone && (
                        <div className="text-xs text-slate-600 font-mono">
                            هاتف: {data.partyPhone}
                        </div>
                    )}
                </div>

                {/* السطر الثاني: طريقة الدفع والخزينة */}
                <div className="p-3.5 bg-slate-50/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600 min-w-[110px]">طريقة الدفع:</span>
                        <span className="font-bold text-slate-900">{data.paymentMethodLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-600 min-w-[110px]">الخزينة / الحساب:</span>
                        <span className="font-bold text-slate-900">{data.treasuryName || 'الخزينة المعتمدة'}</span>
                    </div>
                </div>

                {/* تفاصيل الدفع المختلط إن وجدت */}
                {data.splitDetails.length > 0 && (
                    <div className="p-3 bg-white">
                        <span className="text-xs font-bold text-slate-500 block mb-1.5">تفاصيل الدفعات المجزأة:</span>
                        <div className="flex flex-wrap gap-2">
                            {data.splitDetails.map((s, idx) => (
                                <span
                                    key={idx}
                                    className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs font-mono font-bold text-slate-800"
                                >
                                    {METHOD_MAP[s.method] || s.method}: {formatCurrency(s.amount)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* السطر الثالث: وذلك عن (البيان) */}
                <div className="p-3.5 bg-white">
                    <div className="flex items-start gap-2">
                        <span className="font-bold text-slate-600 min-w-[110px] shrink-0">وذلك عن:</span>
                        <div className="font-semibold text-slate-900 leading-relaxed">
                            {data.description}
                            {data.allocations.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    <span className="text-xs text-slate-500 font-bold">الفواتير المسددة:</span>
                                    {data.allocations.map((a, i) => {
                                        const invNum = a.invoice?.number || (a.invoice?._id ? `#${String(a.invoice._id).slice(-6).toUpperCase()}` : `#${i + 1}`)
                                        return (
                                            <span
                                                key={i}
                                                className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[11px] font-mono text-slate-800"
                                            >
                                                {invNum} ({formatCurrency(a.amount)})
                                            </span>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 4. ملخص رصيد الحساب (إذا كان مرتبطاً بعميل أو مورد) ── */}
            {hasBalanceInfo && (
                <div className="mb-6 p-3.5 bg-slate-50 border border-slate-300 rounded-xl">
                    <div className="text-xs font-bold text-slate-600 mb-2">
                        ملخص رصيد الحساب ({data.partyTypeLabel}: {data.partyName}):
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                        {data.previousBalance !== null && !isNaN(data.previousBalance) && (
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                                <span className="text-slate-500 block mb-0.5">الرصيد السابق:</span>
                                <span className="font-mono font-bold text-sm text-slate-800">
                                    {formatCurrency(Math.abs(data.previousBalance))}
                                </span>
                            </div>
                        )}
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                            <span className="text-slate-500 block mb-0.5">
                                {data.isReceipt ? 'المبلغ المقبوض:' : 'المبلغ المدفوع:'}
                            </span>
                            <span className="font-mono font-bold text-sm text-slate-900">
                                {formatCurrency(data.amount)}
                            </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-300">
                            <span className="text-slate-600 font-bold block mb-0.5">الرصيد المتبقي:</span>
                            <span className="font-mono font-black text-sm text-slate-900">
                                {formatCurrency(Math.abs(data.remainingBalance))}
                            </span>
                            <span className="mr-1.5 text-[10px] text-slate-500 font-bold">
                                ({data.remainingBalance === 0
                                    ? 'خالص / متصفي'
                                    : data.remainingBalance > 0
                                        ? (data.partyTypeLabel === 'مورد' ? 'مستحق للمورد' : 'مستحق على العميل')
                                        : (data.partyTypeLabel === 'مورد' ? 'دفعة مقدمة لنا' : 'رصيد دائن للعميل')})
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── 5. التوقيعات والختم (Signatures & Footer) — تظهر في سندات الصرف فقط وتُستبعد من سندات القبض ── */}
            {!data.isReceipt && (
                <div className="grid grid-cols-2 gap-8 pt-6 mt-4 border-t border-slate-300 text-xs font-bold text-slate-700">
                    <div className="text-center">
                        <p className="mb-10">توقيع المستلم</p>
                        <div className="w-48 mx-auto border-t border-slate-400 pt-1.5 text-[11px] text-slate-500 font-normal">
                            الاسم والتوقيع
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="mb-10">المحاسب / الختم</p>
                        <div className="w-48 mx-auto border-t border-slate-400 pt-1.5 text-[11px] text-slate-500 font-normal">
                            التوقيع والختم الرسمي
                        </div>
                    </div>
                </div>
            )}

            {/* ── 6. تذييل معلومات التواصل ── */}
            <div className="mt-6 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                <span>{show('print_showThankYou') ? (settings?.thankYouMessage || 'شكراً لتعاملكم معنا') : ''}</span>
                <div className="flex items-center gap-3 font-mono">
                    {show('print_showEmail') && settings?.email && <span>{settings.email}</span>}
                    {show('print_showEmail') && settings?.email && show('print_showWebsite') && settings?.website && <span>|</span>}
                    {show('print_showWebsite') && settings?.website && <span>{settings.website}</span>}
                </div>
            </div>
        </div>
    )
}

/**
 * VoucherPrintModal - نافذة معاينة وطباعة سند القبض / الصرف
 */
export default function VoucherPrintModal({ voucher, isOpen = true, onClose }) {
    const printRef = useRef(null)

    if (!isOpen || !voucher) return null

    const data = normalizeVoucherData(voucher)

    const handlePrint = () => {
        window.print()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* شريط أدوات النافذة (يختفي عند الطباعة) */}
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 print:hidden shrink-0">
                    <div className="flex items-center gap-2.5 font-bold text-sm text-slate-800 dark:text-slate-100">
                        <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                                data.isReceipt ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                        >
                            {data.isReceipt ? <Receipt size={17} /> : <ArrowUpRight size={17} />}
                        </div>
                        <div>
                            <div className="font-black text-sm">
                                معاينة طباعة {data.titleAr} ({data.voucherNumber})
                            </div>
                            <div className="text-[11px] text-slate-500 font-normal">
                                جاهز للطباعة الرسمية على ورق A4 / A5
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className={`px-4 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 ${
                                data.isReceipt
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-rose-600 hover:bg-rose-700'
                            }`}
                        >
                            <Printer size={15} />
                            <span>طباعة السند الآن</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                            title="إغلاق"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* محتوى السند القابل للطباعة */}
                <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100/70 dark:bg-slate-950/50 print:p-0 print:bg-white print:overflow-visible">
                    <VoucherPrintTemplate voucher={voucher} printRef={printRef} />
                </div>
            </div>

            {/* قواعد عزل الطباعة (@media print) لضمان طباعة السند فقط بنظافة تامة */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #voucher-print-sheet,
                    #voucher-print-sheet * {
                        visibility: visible !important;
                    }
                    #voucher-print-sheet {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                        max-width: 210mm !important;
                        margin: 0 auto !important;
                        padding: 12mm !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                        box-shadow: none !important;
                        z-index: 99999 !important;
                    }
                    @page {
                        size: A4;
                        margin: 8mm;
                    }
                }
            `}</style>
        </div>
    )
}

export { VoucherPrintModal }

