import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { VERSION_VISUELS } from "./lib/versionVisuels";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/* Politique de securite du contenu, publiee en Report-Only : elle ne bloque
   rien et envoie ce qu'elle aurait bloque a /api/csp. Les pages etant
   statiques, pas de nonce possible : 'unsafe-inline' reste necessaire pour
   gtag, le pixel Meta et les scripts d'amorcage de Next. A rendre bloquante
   (en-tete Content-Security-Policy) apres une a deux semaines sans violation
   legitime. Origines : Stripe (paiement, Apple Pay, Google Pay), Google Ads,
   Meta, PostHog, Vercel Blob (televersement des photos), API Adresse et
   Photon (suggestions d'adresse), Google Fonts (maquettes). */
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' seulement en developpement : le rechargement a chaud en a besoin.
  // 'wasm-unsafe-eval' : autorise le WebAssembly (et lui seul, pas eval). Signale
  // le 3 octobre 2026 par un rapport, sans doute Stripe ou une extension.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://js.stripe.com https://*.js.stripe.com https://www.googletagmanager.com https://www.googleadservices.com https://*.doubleclick.net https://www.google.com https://connect.facebook.net https://vercel.live`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https://*.blob.vercel-storage.com",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.stripe.network https://maps.googleapis.com https://vercel.com https://blob.vercel-storage.com https://*.blob.vercel-storage.com https://api-adresse.data.gouv.fr https://data.geopf.fr https://photon.komoot.io https://eu.i.posthog.com https://eu-assets.i.posthog.com https://www.google.com https://*.doubleclick.net https://www.googleadservices.com https://*.google-analytics.com https://www.facebook.com https://connect.facebook.net https://vercel.live wss://ws-us3.pusher.com",
  "frame-src 'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://pay.google.com https://www.googletagmanager.com https://td.doubleclick.net https://www.facebook.com https://vercel.live",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "report-uri /api/csp",
].join("; ");

const EN_TETES_SECURITE = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // payment : Apple Pay et Google Pay passent par l'iframe de Stripe.
  {
    key: "Permissions-Policy",
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
  },
  { key: "Content-Security-Policy-Report-Only", value: CSP },
];

const nextConfig: NextConfig = {
  reactCompiler: true,

  /* Deux mises en page racines (`app/[locale]` et `app/(hors-langue)`) : la
     404 des URL inconnues vit dans `app/global-not-found.tsx`. */
  experimental: {
    globalNotFound: true,
  },

  // ssh2 utilise les API reseau natives de Node et doit rester charge par le
  // runtime serveur Vercel, hors du bundle des Server Components.
  serverExternalPackages: ["ssh2"],

  /* La carte de voeux et le calendrier embarquent les polices du site (seules
     a couvrir le polonais, le suedois et le danois). Sans cette ligne, le
     dossier public n'accompagne pas la fonction et le generateur doit les
     retelecharger depuis le site. */
  outputFileTracingIncludes: {
    "/api/orders/extras": ["./public/polices/rebond-*.woff"],
  },

  /* PostHog sert ses evenements depuis notre propre domaine.
     `eu.i.posthog.com` figure dans EasyPrivacy, la liste appliquee par defaut
     par uBlock Origin et par Brave : appele en direct, il est bloque chez une
     part importante des visiteurs europeens — et ce sont silencieusement les
     memes qui manquent dans chaque entonnoir. Reecrit ici, le trafic sort de
     www.cartoonova.com et ne ressemble plus a du tiers.
     Deux chemins : les fichiers du SDK viennent du domaine d'actifs, les
     evenements du domaine d'ingestion. */
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },

  async headers() {
    return [{ source: "/(.*)", headers: EN_TETES_SECURITE }];
  },

  /* PostHog appelle certains points de terminaison avec une barre finale.
     Sans cela, Next y repond par une redirection que la requete de mesure ne
     suit pas, et l'evenement est perdu. */
  skipTrailingSlashRedirect: true,

  images: {
    formats: ["image/avif", "image/webp"],
    // Liste blanche des images locales. La premiere ligne garde le
    // comportement d'origine (tout chemin, sans requete) ; la seconde autorise
    // le jeton de version des visuels du catalogue, et lui seul.
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/catalogue/**", search: `?v=${VERSION_VISUELS}` },
    ],
    /* Seize tailles candidates produisaient 306 attributs `srcSet` sur la seule
       page d'accueil, soit 35 Ko — 18 % du document. Une vignette de 170 px y
       declarait des candidats jusqu'a 2048 w, que le navigateur n'utilisera
       jamais. Dix suffisent : les paliers retires (750 et 1080) sont a moins
       de 12 % de leur voisin, et 2048 ne servait qu'aux ecrans 4K en double
       densite. */
    deviceSizes: [360, 640, 828, 1200, 1920],
    imageSizes: [32, 64, 128, 256, 384],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.figma.com",
        pathname: "/api/mcp/asset/**",
      },
      {
        protocol: "https",
        hostname: "www.cartoonova.com",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
