import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { ProposalForm } from "@/components/proposal-form";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The one interior page that spends the masthead's colour.
 *
 * The homepage closes with a red band promising this page, so following that
 * band should land the reader inside the same field rather than on a plain
 * page with a form on it. Every other page here is a record to be read; this
 * is the only one asking a stranger for something, and the terms of that ask
 * — no fees in either direction — are stated in the field, not buried in a
 * paragraph under the form.
 */
export default async function SubmitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("submit");

  return (
    <>
      <section className="head-field">
        <div className="shell">
          <h1>{t("title")}</h1>
          <p className="head-field__lede">{t("lede")}</p>
          <p className="head-field__terms">{t("noFees")}</p>
        </div>
      </section>

      <div className="shell">
        <ProposalForm
          locale={locale as Locale}
          labels={{
            name: t("name"),
            email: t("email"),
            affiliation: t("affiliation"),
            title: t("proposedTitle"),
            abstract: t("abstract"),
            language: t("language"),
            coauthors: t("coauthors"),
            file: t("file"),
            fileHint: t("fileHint"),
            fileChoose: t("fileChoose"),
            fileDrop: t("fileDrop"),
            fileRemove: t("fileRemove"),
            optional: t("optional"),
            submit: t("submit"),
            submitting: t("submitting"),
            successHeading: t("successHeading"),
            successBody: t("successBody"),
            errorRequired: t("errorRequired"),
            errorEmail: t("errorEmail"),
            errorRate: t("errorRate"),
            errorServer: t("errorServer"),
            errorFileSize: t("errorFileSize"),
            errorFileType: t("errorFileType"),
            uploading: t("uploading"),
          }}
        />
      </div>
    </>
  );
}
