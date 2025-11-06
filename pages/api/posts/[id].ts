import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/middleware";
import { AuthResponse } from "@/lib/auth/types";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { UpdatePostRequest } from "@/types/api";
import { Post } from "@/lib/db/schema";

// GET post by ID
async function getPost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const postId = parseInt(req.query.id as string, 10);

    if (isNaN(postId)) {
      throw new ApiError(400, "Invalid post ID");
    }

    const { data: post, error } = await supabase
      .from("posts")
      .select()
      .eq("id", postId)
      .single();

    if (error || !post) {
      throw new ApiError(404, "Post not found");
    }

    return res.status(200).json(post as Post);
  } catch (error) {
    return handleApiError(error, res);
  }
}

// PUT update post (requires authentication)
async function updatePost(
  req: NextApiRequest,
  res: NextApiResponse,
  authResponse: AuthResponse
) {
  try {
    const postId = parseInt(req.query.id as string, 10);

    if (isNaN(postId)) {
      throw new ApiError(400, "Invalid post ID");
    }

    // Check if post exists and belongs to user
    const { data: existingPost, error: fetchError } = await supabase
      .from("posts")
      .select()
      .eq("id", postId)
      .single();

    if (fetchError || !existingPost) {
      throw new ApiError(404, "Post not found or unauthorized");
    }

    if (existingPost.user_id !== authResponse.user.id) {
      throw new ApiError(403, "Unauthorized: You can only update your own posts");
    }

    const updateData = req.body as UpdatePostRequest;

    if (!updateData.title && !updateData.content && !updateData.thumbnail_url) {
      throw new ApiError(400, "At least one field must be provided for update");
    }

    const updateValues: Partial<Post> = {};
    if (updateData.title) updateValues.title = updateData.title;
    if (updateData.content !== undefined) updateValues.content = updateData.content;
    if (updateData.thumbnail_url !== undefined) updateValues.thumbnail_url = updateData.thumbnail_url;

    const { data: updatedPost, error: updateError } = await authResponse.client
      .from("posts")
      .update(updateValues)
      .eq("id", postId)
      .select()
      .single();

    if (updateError || !updatedPost) {
      throw new ApiError(500, `Error updating post: ${updateError?.message || "Unknown error"}`);
    }

    return res.status(200).json([updatedPost as Post]);
  } catch (error) {
    return handleApiError(error, res);
  }
}

// DELETE post by ID (requires authentication)
async function deletePost(
  req: NextApiRequest,
  res: NextApiResponse,
  authResponse: AuthResponse
) {
  try {
    const postId = parseInt(req.query.id as string, 10);

    if (isNaN(postId)) {
      throw new ApiError(400, "Invalid post ID");
    }

    // Check if post exists and belongs to user
    const { data: existingPost, error: fetchError } = await supabase
      .from("posts")
      .select()
      .eq("id", postId)
      .single();

    if (fetchError || !existingPost) {
      throw new ApiError(404, "Post not found or unauthorized");
    }

    if (existingPost.user_id !== authResponse.user.id) {
      throw new ApiError(403, "Unauthorized: You can only delete your own posts");
    }

    const { data: deletedPost, error: deleteError } = await authResponse.client
      .from("posts")
      .delete()
      .eq("id", postId)
      .select()
      .single();

    if (deleteError || !deletedPost) {
      throw new ApiError(500, `Error deleting post: ${deleteError?.message || "Unknown error"}`);
    }

    return res.status(200).json([deletedPost as Post]);
  } catch (error) {
    return handleApiError(error, res);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    return getPost(req, res);
  } else if (req.method === "PUT") {
    return withAuth(updatePost)(req, res);
  } else if (req.method === "DELETE") {
    return withAuth(deletePost)(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
