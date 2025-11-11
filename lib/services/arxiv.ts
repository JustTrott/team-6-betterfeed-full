/**
 * arXiv API Service
 * 
 * Provides functions to interact with arXiv API for fetching scientific preprints.
 * arXiv covers physics, mathematics, computer science, quantitative biology, and more.
 * 
 * Documentation: https://arxiv.org/help/api
 */

const ARXIV_BASE_URL = 'http://export.arxiv.org/api/query'

export interface ArxivEntry {
  id: string
  title: string
  summary: string
  published: string
  updated: string
  authors: Array<{
    name: string
  }>
  links: Array<{
    rel: string
    href: string
    type?: string
  }>
  category: string[]
  doi?: string
}

export interface ArxivFeed {
  entries: ArxivEntry[]
  totalResults: number
  startIndex: number
  itemsPerPage: number
}

export interface ArxivSearchParams {
  query?: string
  category?: string
  perPage?: number
  page?: number
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate'
  sortOrder?: 'ascending' | 'descending'
}

/**
 * Parse arXiv Atom XML response
 * Uses regex-based parsing for Node.js compatibility
 */
function parseArxivXML(xmlText: string): ArxivFeed {
  // Extract total results, start index, and items per page
  const totalResultsMatch = xmlText.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/)
  const startIndexMatch = xmlText.match(/<opensearch:startIndex>(\d+)<\/opensearch:startIndex>/)
  const itemsPerPageMatch = xmlText.match(/<opensearch:itemsPerPage>(\d+)<\/opensearch:itemsPerPage>/)

  const totalResults = totalResultsMatch ? parseInt(totalResultsMatch[1], 10) : 0
  const startIndex = startIndexMatch ? parseInt(startIndexMatch[1], 10) : 0
  const itemsPerPage = itemsPerPageMatch ? parseInt(itemsPerPageMatch[1], 10) : 0

  // Extract all entries
  const entryMatches = xmlText.matchAll(/<entry>([\s\S]*?)<\/entry>/g)
  const entries: ArxivEntry[] = []

  for (const entryMatch of entryMatches) {
    const entryXml = entryMatch[1]

    // Extract fields using regex
    const idMatch = entryXml.match(/<id>(.*?)<\/id>/)
    const titleMatch = entryXml.match(/<title>(.*?)<\/title>/)
    const summaryMatch = entryXml.match(/<summary>(.*?)<\/summary>/)
    const publishedMatch = entryXml.match(/<published>(.*?)<\/published>/)
    const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/)
    const doiMatch = entryXml.match(/<arxiv:doi>(.*?)<\/arxiv:doi>/)

    const id = idMatch ? idMatch[1].trim() : ''
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'Untitled'
    const summary = summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, ' ') : ''
    const published = publishedMatch ? publishedMatch[1].trim() : ''
    const updated = updatedMatch ? updatedMatch[1].trim() : ''
    const doi = doiMatch ? doiMatch[1].trim() : undefined

    // Extract authors
    const authorMatches = entryXml.matchAll(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g)
    const authors = Array.from(authorMatches).map((match) => ({
      name: match[1].trim(),
    }))

    // Extract links
    const linkMatches = entryXml.matchAll(/<link\s+([^>]+)\/>/g)
    const links = Array.from(linkMatches).map((match) => {
      const attrs = match[1]
      const relMatch = attrs.match(/rel="([^"]+)"/)
      const hrefMatch = attrs.match(/href="([^"]+)"/)
      const typeMatch = attrs.match(/type="([^"]+)"/)
      return {
        rel: relMatch ? relMatch[1] : '',
        href: hrefMatch ? hrefMatch[1] : '',
        type: typeMatch ? typeMatch[1] : undefined,
      }
    })

    // Extract categories
    const categoryMatches = entryXml.matchAll(/<category\s+term="([^"]+)"\s*\/>/g)
    const categories = Array.from(categoryMatches).map((match) => match[1])

    entries.push({
      id,
      title,
      summary,
      published,
      updated,
      authors,
      links,
      category: categories,
      doi,
    })
  }

  return {
    entries,
    totalResults,
    startIndex,
    itemsPerPage,
  }
}

/**
 * Search for articles using arXiv API
 */
