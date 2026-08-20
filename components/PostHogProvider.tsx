"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { mesure } from "@/lib/analytics";

/* Le fournisseur de contexte `posthog-js/react` a ete retire : son seul role
   etait d'alimenter `usePostHog()`, qui n'etait appele que par ce fichier.
   Il obligeait a importer le SDK en statique, donc a l'embarquer dans le
   bundle initial de chaque page. Voir lib/analytics.ts. */

function VueDePage() {
  const chemin = usePathname();
  const parametres = useSearchParams();

  useEffect(() => {
    if (!chemin) return;
    const recherche = parametres?.toString();
    mesure("$pageview", {
      $current_url: window.origin + chemin + (recherche ? `?${recherche}` : ""),
    });
  }, [chemin, parametres]);

  return null;
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
    </>
  );
}
