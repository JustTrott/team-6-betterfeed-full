import { useState, useRef, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { ExternalLink, Sparkles, ArrowLeft } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { EngagementBar } from './EngagementBar'
import { ReadBadge } from './ReadBadge'
import { readingHistory } from '../../lib/readingHistory'
import { useAuthStore } from '../../store/auth'
import type { Interaction } from '../../lib/db/schema'
import Latex from 'react-latex-next'
import 'katex/dist/katex.min.css'

interface Post {
  id: number | string
  title: string
  content: string | null
  category: string
  source: string
  article_url: string
  thumbnail_url: string | null
  created_at: string
  like_count: number
  save_count: number
  view_count: number
}

interface PostsPage {
  items: Post[]
  nextCursor: number | null
}

interface PostsQueryData {
  pages: PostsPage[]
  pageParams: number[]
}

interface FeedCardProps {
  post: Post
  isLiked: boolean
  isSaved: boolean
  onLike: () => void
  onSave: () => void
  onOpen: () => void
  category: string
}

export const FeedCard = ({ post, isLiked, isSaved, onLike, onSave, onOpen, category }: FeedCardProps) => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isRead = readingHistory.hasRead(post.id)
  const touchStartRef = useRef<number | null>(null)
  const touchEndRef = useRef<number | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasBeenViewed, setHasBeenViewed] = useState(false)
  const [shouldLoadInteractions, setShouldLoadInteractions] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  
  // Lazy load interactions when card is near viewport
  // This is ONLY used to sync user's like/save state, NOT for counts
  // Counts come from post.like_count/save_count which are optimistically updated
  useQuery({
    queryKey: ['interactions', post.id],
    queryFn: async () => {
      if (typeof post.id !== 'number') return []
      const response = await fetch(`/api/interactions/${post.id}`)
      if (!response.ok) return []
      const interactions: Interaction[] = await response.json()
      
      // Update user interactions state if user is logged in
      if (user) {
        const userLike = interactions.find((i) => i.user_id === user.id && i.interaction_type === 'like')
        const userSave = interactions.find((i) => i.user_id === user.id && i.interaction_type === 'save')
        
        queryClient.setQueryData(['user-interactions', user.id], (old: { likes: Set<number | string>; saves: Set<number | string> }) => {
          const newInteractions = {
            likes: new Set(old?.likes || []),
            saves: new Set(old?.saves || []),
          }
          if (userLike) {
            newInteractions.likes.add(post.id)
          } else {
            newInteractions.likes.delete(post.id)
          }
          if (userSave) {
            newInteractions.saves.add(post.id)
          } else {
            newInteractions.saves.delete(post.id)
          }
          return newInteractions
        })
      }
      
      // Update posts cache with interaction counts (initial load only)
      // After this, counts are managed by optimistic updates in useFeed
      const likeCount = interactions.filter((i) => i.interaction_type === 'like').length
      const saveCount = interactions.filter((i) => i.interaction_type === 'save').length
      
      queryClient.setQueryData<PostsQueryData>(['posts', category], (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              String(item.id) === String(post.id)
                ? { ...item, like_count: likeCount, save_count: saveCount }
                : item
            ),
          })),
        }
      })
      
      return interactions
    },
    enabled: shouldLoadInteractions && typeof post.id === 'number',
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
  
  // Use post counts directly - these are optimistically updated by useFeed
  const likeCount = post.like_count ?? 0
  const saveCount = post.save_count ?? 0

  const minSwipeDistance = 50 // Minimum distance for a swipe

  // Track views and load interactions using Intersection Observer
  useEffect(() => {
    const cardElement = cardRef.current
    if (!cardElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Load interactions when card is near viewport (200px before it enters)
          if (entry.isIntersecting && !shouldLoadInteractions) {
            setShouldLoadInteractions(true)
          }
          
          // Consider the card viewed if it's at least 50% visible
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && !hasBeenViewed) {
            // Delay to ensure user actually viewed it (not just scrolling past)
            const viewTimeout = setTimeout(async () => {
              setHasBeenViewed((prev) => {
                if (prev) return prev
                
                // Track view via API if post has a numeric ID (exists in database)
                // Only track views for posts that exist in the backend database
                if (typeof post.id === 'number') {
                  fetch(`/api/posts/${post.id}/view`, {
                    method: 'POST',
                  })
                    .then((response) => {
                      // Only update cache if response is successful and has view_count
                      if (response.ok) {
                        return response.json()
                      }
                      // 404 means post doesn't exist in database - this is fine, don't track
                      if (response.status === 404) {
                        return null
                      }
                      return null
                    })
                    .then((updatedPost) => {
                      // Only update cache if we got a valid response with view_count
                      if (updatedPost && typeof updatedPost.view_count === 'number') {
                        // Update the React Query cache to persist the change
                        queryClient.setQueryData<PostsQueryData>(['posts', category], (old) => {
                          if (!old) return old
                          
                          return {
                            ...old,
                            pages: old.pages.map((page) => ({
                              ...page,
                              items: page.items.map((item) =>
                                item.id === post.id
                                  ? { ...item, view_count: updatedPost.view_count }
                                  : item
                              ),
                            })),
                          }
                        })
                      }
                    })
                    .catch((error) => {
                      // Silently fail - view tracking is not critical
                      // Only log in development
                      if (process.env.NODE_ENV === 'development') {
                        console.warn('View tracking failed (non-critical):', error)
                      }
                    })
                }
                
                return true
              })
            }, 1000) // 1 second delay

            // Store the timeout so we can clear it if the card leaves the viewport
            entry.target.setAttribute('data-view-timeout', viewTimeout.toString())
          } else {
            // Clear the timeout if the card leaves the viewport before 1 second
            const timeoutId = entry.target.getAttribute('data-view-timeout')
            if (timeoutId) {
              clearTimeout(parseInt(timeoutId, 10))
              entry.target.removeAttribute('data-view-timeout')
            }
          }
        })
      },
      {
        threshold: [0, 0.5], // Trigger when card enters viewport and when 50% visible
        rootMargin: '200px', // Start loading interactions 200px before card enters viewport
      }
    )

    observer.observe(cardElement)

    return () => {
      const timeoutId = cardElement.getAttribute('data-view-timeout')
      if (timeoutId) {
        clearTimeout(parseInt(timeoutId, 10))
      }
      observer.unobserve(cardElement)
    }
  }, [post.id, hasBeenViewed, queryClient, category, shouldLoadInteractions])

  // Truncate content to 50 words
  const truncateContent = (text: string, wordLimit: number = 50): { truncated: string; needsTruncation: boolean } => {
    if (!text) return { truncated: '', needsTruncation: false }
    
    // Remove LaTeX commands for word counting (simple approach)
    const plainText = text.replace(/\$[^$]+\$/g, ' ').replace(/\\[a-zA-Z]+\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim()
    const words = plainText.split(/\s+/)
    
    if (words.length <= wordLimit) {
      return { truncated: text, needsTruncation: false }
    }
    
    // Find a good break point by counting words in the original text
    // We'll find where approximately wordLimit words end
    let wordCount = 0
    let charIndex = 0
    let inLatex = false
    
    for (let i = 0; i < text.length && wordCount < wordLimit; i++) {
      const char = text[i]
      
      // Track LaTeX delimiters
      if (char === '$' && (i === 0 || text[i - 1] !== '\\')) {
        inLatex = !inLatex
        continue
      }
      
      // Skip LaTeX content for word counting
      if (inLatex) continue
      
      // Count words (spaces indicate word boundaries)
      if (char === ' ' || char === '\n' || char === '\t') {
        if (i > 0 && text[i - 1] !== ' ' && text[i - 1] !== '\n' && text[i - 1] !== '\t') {
          wordCount++
        }
      }
      
      charIndex = i
    }
    
    // Find a good break point (end of sentence or word boundary)
    let breakPoint = charIndex
    for (let i = charIndex; i < Math.min(charIndex + 50, text.length); i++) {
      if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
        breakPoint = i + 1
        break
      }
    }
    
    return {
      truncated: text.substring(0, breakPoint) + '...',
      needsTruncation: true,
    }
  }

  const contentInfo = post.content ? truncateContent(post.content) : { truncated: '', needsTruncation: false }
  const displayContent = isExpanded ? post.content : contentInfo.truncated

  const handleOpen = () => {
    readingHistory.markAsRead(post.id)
    onOpen()
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndRef.current = null
    touchStartRef.current = e.touches[0].clientX
  }

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.touches[0].clientX
    if (touchStartRef.current) {
      const distance = touchStartRef.current - touchEndRef.current
      setSwipeOffset(distance > 0 ? distance : 0)
    }
  }

  const onMouseDown = (e: React.MouseEvent) => {
    touchEndRef.current = null
    touchStartRef.current = e.clientX
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (touchStartRef.current) {
      touchEndRef.current = e.clientX
      const distance = touchStartRef.current - touchEndRef.current
      setSwipeOffset(distance > 0 ? distance : 0)
    }
  }

  const onMouseUp = () => {
    onTouchEnd()
  }

  const onTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return

    const distance = touchStartRef.current - touchEndRef.current
    const isLeftSwipe = distance > minSwipeDistance

    if (isLeftSwipe) {
      handleOpen()
    }
    
    setSwipeOffset(0)
    touchStartRef.current = null
    touchEndRef.current = null
  }

  const onMouseLeave = () => {
    if (touchStartRef.current) {
      setSwipeOffset(0)
      touchStartRef.current = null
      touchEndRef.current = null
    }
  }

  return (
    <motion.article
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, x: -swipeOffset }}
      transition={swipeOffset > 0 ? { duration: 0.1 } : { duration: 0.25, ease: 'easeOut' }}
      className="bf-feed-card"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={(e) => {
        touchEndRef.current = e.changedTouches[0].clientX
        onTouchEnd()
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{ touchAction: 'pan-y', cursor: swipeOffset > 0 ? 'grabbing' : 'grab' }}
    >
      <div className="bf-feed-card__accent" aria-hidden />
      <div className="bf-feed-card__body">
        <div className="bf-feed-card__meta">
          <Badge>{post.category}</Badge>
          <span className="bf-feed-card__date">
            {new Date(post.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <ReadBadge isRead={isRead} compact />
        </div>

        <div className="bf-feed-card__text">
          <h2 className="bf-feed-card__title">
            <Latex>{post.title || ''}</Latex>
          </h2>
          {post.content && (
            <div className="bf-feed-card__summary-wrapper">
              <p className="bf-feed-card__summary">
                <Latex>{displayContent || ''}</Latex>
              </p>
              {contentInfo.needsTruncation && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExpanded(!isExpanded)
                  }}
                  className="bf-feed-card__read-more"
                >
                  {isExpanded ? 'Read less' : 'Read more'}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bf-feed-card__source">
          <a
            href={post.article_url}
            target="_blank"
            rel="noreferrer"
            className="bf-feed-card__link"
          >
            Read full article on {post.source}
            <ExternalLink className="bf-icon-sm" />
          </a>
        </div>

        <Button variant="secondary" className="bf-feed-card__cta" onClick={handleOpen}>
          <span className="bf-feed-card__cta-text">
            <Sparkles className="bf-icon-md" />
            Swipe for AI
          </span>
          <ArrowLeft className="bf-icon-md" />
        </Button>
      </div>

      <div className="bf-feed-card__actions">
        <EngagementBar
          likes={likeCount}
          saves={saveCount}
          onLike={onLike}
          onSave={onSave}
          active={{ like: isLiked, save: isSaved }}
        />
      </div>
    </motion.article>
  )
}
