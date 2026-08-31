import { useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, LogIn, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { SavMark } from '@/components/brand/SavLogo'
import { useAuthStore } from '@/store/useAuthStore'

interface LoginValues {
  email: string
  password: string
}

export function LoginPage() {
  const { user, login, loginError } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [failed, setFailed] = useState(false)

  const form = useForm<LoginValues>({ defaultValues: { email: '', password: '' } })

  if (user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: LoginValues) {
    const ok = await login(values.email, values.password)
    if (ok) {
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from ?? '/', { replace: true })
    } else {
      setFailed(true)
      form.resetField('password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm page-enter">
        <div className="flex flex-col items-center gap-3 mb-6">
          <SavMark className="h-14 w-14" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Sign in to Sav</h1>
            <p className="text-sm text-muted-foreground mt-1">QA Test Execution Dashboard</p>
          </div>
        </div>

        <Card className="p-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@sav.money"
                autoComplete="username"
                autoFocus
                {...form.register('email', { required: true })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  {...form.register('password', { required: true })}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {failed && (
              <div className="flex items-center gap-2 rounded-lg border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {loginError ?? 'Invalid email or password.'}
              </div>
            )}

            <Button type="submit" className="w-full mt-1" disabled={form.formState.isSubmitting}>
              <LogIn /> {form.formState.isSubmitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-faint mt-4">
          QA workspace access only. Contact your admin if you need an account.
        </p>
      </div>
    </div>
  )
}
