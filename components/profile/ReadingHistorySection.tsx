import { useEffect, useState } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { readingHistory } from '../../lib/readingHistory'
import { ReadBadge } from '../feed/ReadBadge'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

interface Post {
  id: number | string
  title: string
  category: string
  source: string
  thumbnail_url: string
  readAt?: string
}

interface ReadingHistorySectionProps {
  posts: Post[]
  onPostClick: (post: Post) => void
}

export const ReadingHistorySection = ({ posts, onPostClick }: ReadingHistorySectionProps) => {
  const [history, setHistory] = useState<Post[]>([])

  useEffect(() => {
    loadHistory()
  }, [posts])

  const loadHistory = () => {
    const historyWithPosts = readingHistory.getHistoryWithPosts(posts) as Post[]
    setHistory(historyWithPosts)
  }

  const handleClearHistory = () => {
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to clear your reading history?')) {
      readingHistory.clearHistory()
      setHistory([])
    }
  }

  const handleRemoveItem = (postId: number | string, e: React.MouseEvent) => {
    e.stopPropagation()
    readingHistory.removeFromHistory(postId)
    loadHistory()
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  if (history.length === 0) {
    return (
      <section className="bf-panel bf-panel--light">
        <div className="bf-panel__header">
          <h3 className="bf-panel__title">Reading History</h3>
        </div>
        <div className="bf-empty-state">
          <Clock size={48} color="var(--color-muted)" />
          <p>No reading history yet</p>
          <p className="bf-empty-state__hint">Articles you read will appear here</p>
        </div>
      </section>
    )
  }

  return (
    <section className="bf-panel">
      <div className="bf-panel__header">
        <div>
          <h3 className="bf-panel__title">Reading History</h3>
          <p className="bf-panel__description">Track your journey through the feed</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClearHistory}>
          <Trash2 className="bf-icon-sm" />
          Clear All
        </Button>
      </div>

      <div className="bf-history-list">
        {history.map((item) => (
          <div 
            key={item.id} 
            className="bf-history-item"
            onClick={() => onPostClick(item)}
          >
            <div className="bf-history-item__content">
              <div className="bf-history-item__meta">
                <Badge variant="default">{item.category}</Badge>
                <ReadBadge isRead={true} compact />
              </div>
              
              <h4 className="bf-history-item__title">{item.title}</h4>
              
              <div className="bf-history-item__footer">
                <span className="bf-history-item__timestamp">
                  <Clock size={14} />
                  {item.readAt ? formatDate(item.readAt) : 'Recently'}
                </span>
                <span className="bf-history-item__source">{item.source}</span>
              </div>
            </div>

            <button
              onClick={(e) => handleRemoveItem(item.id, e)}
              className="bf-history-item__remove"
              aria-label="Remove from history"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

