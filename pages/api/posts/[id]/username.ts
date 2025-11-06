import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/db/client";
import { handleApiError, ApiError } from "@/lib/api/errors";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const postId = parseInt(req.query.id as string, 10);

    if (isNaN(postId)) {
      throw new ApiError(400, "Invalid post ID");
    }

    // Get post with profile username using join
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      throw new ApiError(404, "Post not found");
    }

    // Get profile username
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", post.user_id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profile not found");
    }

    return res.status(200).json(profile.username);
  } catch (error) {
    return handleApiError(error, res);
  }
}
