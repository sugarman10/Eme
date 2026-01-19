// src/services/api.js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000/api',
  timeout: 60000
})

// Request Interceptor: Add Bearer Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
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
