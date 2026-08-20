"use client";

import { useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import {
  submitProposal,
  createProposalUpload,
} from "@/app/[locale]/submit/actions";

export type ProposalLabels = {
  name: string;
  email: string;
  affiliation: string;
  title: string;
  abstract: string;
  language: string;
  coauthors: string;
  file: string;
  fileHint: string;
  optional: string;
  submit: string;
  submitting: string;
  successHeading: string;
  successBody: string;
  errorRequired: string;
  errorEmail: string;
  errorRate: string;
  errorServer: string;
  errorFileSize: string;
  errorFileType: string;
  uploading: string;
};

/**
 * The public proposal form (SPEC.md §8).
 *
 * No CAPTCHA, on purpose: it degrades the experience for exactly the people
 * the journal wants submitting. A honeypot and a server-side rate limit carry
 * the load instead.
 */
export function ProposalForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: ProposalLabels;
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    affiliation: "",
    title: "",
    abstract: "",
    locale: locale as string,
    coauthorNote: "",
    website: "",
  });

  function messageFor(code: string): string {
    switch (code) {
      case "required": return labels.errorRequired;
      case "email": return labels.errorEmail;
      case "rate": return labels.errorRate;
      case "size": return labels.errorFileSize;
      case "type": return labels.errorFileType;
      default: return labels.errorServer;
    }
  }

  async function attach(file: File) {
    setError(null);
    setUploading(true);

    const ticket = await createProposalUpload(file.name, file.size, file.type);
    if (!ticket.ok) {
      setUploading(false);
      setError(messageFor(ticket.error));
      return;
    }

    // Straight to storage with the signed token. The file never travels
    // through the server: a 20 MB body would not fit through the function.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error: uploadError } = await supabase.storage
      .from("proposals")
      .uploadToSignedUrl(ticket.path, ticket.token, file);

    setUploading(false);

    if (uploadError) {
      setError(labels.errorServer);
      return;
    }

    setFilePath(ticket.path);
    setFileName(file.name);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitProposal({ ...form, filePath });
      if (!result.ok) {
        setError(messageFor(result.error));
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="notice" role="status">
        <h2>{labels.successHeading}</h2>
        <p>{labels.successBody}</p>
      </div>
    );
  }

  return (
    <form className="admin-form proposal-form" onSubmit={onSubmit}>
      <label>
        {labels.name}
        <input type="text" required value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>

      <label>
        {labels.email}
        <input type="email" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>

      <label>
        {labels.affiliation} <span className="optional">{labels.optional}</span>
        <input type="text" value={form.affiliation}
          onChange={(e) => setForm({ ...form, affiliation: e.target.value })} />
      </label>

      <label>
        {labels.title}
        <input type="text" required value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>

      <label>
        {labels.abstract}
        <textarea rows={8} required value={form.abstract}
          onChange={(e) => setForm({ ...form, abstract: e.target.value })} />
      </label>

      <label>
        {labels.language}
        <select value={form.locale}
          onChange={(e) => setForm({ ...form, locale: e.target.value })}>
          {routing.locales.map((l) => (
            <option key={l} value={l}>{localeNames[l]}</option>
          ))}
        </select>
      </label>

      <label>
        {labels.coauthors} <span className="optional">{labels.optional}</span>
        <textarea rows={3} value={form.coauthorNote}
          onChange={(e) => setForm({ ...form, coauthorNote: e.target.value })} />
      </label>

      <label>
        {labels.file} <span className="optional">{labels.optional}</span>
        <input type="file" accept=".pdf,.doc,.docx" disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void attach(file);
          }} />
      </label>
      <p className="article__meta">{labels.fileHint}</p>
      {uploading && <p className="article__meta">{labels.uploading}</p>}
      {fileName && !uploading && (
        <p className="article__meta">{fileName}</p>
      )}

      {/* Honeypot. Hidden from people and from screen readers; bots fill it. */}
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </label>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div>
        <button type="submit" disabled={pending || uploading}>
          {pending ? labels.submitting : labels.submit}
        </button>
      </div>
    </form>
  );
}
