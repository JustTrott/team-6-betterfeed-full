import { useEffect, useState } from 'react'
import { CategoryTabs } from '../components/CategoryTabs'
import { FeedCard } from '../components/feed/FeedCard'
import { InfiniteScroller } from '../components/feed/InfiniteScroller'
import { PostComposer } from '../components/feed/PostComposer'
import { AIChatPanel } from '../components/AIChatPanel'
import { useFeed } from '../hooks/useFeed'
import { useAuthStore } from '../store/auth'
import { useToast } from '../context/toast'

// Common arXiv categories
const ARXIV_CATEGORIES = [
  'General',
  'All',
  'cs.AI', // Artificial Intelligence
  'cs.LG', // Machine Learning
  'cs.CV', // Computer Vision
  'cs.CL', // Computation and Language
  'cs.NE', // Neural and Evolutionary Computing
  'math.CO', // Combinatorics
  'math.PR', // Probability
  'physics.optics', // Optics
  'physics.quant-ph', // Quantum Physics
]

export default function FeedPage() {
  const { user, accessToken } = useAuthStore()
  const { pushToast } = useToast()
  const {
    posts,
    likedIds,
    savedIds,
    category,
    setCategory,
    isLoading,
    hasMore,
    loadMore,
    toggleLike,
    toggleSave,
    refresh,
  } = useFeed()
  const [categories] = useState(ARXIV_CATEGORIES)
  const [activePost, setActivePost] = useState<any>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  
  // Add search state
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredPosts, setFilteredPosts] = useState<any[]>([])

  // Listen for search events from header
  useEffect(() => {
    const handleSearch = (e: CustomEvent) => {
      setSearchTerm(e.detail)
    }
    window.addEventListener('feed-search', handleSearch as EventListener)
    return () => window.removeEventListener('feed-search', handleSearch as EventListener)
  }, [])

  // Filter posts based on search with proper null checks
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredPosts(posts)
      return
    }

    const searchLower = searchTerm.toLowerCase()
    const filtered = posts.filter((post: any) => {
      // Add null/undefined checks for all fields
      const title = post.title?.toLowerCase() || ''
      const content = post.content?.toLowerCase() || ''
      const category = post.category?.toLowerCase() || ''
      const source = post.source?.toLowerCase() || ''
      
      return (
        title.includes(searchLower) ||
        content.includes(searchLower) ||
        category.includes(searchLower) ||
        source.includes(searchLower)
      )
    })
    
    setFilteredPosts(filtered)
  }, [searchTerm, posts])

  const handleCreatePost = async (payload: { title: string; summary: string; url: string; category: string }) => {
    if (!user || !accessToken) {
      pushToast({ title: 'Please sign in', description: 'You need an account to add to the feed.' })
      return
    }

    try {
      const thumbnailFallback = 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=800&q=80'
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: payload.title,
          content: payload.summary,
          article_url: payload.url,
          thumbnail_url: thumbnailFallback,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create post')
      }

      pushToast({ title: 'Post added', description: 'Your article is now in the mix!', variant: 'success' })
      refresh()
    } catch (error) {
      console.error('Error creating post:', error)
      pushToast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to create post', 
        variant: 'error' 
      })
    }
  }

  // Use filteredPosts instead of posts
  const displayPosts = searchTerm ? filteredPosts : posts

  return (
    <div className="bf-feed-page">
      <CategoryTabs categories={categories} active={category} onChange={setCategory} />

      {searchTerm && displayPosts.length === 0 ? (
        <div className="bf-empty-state">
          <p>No articles found matching &quot;{searchTerm}&quot;</p>
          <p className="bf-empty-state__hint">Try different keywords or clear your search</p>
        </div>
      ) : (
        <section className="bf-feed-grid">
          {displayPosts.map((post: any) => (
            <FeedCard
              key={post.id}
              post={post}
              isLiked={likedIds.has(post.id)}
              isSaved={savedIds.has(post.id)}
              onLike={() => toggleLike(post.id)}
              onSave={() => toggleSave(post.id)}
              onOpen={() => {
                setActivePost(post)
                setPanelOpen(true)
              }}
            />
          ))}

          {!searchTerm && <InfiniteScroller hasMore={hasMore} isLoading={isLoading} onLoadMore={loadMore} />}
        </section>
      )}

      <PostComposer categories={categories} onCreate={handleCreatePost} />

      <AIChatPanel open={panelOpen} onClose={() => setPanelOpen(false)} post={activePost} style="professor" />
    </div>
  )
}