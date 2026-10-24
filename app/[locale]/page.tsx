import PageAccueil from "@/components/pages/PageAccueil";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { locales } from "@/i18n/config";

/* Le corps de l'accueil vit dans `components/pages/PageAccueil.tsx` : la page
   pilier `/portrait-personnalise-cartoon` sert exactement le meme, a son
   propre chemin. Extrait plutot que recopie — deux copies d'une page finissent
   toujours par diverger. */

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The page can render in parallel with its layout. Dotted paths bypass
  // the proxy and must be rejected here before rendering the homepage.
  if (!hasLocale(locales, locale)) notFound();
  setRequestLocale(locale);
  return <PageAccueil locale={locale} />;
}
