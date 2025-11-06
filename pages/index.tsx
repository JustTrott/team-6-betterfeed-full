import { useEffect, useState } from 'react'
import { CategoryTabs } from '../components/CategoryTabs'
import { FeedCard } from '../components/feed/FeedCard'
import { InfiniteScroller } from '../components/feed/InfiniteScroller'
import { PostComposer } from '../components/feed/PostComposer'
import { AIChatPanel } from '../components/AIChatPanel'
import { useFeed } from '../hooks/useFeed'
import { useAuthStore } from '../store/auth'
import { db } from '../lib/db'
import { useToast } from '../context/toast'

export default function FeedPage() {
  const { user } = useAuthStore()
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
  const [categories, setCategories] = useState(['General'])
  const [activePost, setActivePost] = useState<any>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  
  // Add search state
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredPosts, setFilteredPosts] = useState<any[]>([])

  useEffect(() => {
    db.getCategories().then(setCategories)
  }, [])

  // Listen for search events from header
  useEffect(() => {
    const handleSearch = (e: CustomEvent) => {
      setSearchTerm(e.detail)
    }
    window.addEventListener('feed-search', handleSearch as EventListener)
    return () => window.removeEventListener('feed-search', handleSearch as EventListener)
  }, [])

  // Filter posts based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredPosts(posts)
      return
    }

    const searchLower = searchTerm.toLowerCase()
    const filtered = posts.filter((post: any) => 
      post.title.toLowerCase().includes(searchLower) ||
      post.content.toLowerCase().includes(searchLower) ||
      post.category.toLowerCase().includes(searchLower) ||
      post.source.toLowerCase().includes(searchLower)
    )
    
    setFilteredPosts(filtered)
  }, [searchTerm, posts])

  const handleCreatePost = async (payload: { title: string; summary: string; url: string; category: string }) => {
    if (!user) {
      pushToast({ title: 'Please sign in', description: 'You need an account to add to the feed.' })
      return
    }

    const thumbnailFallback = 'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=800&q=80'
    await db.createPost({
      user_id: user.id,
      article_url: payload.url,
      title: payload.title,
      content: payload.summary,
      thumbnail_url: thumbnailFallback,
      category: payload.category,
      source: user.username,
    })
    pushToast({ title: 'Post added', description: 'Your article is now in the mix!', variant: 'success' })
    refresh()
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
