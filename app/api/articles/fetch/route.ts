import { NextRequest, NextResponse } from 'next/server'
import { searchArticles, getPdfUrl, getAbstractUrl, type ArxivEntry } from '@/lib/services/arxiv'
import { generateArticleSummary } from '@/lib/services/summarize'
import { supabaseAdmin } from '@/lib/db/client'

type Article = {
  id?: string | number
  title: string
  url: string
  source: string
  category: string
  content?: string | null
}

export type ArticleResponse = {
  id: string | number
  title: string
  article_url: string
  content: string | null
  thumbnail_url: string | null
  source: string
  category: string
  created_at: string
}

const CATEGORY_BY_SOURCE: Record<string, string> = {
  'arXiv': 'Education',
  'Hacker News': 'Technology & Computing',
  'ScienceDaily': 'Science',
  'NewsAPI Business': 'Business & Finance',
}

const HN_TOP_STORIES_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json'
const HN_ITEM_URL = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`
const SCIENCE_DAILY_RSS = 'https://www.sciencedaily.com/rss/top/science.xml'
const NEWSAPI_URL = 'https://newsapi.org/v2/top-headlines'

const MAX_PER_SOURCE = 10

function formatArticle(title: string, url: string, source: keyof typeof CATEGORY_BY_SOURCE): Article {
  return {
    title: title || 'Untitled',
    url: url || '',
    source,
    category: CATEGORY_BY_SOURCE[source],
  }
}

async function fetchArxiv(limit: number): Promise<Article[]> {
  try {
    const feed = await searchArticles({
      category: 'cs.AI',
      perPage: limit,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    })

    return (feed.entries || []).slice(0, limit).map((entry: ArxivEntry) => {
      const url = getPdfUrl(entry) || getAbstractUrl(entry) || entry.id
      return formatArticle(entry.title || 'arXiv Article', url, 'arXiv')
    })
  } catch (error) {
    console.error('[arXiv] fetch failed:', error)
    return []
  }
}

async function fetchHackerNews(limit: number): Promise<Article[]> {
  try {
    const topResponse = await fetch(HN_TOP_STORIES_URL, { cache: 'no-store' })
    if (!topResponse.ok) throw new Error(`Failed to load top stories: ${topResponse.status}`)

    const topIds: number[] = await topResponse.json()
    const targets = topIds.slice(0, limit)

    const stories = await Promise.allSettled(
      targets.map(async (id) => {
        const res = await fetch(HN_ITEM_URL(id), { cache: 'no-store' })
        if (!res.ok) throw new Error(`Item ${id} failed with ${res.status}`)
        return res.json()
      })
    )

    const articles: Article[] = []
    for (const story of stories) {
      if (story.status !== 'fulfilled' || !story.value) continue
      const data = story.value as { title?: string; url?: string; id?: number }
      const url = data.url || (data.id ? `https://news.ycombinator.com/item?id=${data.id}` : '')
      articles.push(formatArticle(data.title || 'Hacker News Story', url, 'Hacker News'))
    }

    return articles.slice(0, limit)
  } catch (error) {
    console.error('[Hacker News] fetch failed:', error)
    return []
  }
}

function parseScienceDailyRSS(xml: string): Array<{ title: string; link: string }> {
  const items: Array<{ title: string; link: string }> = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemMatches) {
    const item = match[1]
    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i)
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i)
    const title = (titleMatch && (titleMatch[1] || titleMatch[2]) || '').trim()
    const link = (linkMatch && linkMatch[1] || '').trim()
    if (title && link) {
      items.push({ title, link })
    }
  }

  return items
}

async function fetchScienceDaily(limit: number): Promise<Article[]> {
  try {
    const response = await fetch(SCIENCE_DAILY_RSS, { cache: 'no-store' })
    if (!response.ok) throw new Error(`ScienceDaily RSS failed: ${response.status}`)
    const xml = await response.text()
    const parsed = parseScienceDailyRSS(xml).slice(0, limit)
    return parsed.map((entry) => formatArticle(entry.title, entry.link, 'ScienceDaily'))
  } catch (error) {
    console.error('[ScienceDaily] fetch failed:', error)
    return []
  }
}

async function fetchNewsAPI(limit: number): Promise<Article[]> {
  const apiKey = process.env.NEWSAPI_KEY
  if (!apiKey) {
    console.warn('[NewsAPI Business] NEWSAPI_KEY is not set')
    return []
  }

  try {
    const url = new URL(NEWSAPI_URL)
    url.searchParams.set('country', 'us')
    url.searchParams.set('category', 'business')
    url.searchParams.set('pageSize', String(limit))
    url.searchParams.set('apiKey', apiKey)

    const response = await fetch(url.toString(), { cache: 'no-store' })
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[NewsAPI Business] ${response.status} error:`, errorText)
      throw new Error(`NewsAPI request failed: ${response.status}`)
    }
    
    const payload = await response.json()
    
    if (payload.status === 'error') {
      console.error('[NewsAPI Business] API error:', payload.message)
      return []
    }
    
    const articles = (payload?.articles || []) as Array<{ 
      title?: string
      url?: string
      description?: string
    }>
    
    return articles.slice(0, limit).map((item) =>
      formatArticle(
        item.title || 'Business News', 
        item.url || '', 
        'NewsAPI Business'
      )
    )
  } catch (error) {
    console.error('[NewsAPI Business] fetch failed:', error)
    return []
  }
}

// Fisher-Yates shuffle algorithm for randomizing array order
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

async function fetchAllArticles(limit = MAX_PER_SOURCE, shouldShuffle = true): Promise<Article[]> {
  const fetchers = [
    fetchArxiv(limit),
    fetchHackerNews(limit),
    fetchScienceDaily(limit),
    fetchNewsAPI(limit),
  ]

  const results = await Promise.allSettled(fetchers)
  const articles: Article[] = []

  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      articles.push(...result.value)
    }
  }

  return shouldShuffle ? shuffleArray(articles) : articles
}

function stripHtml(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const paragraphMatches = Array.from(withoutScripts.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => m[1])
  const content = paragraphMatches.length > 0 ? paragraphMatches.join(' ') : withoutScripts
  return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

async function fetchArticleContent(url: string): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Content fetch failed ${res.status}`)
    const html = await res.text()
    const text = stripHtml(html)
    return text ? text.slice(0, 2000) : null
  } catch (error) {
    console.error('[fetchArticleContent] failed:', error)
    return null
  }
}

