import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { AuthResponse } from "./types";
import { supabaseAdmin } from "../db/client";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

/**
 * Authentication middleware for API routes
 * Verifies JWT token from Authorization header and returns user info
 */
export async function auth(
  req: NextApiRequest
): Promise<AuthResponse> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Verify token and get user
    const { data: { user }, error: userError } = await supabaseAdmin!.auth.getUser(token);

    if (userError || !user) {
      throw new Error(`Invalid or expired token: ${userError?.message || "User not found"}`);
    }

    // Create a user-specific client with the token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    return { user, client: userClient };
  } catch (error) {
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Wrapper for API routes that require authentication
 */
export function withAuth(
  handler: (
    req: NextApiRequest,
    res: NextApiResponse,
    authResponse: AuthResponse
  ) => Promise<void>
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const authResponse = await auth(req);
      return handler(req, res, authResponse);
    } catch (error) {
      return res.status(401).json({
        error: error instanceof Error ? error.message : "Authentication failed",
      });
    }
  };
}

