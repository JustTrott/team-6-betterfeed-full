import { User } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";
import { Profile } from "../db/schema";

export interface AuthResponse {
  user: User;
  client: SupabaseClient;
}

export interface SignupCredentials {
  email: string;
  password: string;
  username: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  profile: Profile;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    token_type: string;
  };
  access_token: string;
}

