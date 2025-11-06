import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/auth/middleware";
import { AuthResponse } from "@/lib/auth/types";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { CreateInteractionRequest } from "@/types/api";
import { Interaction } from "@/lib/db/schema";

async function createInteraction(
  req: NextApiRequest,
  res: NextApiResponse,
  authResponse: AuthResponse
) {
  try {
    const interactionData = req.body as CreateInteractionRequest;

    // Validate required fields
    if (!interactionData.post_id || !interactionData.interaction_type) {
      throw new ApiError(400, "Missing required fields: post_id and interaction_type");
    }

    // Validate interaction type
    if (!["like", "save"].includes(interactionData.interaction_type)) {
      throw new ApiError(400, "interaction_type must be 'like' or 'save'");
    }

    const newInteraction = {
      user_id: authResponse.user.id,
      post_id: interactionData.post_id,
      interaction_type: interactionData.interaction_type,
    };

    const { data: createdInteraction, error } = await authResponse.client
      .from("interactions")
      .insert(newInteraction)
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation (duplicate interaction)
      if (error.code === "23505" || error.message?.includes("duplicate")) {
        throw new ApiError(400, "Interaction already exists");
      }
      throw new ApiError(500, `Error creating interaction: ${error.message}`);
    }

    if (!createdInteraction) {
      throw new ApiError(500, "Error creating interaction: No data returned");
    }

    return res.status(200).json([createdInteraction as Interaction]);
  } catch (error) {
    return handleApiError(error, res);
  }
}

export default withAuth(createInteraction);
