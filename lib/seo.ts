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
 * Leur corps est redige en francais et l'est reste dans les cinq langues. Deux
 * facons de traiter ca : traduire, ou ne pas faire passer du francais pour de
 * l'allemand. Traduire des CGV n'est pas un travail d'ingenierie — une clause
 * mal rendue engage la societe — donc les versions non francaises passent en
 * `noindex, follow` en attendant une traduction professionnelle.
 *
 * Consequence assumee : pas de `hreflang` sur ces pages. Annoncer une version
 * allemande que l'on demande a Google de ne pas indexer serait contradictoire.
 * Le canonical reste sur la page elle-meme, et `follow` laisse circuler le
 * maillage vers le reste du site.
 *
 * Ces pages ne sont de toute facon pas des actifs SEO : le releve du
 * 2026-08-17 les montre positionnees sur le numero RCS de la societe.
 */
export async function metadataPageLegale(
  { params }: { params: Promise<{ locale: string }> },
  cle: "cgv" | "mentionsLegales" | "confidentialite",
  chemin: string
): Promise<Metadata> {
  const { locale } = await params;
  const { getTranslations } = await import("next-intl/server");
  const t = await getTranslations({ locale, namespace: `metaPages.${cle}` });

  const indexable = locale === "fr";

  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: urlAbsolue(locale, chemin) },
    robots: {
      index: indexable,
      follow: true,
      googleBot: { index: indexable, follow: true },
    },
  };
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
};
