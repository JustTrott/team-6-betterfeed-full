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

  useEffect(() => {
    const container = containerRef.current
    const activeElement = activeRef.current
    if (!container || !activeElement) return

    const containerWidth = container.offsetWidth
    const itemWidth = activeElement.offsetWidth
    const offsetLeft = activeElement.offsetLeft

    const targetLeft = offsetLeft - containerWidth / 2 + itemWidth / 2
    const prefersSmooth = container.dataset.hasInteracted === 'true'

    container.scrollTo({
      left: targetLeft,
      behavior: prefersSmooth ? 'smooth' : 'auto',
    })

    if (!prefersSmooth) {
      container.dataset.hasInteracted = 'true'
    }
  }, [active, categories])

  return (
    <div ref={containerRef} className="bf-category-tabs" role="tablist" aria-label="Filter by category">
      <ul className="bf-category-tabs__list">
        {categories.map((category) => {
          const isActive = category === active
          const isDisabled = category !== 'General'
          return (
            <li key={category} className={cn('bf-category-tabs__item', isActive && 'is-active', isDisabled && 'is-disabled')}>
              <button
                ref={isActive ? activeRef : undefined}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-disabled={isDisabled}
                className="bf-category-tabs__link"
                onClick={() => !isDisabled && onChange(category)}
                disabled={isDisabled}
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

