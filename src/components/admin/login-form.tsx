"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Email and password sign-in.
 *
 * The browser client writes the session cookie that the proxy then refreshes
 * on every admin request.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Deliberately not distinguishing "no such account" from "wrong
      // password": that difference tells an attacker which addresses exist.
      setError("Those credentials were not accepted.");
      setBusy(false);
      return;
    }

    // `next` arrives from the query string, so it is attacker-controlled.
    // Only a path under /admin is accepted -- anything else, including a
    // protocol-relative "//evil.example" that a naive prefix check would
    // wave through, falls back to the admin home. typedRoutes cannot verify
    // a runtime string, hence the cast after validation.
    const safe = /^\/admin(\/[A-Za-z0-9\-_/]*)?$/.test(next) ? next : "/admin";
    router.replace(safe as Parameters<typeof router.replace>[0]);
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <label>
        Email
        <input
          type="email"
          value={email}
          autoComplete="username"
          required
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label>
        Password
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          required
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && <p className="admin-error">{error}</p>}

      <button type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
