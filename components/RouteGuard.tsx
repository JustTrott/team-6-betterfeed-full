import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useAuthStore } from '../store/auth'

interface RouteGuardProps {
  children: React.ReactNode
}

export const RouteGuard = ({ children }: RouteGuardProps) => {
  const { user, initialized } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (initialized && !user) {
      router.push('/login')
    }
  }, [initialized, user, router])

  if (!initialized) {
    return (
      <div className="bf-fullscreen-message">
        Loading experience…
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}

