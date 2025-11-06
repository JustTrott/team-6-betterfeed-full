import { Post, Profile, Interaction } from "@/lib/db/schema";

// API Request Types
export interface CreatePostRequest {
  title: string;
  content?: string;
  article_url: string;
  thumbnail_url?: string;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  thumbnail_url?: string;
}

export interface CreateInteractionRequest {
  post_id: number;
  interaction_type: "like" | "save";
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: string;
}

export type PostResponse = Post;
export type PostsResponse = Post[];
export type ProfileResponse = Profile;
export type InteractionResponse = Interaction;
export type InteractionsResponse = Interaction[];

