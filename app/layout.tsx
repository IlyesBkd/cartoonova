import Script from "next/script";
import { headers } from "next/headers";
import { GOOGLE_ADS_ID } from "@/lib/googleAds";
import { META_PIXEL_ID } from "@/lib/metaPixel";
import { locales, defaultLocale } from "@/i18n/config";
import "./globals.css";

/* En-tete pose par le middleware next-intl sur la requete transmise. C'est la
   meme source que celle lue par `getRequestLocale` a l'interieur de la
   bibliotheque — on ne devine pas la langue, on lit sa decision.

   Les routes hors `[locale]` (/success, /suivi, /confirm-poster) sont exclues
   du middleware par `proxy.ts` : l'en-tete y est absent et on retombe sur la
   langue par defaut, ce qui etait deja le comportement. */
const EN_TETE_LANGUE = "X-NEXT-INTL-LOCALE";

async function langueDeLaRequete(): Promise<string> {
  const brut = (await headers()).get(EN_TETE_LANGUE);
  return brut && (locales as readonly string[]).includes(brut) ? brut : defaultLocale;
}

// Les trois familles du système ToonJaune (Kefir, Rebond, Atma) sont servies
// depuis /public/polices via @font-face dans toonjaune.css. Plus de police
// Google : elles définissaient l'ancien design.

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const langue = await langueDeLaRequete();

  return (
    <html lang={langue}>
      <head>
        {/* Les deux seules fontes du premier ecran : Kefir 800 porte h1/h2/h3,
            Rebond 500 le corps de texte. Sans prechargement, le navigateur ne
            les decouvre qu'apres avoir analyse la feuille de style — et sur le
            catalogue comme sur la page pilier, l'element du LCP est
            justement le h1. Les sept autres graisses restent chargees a la
            demande : precharger ce qui ne sert pas retarde ce qui sert. */}
        <link rel="preload" href="/polices/kefir-800.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/polices/rebond-500.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>
        {/* Google Ads — gtag.js */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `}
        </Script>

        {/* Meta Pixel — inactive until NEXT_PUBLIC_META_PIXEL_ID is set (see notesmanuel.md) */}
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

        {children}
      </body>
    </html>
  );
}
