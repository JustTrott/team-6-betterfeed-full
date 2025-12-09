import { NextRequest, NextResponse } from 'next/server'
import { searchArticles, getPdfUrl, getAbstractUrl, type ArxivEntry } from '@/lib/services/arxiv'
import { generateArticleSummary } from '@/lib/services/summarize'
import { createClient } from '@supabase/supabase-js'

// Create supabaseAdmin directly in App Router with proper env vars
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null

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

// Match frontend categories exactly
const CATEGORY_BY_SOURCE: Record<string, string> = {
  'arXiv': 'Academia & Research',
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
      if (url) articles.push(formatArticle(data.title || 'Hacker News Story', url, 'Hacker News'))
    }

    return articles
  } catch (error) {
    console.error('[Hacker News] fetch failed:', error)
    return []
  }
}

async function fetchScienceDaily(limit: number): Promise<Article[]> {
  try {
    const res = await fetch(SCIENCE_DAILY_RSS, { 
      cache: 'no-store',
      signal: AbortSignal.timeout(8000) // 8 second timeout
    })
    
    if (!res.ok) {
      console.error(`[ScienceDaily] HTTP ${res.status}: ${res.statusText}`)
      return []
    }

    const xml = await res.text()
    console.log(`[ScienceDaily] Fetched ${xml.length} bytes of XML`)
    
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
    const articles: Article[] = []

    for (const match of itemMatches) {
      if (articles.length >= limit) break
      const itemXml = match[1]
      
      // Try CDATA format first, then plain text
      const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/)
      
      if (titleMatch && linkMatch) {
        const title = titleMatch[1].trim()
        const link = linkMatch[1].trim()
        if (title && link) {
          articles.push(formatArticle(title, link, 'ScienceDaily'))
        }
      }
    }

    console.log(`[ScienceDaily] Successfully parsed ${articles.length} articles`)
    return articles
  } catch (error) {
    console.error('[ScienceDaily] fetch failed:', error)
    return []
  }
}

