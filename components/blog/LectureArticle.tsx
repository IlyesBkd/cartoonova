"use client";

import { useEffect, useRef } from "react";
import { mesure } from "@/lib/analytics";
import { MESURES } from "@/lib/evenementsMesure";

/**
 * Lecture reelle d'un article.
 *
 * Le blog existe pour le referencement, et une vue de page ne dit pas s'il
 * remplit son role : un visiteur arrive de Google qui repart en trois secondes
 * compte exactement autant qu'un lecteur qui va au bout. Les deux demandent
 * pourtant des decisions opposees — l'un signale un titre qui promet ce que
 * l'article ne tient pas, l'autre un sujet a creuser.
 *
 * Deux conditions, ensemble : avoir atteint les trois quarts de l'article, et
 * y avoir passe au moins vingt secondes. Le defilement seul se declenche au
 * premier coup de molette sur mobile ; le temps seul compte les onglets
 * oublies.
 *
 * L'evenement ne part qu'une fois par montage, et l'observateur se demonte
 * juste apres : sur un article long, le gestionnaire de defilement ne survit
 * pas a son unique raison d'exister.
 */

const PART_LUE = 0.75;
const DUREE_MINIMALE_MS = 20_000;

export default function LectureArticle({
  slug,
  categorie,
  langue,
}: {
  slug: string;
  categorie: string;
  langue: string;
}) {
  const envoye = useRef(false);

  useEffect(() => {
    const arrivee = Date.now();

    const auDefilement = () => {
      if (envoye.current) return;

      const hauteurVue = window.innerHeight;
      const total = document.documentElement.scrollHeight - hauteurVue;
      if (total <= 0) return;

      const part = window.scrollY / total;
      if (part < PART_LUE) return;

      const duree = Date.now() - arrivee;
      if (duree < DUREE_MINIMALE_MS) return;

      envoye.current = true;
      window.removeEventListener("scroll", auDefilement);

      mesure(MESURES.articleLu, {
        slug,
        category: categorie,
        locale: langue,
        duration_ms: duree,
      });
    };

    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => window.removeEventListener("scroll", auDefilement);
  }, [slug, categorie, langue]);

  return null;
}
