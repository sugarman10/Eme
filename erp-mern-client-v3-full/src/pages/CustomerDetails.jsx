import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { ArrowRight, Users, Phone, Mail, MapPin, CreditCard, FileText, Calendar, DollarSign, Plus, Wallet, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table'

export default function CustomerDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { me } = useAuth()
    const isManager = me?.role === 'admin' || me?.role === 'manager'

    const [depositLoading, setDepositLoading] = useState(false)
    const [withdrawLoading, setWithdrawLoading] = useState(false)
    const [payFromWalletLoading, setPayFromWalletLoading] = useState(null) // invoice id

    // Fetch customer details
    const { data: customer, isLoading: loadingCustomer } = useQuery({
        queryKey: ['customer', id],
        queryFn: async () => {
            const { data } = await api.get(`/customers/${id}`)
            return data
        }
    })

    // Fetch sales invoices for this customer
    const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
        queryKey: ['salesInvoices', id],
        queryFn: async () => {
            const { data } = await api.get(`/sales/invoice?customer=${id}&limit=5000`)
            return data?.docs || data || []
        }
    })

    // Fetch treasuries for withdrawal
    const { data: treasuries = [] } = useQuery({
        queryKey: ['treasuries'],
        queryFn: async () => {
            const { data } = await api.get('/finance/treasuries')
            return data || []
        }
    })


    // Handle wallet deposit
    const handleDeposit = async () => {
        const amountStr = prompt('أدخل مبلغ الإيداع (د.ل):')
        if (!amountStr) return
        const amount = parseFloat(amountStr)
        if (isNaN(amount) || amount <= 0) {
            alert('المبلغ غير صالح')
            return
        }

        setDepositLoading(true)
        try {
            await api.post(`/wallet/${id}/deposit`, { amount })
            alert(`تم إيداع ${amount} د.ل بنجاح!`)
            queryClient.invalidateQueries(['customer', id])
        } catch (err) {
            alert('فشل الإيداع: ' + (err.response?.data?.message || err.message))
        } finally {
            setDepositLoading(false)
        }
    }

    // Handle wallet withdrawal (cash out - manager only)
    const handleWithdraw = async () => {
        if (!isManager) {
            alert('هذه العملية تتطلب صلاحيات المدير')
            return
        }

        const walletBalance = Number(customer?.walletBalance || 0)
        if (walletBalance <= 0) {
            alert('لا يوجد رصيد في المحفظة للصرف')
            return
        }

        const amountStr = prompt(`أدخل مبلغ الصرف (المتاح: ${walletBalance.toLocaleString()} د.ل):`)
        if (!amountStr) return
        const amount = parseFloat(amountStr)
        if (isNaN(amount) || amount <= 0) {
            alert('المبلغ غير صالح')
            return
        }
        if (amount > walletBalance) {
            alert(`المبلغ أكبر من الرصيد المتاح (${walletBalance.toLocaleString()} د.ل)`)
            return
        }

        // Select treasury
        const safeTreasury = treasuries.find(t => t.type?.toLowerCase() === 'safe') || treasuries[0]
        if (!safeTreasury) {
            alert('لا توجد خزينة متاحة للصرف')
            return
        }

        setWithdrawLoading(true)
        try {
            await api.post(`/wallet/${id}/withdraw`, {
                amount,
                treasuryId: safeTreasury._id,
                note: 'صرف نقدي من المحفظة'
            })
            alert(`تم صرف ${amount} د.ل بنجاح من الخزينة: ${safeTreasury.name}`)
            queryClient.invalidateQueries(['customer', id])
        } catch (err) {
            alert('فشل الصرف: ' + (err.response?.data?.message || err.message))
        } finally {
            setWithdrawLoading(false)
        }
    }

    // Handle paying invoice from wallet
    const handlePayFromWallet = async (invoice) => {
        const remaining = (invoice.totals?.grand || 0) - (invoice.totals?.paid || 0)
        if (remaining <= 0) {
            alert('هذه الفاتورة مسددة بالكامل')
            return
        }

        const walletBalance = Number(customer?.walletBalance || 0)
        if (walletBalance <= 0) {
            alert('لا يوجد رصيد في المحفظة')
            return
        }

        const maxPayable = Math.min(walletBalance, remaining)
        const amountStr = prompt(`أدخل المبلغ للسداد من المحفظة:\nالمتبقي: ${remaining.toLocaleString()} د.ل\nرصيد المحفظة: ${walletBalance.toLocaleString()} د.ل\n(أقصى حد: ${maxPayable.toLocaleString()} د.ل)`)
        if (!amountStr) return
        const amount = parseFloat(amountStr)
        if (isNaN(amount) || amount <= 0) {
            alert('المبلغ غير صالح')
            return
        }
        if (amount > maxPayable) {
            alert(`المبلغ أكبر من الحد المتاح (${maxPayable.toLocaleString()} د.ل)`)
            return
        }

        setPayFromWalletLoading(invoice._id)
        try {
            await api.post(`/wallet/${id}/use`, {
                amount,
                invoiceId: invoice._id,
                invoiceNumber: invoice.number,
                note: `سداد فاتورة ${invoice.number} من المحفظة`
            })
            alert(`تم سداد ${amount} د.ل من المحفظة للفاتورة ${invoice.number}`)
            queryClient.invalidateQueries(['customer', id])
            queryClient.invalidateQueries(['salesInvoices', id])
        } catch (err) {
            alert('فشل السداد: ' + (err.response?.data?.message || err.message))
        } finally {
            setPayFromWalletLoading(null)
        }
    }

    if (loadingCustomer) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">جاري التحميل...</div>
            </div>
        )
    }

    if (!customer) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="text-muted-foreground">لم يتم العثور على العميل</div>
                <Button onClick={() => navigate('/customers')}>
                    <ArrowRight size={18} className="ml-2" />
                    العودة للعملاء
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header with back button */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
                    <ArrowRight size={20} />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">تفاصيل العميل</h1>
                    <p className="text-muted-foreground">عرض معلومات العميل والفواتير المرتبطة</p>
                </div>
            </div>

            {/* Customer Information Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users size={20} />
                        معلومات العميل
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">الكود</div>
                            <div className="font-mono font-medium">{customer.code}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">الاسم</div>
                            <div className="font-medium">{customer.name}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">النوع</div>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${customer.type === 'wholesale' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                                {customer.type === 'wholesale' ? 'جملة' : 'قطاعي'}
                            </span>
                        </div>
                        {customer.phone && (
                            <div className="space-y-1">
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Phone size={14} />
                                    الهاتف
                                </div>
                                <div className="font-medium">{customer.phone}</div>
                            </div>
                        )}
                        {customer.email && (
                            <div className="space-y-1">
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Mail size={14} />
                                    البريد الإلكتروني
                                </div>
                                <div className="font-medium">{customer.email}</div>
                            </div>
                        )}
                        {customer.address && (
                            <div className="space-y-1">
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <MapPin size={14} />
                                    العنوان
                                </div>
                                <div className="font-medium">{customer.address}</div>
                            </div>
                        )}
                        {customer.creditLimit > 0 && (
                            <div className="space-y-1">
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <CreditCard size={14} />
                                    سقف الائتمان
                                </div>
                                <div className="font-medium text-emerald-600">
                                    {Number(customer.creditLimit).toLocaleString()} د.ل
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                            <DollarSign size={16} />
                            إجمالي المشتريات
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">
                            {invoices.reduce((sum, inv) => {
                                if (inv.status === 'cancelled' || inv.status === 'void') return sum
                                return sum + (inv.totals?.grand || 0)
                            }, 0).toLocaleString()} <span className="text-sm font-normal text-blue-700">د.ل</span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">قيمة جميع الفواتير الصالحة</p>
                    </CardContent>
                </Card>

                <Card className="bg-green-50/50 border-green-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                            <CreditCard size={16} />
                            إجمالي المدفوع
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-900">
                            {invoices.reduce((sum, inv) => {
                                if (inv.status === 'cancelled' || inv.status === 'void') return sum
                                return sum + (inv.totals?.paid || 0)
                            }, 0).toLocaleString()} <span className="text-sm font-normal text-green-700">د.ل</span>
                        </div>
                        <p className="text-xs text-green-600 mt-1">المبالغ المستلمة من العميل</p>
                    </CardContent>
                </Card>

                <Card className="bg-orange-50/50 border-orange-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
                            <FileText size={16} />
                            المتبقي (الآجل)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900">
                            {/* Use stored balance for accuracy (handles opening balances/migrations) */}
                            {Math.max(0, Number(customer.balance || 0)).toLocaleString()} <span className="text-sm font-normal text-orange-700">د.ل</span>
                        </div>
                        <p className="text-xs text-orange-600 mt-1">إجمالي المبالغ المستحقة</p>
                    </CardContent>
                </Card>

                {/* NEW: Wallet Balance Card - Shows walletBalance + negative balance as credit */}
                <Card className="bg-purple-50/50 border-purple-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
                            <CreditCard size={16} />
                            رصيد المحفظة
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            // Calculate total available credit
                            const walletBalance = Number(customer.walletBalance || 0);
                            const accountBalance = Number(customer.balance || 0);
                            // If balance is negative, it means customer has credit (overpaid)
                            const creditFromNegativeBalance = accountBalance < 0 ? Math.abs(accountBalance) : 0;
                            const totalCredit = walletBalance + creditFromNegativeBalance;

                            return (
                                <>
                                    <div className="text-2xl font-bold text-purple-900">
                                        {totalCredit.toLocaleString()} <span className="text-sm font-normal text-purple-700">د.ل</span>
                                    </div>
                                    {creditFromNegativeBalance > 0 && (
                                        <p className="text-xs text-purple-600 mt-1">
                                            منها {creditFromNegativeBalance.toLocaleString()} رصيد دائن (زائد من سدادات سابقة)
                                        </p>
                                    )}
                                    {creditFromNegativeBalance === 0 && (
                                        <p className="text-xs text-purple-600 mt-1">رصيد متاح للاستخدام</p>
                                    )}
                                    <Button
                                        size="sm"
                                        className="mt-3 w-full bg-purple-600 hover:bg-purple-700"
                                        onClick={handleDeposit}
                                        disabled={depositLoading}
                                    >
                                        <Plus size={16} className="ml-1" />
                                        {depositLoading ? 'جاري الإيداع...' : 'إيداع في المحفظة'}
                                    </Button>
                                    {/* Withdrawal button - Manager only */}
                                    {isManager && walletBalance > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="mt-2 w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                                            onClick={handleWithdraw}
                                            disabled={withdrawLoading}
                                        >
                                            <Minus size={16} className="ml-1" />
                                            {withdrawLoading ? 'جاري الصرف...' : 'صرف نقدي من المحفظة'}
                                        </Button>
                                    )}
                                </>
                            );
                        })()}
                    </CardContent>
                </Card>
            </div>

            {/* Sales Invoices */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText size={20} />
                        فواتير المبيعات ({invoices.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loadingInvoices ? (
                        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
                    ) : invoices.length === 0 ? (
                        <div className="p-8 text-center space-y-2">
                            <div className="text-muted-foreground">لا توجد فواتير مرتبطة بهذا العميل</div>
                            <div className="text-sm text-muted-foreground">
                                تأكد من اختيار العميل عند إنشاء الفاتورة في صفحة "فاتورة مبيعات جديدة"
                            </div>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>التاريخ</TableHead>
                                    <TableHead>القناة</TableHead>
                                    <TableHead>الحالة</TableHead>
                                    <TableHead>المجموع الفرعي</TableHead>
                                    <TableHead>الضريبة</TableHead>
                                    <TableHead>الخصم</TableHead>
                                    <TableHead>المجموع الكلي</TableHead>
                                    <TableHead>المدفوع</TableHead>
                                    <TableHead>المتبقي</TableHead>
                                    <TableHead>إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map(inv => {
                                    const remaining = (inv.totals?.grand || 0) - (inv.totals?.paid || 0)
                                    return (
                                        <TableRow key={inv._id}>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    <Calendar size={14} />
                                                    {new Date(inv.date).toLocaleDateString('ar-SA')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${inv.channel === 'wholesale' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                                                    }`}>
                                                    {inv.channel === 'wholesale' ? 'جملة' : 'قطاعي'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${inv.status === 'posted' ? 'bg-green-100 text-green-800 border-green-200' :
                                                    inv.status === 'draft' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                                                        inv.status === 'void' ? 'bg-red-100 text-red-800 border-red-200' :
                                                            'bg-blue-100 text-blue-800 border-blue-200'
                                                    }`}>
                                                    {inv.status === 'posted' ? 'مرحّل' :
                                                        inv.status === 'draft' ? 'مسودة' :
                                                            inv.status === 'void' ? 'ملغي' :
                                                                inv.status === 'refund' ? 'مرتجع' :
                                                                    inv.status === 'cancelled' ? 'ملغي' : inv.status}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 font-medium">
                                                    <DollarSign size={14} />
                                                    {Number(inv.totals?.subtotal || 0).toLocaleString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {Number(inv.totals?.tax || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                {Number(inv.totals?.discount || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold text-primary">
                                                    {Number(inv.totals?.grand || 0).toLocaleString()} د.ل
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-emerald-600 font-medium">
                                                    {Number(inv.totals?.paid || 0).toLocaleString()} د.ل
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className={`font-medium ${remaining > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                                                    {remaining.toLocaleString()} د.ل
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {/* Pay from Wallet button - show only if invoice has remaining and customer has wallet balance */}
                                                {remaining > 0 && (customer?.walletBalance || 0) > 0 && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-purple-600 border-purple-300 hover:bg-purple-50"
                                                        onClick={() => handlePayFromWallet(inv)}
                                                        disabled={payFromWalletLoading}
                                                    >
                                                        <Wallet size={14} className="ml-1" />
                                                        سداد من المحفظة
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
