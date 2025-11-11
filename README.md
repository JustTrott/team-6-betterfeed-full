# BetterFeed

BetterFeed is an AI-powered smart feed application for scrolling through condensed academic articles presented in a TikTok-style interface. Users can discover, interact with, and save articles from a curated feed.

## Features

- 📱 **TikTok-style Feed**: Vertical scrolling interface for quick article discovery
- 🤖 **AI Chat Assistant**: Discuss articles with an AI powered by Google Gemini
  - **Professor Mode**: Structured, educational explanations
  - **Debater Mode**: Balanced pros/cons analysis
- 👤 **User Authentication**: Secure signup/login via Supabase
- ❤️ **Interactions**: Like and save articles
- 📂 **Categories**: Filter articles by topic
- 🔍 **Search**: Find articles by title, content, or source
- 📊 **User Profiles**: View reading history and authored posts

## Tech Stack

- **Frontend**: Next.js 16 (Pages Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Custom CSS with BetterFeed design system
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI Integration**: Google Gemini API via AI SDK
- **State Management**: Zustand, TanStack Query
- **UI Components**: Radix UI, Lucide Icons, Motion (animations)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account ([sign up here](https://supabase.com))
- Google Gemini API key ([get one here](https://ai.google.dev))

### Installation

1. **Clone the repository**
```bash
   git clone <repository-url>
   cd betterfeed
```

2. **Install dependencies**
```bash
   npm install
```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
```bash
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   GEMINI_API_KEY=your_gemini_api_key
```

   **Where to find these:**
   - **Supabase keys**: Project Settings → API in your Supabase dashboard
   - **Google Gemini API key**: [Google AI Studio](https://ai.google.dev)

4. **Set up the database**
   
   In your Supabase dashboard, run the SQL schema from `sql/schema.sql` to create the necessary tables.

5. **Run the development server**
```bash
   npm run dev
```

6. **Open the app**
   
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure
```
/
├── components/          # React components
│   ├── ui/             # Base UI components (Radix UI)
│   ├── auth/           # Authentication forms
│   ├── feed/           # Feed-related components
│   ├── profile/        # Profile components
│   └── AIChatPanel.tsx # AI chat interface
├── pages/              # Next.js pages and API routes
│   ├── api/            # Backend API endpoints
│   │   ├── auth/       # Authentication
│   │   ├── ai/         # AI chat (Google Gemini)
│   │   ├── posts/      # Post management
│   │   └── interactions/ # Likes/saves
│   ├── index.tsx       # Home (feed) page
│   ├── login.tsx       # Login page
│   ├── signup.tsx      # Signup page
│   ├── profile.tsx     # User profile
│   └── saved.tsx       # Saved articles
├── lib/                # Utilities and configurations
│   ├── db/             # Database client and schema
│   └── auth/           # Auth middleware
├── styles/             # Global styles
├── types/              # TypeScript type definitions
└── public/             # Static assets
```

## AI Chat Assistant

The AI chat assistant uses Google Gemini to provide intelligent article analysis:

- **Professor Mode**: Get structured, educational explanations with clear breakdowns
- **Debater Mode**: Explore pros and cons with balanced perspectives

The assistant maintains conversation context per article and formats responses using markdown for better readability.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test:api` - Run API tests

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login to existing account

### AI Chat
- `POST /api/ai/chat` - Chat with AI about an article

### Posts
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post (authenticated)
- `GET /api/posts/[id]` - Get post by ID
- `PUT /api/posts/[id]` - Update post (authenticated, owner only)
- `DELETE /api/posts/[id]` - Delete post (authenticated, owner only)

### Interactions
- `POST /api/interactions` - Like or save a post (authenticated)
- `GET /api/interactions/[id]` - Get interactions for a post
- `DELETE /api/interactions/[id]` - Remove interaction (authenticated)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `GEMINI_API_KEY` | Google Gemini API key for AI features | Yes |

## Database Schema

The application uses three main tables:

- **profiles**: User accounts and profile information
- **posts**: Article posts with metadata
- **interactions**: User interactions (likes/saves) with posts

See `lib/db/schema.ts` for TypeScript type definitions or `sql/schema.sql` for the full SQL schema.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Your License Here]

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)