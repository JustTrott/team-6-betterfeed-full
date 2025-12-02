import { useEffect, useRef } from 'react'
import { cn } from '../lib/utils'

interface CategoryTabsProps {
  categories: string[]
  active: string
  onChange: (category: string) => void
}

export const CategoryTabs = ({ categories, active, onChange }: CategoryTabsProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef(new Map<string, HTMLLIElement>())

  const centerOnCategory = (category: string) => {
    const container = containerRef.current
    const item = itemRefs.current.get(category)
    if (!container || !item) return

    const containerWidth = container.offsetWidth
    const itemCenter = item.offsetLeft + item.offsetWidth / 2
    const targetLeft = itemCenter - containerWidth / 2
    const prefersSmooth = container.dataset.hasInteracted === 'true'

    container.scrollTo({
      left: targetLeft,
      behavior: prefersSmooth ? 'smooth' : 'auto',
    })

    if (!prefersSmooth) {
      container.dataset.hasInteracted = 'true'
    }
  }

  const snapWithinBounds = () => {
    const container = containerRef.current
    if (!container) return

    const visibleItems = categories
      .map((cat) => itemRefs.current.get(cat))
      .filter((el): el is HTMLLIElement => Boolean(el))
    if (visibleItems.length === 0) return

    const containerWidth = container.offsetWidth
    const first = visibleItems[0]
    const last = visibleItems[visibleItems.length - 1]
    const minLeft = Math.max(0, first.offsetLeft + first.offsetWidth / 2 - containerWidth / 2)
    const maxLeft = Math.max(0, last.offsetLeft + last.offsetWidth / 2 - containerWidth / 2)
    const tolerance = 24

    if (container.scrollLeft < minLeft - tolerance) {
      container.scrollTo({ left: minLeft, behavior: 'smooth' })
    } else if (container.scrollLeft > maxLeft + tolerance) {
      container.scrollTo({ left: maxLeft, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    centerOnCategory(active)
  }, [active, categories])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let timeout: NodeJS.Timeout | null = null
    const handleScroll = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        snapWithinBounds()
      }, 100)
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      if (timeout) clearTimeout(timeout)
      container.removeEventListener('scroll', handleScroll)
    }
  }, [categories])

  return (
    <div ref={containerRef} className="bf-category-tabs" role="tablist" aria-label="Filter by category">
      <ul className="bf-category-tabs__list">
        {categories.map((category) => {
          const isActive = category === active
          return (
            <li
              key={category}
              ref={(el) => {
                if (el) {
                  itemRefs.current.set(category, el)
                } else {
                  itemRefs.current.delete(category)
                }
              }}
              className={cn('bf-category-tabs__item', isActive && 'is-active')}
            >
              <button
                ref={isActive ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={isActive}
                className="bf-category-tabs__link"
                onClick={() => onChange(category)}
              >
                {category}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
