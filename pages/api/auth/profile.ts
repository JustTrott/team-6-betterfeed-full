import { NextApiRequest, NextApiResponse } from "next";
import { withAuth } from "@/lib/auth/middleware";
import { AuthResponse } from "@/lib/auth/types";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { Profile } from "@/lib/db/schema";

async function getProfile(
  req: NextApiRequest,
  res: NextApiResponse,
  authResponse: AuthResponse
) {
  try {
    const { data: profile, error } = await authResponse.client
      .from("profiles")
      .select("*")
      .eq("id", authResponse.user.id)
      .single();

    if (error || !profile) {
      throw new ApiError(404, `Profile not found: ${error?.message || "Unknown error"}`);
    }

    return res.status(200).json(profile as Profile);
  } catch (error) {
    return handleApiError(error, res);
  }
}

async function updateProfile(
  req: NextApiRequest,
  res: NextApiResponse,
  authResponse: AuthResponse
) {
  try {
    const updateData = req.body as Partial<Profile>;

    // Only allow updating username and avatar_url
    const allowedFields: (keyof Profile)[] = ['username', 'avatar_url'];
    const updateValues: Partial<Profile> = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateValues[field] = updateData[field];
      }
    }

    if (Object.keys(updateValues).length === 0) {
      throw new ApiError(400, "No valid fields provided for update");
    }

    const { data: updatedProfile, error } = await authResponse.client
      .from("profiles")
      .update(updateValues)
      .eq("id", authResponse.user.id)
      .select()
      .single();

    if (error || !updatedProfile) {
      throw new ApiError(500, `Error updating profile: ${error?.message || "Unknown error"}`);
    }

    return res.status(200).json(updatedProfile as Profile);
  } catch (error) {
    return handleApiError(error, res);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    return withAuth(getProfile)(req, res);
  } else if (req.method === "PUT" || req.method === "PATCH") {
    return withAuth(updateProfile)(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}

