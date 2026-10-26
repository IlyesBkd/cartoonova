import type { Metadata } from "next";
import { CATALOGUE_EN_LIGNE as STYLES_PUBLIES } from "@/lib/catalogue";
import { getTranslations } from "next-intl/server";
import { metadataPage, IMAGE_PARTAGE, urlAbsolue } from "@/lib/seo";
import BonCadeauClient from "./BonCadeauClient";
import BonCadeauJsonLd from "@/components/BonCadeauJsonLd";
import JsonLd from "@/components/JsonLd";
import { filAriane } from "@/lib/donneesStructurees";

const CHEMIN = "/bon-cadeau";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.bonCadeau" });
  return metadataPage({ locale, chemin: CHEMIN, titre: t("title"), description: t("description", { count: STYLES_PUBLIES.length }) });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.bonCadeau" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const url = urlAbsolue(locale, CHEMIN);
  return (
    <>
      <BonCadeauJsonLd
        produit={{
          "@type": "Product",
          name: t("title"),
          description: t("description", { count: STYLES_PUBLIES.length }),
          brand: { "@type": "Brand", name: "Cartoonova" },
          image: IMAGE_PARTAGE,
        }}
        url={url}
      />
      <JsonLd noeuds={[filAriane([[tNav("home"), urlAbsolue(locale)], [t("title"), url]])]} />
      <BonCadeauClient />
    </>
  );
}
