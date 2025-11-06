-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- POSTS TABLE
-- ============================================
CREATE TABLE posts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    article_url TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    thumbnail_url TEXT,
    view_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for faster queries by user
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_posts_updated_at 
    BEFORE UPDATE ON posts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INTERACTIONS TABLE
-- ============================================
CREATE TABLE interactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'save')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- Ensure a user can only have one type of interaction per post
    UNIQUE(user_id, post_id, interaction_type)
);

-- Indexes for faster queries
CREATE INDEX idx_interactions_user_id ON interactions(user_id);
CREATE INDEX idx_interactions_post_id ON interactions(post_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Anyone can view all profiles (public app)
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Users can insert their own profile (linked to auth.users)
CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================
-- POSTS POLICIES
-- ============================================

-- Anyone can view all posts (public feed)
CREATE POLICY "Posts are viewable by everyone"
    ON posts FOR SELECT
    USING (true);

-- Authenticated users can create posts
CREATE POLICY "Authenticated users can create posts"
    ON posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update their own posts"
    ON posts FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts"
    ON posts FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- INTERACTIONS POLICIES
-- ============================================
-- Note: Interactions are publicly viewable so users can see engagement metrics 
-- (like counts, save counts) on all posts. Users can only create/delete 
-- their own interactions.

-- Anyone can view all interactions (needed for engagement metrics)
CREATE POLICY "Anyone can view all interactions"
    ON interactions FOR SELECT
    USING (true);

-- Users can create their own interactions
CREATE POLICY "Users can create their own interactions"
    ON interactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own interactions
CREATE POLICY "Users can delete their own interactions"
    ON interactions FOR DELETE
    USING (auth.uid() = user_id);