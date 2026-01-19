import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
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
  RotateCcw
} from 'lucide-react'
import { cn } from '../lib/utils'

const menuItems = [
  {
    group: 'الرئيسية',
    icon: LayoutDashboard,
    items: [
      { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
      { to: '/reports', label: 'التقارير والتحليلات', icon: BarChart2, badge: 'جديد' },
    ]
  },
  {
    group: 'المبيعات',
    icon: ShoppingCart,
    items: [
      { to: '/pos', label: 'نقطة البيع (POS)', icon: ShoppingCart },
      { to: '/sales-invoices', label: 'فواتير المبيعات', icon: FileText },
      { to: '/sales-returns', label: 'مردودات المبيعات', icon: RotateCcw },
      { to: '/customers', label: 'العملاء', icon: Users },
      { to: '/customer-receipts', label: 'سندات القبض', icon: DollarSign },
    ]
  },
  {
    group: 'المخزون',
    icon: Package,
    items: [
      { to: '/items', label: 'المنتجات والخدمات', icon: Package },
      { to: '/stock-balances', label: 'أرصدة المخزون', icon: Layers },
      { to: '/stock-movements', label: 'حركات المخزون', icon: ArrowRightLeft },
      { to: '/warehouses', label: 'المستودعات', icon: Building2 },
    ]
  },
  {
    group: 'المشتريات',
    icon: Truck,
    items: [
      { to: '/suppliers', label: 'الموردين', icon: Truck },
      { to: '/purchase-orders', label: 'أوامر الشراء', icon: CreditCard },
      { to: '/purchase-returns', label: 'مردودات المشتريات', icon: RotateCcw },
      { to: '/supplier-payments', label: 'مدفوعات الموردين', icon: DollarSign },
    ]
  },
  {
    group: 'المالية',
    icon: Landmark,
    items: [
      { to: '/journals', label: 'القيود اليومية', icon: BookOpen },
      { to: '/accounts', label: 'دليل الحسابات', icon: Landmark },
      { to: '/treasuries', label: 'الخزائن والبنوك', icon: Wallet },
      { to: '/financial-reports', label: 'التقارير المالية', icon: BarChart2 },
      { to: '/daily-closures', label: 'الإغلاق اليومي', icon: Lock },
    ]
  },
  {
    group: 'الموارد البشرية',
    icon: Users,
    items: [
      { to: '/employees', label: 'الموظفين', icon: Users },
      { to: '/loans', label: 'السلف والمقدمات', icon: Wallet },
      { to: '/payroll', label: 'الرواتب والأجور', icon: DollarSign },
    ]
  },
  {
    group: 'الإعدادات',
    icon: Settings,
    items: [
      { to: '/users', label: 'المستخدمين', icon: Users },
      { to: '/departments', label: 'الأقسام', icon: Briefcase },
      { to: '/settings', label: 'إعدادات النظام', icon: Settings },
    ]
  },
]

export default function Sidebar({ open, setOpen }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout, me } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedGroups, setExpandedGroups] = useState(
    menuItems.reduce((acc, _, idx) => ({ ...acc, [idx]: true }), {})
  )

  const toggleGroup = (idx) => {
    setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const getUserInitials = (name) => {
    if (!name) return 'U'
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getRoleDisplayName = (role) => {
    const roleMap = {
      admin: 'مدير النظام',
      manager: 'مدير',
      cashier: 'كاشير',
      accountant: 'محاسب',
      sales: 'مبيعات'
    }
    return roleMap[role?.toLowerCase()] || role || 'مستخدم'
  }

  // Filter menu items based on search AND role
  const filteredMenuItems = (() => {
    let items = menuItems

    // Role-based filtering
    if (me?.role === 'cashier') {
      items = menuItems.map(group => {
        if (group.group === 'المبيعات') {
          return {
            ...group,
            items: group.items.filter(item => item.to === '/pos' || item.to === '/sales-invoices')
          }
        }
        return { ...group, items: [] }
      }).filter(g => g.items.length > 0)
    }

    // Search filtering
    if (searchTerm) {
      return items.map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(group => group.items.length > 0)
    }

    return items
  })()

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'sidebar-overlay lg:hidden',
          open && 'show'
        )}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <aside className={cn('sidebar', open && 'open', 'lg:translate-x-0')}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                E
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">ERP System</h1>
                <p className="text-[10px] text-slate-400">Enterprise v3.0</p>
              </div>
            </div>

            <button
              type="button"
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="بحث سريع..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-9 pe-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500/50 focus:bg-white/10 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav custom-scrollbar">
          {filteredMenuItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Search className="mx-auto text-slate-500 mb-2" size={24} />
              <p className="text-sm text-slate-400">لا توجد نتائج</p>
            </div>
          ) : (
            filteredMenuItems.map((group, idx) => {
              const GroupIcon = group.icon
              const isExpanded = expandedGroups[idx]

              return (
                <div key={idx} className="sidebar-group">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(idx)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <GroupIcon size={14} className="text-slate-500" />
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {group.group}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={cn(
                        'text-slate-500 transition-transform',
                        !isExpanded && '-rotate-90'
                      )}
                    />
                  </button>

                  {/* Group Items */}
                  {isExpanded && (
                    <div className="mt-1 space-y-0.5 animate-slide-down">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.to

                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => {
                              if (window.innerWidth < 1024) setOpen(false)
                            }}
                            className={cn(
                              'sidebar-link relative',
                              isActive && 'active'
                            )}
                          >
                            <Icon size={18} />
                            <span className="flex-1">{item.label}</span>
                            {item.badge && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary-500 text-white rounded">
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
            })
          )}
        </nav>

        {/* User Section */}
        {me && (
          <div className="px-3 py-3 border-t border-white/5">
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold text-sm shadow">
                {me?.name ? getUserInitials(me.name) : <User size={16} />}
              </div>
              <div className="flex-1 text-start min-w-0">
                <p className="text-sm font-semibold text-white truncate">{me?.name || 'مستخدم'}</p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Shield size={9} />
                  {getRoleDisplayName(me?.role)}
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Logout */}
        <div className="sidebar-footer">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-red-400 hover:text-red-300 border border-destructive/20 transition-all"
          >
            <LogOut size={16} />
            <span className="font-medium text-sm">تسجيل خروج</span>
          </button>
        </div>
      </aside>
    </>
  )
}
