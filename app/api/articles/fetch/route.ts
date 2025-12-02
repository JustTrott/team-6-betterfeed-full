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
  'arXiv': 'Technology & Computing', // IAB: IAB19
  'Hacker News': 'Technology & Computing', // IAB: IAB19
  'ScienceDaily': 'Science', // IAB: IAB15
  'AlphaVantage': 'Business & Finance', // IAB: IAB13
  'World News API': 'Government & Politics', // IAB: IAB11
  'API Ninjas Facts': 'Education', // IAB: IAB5 (Education) / IAB21 (Reference)
}

const HN_TOP_STORIES_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json'
const HN_ITEM_URL = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`
const SCIENCE_DAILY_RSS = 'https://www.sciencedaily.com/rss/top/science.xml'
const ALPHAVANTAGE_NEWS_URL = 'https://www.alphavantage.co/query'
const WORLD_NEWS_URL = 'https://api.worldnewsapi.com/search-news'
const API_NINJAS_FACTS_URL = 'https://api.api-ninjas.com/v1/facts'

const MAX_PER_SOURCE = 5

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

async function fetchAlphaVantage(limit: number): Promise<Article[]> {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) {
    console.warn('[AlphaVantage] ALPHAVANTAGE_API_KEY is not set')
    return []
  }

  try {
    const url = new URL(ALPHAVANTAGE_NEWS_URL)
    url.searchParams.set('function', 'NEWS_SENTIMENT')
    url.searchParams.set('topics', 'financial_markets')
    url.searchParams.set('sort', 'LATEST')
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('apikey', apiKey)

    const response = await fetch(url.toString(), { cache: 'no-store' })
    if (!response.ok) throw new Error(`AlphaVantage request failed: ${response.status}`)
    const payload = await response.json()
    const feed = (payload?.feed || []) as Array<{ title?: string; url?: string }>
    return feed.slice(0, limit).map((item) =>
      formatArticle(item.title || 'Market News', item.url || '', 'AlphaVantage')
    )
  } catch (error) {
    console.error('[AlphaVantage] fetch failed:', error)
    return []
  }
}

async function fetchWorldNews(limit: number): Promise<Article[]> {
  const apiKey = process.env.WORLDNEWS_API_KEY
  if (!apiKey) {
    console.warn('[World News API] WORLDNEWS_API_KEY is not set')
    return []
  }

  try {
    const url = new URL(WORLD_NEWS_URL)
    url.searchParams.set('category', 'politics')
    url.searchParams.set('language', 'en')
    url.searchParams.set('number', String(limit))
    url.searchParams.set('api-key', apiKey)

    const response = await fetch(url.toString(), { cache: 'no-store' })
    if (!response.ok) throw new Error(`World News request failed: ${response.status}`)
    const payload = await response.json()
    const newsItems = (payload?.news || payload?.articles || []) as Array<{ title?: string; url?: string }>
    return newsItems.slice(0, limit).map((item) =>
      formatArticle(item.title || 'World News', item.url || '', 'World News API')
    )
  } catch (error) {
    console.error('[World News API] fetch failed:', error)
    return []
  }
}

async function fetchApiNinjasFacts(limit: number): Promise<Article[]> {
  const apiKey = process.env.API_NINJAS_API_KEY || process.env.API_NINJAS_KEY
  if (!apiKey) {
    console.warn('[API Ninjas Facts] API_NINJAS_API_KEY is not set')
    return []
  }

  try {
    const url = new URL(API_NINJAS_FACTS_URL)
    url.searchParams.set('limit', String(limit))

    const response = await fetch(url.toString(), {
      cache: 'no-store',
      headers: { 'X-Api-Key': apiKey },
    })
    if (!response.ok) throw new Error(`API Ninjas request failed: ${response.status}`)
    const data = (await response.json()) as Array<{ fact?: string }>
    return data.slice(0, limit).map((item) =>
      formatArticle(item.fact || 'Fact', API_NINJAS_FACTS_URL, 'API Ninjas Facts')
    )
  } catch (error) {
    console.error('[API Ninjas Facts] fetch failed:', error)
    return []
  }
}

async function fetchAllArticles(limit = MAX_PER_SOURCE): Promise<Article[]> {
  const fetchers = [
    fetchArxiv(limit),
    fetchHackerNews(limit),
    fetchScienceDaily(limit),
    fetchAlphaVantage(limit),
    fetchWorldNews(limit),
    fetchApiNinjasFacts(limit),
  ]

  const results = await Promise.allSettled(fetchers)
  const articles: Article[] = []

  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      articles.push(...result.value)
    }
  }

  return articles
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
    return text ? text.substring(0, 8000) : null
  } catch (error) {
    console.warn(`[content] failed for ${url}:`, error)
    return null
  }
}

async function enrichWithContentAndSummary(articles: Article[], generateSummaries: boolean): Promise<Article[]> {
  const results = await Promise.allSettled(
    articles.map(async (article) => {
      const fullText = await fetchArticleContent(article.url)
      let content: string | null = fullText

      if (generateSummaries) {
        try {
          content = await generateArticleSummary(article.title, fullText || undefined, fullText || undefined)
        } catch (error) {
          console.error(`[summary] failed for ${article.url}:`, error)
        }
      }

      return { ...article, content: content || fullText || null }
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<Article> => r.status === 'fulfilled')
    .map((r) => r.value)
}

async function ensureSystemUserId(): Promise<string | null> {
  if (!supabaseAdmin) return null

  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', 'system@betterfeed.local')
    .maybeSingle()

  if (existingUser) return existingUser.id
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.warn('Error fetching system user:', fetchError)
  }

  const { data: newUser, error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert({
      email: 'system@betterfeed.local',
      username: 'system',
    })
    .select('id')
    .single()

  if (insertError || !newUser) {
    console.error('Failed to create system user:', insertError)
    return null
  }

  return newUser.id
}

async function persistArticles(articles: Article[]): Promise<Article[]> {
  if (!supabaseAdmin || articles.length === 0) return articles

  const systemUserId = await ensureSystemUserId()
  if (!systemUserId) return articles

  const stored: Article[] = []

  for (const article of articles) {
    const { data: existingPosts, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('article_url', article.url)
      .limit(1)

    if (fetchError) {
      console.warn('Error checking existing post:', fetchError)
      stored.push(article)
      continue
    }

    const existing = existingPosts?.[0]
    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from('posts')
        .update({
          title: article.title,
          content: article.content ?? existing.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        console.warn('Error updating post:', updateError)
      }

      stored.push({
        ...article,
        id: existing.id,
        title: existing.title || article.title,
        content: article.content ?? existing.content,
        url: article.url,
      })
      continue
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('posts')
      .insert({
        user_id: systemUserId,
        article_url: article.url,
        title: article.title,
        content: article.content || null,
        thumbnail_url: null,
        view_count: 0,
      })
      .select('*')
      .single()

    if (insertError) {
      console.warn('Error inserting post:', insertError)
      stored.push(article)
      continue
    }

    stored.push({
      ...article,
      id: inserted.id,
      url: inserted.article_url,
      title: inserted.title,
      content: inserted.content,
    })
  }

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

  const articles = await fetchAllArticles(limit)
  const enriched = await enrichWithContentAndSummary(articles, true)
  const stored = await persistArticles(enriched)
  const response = toArticleResponse(stored)
  return NextResponse.json({ articles: response, meta: buildMeta(response.length) })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as { limit?: number; generateSummaries?: boolean }))
    const limit = Math.min(MAX_PER_SOURCE, Math.max(1, Number(body.limit) || MAX_PER_SOURCE))
    const generateSummaries = body.generateSummaries !== false

    const articles = await fetchAllArticles(limit)
    const enriched = await enrichWithContentAndSummary(articles, generateSummaries)
    const stored = await persistArticles(enriched)
    const response = toArticleResponse(stored)
    return NextResponse.json({ articles: response, meta: buildMeta(response.length) })
  } catch (error) {
    console.error('Error in POST /api/articles/fetch:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}
