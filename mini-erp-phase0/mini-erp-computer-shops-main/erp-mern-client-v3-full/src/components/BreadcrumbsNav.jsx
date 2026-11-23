import React, { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Home,
  ArrowRight,
  Sparkles,
  ShoppingCart,
  FileText,
  DollarSign,
  Package,
  Lock,
  RotateCcw,
  ArrowUpRight
} from 'lucide-react'
import { cn } from '../lib/utils'

// Mapping of route paths to titles and parent groups
const routeMap = {
  '/': { title: 'لوحة التحكم', group: 'الرئيسية', groupPath: '/' },
  '/reports': { title: 'التقارير والتحليلات', group: 'الرئيسية', groupPath: '/' },
  
  '/pos': { title: 'المبيعات ونقاط البيع', group: 'المبيعات', groupPath: '/pos' },
  '/quotations': { title: 'عروض الأسعار وفواتير العرض', group: 'المبيعات', groupPath: '/quotations' },
  '/pos-return': { title: 'مردود نقدي (نقطة البيع)', group: 'المبيعات', groupPath: '/pos' },
  '/sales-invoices': { title: 'فواتير المبيعات', group: 'المبيعات', groupPath: '/sales-invoices' },
  '/sales-daily': { title: 'تحليل المبيعات اليومية', group: 'المبيعات', groupPath: '/sales-invoices' },
  '/sales-returns': { title: 'مردودات مبيعات العملاء', group: 'المبيعات', groupPath: '/sales-returns' },
  '/customers': { title: 'دليل العملاء', group: 'المبيعات', groupPath: '/sales-invoices' },
  '/customer-receipts': { title: 'سندات القبض', group: 'المبيعات', groupPath: '/sales-invoices' },
  '/payment-vouchers': { title: 'سندات الدفع والصرف', group: 'المالية', groupPath: '/journals' },

  '/purchase-orders': { title: 'أوامر الشراء', group: 'المشتريات', groupPath: '/purchase-orders' },
  '/purchase-returns': { title: 'مردودات المشتريات', group: 'المشتريات', groupPath: '/purchase-orders' },
  '/suppliers': { title: 'دليل الموردين', group: 'المشتريات', groupPath: '/purchase-orders' },
  '/supplier-payments': { title: 'سندات الصرف', group: 'المشتريات', groupPath: '/purchase-orders' },

  '/items': { title: 'دليل الأصناف والمنتجات', group: 'المخزون', groupPath: '/items' },
  '/stock-balances': { title: 'أرصدة المخزون', group: 'المخزون', groupPath: '/items' },
  '/stock-transfer': { title: 'التحويل بين المخازن', group: 'المخزون', groupPath: '/items' },
  '/stock-movements': { title: 'حركات المخزون', group: 'المخزون', groupPath: '/items' },
  '/warehouses': { title: 'المستودعات والفروع', group: 'المخزون', groupPath: '/items' },

  '/journals': { title: 'القيود اليومية', group: 'المالية', groupPath: '/journals' },
  '/accounts': { title: 'دليل الحسابات', group: 'المالية', groupPath: '/journals' },
  '/treasuries': { title: 'الخزائن والمصارف', group: 'المالية', groupPath: '/journals' },
  '/expenses': { title: 'سجل المصروفات', group: 'المالية', groupPath: '/journals' },
  '/expense-categories': { title: 'فئات المصروفات', group: 'المالية', groupPath: '/journals' },
  '/financial-reports': { title: 'التقارير المالية', group: 'المالية', groupPath: '/journals' },
  '/trial-balance': { title: 'ميزان المراجعة', group: 'المالية', groupPath: '/journals' },
  '/fiscal-periods': { title: 'الفترات المالية', group: 'المالية', groupPath: '/journals' },
  '/daily-closures': { title: 'الإغلاق اليومي', group: 'المالية', groupPath: '/journals' },

  '/employees': { title: 'دليل الموظفين', group: 'الموارد البشرية', groupPath: '/employees' },
  '/loans': { title: 'السلف والقروض', group: 'الموارد البشرية', groupPath: '/employees' },
  '/payroll': { title: 'مسيرات الرواتب', group: 'الموارد البشرية', groupPath: '/employees' },

  '/users': { title: 'المستخدمين والصلاحيات', group: 'الإعدادات', groupPath: '/settings' },
  '/departments': { title: 'الأقسام الإدارية', group: 'الإعدادات', groupPath: '/settings' },
  '/settings': { title: 'إعدادات النظام', group: 'الإعدادات', groupPath: '/settings' },
}

// Quick Shortcuts
const quickShortcuts = [
  { to: '/pos', label: 'نقطة بيع POS', icon: ShoppingCart, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-400' },
  { to: '/sales-invoices', label: 'فاتورة مبيعات', icon: FileText, color: 'text-primary-600 bg-primary-50 hover:bg-primary-100 border-primary-200 dark:bg-primary-950/40 dark:border-primary-900/50 dark:text-primary-400' },
  { to: '/customer-receipts', label: 'سند قبض', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-400' },
  { to: '/stock-balances', label: 'أرصدة المخزون', icon: Package, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400' },
  { to: '/daily-closures', label: 'إقفال اليومية', icon: Lock, color: 'text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-400' },
]

export default function BreadcrumbsNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Match current route info (handles /customers/:id or /employees/:id)
  const currentInfo = useMemo(() => {
    if (routeMap[pathname]) return routeMap[pathname]

    if (pathname.startsWith('/customers/')) {
      return { title: 'تفاصيل العميل', group: 'المبيعات', groupPath: '/customers' }
    }
    if (pathname.startsWith('/employees/')) {
      return { title: 'تفاصيل الموظف', group: 'الموارد البشرية', groupPath: '/employees' }
    }

    // Default fallback
    return { title: 'النظام', group: 'الرئيسية', groupPath: '/' }
  }, [pathname])

  const isHome = pathname === '/'

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-3 border-b border-slate-200/80 dark:border-slate-800">
      {/* RIGHT SIDE (RTL): Breadcrumbs Path & Back Button */}
      <div className="flex items-center gap-2 select-none">
        {/* Back Button (Only when not on dashboard) */}
        {!isHome && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition-all"
            title="رجوع للصفحة السابقة"
            aria-label="Go Back"
          >
            <ArrowRight size={15} />
          </button>
        )}

        {/* Breadcrumbs Trail */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
          <Link
            to="/"
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            <Home size={14} className="text-slate-400" />
            <span className="hidden xs:inline">الرئيسية</span>
          </Link>

          {!isHome && (
            <>
              <ChevronLeft size={13} className="text-slate-300 dark:text-slate-600" />
              <Link
                to={currentInfo.groupPath}
                className="hover:text-primary-600 transition-colors"
              >
                {currentInfo.group}
              </Link>
              <ChevronLeft size={13} className="text-slate-300 dark:text-slate-600" />
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {currentInfo.title}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* LEFT SIDE (RTL): Quick Shortcuts Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hidden xl:inline-block ml-1">
          وصول سريع:
        </span>
        {quickShortcuts.map(sc => {
          const ShortcutIcon = sc.icon
          const isCurrent = pathname === sc.to

          return (
            <Link
              key={sc.to}
              to={sc.to}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all duration-150 whitespace-nowrap shadow-2xs',
                sc.color,
                isCurrent && 'ring-2 ring-primary-500/50 shadow-sm'
              )}
            >
              <ShortcutIcon size={12} className="stroke-[2.5]" />
              <span>{sc.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
