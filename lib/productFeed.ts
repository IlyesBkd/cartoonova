import { getPricesForCurrency } from "./db";
import { DEFAULT_PRICES_BY_CURRENCY } from "./types";
import type { Currency } from "./currency";
import { currencies } from "./currency";
import { SITE_URL } from "./site";
import { locales as localesList, type Locale } from "../i18n/config";
import {
  CATALOGUE_EN_LIGNE,
  NOMS_CATEGORIE,
  SLUG_PHARE,
  descriptionProduit,
  slugsProduit,
  titreProduit,
} from "./catalogue";
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
  nl: "EUR",
  pl: "PLN",
  sv: "SEK",
  da: "DKK",
  pt: "EUR",
};

// Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork
const GOOGLE_PRODUCT_CATEGORY = "500045";

/* Pays de rattachement d'une langue, pour le bloc `shipping` du flux. Un
   visiteur allemand n'est pas necessairement en Allemagne, mais Merchant Center
   raisonne par pays de vente : c'est a ce niveau que le flux est lu. */
const PAYS_PRINCIPAL: Record<Locale, string> = {
  fr: "FR",
  en: "US",
  es: "ES",
  de: "DE",
  it: "IT",
  nl: "NL",
  pl: "PL",
  sv: "SE",
  da: "DK",
  pt: "PT",
};

/* Pays de rattachement d'une devise. Un flux servi dans une devise autre que
   celle par defaut de sa langue vise un autre pays : `/fr?currency=CHF` est le
   flux suisse, pas le flux francais. Sans cette table, il annoncerait ses frais
   de port pour la France et la Suisse se retrouverait sans livraison declaree —
   soit precisement le motif de refus que l'attribut sert a eviter. */
const PAYS_DE_DEVISE: Record<Currency, string> = {
  EUR: "FR",
  USD: "US",
  GBP: "GB",
  CAD: "CA",
  AUD: "AU",
  PLN: "PL",
  SEK: "SE",
  DKK: "DK",
  CHF: "CH",
};

/* Google plafonne a 10 images additionnelles par article. */
const MAX_IMAGES_ADDITIONNELLES = 10;

export interface FeedProduct {
  id: string;
  /** Slug canonique — identite du produit, nom du dossier de visuels. */
  slug: string;
  /** Slug d'URL par langue. Il differe du canonique hors francais pour les
   *  fiches au nom francais ; voir `slugProduit` dans lib/catalogue.ts. */
  slugs: Record<Locale, string>;
  image: string;
  /** Galerie complete. `image` en est la premiere ; les suivantes partent en
   *  `additional_image_link`. */
  galerie: string[];
  categorie: string;
  /** Fiche attendue a l'essentiel des ventes. Etiquetee a part pour pouvoir
   *  etre suivie seule dans les rapports Merchant. */
  phare: boolean;
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
    const galerie = visuelsProduit(p.slug).galerie;
    const image = galerie[0];
    if (!image) return [];
    return [
      {
        id: p.idProduit,
        slug: p.slug,
        slugs: slugsProduit(p),
        image,
        galerie,
        categorie: p.categorie,
        phare: p.slug === SLUG_PHARE,
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

  /* Livraison declaree a zero : le tunnel de paiement n'ajoute aucun frais de
     port (aucun `shipping_options` dans la session Stripe), le port est donc
     compris dans le prix. Sans cet attribut, Merchant Center retombe sur les
     regles du compte et desapprouve les articles tant qu'aucune n'est definie —
     c'est le motif de rejet le plus courant a l'ouverture d'un flux. */
  /* La langue designe le pays tant que la devise est celle attendue pour elle ;
     des qu'elle est forcee, c'est la devise qui dit ou le flux est lu. */
  const paysCible =
    currency === FEED_DEFAULT_CURRENCY[locale] ? PAYS_PRINCIPAL[locale] : PAYS_DE_DEVISE[currency];

  const shipping =
    variant === "google"
      ? `
      <g:shipping>
        <g:country>${paysCible}</g:country>
        <g:service>Standard</g:service>
        <g:price>0.00 ${currency}</g:price>
      </g:shipping>`
      : "";

  const items = buildFeedProducts().map((product) => {
    const { title, description } = product.translations[locale];

    /* Les visuels supplementaires ne servent pas qu'a decorer : sur Shopping,
       une fiche a plusieurs images occupe plus de place et se compare mieux.
       Le produit *est* une image, autant les montrer toutes. */
    const imagesAdditionnelles = product.galerie
      .slice(1, 1 + MAX_IMAGES_ADDITIONNELLES)
      .map((v) => `\n      <g:additional_image_link>${escapeXml(`${SITE_URL}${v}`)}</g:additional_image_link>`)
      .join("");

    /* `product_type` est notre propre taxonomie, distincte de celle de Google :
       elle sert au regroupement dans les campagnes et les rapports. Le nom de
       categorie est deja traduit ; lui prefixer un intitule francais donnerait
       un libelle bilingue dans les rapports de chaque marche. */
    const typeProduit = NOMS_CATEGORIE[product.categorie as keyof typeof NOMS_CATEGORIE][locale];

    return `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(title)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(`${SITE_URL}/${locale}/${product.slugs[locale]}`)}</g:link>
      <g:image_link>${escapeXml(`${SITE_URL}${product.image}`)}</g:image_link>${imagesAdditionnelles}
      <g:price>${formattedPrice}</g:price>
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>
      <g:brand>Cartoonova</g:brand>
      <g:google_product_category>${GOOGLE_PRODUCT_CATEGORY}</g:google_product_category>
      <g:product_type>${escapeXml(typeProduit)}</g:product_type>
      <g:is_customized>yes</g:is_customized>
      <g:identifier_exists>no</g:identifier_exists>
      <g:custom_label_0>${escapeXml(product.categorie)}</g:custom_label_0>
      <g:custom_label_1>${product.phare ? "phare" : "catalogue"}</g:custom_label_1>${shipping}
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
