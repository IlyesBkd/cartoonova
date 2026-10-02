import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locales, type Locale } from "@/i18n/config";
import { GIFT_PRODUCTS } from "@/lib/productFeed";
import { OCCASIONS, buildGiftSlug } from "@/lib/giftOccasions";
import { dateEvenement, getDigitalOrderByDate, getOrderByDate } from "@/lib/evenements";
import { vignetteProduit } from "@/lib/visuels";
import { metadataPage, urlAbsolue } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { filAriane } from "@/lib/donneesStructurees";

/* La page Noel : les trois dates limites, le bon cadeau, et les univers les
   plus offerts, chacun vers sa page « portrait X pour Noel » deja existante.

   A mettre en ligne avant le 1er novembre : une page met deux a quatre
   semaines a remonter dans Google. Les dates ne dependent que du 25 decembre,
   pas du jour courant : la page peut etre mise en cache sans mentir. */

const CHEMIN = "/noel";

export const revalidate = 86400;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.noel" });
  // Titre et description a la bonne longueur, carte de partage avec image (lib/seo.ts).
  return metadataPage({ locale, chemin: CHEMIN, titre: t("title"), description: t("description") });
}

/** Le prochain 25 decembre : apres Noel, la page parle deja du suivant. */
function prochainNoel(locale: Locale): Date {
  const maintenant = new Date();
  const cetteAnnee = dateEvenement("noel", locale, maintenant.getFullYear());
  return maintenant > cetteAnnee ? dateEvenement("noel", locale, maintenant.getFullYear() + 1) : cetteAnnee;
}

export default async function NoelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: brut } = await params;
  setRequestLocale(brut);
  if (!(locales as readonly string[]).includes(brut)) notFound();
  const locale = brut as Locale;
  const t = await getTranslations({ locale, namespace: "noel" });

  const noel = prochainNoel(locale);
  const jour = (d: Date) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(d);
  const occasion = OCCASIONS[locale].noel;

  const dates = [
    { cle: "impression", titre: t("impressionTitre"), texte: t("impressionTexte", { date: jour(getOrderByDate(noel)) }) },
    { cle: "numerique", titre: t("numeriqueTitre"), texte: t("numeriqueTexte", { date: jour(getDigitalOrderByDate(noel)) }) },
    { cle: "bon", titre: t("bonTitre"), texte: t("bonTexte", { date: jour(new Date(noel.getTime() - 86400000)) }) },
  ];

  // Fil d'Ariane (donnees structurees) : Accueil > cette page.
  const tArianeNav = await getTranslations({ locale: brut, namespace: "nav" });
  const tArianePage = await getTranslations({ locale: brut, namespace: "metaPages.noel" });
  const ariane = filAriane([
    [tArianeNav("home"), urlAbsolue(brut)],
    [tArianePage("title"), urlAbsolue(brut, "/noel")],
  ]);

  return (
    <>
      <JsonLd noeuds={[ariane]} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: occasion.faq.map((q) => ({
              "@type": "Question",
              name: q.question,
              acceptedAnswer: { "@type": "Answer", text: q.answer },
            })),
          }),
        }}
      />

      <section className="section noel">
        <div className="enveloppe">
          <div className="chapeau">
            <span className="surtitre">{t("surtitre")}</span>
            <h1>
              {t("titre")} <span className="accent">{t("accent")}</span>
            </h1>
            <p>{t("sous")}</p>
          </div>

          <div className="noel__dates">
            {dates.map((d) => (
              <article key={d.cle} className={`noel__date noel__date--${d.cle}`}>
                <h2>{d.titre}</h2>
                <p>{d.texte}</p>
                {d.cle === "bon" && (
                  <Link href={`/${locale}/bon-cadeau`} className="bouton bouton--primaire">
                    {t("bonCta")}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--cendre)" }}>
        <div className="enveloppe">
          <div className="chapeau">
            <h2>{t("universTitre")}</h2>
            <p>{t("universSous")}</p>
          </div>
          <div className="styles-grille">
            {GIFT_PRODUCTS.map((p) => {
              const visuel = vignetteProduit(p.slug);
              return (
                <Link key={p.slug} className="carte" href={`/${locale}/cadeau/${buildGiftSlug(locale, p.slug, "noel")}`}>
                  {visuel ? (
                    <Image className="carte__image" src={visuel} alt={p.translations[locale].title} width={800} height={800} sizes="(max-width: 520px) 92vw, 24vw" />
                  ) : (
                    <div className="carte__image substitut">
                      <span>{p.translations[locale].title}</span>
                    </div>
                  )}
                  <div className="carte__corps">
                    <h3>{occasion.headline(p.translations[locale].title)}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="enveloppe" style={{ maxWidth: 760 }}>
          <h2 style={{ fontSize: "var(--t-section)", marginBottom: 12 }}>{t("faqTitre")}</h2>
          <div className="faq">
            {occasion.faq.map((q, i) => (
              <details key={i} name="faq" open={i === 0}>
                <summary>{q.question}</summary>
                <p>{q.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
