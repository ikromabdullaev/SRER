import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Supabase client carrying the signed-in editor's session.
 *
 * Distinct from `createPublicClient`, and the distinction matters: that one is
 * always anonymous so public pages can only ever see what the public sees.
 * This one acts as the logged-in user, so RLS grants them exactly what their
 * policies allow and nothing more. Neither uses the service-role key.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(items) {
          try {
            for (const { name, value, options } of items) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

export type StaffProfile = {
  id: string;
  fullName: string;
  handle: string | null;
  role: "admin" | "editor";
};

/**
 * The signed-in editor, or null.
 *
 * Uses `getUser()`, never `getSession()`. getSession reads the cookie and
 * trusts it; getUser verifies the token with the auth server. For an
 * authorisation decision the difference is the whole point — a forged cookie
 * satisfies the first and fails the second.
 */
export async function getStaffProfile(): Promise<StaffProfile | null> {
  const supabase = await createAuthClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, handle, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name,
    handle: data.handle,
    role: data.role,
  };
}

/** True when the profile may manage other accounts (SPEC.md §7.4). */
export function isAdmin(profile: StaffProfile | null): boolean {
  return profile?.role === "admin";
}
