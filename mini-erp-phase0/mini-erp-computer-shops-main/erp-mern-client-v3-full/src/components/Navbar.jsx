import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Bell, Search, User, Menu, X, Check, Info, AlertTriangle,
    ChevronDown, LogOut, Settings, Calendar, Clock, UserCircle2,
    Shield, Moon, Sun
} from 'lucide-react'
import { WarehouseSelector } from './WarehouseSelector'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { initDarkMode, toggleDarkMode, isDarkMode } from '../utils/darkMode'
import { cn } from '../lib/utils'

export default function Navbar({ toggleSidebar }) {
    const navigate = useNavigate()
    const { me, logout } = useAuth()

    const [showNotifications, setShowNotifications] = useState(false)
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [dark, setDark] = useState(false)

    const notificationRef = useRef(null)
    const userMenuRef = useRef(null)
    const searchInputRef = useRef(null)

    // Initialize time, click handlers, and dark mode
    useEffect(() => {
        initDarkMode()
        setDark(isDarkMode())

        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false)
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            clearInterval(timer)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                searchInputRef.current?.focus()
            }
            if (e.key === 'Escape') {
                setShowNotifications(false)
                setShowUserMenu(false)
            }
        }

        document.addEventListener('keydown', handleKeyPress)
        return () => document.removeEventListener('keydown', handleKeyPress)
    }, [])

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
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n))
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
            console.error('Failed to mark all as read', error)
        }
    }

    const getIcon = (type) => {
        switch (type) {
            case 'warning': return <AlertTriangle size={14} className="text-warning" />
            case 'success': return <Check size={14} className="text-success" />
            default: return <Info size={14} className="text-primary" />
        }
    }

    const handleLogout = () => {
        logout()
        navigate('/login')
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

    return (
        <header className="navbar">
            {/* Mobile Menu Toggle */}
            <button
                type="button"
                className="lg:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                onClick={toggleSidebar}
                aria-label="Toggle Sidebar"
            >
                <Menu size={22} />
            </button>

            <div className="flex flex-1 items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="navbar-search hidden md:block">
                    <Search size={18} className="navbar-search-icon" />
                    <input
                        ref={searchInputRef}
                        type="search"
                        placeholder="بحث سريع (Ctrl + K)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search"
                    />
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 ms-auto">
                    {/* Date & Time */}
                    <div className="hidden xl:flex flex-col items-end text-end me-2">
                        <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <span className="tabular-nums font-mono">
                                {currentTime.toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                })}
                            </span>
                            <Clock size={14} className="text-primary" />
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            {currentTime.toLocaleDateString('ar-EG', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'short'
                            })}
                            <Calendar size={12} className="text-muted-foreground" />
                        </div>
                    </div>

                    {/* Warehouse Selector */}
                    <WarehouseSelector />

                    <div className="h-6 w-px bg-border hidden xl:block mx-1" />

                    {/* Dark Mode Toggle */}
                    <button
                        type="button"
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                        onClick={() => setDark(toggleDarkMode())}
                        aria-label="Toggle Dark Mode"
                        title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
                    >
                        {dark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    {/* Notifications */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            type="button"
                            className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                            onClick={() => setShowNotifications(!showNotifications)}
                            aria-label="Notifications"
                            aria-expanded={showNotifications}
                        >
                            <Bell size={18} />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 end-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-white" />
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute start-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 animate-scale-in overflow-hidden">
                                <div className="p-3 border-b border-border flex justify-between items-center">
                                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                                        <Bell size={16} className="text-primary" />
                                        الإشعارات
                                        {unreadCount > 0 && (
                                            <span className="text-xs text-muted-foreground">({unreadCount})</span>
                                        )}
                                    </h3>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={markAllAsRead}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            تحديد الكل كمقروء
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className="py-10 px-4 text-center">
                                            <Bell className="mx-auto text-muted-foreground/30 mb-2" size={28} />
                                            <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
                                        </div>
                                    ) : (
                                        notifications.map(notification => (
                                            <div
                                                key={notification._id}
                                                className={cn(
                                                    'p-3 border-b border-border last:border-0 hover:bg-muted transition-colors cursor-pointer',
                                                    !notification.read && 'bg-primary-50/50'
                                                )}
                                                onClick={() => markAsRead(notification._id)}
                                            >
                                                <div className="flex gap-3 items-start">
                                                    <div className={cn(
                                                        'p-1.5 rounded-full',
                                                        notification.type === 'warning' ? 'bg-warning-50 text-warning' :
                                                            notification.type === 'success' ? 'bg-success-50 text-success' :
                                                                'bg-primary-50 text-primary'
                                                    )}>
                                                        {getIcon(notification.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <span className={cn(
                                                                'text-sm truncate',
                                                                !notification.read ? 'font-semibold text-foreground' : 'text-muted-foreground'
                                                            )}>
                                                                {notification.title}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                                {notification.time}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                                            {notification.message}
                                                        </p>
                                                    </div>
                                                    {!notification.read && (
                                                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="relative" ref={userMenuRef}>
                        <button
                            className="flex items-center gap-2.5 p-1.5 ps-3 hover:bg-muted rounded-full transition-colors border border-transparent hover:border-border"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            aria-label="User Menu"
                            aria-expanded={showUserMenu}
                        >
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white shadow font-semibold text-xs">
                                {me?.name ? getUserInitials(me.name) : <User size={16} />}
                            </div>
                            <div className="hidden md:block text-start">
                                <p className="text-sm font-semibold text-foreground leading-none">
                                    {me?.name || 'مستخدم'}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Shield size={9} />
                                    {getRoleDisplayName(me?.role)}
                                </p>
                            </div>
                            <ChevronDown size={14} className={cn(
                                'text-muted-foreground transition-transform hidden md:block',
                                showUserMenu && 'rotate-180'
                            )} />
                        </button>

                        {showUserMenu && (
                            <div className="absolute start-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 animate-scale-in overflow-hidden">
                                <div className="p-3 border-b border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold shadow">
                                            {me?.name ? getUserInitials(me.name) : <User size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {me?.name || 'مستخدم'}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {me?.email || 'user@example.com'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-1">
                                    <button
                                        onClick={() => { navigate('/profile'); setShowUserMenu(false) }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
                                    >
                                        <UserCircle2 size={16} />
                                        <span>الملف الشخصي</span>
                                    </button>
                                    <button
                                        onClick={() => { navigate('/settings'); setShowUserMenu(false) }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
                                    >
                                        <Settings size={16} />
                                        <span>الإعدادات</span>
                                    </button>
                                </div>
                                <div className="p-1 border-t border-border">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-destructive hover:bg-destructive-50 rounded-lg transition-colors"
                                    >
                                        <LogOut size={16} />
                                        <span>تسجيل الخروج</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
