import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { VERSION_VISUELS } from "./lib/versionVisuels";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,

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
