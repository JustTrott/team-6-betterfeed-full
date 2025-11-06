const now = new Date('2025-10-30T12:00:00Z')

const makeDate = (offsetHours: number) =>
  new Date(now.getTime() - offsetHours * 60 * 60 * 1000).toISOString()

export const defaultDatabase = {
  profiles: [
    {
      id: 'uuid-1111',
      email: 'testuser@gmail.com',
      username: 'testuser',
      avatar_url: '/avatars/default.svg',
      created_at: '2025-10-01T10:00:00Z',
    },
    {
      id: 'uuid-2222',
      email: 'sciencebuff@example.com',
      username: 'ScienceBuff',
      avatar_url: '/avatars/default.svg',
      created_at: '2025-10-12T08:30:00Z',
    },
  ],
  posts: Array.from({ length: 28 }).map((_, index) => {
    const baseId = index + 1
    const categories = [
      'General',
      'Category 1',
      'Category 2',
      'Category 3',
      'Category 4',
      'Category 5',
      'Category 6',
      'Category 7',
      'Category 8',
      'Category 9',
      'Category 10',
    ]
    const category = categories[index % categories.length]
    const titles = [
      'Quantum Batteries Promise Ultra-Fast Charging',
      'Urban Farms Boost Food Resilience',
      'AI Tutors Close Learning Gaps in Rural Schools',
      'New Coral Nurseries Revive Reefs',
      'Fusion Startups Hit New Milestones',
      'Circular Fashion Reduces Waste by 40%',
    ]
    const summarySnippets = [
      'Researchers condense quantum storage advances into practical energy cells.',
      'Municipal rooftops are turning into high-yield hydroponic farms.',
      'Adaptive AI mentors tailor lessons based on micro-assessment signals.',
      'Marine biologists engineer biodegradable reef scaffolds for faster regrowth.',
      'Private labs demonstrate sustained plasma reactions exceeding two minutes.',
      'Closed-loop textile supply chains show precipitous drops in landfill loads.',
    ]
    const thumbnails = [
      'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1470163395405-d2b80e7450ed?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=800&q=80',
    ]

    return {
      id: baseId,
      user_id: baseId % 2 === 0 ? 'uuid-2222' : 'uuid-1111',
      article_url: `https://news.example.com/article-${baseId}`,
      title: titles[index % titles.length],
      content: `${summarySnippets[index % summarySnippets.length]} This short, punchy digest keeps readers informed in under 60 seconds while flagging why the story matters now.`,
      thumbnail_url: thumbnails[index % thumbnails.length],
      view_count: 900 + baseId * 37,
      created_at: makeDate(baseId * 6),
      updated_at: makeDate(baseId * 6),
      category,
      source: ['MockNews', 'AcademicWire', 'FutureDaily'][index % 3],
      like_count: 40 + (baseId % 7) * 8,
      save_count: 20 + (baseId % 5) * 5,
    }
  }),
  interactions: [
    {
      id: 10,
      user_id: 'uuid-1111',
      post_id: 1,
      interaction_type: 'like',
      created_at: '2025-10-29T11:00:00Z',
    },
    {
      id: 11,
      user_id: 'uuid-1111',
      post_id: 3,
      interaction_type: 'save',
      created_at: '2025-10-28T09:00:00Z',
    },
    {
      id: 12,
      user_id: 'uuid-2222',
      post_id: 2,
      interaction_type: 'like',
      created_at: '2025-10-27T15:00:00Z',
    },
  ],
  chat_styles: [
    {
      id: 'professor',
      label: 'Professor',
      description: 'Clear, structured explanations with citations.',
    },
    {
      id: 'debater',
      label: 'Debater',
      description: 'Point–counterpoint breakdown with rhetorical flair.',
    },
    {
      id: 'skeptic',
      label: 'Skeptic',
      description: 'Challenges assumptions and stress-tests claims.',
    },
  ],
  categories: [
    'General',
    'Category 1',
    'Category 2',
    'Category 3',
    'Category 4',
    'Category 5',
    'Category 6',
    'Category 7',
    'Category 8',
    'Category 9',
    'Category 10',
  ],
}

