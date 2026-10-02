"use client";

import { useEffect, useRef } from "react";

/* Le bouton « retour » du telephone ferme la fenetre ouverte au lieu de
   quitter la page.

   Sur mobile, c'est le geste naturel pour refermer une caisse, une image
   agrandie ou un menu. Sans entree d'historique, il ramenait a la page
   precedente : le visiteur perdait sa configuration et ses photos au moment
   meme ou il s'appretait a payer (constate le 2 octobre 2026).

   Une entree est ajoutee a l'ouverture (meme URL, Next.js l'integre a son
   routeur). Le retour la retire et ferme la fenetre. Une fermeture par la
   croix ou par Echap retire l'entree nous-memes, sans quoi il faudrait
   appuyer deux fois sur retour pour quitter la page ensuite.

   Les fenetres peuvent s'empiler (la caisse, puis son etape de paiement) :
   une pile unique decide laquelle se ferme, et un retour declenche par le
   code ne doit fermer personne. */

interface Entree {
  id: string;
  fermer: () => void;
}

const pile: Entree[] = [];
let retoursIgnores = 0;
let ecoute = false;

function surRetour() {
  if (retoursIgnores > 0) {
    retoursIgnores--;
    return;
  }
  pile.pop()?.fermer();
}

export function useRetourFerme(ouvert: boolean, fermer: () => void) {
  const fermerRef = useRef(fermer);
  useEffect(() => {
    fermerRef.current = fermer;
  });

  useEffect(() => {
    if (!ouvert) return;
    if (!ecoute) {
      window.addEventListener("popstate", surRetour);
      ecoute = true;
    }
    const id = Math.random().toString(36).slice(2);
    window.history.pushState({ ...(window.history.state ?? {}), retourFerme: id }, "");
    pile.push({ id, fermer: () => fermerRef.current() });

    return () => {
      const i = pile.findIndex((e) => e.id === id);
      if (i < 0) return; // deja fermee par le retour : son entree n'existe plus
      pile.splice(i, 1);
      // Fermee autrement (croix, Echap) : on retire l'entree qu'on avait posee,
      // seulement si c'est encore la page courante (pas apres une navigation).
      if (window.history.state?.retourFerme === id) {
        retoursIgnores++;
        window.history.back();
      }
    };
  }, [ouvert]);
}
