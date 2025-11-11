import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../context/toast'
import { useAuthStore } from '../store/auth'
import { AppHeader } from '../components/AppHeader'
import { RouteGuard } from '../components/RouteGuard'
import "@/styles/globals.css"
import type { AppProps } from "next/app"
import { useRouter } from 'next/router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function AuthHydrator({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate)
  
  useEffect(() => {
    hydrate()
  }, [hydrate])
  
  return <>{children}</>
}

function AppShell({ Component, pageProps }: { Component: AppProps['Component']; pageProps: AppProps['pageProps'] }) {
  const router = useRouter()
  const { user, logout, initialized } = useAuthStore()
  
  const isAuthPage = router.pathname === '/login' || router.pathname === '/signup'
  
  if (isAuthPage) {
    return <Component {...pageProps} />
  }

  return (
    <div className="bf-app-shell">
      <AppHeader
        user={user}
        onSignIn={() => router.push('/login')}
        onSignOut={logout}
        onSearch={router.pathname === '/' ? (term: string) => {
          // Search will be handled in FeedPage
          window.dispatchEvent(new CustomEvent('feed-search', { detail: term }))
        } : null}
      />
      <main className="bf-main">
        {!initialized ? (
          <div className="bf-loader">Booting BetterFeed…</div>
        ) : (
          <Component {...pageProps} />
        )}
      </main>
    </div>
  )
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthHydrator>
          <AppShell Component={Component} pageProps={pageProps} />
        </AuthHydrator>
      </ToastProvider>
    </QueryClientProvider>
  )
}
