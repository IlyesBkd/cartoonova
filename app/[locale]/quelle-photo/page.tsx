import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locales, type Locale } from "@/i18n/config";
import { SLUG_PHARE } from "@/lib/catalogue";
import { visuelsProduit } from "@/lib/visuels";
import { metadataPage, urlAbsolue } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { filAriane } from "@/lib/donneesStructurees";

/* Guide « Quelle photo envoyer ? ». La qualite du portrait depend d'abord de
   la photo recue : un client qui hesite sur sa photo n'achete pas, et un
   client qui envoie une photo floue recoit un dessin approximatif puis
   demande des retouches. Une page dediee repond aux deux, et se place sur
   des recherches du type « quelle photo pour un portrait cartoon ».

   Le contenu est entierement dans les messages : rien ne depend du jour ni
   de la base, la page peut donc etre statique. */

const CHEMIN = "/quelle-photo";

export const revalidate = 86400;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metaPages.guidePhoto" });
  // Titre et description a la bonne longueur, carte de partage avec image (lib/seo.ts).
  return metadataPage({ locale, chemin: CHEMIN, titre: t("title"), description: t("description") });
}

/* Les cles sont numerotees plutot que rangees en tableau : le fichier de
   messages reste plat, et une traduction manquante se voit cle par cle. */
const BONS = [1, 2, 3, 4, 5, 6] as const;
const A_EVITER = [1, 2, 3, 4] as const;
const CAS = [1, 2, 3] as const;
const FAQ = [1, 2, 3, 4, 5] as const;

/* Pictogrammes des cas particuliers, dans l'ordre des cles cas1..cas3 :
   animaux, photo de groupe, envoi differe. */
const PICTOS_CAS = ["🐾", "👨‍👩‍👧", "📩"] as const;

/** Le visuel « transformation » du produit phare : photo d'origine et
 *  portrait cote a cote. C'est la meilleure preuve de ce qu'une bonne photo
 *  donne, et il existe deja dans la galerie. */
function visuelTransformation(): string | null {
  const v = visuelsProduit(SLUG_PHARE);
  const i = v.legendes.indexOf("transformation");
  return i >= 0 ? v.galerie[i] ?? null : null;
}

export default async function GuidePhotoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: brut } = await params;
  setRequestLocale(brut);
  if (!(locales as readonly string[]).includes(brut)) notFound();
  const locale = brut as Locale;
  const t = await getTranslations({ locale, namespace: "guidePhoto" });

  const illustration = visuelTransformation();
  const faq = FAQ.map((n) => ({ question: t(`faq${n}Q`), reponse: t(`faq${n}R`) }));

  // Fil d'Ariane (donnees structurees) : Accueil > cette page.
  const tArianeNav = await getTranslations({ locale: brut, namespace: "nav" });
  const tArianePage = await getTranslations({ locale: brut, namespace: "metaPages.guidePhoto" });
  const ariane = filAriane([
    [tArianeNav("home"), urlAbsolue(brut)],
    [tArianePage("title"), urlAbsolue(brut, "/quelle-photo")],
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
            mainEntity: faq.map((q) => ({
              "@type": "Question",
              name: q.question,
              acceptedAnswer: { "@type": "Answer", text: q.reponse },
            })),
          }),
        }}
      />

      <section className="section guide-photo">
        <div className="enveloppe">
          <div className="chapeau">
            <span className="surtitre">{t("surtitre")}</span>
            <h1>
              {t("titre")} <span className="accent">{t("accent")}</span>
            </h1>
            <p>{t("sous")}</p>
          </div>

          {illustration && (
            <figure className="guide-photo__illus">
              <Image
                src={illustration}
                alt={t("illustrationAlt")}
                width={1000}
                height={1000}
                sizes="(max-width: 720px) 92vw, 520px"
                priority
              />
              <figcaption>{t("illustrationLegende")}</figcaption>
            </figure>
          )}
        </div>
      </section>

      <section className="section" style={{ background: "var(--cendre)" }}>
        <div className="enveloppe">
          <div className="chapeau">
            <h2>{t("bonsTitre")}</h2>
            <p>{t("bonsSous")}</p>
          </div>
          <ul className="guide-photo__grille">
            {BONS.map((n) => (
              <li key={n} className="guide-photo__conseil guide-photo__conseil--bon">
                <span className="guide-photo__picto" aria-hidden="true">✅</span>
                <h3>{t(`bon${n}Titre`)}</h3>
                <p>{t(`bon${n}Texte`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="enveloppe">
          <div className="chapeau">
            <h2>{t("eviterTitre")}</h2>
            <p>{t("eviterSous")}</p>
          </div>
          <ul className="guide-photo__grille guide-photo__grille--4">
            {A_EVITER.map((n) => (
              <li key={n} className="guide-photo__conseil guide-photo__conseil--evite">
                <span className="guide-photo__picto" aria-hidden="true">❌</span>
                <h3>{t(`evite${n}Titre`)}</h3>
                <p>{t(`evite${n}Texte`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" style={{ background: "var(--creme)" }}>
        <div className="enveloppe">
          <div className="chapeau">
            <h2>{t("casTitre")}</h2>
          </div>
          <ul className="guide-photo__grille">
            {CAS.map((n, i) => (
              <li key={n} className="guide-photo__conseil">
                <span className="guide-photo__picto" aria-hidden="true">{PICTOS_CAS[i]}</span>
                <h3>{t(`cas${n}Titre`)}</h3>
                <p>{t(`cas${n}Texte`)}</p>
              </li>
            ))}
          </ul>
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

      <section className="section" style={{ background: "var(--soleil-pale)" }}>
        <div className="enveloppe guide-photo__cta">
          <h2>{t("ctaTitre")}</h2>
          <p>{t("ctaTexte")}</p>
          <Link href={`/${locale}/collections`} className="bouton bouton--primaire">
            {t("ctaBouton")}
          </Link>
        </div>
      </section>
    </>
  );
}
