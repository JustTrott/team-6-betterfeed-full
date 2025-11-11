/**
 * OpenAlex API Service
 * 
 * Provides functions to interact with OpenAlex API for fetching scientific articles.
 * Uses polite pool authentication with email ta2601@nyu.edu for better response times.
 * 
 * Documentation: https://docs.openalex.org
 */

const OPENALEX_BASE_URL = 'https://api.openalex.org'
const POLITE_POOL_EMAIL = 'ta2601@nyu.edu'

export interface OpenAlexWork {
  id: string
  title: string
  display_name: string
  abstract?: string
  publication_date?: string
  authorships?: Array<{
    author: {
      display_name: string
    }
  }>
  primary_location?: {
    landing_page_url?: string
    pdf_url?: string
  }
  open_access?: {
    is_oa: boolean
    oa_url?: string
    oa_status?: string
  }
  locations?: Array<{
    landing_page_url?: string
    pdf_url?: string
  }>
  doi?: string
  concepts?: Array<{
    display_name: string
  }>
}

export interface OpenAlexSearchResponse {
  results: OpenAlexWork[]
  meta: {
    count: number
    page: number
    per_page: number
  }
}

export interface OpenAlexSearchParams {
  query?: string
  filter?: string
  perPage?: number
  page?: number
  sort?: string
}

/**
 * Search for works (articles) using OpenAlex API
 */
export async function searchWorks(params: OpenAlexSearchParams = {}): Promise<OpenAlexSearchResponse> {
  const { query, filter, perPage = 25, page = 1, sort } = params

  const url = new URL(`${OPENALEX_BASE_URL}/works`)
  
  // Add polite pool email
  url.searchParams.set('mailto', POLITE_POOL_EMAIL)
  
  // Add search query if provided
  if (query) {
    url.searchParams.set('search', query)
  }
  
  // Add filters if provided
  if (filter) {
    url.searchParams.set('filter', filter)
  }
  
  // Add pagination
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))
  
  // Add sorting if provided
  if (sort) {
    url.searchParams.set('sort', sort)
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': `BetterFeed/1.0 (mailto:${POLITE_POOL_EMAIL})`,
      },
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return {
      results: data.results || [],
      meta: {
        count: data.meta?.count || 0,
        page: data.meta?.page || page,
        per_page: data.meta?.per_page || perPage,
      },
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to fetch works from OpenAlex API')
  }
}

/**
 * Get a specific work by OpenAlex ID
 */
export async function getWork(workId: string): Promise<OpenAlexWork> {
  // Remove 'https://openalex.org/' prefix if present
  const id = workId.replace('https://openalex.org/', '').replace('W', '')
  
  const url = new URL(`${OPENALEX_BASE_URL}/works/${id}`)
  url.searchParams.set('mailto', POLITE_POOL_EMAIL)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': `BetterFeed/1.0 (mailto:${POLITE_POOL_EMAIL})`,
      },
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      if (response.status === 404) {
        throw new Error('Work not found')
      }
      throw new Error(`OpenAlex API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to fetch work from OpenAlex API')
  }
}

/**
 * Extract the best available full-text URL from a work
 * Prioritizes open access URLs, then landing pages, then PDFs
 */
export function getFullTextUrl(work: OpenAlexWork): string | null {
  // First, try open access URL
  if (work.open_access?.oa_url) {
    return work.open_access.oa_url
  }

  // Then try primary location landing page
  if (work.primary_location?.landing_page_url) {
    return work.primary_location.landing_page_url
  }

  // Try primary location PDF
  if (work.primary_location?.pdf_url) {
    return work.primary_location.pdf_url
  }

  // Try other locations
  if (work.locations && work.locations.length > 0) {
    for (const location of work.locations) {
      if (location.landing_page_url) {
        return location.landing_page_url
      }
      if (location.pdf_url) {
        return location.pdf_url
      }
    }
  }

  // Fallback to DOI URL if available
  if (work.doi) {
    return `https://doi.org/${work.doi}`
  }

  return null
}

/**
 * Format authors from a work
 */
export function formatAuthors(work: OpenAlexWork): string {
  if (!work.authorships || work.authorships.length === 0) {
    return 'Unknown authors'
  }

  const authors = work.authorships
    .slice(0, 3)
    .map((authorship) => authorship.author.display_name)

  if (work.authorships.length > 3) {
    return `${authors.join(', ')}, et al.`
  }

  return authors.join(', ')
}

/**
 * Extract categories/concepts from a work
 */
export function extractCategories(work: OpenAlexWork): string[] {
  if (!work.concepts || work.concepts.length === 0) {
    return ['General']
  }

  return work.concepts
    .slice(0, 3)
    .map((concept) => concept.display_name)
}

