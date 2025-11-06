import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { db } from '../lib/db'
import { useAuthStore } from '../store/auth'
import { ProfileCard } from '../components/profile/ProfileCard'
import { ReadingHistorySection } from '../components/profile/ReadingHistorySection'
import { Badge } from '../components/ui/badge'

export default function ProfilePage() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [interactions, setInteractions] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])

  useEffect(() => {
    if (!user) return
    db.getUserInteractions(user.id).then(setInteractions)
    db.getPosts({ limit: 200 }).then((response) => {
      setPosts(response.items)
    })
  }, [user?.id])

  if (!user) {
    return null
  }

  const likedCount = interactions.filter((item) => item.interaction_type === 'like').length
  const savedCount = interactions.filter((item) => item.interaction_type === 'save').length

  const authoredPosts = posts.filter((post) => post.user_id === user.id)

  const handlePostClick = (post: any) => {
    router.push(`/post/${post.id}`)
  }

  return (
    <div className="bf-page bf-page--narrow">
      <ProfileCard
        profile={user}
        onUpdate={async (payload) => {
          const updated = await db.updateProfile({ id: user.id, ...payload })
          useAuthStore.setState({ user: updated })
        }}
      />

      <section className="bf-panel">
        <header className="bf-panel__header">
          <div>
            <h3 className="bf-panel__title">Your activity snapshot</h3>
            <p className="bf-panel__description">Tracking your taps across BetterFeed.</p>
          </div>
          <button type="button" onClick={logout} className="bf-link">
            Sign out
          </button>
        </header>

        <div className="bf-counter-grid">
          <div className="bf-counter bf-counter--likes">
            <p className="bf-counter__label">Liked posts</p>
            <p className="bf-counter__value">{likedCount}</p>
          </div>
          <div className="bf-counter bf-counter--saves">
            <p className="bf-counter__label">Saved for later</p>
            <p className="bf-counter__value">{savedCount}</p>
          </div>
          <div className="bf-counter bf-counter--posts">
            <p className="bf-counter__label">Stories posted</p>
            <p className="bf-counter__value">{authoredPosts.length}</p>
          </div>
        </div>
      </section>

      {/* Add Reading History Section */}
      <ReadingHistorySection posts={posts} onPostClick={handlePostClick} />

      <section className="bf-panel bf-panel--light">
        <div className="bf-panel__header">
          <h3 className="bf-panel__title">Recently authored</h3>
          <Link href="/" className="bf-link">
            Back to feed
          </Link>
        </div>
        {authoredPosts.length === 0 ? (
          <div className="bf-empty-state">
            No posts yet. Share a link from the feed composer to see it here.
          </div>
        ) : (
          <div className="bf-authored-list">
            {authoredPosts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="bf-authored-card"
              >
                <div>
                  <p className="bf-authored-card__title">{post.title}</p>
                  <p className="bf-authored-card__date">{new Date(post.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant="muted">{post.category}</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

