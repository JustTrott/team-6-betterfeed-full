import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

interface SignupFormProps {
  loading: boolean
  onSubmit: (data: { email: string; username: string }) => Promise<void>
}

export const SignupForm = ({ loading, onSubmit }: SignupFormProps) => {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      setError(null)
      await onSubmit({ email, username })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign up')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bf-form">
      <div className="bf-field">
        <label className="bf-field__label" htmlFor="signup-email">
          Email
        </label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="bf-field">
        <label className="bf-field__label" htmlFor="signup-username">
          Display name
        </label>
        <Input
          id="signup-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="ScienceFan"
          required
        />
      </div>

      {error ? <p className="bf-error">{error}</p> : null}

      <Button type="submit" className="bf-button--block" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}

