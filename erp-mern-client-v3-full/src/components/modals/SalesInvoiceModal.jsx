import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Trash2, Search, X, Split, Receipt, AlertTriangle, RefreshCw } from 'lucide-react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

import { TreasurySelector } from '../TreasurySelector'
import { formatCurrency } from '../../lib/utils'
import { SpreadsheetSales } from '../sales/SpreadsheetSales'

export default function SalesInvoiceModal({ show, onClose, onSuccess, customers, warehouses, treasuries, items, stockMap }) {
    const { push } = useToast()
    const [loading, setLoading] = useState(false)
    const [customer, setCustomer] = useState('')
    const [warehouse, setWarehouse] = useState('')
    const [selectedTreasury, setSelectedTreasury] = useState('')
    const [note, setNote] = useState('')
    const [paidAmount, setPaidAmount] = useState(0)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [splitPayments, setSplitPayments] = useState([
        { method: 'cash', amount: 0, treasury: '' },
        { method: 'card', amount: 0, treasury: '' }
    ])
    const [rows, setRows] = useState([{ item: '', qty: 1, price: 0, searchTerm: '', showDropdown: false }])

    // ==========================================
    // SMART FEATURES STATE - Batch 2
    // ==========================================
    const [creditWarning, setCreditWarning] = useState(null) // { message, severity }
    const [previousCustomer, setPreviousCustomer] = useState('') // For price recalc tracking
    const [showRecalcDialog, setShowRecalcDialog] = useState(false)

    // Reset form when modal opens
    useEffect(() => {
        if (show) {
            setCustomer('')
            setCustomer('')
            setWarehouse('')
            setSelectedTreasury('')
            setNote('')
            setNote('')
            setPaidAmount(0)
            setPaymentMethod('cash')
            setSplitPayments([
                { method: 'cash', amount: 0, treasury: '' },
                { method: 'card', amount: 0, treasury: '' }
            ])
            setRows([{ item: '', qty: 1, price: 0, searchTerm: '', showDropdown: false }])
        }
    }, [show])

    const addRow = () => setRows([...rows, { item: '', qty: 1, price: 0, searchTerm: '', showDropdown: false }])
    const delRow = (i) => setRows(rows.filter((_, idx) => idx !== i))

    const updateRow = (index, field, value) => {
        setRows(rows.map((row, i) => i === index ? { ...row, [field]: value } : row))
    }

    // New handler for SpreadsheetSales - adds a new row with item data
    const handleSpreadsheetAdd = (rowData) => {
        setRows(prev => [...prev.filter(r => r.item), rowData])
    }

    const handleSearch = (index, term) => {
        setRows(rows.map((row, i) => i === index ? { ...row, searchTerm: term, showDropdown: true } : row))
    }

    const getAvailableStock = (item) => {
        if (!warehouse) return item.totalStock || 0

        // Robust V2 Check: Handle both populated objects and raw IDs
        // This prevents "0 Available" errors due to ObjectId vs String mismatch
        const stockEntry = item.stocks?.find(s =>
            (s.warehouse._id || s.warehouse).toString() === warehouse.toString()
        )

        return stockEntry ? stockEntry.qty : 0
    }

    const handleItemSelect = (index, item) => {
        // 1. Determine Price (Wholesale vs Retail)
        const selectedCustomer = customers.find(c => c._id === customer)
        const isWholesale = selectedCustomer?.type === 'wholesale'

        // Robust Price Detection Strategy
        let price = 0
        if (isWholesale) {
            price = item.wholesalePrice || item.price || 0
        } else {
            price = item.price || item.retailPrice || 0
        }

        // 2. Validate Price
        // Silent handling of zero prices in production

        // 3. Determine Cost (Crucial for Profit)
        const cost = Number(item.cost) || 0

        // 4. Update Row
        setRows(prev => prev.map((row, i) => i === index ? {
            ...row,
            item: item._id,
            price: Number(price),
            cost: cost,
            qty: 1,
            searchTerm: `${item.sku} — ${item.name}`,
            showDropdown: false
        } : row))
    }

    // ==========================================
    // SMART FEATURE 2: Real-Time Credit Limit Check
    // ==========================================
    useEffect(() => {
        if (!customer) {
            setCreditWarning(null)
            return
        }

        const selectedCustomer = customers.find(c => c._id === customer)
        if (!selectedCustomer || !selectedCustomer.creditLimit || selectedCustomer.creditLimit <= 0) {
            setCreditWarning(null)
            return
        }

        const invoiceTotal = rows.reduce((acc, row) => acc + (row.qty * row.price), 0)
        const deductedPaid = Math.max(0, invoiceTotal - (Number(paidAmount) || 0))
        const projectedBalance = (selectedCustomer.balance || 0) + deductedPaid

        if (projectedBalance > selectedCustomer.creditLimit) {
            const overage = projectedBalance - selectedCustomer.creditLimit
            setCreditWarning({
                message: `⚠️ تحذير: هذه الفاتورة ستتجاوز سقف الائتمان بـ ${overage.toFixed(2)} د.ل`,
                severity: 'error',
                details: {
                    currentBalance: selectedCustomer.balance || 0,
                    creditLimit: selectedCustomer.creditLimit,
                    invoiceRemaining: deductedPaid,
                    projectedBalance
                }
            })
        } else if (projectedBalance > selectedCustomer.creditLimit * 0.8) {
            // Warning at 80% threshold
            const utilization = Math.round((projectedBalance / selectedCustomer.creditLimit) * 100)
            setCreditWarning({
                message: `🟡 تنبيه: استخدام ${utilization}% من سقف الائتمان`,
                severity: 'warning',
                details: {
                    currentBalance: selectedCustomer.balance || 0,
                    creditLimit: selectedCustomer.creditLimit,
                    invoiceRemaining: deductedPaid,
                    projectedBalance
                }
            })
        } else {
            setCreditWarning(null)
        }
    }, [customer, rows, paidAmount, customers])

    // ==========================================
    // SMART FEATURE 3: Price Recalculation on Customer Change
    // ==========================================
    const handleCustomerChange = useCallback((newCustomerId) => {
        const hasItems = rows.some(r => r.item)
        const oldCustomer = customers.find(c => c._id === customer)
        const newCustomer = customers.find(c => c._id === newCustomerId)

        // Check if customer type changed AND we have items
        if (hasItems && oldCustomer && newCustomer && oldCustomer.type !== newCustomer.type) {
            setPreviousCustomer(customer)
            setCustomer(newCustomerId)
            setShowRecalcDialog(true)
        } else {
            setCustomer(newCustomerId)
        }
    }, [customer, customers, rows])

    const recalculatePrices = useCallback(() => {
        const selectedCustomer = customers.find(c => c._id === customer)
        const isWholesale = selectedCustomer?.type === 'wholesale'

        setRows(prev => prev.map(row => {
            if (!row.item) return row
            const itemObj = items.find(it => it._id === row.item)
            if (!itemObj) return row

            const newPrice = isWholesale
                ? (itemObj.wholesalePrice || itemObj.price || 0)
                : (itemObj.price || itemObj.retailPrice || 0)

            return { ...row, price: Number(newPrice) }
        }))

        push('success', `تم تحديث الأسعار لـ ${isWholesale ? 'الجملة' : 'التجزئة'}`)
        setShowRecalcDialog(false)
        setPreviousCustomer('')
    }, [customer, customers, items, push])

    const cancelRecalculation = useCallback(() => {
        setShowRecalcDialog(false)
        setPreviousCustomer('')
    }, [])

    // ==========================================
    // SMART FEATURE 1: Stock Error Detection for Save Button
    // ==========================================
    const hasStockError = useMemo(() => {
        return rows.some(row => {
            if (!row.item) return false
            const itemObj = items.find(it => it._id === row.item)
            if (!itemObj) return false
            const available = getAvailableStock(itemObj)
            return row.qty > available
        })
    }, [rows, items, warehouse])

    const submit = async (e) => {
        e.preventDefault()
        if (!customer) return push('error', 'اختر عميلًا')
        if (!warehouse) return push('error', 'اختر المستودع')
        if (!warehouse) return push('error', 'اختر المستودع')
        const isPaid = Number(paidAmount) > 0

        // Validation for Split
        if (isPaid && paymentMethod === 'split') {
            const totalSplit = splitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
            if (Math.abs(totalSplit - Number(paidAmount)) > 0.01) {
                return push('error', `مجموع الدفعات (${totalSplit}) لا يساوي المبلغ المدفوع (${paidAmount})`)
            }
            const invalidSplit = splitPayments.find(p => p.amount > 0 && !p.treasury)
            if (invalidSplit) {
                return push('error', 'يرجى تحديد الخزينة لكل دفعة في الدفع المختلط')
            }
        } else if (isPaid && !selectedTreasury) {
            return push('error', 'اختر الخزينة')
        }
        if (!rows.length || rows.some(r => !r.item || !r.qty || !r.price)) return push('error', 'أكمل بنود البيع')

        // Validate Stock Availability
        for (const row of rows) {
            const item = items.find(i => i._id === row.item)
            if (item) {
                const available = getAvailableStock(item)
                if (row.qty > available) {
                    return push('error', `الكمية المطلوبة للصنف "${item.name}" غير متوفرة. المتاح: ${available}`)
                }
            }
        }

        // Credit Limit Check
        const totalAmount = rows.reduce((acc, row) => acc + (row.qty * row.price), 0)
        const remainingAmount = Math.max(0, totalAmount - (Number(paidAmount) || 0))

        if (remainingAmount > 0) {
            try {
                const { data: customerData } = await api.get(`/customers/${customer}`)
                if (customerData.creditLimit > 0) {
                    const newBalance = (customerData.balance || 0) + remainingAmount
                    if (newBalance > customerData.creditLimit) {
                        push('error', `تجاوز سقف الائتمان! الرصيد الحالي: ${customerData.balance}، السقف: ${customerData.creditLimit}`)
                        return
                    }
                }
            } catch (err) {
                // Credit check failed - silent error handling
                push('error', 'فشل التحقق من سقف الائتمان')
                return
            }
        }

        setLoading(true)
        try {
            // Determine final treasury value
            const finalTreasury = paymentMethod === 'split'
                ? (splitPayments.find(p => p.method === 'cash')?.treasury || splitPayments[0]?.treasury || undefined)
                : (selectedTreasury || undefined);

            const { data } = await api.post('/sales/invoice-v2', {
                customer: customer || undefined,
                warehouse,
                items: rows.filter(r => r.item).map(r => ({
                    item: r.item,
                    qty: Number(r.qty) || 1,
                    price: Number(r.price) || 0
                })),
                note,
                status: 'confirmed',
                paid: Number(paidAmount) || 0,
                paymentMethod: paymentMethod,
                // Only include treasury if it has a value
                ...(finalTreasury && { treasury: finalTreasury }),
                // Split Details
                ...(paymentMethod === 'split' && {
                    splitDetails: splitPayments
                        .filter(p => p.treasury && Number(p.amount) > 0)
                        .map(p => ({
                            method: p.method,
                            amount: Number(p.amount) || 0,
                            treasury: p.treasury
                        }))
                })
            })
            push('success', 'تم إنشاء فاتورة البيع الآجلة')
            onSuccess(data)
            onClose()
        } catch (e) {
            push('error', e?.response?.data?.message || 'فشل إنشاء فاتورة البيع')
        } finally { setLoading(false) }
    }

    const totalAmount = rows.reduce((acc, row) => acc + (row.qty * row.price), 0)

    // Smart Filter
    const treasuryFilter = useMemo(() => {
        if (paymentMethod === 'cash') return 'safe'
        if (['card', 'bank'].includes(paymentMethod)) return 'bank'
        return null
    }, [paymentMethod])

    if (!show) return null

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-slate-50 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 mt-12 mr-24">

                    {/* Header - Premium Gradient */}
                    <div className="bg-linear-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-6 shrink-0 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/5 opacity-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                        <div className="relative flex justify-between items-start z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl shadow-inner border border-white/10">
                                        <Receipt size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">فاتورة مبيعات جديدة</h3>
                                        <p className="text-blue-100 text-sm font-medium opacity-90">إنشاء فاتورة آجلة أو دفع جزئي للعملاء</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-200 hover:rotate-90 hover:scale-110 border border-white/10 shadow-sm"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Form Body */}
                    <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                            {/* Top Controls Card */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                        العميل <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative group">
                                        <select
                                            value={customer}
                                            onChange={e => handleCustomerChange(e.target.value)}
                                            className={`w-full h-11 px-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer ${creditWarning?.severity === 'error' ? 'bg-red-50 border-red-300 text-red-900' : creditWarning?.severity === 'warning' ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                                            required
                                        >
                                            <option value="">اختر العميل...</option>
                                            {customers.map(c => <option key={c._id} value={c._id}>{c.code} — {c.name} {c.type === 'wholesale' ? '(جملة)' : ''}</option>)}
                                        </select>
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
                                            <Search size={16} />
                                        </div>
                                        {/* Credit Limit Badge */}
                                        {customer && (() => {
                                            const c = customers.find(cust => cust._id === customer)
                                            if (c?.creditLimit > 0) {
                                                return (
                                                    <div className="absolute -top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                                        سقف: {c.creditLimit.toLocaleString()}
                                                    </div>
                                                )
                                            }
                                            return null
                                        })()}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-1">
                                        المستودع <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={warehouse}
                                        onChange={e => setWarehouse(e.target.value)}
                                        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer hover:bg-slate-100"
                                        required
                                    >
                                        <option value="">اختر المستودع...</option>
                                        {warehouses.map(w => <option key={w._id} value={w._id}>{w.code} — {w.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">ملاحظة مرجعية</label>
                                    <input
                                        placeholder="ملاحظات إضافية..."
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            {/* ==========================================
                            CREDIT LIMIT WARNING BANNER - Real-time
                           ========================================== */}
                            {creditWarning && (
                                <div className={`p-4 rounded-xl border-2 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${creditWarning.severity === 'error'
                                    ? 'bg-red-50 border-red-300 text-red-800'
                                    : 'bg-amber-50 border-amber-300 text-amber-800'
                                    }`}>
                                    <AlertTriangle size={24} className={creditWarning.severity === 'error' ? 'text-red-500' : 'text-amber-500'} />
                                    <div className="flex-1">
                                        <p className="font-bold text-sm">{creditWarning.message}</p>
                                        <div className="text-xs mt-1 opacity-80 flex gap-4">
                                            <span>الرصيد الحالي: {creditWarning.details?.currentBalance?.toFixed(2)} د.ل</span>
                                            <span>السقف: {creditWarning.details?.creditLimit?.toFixed(2)} د.ل</span>
                                            <span>المتوقع: {creditWarning.details?.projectedBalance?.toFixed(2)} د.ل</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Items Table Section - SpreadsheetSales */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200">
                                        <Receipt size={18} />
                                    </div>
                                    <h4 className="font-bold text-slate-800">بنود الفاتورة</h4>
                                </div>
                                <SpreadsheetSales
                                    rows={rows}
                                    items={items}
                                    warehouse={warehouse}
                                    stockMap={stockMap}
                                    customer={customer}
                                    customers={customers}
                                    onAddRow={handleSpreadsheetAdd}
                                    onUpdateRow={updateRow}
                                    onRemoveRow={delRow}
                                />
                            </div>

                            {/* Payment & Footer Section */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>

                                <div className="flex flex-col md:flex-row gap-6 items-start">
                                    {/* Left Side: Quick Payment Input */}
                                    <div className="w-full md:w-1/3 space-y-2">
                                        <label className="text-sm font-bold text-slate-700">المبلغ المدفوع الآن</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={paidAmount}
                                                onChange={e => setPaidAmount(e.target.value)}
                                                className="w-full h-12 text-center font-black text-xl bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-emerald-800"
                                                placeholder="0.00"
                                            />
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">د.ل</div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 text-center">اتركه 0.00 إذا كانت الفاتورة آجلة بالكامل</p>
                                    </div>

                                    {/* Right Side: Method & Details */}
                                    <div className="flex-1 w-full">
                                        {Number(paidAmount) > 0 ? (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex flex-col md:flex-row gap-4">
                                                    <div className="w-full md:w-1/3 space-y-2">
                                                        <label className="text-sm font-bold text-slate-700">طريقة الدفع</label>
                                                        <select
                                                            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:border-blue-500 outline-none"
                                                            value={paymentMethod}
                                                            onChange={e => setPaymentMethod(e.target.value)}
                                                        >
                                                            <option value="cash">نقدي</option>
                                                            <option value="card">بطاقة مصرفية</option>
                                                            <option value="bank">تحويل بنكي</option>
                                                            <option value="split">دفع مختلط (Split)</option>
                                                        </select>
                                                    </div>

                                                    <div className="flex-1 space-y-2">
                                                        <label className="text-sm font-bold text-slate-700">
                                                            {paymentMethod === 'split' ? 'تفاصيل الدفع المختلط' : 'الخزينة المستهدفة'}
                                                        </label>

                                                        {paymentMethod === 'split' ? (
                                                            <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2 shadow-inner">
                                                                <div className="flex justify-between items-center mb-1 pb-2 border-b border-slate-100">
                                                                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                                        <Split size={14} /> توزيع المدفوعات
                                                                    </span>
                                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Math.abs(splitPayments.reduce((s, p) => s + Number(p.amount), 0) - Number(paidAmount)) < 0.01 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                        {splitPayments.reduce((s, p) => s + Number(p.amount), 0)} / {paidAmount}
                                                                    </span>
                                                                </div>

                                                                {splitPayments.map((payment, index) => (
                                                                    <div key={index} className="flex gap-2 items-center">
                                                                        <select
                                                                            className="h-8 rounded border border-slate-200 text-xs w-20 bg-slate-50 focus:border-blue-500 outline-none"
                                                                            value={payment.method}
                                                                            onChange={e => {
                                                                                const newP = [...splitPayments]; newP[index].method = e.target.value; newP[index].treasury = ''; setSplitPayments(newP)
                                                                            }}
                                                                        >
                                                                            <option value="cash">نقدي</option>
                                                                            <option value="card">بطاقة</option>
                                                                            <option value="bank">بنك</option>
                                                                        </select>
                                                                        <input
                                                                            type="number" className="h-8 w-20 text-center text-xs border border-slate-200 rounded font-bold focus:border-blue-500 outline-none"
                                                                            value={payment.amount} onChange={e => { const newP = [...splitPayments]; newP[index].amount = Number(e.target.value); setSplitPayments(newP) }}
                                                                        />
                                                                        <div className="flex-1">
                                                                            <TreasurySelector
                                                                                value={payment.treasury} onChange={val => { const newP = [...splitPayments]; newP[index].treasury = val; setSplitPayments(newP) }}
                                                                                filterType={payment.method === 'cash' ? 'safe' : 'bank'} className="h-8 text-xs"
                                                                            />
                                                                        </div>
                                                                        <button type="button" onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== index))} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                                                                    </div>
                                                                ))}
                                                                <button type="button" onClick={() => setSplitPayments([...splitPayments, { method: 'cash', amount: 0, treasury: '' }])} className="w-full h-8 border border-dashed border-blue-200 rounded text-blue-600 text-xs font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"><Plus size={12} /> إضافة طريقة دفع</button>
                                                            </div>
                                                        ) : (
                                                            <TreasurySelector
                                                                value={selectedTreasury}
                                                                onChange={setSelectedTreasury}
                                                                required={true}
                                                                filterType={treasuryFilter}
                                                                className="w-full"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                                                سيتم تسجيل الفاتورة كذمة مالية على العميل بالكامل
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="p-5 border-t border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                            <div className="text-sm">
                                <span className="text-slate-500">الباقي على العميل: </span>
                                <span className="font-bold text-slate-800">{formatCurrency(Math.max(0, totalAmount - Number(paidAmount)))}</span>
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors" disabled={loading}>
                                    إلغاء
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={loading || hasStockError}
                                    title={hasStockError ? 'يوجد أصناف تتجاوز المخزون المتاح' : ''}
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            جاري الحفظ...
                                        </span>
                                    ) : 'حفظ الفاتورة'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div >
            </div >

            {/* ==========================================
                PRICE RECALCULATION DIALOG
               ========================================== */}
            {
                showRecalcDialog && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                                    <RefreshCw size={24} className="text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">تغيير نوع العميل</h3>
                                    <p className="text-sm text-slate-500">هل تريد تحديث الأسعار؟</p>
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 mb-6">
                                لقد قمت بتغيير نوع العميل (جملة / قطاعي). هل تريد إعادة حساب أسعار الأصناف الموجودة بناءً على نوع العميل الجديد؟
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={cancelRecalculation}
                                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                                >
                                    لا، إبقاء الأسعار
                                </button>
                                <button
                                    type="button"
                                    onClick={recalculatePrices}
                                    className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 flex items-center gap-2"
                                >
                                    <RefreshCw size={16} />
                                    نعم، تحديث الأسعار
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    )
}
