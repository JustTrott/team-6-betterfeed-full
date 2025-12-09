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
  abstract?: string | null // Add abstract field for arXiv
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
      // Use abstract URL (not PDF) for the article link
      const url = getAbstractUrl(entry) || entry.id
      
      const article = formatArticle(entry.title || 'arXiv Article', url, 'arXiv')
      
      // Store the abstract directly - don't try to scrape it!
      article.abstract = entry.summary || null
      
      return article
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

function parseScienceDailyRSS(xml: string): Array<{ title: string; link: string; description?: string }> {
  const items: Array<{ title: string; link: string; description?: string }> = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemMatches) {
    const item = match[1]
    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i)
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i)
    const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i)
    
    const title = (titleMatch && (titleMatch[1] || titleMatch[2]) || '').trim()
    const link = (linkMatch && linkMatch[1] || '').trim()
    const description = (descMatch && (descMatch[1] || descMatch[2]) || '').trim()
    
    if (title && link) {
      items.push({ title, link, description: description || undefined })
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
    return parsed.map((entry) => {
      const article = formatArticle(entry.title, entry.link, 'ScienceDaily')
      // Store description if available
      if (entry.description && entry.description.length > 20) {
        // Strip HTML tags from description
        const cleanDesc = entry.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        article.content = cleanDesc
      }
      return article
    })
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
      content?: string
    }>
    
    return articles.slice(0, limit).map((item) => {
      const article = formatArticle(
        item.title || 'Business News', 
        item.url || '', 
        'NewsAPI Business'
      )
      
      // Preserve description as initial content - NewsAPI descriptions are cleaner than scraped content
      if (item.description && item.description.length > 20) {
        article.content = item.description
      }
      
      return article
    })
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

/**
 * Intelligently extracts main article content from HTML
 * Looks for common article container patterns and filters out boilerplate
 */
function extractArticleContent(html: string): string {
  // Remove scripts, styles, nav, header, footer first
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    
  // Try to find the main article content using common patterns
  const articlePatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ]
  
  for (const pattern of articlePatterns) {
    const match = cleaned.match(pattern)
    if (match && match[1]) {
      cleaned = match[1]
      break
    }
  }
  
  // Extract text from paragraph tags
  const paragraphs: string[] = []
  const pMatches = cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)
  
  for (const match of pMatches) {
    const text = match[1]
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
    
    // Filter out short paragraphs (likely navigation/boilerplate)
    // Filter out paragraphs with lots of links (likely menus)
    // Filter out paragraphs that look like navigation
    if (
      text.length > 40 && 
      !text.match(/^(Home|Menu|Search|Sign|Subscribe|Contact|About|Privacy|Terms|Cookie)/i) &&
      !text.match(/\+\d{1,3}\s*\d{3}\s*\d{3}\s*\d{4}/) && // Phone numbers
      !text.match(/\d{4}\s*(AM|PM|UTC|EST|PST)/i) // Timestamps
    ) {
      paragraphs.push(text)
    }
  }
  
  return paragraphs.join(' ').trim()
}

/**
 * Fetches article content with improved extraction
 * Returns null if content extraction fails or produces low-quality results
 * IMPORTANT: Should NOT be used for PDFs or arXiv abstracts
 */
async function fetchArticleContent(url: string): Promise<string | null> {
  if (!url) return null
  
  // Don't try to scrape PDFs or arXiv abstract pages
  if (url.includes('.pdf') || url.includes('arxiv.org')) {
    return null
  }
  
  try {
    const res = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BetterFeed/1.0; +https://betterfeed.com)'
      }
    })
    
    if (!res.ok) throw new Error(`Content fetch failed ${res.status}`)
    
    const html = await res.text()
    const text = extractArticleContent(html)
    
    // Quality check: ONLY reject obviously broken/garbage content
    // Be very conservative - when in doubt, let it through
    const isBroken = (
      !text ||
      text.length < 50 || // Very short
      // Only reject if content is EXTREMELY broken
      text.match(/██{20,}/) || // 20+ consecutive block characters
      text.match(/(██\s*){30,}/) || // 30+ block characters with spaces
      // Only reject if content is OVERWHELMINGLY non-text
      (text.replace(/[a-zA-Z0-9\s]/g, '').length / text.length > 0.7) || // 70%+ special chars
      // Only reject very specific broken patterns
      (text.includes('Talk to sales') && text.includes('[ESC] Exit Terminal')) || // Both present
      (text.includes('GitHub Copilot') && text.includes('You signed in with another tab')) || // Both present
      // Only reject if ALMOST ALL words are single characters
      (text.split(/\s+/).filter(word => word.length === 1).length / text.split(/\s+/).length > 0.7) // 70%+ single chars
    )
    
    if (isBroken) {
      console.warn(`[fetchArticleContent] Rejecting broken content from ${url}: ${text.substring(0, 100)}`)
      return null
    }
    
    console.log(`[fetchArticleContent] Accepted content from ${url}: ${text.length} chars, starts with: ${text.substring(0, 100)}`)

    
    // Limit to 3000 characters for summarization
    return text.slice(0, 3000)
  } catch (error) {
    console.error('[fetchArticleContent] failed:', error)
    return null
  }
}

