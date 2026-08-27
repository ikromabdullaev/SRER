"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";
import { routing, type Locale } from "@/i18n/routing";
import type { Database } from "@/lib/supabase/database.types";

export type ArticleTranslationInput = {
  locale: Locale;
  title: string;
  abstract: string;
  keywords: string;
};

export type ArticleAuthorInput = {
  authorId: string;
  displayName: string;
  isCorresponding: boolean;
};

export type SaveArticleInput = {
  id?: string;
  slug: string;
  primaryLanguage: Locale;
  type: Database["public"]["Enums"]["article_type"];
  issueId: string;
  position: string;
  firstPage: string;
  lastPage: string;
  jelCodes: string;
  pdfUrl: string;
  pdfSizeBytes: string;
  receivedAt: string;
  acceptedAt: string;
  publish: boolean;
  translations: ArticleTranslationInput[];
  authors: ArticleAuthorInput[];
};

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveArticle(
  input: SaveArticleInput,
): Promise<SaveResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const filled = input.translations.filter((t) => t.title.trim().length > 0);
  if (filled.length === 0) {
    return { ok: false, error: "Give the article a title in at least one language." };
  }

  // The database enforces this too, with a deferred trigger — but failing here
  // gives the editor a sentence instead of a constraint violation.
  const hasPrimary = filled.some((t) => t.locale === input.primaryLanguage);
  if (!hasPrimary) {
    return {
      ok: false,
      error:
        `The primary language is ${input.primaryLanguage.toUpperCase()}, so the ` +
        `${input.primaryLanguage.toUpperCase()} title is required — it is what ` +
        `citation_title carries.`,
    };
  }

  if (input.publish && !input.pdfUrl.trim()) {
    return { ok: false, error: "A published article needs a PDF." };
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug.trim())) {
    return {
      ok: false,
      error: "The slug may contain only lowercase letters, numbers and hyphens.",
    };
  }

  const supabase = await createAuthClient();

  const { data, error } = await supabase.rpc("publish_article", {
    payload: {
      id: input.id ?? "",
      slug: input.slug.trim(),
      issue_id: input.issueId,
      position: input.position,
      primary_language: input.primaryLanguage,
      type: input.type,
      pdf_url: input.pdfUrl.trim(),
      pdf_size_bytes: input.pdfSizeBytes,
      first_page: input.firstPage,
      last_page: input.lastPage,
      jel_codes: input.jelCodes
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      state: input.publish ? "published" : "draft",
      published_at: input.publish ? new Date().toISOString() : "",
      received_at: input.receivedAt,
      accepted_at: input.acceptedAt,
      translations: filled.map((t) => ({
        locale: t.locale,
        title: t.title.trim(),
        abstract: t.abstract.trim(),
        keywords: t.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      })),
      authors: input.authors.map((a) => ({
        author_id: a.authorId,
        is_corresponding: a.isCorresponding,
      })),
    },
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That slug is already in use." };
    }
    if (error.message.includes("slug is immutable")) {
      return {
        ok: false,
        error:
          "The slug of a published article cannot change: its URL is permanent.",
      };
    }
    return { ok: false, error: error.message };
  }

  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/articles/${input.slug.trim()}`);
    revalidatePath(`/${locale}/issues`);
    revalidatePath(`/${locale}/online-first`);
    revalidatePath(`/${locale}`);
  }
  revalidatePath("/admin/articles");

  return { ok: true, id: data as unknown as string };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Withdraws a published article.
 *
 * The correct answer for something that should stop being cited but has
 * already been cited. The row stays, the URL keeps resolving, and the slug
 * stays locked -- a database trigger refuses to release it, so nothing else
 * can ever occupy that URL.
 *
 * SPEC.md open decision D3 has not settled what a withdrawn article's page
 * should say. Until it does, this changes the state and nothing else.
 */
export async function withdrawArticle(id: string): Promise<DeleteResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createAuthClient();
  const { data: article } = await supabase
    .from("articles")
    .select("id, slug, state")
    .eq("id", id)
    .maybeSingle();

  if (!article) return { ok: false, error: "Not found." };
  if (article.state === "withdrawn") {
    return { ok: false, error: "That article is already withdrawn." };
  }

  const { error } = await supabase
    .from("articles")
    .update({ state: "withdrawn" })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/articles/${article.slug}`);
    revalidatePath(`/${locale}/issues`);
    revalidatePath(`/${locale}/online-first`);
    revalidatePath(`/${locale}`);
  }
  revalidatePath("/admin/articles");
  return { ok: true };
}

