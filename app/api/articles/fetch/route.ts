import { NextRequest, NextResponse } from 'next/server'
import { searchArticles, getPdfUrl, getAbstractUrl, formatAuthors, getPrimaryCategory, type ArxivEntry } from '@/lib/services/arxiv'
import { generateArticleSummary } from '@/lib/services/summarize'

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
 * POST /api/articles/fetch
 * 
 * Fetch scientific articles from arXiv API and optionally generate summaries
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

    // Search for articles
    const searchResponse = await searchArticles({
      query: query || undefined,
      category,
      perPage: Math.min(perPage, 200), // arXiv max is 2000, but we limit to 200
      page,
      sortBy,
      sortOrder,
    })

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
        const category = getPrimaryCategory(entry)
        const publicationDate = entry.published || entry.updated || new Date().toISOString()
        const abstract = entry.summary || null

        // Generate summary if requested
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

        return {
          id: entry.id,
          title,
          article_url: articleUrl,
          content: summary,
          thumbnail_url: thumbnailUrl,
          source: authors,
          category,
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

