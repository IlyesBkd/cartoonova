import { getPricesForCurrency } from "./db";
import { DEFAULT_PRICES_BY_CURRENCY } from "./types";
import type { Currency } from "./currency";
import { currencies } from "./currency";
import { SITE_URL } from "./site";
import { locales as localesList, type Locale } from "../i18n/config";
import { CATALOGUE_EN_LIGNE, descriptionProduit, slugsProduit, titreProduit } from "./catalogue";
import { visuelsProduit } from "./visuels";

export const escapeXml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Devise par defaut d'un flux. Le prix affiche sur le site depend du pays du
// visiteur, pas de la langue : pour un ciblage par pays, generer un flux par
// devise via ?currency=GBP plutot que de changer ces valeurs.
export const FEED_DEFAULT_CURRENCY: Record<Locale, Currency> = {
  fr: "EUR",
  es: "EUR",
  de: "EUR",
  it: "EUR",
  en: "USD",
};

// Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork
const GOOGLE_PRODUCT_CATEGORY = "500045";

export interface FeedProduct {
  id: string;
  /** Slug canonique — identite du produit, nom du dossier de visuels. */
  slug: string;
  /** Slug d'URL par langue. Il differe du canonique hors francais pour les
   *  fiches au nom francais ; voir `slugProduit` dans lib/catalogue.ts. */
  slugs: Record<Locale, string>;
  image: string;
  translations: Record<Locale, { title: string; description: string }>;
}

/**
 * Le flux est derive du catalogue : ajouter un produit dans `lib/catalogue.ts`
 * suffit a le faire apparaitre chez Google et Pinterest.
 *
 * Seules les fiches ayant au moins un visuel entrent dans le flux : Merchant
 * Center rejette un article sans `image_link`, et un rejet repete degrade la
 * sante du compte. Les fiches sans photo apparaissent donc sur le site mais
 * pas dans le flux, jusqu'a ce que leurs visuels soient deposes.
 */
export function buildFeedProducts(): FeedProduct[] {
  return CATALOGUE_EN_LIGNE.flatMap((p) => {
    const image = visuelsProduit(p.slug).galerie[0];
    if (!image) return [];
    return [
      {
        id: p.idProduit,
        slug: p.slug,
        slugs: slugsProduit(p),
        image,
        translations: Object.fromEntries(
          localesList.map((l) => [
            l,
            { title: titreProduit(p, l), description: descriptionProduit(p, l) },
          ])
        ) as Record<Locale, { title: string; description: string }>,
      },
    ];
  });
}

/**
 * Liste figee au chargement du module, pour les appelants qui ont besoin d'une
 * constante (pages cadeau, generation de slugs).
 *
 * Elle ne contient que les fiches pourvues de visuels — c'est voulu au-dela du
 * flux : une page « cadeau » sans photo du produit ne se vend pas, et 30
 * occasions x 30 fiches vides feraient mille pages minces. Deposer les visuels
 * d'un style l'y fait entrer automatiquement.
 */
export const FEED_PRODUCTS: FeedProduct[] = buildFeedProducts();

/**
 * Sous-ensemble servant les pages « un style pour une occasion ».
 *
 * Volontairement plus etroit que le flux. Ces pages croisent un style et une
 * occasion : leur nombre est un produit, pas une somme. A 36 styles elles
 * passent de 180 a 1 080 pages qui ne different que par le nom du style —
 * exactement le profil que Google traite en pages satellites. Le flux
 * Merchant, lui, gagne a contenir tout le catalogue : aucune raison de le
 * limiter.
 *
 * Restreint ici aux six univers dont Cartoonova possede les photos. Pour
 * elargir, ajouter des slugs — en gardant a l'esprit que chaque slug ajoute
 * 30 pages.
 */
const SLUGS_CADEAU = ["simpson", "dbz", "disney", "ghibli", "onepiece", "rickandmorty"];

export const GIFT_PRODUCTS: FeedProduct[] = FEED_PRODUCTS.filter((p) =>
  SLUGS_CADEAU.includes(p.slug)
);

export function parseCurrency(raw: string | null, locale: Locale): Currency {
  if (raw && (currencies as string[]).includes(raw.toUpperCase())) {
    return raw.toUpperCase() as Currency;
  }
  return FEED_DEFAULT_CURRENCY[locale];
}

/**
 * Prix annonce dans le flux : le prix de depart d'un portrait, celui qu'un
 * visiteur voit sur la page produit. Il vient de la base, jamais d'une valeur
 * figee — un ecart entre le flux et la page fait suspendre un compte Merchant.
 */
async function getFeedPrice(currency: Currency): Promise<number> {
  try {
    const prices = await getPricesForCurrency(currency);
    return prices.base;
  } catch (error) {
    console.error("[productFeed] lecture des prix impossible, repli sur les valeurs par defaut:", error);
    return DEFAULT_PRICES_BY_CURRENCY[currency].base;
  }
}

export type FeedVariant = "google" | "pinterest";

export async function buildProductFeed({
  locale,
  currency,
  variant,
}: {
  locale: Locale;
  currency: Currency;
  variant: FeedVariant;
}): Promise<string> {
  const price = await getFeedPrice(currency);
  const formattedPrice = `${price.toFixed(2)} ${currency}`;
  // Google accepte les deux graphies, Pinterest exige "in stock".
  const availability = variant === "pinterest" ? "in stock" : "in_stock";

  const items = buildFeedProducts().map((product) => {
    const { title, description } = product.translations[locale];
    return `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(title)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(`${SITE_URL}/${locale}/${product.slugs[locale]}`)}</g:link>
      <g:image_link>${escapeXml(`${SITE_URL}${product.image}`)}</g:image_link>
      <g:price>${formattedPrice}</g:price>
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>
      <g:brand>Cartoonova</g:brand>
      <g:google_product_category>${GOOGLE_PRODUCT_CATEGORY}</g:google_product_category>
      <g:is_customized>yes</g:is_customized>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Cartoonova - Portraits Personnalisés</title>
    <link>${SITE_URL}/${locale}</link>
    <description>Portraits personnalisés style cartoon - Simpson, One Piece, DBZ, Ghibli, Rick &amp; Morty, Disney</description>
${items}
  </channel>
</rss>`;
}
