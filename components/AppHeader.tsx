import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { LogIn, LogOut, User } from 'lucide-react'
import { Button } from './ui/button'
import { AvatarFallback, AvatarImage, AvatarRoot } from './ui/avatar'
import { SearchBar } from './ui/SearchBar'
import { cn } from '../lib/utils'
import { Profile } from '../lib/db/schema'

interface AppHeaderProps {
  user: Profile | null
  onSignIn: () => void
  onSignOut: () => void
  onSearch?: ((term: string) => void) | null
}

const navLinks = [
  { href: '/', label: 'Feed' },
  { href: '/saved', label: 'Library' },
  { href: '/profile', label: 'Profile' },
]

export const AppHeader = ({ user, onSignIn, onSignOut, onSearch }: AppHeaderProps) => {
  const router = useRouter()

  return (
    <header className="bf-header">
      <div className="bf-header__inner">
        <Link href="/" className="bf-header__logo">
          <span className="bf-header__logo-badge">
            <Image
              src="/betterfeed-logo.svg"
              alt="BetterFeed logo"
              width={56}
              height={56}
              className="bf-header__logo-img"
              priority
            />
          </span>
          <div className="bf-header__logo-text">
            <span className="bf-header__logo-title">BetterFeed</span>
            <span className="bf-header__logo-sub">Sage companion</span>
          </div>
        </Link>

        {/* Add Search Bar */}
        {onSearch && (
          <div className="bf-header__search">
            <SearchBar onSearch={onSearch} />
          </div>
        )}

        <nav className="bf-header__nav">
          {navLinks.map((link) => {
            const isActive = router.pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'bf-header__nav-link',
                  isActive && 'is-active'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="bf-header__actions">
          {user ? (
            <>
              <Link href="/profile" className="bf-header__profile-link">
                <AvatarRoot className="bf-avatar-md">
                  <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                  <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </AvatarRoot>
              </Link>
              <Button variant="ghost" size="sm" onClick={onSignOut}>
                <LogOut className="bf-icon-sm" />
                <span className="bf-show-desktop">Sign out</span>
              </Button>
            </>
          ) : (
            <Button variant="default" size="sm" onClick={onSignIn}>
              <LogIn className="bf-icon-sm" />
              Sign in
            </Button>
          )}
          <button
            type="button"
            className={cn(
              'bf-header__profile-toggle',
              router.pathname === '/profile' && 'is-active'
            )}
            onClick={() => {
              if (router.pathname === '/profile') return
              router.push('/profile')
            }}
          >
            <User className="bf-icon-sm" />
          </button>
        </div>
      </div>
    </header>
  )
}
