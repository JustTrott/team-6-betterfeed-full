import { useRouter } from 'next/router'
import Link from 'next/link'
import { SignupForm } from '../components/auth/SignupForm'
import { useAuthStore } from '../store/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const { signup, loading } = useAuthStore()

  return (
    <div className="bf-auth-shell">
      <Card className="bf-auth-card">
        <CardHeader>
          <CardTitle>Create your feed persona</CardTitle>
          <CardDescription>Choose a display name the AI will reference in chats.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm
            loading={loading}
            onSubmit={async ({ email, username }) => {
              await signup({ email, username })
              router.push('/')
            }}
          />
          <p className="bf-auth-footer">
            Already have an account?{' '}
            <Link href="/login" className="bf-link">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

