import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { metadataPage, urlAbsolue } from "@/lib/seo";
import PortfolioClient from "./PortfolioClient";
import JsonLd from "@/components/JsonLd";
import { filAriane, pageWeb } from "@/lib/donneesStructurees";

/* Coque serveur. La page elle-meme reste un composant client — elle a besoin
   des hooks de traduction — et un composant client ne peut pas exporter de
   metadata. Sans cette coque, la page heritait du bloc `alternates` du layout
   et se canonicalisait vers l'accueil : elle ne pouvait pas s'indexer. */

const CHEMIN = "/portfolio";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.portfolio" });
  // Titre et description a la bonne longueur, carte de partage avec image (lib/seo.ts).
  return metadataPage({ locale, chemin: CHEMIN, titre: t("title"), description: t("description") });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.portfolio" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const url = urlAbsolue(locale, CHEMIN);
  return (
    <>
      <JsonLd
        noeuds={[
          pageWeb("CollectionPage", locale, url, t("title"), t("description")),
          filAriane([
            [tNav("home"), urlAbsolue(locale)],
            [t("title"), url],
          ]),
        ]}
      />
      <PortfolioClient />
    </>
  );
}
