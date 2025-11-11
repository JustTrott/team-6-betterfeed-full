import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'motion/react'
import { FeedCard } from '../../components/feed/FeedCard'
import { AIChatPanel } from '../../components/AIChatPanel'
import { useAuthStore } from '../../store/auth'
import { useToast } from '../../context/toast'
import type { Post } from '../../lib/db/schema'
import type { Interaction } from '../../lib/db/schema'

export default function PostPage() {
  const router = useRouter()
  const { id } = router.query
  const { user, accessToken } = useAuthStore()
  const { pushToast } = useToast()
  const [post, setPost] = useState<Post | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [saveCount, setSaveCount] = useState(0)

  useEffect(() => {
    if (!id) return
    
    const fetchPost = async () => {
      try {
        const response = await fetch(`/api/posts/${id}`)
        if (!response.ok) throw new Error('Failed to fetch post')
        const postData: Post = await response.json()
        setPost(postData)
        
        // Fetch interactions for this post
        const interactionsResponse = await fetch(`/api/interactions/${id}`)
        if (interactionsResponse.ok) {
          const interactions: Interaction[] = await interactionsResponse.json()
          setLikeCount(interactions.filter((i) => i.interaction_type === 'like').length)
          setSaveCount(interactions.filter((i) => i.interaction_type === 'save').length)
          
          if (user) {
            setLiked(interactions.some((i) => i.user_id === user.id && i.interaction_type === 'like'))
            setSaved(interactions.some((i) => i.user_id === user.id && i.interaction_type === 'save'))
          }
        }
      } catch (error) {
        console.error('Error fetching post:', error)
        pushToast({ title: 'Error', description: 'Failed to load post', variant: 'error' })
      }
    }
    
    fetchPost()
  }, [id, user?.id])

  const toggle = async (type: 'like' | 'save') => {
    if (!user || !post || !accessToken) {
      pushToast({ title: 'Please sign in to interact' })
      return
    }
    
    try {
      // Check if interaction exists
      const interactionsResponse = await fetch(`/api/interactions/${post.id}`)
      const interactions: Interaction[] = interactionsResponse.ok ? await interactionsResponse.json() : []
      const existingInteraction = interactions.find(
        (i) => i.user_id === user.id && i.interaction_type === type
      )
      
      if (existingInteraction) {
        // Delete interaction
        await fetch(`/api/interactions/${existingInteraction.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        
        if (type === 'like') {
          setLiked(false)
          setLikeCount((prev) => Math.max(0, prev - 1))
        } else {
          setSaved(false)
          setSaveCount((prev) => Math.max(0, prev - 1))
        }
      } else {
        // Create interaction
        await fetch('/api/interactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            post_id: post.id,
            interaction_type: type,
          }),
        })
        
        if (type === 'like') {
          setLiked(true)
          setLikeCount((prev) => prev + 1)
        } else {
          setSaved(true)
          setSaveCount((prev) => prev + 1)
        }
      }
      
      // Refresh interactions to get accurate counts
      const updatedInteractionsResponse = await fetch(`/api/interactions/${post.id}`)
      if (updatedInteractionsResponse.ok) {
        const updatedInteractions: Interaction[] = await updatedInteractionsResponse.json()
        setLikeCount(updatedInteractions.filter((i) => i.interaction_type === 'like').length)
        setSaveCount(updatedInteractions.filter((i) => i.interaction_type === 'save').length)
      }
    } catch (error) {
      console.error('Error toggling interaction:', error)
      pushToast({ title: 'Error', description: 'Failed to update interaction', variant: 'error' })
    }
  }

  if (!post) {
    return (
      <div className="bf-page-loading">
        Loading post…
      </div>
    )
  }

  return (
    <div className="bf-page bf-page--narrow">
      <motion.div layout>
        <FeedCard
          post={{
            ...post,
            like_count: likeCount,
            save_count: saveCount,
            category: 'General', // Post schema doesn't have category, but FeedCard expects it
            source: 'arXiv', // Post schema doesn't have source, but FeedCard expects it
          }}
          isLiked={liked}
          isSaved={saved}
          onLike={() => toggle('like')}
          onSave={() => toggle('save')}
          onOpen={() => setPanelOpen(true)}
        />
      </motion.div>

      <AIChatPanel open={panelOpen} onClose={() => setPanelOpen(false)} post={post} style="professor" />
    </div>
  )
}

