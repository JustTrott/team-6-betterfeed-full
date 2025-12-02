import { Bookmark, Eye, Heart } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EngagementBarProps {
  likes: number
  saves: number
  onLike: () => void
  onSave: () => void
  active: { like: boolean; save: boolean }
}

export const EngagementBar = ({ likes, saves, onLike, onSave, active }: EngagementBarProps) => {
  return (
    <div className="bf-engagement-bar">
      <button
        type="button"
        onClick={onLike}
        className={cn(
          'bf-engagement-bar__button',
          active.like && 'is-active'
        )}
      >
        <Heart className={cn('bf-icon-sm', active.like && 'is-active')} />
        <span className="bf-engagement-bar__value">{likes}</span>
      </button>
      <button
        type="button"
        onClick={onSave}
        className={cn(
          'bf-engagement-bar__button bf-engagement-bar__button--save',
          active.save && 'is-active'
        )}
      >
        <Bookmark className={cn('bf-icon-sm', active.save && 'is-active')} />
        <span className="bf-engagement-bar__value">{saves}</span>
      </button>
    </div>
  )
}