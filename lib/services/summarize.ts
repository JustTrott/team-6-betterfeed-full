/**
 * AI Summary Generation Service
 * 
 * Uses DeepSeek AI to generate concise summaries of scientific articles
 * from abstracts or full text content.
 */

import { createDeepSeek } from '@ai-sdk/deepseek'
import { generateText } from 'ai'

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
})

/**
 * Generate a summary of a scientific article
 * @param title - Article title
 * @param abstract - Article abstract (preferred)
 * @param fullText - Full text content (if available)
 * @returns Generated summary (150-200 words)
 */
export async function generateArticleSummary(
  title: string,
  abstract?: string | null,
  fullText?: string | null
): Promise<string> {
  // Prefer abstract if available, otherwise use full text
  const content = abstract || fullText

  if (!content) {
    return `This article titled "${title}" discusses important research findings. Read the full article for detailed information.`
  }

  // Limit content length to avoid token limits (keep first 5000 characters)
  const contentToSummarize = content.length > 5000 ? content.substring(0, 5000) + '...' : content

  const systemPrompt = `You are an expert at summarizing scientific articles. Generate a concise, informative summary that:
- Is 150-200 words long
- Captures the main research question, methodology, and key findings
- Uses clear, accessible language
- Highlights why the research matters
- Avoids technical jargon when possible

Return only the summary text, without any introductory phrases or meta-commentary.`

  try {
    const result = await generateText({
      model: deepseek('deepseek-chat'),
      system: systemPrompt,
      prompt: `Article Title: ${title}\n\nContent to summarize:\n${contentToSummarize}\n\nGenerate a concise summary:`,
      maxOutputTokens: 500,
      temperature: 0.7,
    })

    return result.text.trim()
  } catch (error) {
    console.error('Error generating summary:', error)
    
    // Fallback: return a basic summary based on abstract or first part of content
    if (abstract) {
      const truncated = abstract.length > 300 ? abstract.substring(0, 300) + '...' : abstract
      return truncated
    }
    
    if (fullText) {
      const truncated = fullText.length > 300 ? fullText.substring(0, 300) + '...' : fullText
      return truncated
    }

    return `This article titled "${title}" discusses important research findings. Read the full article for detailed information.`
  }
}

/**
 * Generate a summary from abstract only (faster, for when full text is unavailable)
 */
export async function generateSummaryFromAbstract(
  title: string,
  abstract: string
): Promise<string> {
  return generateArticleSummary(title, abstract, null)
}

