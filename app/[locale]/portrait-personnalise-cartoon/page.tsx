import { Metadata } from "next";
import PageAccueil from "@/components/pages/PageAccueil";
import { BreadcrumbJsonLd } from "@/components/structured-data";
import { SITE_URL } from "@/lib/site";

/**
 * Page pilier « portrait personnalisé cartoon ».
 *
 * Elle sert desormais le CORPS DE L'ACCUEIL, a son propre chemin et sans la
 * moindre redirection : c'est la premiere page que ChatGPT recommande (9 vues
 * et 3 visiteurs sur les quatorze jours au 26 aout 2026, devant toutes les
 * autres), et un 301 vers `/fr` aurait rendu ce chemin invisible.
 *
 * Le corps vient de `components/pages/PageAccueil.tsx`, partage avec `/[locale]`.
 * Recopier l'accueil ici aurait cree une seconde version a maintenir — et
 * l'histoire de cette page dit ce que ca donne : elle affichait encore 49 EUR
 * quand la grille en disait 5, parce que trois prix y avaient ete ecrits en
 * dur et n'avaient jamais suivi.
 *
 * Ce qui distingue les deux URL :
 *
 *  - le titre et la description, cibles sur la requete ;
 *  - le canonical, qui pointe sur ce chemin et non sur l'accueil ;
 *  - le hero, dont le texte est propre a cette page (voir TEXTES_HERO).
 *
 * Il faut etre lucide sur la limite : deux pages au corps identique finissent
 * souvent consolidees par Google, qui en garde une seule. Le hero distinct et
 * les metadonnees ciblees sont ce qui s'y oppose le plus efficacement, pas une
 * garantie. Le vrai remede serait un contenu propre — la page en avait un, il
 * a ete retire volontairement.
 */

const CHEMIN = "/portrait-personnalise-cartoon";

/* Hero propre a cette page. C'est le seul bloc dont le texte differe de
   l'accueil, et c'est le bloc qui compte : il porte le h1 et l'accroche. La
   requete cible y figure telle qu'elle est cherchee. */
const TEXTES_HERO = {
  oeil: "Portrait cartoon dessiné à la main",
  titre1: "Portrait personnalisé cartoon",
  titre2: "d'après votre photo",
  sous:
    "Vos photos transformées en caricature personnalisée par de vrais illustrateurs. " +
    "Aperçu sous 2 jours, retouches illimitées.",
  note: "Aperçu sous 2 jours, sans engagement",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const path = `/${locale}${CHEMIN}`;

  return {
    title:
      "Portrait Personnalisé Cartoon - Caricature Personnalisée à partir de votre Photo | Cartoonova",
    description:
      "Transformez vos photos en portraits personnalisés style cartoon ! Créez votre caricature unique en quelques clics. Idée cadeau originale parfaite. Qualité garantie, livraison rapide. Découvrez Cartoonova !",
    metadataBase: new URL(SITE_URL),
    /* Pas de `languages` ici, et c'est delibere : le hero de cette page est
       redige en francais et le reste dans toutes les langues. Annoncer une
       version allemande qui sert du francais, c'est declarer un hreflang faux.
       Les versions non francaises passent donc en `noindex`. */
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title: "Portrait Personnalisé Cartoon - Cartoonova",
      description:
        "Créez votre caricature personnalisée à partir de votre photo. Cadeau unique et original !",
      url: `${SITE_URL}${path}`,
      siteName: "Cartoonova",
      images: [
        {
          url: `${SITE_URL}/simpson_photos_produit/0009_1.jpg`,
          width: 1200,
          height: 630,
          alt: "Portrait personnalisé cartoon - Cartoonova",
        },
      ],
      locale: "fr_FR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Portrait Personnalisé Cartoon | Cartoonova",
      description: "Transformez vos photos en portraits cartoons uniques !",
      images: [`${SITE_URL}/simpson_photos_produit/0009_1.jpg`],
    },
    robots: {
      index: locale === "fr",
      follow: true,
      googleBot: {
        index: locale === "fr",
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function PortraitPersonnaliseCartoon({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <>
      {/* Le seul balisage propre a cette URL. `Product` et `FAQPage` ont ete
          retires avec le contenu qu'ils decrivaient : un balisage de FAQ sans
          FAQ visible est un balisage trompeur, et Google le sanctionne.
          `Organization` et `WebSite` arrivent avec le corps partage. */}
      <BreadcrumbJsonLd
        breadcrumbs={[
          { name: "Accueil", item: `${SITE_URL}/${locale}` },
          { name: "Portrait Personnalisé Cartoon", item: `${SITE_URL}/${locale}${CHEMIN}` },
        ]}
      />
      <PageAccueil locale={locale} textesHero={TEXTES_HERO} />
    </>
  );
}
