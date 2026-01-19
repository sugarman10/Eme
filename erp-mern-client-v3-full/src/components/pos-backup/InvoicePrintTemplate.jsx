import React from 'react'
import { formatCurrency } from '../../lib/utils'
import { INVOICE_TYPES } from '../../constants/posConstants'

/**
 * InvoicePrintTemplate - A4 Print Template
 * 
 * Professional invoice/quotation print layout
 * Optimized for A4 paper size
 */
export const InvoicePrintTemplate = ({ invoice, printRef }) => {
    if (!invoice) return null

    const isProforma = invoice.invoiceType === INVOICE_TYPES.PROFORMA
    const customer = invoice.customer // ✅ Get customer from invoice data

    return (
        <div className="fixed top-0 left-0 w-full invisible print:visible print:z-9999">
            <div
                id="receipt-print"
                ref={printRef}
                className="bg-white text-black font-sans w-full max-w-[210mm] mx-auto min-h-[297mm] flex flex-col p-8"
            >
                {/* Header */}
                <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 mb-1">اسم المتجر</h1>
                        <div className="text-xs text-slate-600 space-y-0.5 font-medium">
                            <p>العنوان: شارع المتجر، المدينة</p>
                            <p>هاتف: 0123456789</p>
                        </div>
                    </div>
                    <div className="text-left">
                        <h2 className={`text-xl font-bold uppercase tracking-wider ${isProforma ? 'text-amber-600' : 'text-slate-400'
                            }`}>
                            {isProforma ? 'عرض سعر' : 'فاتورة مبيعات'}
                        </h2>
                        <p className="text-lg font-bold mt-1 font-mono text-slate-900">#{invoice.number}</p>
                    </div>
                </div>

                {/* Invoice Info */}
                <div className="flex justify-between mb-6 text-xs">
                    <div className="flex-1">
                        {/* ✅ Show customer info for wholesale customers */}
                        {customer && customer.type === 'wholesale' ? (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-500 w-12">العميل:</span>
                                    <span className="font-bold text-slate-900 text-sm">
                                        {customer.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-500 w-12">الهاتف:</span>
                                    <span className="font-mono text-slate-700">
                                        {customer.phone || '-'}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="h-8"></div>
                        )}
                    </div>
                    <div className="flex gap-8 text-left">
                        <div>
                            <span className="block font-bold text-slate-400 mb-0.5">التاريخ</span>
                            <span className="font-bold text-slate-900">
                                {new Date(invoice.date).toLocaleDateString('ar-LY')}
                            </span>
                        </div>
                        <div>
                            <span className="block font-bold text-slate-400 mb-0.5">الوقت</span>
                            <span className="font-bold text-slate-900 font-mono">
                                {new Date(invoice.date).toLocaleTimeString('ar-LY', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="flex-1">
                    <table className="w-full text-right mb-4 border-collapse border border-slate-900/10">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-900 text-xs uppercase tracking-tight">
                                <th className="py-1.5 px-2 text-center border-l border-slate-200 w-8 font-black text-slate-700">#</th>
                                <th className="py-1.5 px-2 text-right border-l border-slate-200 font-black text-slate-700 w-32">الكود</th>
                                <th className="py-1.5 px-2 text-right border-l border-slate-200 font-black text-slate-700">الصنف</th>
                                <th className="py-1.5 px-2 text-center border-l border-slate-200 font-black text-slate-700 w-16">الكمية</th>
                                <th className="py-1.5 px-2 text-center border-l border-slate-200 font-black text-slate-700 w-24">السعر</th>
                                <th className="py-1.5 px-2 text-left font-black text-slate-700 w-24">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody className="text-[11px] leading-tight">
                            {invoice.items.map((item, i) => (
                                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                                    <td className="py-1 px-2 text-center border-l border-slate-100 font-mono text-slate-400">
                                        {i + 1}
                                    </td>
                                    <td className="py-1 px-2 font-mono text-slate-600 border-l border-slate-100">
                                        {item.sku || '-'}
                                    </td>
                                    <td className="py-1 px-2 font-bold text-slate-800 border-l border-slate-100">
                                        {item.name}
                                    </td>
                                    <td className="py-1 px-2 text-center font-mono font-bold text-slate-700 border-l border-slate-100">
                                        {item.qty}
                                    </td>
                                    <td className="py-1 px-2 text-center font-mono text-slate-600 border-l border-slate-100">
                                        {formatCurrency(item.price)}
                                    </td>
                                    <td className="py-1 px-2 text-left font-bold font-mono text-slate-900">
                                        {formatCurrency(item.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Totals */}
                <div className="mt-4 pt-4 border-t-2 border-slate-900 flex justify-end">
                    <div className="w-64 flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">المجموع الفرعي:</span>
                            <span className="font-mono font-bold text-slate-800">
                                {formatCurrency(invoice.totals.subtotal)}
                            </span>
                        </div>

                        {invoice.totals.discount > 0 && (
                            <div className="flex justify-between items-center text-red-600">
                                <span className="font-medium">خصم:</span>
                                <span className="font-mono font-bold">-{formatCurrency(invoice.totals.discount)}</span>
                            </div>
                        )}

                        <div className="my-1 border-t border-slate-200"></div>

                        <div className="flex justify-between items-center text-lg font-black text-slate-900">
                            <span>الإجمالي:</span>
                            <span className="font-mono">{formatCurrency(invoice.totals.total)}</span>
                        </div>

                        {!isProforma && (
                            <>
                                <div className="flex justify-between items-center text-slate-500 mt-1">
                                    <span>المدفوع:</span>
                                    <span className="font-mono font-bold text-slate-700">
                                        {formatCurrency(invoice.totals.paid)}
                                    </span>
                                </div>

                                {invoice.totals.change > 0 && (
                                    <div className="flex justify-between items-center text-emerald-700 font-bold">
                                        <span>المتبقي:</span>
                                        <span className="font-mono">{formatCurrency(invoice.totals.change)}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer Note */}
                <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                    <span>شكراً لتعاملكم معنا</span>
                    {isProforma && (
                        <span className="text-amber-600 font-bold">* عرض السعر غير ملزم وصالح لمدة 30 يوم</span>
                    )}
                </div>
            </div>
        </div>
    )
}
