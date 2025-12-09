import { NextApiRequest, NextApiResponse } from "next";
import { supabase, supabaseAdmin } from "@/lib/db/client";
import { ApiError } from "@/lib/api/errors";
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

    // Check if post exists first
    const { data: currentPost, error: fetchError } = await supabase
      .from("posts")
      .select("view_count")
      .eq("id", postId)
      .single();

    if (fetchError || !currentPost) {
      // Post doesn't exist in database - return 404 gracefully
      // This is expected for articles that haven't been persisted yet
      return res.status(404).json({ error: "Post not found in database" });
    }

    // Use admin client to bypass RLS for view_count updates
    // Views should be trackable by anyone, including anonymous users
    const adminClient = supabaseAdmin || supabase;
    
    const { data: updatedPost, error: updateError } = await adminClient
      .from("posts")
      .update({ view_count: currentPost.view_count + 1 })
      .eq("id", postId)
      .select()
      .single();

    if (updateError || !updatedPost) {
      // Silently fail - view tracking is not critical
      console.warn(`Failed to increment view count for post ${postId}:`, updateError?.message);
      return res.status(200).json({ 
        id: postId, 
        view_count: currentPost.view_count,
        message: "View count not updated" 
      });
    }

    return res.status(200).json(updatedPost as Post);
  } catch (error) {
    // Don't throw errors for view tracking - it's not critical
    console.error('View tracking error:', error);
    return res.status(200).json({ 
      error: "View tracking failed", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
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