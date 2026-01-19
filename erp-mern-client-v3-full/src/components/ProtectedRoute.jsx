import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles, roles }) {
  const { token, user } = useAuth()
  const requiredRoles = roles || allowedRoles

  if (!token) return <Navigate to="/login" replace />

  if (requiredRoles && user) {
    if (!requiredRoles.includes(user.role)) {
      // Optional: Redirect to a 403 page or just dashboard with error
      return <div className="p-10 text-center text-red-600 font-bold">عذراً، لا تملك الصلاحية للدخول لهذه الصفحة (403).</div>
    }
  }

  return children
}
