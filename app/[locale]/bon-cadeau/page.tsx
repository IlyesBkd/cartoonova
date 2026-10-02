import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { metadataPage, IMAGE_PARTAGE, urlAbsolue } from "@/lib/seo";
import BonCadeauClient from "./BonCadeauClient";
import JsonLd from "@/components/JsonLd";
import { filAriane, politiqueRetourBonCadeau, prixValideJusqua } from "@/lib/donneesStructurees";
import { montantsBon } from "@/lib/bonCadeauMontants";
import { SITE_URL } from "@/lib/site";

const CHEMIN = "/bon-cadeau";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.bonCadeau" });
  // Titre et description a la bonne longueur, carte de partage avec image (lib/seo.ts).
  return metadataPage({ locale, chemin: CHEMIN, titre: t("title"), description: t("description") });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.bonCadeau" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const url = urlAbsolue(locale, CHEMIN);
  return (
    <>
      <JsonLd
        noeuds={[
          {
            "@type": "Product",
            name: t("title"),
            description: t("description"),
            brand: { "@type": "Brand", name: "Cartoonova" },
            image: IMAGE_PARTAGE,
            /* Un bon par montant, en euros : aucun port (il part par e-mail),
               retour possible 14 jours tant qu'il n'a pas servi. */
            offers: montantsBon("EUR").map((montant) => ({
              "@type": "Offer",
              price: montant,
              priceCurrency: "EUR",
              priceValidUntil: prixValideJusqua(),
              availability: "https://schema.org/InStock",
              url,
              seller: { "@id": `${SITE_URL}/#organization` },
              shippingDetails: {
                "@type": "OfferShippingDetails",
                shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "EUR" },
                shippingDestination: { "@type": "DefinedRegion", addressCountry: ["FR", "BE", "CH", "DE", "ES", "IT", "NL", "GB", "US", "CA"] },
                deliveryTime: {
                  "@type": "ShippingDeliveryTime",
                  handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
                  transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" },
                },
              },
              hasMerchantReturnPolicy: politiqueRetourBonCadeau(),
            })),
          },
          filAriane([
            [tNav("home"), urlAbsolue(locale)],
            [t("title"), url],
          ]),
        ]}
      />
      <BonCadeauClient />
    </>
  );
}
