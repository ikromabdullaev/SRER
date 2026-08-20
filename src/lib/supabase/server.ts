import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Read-only Supabase client for Server Components.
 *
 * Uses the anon key deliberately, even on the server. Public pages must only
 * ever see what the public can see, and RLS is the thing enforcing that
 * (SCHEMA.md → Row Level Security). Reaching for the service-role key here
 * would silently disable the one control standing between a draft article and
 * the open web.
 *
 * The service-role key belongs in exactly two places, both arriving later: the
 * admin mutations (step 6) and the proposal handler (step 7).
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
        "For local development run `npx supabase start` and copy the values " +
        "into .env.local (see .env.example).",
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type PublicClient = ReturnType<typeof createPublicClient>;
