import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { metadataPage, urlAbsolue } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { MINIMUM_BALISAGE_AVIS } from "@/lib/reviewsDb";
import { avisPubliesEnCache, statistiquesAvisEnCache } from "@/lib/lecturesCache";

/* Un avis publie apparait au plus tard cinq minutes apres, et tout de suite
   quand il passe par la moderation (`revalidateTag("avis")`). */
export const revalidate = 300;
import AvisClient from "./AvisClient";
import JsonLd from "@/components/JsonLd";
import { filAriane } from "@/lib/donneesStructurees";

/* Le balisage `Review`/`AggregateRating` n'apparait qu'a partir de
   `MINIMUM_BALISAGE_AVIS` avis reels, deposes via un lien signe qui prouve
   l'achat.
   La moyenne est calculee sur tous les avis publies, sans filtre de note. Ne
   compter que les bonnes notes donnerait une note exacte au dixieme et fausse
   sur le fond.

   Le seuil lui-meme vit dans `lib/reviewsDb.ts` : les fiches produit s'en
   servent aussi, et deux seuils pour la meme regle finiraient par diverger. */

const CHEMIN = "/avis";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.avis" });
  // Titre et description a la bonne longueur, carte de partage avec image (lib/seo.ts).
  return metadataPage({ locale, chemin: CHEMIN, titre: t("title"), description: t("description") });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  /* La base est interrogee au rendu : un avis publie doit apparaitre sans
     redeploiement, c'est tout l'objet du dispositif. Une base injoignable
     ramene la page a ses temoignages de repli plutot qu'a une erreur. */
  const [avis, stats] = await Promise.all([
    avisPubliesEnCache().catch(() => []),
    statistiquesAvisEnCache().catch(() => ({ nombre: 0, moyenne: 0 })),
  ]);

  const balisage =
    stats.nombre >= MINIMUM_BALISAGE_AVIS
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Cartoonova",
          url: `${SITE_URL}/${locale}/avis`,
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: stats.moyenne,
            reviewCount: stats.nombre,
            bestRating: 5,
            worstRating: 1,
          },
          review: avis.slice(0, 20).map((a) => ({
            "@type": "Review",
            author: { "@type": "Person", name: a.auteur },
            datePublished: a.creeLe.slice(0, 10),
            reviewBody: a.texte,
            reviewRating: {
              "@type": "Rating",
              ratingValue: a.note,
              bestRating: 5,
              worstRating: 1,
            },
          })),
        }
      : null;

  // Fil d'Ariane (donnees structurees) : Accueil > cette page.
  const tArianeNav = await getTranslations({ locale: locale, namespace: "nav" });
  const tArianePage = await getTranslations({ locale: locale, namespace: "metaPages.avis" });
  const ariane = filAriane([
    [tArianeNav("home"), urlAbsolue(locale)],
    [tArianePage("title"), urlAbsolue(locale, "/avis")],
  ]);

  return (
    <>
      <JsonLd noeuds={[ariane]} />
      {balisage && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(balisage) }}
        />
      )}
      <AvisClient avis={avis} stats={stats} />
    </>
  );
}
