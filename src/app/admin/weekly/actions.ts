"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient, getStaffProfile } from "@/lib/supabase/auth";
import { cleanPostBody } from "@/lib/sanitise";
import { routing, type Locale } from "@/i18n/routing";

export type PostTranslationInput = {
  locale: Locale;
  title: string;
  excerpt: string;
  body: string;
};

export type SavePostInput = {
  id?: string;
  slug: string;
  authorId?: string;
  publish: boolean;
  translations: PostTranslationInput[];
};

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Latin-ish slug from a title. Kept simple; editors can override it. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Saves a Weekly post.
 *
 * **This is where sanitising happens, and it is the only place it happens.**
 * The editor produces clean markup, but that is a convenience: a request that
 * skips the editor still lands here, and `save_post` does not re-clean what it
 * is given. If this function is ever bypassed, the guarantee that
 * `post_translations.body` holds sanitised HTML is gone.
 */
export async function savePost(input: SavePostInput): Promise<SaveResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const filled = input.translations.filter((t) => t.title.trim().length > 0);
  if (filled.length === 0) {
    return { ok: false, error: "Give the post a title in at least one language." };
  }

  if (input.publish && !input.slug.trim()) {
    return { ok: false, error: "A published post needs a slug." };
  }

  const slug = input.slug.trim() || slugify(filled[0].title);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return {
      ok: false,
      error: "The slug may contain only lowercase letters, numbers and hyphens.",
    };
  }

  const supabase = await createAuthClient();

  const { data, error } = await supabase.rpc("save_post", {
    payload: {
      id: input.id ?? "",
      slug,
      author_id: input.authorId ?? profile.id,
      state: input.publish ? "published" : "draft",
      published_at: input.publish ? new Date().toISOString() : "",
      translations: filled.map((t) => ({
        locale: t.locale,
        title: t.title.trim(),
        excerpt: t.excerpt.trim(),
        body: cleanPostBody(t.body),
      })),
    },
  });

  if (error) {
    // A unique violation here means this editor already used that slug.
    if (error.code === "23505") {
      return { ok: false, error: "You already have a post with that slug." };
    }
    return { ok: false, error: error.message };
  }

  // Publishing must be visible immediately: an editor who publishes and then
  // sees a stale page will publish again (SPEC.md §7.1).
  const handle = profile.handle;
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/weekly`);
    if (handle) revalidatePath(`/${locale}/weekly/${handle}/${slug}`);
    revalidatePath(`/${locale}`);
  }
  revalidatePath("/admin/weekly");

  return { ok: true, id: data as unknown as string };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes a Weekly post. Translations cascade with it.
 *
 * Weekly is not the scholarly record -- posts carry no citation_* tags and
 * appear in no OAI-PMH feed, precisely so that editorial commentary is never
 * mistaken for peer-reviewed work. So deleting one breaks links, not
 * citations, and that is a materially smaller promise than the one an article
 * makes.
 *
 * It is still a promise. A draft goes without ceremony; anything that has been
 * published asks for the slug back, so the destructive case is deliberate.
 *
 * RLS does the authorisation: "editors manage their own posts" means another
 * editor's post is simply not visible here, and the lookup below returns
 * nothing rather than needing its own ownership check.
 */
export async function deletePost(
  id: string,
  confirmSlug: string,
): Promise<DeleteResult> {
  const profile = await getStaffProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createAuthClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, slug, state")
    .eq("id", id)
    .maybeSingle();

  if (!post) return { ok: false, error: "Not found." };

  if (post.state !== "draft" && confirmSlug.trim() !== post.slug) {
    return {
      ok: false,
      error: `This post is published. Type the slug ${post.slug} exactly to confirm you mean to remove it and break every link to it.`,
    };
  }

  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  const handle = profile.handle;
  for (const locale of routing.locales) {
    revalidatePath(`/${locale}/weekly`);
    if (handle) revalidatePath(`/${locale}/weekly/${handle}/${post.slug}`);
    revalidatePath(`/${locale}`);
  }
  revalidatePath("/admin/weekly");
  return { ok: true };
}
