import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { marked } from "marked";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Content pages (SPEC.md §9).
 *
 * Markdown in the repo, one file per locale at `content/{locale}/{slug}.md`.
 * These change rarely and do not belong in the database.
 *
 * **The article fallback rules do not apply here.** DOAJ reads these pages, so
 * they are required complete in all three locales and a missing file is a
 * build error rather than a graceful degradation. `assertContentComplete`
 * below is what makes that true instead of aspirational.
 */

export const CONTENT_PAGES = ["about", "editorial-board", "for-authors"] as const;
export type ContentSlug = (typeof CONTENT_PAGES)[number];

const ROOT = join(process.cwd(), "content");

export function isContentSlug(value: string): value is ContentSlug {
  return (CONTENT_PAGES as readonly string[]).includes(value);
}

export type ContentPage = { title: string; html: string };

export async function getContentPage(
  slug: ContentSlug,
  locale: Locale,
): Promise<ContentPage | null> {
  let raw: string;
  try {
    raw = await readFile(join(ROOT, locale, `${slug}.md`), "utf8");
  } catch {
    return null;
  }

  // First heading is the page title; the rest is the body. Keeping the title
  // out of the rendered HTML lets the page own its own <h1>.
  const lines = raw.split("\n");
  const titleIndex = lines.findIndex((l) => l.startsWith("# "));
  const title = titleIndex >= 0 ? lines[titleIndex].slice(2).trim() : slug;
  const body = lines.filter((_, i) => i !== titleIndex).join("\n");

  return {
    title,
    // Our own repository files, not user input — but still parsed with
    // markdown rather than interpolated, so a stray bracket cannot become
    // markup by accident.
    html: await marked.parse(body, { async: true }),
  };
}

/**
 * Every page in every locale, or the names of what is missing.
 * Called by a test so an incomplete matrix fails CI rather than a DOAJ review.
 */
export async function findMissingContent(): Promise<string[]> {
  const missing: string[] = [];
  for (const locale of routing.locales) {
    for (const slug of CONTENT_PAGES) {
      const page = await getContentPage(slug, locale);
      if (!page) missing.push(`${locale}/${slug}.md`);
    }
  }
  return missing;
}
