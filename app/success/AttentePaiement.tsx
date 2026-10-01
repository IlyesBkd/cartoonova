"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* Relance le rendu serveur tant que Stripe dit `processing`.

   PayPal et Revolut Pay confirment en general en quelques secondes : la page
   bascule alors d'elle-meme sur le succes. Au-dela d'une minute, on arrete de
   relancer et on le dit — un paiement SEPA peut rester en attente des jours,
   et la finalisation arrivera de toute facon par le webhook Stripe. */

const INTERVALLE_MS = 4000;
const ESSAIS_MAX = 15;

export default function AttentePaiement({ lent }: { lent: string }) {
  const router = useRouter();
  const [essais, setEssais] = useState(0);

  useEffect(() => {
    if (essais >= ESSAIS_MAX) return;
    const minuterie = window.setTimeout(() => {
      router.refresh();
      setEssais((n) => n + 1);
    }, INTERVALLE_MS);
    return () => window.clearTimeout(minuterie);
  }, [essais, router]);

  if (essais < ESSAIS_MAX) return <div className="rotatif" style={{ margin: "4px auto" }} aria-hidden="true" />;
  return <p>{lent}</p>;
}
