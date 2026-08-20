import { createPublicClient } from "./supabase/server";
import { routing, type Locale } from "@/i18n/routing";

/**
 * The Weekly series (SPEC.md → **Weekly**).
 *
 * The language rules here are deliberately the opposite of the article rules,
 * and mixing them up is the easiest mistake to make in this file:
 *
 *  - An **article** always exists in every locale. A missing translation falls
 *    back to `primary_language` and shows a notice. It never disappears.
 *  - A **post** exists only in the languages it was written in. A language
 *    filter removes it outright, with no fallback and no notice.
 */

export type PostAuthor = {
  handle: string;
  fullName: string;
  bio: string | null;
};

export type PostSummary = {
  id: string;
  slug: string;
  publishedAt: string | null;
  author: PostAuthor;
  /** The locales this post actually exists in. Never inferred, always listed. */
  availableLocales: Locale[];
  /** Title and excerpt in the locale being shown. */
  locale: Locale;
  title: string;
  excerpt: string | null;
};

export type Post = PostSummary & {
  /** Sanitised HTML from the admin editor. */
  body: string;
};

type TranslationRow = {
  locale: string;
  title: string;
  excerpt: string | null;
  body?: string;
};

type PostRow = {
  id: string;
  slug: string;
  published_at: string | null;
  profiles: { handle: string | null; full_name: string; bio: string | null } | null;
  post_translations: TranslationRow[];
};

const SELECT = `
  id, slug, published_at,
  profiles!inner ( handle, full_name, bio ),
  post_translations ( locale, title, excerpt )
`;

function orderLocales(locales: string[]): Locale[] {
  return routing.locales.filter((l) => locales.includes(l));
}

/**
 * Choose which translation to show in a listing.
 *
 * This is presentation, not fallback: the post is already known to exist in
 * these languages, and we are picking which one to put on a card. Preferring
 * the reader's locale and then the site default keeps a mixed-language list
 * readable without ever implying a translation exists that does not.
 */
function pickForDisplay(
  translations: TranslationRow[],
  preferred: Locale,
): TranslationRow | undefined {
  return (
    translations.find((t) => t.locale === preferred) ??
    translations.find((t) => t.locale === routing.defaultLocale) ??
    translations[0]
  );
}

function toSummary(row: PostRow, preferred: Locale): PostSummary | null {
  const chosen = pickForDisplay(row.post_translations, preferred);
  if (!chosen || !row.profiles?.handle) return null;

  return {
    id: row.id,
    slug: row.slug,
    publishedAt: row.published_at,
    author: {
      handle: row.profiles.handle,
      fullName: row.profiles.full_name,
      bio: row.profiles.bio,
    },
    availableLocales: orderLocales(row.post_translations.map((t) => t.locale)),
    locale: chosen.locale as Locale,
    title: chosen.title,
    excerpt: chosen.excerpt,
  };
}

/**
 * Weekly posts, newest first.
 *
 * `filterLocale` implements the rule from SPEC.md: when the reader filters by
 * language, posts without that language are **removed**, not translated. The
 * inner join on `post_translations` is what does it — a post with no row for
 * that locale produces no row at all.
 */
export async function listPosts(
  displayLocale: Locale,
  options: { filterLocale?: Locale; handle?: string; limit?: number } = {},
): Promise<PostSummary[]> {
  const supabase = createPublicClient();

  let query = supabase
    .from("posts")
    .select(
      options.filterLocale
        ? SELECT.replace("post_translations (", "post_translations!inner (")
        : SELECT,
    )
    .eq("state", "published")
    .order("published_at", { ascending: false });

  if (options.filterLocale) {
    query = query.eq("post_translations.locale", options.filterLocale);
  }
  if (options.handle) {
    query = query.eq("profiles.handle", options.handle);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as PostRow[];

  // When filtering, the inner join has already narrowed post_translations to
  // the requested locale, so that is the one to display.
  const display = options.filterLocale ?? displayLocale;
  return rows
    .map((row) => toSummary(row, display))
    .filter((p): p is PostSummary => p !== null);
}

/**
 * One post in one locale, or null if it does not exist in that language.
 *
 * Null here does not mean "not found" — it means "not in this language", and
 * the caller redirects to a locale that does have it rather than 404ing. A
 * shared link must keep working; publishing an English post at a Russian URL
 * must not happen.
 */
export async function getPost(
  handle: string,
  slug: string,
  locale: Locale,
): Promise<Post | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, slug, published_at,
       profiles!inner ( handle, full_name, bio ),
       post_translations ( locale, title, excerpt, body )`,
    )
    .eq("state", "published")
    .eq("slug", slug)
    .eq("profiles.handle", handle)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as PostRow;
  const translation = row.post_translations.find((t) => t.locale === locale);
  if (!translation?.body) return null;

  const summary = toSummary(row, locale);
  if (!summary) return null;

  return { ...summary, locale, title: translation.title, excerpt: translation.excerpt, body: translation.body };
}

/** Which locales a post exists in — used to pick a redirect target. */
export async function getPostLocales(
  handle: string,
  slug: string,
): Promise<Locale[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("posts")
    .select(`slug, profiles!inner ( handle ), post_translations ( locale )`)
    .eq("state", "published")
    .eq("slug", slug)
    .eq("profiles.handle", handle)
    .maybeSingle();

  if (error) throw error;
  if (!data) return [];

  const row = data as unknown as { post_translations: { locale: string }[] };
  return orderLocales(row.post_translations.map((t) => t.locale));
}

/** Every published post, as (handle, slug, locale) triples, for static params. */
export async function getPostRoutes(): Promise<
  { handle: string; slug: string; locale: Locale }[]
> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("posts")
    .select(`slug, profiles!inner ( handle ), post_translations ( locale )`)
    .eq("state", "published");

  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    slug: string;
    profiles: { handle: string | null };
    post_translations: { locale: string }[];
  }[];

  // Only the locales a post exists in are prerendered. The others are handled
  // by a redirect at request time, not by a generated page.
  return rows.flatMap((row) =>
    row.profiles.handle
      ? orderLocales(row.post_translations.map((t) => t.locale)).map((locale) => ({
          handle: row.profiles.handle as string,
          slug: row.slug,
          locale,
        }))
      : [],
  );
}

/** Editors who have opted into a public series by having a handle. */
export async function getEditor(handle: string): Promise<PostAuthor | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("handle, full_name, bio")
    .eq("handle", handle)
    .maybeSingle();

  if (error) throw error;
  if (!data?.handle) return null;
  return { handle: data.handle, fullName: data.full_name, bio: data.bio };
}