export async function searchArticles(params: ArxivSearchParams = {}): Promise<ArxivFeed> {
  const {
    query = '',
    category,
    perPage = 25,
    page = 1,
    sortBy = 'submittedDate',
    sortOrder = 'descending',
  } = params

  const url = new URL(ARXIV_BASE_URL)
  
  // Build search query
  let searchQuery = query
  if (category) {
    // arXiv category format: cat:cs.AI, cat:math.CO, etc.
    const categoryQuery = `cat:${category}`
    searchQuery = searchQuery ? `${searchQuery} AND ${categoryQuery}` : categoryQuery
  }
  
  if (searchQuery) {
    url.searchParams.set('search_query', searchQuery)
  } else {
    // Default: get all recent articles
    url.searchParams.set('search_query', 'all')
  }
  
  // Pagination
  const startIndex = (page - 1) * perPage
  url.searchParams.set('start', String(startIndex))
  url.searchParams.set('max_results', String(Math.min(perPage, 200))) // arXiv max is 2000, but we limit to 200
  
  // Sorting
  url.searchParams.set('sortBy', sortBy)
  url.searchParams.set('sortOrder', sortOrder)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'BetterFeed/1.0 (ta2601@nyu.edu)',
      },
    })

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`)
    }

    const xmlText = await response.text()
    return parseArxivXML(xmlText)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to fetch articles from arXiv API')
  }
}

/**
 * Get a specific article by arXiv ID
 */
export async function getArticle(arxivId: string): Promise<ArxivEntry> {
  // Remove 'arXiv:' prefix if present, and handle version numbers
  const id = arxivId.replace(/^arXiv:/i, '').split('v')[0]
  
  const url = new URL(ARXIV_BASE_URL)
  url.searchParams.set('id_list', id)

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'BetterFeed/1.0 (ta2601@nyu.edu)',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Article not found')
      }
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`)
    }

    const xmlText = await response.text()
    const feed = parseArxivXML(xmlText)
    
    if (feed.entries.length === 0) {
      throw new Error('Article not found')
    }

    return feed.entries[0]
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to fetch article from arXiv API')
  }
}

/**
 * Extract the PDF URL from an arXiv entry
 */
export function getPdfUrl(entry: ArxivEntry): string | null {
  // Find PDF link
  const pdfLink = entry.links.find((link) => link.type === 'application/pdf')
  if (pdfLink) {
    return pdfLink.href
  }

  // Fallback: construct PDF URL from arXiv ID
  const arxivId = entry.id.replace(/^http:\/\/arxiv\.org\/abs\//, '').replace(/^https:\/\/arxiv\.org\/abs\//, '')
  if (arxivId) {
    return `https://arxiv.org/pdf/${arxivId}.pdf`
  }

  return null
}

/**
 * Extract the abstract page URL from an arXiv entry
 */
export function getAbstractUrl(entry: ArxivEntry): string {
  // Find alternate link (abstract page)
  const altLink = entry.links.find((link) => link.rel === 'alternate')
  if (altLink) {
    return altLink.href
  }

  // Fallback: construct URL from arXiv ID
  const arxivId = entry.id.replace(/^http:\/\/arxiv\.org\/abs\//, '').replace(/^https:\/\/arxiv\.org\/abs\//, '')
  if (arxivId) {
    return `https://arxiv.org/abs/${arxivId}`
  }

  return entry.id
}

/**
 * Format authors from an arXiv entry
 */
export function formatAuthors(entry: ArxivEntry): string {
  if (entry.authors.length === 0) {
    return 'Unknown authors'
  }

  const authors = entry.authors.slice(0, 3).map((author) => author.name)

  if (entry.authors.length > 3) {
    return `${authors.join(', ')}, et al.`
  }

  return authors.join(', ')
}

/**
 * Extract primary category from an arXiv entry
 */
export function getPrimaryCategory(entry: ArxivEntry): string {
  if (entry.category.length === 0) {
    return 'General'
  }

  // arXiv categories are in format like "cs.AI", "math.CO", "physics.optics"
  // Extract the main category name
  const primary = entry.category[0]
  const parts = primary.split('.')
  
  // Map common arXiv categories to readable names
  const categoryMap: Record<string, string> = {
    'cs': 'Computer Science',
    'math': 'Mathematics',
    'physics': 'Physics',
    'q-bio': 'Quantitative Biology',
    'q-fin': 'Quantitative Finance',
    'stat': 'Statistics',
    'eess': 'Electrical Engineering',
    'econ': 'Economics',
  }

  const mainCategory = parts[0] || primary
  return categoryMap[mainCategory] || mainCategory.toUpperCase()
}

