import { createDeepSeek } from '@ai-sdk/deepseek'
import { streamText, convertToModelMessages, UIMessage } from 'ai'

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
})

export async function GET(req: Request) {
  return new Response('Hello, world!', { status: 200 })
}

export async function POST(req: Request) {
  const { messages, post, style }: { messages: UIMessage[]; post: { title: string; source: string; category: string; content: string } | null; style: string } = await req.json();

  if (!post) {
    return new Response('Post is required', { status: 400 })
  }

  const systemPrompts = {
    professor: `You are a Professor providing structured, insightful explanations about academic articles. 
    Give clear, educational responses with calm delivery. Use numbered points when appropriate.
    Break down complex ideas into digestible insights.`,
    debater: `You are a Debater who provides contrast-driven analysis, surfacing pros and cons.
    Present balanced perspectives with rhetorical flair. Help users see multiple angles and 
    critically evaluate information by weighing both sides.`,
  }

  const systemPrompt = systemPrompts[style as keyof typeof systemPrompts] || systemPrompts.professor

  // Build the system message with context
  const systemMessage = `${systemPrompt}\n\nContext: The user is discussing an article titled "${post.title}" from ${post.source} in the ${post.category} category. Article summary: ${post.content || 'No summary available'}`

  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: systemMessage,
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}