/**
 * Deletes an article outright. Translations, author links, reviews and
 * decisions cascade with it.
 *
 * A draft goes without ceremony: it has never had a URL, so nothing can be
 * pointing at it.
 *
 * Anything that has been published is different, and the confirmation is the
 * point rather than a formality. This journal's whole premise is that a
 * citation resolves in ten years (PRODUCT.md, "Permanence outranks
 * improvement"), and deleting a published article breaks that for every
 * reference to it, in print, forever. `withdrawArticle` is almost always what
 * is actually wanted. So the caller has to type the slug back: a deliberate
 * act, not a mis-click, and the slug is the thing being destroyed.
 */
export async function deleteArticle(
  id: string,
  confirmSlug: string,
): Promise<DeleteResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createAuthClient();
  const { data: article } = await supabase
    .from("articles")
    .select("id, slug, state")
    .eq("id", id)
    .maybeSingle();

  if (!article) return { ok: false, error: "Not found." };

  const wasPublic = article.state !== "draft";
  if (wasPublic && confirmSlug.trim() !== article.slug) {
    return {
      ok: false,
      error: `This article has been public at /articles/${article.slug}. Type the slug exactly to confirm you mean to break every link to it.`,
    };
  }

  // A correction pointing at this one would be left dangling; the FK is NO
  // ACTION, so Postgres refuses rather than silently orphaning it.
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "Another article records this one as the version it supersedes, so it cannot be deleted. Withdraw it instead.",
      };
    }
    return { ok: false, error: error.message };
  }

  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/articles/${article.slug}`);
    revalidatePath(`/${locale}/issues`);
    revalidatePath(`/${locale}/online-first`);
    revalidatePath(`/${locale}`);
  }
  revalidatePath("/admin/articles");
  return { ok: true };
}

export type AuthorOption = { id: string; label: string };

/**
 * Autocomplete over existing authors.
 *
 * SPEC.md §7.1 asks for this so the same person is not duplicated across
 * issues — authors are entities with stable identity, and an author page only
 * works if every appearance points at the same row.
 */
export async function findAuthors(query: string): Promise<AuthorOption[]> {
  const profile = await getStaffProfile();
  if (!profile) return [];

  const supabase = await createAuthClient();
  const term = query.trim();
  if (term.length < 2) return [];

  const { data } = await supabase
    .from("authors")
    .select("id, family_name, given_name, orcid")
    .or(`family_name.ilike.%${term}%,given_name.ilike.%${term}%`)
    .limit(10);

  return (data ?? []).map((a) => ({
    id: a.id,
    label:
      `${a.family_name}, ${a.given_name}` + (a.orcid ? ` (${a.orcid})` : ""),
  }));
}

/** Creates an author entity. Latin canonical names, per SCHEMA.md. */
export async function createAuthor(input: {
  familyName: string;
  givenName: string;
  orcid: string;
  affiliation: string;
}): Promise<{ ok: true; author: AuthorOption } | { ok: false; error: string }> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const familyName = input.familyName.trim();
  const givenName = input.givenName.trim();
  if (!familyName || !givenName) {
    return { ok: false, error: "Both family and given name are required." };
  }

  const orcid = input.orcid.trim();
  if (orcid && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid)) {
    return { ok: false, error: "ORCID must look like 0000-0002-1825-0097." };
  }

  const base = `${familyName}-${givenName}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const supabase = await createAuthClient();

  // Slug collisions get a numeric suffix, the same rule as article slugs.
  let slug = base;
  for (let attempt = 2; attempt < 50; attempt++) {
    const { data: clash } = await supabase
      .from("authors")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${base}-${attempt}`;
  }

  const { data, error } = await supabase
    .from("authors")
    .insert({
      slug,
      family_name: familyName,
      given_name: givenName,
      orcid: orcid || null,
    })
    .select("id, family_name, given_name")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "An author with that ORCID already exists." };
    }
    return { ok: false, error: error.message };
  }

  const affiliation = input.affiliation.trim();
  if (affiliation) {
    await supabase.from("author_translations").insert({
      author_id: data.id,
      locale: "en",
      display_name: `${familyName}, ${givenName}`,
      affiliation,
    });
  }

  return {
    ok: true,
    author: { id: data.id, label: `${data.family_name}, ${data.given_name}` },
  };
}
