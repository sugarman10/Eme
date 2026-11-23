import { useState, useRef, useEffect, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  Users,
  Truck,
  BarChart2,
  BookOpen,
  Settings,
  LogOut,
  Layers,
  CreditCard,
  ArrowRightLeft,
  DollarSign,
  Building2,
  Briefcase,
  Landmark,
  X,
  ChevronDown,
  Search,
  Wallet,
  User,
  Shield,
  Lock,
  RotateCcw,
  Receipt,
  FolderOpen,
  Calendar,
  Clock,
  Bell,
  Sun,
  Moon,
  Menu,
  Check,
  AlertTriangle,
  Info,
  Sparkles,
  ChevronRight,
  Zap,
  ArrowUpRight,
  Warehouse
} from 'lucide-react'
import { WarehouseSelector } from './WarehouseSelector'
import { FiscalPeriodSelector } from './FiscalPeriodSelector'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { usePermission } from '../hooks/usePermission'
import { useToast } from '../context/ToastContext'
import { ExchangeRateModal } from './pos/modals/ExchangeRateModal'
import api from '../services/api'
import { initDarkMode, toggleDarkMode, isDarkMode } from '../utils/darkMode'
import { cn } from '../lib/utils'

// Reorganized & Grouped Menu Items with fine-grained permission bindings
const navigationGroups = [
  {
    id: 'dashboard',
    label: 'الرئيسية',
    icon: LayoutDashboard,
    items: [
      { to: '/', label: 'لوحة التحكم', desc: 'مؤشرات الأداء والإحصائيات العامة', icon: LayoutDashboard, adminOnly: true },
      { to: '/reports', label: 'التقارير والتحليلات', desc: 'تقارير المبيعات والأداء والتحليل المتقدم', icon: BarChart2, badge: 'جديد', adminOnly: true },
    ]
  },
  {
    id: 'sales',
    label: 'المبيعات',
    icon: ShoppingCart,
    items: [
      { to: '/pos?mode=fast', label: 'بيع نقدي', desc: 'واجهة البيع النقدي السريع والفواتير المباشرة', icon: Zap, badge: 'نقدي', perm: 'pos_access' },
      { to: '/pos?mode=split', label: 'مبيعات', desc: 'نقطة بيع خاصة بالعملاء والآجل والحسابات', icon: ShoppingCart, badge: 'عملاء', perm: 'pos_access' },
      { to: '/quotations', label: 'عروض الأسعار (فواتير العرض)', desc: 'إصدار ومتابعة عروض الأسعار وفواتير العرض وتحويلها لمبيعات', icon: FileText, badge: 'عرض سعر', perm: 'sales_invoices_view' },
      { to: '/pos-return', label: 'مردود نقدي', desc: 'إرجاع المبيعات النقدية واسترداد فوري', icon: RotateCcw, badge: 'نقدي', perm: 'sales_returns' },
      { to: '/sales-returns', label: 'مردود مبيعات', desc: 'إرجاع بضائع العملاء وتسوية الحسابات', icon: RotateCcw, badge: 'عملاء', perm: 'sales_returns' },
      { to: '/sales-daily', label: 'تحليل المبيعات اليومية', desc: 'مقارنة المبيعات والقنوات جملة وقطاعي', icon: BarChart2, perm: 'sales_invoices_view' },
      { to: '/customers', label: 'دليل العملاء', desc: 'بيانات العملاء والأرصدة وسقوف الائتمان', icon: Users, perm: 'customers_manage' },
      { to: '/customer-receipts', label: 'سندات القبض', desc: 'استلام الدفعات النقدية وتسوية الديون', icon: DollarSign, perm: 'payment_vouchers' },
      { to: '/payment-vouchers', label: 'سندات الدفع', desc: 'سندات الدفع والصرف للعملاء والموردين', icon: ArrowUpRight, perm: 'payment_vouchers' },
    ]
  },
  {
    id: 'procurement',
    label: 'المشتريات',
    icon: Truck,
    items: [
      { to: '/purchase-invoice', label: 'فاتورة مشتريات (POS)', desc: 'إدخال البضاعة بالباركود وترحيل فوري للمخزن', icon: ShoppingCart, perm: 'purchases_create' },
      { to: '/purchase-orders', label: 'أوامر الشراء', desc: 'إدارة فواتير وطلبيات التوريد من الموردين', icon: CreditCard, perm: 'purchases_view' },
      { to: '/purchase-returns', label: 'مردودات المشتريات', desc: 'إرجاع الأصناف للموردين والخصم من الحساب', icon: RotateCcw, perm: 'purchases_returns' },
      { to: '/suppliers', label: 'دليل الموردين', desc: 'بيانات الموردين ومتابعة كشوفات الحسابات', icon: Truck, perm: 'suppliers_manage' },
      { to: '/supplier-payments', label: 'سندات الصرف', desc: 'تسديد مستحقات الموردين وتوثيق الدفعات', icon: DollarSign, perm: 'supplier_payments' },
    ]
  },
  {
    id: 'inventory',
    label: 'المخزون',
    icon: Package,
    items: [
      { to: '/items', label: 'الأصناف والمنتجات', desc: 'دليل المنتجات، الباركود، والأسعار', icon: Package, perm: 'items_manage' },
      { to: '/stock-balances', label: 'أرصدة المخزون', desc: 'جرد الكميات المتوفرة وتكلفة المخزون', icon: Layers, perm: 'inventory_view' },
      { to: '/stock-transfer', label: 'التحويل بين المخازن', desc: 'نقل الأصناف بين الفروع والمستودعات', icon: ArrowRightLeft, perm: 'inventory_transfer' },
      { to: '/stock-movements', label: 'حركات المخزون', desc: 'السجل التراكمي للوارد والمنصرف والتعديلات', icon: BookOpen, perm: 'inventory_view' },
      { to: '/warehouses', label: 'المستودعات والفروع', desc: 'تهيئة المستودعات وأماكن التخزين', icon: Building2, perm: 'inventory_view' },
    ]
  },
  {
    id: 'finance',
    label: 'المالية',
    icon: Landmark,
    items: [
      { to: '/journals', label: 'القيود اليومية', desc: 'القيود المحاسبية وسندات القيد المزدوج', icon: BookOpen, perm: 'journals_manage' },
      { to: '/accounts', label: 'دليل الحسابات', desc: 'شجرة الحسابات العامة وتصنيفاتها', icon: Landmark, perm: 'coa_manage' },
      { to: '/treasuries', label: 'الخزائن والمصارف', desc: 'إدارة أرصدة الصناديق والحسابات البنكية', icon: Wallet, perm: 'treasury_view' },
      { to: '/payment-vouchers', label: 'سندات الدفع والصرف', desc: 'إصدار سندات الصرف والدفع العام', icon: ArrowUpRight, perm: 'payment_vouchers' },
      { to: '/expenses', label: 'سجل المصروفات', desc: 'تسجيل المصاريف اليومية والتشغيلية', icon: Receipt, perm: 'expenses_manage' },
      { to: '/expense-categories', label: 'فئات المصروفات', desc: 'تصنيفات وبنود المصاريف المعتمدة', icon: FolderOpen, perm: 'expenses_manage' },
      { to: '/financial-reports', label: 'التقارير المالية', desc: 'القوائم والأرباح والميزانية الختامية', icon: BarChart2, perm: 'financial_reports' },
      { to: '/trial-balance', label: 'ميزان المراجعة', desc: 'تقرير الأرصدة وحركات الحسابات المدينة والدائنة', icon: Landmark, perm: 'financial_reports' },
      { to: '/fiscal-periods', label: 'الفترات المالية', desc: 'السنوات والأشهر المالية وإقفالاتها', icon: Calendar, perm: 'fiscal_period_switch' },
      { to: '/daily-closures', label: 'الإغلاق اليومي', desc: 'إقفال الصناديق اليومي ومطابقة الجرد', icon: Lock, perm: 'daily_closures' },
    ]
  },
  {
    id: 'hr',
    label: 'الموارد البشرية',
    icon: Users,
    items: [
      { to: '/employees', label: 'دليل الموظفين', desc: 'بيانات الكادر الوظيفي والرواتب الأساسية', icon: Users, perm: 'hr_employees_manage' },
      { to: '/loans', label: 'السلف والقروض', desc: 'إدارة طلبات السلف وخطط الاستقطاع الشهري', icon: Wallet, perm: 'hr_loans_manage' },
      { to: '/payroll', label: 'مسيرات الرواتب', desc: 'احتساب الرواتب الشهرية والبدلات والخصومات', icon: DollarSign, perm: 'hr_payroll_manage' },
    ]
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    icon: Settings,
    items: [
      { to: '/users', label: 'المستخدمين والصلاحيات', desc: 'إدارة الحسابات وكلمات المرور والأدوار', icon: Users, perm: 'users_manage' },
      { to: '/departments', label: 'الأقسام الإدارية', desc: 'الهيكل التنظيمي وأقسام المنشأة', icon: Briefcase, perm: 'users_manage' },
      { to: '/settings', label: 'إعدادات النظام', desc: 'معلومات المنشأة والعملة والطباعة والنسخ', icon: Settings, perm: 'users_manage' },
    ]
  }
]

