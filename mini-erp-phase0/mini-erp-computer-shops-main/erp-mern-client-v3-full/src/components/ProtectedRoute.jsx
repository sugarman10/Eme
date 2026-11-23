import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ShieldAlert, RefreshCw } from 'lucide-react'

export default function ProtectedRoute({ children, allowedRoles, roles, perm, requiredPerm, fallbackTo, redirectTo }) {
  const { token, user, me } = useAuth()
  const currentUser = user || me
  const requiredRoles = roles || allowedRoles
  const checkPerm = perm || requiredPerm
  const fallback = fallbackTo || redirectTo

  // 1. Not authenticated -> Redirect to login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // 2. Token present but user profile still loading -> show clean loader to prevent leakage
  if (token && !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 gap-3 text-slate-500">
        <RefreshCw size={28} className="animate-spin text-primary" />
        <span className="text-xs font-bold">جاري التحقق من الصلاحيات...</span>
      </div>
    )
  }

  // 3. Admin has unrestricted bypass
  if (currentUser?.role === 'admin' || currentUser?.permissions?.includes('*')) {
    return children
  }

  // 4. Fine-grained Permission Check
  if (checkPerm) {
    const userPerms = Array.isArray(currentUser?.permissions) ? currentUser.permissions : []
    if (!userPerms.includes(checkPerm)) {
      if (fallback) return <Navigate to={fallback} replace />
      return (
        <div className="flex flex-col items-center justify-center min-h-[420px] p-6 text-center animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-sm border border-rose-200 dark:border-rose-800">
            <ShieldAlert size={34} />
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white mb-1.5">صلاحية الوصول غير متوفرة</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-5">
            عذراً، لا يمتلك حسابك الصلاحية المعتمدة للدخول إلى هذه الشاشة. يرجى مراجعة مدير النظام لمنحك الصلاحية المطلوبة.
          </p>
          <a
            href="/pos"
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow hover:bg-primary/90 transition-colors"
          >
            الانتقال إلى شاشة المبيعات (POS)
          </a>
        </div>
      )
    }
    return children
  }

  // 5. Role Check (Fallback)
  if (requiredRoles && requiredRoles.length > 0) {
    const userRole = (currentUser?.role || '').toLowerCase()
    const allowed = requiredRoles.map(r => r.toLowerCase())
    if (!allowed.includes(userRole)) {
      if (fallback) return <Navigate to={fallback} replace />
      return (
        <div className="flex flex-col items-center justify-center min-h-[420px] p-6 text-center animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 shadow-sm border border-rose-200 dark:border-rose-800">
            <ShieldAlert size={34} />
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white mb-1.5">الدور غير مصرح به</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-5">
            هذه الشاشة محصورة بأدوار محددة في المنظومة.
          </p>
          <a
            href="/pos"
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow hover:bg-primary/90 transition-colors"
          >
            الانتقال إلى شاشة المبيعات (POS)
          </a>
        </div>
      )
    }
  }

  return children
}
