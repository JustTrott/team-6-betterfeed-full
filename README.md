# BetterFeed

An AI-powered academic article discovery platform combining TikTok-style vertical scrolling with intelligent learning tools to transform mindless scrolling into meaningful academic growth.

## Description

BetterFeed addresses the intention-action gap between wanting to learn and defaulting to entertainment by redirecting scrolling habits toward substantive educational content. The platform leverages arXiv's scientific preprint database to deliver engaging academic articles in a familiar short-form format, enhanced with AI-powered analysis using Google Gemini.

**Key Features**:
- TikTok-style vertical scrolling feed for academic articles
- AI chat assistant with Professor and Debater modes
- arXiv API integration (physics, math, CS, and more)
- User authentication and personalized interactions
- Like and save functionality with engagement tracking
- User profiles with reading history
- Category filtering and search
- Infinite scroll with pagination

## Tech Stack

### Frontend
- **Next.js 16.0.1** - React framework with Pages Router
- **React 19.2.0** - UI library
- **TypeScript 5.x** - Type-safe JavaScript
- **Tailwind CSS 4.x** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Motion** - Animation library
- **TanStack Query 5.90.6** - Data fetching and caching
- **Zustand 5.0.0** - State management

### Backend
- **Next.js API Routes** - RESTful API endpoints (Pages Router)
- **Next.js App Router** - AI SDK route handlers
- **Supabase Client 2.79.0** - Database operations

### Database
- **Supabase (PostgreSQL)** - Managed database with authentication
- **Row Level Security (RLS)** - Database-level security policies

### AI Integration
- **Google Gemini API** - AI chat and article summarization
- **AI SDK** - Vercel AI SDK for streaming responses
- **marked 17.0.0** - Markdown parsing for AI responses

### External APIs
- **arXiv API** - Scientific preprint articles (free, no auth required)

## Setup Instructions

### Prerequisites

