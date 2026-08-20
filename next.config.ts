import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { VERSION_VISUELS } from "./lib/versionVisuels";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Liste blanche des images locales. La premiere ligne garde le
    // comportement d'origine (tout chemin, sans requete) ; la seconde autorise
    // le jeton de version des visuels du catalogue, et lui seul.
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/catalogue/**", search: `?v=${VERSION_VISUELS}` },
    ],
    deviceSizes: [360, 640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
