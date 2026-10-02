"use client";

import { useEffect } from "react";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

/* Une page introuvable atteinte depuis une annonce ou un lien externe est de
   l'argent perdu sans bruit : la vue de page seule ne la distingue pas d'une
   autre. Le referent dit d'ou venait le lien casse. */
export default function MesurePage404() {
  useEffect(() => {
    let referent: string | null = null;
    try {
      referent = document.referrer ? new URL(document.referrer).hostname : null;
    } catch {
      referent = null;
    }
    mesure(MESURES.pageIntrouvable, { path: window.location.pathname.slice(0, 200), referrer_domain: referent });
  }, []);
  return null;
}
