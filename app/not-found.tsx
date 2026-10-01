import Link from "next/link";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { locales, type Locale } from "@/i18n/config";

/* 404 de dernier recours, rendue dans le seul layout racine (pas d'en-tete ni
   de pied : ils vivent sous /[locale] et exigent ses fournisseurs). Elle sert
   aux URL qu'aucune route ne couvre (/fr/a/b/c), a une langue inconnue
   rejetee par le layout de langue, et aux routes hors langue (/suivi,
   /success) qui appellent `notFound()`.

   La langue se lit dans l'en-tete du middleware next-intl, comme le fait
   `app/layout.tsx`. Les routes hors langue en sont exclues : faute d'en-tete,
   on affiche un texte bilingue plutot que de deviner. */

const EN_TETE_LANGUE = "X-NEXT-INTL-LOCALE";

const STYLE_PAGE: React.CSSProperties = {
  minHeight: "70vh",
  display: "grid",
  placeItems: "center",
  textAlign: "center",
  padding: "48px 16px",
};

export default async function NotFoundRacine() {
  const brut = (await headers()).get(EN_TETE_LANGUE);
  const locale = brut && (locales as readonly string[]).includes(brut) ? (brut as Locale) : null;

  if (!locale) {
    return (
      <main style={STYLE_PAGE}>
        <div>
          <h1>404</h1>
          <p>Cette page n&apos;existe pas. · This page does not exist.</p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
            <Link href="/fr" className="bouton bouton--primaire">Accueil</Link>
            <Link href="/en" className="bouton bouton--fantome">Home</Link>
          </p>
        </div>
      </main>
    );
  }

  const t = await getTranslations({ locale, namespace: "page404" });
  return (
    <main style={STYLE_PAGE}>
      <div>
        <span className="surtitre">{t("surtitre")}</span>
        <h1>
          {t("titre")} <span className="accent">{t("accent")}</span>
        </h1>
        <p>{t("texte")}</p>
        <p style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
          <Link href={`/${locale}/collections`} className="bouton bouton--primaire">
            {t("boutonCollections")}
          </Link>
          <Link href={`/${locale}`} className="bouton bouton--fantome">
            {t("boutonAccueil")}
          </Link>
        </p>
      </div>
    </main>
  );
}
