import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { LogIn, LayoutDashboard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardFooter } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

// Validation Schema
const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
})

export default function Login() {
  const { setToken } = useAuth()
  const { push } = useToast()
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: ''
    }
  })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', data)
      setToken(res.data.token)
      push('success', 'تم تسجيل الدخول بنجاح')

      // Redirect based on role: Dashboard (/) is restricted to admin only!
      const role = (res.data.user?.role || '').toLowerCase()
      if (role === 'admin') {
        window.location.href = '/'
      } else {
        window.location.href = '/pos'
      }
    } catch (e) {
      push('error', e?.response?.data?.message || 'فشل تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark p-4 relative overflow-hidden">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-primary/20 rounded-full blur-[100px] animate-pulse-ring"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-accent/20 rounded-full blur-[100px] animate-pulse-ring" style={{ animationDelay: '1s' }}></div>
      </div>

      <Card className="w-full max-w-md shadow-2xl relative z-10 card-premium border-white/10 animate-scale-in">
        <CardHeader className="text-center pb-2 pt-8 flex flex-col gap-4">
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto shadow-2xl bg-gradient-to-br from-primary to-accent mb-2 animate-float"
            style={{ transform: 'rotate(-5deg)' }}
          >
            <LayoutDashboard size={48} className="text-white drop-shadow-md" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              مرحباً بك
            </h1>
            <p className="text-muted-foreground text-sm font-medium">سجل دخولك للمتابعة إلى النظام</p>
          </div>
        </CardHeader>

        <CardContent className="p-8 pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground/80">اسم المستخدم</label>
              <div className="relative group">
                <Input
                  type="text"
                  placeholder="ادخل اسم المستخدم"
                  className={`bg-white/50 border-slate-200 h-12 transition-all duration-300 focus:bg-white input-glow ${errors.username ? 'border-destructive' : ''}`}
                  {...register('username')}
                />
              </div>
              {errors.username && (
                <span className="text-xs text-destructive font-bold animate-slide-down block">{errors.username.message}</span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground/80">كلمة المرور</label>
              <div className="relative">
                <Input
                  type="password"
                  placeholder="••••••••"
                  className={`bg-white/50 border-slate-200 h-12 transition-all duration-300 focus:bg-white input-glow ${errors.password ? 'border-destructive' : ''}`}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <span className="text-xs text-destructive font-bold animate-slide-down block">{errors.password.message}</span>
              )}
            </div>

            <Button
              disabled={loading}
              className="w-full h-12 text-base font-bold shadow-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all btn-glow mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                  جاري التحقق...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  تسجيل الدخول <LogIn size={20} />
                </span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center bg-white/5 p-6 border-t border-white/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground font-medium opacity-80">
              جميع الحقوق محفوظة © {new Date().getFullYear()} ERP System
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
