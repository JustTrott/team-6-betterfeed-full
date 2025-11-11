import { NextRequest, NextResponse } from 'next/server'
import { searchArticles, getPdfUrl, getAbstractUrl, formatAuthors, getPrimaryCategory, type ArxivEntry } from '@/lib/services/arxiv'
import { generateArticleSummary } from '@/lib/services/summarize'
import { supabaseAdmin } from '@/lib/db/client'
import { Post } from '@/lib/db/schema'

export interface FetchArticlesRequest {
  query?: string
  category?: string
  perPage?: number
  page?: number
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate'
  sortOrder?: 'ascending' | 'descending'
  generateSummaries?: boolean
}

export interface ArticleResponse {
  id: string
  title: string
  article_url: string
  content: string | null
  thumbnail_url: string | null
  source: string
  category: string
  created_at: string
  abstract?: string
  authors?: string
  publication_date?: string
  doi?: string
}

/**
 * Get or create a system user for storing arXiv articles
 */
async function getSystemUserId(): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not available')
  }

  // Try to find an existing system user (email: system@betterfeed.local)
  const { data: existingUser, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', 'system@betterfeed.local')
    .maybeSingle()

  if (existingUser) {
    return existingUser.id
  }

  // If fetch error (not just "not found"), log it but continue to try creating
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.warn('Error fetching system user:', fetchError)
  }

  // Create system user if it doesn't exist
  // Try with fixed username first, if that fails due to conflict, use timestamp
  let username = 'system'
  let { data: newUser, error: insertError } = await supabaseAdmin
    .from('profiles')
    .insert({
      email: 'system@betterfeed.local',
      username: username,
    })
    .select('id')
    .single()

  // If username conflict, try with timestamp
  if (insertError?.code === '23505' && insertError.message.includes('username')) {
    username = `system_${Date.now()}`
    const retryResult = await supabaseAdmin
      .from('profiles')
      .insert({
        email: 'system@betterfeed.local',
        username: username,
      })
      .select('id')
      .single()
    
    newUser = retryResult.data
    insertError = retryResult.error
  }

  if (insertError || !newUser) {
    // If insert fails due to unique constraint, try fetching again
    if (insertError?.code === '23505') {
      const { data: retryUser } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', 'system@betterfeed.local')
        .maybeSingle()
      
      if (retryUser) {
        return retryUser.id
      }
    }
    throw new Error(`Failed to create system user: ${insertError?.message || 'Unknown error'}`)
  }

  return newUser.id
}

/**
 * POST /api/articles/fetch
 * 
 * Fetch scientific articles from arXiv API and optionally generate summaries.
 * Checks database first and only generates summaries for articles that don't exist.
 */
