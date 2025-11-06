import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/db/client";
import { withAuth } from "@/lib/auth/middleware";
import { AuthResponse } from "@/lib/auth/types";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { Interaction } from "@/lib/db/schema";

// GET interactions by post ID
async function getInteractionsByPostId(req: NextApiRequest, res: NextApiResponse) {
  try {
    const postId = parseInt(req.query.id as string, 10);

    if (isNaN(postId)) {
      throw new ApiError(400, "Invalid post ID");
    }

    const { data: postInteractions, error } = await supabase
      .from("interactions")
      .select()
      .eq("post_id", postId);

    if (error) {
      throw new ApiError(500, `Error fetching interactions: ${error.message}`);
    }

    if (!postInteractions || postInteractions.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(postInteractions as Interaction[]);
  } catch (error) {
    return handleApiError(error, res);
  }
}

// DELETE interaction by ID (requires authentication)
async function deleteInteraction(
  req: NextApiRequest,
  res: NextApiResponse,
  authResponse: AuthResponse
) {
  try {
    const interactionId = parseInt(req.query.id as string, 10);

    if (isNaN(interactionId)) {
      throw new ApiError(400, "Invalid interaction ID");
    }

    // Check if interaction exists and belongs to user
    const { data: existingInteraction, error: fetchError } = await supabase
      .from("interactions")
      .select()
      .eq("id", interactionId)
      .single();

    if (fetchError || !existingInteraction) {
      throw new ApiError(404, "Interaction not found or unauthorized");
    }

    if (existingInteraction.user_id !== authResponse.user.id) {
      throw new ApiError(403, "Unauthorized: You can only delete your own interactions");
    }

    const { data: deletedInteraction, error: deleteError } = await authResponse.client
      .from("interactions")
      .delete()
      .eq("id", interactionId)
      .select()
      .single();

    if (deleteError || !deletedInteraction) {
      throw new ApiError(500, `Error deleting interaction: ${deleteError?.message || "Unknown error"}`);
    }

    return res.status(200).json([deletedInteraction as Interaction]);
  } catch (error) {
    return handleApiError(error, res);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    return getInteractionsByPostId(req, res);
  } else if (req.method === "DELETE") {
    return withAuth(deleteInteraction)(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
