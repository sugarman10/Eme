import React from 'react'
import { formatCurrency } from '../../lib/utils'
import { INVOICE_TYPES } from '../../constants/posConstants'
import { useSettings } from '../../context/SettingsContext'

/**
 * InvoicePrintTemplate - A4 Print Template
 * 
 * Professional invoice/quotation print layout
 * Optimized for A4 paper size
 * Uses ALL granular print settings from SettingsContext
 */
export const InvoicePrintTemplate = ({ invoice, printRef }) => {
    const { settings } = useSettings()

    if (!invoice) return null

    const isProforma =
        invoice.invoiceType === INVOICE_TYPES.PROFORMA ||
        invoice.type === 'quotation' ||
        invoice.type === 'proforma'

    const customer = invoice.customer
    const customerName =
        invoice.customerName ||
        (customer && customer.name) ||
        (typeof customer === 'string' ? customer : 'عميل نقدي')

    const invoiceNumber =
        invoice.number ||
        invoice.invoiceNumber ||
        (invoice._id ? String(invoice._id).slice(-6) : '')

    const invoiceDate = invoice.date || invoice.createdAt || new Date()
    const items = invoice.items || []

    const subtotal =
        invoice.totals?.subtotal ??
        items.reduce((acc, item) => acc + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0)

    const discount =
        invoice.totals?.discount ??
        invoice.discountValue ??
        invoice.discount ??
        0

    const grandTotal =
        invoice.totals?.total ??
        invoice.totals?.grand ??
        Math.max(0, subtotal - discount)

    const paidAmount =
        invoice.totals?.paid ??
        invoice.paid ??
        0

    const changeAmount =
        invoice.totals?.change ??
        Math.max(0, paidAmount - grandTotal)

    const remainingAmount =
        invoice.totals?.remaining ??
        Math.max(0, grandTotal - paidAmount)

    // Helper to check print settings (defaults to true if not set)
    const show = (key) => settings?.[key] !== false

    return (
        <div className="fixed top-0 left-0 w-full invisible print:visible print:z-9999">
            <div
                id="receipt-print"
                ref={printRef}
                className="bg-white text-black font-sans w-full max-w-[210mm] mx-auto min-h-[297mm] flex flex-col p-8"
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
                    <div className="flex items-start gap-4">
                        {/* Logo */}
                        {show('print_showLogo') && settings?.logo && (
                            <img
                                src={settings.logo}
                                alt="Logo"
                                className="h-16 w-auto max-w-[140px] object-contain shrink-0"
                            />
                        )}

                        <div>
                            {/* Company Name */}
                            {show('print_showCompanyName') && (
                                <h1 className="text-2xl font-black text-slate-900 mb-1">
                                    {settings?.companyName || 'اسم المتجر'}
                                </h1>
                            )}

                            <div className="text-xs text-slate-600 space-y-0.5 font-medium">
                                {/* Address */}
                                {show('print_showAddress') && settings?.address && (
                                    <p>العنوان: {settings.address}</p>
                                )}

                                {/* Phone */}
                                {show('print_showPhone') && settings?.phone && (
                                    <p>هاتف: {settings.phone}</p>
                                )}

                                {/* Email */}
                                {show('print_showEmail') && settings?.email && (
                                    <p>البريد الإلكتروني: <span className="font-mono">{settings.email}</span></p>
                                )}

                                {/* Website */}
                                {show('print_showWebsite') && settings?.website && (
                                    <p>الموقع الإلكتروني: <span className="font-mono">{settings.website}</span></p>
                                )}

                                {/* Commercial Register */}
                                {show('print_showCommercialRegister') && settings?.commercialRegister && (
                                    <p>سجل تجاري: {settings.commercialRegister}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="text-left">
                        <h2 className={`text-xl font-bold uppercase tracking-wider ${isProforma ? 'text-amber-600' : 'text-slate-400'}`}>
                            {isProforma ? 'عرض سعر' : 'فاتورة مبيعات'}
                        </h2>

                        {/* Invoice Number */}
                        {show('print_showInvoiceNumber') && invoiceNumber && (
                            <p className="text-lg font-bold mt-1 font-mono text-slate-900">#{invoiceNumber}</p>
                        )}
                    </div>
                </div>

                {/* Invoice Info */}
                <div className="flex justify-between mb-6 text-xs">
                    <div className="flex-1">
                        {/* Customer Info */}
                        {((customer && (show('print_showCustomerPhone') || show('print_showCustomerAddress'))) || (show('print_showCustomerName') && customerName)) ? (
                            <>
                                {show('print_showCustomerName') && customerName && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-500 w-12">العميل:</span>
                                        <span className="font-bold text-slate-900 text-sm">
                                            {customerName}
                                        </span>
                                    </div>
                                )}

                                {show('print_showCustomerPhone') && customer?.phone && (
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-500 w-12">الهاتف:</span>
                                        <span className="font-mono text-slate-700">
                                            {customer.phone}
                                        </span>
                                    </div>
                                )}

                                {show('print_showCustomerAddress') && customer?.address && (
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-500 w-12">العنوان:</span>
                                        <span className="text-slate-700">
                                            {customer.address}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="h-8"></div>
                        )}
                    </div>

                    {/* Date/Time */}
                    {show('print_showDateTime') && (
                        <div className="flex gap-8 text-left">
                            <div>
                                <span className="block font-bold text-slate-400 mb-0.5">التاريخ</span>
                                <span className="font-bold text-slate-900">
                                    {new Date(invoiceDate).toLocaleDateString('ar-LY')}
                                </span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-400 mb-0.5">الوقت</span>
                                <span className="font-bold text-slate-900 font-mono">
                                    {new Date(invoiceDate).toLocaleTimeString('ar-LY', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Items Table */}
                <div className="flex-1">
                    <table className="w-full text-right mb-4 border-collapse border border-slate-900/10">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-900 text-xs uppercase tracking-tight">
                                {show('print_showRowNumber') && (
                                    <th className="py-1.5 px-2 text-center border-l border-slate-200 w-8 font-black text-slate-700">#</th>
                                )}
                                {show('print_showItemCode') && (
                                    <th className="py-1.5 px-2 text-right border-l border-slate-200 font-black text-slate-700 w-32">الكود</th>
                                )}
                                {show('print_showItemName') && (
                                    <th className="py-1.5 px-2 text-right border-l border-slate-200 font-black text-slate-700">الصنف</th>
                                )}
                                {show('print_showQuantity') && (
                                    <th className="py-1.5 px-2 text-center border-l border-slate-200 font-black text-slate-700 w-16">الكمية</th>
                                )}
                                {show('print_showUnitPrice') && (
                                    <th className="py-1.5 px-2 text-center border-l border-slate-200 font-black text-slate-700 w-24">السعر</th>
                                )}
                                {show('print_showItemTotal') && (
                                    <th className="py-1.5 px-2 text-left font-black text-slate-700 w-24">الإجمالي</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="text-[11px] leading-tight">
                            {items.map((item, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                                    {show('print_showRowNumber') && (
                                        <td className="py-1 px-2 text-center border-l border-slate-100 font-mono text-slate-400">
                                            {i + 1}
                                        </td>
                                    )}
                                    {show('print_showItemCode') && (
                                        <td className="py-1 px-2 font-mono text-slate-600 border-l border-slate-100">
                                            {(item.isCustom || item.sku === 'حر') ? '-' : (item.sku || item.item?.sku || '-')}
                                        </td>
                                    )}
                                    {show('print_showItemName') && (
                                        <td className="py-1 px-2 font-bold text-slate-800 border-l border-slate-100">
                                            <div className="flex items-center gap-1.5">
                                                <span>{item.name || item.item?.name}</span>
                                                {(item.isCustom || item.sku === 'حر') && (
                                                    <span className="print:hidden text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">
                                                        صنف حر
                                                    </span>
                                                )}
                                            </div>
                                            {item.isBundle && item.bundleComponents?.length > 0 && (
                                                <div className="mt-1 mr-2 p-1.5 bg-slate-50 border border-slate-200/80 rounded text-[10px] text-slate-600 font-normal space-y-0.5">
                                                    <div className="text-[10px] font-bold text-slate-700">
                                                        مكونات التجميعة (للضمان):
                                                    </div>
                                                    {item.bundleComponents.map((comp, ci) => (
                                                        <div key={ci} className="flex items-center gap-1 text-slate-700 mr-1.5">
                                                            <span>•</span>
                                                            <span className="font-medium">{comp.name || comp.item?.name}</span>
                                                            <span className="font-mono text-slate-500 font-bold">({comp.qty}x)</span>
                                                            {comp.serials && comp.serials.length > 0 && (
                                                                <span className="text-slate-500 font-mono text-[9px] mr-1.5 bg-white px-1 border border-slate-200 rounded">
                                                                    S/N: {comp.serials.join(', ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    )}
                                    {show('print_showQuantity') && (
                                        <td className="py-1 px-2 text-center font-mono font-bold text-slate-700 border-l border-slate-100">
                                            {item.qty}
                                        </td>
                                    )}
                                    {show('print_showUnitPrice') && (
                                        <td className="py-1 px-2 text-center font-mono text-slate-600 border-l border-slate-100">
                                            {formatCurrency(item.price)}
                                        </td>
                                    )}
                                    {show('print_showItemTotal') && (
                                        <td className="py-1 px-2 text-left font-bold font-mono text-slate-900">
                                            {formatCurrency(item.total !== undefined ? item.total : item.qty * item.price)}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Totals */}
                <div className="mt-4 pt-4 border-t-2 border-slate-900 flex justify-end">
                    <div className="w-64 flex flex-col gap-1.5 text-xs">
                        {/* Subtotal */}
                        {show('print_showSubtotal') && (
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">المجموع الفرعي:</span>
                                <span className="font-mono font-bold text-slate-800">
                                    {formatCurrency(subtotal)}
                                </span>
                            </div>
                        )}

                        {/* Discount */}
                        {show('print_showDiscount') && discount > 0 && (
                            <div className="flex justify-between items-center text-red-600">
                                <span className="font-medium">خصم:</span>
                                <span className="font-mono font-bold">-{formatCurrency(discount)}</span>
                            </div>
                        )}

                        <div className="my-1 border-t border-slate-200"></div>

                        {/* Grand Total */}
                        {show('print_showGrandTotal') && (
                            <div className="flex justify-between items-center text-lg font-black text-slate-900">
                                <span>الإجمالي:</span>
                                <span className="font-mono">{formatCurrency(grandTotal)}</span>
                            </div>
                        )}

                        {!isProforma && (
                            <>
                                {/* Paid Amount */}
                                {show('print_showPaidAmount') && (
                                    <div className="flex justify-between items-center text-slate-500 mt-1">
                                        <span>المدفوع:</span>
                                        <span className="font-mono font-bold text-slate-700">
                                            {formatCurrency(paidAmount)}
                                        </span>
                                    </div>
                                )}

                                {/* Remaining Amount / Change */}
                                {show('print_showRemainingAmount') && changeAmount > 0 && (
                                    <div className="flex justify-between items-center text-emerald-700 font-bold">
                                        <span>الباقي (فكة):</span>
                                        <span className="font-mono">{formatCurrency(changeAmount)}</span>
                                    </div>
                                )}

                                {/* Credit Sale Remaining Debt (Local Currency) */}
                                {(invoice.paymentMethod === 'credit' || remainingAmount > 0) && (
                                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900">
                                        <div className="font-bold flex justify-between items-center">
                                            <span>الرصيد الآجل المقيد بالذمة:</span>
                                            <span className="font-mono text-xs font-black text-rose-700">
                                                {formatCurrency(remainingAmount)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Proforma Terms & Conditions */}
                {isProforma && (
                    <div className="mt-6 border-t border-slate-200 pt-4 text-[11px] text-slate-600 space-y-1.5">
                        <p className="font-bold text-slate-800">الشروط والأحكام:</p>
                        <p>1. {invoice.note && !invoice.note.startsWith('POS Sale') ? invoice.note : 'عرض السعر صالح لمدة 15 يوماً من تاريخ الإصدار.'}</p>
                        <p>2. يتم اعتماد البيع رسمياً بإصدار فاتورة مبيعات معتمدة وسند تحصيل.</p>

                        <div className="pt-8 text-xs font-bold text-slate-600 flex justify-start">
                            <div className="w-48 text-center">
                                <p className="border-t border-slate-300 pt-2">توقيع المسؤول / الختم</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Note */}
                <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                    {/* Thank You Message */}
                    {show('print_showThankYouMessage') && (
                        <span>{settings?.thankYouMessage || 'شكراً لتعاملكم معنا'}</span>
                    )}

                    {(settings?.email || settings?.website) && (
                        <div className="flex items-center gap-3 font-mono text-slate-500">
                            {settings?.email && <span>{settings.email}</span>}
                            {settings?.email && settings?.website && <span>|</span>}
                            {settings?.website && <span>{settings.website}</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
