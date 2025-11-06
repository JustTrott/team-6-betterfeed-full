/**
 * TypeScript type definitions for database schema
 * 
 * This file defines TypeScript interfaces matching the database schema.
 * The actual database schema is defined in SQL and managed in Supabase.
 * 
 * Schema reference: Based on sql/schema.sql from the original Python backend
 */

// ============================================
// PROFILES TABLE
// ============================================
export interface Profile {
  id: string; // UUID
  email: string;
  username: string;
  avatar_url: string | null;
  created_at: string; // TIMESTAMPTZ
}

export interface NewProfile {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  created_at?: string;
}

// ============================================
// POSTS TABLE
// ============================================
export interface Post {
  id: number; // BIGINT
  user_id: string; // UUID
  article_url: string;
  title: string;
  content: string | null;
  thumbnail_url: string | null;
  view_count: number;
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
}

export interface NewPost {
  user_id: string;
  article_url: string;
  title: string;
  content?: string | null;
  thumbnail_url?: string | null;
  view_count?: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// INTERACTIONS TABLE
// ============================================
export interface Interaction {
  id: number; // BIGINT
  user_id: string; // UUID
  post_id: number; // BIGINT
  interaction_type: "like" | "save";
  created_at: string; // TIMESTAMPTZ
}

export interface NewInteraction {
  user_id: string;
  post_id: number;
  interaction_type: "like" | "save";
  created_at?: string;
}
