import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuthStore } from '../store/auth'
import { ProfileCard } from '../components/profile/ProfileCard'
import { ReadingHistorySection } from '../components/profile/ReadingHistorySection'
import { Badge } from '../components/ui/badge'
import type { Post, Profile } from '../lib/db/schema'
import type { Interaction } from '../lib/db/schema'
import { useToast } from '../context/toast'

export default function ProfilePage() {
  const router = useRouter()
  const { user, logout, accessToken } = useAuthStore()
  const { pushToast } = useToast()
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [posts, setPosts] = useState<Post[]>([])

  useEffect(() => {
    if (!user) return

    const fetchData = async () => {
      try {
        // Fetch all posts
        const postsResponse = await fetch('/api/posts')
        if (!postsResponse.ok) throw new Error('Failed to fetch posts')
        const allPosts: Post[] = await postsResponse.json()
        setPosts(allPosts)

        // Fetch all interactions for all posts to get user's interactions
        const interactionPromises = allPosts.map(async (post) => {
          const response = await fetch(`/api/interactions/${post.id}`)
          if (response.ok) {
            const interactions: Interaction[] = await response.json()
            return interactions.filter((i) => i.user_id === user.id)
          }
          return []
        })

        const allUserInteractions = (await Promise.all(interactionPromises)).flat()
        setInteractions(allUserInteractions)
      } catch (error) {
        console.error('Error fetching profile data:', error)
        pushToast({ title: 'Error', description: 'Failed to load profile data', variant: 'error' })
      }
    }

    fetchData()
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
          if (!accessToken) {
            pushToast({ title: 'Error', description: 'Authentication required', variant: 'error' })
            return
          }

          try {
            const response = await fetch('/api/auth/profile', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(payload),
            })

            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.error || 'Failed to update profile')
            }

            const updated: Profile = await response.json()
            useAuthStore.setState({ user: updated })
            pushToast({ title: 'Success', description: 'Profile updated', variant: 'success' })
          } catch (error) {
            console.error('Error updating profile:', error)
            pushToast({ 
              title: 'Error', 
              description: error instanceof Error ? error.message : 'Failed to update profile', 
              variant: 'error' 
            })
          }
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
                <Badge variant="muted">Article</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

