import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { PaperPlaneIcon } from '@radix-ui/react-icons'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { StyleSelector } from './StyleSelector'
import { cn } from '../lib/utils'

interface Post {
  id: number | string
  title: string
  content: string
  category: string
  source: string
  created_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: number
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

const createMessage = (role: 'user' | 'assistant', content: string): Message => ({
  id: `${role}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  created_at: Date.now(),
})

const generateAssistantResponse = (styleId: string, post: Post | null, userMessage: string): string => {
  if (!post) return ''

  const summary = {
    professor: `Here's a tidy breakdown of "${post.title}".`,
    debater: `Let's weigh both sides of "${post.title}".`,
  }[styleId] ?? `Here's what I noticed about "${post.title}".`

  if (styleId === 'debater') {
    return `${summary}

Pros: ${post.source} spotlights momentum in ${post.category.toLowerCase()} and the thread of opportunity.
Cons: Watch for assumptions hiding in the methodology—double-check the evidence they cite.

You asked: "${userMessage}". My take: explore how opposing experts frame the same data so you can pressure-test it fast.`
  }

  return `${summary}

1. Core idea: ${post.content}
2. Why it matters: ${post.source} ties it to broader shifts in ${post.category.toLowerCase()}.
3. What to do next: skim the article's closing section for signals worth bookmarking.

You asked: "${userMessage}". Keep that in mind as you compare other coverage.`
}

interface AIChatPanelProps {
  open: boolean
  onClose: () => void
  post: Post | null
  style?: string
}

export const AIChatPanel = ({ open, onClose, post, style }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [value, setValue] = useState('')
  const [isResponding, setIsResponding] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState(style ?? STYLE_OPTIONS[0].id)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const responseTimerRef = useRef<number | null>(null)
  const messagesEndRef = useRef<HTMLSpanElement>(null)
  const panelTitleId = useId()

  const activePostId = post?.id ?? null

  useEffect(() => {
    if (STYLE_OPTIONS.some((option) => option.id === style)) {
      setSelectedStyle(style!)
    }
  }, [style])

  useEffect(() => {
    if (!open) return undefined

    // Lock body scroll when panel is open
    const originalStyle = window.getComputedStyle(document.body).overflow
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
      document.body.style.overflow = originalStyle
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setValue('')
      if (previousFocusRef.current && previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
      return
    }

    previousFocusRef.current = document.activeElement as HTMLElement
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 80)

    return () => window.clearTimeout(focusTimer)
  }, [open])

  useEffect(() => {
    if (!post) {
      setMessages([])
      return
    }
    setMessages([
      createMessage(
        'assistant',
        `Hi! I'm ready to riff on "${post.title}". Ask a question or share a hunch to get a tailored response.`
      ),
    ])
    setValue('')
  }, [activePostId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isResponding])

  useEffect(() => () => {
    if (responseTimerRef.current) window.clearTimeout(responseTimerRef.current)
  }, [])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!value.trim() || !post || isResponding) return

    const trimmed = value.trim()
    const userMessage = createMessage('user', trimmed)
    setMessages((prev) => [...prev, userMessage])
    setValue('')
    setIsResponding(true)

    responseTimerRef.current = window.setTimeout(() => {
      const reply = createMessage('assistant', generateAssistantResponse(selectedStyle, post, trimmed))
      setMessages((prev) => [...prev, reply])
      setIsResponding(false)
    }, 600)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit(event)
    }
  }

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId)
  }

  const selectedStyleMeta = useMemo(
    () => STYLE_OPTIONS.find((option) => option.id === selectedStyle) ?? STYLE_OPTIONS[0],
    [selectedStyle]
  )

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
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          >
            <header className="bf-chat-slideover__header">
              <div>
                <h2 id={panelTitleId} className="bf-chat-slideover__title">
                  {post.title}
                </h2>
                <p className="bf-chat-slideover__meta">
                  {post.source} · {new Date(post.created_at).toLocaleDateString()} · {post.category}
                </p>
              </div>
              <button type="button" onClick={onClose} className="bf-chat-slideover__close">
                Close
              </button>
            </header>

            <section className="bf-chat-slideover__styles" aria-label="Choose response style">
              <StyleSelector options={STYLE_OPTIONS} selected={selectedStyle} onSelect={handleStyleSelect} />
              <p className="bf-chat-slideover__style-hint">
                Currently speaking with a <strong>{selectedStyleMeta.label}</strong> tone.
              </p>
            </section>

            <section className="bf-chat-slideover__body">
              <div className="bf-chat-slideover__messages" role="log" aria-live="polite">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'bf-chat-slideover__message',
                      message.role === 'assistant'
                        ? 'bf-chat-slideover__message--assistant'
                        : 'bf-chat-slideover__message--user'
                    )}
                  >
                    {message.content}
                  </motion.div>
                ))}
                {isResponding ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bf-chat-slideover__status"
                  >
                    {selectedStyleMeta.label} drafting…
                  </motion.div>
                ) : null}
                <span ref={messagesEndRef} />
              </div>

              <form className="bf-chat-slideover__composer" onSubmit={handleSubmit}>
                <Textarea
                  ref={inputRef}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask for a takeaway, compare viewpoints, or stress-test the point…"
                  className="bf-chat-slideover__textarea"
                  aria-label="Message the AI assistant"
                />
                <Button
                  type="submit"
                  variant="default"
                  className="bf-chat-slideover__submit"
                  disabled={!value.trim() || isResponding}
                >
                  <PaperPlaneIcon className="bf-icon-md" />
                  <span className="bf-show-desktop">Send</span>
                </Button>
              </form>
            </section>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}

