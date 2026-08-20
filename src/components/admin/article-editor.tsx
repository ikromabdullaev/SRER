"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import {
  saveArticle,
  type ArticleAuthorInput,
  type ArticleTranslationInput,
  type SaveArticleInput,
} from "@/app/admin/articles/actions";
import { AuthorPicker } from "./author-picker";
import type { Database } from "@/lib/supabase/database.types";

type ArticleType = Database["public"]["Enums"]["article_type"];

const TYPES: ArticleType[] = [
  "research_article", "review_article", "case_study", "policy_note",
  "book_review", "editorial", "correction", "retraction",
];

export type IssueOption = { id: string; label: string };

export type ArticleEditorData = Omit<SaveArticleInput, "publish"> & {
  state?: string;
};

function emptyTranslations(): ArticleTranslationInput[] {
  return routing.locales.map((locale) => ({
    locale,
    title: "",
    abstract: "",
    keywords: "",
  }));
}

/**
 * The article publishing form — the surface the partner's editors live in
 * (SPEC.md §7.1).
 *
 * Two rules it exists to make hard to break:
 *  - publishing succeeds with a single locale filled;
 *  - the primary language's title is required, because that is what
 *    `citation_title` carries and Scholar indexes.
 */
export function ArticleEditor({
  initial,
  issues,
}: {
  initial?: ArticleEditorData;
  issues: IssueOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<Locale>(routing.defaultLocale);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState(() => ({
    slug: initial?.slug ?? "",
    primaryLanguage: initial?.primaryLanguage ?? routing.defaultLocale,
    type: initial?.type ?? ("research_article" as ArticleType),
    issueId: initial?.issueId ?? "",
    position: initial?.position ?? "",
    firstPage: initial?.firstPage ?? "",
    lastPage: initial?.lastPage ?? "",
    jelCodes: initial?.jelCodes ?? "",
    pdfUrl: initial?.pdfUrl ?? "",
    pdfSizeBytes: initial?.pdfSizeBytes ?? "",
    receivedAt: initial?.receivedAt ?? "",
    acceptedAt: initial?.acceptedAt ?? "",
  }));

  const [translations, setTranslations] = useState<ArticleTranslationInput[]>(
    () => {
      const base = emptyTranslations();
      for (const t of initial?.translations ?? []) {
        const slot = base.find((b) => b.locale === t.locale);
        if (slot) Object.assign(slot, t);
      }
      return base;
    },
  );

  const [authors, setAuthors] = useState<ArticleAuthorInput[]>(
    initial?.authors ?? [],
  );

  const current = translations.find((t) => t.locale === active)!;
  const isPublished = initial?.state === "published";

  function updateTranslation(patch: Partial<ArticleTranslationInput>) {
    setTranslations((prev) =>
      prev.map((t) => (t.locale === active ? { ...t, ...patch } : t)),
    );
  }

  async function uploadPdf(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("The article of record is a PDF.");
      return;
    }
    setUploading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Path convention from SCHEMA.md. Online-first PDFs live under
    // online-first/ and are NOT moved when an issue is later assigned:
    // citation_pdf_url must never change.
    const issue = issues.find((i) => i.id === form.issueId);
    const folder = issue ? issue.label.replace(/[^\w.-]+/g, "-") : "online-first";
    const path = `${folder}/${form.slug || crypto.randomUUID()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("articles")
      .upload(path, file, { contentType: "application/pdf", upsert: false });

    setUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("articles").getPublicUrl(path);

    setForm((f) => ({
      ...f,
      pdfUrl: publicUrl,
      pdfSizeBytes: String(file.size),
    }));
  }

  function submit(publish: boolean) {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await saveArticle({
        ...form,
        id: initial?.id,
        publish,
        translations,
        authors,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(publish ? "Published." : "Saved as draft.");
      if (!initial?.id) router.replace(`/admin/articles/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="article-editor">
      <section className="admin-form">
        <label>
          Slug
          <input
            type="text"
            value={form.slug}
            disabled={isPublished}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
        </label>
        {isPublished && (
          <p className="article__meta">
            Locked: the URL of a published article is permanent.
          </p>
        )}

        <label>
          Primary language — the language of the PDF, and the one
          <code> citation_*</code> tags are emitted in
          <select
            value={form.primaryLanguage}
            onChange={(e) =>
              setForm({ ...form, primaryLanguage: e.target.value as Locale })
            }
          >
            {routing.locales.map((l) => (
              <option key={l} value={l}>{localeNames[l]}</option>
            ))}
          </select>
        </label>

        <label>
          Type
          <select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as ArticleType })
            }
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>

        <label>
          Issue
          <select
            value={form.issueId}
            onChange={(e) => setForm({ ...form, issueId: e.target.value })}
          >
            <option value="">Online first — no issue yet</option>
            {issues.map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label>
            Position in issue
            <input type="number" value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </label>
          <label>
            First page
            <input type="number" value={form.firstPage}
              onChange={(e) => setForm({ ...form, firstPage: e.target.value })} />
          </label>
          <label>
            Last page
            <input type="number" value={form.lastPage}
              onChange={(e) => setForm({ ...form, lastPage: e.target.value })} />
          </label>
        </div>

        <div className="field-row">
          <label>
            Received
            <input type="date" value={form.receivedAt}
              onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} />
          </label>
          <label>
            Accepted
            <input type="date" value={form.acceptedAt}
              onChange={(e) => setForm({ ...form, acceptedAt: e.target.value })} />
          </label>
        </div>

        <label>
          JEL codes, comma separated
          <input type="text" value={form.jelCodes}
            onChange={(e) => setForm({ ...form, jelCodes: e.target.value })} />
        </label>

        <label>
          PDF
          <input type="file" accept="application/pdf" disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadPdf(file);
              e.target.value = "";
            }} />
        </label>
        {form.pdfUrl && (
          <p className="article__meta">
            <a href={form.pdfUrl}>{form.pdfUrl}</a>
            {form.pdfSizeBytes &&
              ` · ${Math.round(Number(form.pdfSizeBytes) / 1024)} kB`}
          </p>
        )}
        {uploading && <p className="article__meta">Uploading…</p>}
      </section>

      <h2>Authors</h2>
      <AuthorPicker value={authors} onChange={setAuthors} />

      <h2>Content</h2>
      <div className="lang-tabs" role="tablist" aria-label="Language">
        {routing.locales.map((locale) => {
          const t = translations.find((x) => x.locale === locale)!;
          const filled = t.title.trim().length > 0;
          const isPrimary = locale === form.primaryLanguage;
          return (
            <button key={locale} type="button" role="tab"
              aria-selected={locale === active}
              className={locale === active ? "is-active" : undefined}
              onClick={() => setActive(locale)}>
              {localeNames[locale]}
              {isPrimary && <span className="tab-primary">primary</span>}
              <span className={filled ? "tab-dot tab-dot--on" : "tab-dot"}>
                {filled ? "●" : "○"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="admin-form">
        <label>
          Title ({localeNames[active]})
          <input type="text" value={current.title}
            onChange={(e) => updateTranslation({ title: e.target.value })} />
        </label>
        <label>
          Abstract
          <textarea rows={6} value={current.abstract}
            onChange={(e) => updateTranslation({ abstract: e.target.value })} />
        </label>
        <label>
          Keywords, comma separated
          <input type="text" value={current.keywords}
            onChange={(e) => updateTranslation({ keywords: e.target.value })} />
        </label>
      </div>

      <p className="article__meta">
        {/* A missing translation is an expected state, not an error: the
            article page falls back and shows a notice. Saying so here stops
            editors treating the badge as something to fix before publishing. */}
        Publishing with one language filled is fine. Missing translations fall
        back on the public page and are marked as unavailable.
      </p>

      {error && <p className="admin-error">{error}</p>}
      {saved && <p className="admin-ok">{saved}</p>}

      <div className="admin-actions">
        <button type="button" disabled={pending} onClick={() => submit(false)}>
          {pending ? "Saving…" : "Save draft"}
        </button>
        <button type="button" disabled={pending} onClick={() => submit(true)}>
          Publish
        </button>
      </div>
    </div>
  );
}
