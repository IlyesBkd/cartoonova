import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";
import CurrencyProvider from "@/components/CurrencyProvider";
import ChatWidget from "@/components/ChatWidget";
import PostHogProvider from "@/components/PostHogProvider";
import "../globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const baseUrl = "https://cartoonova.fr";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  const alternateLanguages: Record<string, string> = {};
  for (const l of locales) {
    alternateLanguages[l] = l === "fr" ? baseUrl : `${baseUrl}/${l}`;
  }

  return {
    title: t("title"),
    description: t("description"),
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: locale === "fr" ? "/" : `/${locale}`,
      languages: {
        ...alternateLanguages,
        "x-default": baseUrl,
      },
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: locale === "fr" ? baseUrl : `${baseUrl}/${locale}`,
      siteName: "Cartoonova",
      locale: locale === "fr" ? "fr_FR" : locale === "en" ? "en_GB" : locale === "es" ? "es_ES" : locale === "de" ? "de_DE" : "it_IT",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    // Favicon handled by app/icon.png (Next.js file convention)
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${poppins.variable} antialiased`}>
      <body>
        <PostHogProvider>
          <NextIntlClientProvider messages={messages}>
            <CurrencyProvider locale={locale}>
              {children}
              <ChatWidget />
            </CurrencyProvider>
          </NextIntlClientProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
