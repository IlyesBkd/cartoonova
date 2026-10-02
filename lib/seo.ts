import type { Metadata } from "next";
import { locales, type Locale } from "../i18n/config";
import { SITE_URL } from "./site";

/**
 * Bloc `alternates` d'une page.
 *
 * A lire avant de s'en passer : la fusion des metadata de Next est *shallow*.
 * Une page qui ne redefinit pas `alternates` herite de celui du layout — et le
 * layout de `[locale]` declare `canonical: "/{locale}"`. Autrement dit, toute
 * page sans `alternates` explicite se canonicalise vers l'accueil et ne peut
 * pas s'indexer. Sept gabarits etaient dans ce cas.
 *
 * Cette fonction existe pour qu'on ne puisse plus l'oublier : elle produit le
 * canonical, les cinq `hreflang` reciproques et le `x-default` d'un seul coup.
 *
 * @param locale  langue de la page rendue
 * @param chemin  chemin sans prefixe de langue ("" pour l'accueil,
 *                "/collections", "/cadeau/simpson-anniversaire"). Passer un
 *                objet quand le chemin differe d'une langue a l'autre.
 */
export function alternatesPour(
  locale: string,
  chemin: string | Partial<Record<Locale, string>> = ""
): Metadata["alternates"] {
  const cheminDe = (l: Locale): string =>
    typeof chemin === "string" ? chemin : chemin[l] ?? "";

  const urlDe = (l: Locale): string => `${SITE_URL}/${l}${cheminDe(l)}`;

  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = urlDe(l);

  /* x-default sert les visiteurs dont la langue ne correspond a aucune des
     cinq. L'anglais les sert mieux que le francais, et c'est deja le repli du
     proxy quand le pays est inconnu (`proxy.ts`) — les deux restent alignes. */
  languages["x-default"] = urlDe("en");

  return {
    canonical: urlDe((locales as readonly string[]).includes(locale) ? (locale as Locale) : "fr"),
    languages,
  };
}

/** URL absolue d'une page, meme convention de chemin que `alternatesPour`. */
export function urlAbsolue(locale: string, chemin = ""): string {
  return `${SITE_URL}/${locale}${chemin}`;
}

/**
 * Metadata des trois pages legales — CGV, mentions legales, confidentialite.
 *
 * Depuis le 2 octobre 2026 elles sont traduites dans les dix langues
 * (lib/legal/*), la version francaise faisant foi : elles sont donc indexables
 * partout, avec leurs alternances hreflang. Avant, les versions non francaises
 * servaient du francais en `noindex`.
 */
export async function metadataPageLegale(
  { params }: { params: Promise<{ locale: string }> },
  cle: "cgv" | "mentionsLegales" | "confidentialite",
  chemin: string
): Promise<Metadata> {
  const { locale } = await params;
  const { getTranslations } = await import("next-intl/server");
  const t = await getTranslations({ locale, namespace: `metaPages.${cle}` });
  return metadataPage({ locale, chemin, titre: t("title"), description: t("description") });
}

/**
 * Code de langue OpenGraph. Sans lui, `og:locale` disparait des qu'une page
 * definit son propre bloc `openGraph` — meme regle de fusion que ci-dessus.
 */
export const OG_LOCALE: Record<Locale, string> = {
  fr: "fr_FR",
  en: "en_GB",
  es: "es_ES",
  de: "de_DE",
  it: "it_IT",
  nl: "nl_NL",
  pl: "pl_PL",
  sv: "sv_SE",
  da: "da_DK",
  pt: "pt_PT",
};

/* ── Longueur des titres et descriptions (S-4, 2 octobre 2026) ────────────
   L'audit comptait 307 titres de plus de 60 caracteres et 183 descriptions de
   plus de 160 : Google les coupe, souvent au milieu du mot qui comptait. */

const SUFFIXE_MARQUE = " — Cartoonova";
const TITRE_MAX = 60;
const DESCRIPTION_MAX = 158;

/**
 * Titre de page : sans suffixe de marque deja present (« | Cartoonova »,
 * « — Cartoonova »), puis avec « — Cartoonova » seulement s'il tient dans les
 * 60 caracteres. La marque est utile ; le mot-cle de la page l'est plus.
 */
export function titreSeo(brut: string): string {
  const titre = brut.replace(/\s*[|—–-]\s*Cartoonova\s*$/i, "").trim();
  return titre.length + SUFFIXE_MARQUE.length <= TITRE_MAX ? `${titre}${SUFFIXE_MARQUE}` : titre;
}

/** Coupe un texte au dernier mot entier avant `max` caracteres, avec « … ». */
export function couper(texte: string, max = DESCRIPTION_MAX): string {
  const propre = texte.replace(/\s+/g, " ").trim();
  if (propre.length <= max) return propre;
  const coupe = propre.slice(0, max - 1);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > max * 0.6 ? coupe.slice(0, espace) : coupe).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** Image de partage par defaut (1200x630), pour les pages sans visuel propre. */
export const IMAGE_PARTAGE = `${SITE_URL}/og/cartoonova-1200x630.jpg`;

/**
 * Metadata complete d'une page simple : titre et description a la bonne
 * longueur, alternances de langue, carte de partage avec image.
 *
 * Toute page qui definit `openGraph` remplace en entier celui du layout (fusion
 * superficielle de Next) : 113 pages s'etaient ainsi retrouvees sans image de
 * partage — un lien envoye sur WhatsApp n'affichait que du texte. Passer par
 * cette fonction garantit le bloc complet.
 */
export function metadataPage({
  locale,
  chemin,
  titre,
  description,
  image,
  alternates,
}: {
  locale: string;
  chemin: string;
  titre: string;
  description: string;
  /** URL absolue ; par defaut l'image de la marque. */
  image?: string;
  /** Pour les pages dont le chemin change d'une langue a l'autre. */
  alternates?: Metadata["alternates"];
}): Metadata {
  const title = titreSeo(titre);
  const desc = couper(description);
  const img = image ?? IMAGE_PARTAGE;
  return {
    title,
    description: desc,
    alternates: alternates ?? alternatesPour(locale, chemin),
    openGraph: {
      title,
      description: desc,
      url: urlAbsolue(locale, chemin),
      siteName: "Cartoonova",
      locale: OG_LOCALE[locale as Locale] ?? OG_LOCALE.fr,
      type: "website",
      images: [{ url: img, ...(img === IMAGE_PARTAGE ? { width: 1200, height: 630 } : {}) }],
    },
    twitter: { card: "summary_large_image", title, description: desc, images: [img] },
  };
}
