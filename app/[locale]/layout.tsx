import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";
import CurrencyProvider from "@/components/CurrencyProvider";
import PostHogProvider from "@/components/PostHogProvider";
import LayoutShell from "@/components/LayoutShell";
import { getCurrencyFromCountry } from "@/lib/currency";
import { CATALOGUE_EN_LIGNE } from "@/lib/catalogue";
import { vignetteProduit } from "@/lib/visuels";
import { evenementAffiche } from "@/lib/evenements";
import { SITE_URL } from "@/lib/site";
import { OG_LOCALE, alternatesPour } from "@/lib/seo";

const baseUrl = SITE_URL;

/* Vignettes des menus deroulants de l'en-tete. `vignetteProduit` lit `public/`
   au rendu : c'est un module serveur, la Navbar est un composant client. La
   table est donc calculee ici, une seule fois au chargement du module, et
   descendue en propriete jusqu'a la barre de navigation. */
const VIGNETTES_MENU: Record<string, string> = Object.fromEntries(
  CATALOGUE_EN_LIGNE.map((p) => [p.slug, vignetteProduit(p.slug)] as const).filter(
    (paire): paire is readonly [string, string] => Boolean(paire[1])
  )
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("title"),
    description: t("description"),
    metadataBase: new URL(baseUrl),
    /* Vaut pour l'accueil, et pour l'accueil seulement. Toute page enfant doit
       redefinir son propre bloc via `alternatesPour` — sans quoi elle herite de
       celui-ci et se canonicalise ici. */
    alternates: alternatesPour(locale, ""),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: `${baseUrl}/${locale}`,
      siteName: "Cartoonova",
      locale: OG_LOCALE[locale as Locale] ?? OG_LOCALE.fr,
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
    icons: {
      icon: [
        { url: "/favicon_io/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon_io/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon_io/favicon.ico", sizes: "any" },
      ],
      apple: [
        { url: "/favicon_io/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      ],
    },
    manifest: "/favicon_io/site.webmanifest",
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

  const country = (await headers()).get("x-vercel-ip-country");
  const initialCurrency = getCurrencyFromCountry(country);

  return (
    <PostHogProvider>
      <NextIntlClientProvider messages={messages}>
        <CurrencyProvider locale={locale} initialCurrency={initialCurrency}>
          {/* Temps fort du moment, calcule ici et non dans la barre promo :
              toutes les routes /[locale] sont rendues a la demande (ƒ), la
              valeur est donc toujours celle du jour, et la date limite arrive
              deja formatee — la formater cote client ferait dependre le rendu
              des donnees ICU du navigateur et l'hydratation divergerait. */}
          <LayoutShell vignettes={VIGNETTES_MENU} evenement={evenementAffiche(locale as Locale)}>
            {children}
          </LayoutShell>
        </CurrencyProvider>
      </NextIntlClientProvider>
    </PostHogProvider>
  );
}
