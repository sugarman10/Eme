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

      // Redirect based on role
      const role = (res.data.user?.role || '').toLowerCase()
      if (role === 'cashier') {
        window.location.href = '/pos'
      } else {
        window.location.href = '/'
      }
    } catch (e) {
      push('error', e?.response?.data?.message || 'فشل تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 -z-10 h-full w-full bg-white opacity-20"
        style={{ background: 'radial-gradient(125% 125% at 50% 10%, #fff 40%, #63e 100%)' }}
      ></div>

      <Card className="w-full max-w-md shadow-xl bg-white/80 backdrop-blur-xl">
        <CardHeader className="text-center pb-2 pt-8 flex flex-col gap-4">
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto shadow-lg"
            style={{ background: 'linear-gradient(to bottom right, var(--primary), #9333ea)', transform: 'rotate(3deg)' }}
          >
            <LayoutDashboard size={40} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">تسجيل الدخول</h1>
            <p className="text-muted-foreground mt-2 text-sm">مرحباً بك في نظام ERP المتكامل</p>
          </div>
        </CardHeader>

        <CardContent className="p-8 pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-foreground">اسم المستخدم</label>
              <Input
                type="text"
                placeholder="اسم المستخدم"
                className={`bg-white h-12 ${errors.username ? 'border-destructive' : ''}`}
                {...register('username')}
              />
              {errors.username && (
                <span className="text-xs text-destructive font-medium">{errors.username.message}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-foreground">كلمة المرور</label>
                <a href="#" className="text-xs text-primary hover:underline" style={{ textDecoration: 'none' }}>نسيت كلمة المرور؟</a>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                className={`bg-white h-12 ${errors.password ? 'border-destructive' : ''}`}
                {...register('password')}
              />
              {errors.password && (
                <span className="text-xs text-destructive font-medium">{errors.password.message}</span>
              )}
            </div>

            <Button
              disabled={loading}
              className="w-full h-12 text-base font-bold shadow-lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin" style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
                  جاري التحقق...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn size={20} />
                  تسجيل الدخول
                </span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center bg-muted p-6 border-t">
          <p className="text-xs text-muted-foreground font-medium">
            جميع الحقوق محفوظة © {new Date().getFullYear()} ERP System
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
