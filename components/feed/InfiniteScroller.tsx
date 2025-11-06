import { useEffect, useRef } from 'react'

interface InfiniteScrollerProps {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
}

export const InfiniteScroller = ({ hasMore, isLoading, onLoadMore }: InfiniteScrollerProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasMore || isLoading) return
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onLoadMore()
        }
      })
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore])

  return (
    <div ref={ref} className="bf-infinite-scroller">
      {isLoading ? 'Loading more stories…' : hasMore ? 'Keep scrolling…' : 'You reached the end 🎉'}
    </div>
  )
}

