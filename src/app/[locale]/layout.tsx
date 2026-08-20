import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import "../globals.css";

/**
 * Every locale is prerendered. SPEC.md §2 requires static generation: a
 * client-rendered page means Google Scholar sees an empty document.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opts this subtree into static rendering; without it every page using
  // translations becomes dynamic, and dynamic is how the metadata disappears.
  setRequestLocale(locale);

  return (
    <html lang={localeHtmlLang[locale as Locale]}>
      <body>
        <NextIntlClientProvider>
          <SiteHeader locale={locale as Locale} />
          <main id="content">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
