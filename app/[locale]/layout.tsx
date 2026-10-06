import type { Metadata } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";
import CurrencyProvider from "@/components/CurrencyProvider";
import PostHogProvider from "@/components/PostHogProvider";
import LayoutShell from "@/components/LayoutShell";
import { CATALOGUE_EN_LIGNE } from "@/lib/catalogue";
import { vignetteProduit } from "@/lib/visuels";
import { evenementAffiche } from "@/lib/evenements";
import { SITE_URL } from "@/lib/site";
import { IMAGE_PARTAGE, OG_LOCALE, alternatesPour } from "@/lib/seo";
import { GOOGLE_ADS_ACTIF, GOOGLE_ADS_ID } from "@/lib/googleAds";
import { META_PIXEL_ID } from "@/lib/metaPixel";
import "../globals.css";

/* Mise en page racine du site. Elle l'est devenue le 2 octobre 2026 : la
   precedente (`app/layout.tsx`, desormais `app/(hors-langue)/layout.tsx`)
   lisait la langue dans les en-tetes de la requete pour remplir
   `<html lang>`, et ce seul appel rendait toutes les pages dynamiques. Rien
   n'etait mis en cache : chaque visite reconstruisait la page et rouvrait le
   tunnel vers la base (7 a 18 s mesures a froid). Ici, la langue vient du
   chemin, connu a la construction : les pages sont statiques, servies par le
   CDN et regenerees en arriere-plan.

   Regle qui en decoule : aucune API de requete (`headers()`, `cookies()`)
   sous `[locale]`, sauf dans une page qui accepte d'etre dynamique. La devise
   du visiteur est posee en cookie par `proxy.ts` et lue cote client par
   `CurrencyProvider`. */

/* Au plus une heure entre deux regenerations, pour toutes les pages : le temps
   fort affiche (`evenementAffiche`) depend de la date, et une page fixe comme
   /contact n'aurait sinon jamais ete reconstruite avant le deploiement suivant.
   Une page peut descendre plus bas (le blog a 5 min). */
export const revalidate = 3600;
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
      // Image de la marque : un lien vers l'accueil partage sans visuel sinon.
      images: [{ url: IMAGE_PARTAGE, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: [IMAGE_PARTAGE],
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
    /* Revendication du domaine chez Pinterest, a garder en place : Pinterest la
       reverifie periodiquement. Les routes hors langue la portent aussi. */
    verification: {
      other: { "p:domain_verify": "ff0cf4c9c801e4e24e2cef418cee0b49" },
    },
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

  // Sans cet appel, next-intl relit la langue dans les en-tetes : page dynamique.
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <head>
        {/* Les deux seules fontes du premier ecran : Kefir 800 porte h1/h2/h3,
            Rebond 500 le corps de texte. Atma decalait la page tant qu'elle
            n'etait pas prechargee (le h1 se recomposait, 29 px de saut). */}
        <link rel="preload" href="/polices/kefir-800.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/polices/rebond-500.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/polices/atma-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {/* Google Ads — gtag.js, coupe tant qu'aucune campagne ne tourne (lib/googleAds.ts) */}
        {GOOGLE_ADS_ACTIF && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`} strategy="afterInteractive" />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GOOGLE_ADS_ID}');
              `}
            </Script>
          </>
        )}

        {/* Meta Pixel — inactif tant que NEXT_PUBLIC_META_PIXEL_ID n'est pas defini */}
        {META_PIXEL_ID && (
          <>
            <Script id="meta-pixel-init" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${META_PIXEL_ID}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}

        <PostHogProvider>
          <NextIntlClientProvider messages={messages}>
            <CurrencyProvider locale={locale}>
              {/* Temps fort du moment : calcule a la generation de la page (au
                  plus une heure d'ecart, voir `revalidate`), et la date limite
                  arrive deja formatee — la formater cote client ferait dependre
                  le rendu des donnees ICU du navigateur. */}
              <LayoutShell vignettes={VIGNETTES_MENU} evenement={evenementAffiche(locale as Locale)}>
                {children}
              </LayoutShell>
            </CurrencyProvider>
          </NextIntlClientProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
