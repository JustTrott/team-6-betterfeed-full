import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'

interface PostComposerProps {
  categories: string[]
  onCreate: (post: { title: string; summary: string; url: string; category: string }) => Promise<void>
}

export const PostComposer = ({ categories, onCreate }: PostComposerProps) => {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState(categories[0] ?? 'General')
  const [isSubmitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    await onCreate({ title, summary, url, category })
    setTitle('')
    setSummary('')
    setUrl('')
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bf-composer">
      <div className="bf-composer__header">
        <h3 className="bf-composer__title">Drop a headline into BetterFeed</h3>
        <select
          className="bf-select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {categories.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Short, catchy title"
        required
      />

      <Textarea
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        placeholder="Add a two-to-four sentence summary"
        required
      />

      <Input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://article.link"
        type="url"
        required
      />

      <Button type="submit" disabled={isSubmitting} className="bf-composer__submit">
        {isSubmitting ? 'Adding…' : 'Add to feed'}
      </Button>
    </form>
  )
}

