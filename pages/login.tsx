import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { LoginForm } from '../components/auth/LoginForm'
import { ResetPasswordForm } from '../components/auth/ResetPasswordForm'
import { useAuthStore } from '../store/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const { login, resetPassword, loading } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'reset'>('login')

  const handleSuccess = () => {
    const redirect = router.query.from?.toString() || '/'
    router.push(redirect)
  }

  return (
    <div className="bf-auth-shell">
      <Card className="bf-auth-card">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Welcome back' : 'Reset password'}</CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Sign in with the email linked to your BetterFeed profile.'
              : "We'll send a playful reset nudge to your inbox."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' ? (
            <LoginForm
              loading={loading}
              onForgotPassword={() => setMode('reset')}
              onSubmit={async ({ email }) => {
                await login(email)
                handleSuccess()
              }}
            />
          ) : (
            <ResetPasswordForm
              loading={loading}
              onBack={() => setMode('login')}
              onSubmit={({ email }) => resetPassword(email)}
            />
          )}

          <div className="bf-auth-footer">
            <span>
              Need an account?{' '}
              <Link href="/signup" className="bf-link">
                Sign up
              </Link>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

