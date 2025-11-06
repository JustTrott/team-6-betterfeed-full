import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/middleware";
import { AuthResponse } from "@/lib/auth/types";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { CreatePostRequest } from "@/types/api";
import { Post } from "@/lib/db/schema";

// GET all posts
async function getPosts(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { data: allPosts, error } = await supabase
      .from("posts")
      .select();

    if (error) {
      throw new ApiError(500, `Error fetching posts: ${error.message}`);
    }

    return res.status(200).json(allPosts || []);
  } catch (error) {
    return handleApiError(error, res);
  }
}

// POST create new post (requires authentication)
async function createPost(
  req: NextApiRequest,
  res: NextApiResponse,
  authResponse: AuthResponse
) {
  try {
    const postData = req.body as CreatePostRequest;

    // Validate required fields
    const required = ["title", "content", "article_url"];
    for (const field of required) {
      if (!postData[field as keyof CreatePostRequest]) {
        throw new ApiError(400, `Missing required "${field}" field`);
      }
    }

    const newPost = {
      user_id: authResponse.user.id,
      article_url: postData.article_url,
      title: postData.title,
      content: postData.content,
      thumbnail_url: postData.thumbnail_url,
    };

    const { data: createdPost, error } = await authResponse.client
      .from("posts")
      .insert(newPost)
      .select()
      .single();

    if (error || !createdPost) {
      throw new ApiError(500, `Error creating post: ${error?.message || "Unknown error"}`);
    }

    return res.status(200).json([createdPost as Post]);
  } catch (error) {
    return handleApiError(error, res);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    return getPosts(req, res);
  } else if (req.method === "POST") {
    return withAuth(createPost)(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}

