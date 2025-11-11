import { useState, useRef } from 'react'
import { motion } from 'motion/react'
import { ExternalLink, Sparkles, ArrowLeft } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { EngagementBar } from './EngagementBar'
import { ReadBadge } from './ReadBadge'
import { readingHistory } from '../../lib/readingHistory'
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

interface FeedCardProps {
  post: Post
  isLiked: boolean
  isSaved: boolean
  onLike: () => void
  onSave: () => void
  onOpen: () => void
}

export const FeedCard = ({ post, isLiked, isSaved, onLike, onSave, onOpen }: FeedCardProps) => {
  const isRead = readingHistory.hasRead(post.id)
  const touchStartRef = useRef<number | null>(null)
  const touchEndRef = useRef<number | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)

  const minSwipeDistance = 50 // Minimum distance for a swipe

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
      if (text[i] === ' ' && i > charIndex) {
        breakPoint = i
        break
      }
    }
    
    const truncated = text.substring(0, breakPoint).trim() + '...'
    return { truncated, needsTruncation: true }
  }

  const contentInfo = post.content ? truncateContent(post.content, 50) : { truncated: '', needsTruncation: false }
  const displayContent = isExpanded || !contentInfo.needsTruncation ? post.content : contentInfo.truncated

  const handleOpen = () => {
    readingHistory.markAsRead(post.id)
    onOpen()
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndRef.current = null
    touchStartRef.current = e.touches[0].clientX
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const currentX = e.touches[0].clientX
    const diff = touchStartRef.current - currentX
    // Only allow left swipe (positive diff) and show visual feedback
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 150))
      e.preventDefault() // Prevent scrolling while swiping horizontally
    }
  }

  const onTouchEnd = () => {
    if (!touchStartRef.current) return
    
    const endX = touchEndRef.current ?? touchStartRef.current
    const distance = touchStartRef.current - endX
    const isLeftSwipe = distance > minSwipeDistance

    if (isLeftSwipe) {
      handleOpen()
    }
    
    setSwipeOffset(0)
    touchStartRef.current = null
    touchEndRef.current = null
  }

  const onMouseDown = (e: React.MouseEvent) => {
    touchStartRef.current = e.clientX
    touchEndRef.current = null
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!touchStartRef.current) return
    const currentX = e.clientX
    const diff = touchStartRef.current - currentX
    // Only allow left swipe (positive diff)
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 150))
    }
  }

  const onMouseUp = (e: React.MouseEvent) => {
    if (!touchStartRef.current) return
    
    touchEndRef.current = e.clientX
    const distance = touchStartRef.current - (touchEndRef.current ?? 0)
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
          <span className="bf-feed-card__source-tag">
            <Sparkles className="bf-icon-sm" />
            {post.source}
          </span>
          <a
            href={post.article_url}
            target="_blank"
            rel="noreferrer"
            className="bf-feed-card__link"
          >
            Read full article
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
          likes={post.like_count}
          saves={post.save_count}
          views={post.view_count}
          onLike={onLike}
          onSave={onSave}
          active={{ like: isLiked, save: isSaved }}
        />
      </div>
    </motion.article>
  )
}

