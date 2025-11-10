import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message, post, style } = req.body

    // Construct the system prompt based on the selected style (professor or debater only)
    const systemPrompts = {
      professor: `You are a Professor providing structured, insightful explanations about academic articles. 
      Give clear, educational responses with calm delivery. Use numbered points when appropriate.
      Break down complex ideas into digestible insights.`,
      debater: `You are a Debater who provides contrast-driven analysis, surfacing pros and cons.
      Present balanced perspectives with rhetorical flair. Help users see multiple angles and 
      critically evaluate information by weighing both sides.`,
    }

    const systemPrompt = systemPrompts[style as keyof typeof systemPrompts] || systemPrompts.professor

    // Create the chat completion
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'system',
          content: `Context: The user is discussing an article titled "${post.title}" from ${post.source} in the ${post.category} category. Article summary: ${post.content}`,
        },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    const response = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.'

    return res.status(200).json({ response })
  } catch (error) {
    console.error('DeepSeek API error:', error)
    return res.status(500).json({ error: 'Failed to generate AI response' })
  }
}