import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/db/client";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { SignupCredentials } from "@/lib/auth/types";
import { Profile } from "@/lib/db/schema";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const credentials = req.body as SignupCredentials;

    // Validate required fields
    const required = ["email", "password", "username"];
    for (const field of required) {
      if (!credentials[field as keyof SignupCredentials]) {
        throw new ApiError(400, `Missing required "${field}" field`);
      }
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin!.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (authError || !authData.user) {
      throw new ApiError(400, `Error creating user: ${authError?.message || "Unknown error"}`);
    }

    // Create user profile in database
    const profile = {
      id: authData.user.id,
      email: credentials.email,
      username: credentials.username,
    };

    const { data: insertedProfile, error: profileError } = await supabaseAdmin!
      .from("profiles")
      .insert(profile)
      .select()
      .single();

    if (profileError || !insertedProfile) {
      throw new ApiError(400, `Error creating profile: ${profileError?.message || "Unknown error"}`);
    }

    return res.status(200).json({
      auth: authData.user,
      profile: insertedProfile as Profile,
    });
  } catch (error) {
    return handleApiError(error, res);
  }
}

