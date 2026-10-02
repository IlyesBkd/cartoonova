import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { metadataPage, urlAbsolue } from "@/lib/seo";
import PortfolioClient from "./PortfolioClient";
import JsonLd from "@/components/JsonLd";
import { filAriane, pageWeb } from "@/lib/donneesStructurees";
import type { Locale } from "@/i18n/config";
import {
  CATALOGUE_EN_LIGNE,
  CATEGORIES_AFFICHAGE,
  NOMS_CATEGORIE,
  slugProduit,
  universProduit,
} from "@/lib/catalogue";
import { galerieAvantApres } from "@/lib/visuels";
import type { RealisationPortfolio } from "./PortfolioClient";

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

  /* Les montages avant/apres reels, un par univers : la photo envoyee a cote
     du portrait dessine. `galerieAvantApres` lit public/ — module serveur —
     d'ou le calcul ici plutot que dans le composant client. */
  const loc = locale as Locale;
  const parSlug = new Map(CATALOGUE_EN_LIGNE.map((p) => [p.slug, p]));
  const realisations: RealisationPortfolio[] = galerieAvantApres().flatMap(({ slug, image }) => {
    const p = parSlug.get(slug);
    return p
      ? [{ cle: p.slug, lien: slugProduit(p, loc), univers: universProduit(p, loc), categorie: p.categorie, image }]
      : [];
  });
  const categories = CATEGORIES_AFFICHAGE.filter((c) => realisations.some((r) => r.categorie === c)).map(
    (c) => ({ cle: c, nom: NOMS_CATEGORIE[c][loc] })
  );

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
      <PortfolioClient realisations={realisations} categories={categories} />
    </>
  );
}
