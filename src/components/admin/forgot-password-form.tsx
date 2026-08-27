"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Requests a password recovery email.
 *
 * `redirectTo` is built from the browser's own origin rather than a
 * configured constant, so this works on localhost, on a preview deployment
 * and on the real domain without anything to keep in sync. Supabase still
 * refuses any origin that is not in the project's Redirect URLs allow-list,
 * which is the check that matters.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error: sendError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/admin/reset-password` },
    );

    setBusy(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }

    // Deliberately not distinguishing "sent" from "no such account": that
    // difference tells anyone with the form which addresses are editors here.
    setSent(true);
  }

  if (sent) {
    return (
      <div role="status">
        <h2>Check your email</h2>
        <p>
          If an account exists for that address, a link to set a new password
          is on its way. The link is single-use and expires within the hour.
        </p>
        <p>
          <Link href="/admin/login">Back to sign in</Link>
        </p>
      </div>
    );
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

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </button>

      <p className="article__meta">
        <Link href="/admin/login">Back to sign in</Link>
      </p>
    </form>
  );
}
