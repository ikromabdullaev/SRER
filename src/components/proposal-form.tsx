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
  fileChoose: string;
  fileDrop: string;
  fileRemove: string;
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
 *
 * Every field is a ruled row, which is the same device the archive listings
 * use — a proposal is a record being written. The one control that is not a
 * line of text, the attachment, is the one control that is a field, and it
 * draws its own three states rather than shipping the operating system's file
 * button in the middle of the page.
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
  const [fileError, setFileError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState("");
  const [attached, setAttached] = useState<{
    name: string;
    size: number;
  } | null>(null);

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

  const bytes = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  function fileSize(size: number): string {
    return size >= 1024 * 1024
      ? `${bytes.format(size / 1024 / 1024)} MB`
      : `${bytes.format(Math.max(1, Math.round(size / 1024)))} KB`;
  }

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
    setFileError(null);
    setUploading(true);

    const ticket = await createProposalUpload(file.name, file.size, file.type);
    if (!ticket.ok) {
      setUploading(false);
      setFileError(messageFor(ticket.error));
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
      setFileError(labels.errorServer);
      return;
    }

    setFilePath(ticket.path);
    setAttached({ name: file.name, size: file.size });
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

  // The acknowledgement replaces the form rather than appearing beneath it.
  // Leaving a filled-in form on screen after it has been sent invites the
  // reader to send it again.
  if (done) {
    return (
      <div className="form-done" role="status">
        <h2>{labels.successHeading}</h2>
        <p>{labels.successBody}</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="form__field">
        <label className="form__label" htmlFor="p-name">
          {labels.name}
        </label>
        <input
          id="p-name"
          type="text"
          required
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="p-email">
          {labels.email}
        </label>
        <input
          id="p-email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="p-affiliation">
          {labels.affiliation}{" "}
          <span className="optional">{labels.optional}</span>
        </label>
        <input
          id="p-affiliation"
          type="text"
          autoComplete="organization"
          value={form.affiliation}
          onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
        />
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="p-title">
          {labels.title}
        </label>
        <input
          id="p-title"
          type="text"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="p-abstract">
          {labels.abstract}
        </label>
        <textarea
          id="p-abstract"
          rows={9}
          required
          value={form.abstract}
          onChange={(e) => setForm({ ...form, abstract: e.target.value })}
        />
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="p-language">
          {labels.language}
        </label>
        <select
          id="p-language"
          value={form.locale}
          onChange={(e) => setForm({ ...form, locale: e.target.value })}
        >
          {routing.locales.map((l) => (
            <option key={l} value={l}>{localeNames[l]}</option>
          ))}
        </select>
      </div>

      <div className="form__field">
        <label className="form__label" htmlFor="p-coauthors">
          {labels.coauthors}{" "}
          <span className="optional">{labels.optional}</span>
        </label>
        <textarea
          id="p-coauthors"
          rows={3}
          value={form.coauthorNote}
          onChange={(e) => setForm({ ...form, coauthorNote: e.target.value })}
        />
      </div>

      <div className="form__field form__field--wide">
        <span className="form__label">
          {labels.file} <span className="optional">{labels.optional}</span>
        </span>

        {uploading ? (
          <div className="file-field file-field--busy" aria-live="polite">
            <span className="file-field__action">{labels.uploading}</span>
            <span className="file-field__bar" />
          </div>
        ) : attached ? (
          <div className="file-field file-field--attached" aria-live="polite">
            <span className="file-field__name">
              {attached.name}
              <span className="file-field__size">
                {fileSize(attached.size)}
              </span>
            </span>
            <button
              type="button"
              className="file-field__remove"
              onClick={() => {
                setAttached(null);
                setFilePath("");
                setFileError(null);
              }}
            >
              {labels.fileRemove}
            </button>
          </div>
        ) : (
          // The native input covers the whole field at zero opacity, so the
          // drop target is real: dragging a file anywhere onto this block
          // works, and so does the keyboard.
          <label className="file-field">
            {/* The field's own name. The visible text names the action, which
                is what a sighted reader needs; a screen reader needs both. */}
            <span className="visually-hidden">{labels.file}</span>
            <span className="file-field__action">
              <em>{labels.fileChoose}</em> {labels.fileDrop}
            </span>
            <span className="file-field__hint">{labels.fileHint}</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void attach(file);
              }}
            />
          </label>
        )}

        {fileError && (
          <p className="form-error" role="alert">
            {fileError}
          </p>
        )}
      </div>

      {/* Honeypot. Hidden from people and from screen readers; bots fill it. */}
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </label>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form__actions">
        <button type="submit" disabled={pending || uploading}>
          {pending ? labels.submitting : labels.submit}
        </button>
      </div>
    </form>
  );
}
