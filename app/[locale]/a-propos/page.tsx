import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { metadataPage, urlAbsolue } from "@/lib/seo";
import AProposClient from "./AProposClient";
import JsonLd from "@/components/JsonLd";
import { filAriane, organisation, pageWeb } from "@/lib/donneesStructurees";

const CHEMIN = "/a-propos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.aPropos" });
  // Titre et description a la bonne longueur, carte de partage avec image (lib/seo.ts).
  return metadataPage({ locale, chemin: CHEMIN, titre: t("title"), description: t("description") });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.aPropos" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const url = urlAbsolue(locale, CHEMIN);
  return (
    <>
      <JsonLd
        noeuds={[
          pageWeb("AboutPage", locale, url, t("title"), t("description")),
          organisation(locale),
          filAriane([
            [tNav("home"), urlAbsolue(locale)],
            [t("title"), url],
          ]),
        ]}
      />
      <AProposClient />
    </>
  );
}