async function enrichWithContentAndSummary(articles: Article[], generateSummaries: boolean): Promise<Article[]> {
  if (!generateSummaries) return articles

  const enriched = await Promise.allSettled(
    articles.map(async (article) => {
      // PRIORITY 1: If article has an abstract (arXiv), use it directly
      if (article.abstract && article.abstract.length > 50) {
        console.log(`[Enrichment] Using arXiv abstract for: ${article.title.substring(0, 50)}...`)
        const summary = await generateArticleSummary(article.title, article.abstract, null)
        return { ...article, content: summary }
      }
      
      // PRIORITY 2: If article already has content (e.g., from NewsAPI description), use it
      if (article.content && article.content.length > 50) {
        console.log(`[Enrichment] Using existing content for: ${article.title.substring(0, 50)}...`)
        const summary = await generateArticleSummary(article.title, article.content, null)
        return { ...article, content: summary }
      }
      
      // PRIORITY 3: Try to fetch content from web (but not for PDFs or arXiv)
      const scrapedContent = await fetchArticleContent(article.url)
      
      if (!scrapedContent) {
        // If scraping fails, use a source-appropriate fallback message
        console.log(`[Enrichment] Using fallback for: ${article.title.substring(0, 50)}...`)
        
        let fallbackMessage = ''
        if (article.source === 'Hacker News') {
          fallbackMessage = `This is a trending tech article from Hacker News. Visit the link to read the full discussion and article: ${article.title}`
        } else if (article.source === 'ScienceDaily') {
          fallbackMessage = `This research article from ScienceDaily discusses: ${article.title}. Read the full article for detailed findings.`
        } else {
          fallbackMessage = `Read this article from ${article.source}: ${article.title}`
        }
        
        return { 
          ...article, 
          content: fallbackMessage
        }
      }

      console.log(`[Enrichment] Using scraped content for: ${article.title.substring(0, 50)}...`)
      const summary = await generateArticleSummary(article.title, scrapedContent, null)
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
  const articlesToUpdate: Article[] = []
  
  for (const article of articles) {
    const existing = existingUrlMap.get(article.url)
    if (existing) {
      // If existing post has no content (NULL), treat it as needing update
      if (!existing.content && article.content) {
        articlesToUpdate.push({
          ...article,
          id: existing.id,
        })
      } else {
        // Use existing content if it has one, otherwise use new content
        stored.push({
          ...article,
          id: existing.id,
          content: existing.content || article.content,
        })
      }
    } else {
      newArticles.push(article)
    }
  }

  // Update existing posts that had NULL content
  if (articlesToUpdate.length > 0) {
    console.log(`[Persist] Updating ${articlesToUpdate.length} posts with new summaries`)
    
    const updateResults = await Promise.allSettled(
      articlesToUpdate.map(async (article) => {
        const { data: updatedPost, error: updateError } = await supabaseAdmin!
          .from('posts')
          .update({ content: article.content })
          .eq('id', article.id)
          .select()
          .single()

        if (updateError) {
          console.error(`[Persist] Error updating post ${article.id}:`, updateError.message)
          return article
        }
        
        return {
          ...article,
          content: updatedPost.content,
        }
      })
    )

    const updatedArticles = updateResults
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<Article>).value)
    
    stored.push(...updatedArticles)
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

  console.log(`[Persist] Stored ${stored.length} articles (${existingPosts?.length || 0} existing, ${articlesToUpdate.length} updated, ${newArticles.length} new)`)
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