- **Node.js 18+** and npm
- **Supabase account** - [Sign up here](https://supabase.com)
- **Google Gemini API key** - [Get one here](https://ai.google.dev)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd betterfeed
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory with the following variables:
   ```env
   # Supabase Configuration (Server-side)
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   
   # AI Configuration (Server-side)
   GEMINI_API_KEY=your_gemini_api_key
   
   # Client-side Environment Variables
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   
   **Where to find these:**
   - **Supabase URL & Keys**: Supabase Dashboard → Project Settings → API
   - **Gemini API Key**: [Google AI Studio](https://ai.google.dev)

4. **Set up the database**
   
   In your Supabase dashboard:
   - Navigate to the SQL Editor
   - Copy the entire contents of `sql/schema.sql`
   - Execute the SQL to create tables, indexes, and security policies

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm run start
```

## Environment Variables

| Variable | Description | Required | Visibility |
|----------|-------------|----------|------------|
| `SUPABASE_URL` | Supabase project URL | Yes | Server |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes | Server |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (admin operations) | Yes | Server |
| `GEMINI_API_KEY` | Google Gemini API key for AI features | Yes | Server |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes | Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes | Client |

**Notes**:
- Client-side variables must be prefixed with `NEXT_PUBLIC_`
- Never commit `.env.local` to version control
- arXiv API requires no authentication

## API Endpoint Documentation

### Authentication Endpoints

#### `POST /api/auth/signup`
Create a new user account

**Request Body:**
```json
{
  "email": "string",
  "password": "string",
  "username": "string"
}
```

**Response:** `200 OK`
```json
{
  "auth": {
    "id": "uuid",
    "email": "string",
    "...": "..."
  },
  "profile": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "avatar_url": "string | null",
    "created_at": "timestamp"
  }
}
```

#### `POST /api/auth/login`
Login to existing account

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "string",
  "user": {
    "id": "uuid",
    "email": "string",
    "...": "..."
  }
}
```

### Posts Endpoints

#### `GET /api/posts`
Get all posts (public, no auth required)

**Response:** `200 OK`
```json
[
  {
    "id": "number",
    "user_id": "uuid",
    "title": "string",
    "content": "string | null",
    "article_url": "string",
    "thumbnail_url": "string | null",
    "view_count": "number",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

#### `POST /api/posts`
Create a new post (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "string",
  "content": "string (optional)",
  "article_url": "string",
  "thumbnail_url": "string (optional)"
}
```

**Response:** `200 OK`
```json
[
  {
    "id": "number",
    "user_id": "uuid",
    "title": "string",
    "content": "string | null",
    "article_url": "string",
    "thumbnail_url": "string | null",
    "view_count": 0,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

#### `GET /api/posts/[id]`
Get a specific post by ID (public)

**Response:** `200 OK`
```json
{
  "id": "number",
  "user_id": "uuid",
  "title": "string",
  "content": "string | null",
  "article_url": "string",
  "thumbnail_url": "string | null",
  "view_count": "number",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

#### `PUT /api/posts/[id]`
Update a post (requires authentication, owner only)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "title": "string (optional)",
  "content": "string (optional)",
  "thumbnail_url": "string (optional)"
}
```

**Response:** `200 OK` - Returns updated post array

#### `DELETE /api/posts/[id]`
Delete a post (requires authentication, owner only)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK` - Returns deleted post array

### Interactions Endpoints

#### `POST /api/interactions`
Create an interaction (like or save) on a post (requires authentication)

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "post_id": "number",
  "interaction_type": "like" | "save"
}
```

**Response:** `200 OK`
```json
[
  {
    "id": "number",
    "user_id": "uuid",
    "post_id": "number",
    "interaction_type": "like" | "save",
    "created_at": "timestamp"
  }
]
```

#### `GET /api/interactions/[id]`
Get all interactions for a specific post (public)

**URL Parameter:** `id` = post ID

**Response:** `200 OK`
```json
[
  {
    "id": "number",
    "user_id": "uuid",
    "post_id": "number",
    "interaction_type": "like" | "save",
    "created_at": "timestamp"
  }
]
```

#### `DELETE /api/interactions/[id]`
Delete an interaction (requires authentication, owner only)

**URL Parameter:** `id` = interaction ID

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK` - Returns deleted interaction array

### AI Chat Endpoint

#### `POST /api/ai/chat`
Chat with AI about an article using Google Gemini

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user" | "assistant",
      "content": "string"
    }
  ],
  "post": {
    "title": "string",
    "source": "string",
    "category": "string",
    "content": "string"
  },
  "style": "professor" | "debater"
}
```

**Response:** Server-Sent Events (SSE) stream with markdown-formatted AI responses

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `405` - Method Not Allowed
- `500` - Internal Server Error

## Database Schema

### Tables Overview

The application uses **3 main tables** in PostgreSQL (via Supabase):

1. **profiles** - User accounts and profile information
2. **posts** - Article posts with metadata
3. **interactions** - User interactions (likes/saves) with posts

### Detailed Schema

#### `profiles` Table

Stores user account information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier (linked to Supabase Auth) |
| `email` | TEXT | UNIQUE, NOT NULL | User email address |
| `username` | TEXT | UNIQUE, NOT NULL | Display username |
| `avatar_url` | TEXT | NULLABLE | URL to user's avatar image |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Account creation timestamp |

**Indexes:**
- Primary key on `id`
- Unique constraint on `email`
- Unique constraint on `username`

**Security:**
- Row Level Security (RLS) enabled
- Public read access (profiles viewable by all)
- Users can only insert/update their own profile

---

#### `posts` Table

Stores article posts shared on the platform.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGINT | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Unique post identifier |
| `user_id` | UUID | FOREIGN KEY → profiles(id), ON DELETE CASCADE, NOT NULL | Post author |
| `article_url` | TEXT | NOT NULL | URL to the original article |
| `title` | TEXT | NOT NULL | Article title |
| `content` | TEXT | NULLABLE | Article summary/content |
| `thumbnail_url` | TEXT | NULLABLE | URL to article thumbnail image |
| `view_count` | INTEGER | DEFAULT 0, NOT NULL | Number of views |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Post creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Last update timestamp (auto-updated via trigger) |

**Indexes:**
- Primary key on `id`
- Index on `user_id` for faster user post queries
- Index on `created_at DESC` for chronological ordering

**Triggers:**
- `update_posts_updated_at` - Automatically updates `updated_at` on row modification

**Security:**
- Row Level Security (RLS) enabled
- Public read access (posts viewable by all)
- Authenticated users can create posts
- Users can only update/delete their own posts

---

#### `interactions` Table

Stores user interactions (likes and saves) with posts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGINT | PRIMARY KEY, GENERATED ALWAYS AS IDENTITY | Unique interaction identifier |
| `user_id` | UUID | FOREIGN KEY → profiles(id), ON DELETE CASCADE, NOT NULL | User who interacted |
| `post_id` | BIGINT | FOREIGN KEY → posts(id), ON DELETE CASCADE, NOT NULL | Post that was interacted with |
| `interaction_type` | TEXT | CHECK (interaction_type IN ('like', 'save')), NOT NULL | Type of interaction |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Interaction timestamp |

**Constraints:**
- `UNIQUE(user_id, post_id, interaction_type)` - Prevents duplicate interactions

**Indexes:**
- Primary key on `id`
- Index on `user_id` for faster user interaction queries
- Index on `post_id` for faster post interaction queries

**Security:**
- Row Level Security (RLS) enabled
- Public read access (interaction counts viewable by all)
- Users can only create/delete their own interactions

---

### Relationships

```
profiles (1) ──────────── (∞) posts
    │                          │
    │                          │
    └──────────── (∞) interactions (∞) ───┘
```

- One user can create many posts (`profiles.id` → `posts.user_id`)
- One user can have many interactions (`profiles.id` → `interactions.user_id`)
- One post can have many interactions (`posts.id` → `interactions.post_id`)

### Database Features

- **Row Level Security (RLS)**: All tables have RLS policies for secure data access
- **Cascade Deletes**: Deleting a user or post automatically removes associated records
- **Automatic Timestamps**: `updated_at` field auto-updates via database triggers
- **Unique Constraints**: Prevent duplicate usernames, emails, and interactions
- **Check Constraints**: Ensure `interaction_type` is only 'like' or 'save'

### Type Definitions

TypeScript interfaces matching the database schema are defined in `lib/db/schema.ts`:
- `Profile`, `NewProfile`
- `Post`, `NewPost`
- `Interaction`, `NewInteraction`

For complete SQL schema, see `sql/schema.sql`.

## Team Contributions

**Temirlan:** Created the monorepo from the two existing repos for the fronend and backend and migrated from fastapi to nextjs api routes. Connected both the fronend and back including the auth. Also added smooth streaming to AI chat and improved the UI of the AI chat.

**Robbie:** Added in the AI functionality to the chat panel. Fixed the bug with the searchbar causing the website to crash. Fixed the bug where the Latex text in the AI chat panel would not render correctly. Fixed the bug where the AI chat panel would not render correctly on mobile. Added in functionality for the view component of the feed.

**Veyd:**

**Kyle:**

## Project Structure

```
/
├── .cursorrules              # Cursor AI development rules
├── .gitignore                # Git ignore patterns
├── .npmrc                    # NPM configuration
├── llms.txt                  # Project metadata for LLMs
├── next.config.ts            # Next.js configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies and scripts
├── README.md                 # This file
│
├── app/                      # Next.js App Router (AI SDK routes)
│   └── api/
│       ├── chat/             # AI chat endpoint
│       └── articles/fetch/   # Article fetching endpoint
│
├── pages/                    # Next.js Pages Router
│   ├── api/                  # API routes
│   │   ├── auth/             # Authentication endpoints
│   │   ├── posts/            # Posts CRUD endpoints
│   │   └── interactions/     # Interactions endpoints
│   ├── index.tsx             # Home (feed) page
│   ├── login.tsx             # Login page
│   ├── signup.tsx            # Signup page
│   ├── profile.tsx           # User profile page
│   ├── saved.tsx             # Saved articles page
│   └── post/[id].tsx         # Individual post page
│
├── components/               # React components
│   ├── ui/                   # Base UI components (Radix UI)
│   ├── ai-elements/          # AI SDK Elements components
│   ├── auth/                 # Authentication forms
│   ├── feed/                 # Feed-related components
│   ├── profile/              # Profile components
│   ├── AIChatPanel.tsx       # AI chat interface
│   ├── AppHeader.tsx         # Application header
│   ├── CategoryTabs.tsx      # Category filter
│   ├── RouteGuard.tsx        # Protected route wrapper
│   └── StyleSelector.tsx     # AI mode selector
│
├── lib/                      # Shared utilities
│   ├── db/                   # Database
│   │   ├── client.ts         # Supabase client
│   │   └── schema.ts         # TypeScript types
│   ├── auth/                 # Authentication
│   │   ├── middleware.ts     # JWT auth middleware
│   │   └── types.ts          # Auth types
│   ├── api/                  # API utilities
│   │   └── errors.ts         # Error handling
│   ├── services/             # External services
│   │   ├── arxiv.ts          # arXiv API client
│   │   └── summarize.ts      # AI summarization
│   ├── readingHistory.ts     # Reading history utils
│   ├── storage.ts            # LocalStorage utils
│   └── utils.ts              # General utilities
│
├── hooks/                    # Custom React hooks
│   └── useFeed.ts            # Feed data fetching
│
├── store/                    # State management
│   └── auth.ts               # Auth store (Zustand)
│
├── context/                  # React context providers
│   └── toast.tsx             # Toast notifications
│
├── types/                    # TypeScript types
│   ├── api.ts                # API types
│   ├── database.ts           # Database types
│   └── auth.ts               # Auth types
│
├── sql/                      # SQL schema files
│   └── schema.sql            # Complete database schema
│
├── scripts/                  # Utility scripts
│   └── test-api.js           # API testing script
│
├── styles/                   # Global styles
│   └── globals.css           # Custom CSS
│
└── public/                   # Static assets
    ├── avatars/              # Avatar images
    └── sparkle.svg           # Icon assets
```