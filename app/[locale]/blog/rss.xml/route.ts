import { NextResponse } from "next/server";
import { getPublishedArticles } from "@/lib/blogDb";
import { escapeXml } from "@/lib/productFeed";
import { SITE_URL } from "@/lib/site";
import { locales, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

const CHANNEL_TITLE: Record<Locale, string> = {
  fr: "Le blog Cartoonova",
  en: "The Cartoonova blog",
  es: "El blog de Cartoonova",
  de: "Der Cartoonova-Blog",
  it: "Il blog di Cartoonova",
  nl: "Het Cartoonova-blog",
  pl: "Blog Cartoonova",
  sv: "Cartoonova-bloggen",
  da: "Cartoonova-bloggen",
  pt: "O blog da Cartoonova",
};

const CHANNEL_DESCRIPTION: Record<Locale, string> = {
  fr: "Idées cadeaux, portraits dessinés à la main et coulisses de l'atelier Cartoonova.",
  en: "Gift ideas, hand-drawn portraits and behind the scenes at the Cartoonova studio.",
  es: "Ideas de regalo, retratos dibujados a mano y entre bastidores del taller Cartoonova.",
  de: "Geschenkideen, handgezeichnete Portraits und Einblicke in das Cartoonova-Atelier.",
  it: "Idee regalo, ritratti disegnati a mano e dietro le quinte dell'atelier Cartoonova.",
  nl: "Cadeau-ideeën, handgetekende portretten en een kijkje achter de schermen bij Cartoonova.",
  pl: "Pomysły na prezent, ręcznie rysowane portrety i kulisy pracowni Cartoonova.",
  sv: "Presenttips, handritade porträtt och en titt bakom kulisserna hos Cartoonova.",
  da: "Gaveidéer, håndtegnede portrætter og et kig bag kulisserne hos Cartoonova.",
  pt: "Ideias de prenda, retratos desenhados à mão e os bastidores do atelier Cartoonova.",
};

const LANGUAGE_TAG: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  nl: "nl-NL",
  pl: "pl-PL",
  sv: "sv-SE",
  da: "da-DK",
  pt: "pt-PT",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale: rawLocale } = await params;

  if (!(locales as readonly string[]).includes(rawLocale)) {
    return new NextResponse("Invalid locale", { status: 400 });
  }
  const locale = rawLocale as Locale;

  const articles = await getPublishedArticles(locale, 50).catch((error) => {
    console.error("[rss.xml] lecture des articles impossible:", error);
    return [];
  });

  const feedUrl = `${SITE_URL}/${locale}/blog/rss.xml`;
  const blogUrl = `${SITE_URL}/${locale}/blog`;

  const items = articles
    .map((article) => {
      const url = `${SITE_URL}/${locale}/blog/${article.slug}`;
      const image = article.images?.[0];
      const enclosure = image
        ? `\n      <enclosure url="${escapeXml(image.url)}" type="image/jpeg" length="0" />`
        : "";

      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(article.excerpt)}</description>
      <category>${escapeXml(article.category)}</category>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>${enclosure}
    </item>`;
    })
    .join("\n");

  const lastBuild = articles[0]
    ? new Date(articles[0].publishedAt).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(CHANNEL_TITLE[locale])}</title>
    <link>${blogUrl}</link>
    <description>${escapeXml(CHANNEL_DESCRIPTION[locale])}</description>
    <language>${LANGUAGE_TAG[locale]}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}
