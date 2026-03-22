import { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";

const baseUrl = "https://cartoonova.fr";

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface PageDef {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

const pages: PageDef[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/product", changeFrequency: "weekly", priority: 0.9 },
  { path: "/portrait-personnalise-cartoon", changeFrequency: "weekly", priority: 0.85 },
  { path: "/portfolio", changeFrequency: "monthly", priority: 0.7 },
  { path: "/avis", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/a-propos", changeFrequency: "yearly", priority: 0.4 },
  { path: "/cgv", changeFrequency: "yearly", priority: 0.3 },
  { path: "/mentions-legales", changeFrequency: "yearly", priority: 0.3 },
  { path: "/politique-de-confidentialite", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of locales) {
      const prefix = locale === defaultLocale ? "" : `/${locale}`;
      entries.push({
        url: `${baseUrl}${prefix}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [
              l,
              `${baseUrl}${l === defaultLocale ? "" : `/${l}`}${page.path}`,
            ])
          ),
        },
      });
    }
  }

  return entries;
}
