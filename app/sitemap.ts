import { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";
import { getAllPublishedArticleRefs } from "@/lib/blogDb";

const baseUrl = "https://www.cartoonova.com";

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface PageDef {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

const pages: PageDef[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.95 },
  { path: "/simpson", changeFrequency: "weekly", priority: 0.9 },
  { path: "/onepiece", changeFrequency: "weekly", priority: 0.9 },
  { path: "/dbz", changeFrequency: "weekly", priority: 0.9 },
  { path: "/ghibli", changeFrequency: "weekly", priority: 0.9 },
  { path: "/rickandmorty", changeFrequency: "weekly", priority: 0.9 },
  { path: "/disney", changeFrequency: "weekly", priority: 0.9 },
  { path: "/portrait-personnalise-cartoon", changeFrequency: "weekly", priority: 0.85 },
  { path: "/blog", changeFrequency: "daily", priority: 0.8 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/a-propos", changeFrequency: "yearly", priority: 0.4 },
  { path: "/cgv", changeFrequency: "yearly", priority: 0.3 },
  { path: "/mentions-legales", changeFrequency: "yearly", priority: 0.3 },
  { path: "/politique-de-confidentialite", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of locales) {
      entries.push({
        url: `${baseUrl}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${baseUrl}/${l}${page.path}`])
          ),
        },
      });
    }
  }

  const articles = await getAllPublishedArticleRefs().catch(() => []);
  for (const article of articles) {
    entries.push({
      url: `${baseUrl}/${article.locale}/blog/${article.slug}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}
