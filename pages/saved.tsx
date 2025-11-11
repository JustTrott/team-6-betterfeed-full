import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { FeedCard } from '../components/feed/FeedCard'
import { AIChatPanel } from '../components/AIChatPanel'
import { useToast } from '../context/toast'
import type { Post } from '../lib/db/schema'
import type { Interaction } from '../lib/db/schema'

export default function SavedPage() {
  const { user, accessToken } = useAuthStore()
  const { pushToast } = useToast()
  const [posts, setPosts] = useState<Post[]>([])
  const [activePost, setActivePost] = useState<Post | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  const refresh = async () => {
    if (!user) return
    
    try {
      // Fetch all posts
      const postsResponse = await fetch('/api/posts')
      if (!postsResponse.ok) throw new Error('Failed to fetch posts')
      const allPosts: Post[] = await postsResponse.json()
      
      // Fetch all interactions to find saved posts
      const savedPostIds = new Set<number>()
      const interactionPromises = allPosts.map(async (post) => {
        const interactionsResponse = await fetch(`/api/interactions/${post.id}`)
        if (interactionsResponse.ok) {
          const interactions: Interaction[] = await interactionsResponse.json()
          const userSave = interactions.find(
            (i) => i.user_id === user.id && i.interaction_type === 'save'
          )
          if (userSave) {
            savedPostIds.add(post.id)
          }
        }
      })
      
      await Promise.all(interactionPromises)
      
      // Filter to only saved posts
      const savedPosts = allPosts.filter((post) => savedPostIds.has(post.id))
      setPosts(savedPosts)
    } catch (error) {
      console.error('Error fetching saved posts:', error)
      pushToast({ title: 'Error', description: 'Failed to load saved posts', variant: 'error' })
    }
  }

  useEffect(() => {
    if (!user) return
    refresh()
  }, [user?.id])

  const handleToggle = async (postId: number | string) => {
    if (!user || !accessToken) {
      pushToast({ title: 'Sign in required' })
      return
    }
    
    try {
      // Check if interaction exists
      const interactionsResponse = await fetch(`/api/interactions/${postId}`)
      const interactions: Interaction[] = interactionsResponse.ok ? await interactionsResponse.json() : []
      const existingInteraction = interactions.find(
        (i) => i.user_id === user.id && i.interaction_type === 'save'
      )
      
      if (existingInteraction) {
        // Delete interaction
        await fetch(`/api/interactions/${existingInteraction.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      } else {
        // Create interaction
        await fetch('/api/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            post_id: typeof postId === 'string' ? parseInt(postId, 10) : postId,
            interaction_type: 'save',
          }),
        })
      }
      
      refresh()
    } catch (error) {
      console.error('Error toggling save:', error)
      pushToast({ title: 'Error', description: 'Failed to update save', variant: 'error' })
    }
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

