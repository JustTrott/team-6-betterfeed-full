import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PaperPlaneIcon } from '@radix-ui/react-icons'
import { MessageSquareIcon, ChevronUp, ExternalLink, Globe } from 'lucide-react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { StyleSelector } from './StyleSelector'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from './ai-elements/conversation'
import { Message, MessageContent } from './ai-elements/message'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

interface Post {
  id: number | string
  title: string
  content: string
  category: string
  source: string
  created_at: string
}

const STYLE_OPTIONS = [
  {
    id: 'professor',
    label: 'Professor',
    description: 'Structured, insightful explanations with calm delivery.',
  },
  {
    id: 'debater',
    label: 'Debater',
    description: 'Contrast-driven snapshots that surface pros and cons.',
  },
]

interface AIChatPanelProps {
  open: boolean
  onClose: () => void
  post: Post | null
  style?: string
}

export const AIChatPanel = ({ open, onClose, post, style }: AIChatPanelProps) => {
  const [selectedStyle, setSelectedStyle] = useState(() => {
    if (style && STYLE_OPTIONS.some((option) => option.id === style)) {
      return style
    }
    return STYLE_OPTIONS[0].id
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const panelTitleId = useId()

  // Swipe gesture state
  const touchStartRef = useRef<number | null>(null)
  const touchEndRef = useRef<number | null>(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const minSwipeDistance = 50 // Minimum distance for a swipe to close

  const activePostId = post?.id ?? null

  const { messages, sendMessage, status, setMessages } = useChat({
      transport: new DefaultChatTransport({
        api: '/api/chat',
      }),
    })

  const [input, setInput] = useState('')
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)

  const toggleHeader = () => {
    setIsHeaderCollapsed((prev) => !prev)
  }

  // Auto-collapse header when user sends a message
  useEffect(() => {
    if (messages.length > 1) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'user' && !isHeaderCollapsed) {
        setIsHeaderCollapsed(true)
      }
    }
  }, [messages, isHeaderCollapsed])

  useEffect(() => {
    if (style && STYLE_OPTIONS.some((option) => option.id === style) && style !== selectedStyle) {
      setSelectedStyle(style)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style])

  useEffect(() => {
    if (!open) return undefined

    // Lock body scroll when panel is open (simple overflow hidden approach)
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      if (previousFocusRef.current && previousFocusRef.current instanceof HTMLElement) {
        // Use preventScroll to avoid scrolling when restoring focus
        previousFocusRef.current.focus({ preventScroll: true })
      }
      return
    }

    previousFocusRef.current = document.activeElement as HTMLElement
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true })
    }, 80)

    return () => window.clearTimeout(focusTimer)
  }, [open])

  useEffect(() => {
    if (!post) {
      setMessages([])
      return
    }
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `Hi! I'm ready to discuss "${post.title}". Ask me anything about the article, request a summary, or explore different perspectives.`,
          },
        ],
      },
    ])
  }, [activePostId, setMessages, post])


  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!input.trim() || !post || status !== 'ready') return
    
    // Ensure post is available before sending
    if (!post.title || !post.source || !post.category) {
      console.error('Post information is incomplete')
      return
    }
    
    sendMessage({ text: input }, {
      body: {
        post,
        style: selectedStyle,
        enableSearch: true, // Enable web search by default
      },
    })
    setInput('')
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSubmit(event)
    }
  }

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId)
  }

  const selectedStyleMeta = useMemo(
    () => STYLE_OPTIONS.find((option) => option.id === selectedStyle) ?? STYLE_OPTIONS[0],
    [selectedStyle]
  )

  // Swipe gesture handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchEndRef.current = null
    touchStartRef.current = e.touches[0].clientX
  }

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.touches[0].clientX
    if (touchStartRef.current) {
      // For closing, we want to detect right swipes (positive distance)
      const distance = e.touches[0].clientX - touchStartRef.current
      setSwipeOffset(distance)
      
      // Prevent default scroll behavior when swiping horizontally
      if (Math.abs(distance) > 10) {
        e.preventDefault()
      }
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !touchEndRef.current) {
      setSwipeOffset(0)
      return
    }

    const distance = touchEndRef.current - touchStartRef.current
    const isHorizontalSwipe = Math.abs(distance) > minSwipeDistance

    if (isHorizontalSwipe) {
      // Prevent any default behavior that might cause scroll
      e.preventDefault()
      onClose()
    }
    
    setSwipeOffset(0)
    touchStartRef.current = null
    touchEndRef.current = null
  }

  // Mouse gesture handlers for desktop
  const onMouseDown = (e: React.MouseEvent) => {
    touchEndRef.current = null
    touchStartRef.current = e.clientX
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (touchStartRef.current) {
      touchEndRef.current = e.clientX
      const distance = e.clientX - touchStartRef.current
      setSwipeOffset(distance)
    }
  }

  const onMouseUp = () => {
    if (!touchStartRef.current || !touchEndRef.current) {
      setSwipeOffset(0)
      touchStartRef.current = null
      touchEndRef.current = null
      return
    }

    const distance = touchEndRef.current - touchStartRef.current
    const isHorizontalSwipe = Math.abs(distance) > minSwipeDistance

    if (isHorizontalSwipe) {
      onClose()
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
    <AnimatePresence>
      {open && post ? (
        <>
          <motion.button
            key="overlay"
            type="button"
            aria-label="Close AI assistant panel"
            className="bf-chat-layer__overlay"
            onClick={onClose}
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={panelTitleId}
            className="bf-chat-slideover"
            initial={{ x: '100%' }}
            animate={{ x: swipeOffset }}
            exit={{ x: '100%' }}
            transition={swipeOffset > 0 ? { duration: 0.1 } : { type: 'spring', stiffness: 400, damping: 40 }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={(e) => {
              touchEndRef.current = e.changedTouches[0].clientX
              onTouchEnd(e)
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            style={{ 
              touchAction: 'pan-y',
              cursor: swipeOffset > 0 ? 'grabbing' : 'default'
            }}
          >
            <header className="bf-chat-slideover__header">
              <div className="bf-chat-slideover__header-content">
                <div className="bf-chat-slideover__header-main">
                  <div className="bf-chat-slideover__header-text">
                    <h2
                      id={panelTitleId}
                      className={`bf-chat-slideover__title ${isHeaderCollapsed ? 'is-collapsed' : ''}`}
                      onClick={isHeaderCollapsed ? toggleHeader : undefined}
                      style={isHeaderCollapsed ? { cursor: 'pointer' } : undefined}
                    >
                      {post.title}
                    </h2>
                    <motion.div
                      initial={false}
                      animate={{
                        height: isHeaderCollapsed ? 0 : 'auto',
                        opacity: isHeaderCollapsed ? 0 : 1,
                      }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p className="bf-chat-slideover__meta">
                        {post.source} · {new Date(post.created_at).toLocaleDateString()} · {post.category}
                      </p>
                    </motion.div>
                  </div>
                </div>
                <div className="bf-chat-slideover__header-actions">
                  <button type="button" onClick={onClose} className="bf-chat-slideover__close">
                    Close
                  </button>
                </div>
              </div>
            </header>

            <motion.section
              className="bf-chat-slideover__styles"
              aria-label="Choose response style"
              initial={false}
              animate={{
                height: isHeaderCollapsed ? 0 : 'auto',
                opacity: isHeaderCollapsed ? 0 : 1,
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <StyleSelector options={STYLE_OPTIONS} selected={selectedStyle} onSelect={handleStyleSelect} />
            </motion.section>
            {!isHeaderCollapsed && (
              <div className="bf-chat-slideover__footer">
                <button
                  type="button"
                  onClick={toggleHeader}
                  className="bf-chat-slideover__collapse-button"
                  aria-expanded={!isHeaderCollapsed}
                  aria-label="Hide AI mode options"
                >
                  <ChevronUp className="bf-icon-sm" />
                </button>
              </div>
            )}
            <p className="bf-chat-slideover__style-hint">
              Currently speaking with a <strong>{selectedStyleMeta.label}</strong> tone.
              {isHeaderCollapsed && (
                <button
                  type="button"
                  onClick={toggleHeader}
                  className="bf-chat-slideover__style-change"
                >
                  Change
                </button>
              )}
            </p>

            <section className="bf-chat-slideover__body">
              <Conversation className="bf-chat-slideover__messages">
                <ConversationContent>
                  {messages.length === 0 ? (
                    <ConversationEmptyState
                      title="Start a conversation"
                      description="Ask me anything about the article, request a summary, or explore different perspectives."
                      icon={<MessageSquareIcon className="size-6" />}
                    />
                  ) : (
                    <>
                      {messages.map((message) => {
                        const textContent = message.parts
                          .filter((part) => part.type === 'text')
                          .map((part) => (part as { text: string }).text)
                          .join('')

                        // Extract sources from message parts (source-url type from Google Search)
                        type SourceInfo = { id: string; url: string; title: string | undefined }
                        const sources: SourceInfo[] = message.parts
                          .filter((part) => part.type === 'source-url')
                          .map((part) => {
                            // Cast to the source-url structure
                            const sourcePart = part as unknown as { sourceId: string; url: string; title?: string }
                            return {
                              id: sourcePart.sourceId || '',
                              url: sourcePart.url || '',
                              title: sourcePart.title,
                            }
                          })
                          .filter((s) => !!s.url)

                        return (
                          <Message key={message.id} from={message.role === 'assistant' ? 'assistant' : 'user'}>
                            <MessageContent
                              content={textContent}
                              markdown={message.role === 'assistant'}
                            />
                            {sources.length > 0 && message.role === 'assistant' && (
                              <div className="bf-chat-sources">
                                <div className="bf-chat-sources__header">
                                  <Globe className="bf-icon-sm" />
                                  <span>Sources</span>
                                </div>
                                <div className="bf-chat-sources__list">
                                  {sources.map((source, idx) => (
                                    <a
                                      key={source.id || idx}
                                      href={source.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bf-chat-sources__item"
                                    >
                                      <span className="bf-chat-sources__title">
                                        {source.title || new URL(source.url).hostname}
                                      </span>
                                      <ExternalLink className="bf-icon-xs" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </Message>
                        )
                      })}
                      {(status === 'submitted' || status === 'streaming') ? (
                        <Message from="assistant">
                          <div className="bf-chat-slideover__message-loading">Thinking…</div>
                        </Message>
                      ) : null}
                    </>
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </section>

            <form onSubmit={onSubmit} className="bf-chat-slideover__composer">
              <Input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask for a takeaway, compare viewpoints, or stress-test the point…"
                className="bf-chat-slideover__input"
                disabled={status !== 'ready'}
              />
              <Button
                type="submit"
                disabled={!input.trim() || status !== 'ready'}
                className="bf-chat-slideover__submit"
              >
                <PaperPlaneIcon className="bf-icon-md" />
                <span className="bf-show-desktop">Send</span>
              </Button>
            </form>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}