async function fetchNewsAPI(limit: number): Promise<Article[]> {
  const apiKey = process.env.NEWSAPI_KEY
  if (!apiKey) {
    console.error('[NewsAPI Business] NEWSAPI_KEY not configured')
    return []
  }

  try {
    const url = new URL(NEWSAPI_URL)
    url.searchParams.set('category', 'business')
    url.searchParams.set('language', 'en')
    url.searchParams.set('pageSize', String(limit))
    url.searchParams.set('apiKey', apiKey)

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) throw new Error(`NewsAPI failed ${res.status}`)

    const data = (await res.json()) as {
      articles: Array<{
        title?: string
        url?: string
        description?: string
      }>
    }
    
    return data.articles.slice(0, limit).map((item) =>
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

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

async function fetchAllArticles(limit = MAX_PER_SOURCE, shouldShuffle = true): Promise<Article[]> {
  console.log(`[FetchAll] Starting with limit=${limit} per source`)
  
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
      console.log(`[FetchAll] Source returned ${result.value.length} articles`)
      articles.push(...result.value)
    } else if (result.status === 'rejected') {
      console.error(`[FetchAll] Source failed:`, result.reason)
    }
  }

  console.log(`[FetchAll] Total: ${articles.length} articles from all sources`)
  const categoryCounts: Record<string, number> = {}
  articles.forEach(a => {
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1
  })
  console.log(`[FetchAll] By category:`, categoryCounts)

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
    const res = await fetch(url, { 
      cache: 'no-store',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    if (!res.ok) return null
    const html = await res.text()
    const text = stripHtml(html)
    return text ? text.slice(0, 2000) : null
  } catch (error) {
    console.error(`[fetchArticleContent] failed for ${url}:`, error)
    return null
  }
}

// OPTIMIZED: Return articles with cached summaries immediately, generate new ones in background
async function loadArticlesWithSmartCache(articles: Article[]): Promise<{ 
  articlesWithContent: Article[], 
  articlesToProcess: Article[],
  systemUserId: string | null
}> {
  if (!supabaseAdmin) {
    console.error('[Cache] ⚠️  SUPABASE_SERVICE_KEY not configured')
    // Return with placeholder summaries
    return { 
      articlesWithContent: articles.map(a => ({ 
        ...a, 
        content: `This ${a.source} article explores ${a.title}. Click to read the full article and discuss it with AI.` 
      })), 
      articlesToProcess: [],
      systemUserId: null
    }
  }

  // Get system user
  const { data: systemProfile, error: systemError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', 'system@betterfeed.local')
    .single()

  if (systemError || !systemProfile?.id) {
    console.error('[Cache] System user not found:', systemError?.message)
    return { 
      articlesWithContent: articles.map(a => ({ 
        ...a, 
        content: `This ${a.source} article explores ${a.title}. Click to read the full article and discuss it with AI.` 
      })), 
      articlesToProcess: [],
      systemUserId: null
    }
  }

  const systemUserId = systemProfile.id
  const articleUrls = articles.map(a => a.url).filter(Boolean)

  // Fast bulk check for existing posts
  const { data: existingPosts } = await supabaseAdmin
    .from('posts')
    .select('id, article_url, title, content')
    .in('article_url', articleUrls)

  const cacheMap = new Map(
    (existingPosts || []).map(post => [post.article_url, post])
  )

  const articlesWithContent: Article[] = []
  const articlesToProcess: Article[] = []

  for (const article of articles) {
    const cached = cacheMap.get(article.url)
    if (cached?.content) {
      // Has cached summary - use it
      articlesWithContent.push({
        ...article,
        id: cached.id,
        content: cached.content,
      })
    } else {
      // No summary yet - use smart placeholder and queue for processing
      articlesWithContent.push({
        ...article,
        id: cached?.id,
        content: `This ${article.source} article explores ${article.title}. Click to read the full article and discuss it with AI.`,
      })
      articlesToProcess.push({ ...article, id: cached?.id })
    }
  }

  console.log(`[Cache] ✓ ${existingPosts?.length || 0} cached, ${articlesToProcess.length} to process`)

  return { articlesWithContent, articlesToProcess, systemUserId }
}

// BACKGROUND: Generate and save AI summaries (non-blocking)
async function processArticlesInBackground(articles: Article[], systemUserId: string) {
  if (articles.length === 0 || !supabaseAdmin) return

  console.log(`[Background] 🤖 Processing ${articles.length} articles...`)

  // Process 2 at a time to avoid rate limits
  for (let i = 0; i < articles.length; i += 2) {
    const batch = articles.slice(i, i + 2)
    
    await Promise.allSettled(
      batch.map(async (article) => {
        try {
          // Fetch content from article URL
          const content = await fetchArticleContent(article.url)
          if (!content) {
            console.log(`[Background] ⚠️  No content: ${article.title.slice(0, 40)}...`)
            return
          }

          // Generate AI summary
          const summary = await generateArticleSummary(content)
          
          // Save to database
          if (article.id) {
            // Update existing post
            await supabaseAdmin
              .from('posts')
              .update({ content: summary })
              .eq('id', article.id)
          } else {
            // Insert new post
            await supabaseAdmin
              .from('posts')
              .insert({
                user_id: systemUserId,
                article_url: article.url,
                title: article.title,
                content: summary,
                thumbnail_url: null,
                view_count: 0,
              })
          }
          
          console.log(`[Background] ✓ ${article.title.slice(0, 40)}...`)
        } catch (error) {
          console.error(`[Background] ❌ ${article.url}:`, error)
        }
      })
    )

    // Small delay between batches
    if (i + 2 < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`[Background] ✅ Completed ${articles.length} articles`)
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
  try {
    const limit = Math.min(
      MAX_PER_SOURCE,
      Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('limit') || String(MAX_PER_SOURCE), 10))
    )

    // 1. Fetch article metadata (fast - 2s)
    const articles = await fetchAllArticles(limit, true)
    
    // 2. Load from cache + identify articles needing summaries (fast - 0.5s)
    const { articlesWithContent, articlesToProcess, systemUserId } = await loadArticlesWithSmartCache(articles)
    
    // 3. Process new articles in background (non-blocking)
    if (articlesToProcess.length > 0 && systemUserId) {
      processArticlesInBackground(articlesToProcess, systemUserId).catch(err => {
        console.error('[Background] Failed:', err)
      })
    }
    
    // 4. Return immediately with cached summaries (total ~2.5s)
    const response = toArticleResponse(articlesWithContent)
    
    return NextResponse.json(
      { articles: response, meta: buildMeta(response.length) },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('Error in GET /api/articles/fetch:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as { limit?: number }))
    const limit = Math.min(MAX_PER_SOURCE, Math.max(1, Number(body.limit) || MAX_PER_SOURCE))

    // Same flow as GET
    const articles = await fetchAllArticles(limit, true)
    const { articlesWithContent, articlesToProcess, systemUserId } = await loadArticlesWithSmartCache(articles)
    
    if (articlesToProcess.length > 0 && systemUserId) {
      processArticlesInBackground(articlesToProcess, systemUserId).catch(err => {
        console.error('[Background] Failed:', err)
      })
    }
    
    const response = toArticleResponse(articlesWithContent)
    
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