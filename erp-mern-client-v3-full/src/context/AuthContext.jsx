import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

const Ctx = createContext()
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [me, setMe] = useState(null)

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token)
      // الهيدر سيتولّى إضافته interceptor في api تلقائياً
      api.get('/auth/me').then(({ data }) => setMe(data)).catch(() => setMe(null))
    } else {
      localStorage.removeItem('token')
      setMe(null)
    }
  }, [token])

  const logout = () => {
    setToken('')
  }

  return (
    <Ctx.Provider value={{ token, setToken, me, user: me, logout }}>
      {children}
    </Ctx.Provider>
  )
}
