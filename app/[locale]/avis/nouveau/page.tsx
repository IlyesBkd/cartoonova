import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { parseOrderTrackingToken } from "@/lib/emailToken";
import NouvelAvisClient from "./NouvelAvisClient";

/* Page de fin de parcours, atteinte par un lien envoye par email et portant un
   jeton : elle n'a rien a faire dans l'index. `robots.ts` ne peut pas l'exclure
   sans exclure `/avis` elle-meme, d'ou la directive au niveau de la page. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { locale } = await params;
  const { c } = await searchParams;

  const jeton = c ?? "";
  /* La verification a lieu cote serveur : le client ne fait qu'afficher le
     resultat, et c'est la route d'API qui re-verifie au moment du depot. */
  const verifie = jeton ? parseOrderTrackingToken(jeton) !== null : false;

  return <NouvelAvisClient locale={locale as Locale} jeton={jeton} verifie={verifie} />;
}
