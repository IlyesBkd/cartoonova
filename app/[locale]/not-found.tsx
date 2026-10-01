import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
import { GIFT_PRODUCTS } from "@/lib/productFeed";
import { vignetteProduit } from "@/lib/visuels";

/* 404 dans la coque du site. Sans ce fichier, chaque `notFound()` appele sous
   /[locale] (slug produit inconnu, article absent, occasion inconnue...)
   affichait la page nue de Next, en anglais, sans en-tete ni pied : le
   visiteur n'avait plus aucun lien pour revenir. Ici il reste dans la
   navigation et on lui propose directement les six univers phares.

   Un not-found ne recoit aucun parametre (docs Next 16, file-conventions/
   not-found) : la langue vient de next-intl, qui la lit dans l'en-tete pose
   par le middleware sur la requete — la meme source que le layout racine. */

export default async function NotFoundLocalise() {
  const brut = await getLocale();
  const locale: Locale = (locales as readonly string[]).includes(brut) ? (brut as Locale) : defaultLocale;
  const t = await getTranslations({ locale, namespace: "page404" });

  return (
    <>
      <section className="section page-404">
        <div className="enveloppe">
          <div className="chapeau">
            <span className="surtitre">{t("surtitre")}</span>
            <h1>
              {t("titre")} <span className="accent">{t("accent")}</span>
            </h1>
            <p>{t("texte")}</p>
          </div>
          <div className="page-404__actions">
            <Link href={`/${locale}/collections`} className="bouton bouton--primaire">
              {t("boutonCollections")}
            </Link>
            <Link href={`/${locale}`} className="bouton bouton--fantome">
              {t("boutonAccueil")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--cendre)" }}>
        <div className="enveloppe">
          <div className="chapeau">
            <h2>{t("stylesTitre")}</h2>
            <p>{t("stylesSous")}</p>
          </div>
          <div className="pages-grille">
            {GIFT_PRODUCTS.map((p) => {
              const visuel = vignetteProduit(p.slug);
              const titre = p.translations[locale].title;
              return (
                <Link key={p.slug} className="carte" href={`/${locale}/${p.slugs[locale]}`}>
                  {visuel ? (
                    <Image className="carte__image" src={visuel} alt={titre} width={800} height={800} sizes="(max-width: 860px) 46vw, 30vw" />
                  ) : (
                    <div className="carte__image substitut">
                      <span>{titre}</span>
                    </div>
                  )}
                  <div className="carte__corps">
                    <h3>{titre}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
