import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, convertToModelMessages, UIMessage } from 'ai'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

export async function GET() {
  return new Response('Hello, world!', { status: 200 })
}

export async function POST(req: Request) {
  const { messages, post, style, enableSearch }: { 
    messages: UIMessage[]; 
    post: { title: string; source: string; category: string; content: string } | null; 
    style: string;
    enableSearch?: boolean;
  } = await req.json();

  if (!post) {
    return new Response('Post is required', { status: 400 })
  }

  const systemPrompts = {
    professor: `You are a Professor providing structured, insightful explanations about academic articles. 
    Give clear, educational responses with calm delivery. Use numbered points when appropriate.
    Break down complex ideas into digestible insights.
    ${enableSearch ? 'You have access to web search tools. Use them when you need current information, recent developments, or facts that go beyond the article summary.' : ''}`,
    debater: `You are a Debater who provides contrast-driven analysis, surfacing pros and cons.
    Present balanced perspectives with rhetorical flair. Help users see multiple angles and 
    critically evaluate information by weighing both sides.
    ${enableSearch ? 'You have access to web search tools. Use them to find contrasting viewpoints, recent developments, or additional context to strengthen your analysis.' : ''}`,
  }

  const systemPrompt = systemPrompts[style as keyof typeof systemPrompts] || systemPrompts.professor

  // Build the system message with context
  const systemMessage = `${systemPrompt}\n\nContext: The user is discussing an article titled "${post.title}" from ${post.source} in the ${post.category} category. Article summary: ${post.content || 'No summary available'}`

  const result = streamText({
    model: google('gemini-2.5-flash-lite'),
    system: systemMessage,
    messages: convertToModelMessages(messages),
    // Enable Google Search tool if enabled
    ...(enableSearch && {
      tools: {
        google_search: google.tools.googleSearch({}),
      },
    }),
  });

  return result.toUIMessageStreamResponse();
}

