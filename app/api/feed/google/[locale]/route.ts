import { NextRequest, NextResponse } from "next/server";

// Fonction utilitaire pour échapper les caractères spéciaux XML
const escapeXml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Matrice de prix fixe pour éviter les discordances Google Merchant Center
const PRICE_MATRIX = {
  fr: { currency: "EUR", price: "29.00", sale_price: "14.00" },
  de: { currency: "EUR", price: "29.00", sale_price: "14.00" },
  es: { currency: "EUR", price: "29.00", sale_price: "14.00" },
  it: { currency: "EUR", price: "29.00", sale_price: "14.00" },
  en: { currency: "USD", price: "32.00", sale_price: "15.00" },
} as const;

type Locale = keyof typeof PRICE_MATRIX;

// Définition des 6 produits
interface Product {
  id: string;
  slug: string;
  image: string;
  translations: Record<Locale, { title: string; description: string }>;
}

const PRODUCTS: Product[] = [
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
    image: "/onepiece/wanted_produits/1.png",
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;

  if (!PRICE_MATRIX[locale]) {
    return new NextResponse("Invalid locale", { status: 400 });
  }

  const { currency, price, sale_price } = PRICE_MATRIX[locale];
  const baseUrl = "https://www.cartoonova.com";

  // Génération des items XML pour chaque produit
  const items = PRODUCTS.map((product) => {
    const { title, description } = product.translations[locale];
    const productUrl = `${baseUrl}/${locale}/${product.slug}`;
    const imageUrl = `${baseUrl}${product.image}`;

    return `    <item>
      <g:id>${escapeXml(product.id)}</g:id>
      <g:title>${escapeXml(title)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(productUrl)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
      <g:price>${price} ${currency}</g:price>
      <g:sale_price>${sale_price} ${currency}</g:sale_price>
      <g:condition>new</g:condition>
      <g:availability>in_stock</g:availability>
      <g:brand>Cartoonova</g:brand>
      <g:is_customized>yes</g:is_customized>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Cartoonova - Portraits Personnalisés</title>
    <link>${baseUrl}/${locale}</link>
    <description>Portraits personnalisés style cartoon - Simpson, One Piece, DBZ, Ghibli, Rick &amp; Morty, Disney</description>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
