import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

interface LoginFormProps {
  loading: boolean
  onSubmit: (data: { email: string; password: string }) => Promise<void>
  onForgotPassword: () => void
}

export const LoginForm = ({ loading, onSubmit, onForgotPassword }: LoginFormProps) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setError(null)
      await onSubmit({ email, password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bf-form">
      <div className="bf-field">
        <label className="bf-field__label" htmlFor="login-email">
          Email address
        </label>
        <Input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="bf-field">
        <label className="bf-field__label" htmlFor="login-password">
          Password
        </label>
        <Input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          required
        />
      </div>

      {error ? <p className="bf-error">{error}</p> : null}

      <div className="bf-form__footer">
        <button
          type="button"
          onClick={onForgotPassword}
          className="bf-link"
        >
          Forgot password?
        </button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </div>
    </form>
  )
}

