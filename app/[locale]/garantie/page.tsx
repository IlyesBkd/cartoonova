import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locales, type Locale } from "@/i18n/config";
import { metadataPage, urlAbsolue } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { filAriane } from "@/lib/donneesStructurees";

/* Page « Notre garantie ». La garantie existait deja dans les CGV (articles
   7, 8 et 9 de lib/legal/fr.ts : retouches illimitees, remboursement si le
   client n'est toujours pas convaincu, echange d'une impression abimee),
   mais personne ne lit des CGV avant d'acheter. Sur un achat sur mesure,
   paye avant d'avoir vu le dessin, c'est pourtant la reponse a la premiere
   objection : « et si ca ne me plait pas ? ».

   Le texte doit rester aligne sur les CGV : toute modification de la
   garantie se fait d'abord la-bas. Contenu entierement dans les messages,
   la page peut donc etre statique. */

const CHEMIN = "/garantie";

export const revalidate = 86400;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.garantie" });
  return metadataPage({ locale, chemin: CHEMIN, titre: t("title"), description: t("description") });
}

/* Les quatre engagements, dans l'ordre des cles bloc1..bloc4 : retouches,
   remboursement, impression abimee, comment demander. */
const BLOCS = [1, 2, 3, 4] as const;
const PICTOS_BLOCS = ["✏️", "💶", "📦", "✉️"] as const;
const FAQ = [1, 2, 3, 4, 5] as const;

export default async function GarantiePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: brut } = await params;
  setRequestLocale(brut);
  if (!(locales as readonly string[]).includes(brut)) notFound();
  const locale = brut as Locale;
  const t = await getTranslations({ locale, namespace: "garantie" });

  const faq = FAQ.map((n) => ({ question: t(`faq${n}Q`), reponse: t(`faq${n}R`) }));

  // Fil d'Ariane : Accueil > cette page. FAQ dans le meme graphe.
  const tArianeNav = await getTranslations({ locale, namespace: "nav" });
  const tArianePage = await getTranslations({ locale, namespace: "metaPages.garantie" });
  const ariane = filAriane([
    [tArianeNav("home"), urlAbsolue(locale)],
    [tArianePage("title"), urlAbsolue(locale, CHEMIN)],
  ]);
  const pageFaq = {
    "@type": "FAQPage",
    mainEntity: faq.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.reponse },
    })),
  };

  return (
    <>
      <JsonLd noeuds={[ariane, pageFaq]} />

      <section className="section guide-photo">
        <div className="enveloppe">
          <div className="chapeau">
            <span className="surtitre">{t("surtitre")}</span>
            <h1>
              {t("titre")} <span className="accent">{t("accent")}</span>
            </h1>
            <p>{t("sous")}</p>
          </div>

          <ul className="guide-photo__grille guide-photo__grille--4">
            {BLOCS.map((n, i) => (
              <li key={n} className="guide-photo__conseil">
                <span className="guide-photo__picto" aria-hidden="true">{PICTOS_BLOCS[i]}</span>
                <h2 style={{ fontSize: 19, margin: 0 }}>{t(`bloc${n}Titre`)}</h2>
                <p>{t(`bloc${n}Texte`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" style={{ background: "var(--soleil-pale)" }}>
        <div className="enveloppe guide-photo__cta">
          <h2>{t("ctaTitre")}</h2>
          <p>{t("ctaTexte")}</p>
          <Link href={`/${locale}/collections`} className="bouton bouton--primaire">
            {t("ctaBouton")}
          </Link>
          <p>
            <Link href={`/${locale}/cgv`}>{t("lienCgv")}</Link>
          </p>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="enveloppe" style={{ maxWidth: 760 }}>
          <h2 style={{ fontSize: "var(--t-section)", marginBottom: 12 }}>{t("faqTitre")}</h2>
          <div className="faq">
            {faq.map((q, i) => (
              <details key={i} name="faq" open={i === 0}>
                <summary>{q.question}</summary>
                <p>{q.reponse}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
