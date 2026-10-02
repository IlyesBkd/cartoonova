import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { metadataPageLegale, urlAbsolue } from "@/lib/seo";
import { pagesLegales } from "@/lib/legal";
import PageLegale from "@/components/PageLegale";
import JsonLd from "@/components/JsonLd";
import { filAriane, pageWeb } from "@/lib/donneesStructurees";

const CHEMIN = "/cgv";

export function generateMetadata(params: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return metadataPageLegale(params, "cgv", CHEMIN);
}

/* Texte dans lib/legal/<langue>.ts, traduit dans les dix langues ; la version
   francaise fait foi (avertissement affiche en tete des traductions). */
export default async function CGV({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const textes = pagesLegales(locale);
  const document = textes.cgv;
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const url = urlAbsolue(locale, CHEMIN);
  return (
    <>
      <JsonLd
        noeuds={[
          pageWeb("WebPage", locale, url, document.titre),
          filAriane([
            [tNav("home"), urlAbsolue(locale)],
            [document.titre, url],
          ]),
        ]}
      />
      <PageLegale document={document} avertissement={textes.avertissement} locale={locale} />
    </>
  );
}