async function enrichWithContentAndSummary(articles: Article[], generateSummaries: boolean): Promise<Article[]> {
  if (!generateSummaries) return articles

  const enriched = await Promise.allSettled(
    articles.map(async (article) => {
      const content = await fetchArticleContent(article.url)
      if (!content) return { ...article, content: null }

      const summary = await generateArticleSummary(content)
      return { ...article, content: summary }
    })
  )

  return enriched
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<Article>).value)
}

async function persistArticles(articles: Article[]): Promise<Article[]> {
  // Check if supabaseAdmin is available
  if (!supabaseAdmin) {
    console.error('[Persist] Supabase admin client not available - check SUPABASE_SERVICE_KEY')
    return articles
  }

  // Get system user ID for storing shared articles
  const { data: systemProfile, error: systemError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', 'system@betterfeed.local')
    .single()

  if (systemError || !systemProfile?.id) {
    console.error('[Persist] System user not found:', systemError?.message)
    return articles
  }

  const systemUserId = systemProfile.id
  const stored: Article[] = []

  // OPTIMIZATION 1: Bulk check existing posts by article_url
  const articleUrls = articles.map(a => a.url).filter(Boolean)
  const { data: existingPosts, error: existingError } = await supabaseAdmin
    .from('posts')
    .select('id, article_url, title, content')
    .in('article_url', articleUrls)

  if (existingError) {
    console.error('[Persist] Error fetching existing posts:', existingError.message)
  }

  const existingUrlMap = new Map(
    (existingPosts || []).map(post => [post.article_url, post])
  )

  // OPTIMIZATION 2: Separate existing and new articles
  const newArticles: Article[] = []
  
  for (const article of articles) {
    const existing = existingUrlMap.get(article.url)
    if (existing) {
      stored.push({
        ...article,
        id: existing.id,
        content: existing.content,
      })
    } else {
      newArticles.push(article)
    }
  }

  // Generate summaries for new articles only
  if (newArticles.length > 0) {
    const summaryResults = await Promise.allSettled(
      newArticles.map(async (article) => {
        if (article.content) return article
        
        return {
          ...article,
          content: `This is an educational article from ${article.source}. Visit the link to learn about this topic.`
        }
      })
    )

    const articlesWithSummaries = summaryResults
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<Article>).value)

    // OPTIMIZATION 3: Batch insert new articles
    if (articlesWithSummaries.length > 0) {
      const newPosts = articlesWithSummaries.map(article => ({
        user_id: systemUserId,
        article_url: article.url,
        title: article.title,
        content: article.content || null,
        thumbnail_url: null,
        view_count: 0,
      }))

      const { data: insertedPosts, error: insertError } = await supabaseAdmin
        .from('posts')
        .insert(newPosts)
        .select('*')

      if (insertError) {
        console.error('[Persist] Batch insert error:', insertError.message)
        stored.push(...articlesWithSummaries)
      } else if (insertedPosts) {
        insertedPosts.forEach((post, index) => {
          stored.push({
            ...articlesWithSummaries[index],
            id: post.id,
            url: post.article_url,
            title: post.title,
            content: post.content,
          })
        })
      }
    }
  }

  console.log(`[Persist] Stored ${stored.length} articles (${existingPosts?.length || 0} existing, ${newArticles.length} new)`)
  return stored
}

function toArticleResponse(articles: Article[]): ArticleResponse[] {
  const now = new Date().toISOString()
  return articles.map((article, index) => ({
    id: article.id ?? (article.url || `${article.source}-${index}`),
    title: article.title,
    article_url: article.url,
    content: article.content || null,
    thumbnail_url: null,
    source: article.source,
    category: article.category,
    created_at: now,
  }))
}

function buildMeta(count: number) {
  return {
    count,
    page: 1,
    per_page: count,
    total_pages: 1,
  }
}

export async function GET(req: NextRequest) {
  const limit = Math.min(
    MAX_PER_SOURCE,
    Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('limit') || String(MAX_PER_SOURCE), 10))
  )

  const articles = await fetchAllArticles(limit, true)
  const enriched = await enrichWithContentAndSummary(articles, true)
  const stored = await persistArticles(enriched)
  const response = toArticleResponse(stored)
  
  return NextResponse.json(
    { articles: response, meta: buildMeta(response.length) },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as { limit?: number; generateSummaries?: boolean }))
    const limit = Math.min(MAX_PER_SOURCE, Math.max(1, Number(body.limit) || MAX_PER_SOURCE))
    const generateSummaries = body.generateSummaries !== false

    const articles = await fetchAllArticles(limit, true)
    const enriched = await enrichWithContentAndSummary(articles, generateSummaries)
    const stored = await persistArticles(enriched)
    const response = toArticleResponse(stored)
    
    return NextResponse.json(
      { articles: response, meta: buildMeta(response.length) },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('Error in POST /api/articles/fetch:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}