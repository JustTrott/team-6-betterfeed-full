import { useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

interface ResetPasswordFormProps {
  loading: boolean
  onSubmit: (data: { email: string }) => Promise<void>
  onBack: () => void
}

export const ResetPasswordForm = ({ loading, onSubmit, onBack }: ResetPasswordFormProps) => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus(null)
    await onSubmit({ email })
    setStatus('Check your inbox for the magic reset link!')
  }

  return (
    <form onSubmit={handleSubmit} className="bf-form">
      <div className="bf-field">
        <label className="bf-field__label" htmlFor="reset-email">
          Email
        </label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      {status ? <p className="bf-status">{status}</p> : null}

      <div className="bf-form__footer">
        <button type="button" onClick={onBack} className="bf-link">
          Back to sign in
        </button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </div>
    </form>
  )
}

