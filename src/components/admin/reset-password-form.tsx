"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Phase = "checking" | "ready" | "invalid" | "done";

/**
 * Sets a new password from a recovery or invitation link.
 *
 * This page is where both flows land, and it has to exist for either to work:
 * an invited editor has no password yet, and a locked-out one has no way back
 * in. There is no public signup here, so without this the only recovery path
 * is an admin with SQL access.
 *
 * Supabase puts the token in the URL *fragment* (`#access_token=…&type=…`),
 * which never reaches the server — so this is necessarily a Client Component.
 * The browser client consumes the fragment on load and turns it into a
 * session; from there `updateUser` is an ordinary authenticated call.
 *
 * An expired or reused link produces `#error=…&error_code=otp_expired`
 * instead, which is why the invalid state is a first-class outcome rather
 * than an error banner.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  // Read the fragment once, during initialisation rather than in an effect:
  // an expired link is knowable before the first paint, and setting state
  // synchronously inside an effect costs a cascading render.
  const [linkError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const raw = hash.get("error_description") ?? hash.get("error");
    return raw ? raw.replace(/\+/g, " ") : null;
  });
  const [phase, setPhase] = useState<Phase>(() =>
    linkError ? "invalid" : "checking",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (linkError) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // The client parses the fragment asynchronously, so a session may not
    // exist on the first tick. Listen as well as poll once.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setPhase("ready");
    });

    void supabase.auth.getSession().then(({ data }) => {
      setPhase((current) =>
        data.session ? "ready" : current === "checking" ? "invalid" : current,
      );
    });

    return () => sub.subscription.unsubscribe();
  }, [linkError]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPhase("done");
    router.refresh();
  }

  if (phase === "checking") {
    return <p className="article__meta">Checking the link…</p>;
  }

  if (phase === "invalid") {
    return (
      <div role="alert">
        <p className="admin-error">
          {linkError ?? "This link is invalid or has already been used."}
        </p>
        <p>
          Recovery links are single-use and expire within the hour. Request a
          new one and open it in the same browser.
        </p>
        <p>
          <Link href="/admin/forgot-password">Send a new link</Link>
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div role="status">
        <h2>Password set</h2>
        <p>You are signed in.</p>
        <p>
          <Link href="/admin">Go to Admin</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="admin-form" onSubmit={onSubmit}>
      <label>
        New password
        <input
          type="password"
          value={password}
          autoComplete="new-password"
          required
          minLength={8}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <label>
        Repeat it
        <input
          type="password"
          value={confirm}
          autoComplete="new-password"
          required
          minLength={8}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
