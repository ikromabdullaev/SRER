import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { CONTENT_PAGES, getContentPage, isContentSlug } from "@/lib/content";
import { journal, absoluteUrl } from "@/config/journal";

/** Static content pages: about, editorial board, for authors. */
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    CONTENT_PAGES.map((page) => ({ locale, page })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}): Promise<Metadata> {
  const { locale, page } = await params;
  if (!hasLocale(routing.locales, locale) || !isContentSlug(page)) return {};

  const content = await getContentPage(page, locale as Locale);
  if (!content) return {};

  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = absoluteUrl(`/${l}/${page}`);

  return {
    title: `${content.title} — ${journal.name}`,
    alternates: { canonical: absoluteUrl(`/${locale}/${page}`), languages },
  };
}

export default async function ContentPageRoute({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isContentSlug(page)) notFound();
  setRequestLocale(locale);

  const content = await getContentPage(page, locale as Locale);
  if (!content) notFound();

  return (
    <div className="shell">
      <article className="prose">
        <h1>{content.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: content.html }} />
      </article>
    </div>
  );
}
