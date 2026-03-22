import { NextRequest, NextResponse } from "next/server";

// Matrice de prix fixe pour éviter les discordances Google Merchant Center
const PRICE_MATRIX = {
  // Locales européennes
  fr: { currency: "EUR", price: "39.00", sale_price: "19.00" },
  de: { currency: "EUR", price: "39.00", sale_price: "19.00" },
  es: { currency: "EUR", price: "39.00", sale_price: "19.00" },
  it: { currency: "EUR", price: "39.00", sale_price: "19.00" },
  // Locale anglophone
  en: { currency: "USD", price: "45.00", sale_price: "21.00" },
} as const;

// Traductions pour le produit
const PRODUCT_TRANSLATIONS = {
  fr: {
    title: "Portrait Simpson Personnalisé",
    description: "Transformez votre photo en une magnifique caricature dessinée à la main. Le cadeau idéal !",
  },
  en: {
    title: "Custom Simpson Portrait",
    description: "Transform your photo into a beautiful hand-drawn caricature. The perfect gift!",
  },
  de: {
    title: "Personalisiertes Simpson Porträt",
    description: "Verwandeln Sie Ihr Foto in eine wunderschöne handgezeichnete Karikatur. Das perfekte Geschenk!",
  },
  es: {
    title: "Retrato Simpson Personalizado",
    description: "Transforma tu foto en una hermosa caricatura dibujada a mano. ¡El regalo perfecto!",
  },
  it: {
    title: "Ritratto Simpson Personalizzato",
    description: "Trasforma la tua foto in una bellissima caricatura disegnata a mano. Il regalo perfetto!",
  },
} as const;

type Locale = keyof typeof PRICE_MATRIX;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;

  // Validation de la locale
  if (!PRICE_MATRIX[locale]) {
    return new NextResponse("Invalid locale", { status: 400 });
  }

  const { currency, price, sale_price } = PRICE_MATRIX[locale];
  const { title, description } = PRODUCT_TRANSLATIONS[locale];

  const baseUrl = "https://www.cartoonova.com";
  const productUrl = `${baseUrl}/${locale}/simpson`;
  const imageUrl = `${baseUrl}/simpson_photos_produit/0009_1.jpg`;

  // Génération du flux XML RSS 2.0 conforme Google Merchant Center
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Cartoonova - ${title}</title>
    <link>${baseUrl}/${locale}</link>
    <description>Caricatures personnalisées style Simpson</description>
    <item>
      <g:id>cartoonova-simpson-base</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${productUrl}</g:link>
      <g:image_link>${imageUrl}</g:image_link>
      <g:price>${price} ${currency}</g:price>
      <g:sale_price>${sale_price} ${currency}</g:sale_price>
      <g:condition>new</g:condition>
      <g:availability>in_stock</g:availability>
      <g:brand>Cartoonova</g:brand>
      <g:is_customized>yes</g:is_customized>
      <g:identifier_exists>no</g:identifier_exists>
    </item>
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
