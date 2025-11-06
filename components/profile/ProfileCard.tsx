import { useState } from 'react'
import { Camera } from 'lucide-react'
import { AvatarFallback, AvatarImage, AvatarRoot } from '../ui/avatar'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

interface Profile {
  id: string
  email: string
  username: string
  avatar_url?: string
  created_at?: string
}

interface ProfileCardProps {
  profile: Profile
  onUpdate: (data: { username: string; avatar_url?: string }) => Promise<void>
}

export const ProfileCard = ({ profile, onUpdate }: ProfileCardProps) => {
  const [username, setUsername] = useState(profile.username)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [status, setStatus] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await onUpdate({ username, avatar_url: avatarUrl })
    setStatus('Profile updated!')
    setTimeout(() => setStatus(null), 2500)
  }

  return (
    <form onSubmit={handleSubmit} className="bf-profile-card">
      <div className="bf-profile-card__header">
        <div className="bf-profile-card__avatar-wrapper">
          <AvatarRoot className="bf-avatar-lg">
            <AvatarImage src={avatarUrl} alt={profile.username} />
            <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </AvatarRoot>
          <span className="bf-profile-card__camera">
            <Camera className="bf-icon-sm" />
          </span>
        </div>
        <div className="bf-profile-card__details">
          <h2 className="bf-profile-card__name">{profile.username}</h2>
          <p className="bf-profile-card__meta">Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Recently'}</p>
          <p className="bf-profile-card__email">{profile.email}</p>
        </div>
      </div>

      <div className="bf-profile-card__form">
        <div className="bf-field">
          <label htmlFor="profile-username" className="bf-field__label">
            Display name
          </label>
          <Input
            id="profile-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>
        <div className="bf-field">
          <label htmlFor="profile-avatar" className="bf-field__label">
            Avatar URL
          </label>
          <Input
            id="profile-avatar"
            type="url"
            placeholder="https://"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
          />
        </div>
      </div>

      {status ? <p className="bf-status">{status}</p> : null}

      <Button type="submit" className="bf-profile-card__submit">
        Save changes
      </Button>
    </form>
  )
}