export async function POST(req: NextRequest) {
  try {
    const body: FetchArticlesRequest = await req.json()
    const {
      query = '',
      category,
      perPage = 25,
      page = 1,
      sortBy = 'submittedDate',
      sortOrder = 'descending',
      generateSummaries = true,
    } = body

    // Search for articles from arXiv
    const searchResponse = await searchArticles({
      query: query || undefined,
      category,
      perPage: Math.min(perPage, 200), // arXiv max is 2000, but we limit to 200
      page,
      sortBy,
      sortOrder,
    })

    // Get system user ID for storing articles
    const systemUserId = await getSystemUserId()

    // Process each entry
    const articles: ArticleResponse[] = await Promise.all(
      searchResponse.entries.map(async (entry: ArxivEntry) => {
        // Extract URLs
        const pdfUrl = getPdfUrl(entry)
        const abstractUrl = getAbstractUrl(entry)
        const articleUrl = pdfUrl || abstractUrl
        
        // Get basic metadata
        const title = entry.title || 'Untitled'
        const authors = formatAuthors(entry)
        const articleCategory = getPrimaryCategory(entry)
        const publicationDate = entry.published || entry.updated || new Date().toISOString()
        const abstract = entry.summary || null

        // Check if article already exists in database
        let existingPost: Post | null = null
        if (supabaseAdmin) {
          const { data: posts } = await supabaseAdmin
            .from('posts')
            .select('*')
            .eq('article_url', articleUrl)
            .limit(1)
          
          existingPost = posts && posts.length > 0 ? (posts[0] as Post) : null
        }

        // If article exists and has content, use it
        if (existingPost && existingPost.content) {
          return {
            id: String(existingPost.id),
            title: existingPost.title,
            article_url: existingPost.article_url,
            content: existingPost.content,
            thumbnail_url: existingPost.thumbnail_url,
            source: authors,
            category: articleCategory,
            created_at: existingPost.created_at,
            abstract: abstract || undefined,
            authors: authors || undefined,
            publication_date: publicationDate || undefined,
            doi: entry.doi || undefined,
          }
        }

        // Generate summary if requested and article doesn't exist or has no content
        let summary: string | null = null
        if (generateSummaries && abstract) {
          try {
            summary = await generateArticleSummary(title, abstract, null)
          } catch (error) {
            console.error('Error generating summary for article:', entry.id, error)
            // Fallback to abstract if summary generation fails
            summary = abstract.length > 300 ? abstract.substring(0, 300) + '...' : abstract
          }
        } else if (abstract) {
          // Use abstract as content if summary generation is disabled
          summary = abstract.length > 500 ? abstract.substring(0, 500) + '...' : abstract
        }

        // Extract DOI if available
        const doi = entry.doi || null

        // Generate thumbnail URL (placeholder - arXiv doesn't provide thumbnails)
        const thumbnailUrl = null

        // Store or update article in database
        if (supabaseAdmin) {
          if (existingPost) {
            // Update existing post with generated content
            await supabaseAdmin
              .from('posts')
              .update({
                title,
                content: summary,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingPost.id)
          } else {
            // Create new post
            await supabaseAdmin
              .from('posts')
              .insert({
                user_id: systemUserId,
                article_url: articleUrl,
                title,
                content: summary,
                thumbnail_url: thumbnailUrl,
                view_count: 0,
              })
          }
        }

        return {
          id: entry.id,
          title,
          article_url: articleUrl,
          content: summary,
          thumbnail_url: thumbnailUrl,
          source: authors,
          category: articleCategory,
          created_at: publicationDate,
          abstract: abstract || undefined,
          authors: authors || undefined,
          publication_date: publicationDate || undefined,
          doi: doi || undefined,
        }
      })
    )

    return NextResponse.json({
      articles,
      meta: {
        count: searchResponse.totalResults,
        page: Math.floor(searchResponse.startIndex / searchResponse.itemsPerPage) + 1,
        per_page: searchResponse.itemsPerPage,
        total_pages: Math.ceil(searchResponse.totalResults / searchResponse.itemsPerPage),
      },
    })
  } catch (error) {
    console.error('Error fetching articles:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: error.message || 'Failed to fetch articles' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching articles' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/articles/fetch
 * 
 * Simple GET endpoint for testing (uses query parameters)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const query = searchParams.get('query') || ''
    const category = searchParams.get('category') || undefined
    const perPage = parseInt(searchParams.get('per_page') || '25', 10)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const sortBy = (searchParams.get('sort_by') as 'relevance' | 'lastUpdatedDate' | 'submittedDate') || 'submittedDate'
    const sortOrder = (searchParams.get('sort_order') as 'ascending' | 'descending') || 'descending'
    const generateSummaries = searchParams.get('generate_summaries') !== 'false'

    // Convert GET request to POST format
    const body: FetchArticlesRequest = {
      query,
      category,
      perPage,
      page,
      sortBy,
      sortOrder,
      generateSummaries,
    }

    // Create a new request with the body
    const mockReq = new NextRequest(req.url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return POST(mockReq)
  } catch (error) {
    console.error('Error in GET /api/articles/fetch:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

