import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing, localeHtmlLang, type Locale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ptSerif, golos } from "@/fonts";
import "../globals.css";

const DIRECTION_CONTRACT = `<!--
THESIS: A regional scholarly record set in the scientific-publishing tradition
this readership was trained on; refuses the broadsheet masthead every journal
in this category ships.
OWN-WORLD: Cool offset paper #F1F2EE, ink #15181B, one committed red #AA1A14
owning whole fields rather than accenting them. PT Serif and Golos Text,
self-hosted because every Google Fonts subset omits the Uzbek modifier letter.
Rules are structure, numerals are the spine, and there are no cards.
STORY: A researcher sees a journal of their own region, in their own languages,
that will still be here in ten years, and that costs nothing to publish in.
FIRST VIEWPORT: A red field carrying the wordmark knocked out, the three
languages as a persistent triad, the newest Weekly note dated beneath it.
Submit sits at the foot as a matching red band.
FORM: The Nauka Setting; candidate 1 of 7; seed 6aaea64e.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md
-->`;

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
    <html
      lang={localeHtmlLang[locale as Locale]}
      className={`${ptSerif.variable} ${golos.variable}`}
    >
      <body>
        {/*
          The direction contract, emitted as a real HTML comment.

          A JSX comment is a JavaScript comment: the compiler removes it and it
          never reaches the markup, so it cannot be audited in the built output.
          This renders one empty node carrying the contract into the HTML,
          where `grep 6aaea64e .next` can find it.
        */}
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />

        <NextIntlClientProvider>
          <SiteHeader locale={locale as Locale} />
          <main id="content">{children}</main>
          <SiteFooter locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
