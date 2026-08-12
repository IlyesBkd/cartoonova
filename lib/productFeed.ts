import { getPricesForCurrency } from "./db";
import { DEFAULT_PRICES_BY_CURRENCY } from "./types";
import type { Currency } from "./currency";
import { currencies } from "./currency";
import { SITE_URL } from "./site";
import type { Locale } from "../i18n/config";

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
  slug: string;
  image: string;
  translations: Record<Locale, { title: string; description: string }>;
}

export const FEED_PRODUCTS: FeedProduct[] = [
  {
    id: "cartoonova-simpson-base",
    slug: "simpson",
    image: "/simpson_photos_produit/0009_1.jpg",
    translations: {
      fr: { title: "Portrait Simpson Personnalisé", description: "Transformez votre photo en une magnifique caricature Simpson dessinée à la main. Le cadeau idéal !" },
      en: { title: "Custom Simpson Portrait", description: "Transform your photo into a beautiful hand-drawn Simpson caricature. The perfect gift!" },
      de: { title: "Personalisiertes Simpson Porträt", description: "Verwandeln Sie Ihr Foto in eine wunderschöne handgezeichnete Simpson-Karikatur. Das perfekte Geschenk!" },
      es: { title: "Retrato Simpson Personalizado", description: "Transforma tu foto en una hermosa caricatura Simpson dibujada a mano. ¡El regalo perfecto!" },
      it: { title: "Ritratto Simpson Personalizzato", description: "Trasforma la tua foto in una bellissima caricatura Simpson disegnata a mano. Il regalo perfetto!" },
    },
  },
  {
    id: "cartoonova-onepiece-wanted",
    slug: "onepiece",
    image: "/onepiece/wanted_produit/il_1140xN.7027231626_qn94.png",
    translations: {
      fr: { title: "Poster Wanted One Piece Personnalisé", description: "Créez votre propre avis de recherche One Piece ! Devenez un pirate légendaire avec votre prime personnalisée." },
      en: { title: "Custom One Piece Wanted Poster", description: "Create your own One Piece wanted poster! Become a legendary pirate with your custom bounty." },
      de: { title: "Personalisiertes One Piece Wanted Poster", description: "Erstellen Sie Ihr eigenes One Piece Steckbrief! Werden Sie ein legendärer Pirat mit Ihrem persönlichen Kopfgeld." },
      es: { title: "Póster Wanted One Piece Personalizado", description: "¡Crea tu propio cartel de búsqueda One Piece! Conviértete en un pirata legendario con tu recompensa personalizada." },
      it: { title: "Poster Wanted One Piece Personalizzato", description: "Crea il tuo poster ricercato One Piece! Diventa un pirata leggendario con la tua taglia personalizzata." },
    },
  },
  {
    id: "cartoonova-dbz-portrait",
    slug: "dbz",
    image: "/DBZ/Photo_produits/1.png",
    translations: {
      fr: { title: "Portrait Dragon Ball Z Personnalisé", description: "Transformez-vous en Super Saiyan ! Portrait personnalisé dans le style Dragon Ball Z dessiné à la main." },
      en: { title: "Custom Dragon Ball Z Portrait", description: "Transform into a Super Saiyan! Custom portrait in Dragon Ball Z style, hand-drawn." },
      de: { title: "Personalisiertes Dragon Ball Z Porträt", description: "Verwandeln Sie sich in einen Super-Saiyajin! Handgezeichnetes Portrait im Dragon Ball Z Stil." },
      es: { title: "Retrato Dragon Ball Z Personalizado", description: "¡Transfórmate en Super Saiyan! Retrato personalizado estilo Dragon Ball Z dibujado a mano." },
      it: { title: "Ritratto Dragon Ball Z Personalizzato", description: "Trasformati in Super Saiyan! Ritratto personalizzato in stile Dragon Ball Z disegnato a mano." },
    },
  },
  {
    id: "cartoonova-ghibli-portrait",
    slug: "ghibli",
    image: "/Ghibli/Photo_produits/il_794xN.7001686030_jbst.png",
    translations: {
      fr: { title: "Portrait Studio Ghibli Personnalisé", description: "Entrez dans l'univers enchanté de Ghibli ! Portrait magique inspiré de Totoro, Chihiro et Mononoké." },
      en: { title: "Custom Studio Ghibli Portrait", description: "Enter the enchanted world of Ghibli! Magical portrait inspired by Totoro, Spirited Away and Mononoke." },
      de: { title: "Personalisiertes Studio Ghibli Porträt", description: "Betreten Sie die verzauberte Welt von Ghibli! Magisches Portrait inspiriert von Totoro, Chihiro und Mononoke." },
      es: { title: "Retrato Studio Ghibli Personalizado", description: "¡Entra en el mundo encantado de Ghibli! Retrato mágico inspirado en Totoro, Chihiro y Mononoke." },
      it: { title: "Ritratto Studio Ghibli Personalizzato", description: "Entra nel mondo incantato di Ghibli! Ritratto magico ispirato a Totoro, Chihiro e Mononoke." },
    },
  },
  {
    id: "cartoonova-rickandmorty-portrait",
    slug: "rickandmorty",
    image: "/rickandmorty/Photo_produits/1.png",
    translations: {
      fr: { title: "Portrait Rick & Morty Personnalisé", description: "Wubba Lubba Dub Dub ! Rejoignez Rick et Morty dans leurs aventures interdimensionnelles avec votre portrait." },
      en: { title: "Custom Rick & Morty Portrait", description: "Wubba Lubba Dub Dub! Join Rick and Morty in their interdimensional adventures with your portrait." },
      de: { title: "Personalisiertes Rick & Morty Porträt", description: "Wubba Lubba Dub Dub! Begleiten Sie Rick und Morty auf ihren interdimensionalen Abenteuern mit Ihrem Portrait." },
      es: { title: "Retrato Rick & Morty Personalizado", description: "¡Wubba Lubba Dub Dub! Únete a Rick y Morty en sus aventuras interdimensionales con tu retrato." },
      it: { title: "Ritratto Rick & Morty Personalizzato", description: "Wubba Lubba Dub Dub! Unisciti a Rick e Morty nelle loro avventure interdimensionali con il tuo ritratto." },
    },
  },
  {
    id: "cartoonova-disney-portrait",
    slug: "disney",
    image: "/Disney/Photo_produits/1.png",
    translations: {
      fr: { title: "Portrait Disney Personnalisé", description: "Devenez le héros de votre propre conte de fées Disney ! Portrait magique style animation classique." },
      en: { title: "Custom Disney Portrait", description: "Become the hero of your own Disney fairy tale! Magical portrait in classic animation style." },
      de: { title: "Personalisiertes Disney Porträt", description: "Werden Sie der Held Ihres eigenen Disney-Märchens! Magisches Portrait im klassischen Animationsstil." },
      es: { title: "Retrato Disney Personalizado", description: "¡Conviértete en el héroe de tu propio cuento de hadas Disney! Retrato mágico estilo animación clásica." },
      it: { title: "Ritratto Disney Personalizzato", description: "Diventa l'eroe della tua fiaba Disney! Ritratto magico in stile animazione classica." },
    },
  },
];

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

  const items = FEED_PRODUCTS.map((product) => {
    const { title, description } = product.translations[locale];
    return `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(title)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(`${SITE_URL}/${locale}/${product.slug}`)}</g:link>
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
