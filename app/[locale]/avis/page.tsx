import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OG_LOCALE, alternatesPour, urlAbsolue } from "@/lib/seo";
import type { Locale } from "@/i18n/config";
import AvisClient from "./AvisClient";

/* Note pour la suite : cette page n'emet volontairement aucun balisage
   `Review` ni `AggregateRating`. Les temoignages affiches ne sont rattaches a
   aucune commande verifiable. Tant qu'une source d'avis reels n'existe pas,
   les baliser exposerait a une action manuelle de Google. */

const CHEMIN = "/avis";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.avis" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: alternatesPour(locale, CHEMIN),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: urlAbsolue(locale, CHEMIN),
      siteName: "Cartoonova",
      locale: OG_LOCALE[locale as Locale] ?? OG_LOCALE.fr,
      type: "website",
    },
  };
}

export default function Page() {
  return <AvisClient />;
}
