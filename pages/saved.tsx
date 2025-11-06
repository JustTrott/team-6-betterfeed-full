import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { useAuthStore } from '../store/auth'
import { FeedCard } from '../components/feed/FeedCard'
import { AIChatPanel } from '../components/AIChatPanel'
import { useToast } from '../context/toast'

export default function SavedPage() {
  const { user } = useAuthStore()
  const { pushToast } = useToast()
  const [posts, setPosts] = useState<any[]>([])
  const [activePost, setActivePost] = useState<any>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const refresh = () => {
    if (!user) return
    db.getSavedPosts(user.id).then(setPosts)
  }

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user?.id])

  const handleToggle = async (postId: number | string) => {
    if (!user) {
      pushToast({ title: 'Sign in required' })
      return
    }
    await db.toggleInteraction(user.id, postId, 'save')
    refresh()
  }

  return (
    <div className="bf-page">
      <header className="bf-page__header">
        <h1 className="bf-page__title">Saved library</h1>
        <p className="bf-page__subtitle">Keep your favorite explainers close for fast recaps.</p>
      </header>

      <div className="bf-feed-grid">
        {posts.length === 0 ? (
          <div className="bf-empty-state">
            No saved posts yet. Tap the bookmark icon on any card to start collecting.
          </div>
        ) : (
          posts.map((post) => (
            <FeedCard
              key={post.id}
              post={post}
              isLiked={false}
              isSaved={true}
              onLike={() => pushToast({ title: 'Likes sync to feed', description: 'Head back to the feed to react.' })}
              onSave={() => handleToggle(post.id)}
              onOpen={() => {
                setActivePost(post)
                setPanelOpen(true)
              }}
            />
          ))
        )}
      </div>

      <AIChatPanel open={panelOpen} onClose={() => setPanelOpen(false)} post={activePost} style="professor" />
    </div>
  )
}

