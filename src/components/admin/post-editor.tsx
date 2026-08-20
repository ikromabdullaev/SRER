"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "./rich-text-editor";
import { savePost, type PostTranslationInput } from "@/app/admin/weekly/actions";
import { routing, localeNames, type Locale } from "@/i18n/routing";

export type PostEditorData = {
  id?: string;
  slug: string;
  translations: PostTranslationInput[];
};

function emptyTranslations(): PostTranslationInput[] {
  return routing.locales.map((locale) => ({
    locale,
    title: "",
    excerpt: "",
    body: "",
  }));
}

/**
 * The Weekly post editor: one tab per language.
 *
 * A tab left blank is not an error and not a draft — it means the post does
 * not exist in that language, and it will not appear when a reader filters to
 * it (SPEC.md → Weekly → Languages). The tab labels say which languages are
 * filled so that is visible rather than implied.
 */
export function PostEditor({ initial }: { initial?: PostEditorData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [active, setActive] = useState<Locale>(routing.defaultLocale);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [translations, setTranslations] = useState<PostTranslationInput[]>(() => {
    const base = emptyTranslations();
    for (const t of initial?.translations ?? []) {
      const slot = base.find((b) => b.locale === t.locale);
      if (slot) Object.assign(slot, t);
    }
    return base;
  });

  const current = translations.find((t) => t.locale === active)!;
  const filledCount = translations.filter((t) => t.title.trim()).length;

  function update(patch: Partial<PostTranslationInput>) {
    setTranslations((prev) =>
      prev.map((t) => (t.locale === active ? { ...t, ...patch } : t)),
    );
  }

  function submit(publish: boolean) {
    setError(null);
    setSaved(null);

    startTransition(async () => {
      const result = await savePost({
        id: initial?.id,
        slug,
        publish,
        translations,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(publish ? "Published." : "Saved as draft.");
      if (!initial?.id) router.replace(`/admin/weekly/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="post-editor">
      <div className="admin-form">
        <label>
          Slug
          <input
            type="text"
            value={slug}
            placeholder="left blank, generated from the title"
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <p className="article__meta">
          The URL is <code>/weekly/&lt;your handle&gt;/{slug || "…"}</code>. Once
          published it does not change.
        </p>
      </div>

      <div className="lang-tabs" role="tablist" aria-label="Language">
        {routing.locales.map((locale) => {
          const t = translations.find((x) => x.locale === locale)!;
          const filled = t.title.trim().length > 0;
          return (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={locale === active}
              className={locale === active ? "is-active" : undefined}
              onClick={() => setActive(locale)}
            >
              {localeNames[locale]}
              {/* Says which languages this post will exist in, rather than
                  leaving the editor to infer it from empty tabs. */}
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
          <input
            type="text"
            value={current.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </label>

        <label>
          Excerpt
          <textarea
            rows={2}
            value={current.excerpt}
            onChange={(e) => update({ excerpt: e.target.value })}
          />
        </label>

        <div>
          <span className="editor-label">Body</span>
          <RichTextEditor
            key={active}
            label={`Body (${localeNames[active]})`}
            value={current.body}
            onChange={(html) => update({ body: html })}
          />
        </div>
      </div>

      <p className="article__meta">
        {filledCount === 0
          ? "No language filled in yet."
          : `Will be published in ${translations
              .filter((t) => t.title.trim())
              .map((t) => localeNames[t.locale])
              .join(", ")}.`}
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
