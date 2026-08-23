"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { contexte, mesure, bandeauConsentementActif } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";
import { locales } from "@/i18n/config";

/* Le fournisseur de contexte `posthog-js/react` a ete retire : son seul role
   etait d'alimenter `usePostHog()`, qui n'etait appele que par ce fichier.
   Il obligeait a importer le SDK en statique, donc a l'embarquer dans le
   bundle initial de chaque page. Voir lib/analytics.ts. */

/* Le bandeau n'existe que si le drapeau est leve, et il n'a rien a faire dans
   le bundle initial : il attend de toute facon le chargement du SDK. */
const BandeauConsentement = dynamic(() => import("@/components/BandeauConsentement"), {
  ssr: false,
});

function lireCookie(nom: string): string | undefined {
  return document.cookie.match(new RegExp(`(?:^| )${nom}=([^;]+)`))?.[1];
}

/**
 * Langue, devise et pays, joints a tous les evenements.
 *
 * Ces trois-la etaient recopies a la main dans deux ou trois appels et absents
 * de tous les autres. C'est pourtant la seule segmentation qui compte
 * aujourd'hui : le site sert dix marches, la campagne anglophone se juge sur
 * un taux de conversion par marche, et il etait impossible a calculer.
 *
 * Le pays vient du cookie pose par le middleware a partir de l'en-tete Vercel
 * — la geolocalisation de PostHog, elle, ne survit pas au proxy.
 */
function ContexteGlobal({ chemin }: { chemin: string }) {
  const segment = chemin.split("/")[1];
  const langue = (locales as readonly string[]).includes(segment) ? segment : null;

  useEffect(() => {
    contexte({
      locale: langue,
      currency: lireCookie("cartoonova_currency") ?? null,
      country: lireCookie("cartoonova_country") ?? null,
    });
  }, [langue]);

  return null;
}

function VueDePage() {
  const chemin = usePathname();
  const parametres = useSearchParams();

  useEffect(() => {
    if (!chemin) return;
    const recherche = parametres?.toString();
    mesure(MESURES.vueDePage, {
      $current_url: window.origin + chemin + (recherche ? `?${recherche}` : ""),
    });
  }, [chemin, parametres]);

  return <ContexteGlobal chemin={chemin ?? "/"} />;
}

export default function PostHogProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {/* `useSearchParams` impose une frontiere de suspense : sans elle, toute
          la page bascule en rendu client. */}
      <Suspense fallback={null}>
        <VueDePage />
      </Suspense>
      {children}
      {bandeauConsentementActif && <BandeauConsentement />}
    </>
  );
}
