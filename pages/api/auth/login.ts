import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/db/client";
import { handleApiError, ApiError } from "@/lib/api/errors";
import { LoginCredentials, LoginResponse } from "@/lib/auth/types";
import { Profile } from "@/lib/db/schema";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse | { error: string; details?: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const credentials = req.body as LoginCredentials;

    // Validate required fields
    const required = ["email", "password"];
    for (const field of required) {
      if (!credentials[field as keyof LoginCredentials]) {
        throw new ApiError(400, `Missing required "${field}" field`);
      }
    }

    // Authenticate user
    const { data: authData, error: authError } = await supabaseAdmin!.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (authError || !authData.user || !authData.session) {
      throw new ApiError(401, `Invalid email or password: ${authError?.message || "Unknown error"}`);
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseAdmin!
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(500, `Error fetching profile: ${profileError?.message || "Unknown error"}`);
    }

    const response: LoginResponse = {
      user: authData.user,
      profile: profile as Profile,
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_in: authData.session.expires_in || 3600,
        expires_at: authData.session.expires_at,
        token_type: authData.session.token_type,
      },
      access_token: authData.session.access_token,
    };

    return res.status(200).json(response);
  } catch (error) {
    return handleApiError(error, res);
  }
}

