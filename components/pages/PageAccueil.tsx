import Accueil, { type TextesHero } from "@/components/pages/Accueil";
import { visuelsProduit } from "@/lib/visuels";
import { getPricesForCurrency } from "@/lib/db";
import { DEFAULT_PRICE_SET } from "@/lib/types";
import { evenementAffiche } from "@/lib/evenements";
import { SITE_URL } from "@/lib/site";
import { locales, type Locale } from "@/i18n/config";

/**
 * Le contenu de l'accueil, servi par PLUSIEURS routes.
 *
 * Il vivait dans `app/[locale]/page.tsx`. Il en sort parce que
 * `/[locale]/portrait-personnalise-cartoon` doit desormais afficher
 * exactement la meme chose, a son propre chemin.
 *
 * Extrait plutot que recopie, et c'est tout l'interet : deux copies d'une
 * page divergent toujours: on met le prix a jour d'un cote, le visuel de
 * l'autre. C'est precisement ce qui avait produit une page pilier annoncant
 * 49 EUR quand la grille en disait 5. Une seule source, deux routes.
 *
 * Chaque route garde en revanche ses propres metadonnees — titre, description,
 * canonical. C'est ce qui distingue les deux URL aux yeux de Google alors
 * qu'elles servent le meme corps.
 */

/* Identite du site pour Google. L'accueil n'en portait aucune : ni
   `Organization`, ni `WebSite`.

   `alternateName` n'est pas cosmetique. Le releve Search Console du
   2026-08-17 montre que la marque est cherchee avec une orthographe fautive
   dans une requete sur trois — « cartoona », « cartonova », « caronova »,
   « cartoonnova ». Les declarer aide Google a rattacher ces requetes au site.

   Pas de `SearchAction` ici : il faudrait une vraie page de recherche
   derriere. Un balisage qui pointe vers une URL inexistante est un balisage
   trompeur. A ajouter le jour ou la recherche interne existera. */
function baliseIdentite(locale: string) {
  const organisation = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Cartoonova",
    alternateName: ["Cartoon Nova", "Cartoonnova", "Cartonova"],
    url: `${SITE_URL}/${locale}`,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.png`,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "support@cartoonova.com",
      availableLanguage: [...locales],
    },
  };

  const site = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "Cartoonova",
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  return { "@context": "https://schema.org", "@graph": [organisation, site] };
}

/* Les visuels sont lus dans public/ au rendu : ce composant reste serveur et
   ne passe au client que les chemins deja resolus.

   La locale sert ici a une seule chose : la fete des meres ne tombe pas le
   meme jour en France, au Royaume-Uni et en Allemagne, et c'est elle qui
   decide du discours du hero. */

export default async function PageAccueil({
  locale,
  textesHero = null,
}: {
  locale: string;
  /** Hero propre a la route. Null = celui de l'accueil. */
  textesHero?: TextesHero | null;
}) {
  const simpson = visuelsProduit("simpson").galerie;
  // Meme photo que la banniere finale (cta-fond.webp) : famille + resultat
  // cartoon sur le telephone, recadree en carre pour le format du hero.
  const photoHero = "/toonjaune/hero-famille-cartoon.webp";
  const photosAvis = simpson.slice(1, 9);

  let prixDepart = DEFAULT_PRICE_SET.base;
  try {
    prixDepart = (await getPricesForCurrency("EUR")).base;
  } catch {
    // Prix de repli : la page reste servie meme si la base est injoignable.
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(baliseIdentite(locale)) }}
      />
      <Accueil
        photosAvis={photosAvis}
        photoHero={photoHero}
        prixDepart={prixDepart}
        evenement={evenementAffiche(locale as Locale)}
        textesHero={textesHero}
      />
    </>
  );
}
