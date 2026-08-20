import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { ProposalForm } from "@/components/proposal-form";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
      <h1>{t("title")}</h1>
      <p>{t("lede")}</p>
      <p className="article__meta">{t("noFees")}</p>

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
    </>
  );
}
