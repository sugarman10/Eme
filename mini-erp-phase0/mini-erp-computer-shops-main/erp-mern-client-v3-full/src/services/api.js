// src/services/api.js
import axios from 'axios'

export const resolveBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.origin && !window.location.port.includes('5173') && window.location.protocol.startsWith('http')) {
      return `${window.location.origin}/api`
    }
  }
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000/api'
}

const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 60000
})

// Request Interceptor: Add Bearer Token and Fiscal Period Headers
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  const periodId = localStorage.getItem('active_fiscal_period_id')
  const periodStart = localStorage.getItem('active_fiscal_period_start')
  const periodEnd = localStorage.getItem('active_fiscal_period_end')
  const periodName = localStorage.getItem('active_fiscal_period_name')

  if (periodId) config.headers['x-fiscal-period-id'] = periodId
  if (periodStart) config.headers['x-fiscal-start-date'] = periodStart
  if (periodEnd) config.headers['x-fiscal-end-date'] = periodEnd
  if (periodName) config.headers['x-fiscal-year'] = encodeURIComponent(periodName)

  return config
}, (error) => {
  return Promise.reject(error)
})

// Response Interceptor: Global Error Handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status

    // Handle 401 Unauthorized (Expired/Invalid Token)
    if (status === 401) {
      // 1. Clear all auth-related data
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('warehouse')

      // 2. Force redirect to login page
      // Using window.location.href ensures a hard refresh and state reset
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
