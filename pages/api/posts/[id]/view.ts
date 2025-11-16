import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/db/client";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { Post } from "@/lib/db/schema";

/**
 * POST /api/posts/[id]/view
 * Increment view count for a post (public endpoint, no auth required)
 * 
 * This endpoint increments the view_count for a post by 1.
 * It's a public endpoint because we want to track views from all users,
 * including those not logged in.
 */
async function incrementView(req: NextApiRequest, res: NextApiResponse) {
  try {
    const postId = parseInt(req.query.id as string, 10);

    if (isNaN(postId)) {
      throw new ApiError(400, "Invalid post ID");
    }

    // Get current post
    const { data: currentPost, error: fetchError } = await supabase
      .from("posts")
      .select("view_count")
      .eq("id", postId)
      .single();

    if (fetchError || !currentPost) {
      throw new ApiError(404, "Post not found");
    }

    // Increment view count
    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update({ view_count: currentPost.view_count + 1 })
      .eq("id", postId)
      .select()
      .single();

    if (updateError || !updatedPost) {
      throw new ApiError(500, `Error incrementing view count: ${updateError?.message || "Unknown error"}`);
    }

    return res.status(200).json(updatedPost as Post);
  } catch (error) {
    return handleApiError(error, res);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    return incrementView(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}