export default function TopNavigation() {
  const { pathname, search } = useLocation()
  const currentFullPath = pathname + (search || '')
  const navigate = useNavigate()
  const { me, logout } = useAuth()

  // Navigation Dropdown State
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedMobileGroups, setExpandedMobileGroups] = useState({})

  // Exchange Rate & Permissions
  const { usdExchangeRate = 7.30, updateExchangeRate, exchangeRateUpdatedAt } = useSettings()
  const { canEditExchangeRate } = usePermission()
  const { push } = useToast()
  const [showExchangeRateModal, setShowExchangeRateModal] = useState(false)

  // Header Utilities State
  const [showSystemHub, setShowSystemHub] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [dark, setDark] = useState(false)

  const dropdownTimeoutRef = useRef(null)
  const systemHubRef = useRef(null)
  const notificationRef = useRef(null)
  const userMenuRef = useRef(null)
  const desktopNavRef = useRef(null)
  const tabletNavRef = useRef(null)

  // Initialize dark mode and timers
  useEffect(() => {
    initDarkMode()
    setDark(isDarkMode())

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)

    const handleClickOutside = (event) => {
      if (systemHubRef.current && !systemHubRef.current.contains(event.target)) {
        setShowSystemHub(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
      const isInsideDesktop = desktopNavRef.current && desktopNavRef.current.contains(event.target)
      const isInsideTablet = tabletNavRef.current && tabletNavRef.current.contains(event.target)
      if (!isInsideDesktop && !isInsideTablet) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      clearInterval(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Close dropdowns on route change
  useEffect(() => {
    setActiveDropdown(null)
    setShowSystemHub(false)
    setMobileMenuOpen(false)
  }, [pathname, search])

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications?limit=10')
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      console.error('Failed to fetch notifications', error)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => (n._id === id ? { ...n, read: true } : n)))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark as read', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all notifications as read', error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getUserInitials = (name) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getRoleDisplayName = (role) => {
    if (role === 'admin') return 'مدير النظام'
    return me?.position || 'مستخدم'
  }

  // Filter groups according to User Role & Fine-grained Permissions
  const filteredGroups = useMemo(() => {
    const role = (me?.role || '').toLowerCase()
    const perms = Array.isArray(me?.permissions) ? me.permissions : []

    // 1. Admin or Wildcard has unrestricted access to all groups
    if (role === 'admin' || perms.includes('*')) {
      return navigationGroups
    }

    // 2. If user has explicit permissions assigned, filter items and groups dynamically
    if (perms.length > 0) {
      return navigationGroups
        .map(group => {
          const allowedItems = group.items.filter(item => {
            // Dashboard home (/) and Reports (/reports) are strictly restricted to System Admin only
            if (item.adminOnly || item.to === '/' || item.to === '/reports') return role === 'admin'
            // If item has a specific required permission
            if (item.perm && perms.includes(item.perm)) return true
            // Manager role fallback for operational pages
            if (role === 'manager' && group.id !== 'settings') return true
            return false
          })

          if (allowedItems.length === 0) return null

          return {
            ...group,
            items: allowedItems
          }
        })
        .filter(Boolean)
    }

    // 3. Fallback when permissions array is not populated (pure role-based)
    if (role === 'cashier') {
      return [
        {
          id: 'sales',
          label: 'المبيعات',
          icon: ShoppingCart,
          items: [
            { to: '/pos?mode=fast', label: 'بيع نقدي', desc: 'واجهة البيع النقدي السريع والفواتير المباشرة', icon: Zap, badge: 'نقدي', perm: 'pos_access' },
            { to: '/pos?mode=split', label: 'مبيعات', desc: 'نقطة بيع خاصة بالعملاء والآجل والحسابات', icon: ShoppingCart, badge: 'عملاء', perm: 'pos_access' },
            { to: '/quotations', label: 'عروض الأسعار (فواتير العرض)', desc: 'إصدار ومتابعة عروض الأسعار وفواتير العرض', icon: FileText, badge: 'عرض سعر', perm: 'sales_invoices_view' },
            { to: '/pos-return', label: 'مردود نقدي', desc: 'إرجاع المبيعات النقدية واسترداد فوري', icon: RotateCcw, badge: 'نقدي', perm: 'sales_returns' },
            { to: '/sales-returns', label: 'مردود مبيعات', desc: 'إرجاع بضائع العملاء وتسوية الحسابات', icon: RotateCcw, badge: 'عملاء', perm: 'sales_returns' }
          ]
        }
      ]
    }

    if (role === 'accountant') {
      return navigationGroups.filter(g => ['finance', 'sales', 'procurement'].includes(g.id))
    }

    if (role !== 'admin') {
      return navigationGroups
        .filter(g => g.id !== 'dashboard')
        .map(g => ({
          ...g,
          items: g.items.filter(item => item.to !== '/')
        }))
        .filter(g => g.items.length > 0)
    }

    return navigationGroups
  }, [me?.role, me?.permissions])

  // Mouse hover & click handlers with debounced exit
  const handleMouseEnter = (groupId) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }
    setActiveDropdown(groupId)
  }

  const handleMouseLeave = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
    }
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null)
    }, 200)
  }

  const handleCategoryClick = (e, group) => {
    e.preventDefault()
    e.stopPropagation()
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current)
      dropdownTimeoutRef.current = null
    }

    // If dropdown is already open and user clicks category again, navigate directly to primary page
    if (activeDropdown === group.id && group.items?.[0]?.to) {
      setActiveDropdown(null)
      navigate(group.items[0].to)
      return
    }

    // Otherwise toggle dropdown
    setActiveDropdown(prev => (prev === group.id ? null : group.id))
  }

  const toggleMobileGroup = (groupId) => {
    setExpandedMobileGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  // Determine which group is currently active
  const isGroupActive = (group) => {
    return group.items.some(item => {
      if (item.to === '/') return pathname === '/'
      return pathname.startsWith(item.to)
    })
  }

  // Render category navigation pills (reused in desktop bar and tablet sub-bar)
  const renderNavCategoryPills = (prefix = 'desktop') => {
    return filteredGroups.map(group => {
      const GroupIcon = group.icon
      const active = isGroupActive(group)
      const isMenuOpen = activeDropdown === group.id

      return (
        <div
          key={`${prefix}-${group.id}`}
          className="relative overflow-visible"
          onMouseEnter={() => handleMouseEnter(group.id)}
          onMouseLeave={handleMouseLeave}
        >
          {/* Category Button */}
          <button
            type="button"
            onClick={(e) => handleCategoryClick(e, group)}
            className={cn(
              'flex items-center gap-1 2xl:gap-1.5 h-9 px-2 2xl:px-3 text-[11px] 2xl:text-xs font-bold rounded-xl transition-all duration-200 select-none whitespace-nowrap cursor-pointer border',
              active
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black shadow-sm border-slate-900 dark:border-white ring-1 ring-slate-900/10 dark:ring-white/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white border-transparent hover:border-slate-200/70 dark:hover:border-slate-700/70',
              isMenuOpen && 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white ring-2 ring-slate-400/20 shadow-xs'
            )}
            aria-expanded={isMenuOpen}
          >
            <GroupIcon size={14} className={active ? 'text-white dark:text-slate-900' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'} />
            <span>{group.label}</span>
            <ChevronDown
              size={11}
              className={cn('transition-transform duration-200', isMenuOpen && 'rotate-180', active ? 'text-white/80 dark:text-slate-900/80' : 'text-slate-400')}
            />
          </button>

          {/* Dropdown Menu Flyout */}
          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-72 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-2xl z-50 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150 p-2 before:absolute before:-top-3 before:left-0 before:right-0 before:h-3 before:content-['']"
              onMouseEnter={() => handleMouseEnter(group.id)}
              onMouseLeave={handleMouseLeave}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/60 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <GroupIcon size={13} className="text-primary-600 dark:text-primary-400" />
                  <span>قائمة {group.label}</span>
                </span>
                {group.items?.[0]?.to && (
                  <Link
                    to={group.items[0].to}
                    onClick={() => {
                      setTimeout(() => setActiveDropdown(null), 60)
                    }}
                    className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline font-bold cursor-pointer"
                  >
                    الانتقال للرئيسية ←
                  </Link>
                )}
              </div>

              <div className="space-y-1">
                {group.items.map(item => {
                  const ItemIcon = item.icon
                  const isCurrent = item.to.includes('?') ? currentFullPath === item.to : (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to))

                  return (
                    <Link
                      key={`${prefix}-${item.to}`}
                      to={item.to}
                      onClick={() => {
                        setTimeout(() => setActiveDropdown(null), 60)
                      }}
                      className={cn(
                        'group/item flex items-start gap-3 p-2.5 rounded-xl transition-all duration-150 cursor-pointer',
                        isCurrent
                          ? 'bg-primary-50 dark:bg-primary-950/70 text-primary-600 dark:text-primary-300 font-bold'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                          isCurrent
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 group-hover/item:bg-primary-100 dark:group-hover/item:bg-primary-900/50 group-hover/item:text-primary-600'
                        )}
                      >
                        <ItemIcon size={16} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs leading-none truncate">{item.label}</span>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.desc && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 line-clamp-1 leading-normal font-normal">
                            {item.desc}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)] overflow-visible transition-colors duration-200 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-gradient-to-r after:from-transparent after:via-slate-300/60 dark:after:via-slate-700/60 after:to-transparent after:pointer-events-none">
      {/* ============================================================ */}
      {/* 1. SINGLE UNIFIED EXECUTIVE BAR (Logo + Nav + Utility Chips) */}
      {/* ============================================================ */}
      <div className="w-full max-w-full px-2 sm:px-3 lg:px-4 2xl:px-6 h-16 flex items-center justify-between gap-1.5 lg:gap-2 2xl:gap-3 box-border">
        {/* RIGHT SIDE (RTL): Brand Logo & Navigation on Desktop */}
        <div className="flex items-center gap-1.5 lg:gap-2 2xl:gap-3 min-w-0">
          {/* Mobile Menu Button (< xl) */}
          <button
            type="button"
            className="xl:hidden p-1.5 sm:p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          {/* Logo & System Brand Button - Luxury Metallic Silver Edition (Click to open System Hub) */}
          <div className="relative" ref={systemHubRef}>
            <button
              type="button"
              onClick={() => setShowSystemHub(prev => !prev)}
              className="flex items-center gap-2 group select-none shrink-0 p-1 -m-1 rounded-2xl hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-all cursor-pointer border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700/60"
              title="إدارة بيئة العمل: السنة المالية، المخزن، وسعر الصرف (انقر للفتح)"
              aria-expanded={showSystemHub}
            >
              <div className="silver-metallic-badge p-[1.5px] rounded-xl transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg">
                <div className="w-8 h-8 2xl:w-9 2xl:h-9 rounded-[10px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center text-white border border-slate-700/50 shadow-inner">
                  <Layers size={18} className="text-slate-200 stroke-[2.2] drop-shadow-[0_1px_2px_rgba(255,255,255,0.3)]" />
                </div>
              </div>
              <div className="flex flex-col text-right">
                <div className="flex items-center gap-1.5">
                  <span className="text-silver-metallic text-[14px] lg:text-[15px] 2xl:text-[16px] font-black uppercase tracking-wider">
                    CORE SYSTEM
                  </span>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
                    PRO
                  </span>
                  <ChevronDown
                    size={12}
                    className={cn(
                      "text-slate-400 transition-transform duration-200 group-hover:text-slate-700 dark:group-hover:text-slate-200",
                      showSystemHub && "rotate-180 text-primary-600 dark:text-primary-400"
                    )}
                  />
                </div>
                <span className="hidden sm:block text-[8px] 2xl:text-[9px] font-bold tracking-[0.16em] uppercase text-slate-400 dark:text-slate-400 -mt-0.5">
                  ENTERPRISE ERP
                </span>
              </div>
            </button>

            {/* Executive System Context & Environment Dropdown Hub */}
            {showSystemHub && (
              <div className="absolute right-0 top-full mt-2.5 w-80 sm:w-96 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-black/5 text-right">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-800 flex items-center justify-center text-slate-200 border border-slate-700/60 shadow-xs">
                      <Layers size={15} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                        بيئة العمل والتشغيل
                      </h4>
                      <p className="text-[10px] text-slate-400">إدارة السنة، المخزن، وسعر الصرف المعتمد</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSystemHub(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Items Container */}
                <div className="space-y-3">
                  {/* 1. Live USD Rate Card */}
                  <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-xl flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm font-bold shadow-2xs">
                        💵
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-tight">سعر صرف الدولار</div>
                        <div className="text-sm font-mono font-black text-amber-950 dark:text-amber-200">
                          1$ = {usdExchangeRate} د.ل
                        </div>
                      </div>
                    </div>
                    {canEditExchangeRate ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSystemHub(false)
                          setShowExchangeRateModal(true)
                        }}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-200/90 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-950 dark:text-amber-100 transition-colors cursor-pointer shadow-2xs"
                      >
                        تعديل السعر
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                        <Lock size={10} />
                        ثابت
                      </span>
                    )}
                  </div>

                  {/* 2. Target Warehouse */}
                  <div className="p-2.5 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-xl space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 px-0.5">
                      <Warehouse size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span>المخزن المستهدف (الفرع النشط)</span>
                    </div>
                    <div className="w-full">
                      <WarehouseSelector />
                    </div>
                  </div>

                  {/* 3. Fiscal Year */}
                  <div className="p-2.5 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-xl space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 px-0.5">
                      <Calendar size={13} className="text-indigo-600 dark:text-indigo-400" />
                      <span>السنة / الفترة المالية</span>
                    </div>
                    <div className="w-full">
                      <FiscalPeriodSelector />
                    </div>
                  </div>

                  {/* 4. Quick Shortcut to Dashboard */}
                  <Link
                    to="/"
                    onClick={() => setShowSystemHub(false)}
                    className="flex items-center justify-center gap-2 w-full p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-2xs"
                  >
                    <LayoutDashboard size={14} />
                    <span>الرئيسية (لوحة التحكم العامة)</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Elegant Brushed Metallic Divider between Logo & Desktop Nav */}
          <div className="hidden xl:block h-6 w-[1.5px] bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-700 to-transparent mx-1 2xl:mx-1.5 shrink-0" />

          {/* Desktop Navigation Category Pills (xl+) */}
          <nav ref={desktopNavRef} className="hidden xl:flex items-center gap-0.5 2xl:gap-1" aria-label="Desktop Navigation">
            {renderNavCategoryPills('desktop')}
          </nav>
        </div>

        {/* LEFT SIDE (RTL): Status Pills & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Time & Live Date */}
          <div className="hidden lg:flex flex-col items-end text-end px-2.5 border-r border-slate-200/80 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 leading-none">
              <Clock size={13} className="text-primary-600" />
              <span className="tabular-nums font-mono text-xs">
                {currentTime.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-none">
              {currentTime.toLocaleDateString('ar-LY', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              })}
            </div>
          </div>

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={() => setDark(toggleDarkMode())}
            className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-colors shadow-2xs"
            title={dark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            aria-label="Toggle Theme"
          >
            {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
          </button>

          {/* Notifications Menu */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setShowNotifications(prev => !prev)}
              className="relative w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-colors shadow-2xs"
              aria-label="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 end-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 ring-2 ring-white dark:ring-slate-900"></span>
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-primary-600" />
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">التنبيهات</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                        {unreadCount} جديد
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-primary-600 hover:underline font-medium"
                    >
                      تحديد الكل كمقروء
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      لا توجد تنبيهات جديدة في الوقت الحالي
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif._id}
                        onClick={() => markAsRead(notif._id)}
                        className={cn(
                          'p-3.5 text-right transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 flex gap-3 items-start',
                          !notif.read && 'bg-primary-50/30 dark:bg-primary-950/20'
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          {notif.type === 'error' ? (
                            <AlertTriangle size={15} className="text-rose-500" />
                          ) : notif.type === 'success' ? (
                            <Check size={15} className="text-emerald-500" />
                          ) : (
                            <Info size={15} className="text-primary-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {notif.title || notif.message}
                          </p>
                          {notif.title && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                              {notif.message}
                            </p>
                          )}
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(notif.createdAt).toLocaleTimeString('ar-LY', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(prev => !prev)}
              className="flex items-center gap-2 h-9 px-2 bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-all select-none shadow-2xs"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shadow-2xs">
                {getUserInitials(me?.name || me?.username)}
              </div>
              <div className="hidden sm:flex flex-col text-right leading-tight">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[95px]">
                  {me?.name || me?.username || 'المستخدم'}
                </span>
                <span className="text-[9px] font-semibold text-primary-600 dark:text-primary-400">
                  {getRoleDisplayName(me?.role)}
                </span>
              </div>
              <ChevronDown size={13} className="text-slate-400 mr-0.5" />
            </button>

            {/* Profile Dropdown */}
            {showUserMenu && (
              <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {me?.name || me?.username}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                    {me?.email || me?.username}
                  </p>
                  <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded-md bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                    {getRoleDisplayName(me?.role)}
                  </span>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl transition-colors"
                  >
                    <Settings size={15} className="text-slate-400" />
                    <span>إعدادات النظام</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors text-right"
                  >
                    <LogOut size={15} />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. SUB-BAR FOR TABLETS (< XL) (Only shown when width < 1280px) */}
      {/* ============================================================ */}
      <nav
        ref={tabletNavRef}
        className="hidden md:flex xl:hidden border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/70 px-4 py-1.5 items-center gap-1 overflow-x-auto relative z-30"
        aria-label="Tablet Navigation"
      >
        {renderNavCategoryPills('tablet')}
      </nav>

      {/* ============================================================ */}
      {/* 4. MOBILE SIDEBAR DRAWER (Slide-in for mobile devices) */}
      {/* ============================================================ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer content (Right to Left slide) */}
          <div className="relative mr-auto w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="silver-metallic-badge p-[1px] rounded-lg">
                  <div className="w-8 h-8 rounded-[7px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white flex items-center justify-center font-bold">
                    <Layers size={17} className="text-slate-200" />
                  </div>
                </div>
                <div>
                  <h2 className="text-silver-metallic text-sm font-black uppercase tracking-wider">CORE SYSTEM</h2>
                  <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">القائمة الرئيسية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Period and Warehouse select inside mobile drawer */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <FiscalPeriodSelector />
              <WarehouseSelector />
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  if (canEditExchangeRate) {
                    setShowExchangeRateModal(true)
                  } else {
                    push('error', 'عذراً، تعديل سعر الصرف يتطلب صلاحية يمنحها مدير النظام')
                  }
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold border transition-all shadow-2xs",
                  canEditExchangeRate
                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-200"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <span>💵</span>
                  <span>سعر صرف الدولار:</span>
                  <span className="font-mono font-black">1$ = {usdExchangeRate} د.ل</span>
                </div>
                {canEditExchangeRate ? (
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">تعديل</span>
                ) : (
                  <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                    <Lock size={10} />
                    ثابت
                  </span>
                )}
              </button>
            </div>

            {/* Navigation Accordion */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredGroups.map(group => {
                const GroupIcon = group.icon
                const active = isGroupActive(group)
                const isExpanded = !!expandedMobileGroups[group.id]

                return (
                  <div key={group.id} className="border border-slate-100 dark:border-slate-800/80 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleMobileGroup(group.id)}
                      className={cn(
                        'w-full flex items-center justify-between p-3 text-xs font-bold transition-colors text-right',
                        active
                          ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <GroupIcon size={16} />
                        <span>{group.label}</span>
                      </div>
                      <ChevronDown
                        size={14}
                        className={cn('transition-transform duration-200', isExpanded && 'rotate-180')}
                      />
                    </button>

                    {isExpanded && (
                      <div className="p-2 space-y-1 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                        {group.items.map(item => {
                          const ItemIcon = item.icon
                          const isCurrent = item.to.includes('?') ? currentFullPath === item.to : (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to))

                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                'flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors',
                                isCurrent
                                  ? 'bg-primary-600 text-white font-bold'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <ItemIcon size={14} />
                                <span>{item.label}</span>
                              </div>
                              {item.badge && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-100 text-emerald-700">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Mobile Footer (Logout) */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 transition-colors"
              >
                <LogOut size={16} />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Exchange Rate Modal */}
      <ExchangeRateModal
        isOpen={showExchangeRateModal}
        onClose={() => setShowExchangeRateModal(false)}
        currentRate={usdExchangeRate}
        updatedAt={exchangeRateUpdatedAt}
        onSave={updateExchangeRate}
      />
    </header>
  )
}
