import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GIFT_PRODUCTS } from "@/lib/productFeed";
import { locales, type Locale } from "@/i18n/config";
import { OCCASIONS, OCCASION_KEYS, buildGiftSlug } from "@/lib/giftOccasions";
import { prixEnCache } from "@/lib/lecturesCache";
import { DEFAULT_PRICE_SET } from "@/lib/types";
import { vignetteProduit } from "@/lib/visuels";
import { metadataPage, urlAbsolue } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { filAriane, pageWeb } from "@/lib/donneesStructurees";

/* Index des idees cadeaux. C'etait une liste de 36 liens texte : correcte
   pour Google, illisible pour un visiteur, qui doit choisir sur un visuel.
   Les memes liens deviennent des cartes avec la vignette du style et le prix
   de depart. En tete, les deux entrees qui convertissent le mieux en saison :
   la page Noel et le bon cadeau (pour qui ne connait pas le style prefere de
   la personne a qui il offre). */

export const revalidate = 86400;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeRaw } = await params;
  if (!(locales as readonly string[]).includes(localeRaw)) return {};
  const locale = localeRaw as Locale;
  const t = await getTranslations({ locale, namespace: "giftPage" });
  const tc = await getTranslations({ locale, namespace: "cadeauPage" });

  /* La page n'avait ni description ni carte de partage : elle heritait de
     celles de l'accueil, mot pour mot, dans les dix langues. */
  return metadataPage({ locale, chemin: "/cadeau", titre: t("section"), description: tc("sous") });
}

export default async function GiftIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeRaw } = await params;
  setRequestLocale(localeRaw);
  if (!(locales as readonly string[]).includes(localeRaw)) notFound();
  const locale = localeRaw as Locale;
  const t = await getTranslations({ locale, namespace: "cadeauPage" });

  /* Prix de base en euros, comme sur /collections : la page est mise en cache
     pour tous les visiteurs, elle ne peut donc pas suivre la devise de chacun. */
  let prixDepart = DEFAULT_PRICE_SET.base;
  try {
    prixDepart = (await prixEnCache("EUR")).base;
  } catch {
    // Repli sur la grille par defaut si la base est injoignable.
  }
  const prix = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Number.isInteger(prixDepart) ? 0 : 2,
  }).format(prixDepart);

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tGift = await getTranslations({ locale, namespace: "giftPage" });
  const url = urlAbsolue(locale, "/cadeau");

  return (
    <main className="page-tj">
      <JsonLd
        noeuds={[
          {
            ...pageWeb("CollectionPage", locale, url, tGift("section"), t("sous")),
            mainEntity: {
              "@type": "ItemList",
              itemListElement: OCCASION_KEYS.map((key, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: t("pourOccasion", { occasion: OCCASIONS[locale][key].label }),
                url: `${url}#${key}`,
              })),
            },
          },
          filAriane([
            [tNav("home"), urlAbsolue(locale)],
            [tGift("section"), url],
          ]),
        ]}
      />
      <section className="section">
        <div className="enveloppe">
          <div className="chapeau">
            <span className="surtitre">{t("surtitre")}</span>
            <h1>
              {t("titre")} <span className="accent">{t("accent")}</span>
            </h1>
            <p>{t("sous")}</p>
          </div>

          <div className="cadeau-vedettes">
            <Link href={`/${locale}/noel`} className="cadeau-vedette cadeau-vedette--noel">
              <span className="cadeau-vedette__picto" aria-hidden="true">🎄</span>
              <h2>{t("noelTitre")}</h2>
              <p>{t("noelTexte")}</p>
              <span className="bouton bouton--primaire">{t("noelBouton")}</span>
            </Link>
            <Link href={`/${locale}/bon-cadeau`} className="cadeau-vedette cadeau-vedette--bon">
              <span className="cadeau-vedette__picto" aria-hidden="true">🎁</span>
              <h2>{t("bonTitre")}</h2>
              <p>{t("bonTexte")}</p>
              <span className="bouton bouton--primaire">{t("bonBouton")}</span>
            </Link>
          </div>
        </div>
      </section>

      {OCCASION_KEYS.map((key, i) => {
        const occasion = OCCASIONS[locale][key];
        return (
          <section
            key={key}
            id={key}
            className="section cadeau-occasion"
            style={i % 2 === 0 ? { background: "var(--cendre)" } : undefined}
          >
            <div className="enveloppe">
              <h2 className="cadeau-occasion__titre">{t("pourOccasion", { occasion: occasion.label })}</h2>
              <div className="pages-grille">
                {GIFT_PRODUCTS.map((product) => {
                  const titre = product.translations[locale].title;
                  const visuel = vignetteProduit(product.slug);
                  return (
                    <Link
                      key={product.slug}
                      className="carte"
                      href={`/${locale}/cadeau/${buildGiftSlug(locale, product.slug, key)}`}
                    >
                      {visuel ? (
                        <Image
                          className="carte__image"
                          src={visuel}
                          alt={titre}
                          width={800}
                          height={800}
                          sizes="(max-width: 860px) 46vw, 30vw"
                        />
                      ) : (
                        <div className="carte__image substitut">
                          <span>{titre}</span>
                        </div>
                      )}
                      <div className="carte__corps">
                        <h3>{occasion.headline(titre)}</h3>
                        <span className="carte__prix">{t("aPartirDe", { prix })}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
