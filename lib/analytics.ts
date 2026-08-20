import type { PostHog } from "posthog-js";

/**
 * Chargement differe de PostHog.
 *
 * Le SDK etait importe en statique par le provider qui enveloppe toute
 * l'application, donc present dans le bundle initial de chaque page : 282 Ko
 * mesures sur l'accueil, 18 % de tout le JavaScript charge. Il n'a pourtant
 * rien a faire avant que la page ne soit interactive — aucun de ses appels ne
 * participe au rendu.
 *
 * Ici il est importe a la premiere mesure, c'est-a-dire juste apres
 * l'hydratation, quand la vue de page part. Le telechargement quitte le
 * chemin critique sans qu'aucun evenement ne soit perdu : la promesse est
 * partagee, les appels suivants la reutilisent.
 *
 * Toute la surface utilisee tient en `capture`. `posthog-js/react` a disparu
 * avec : son unique role etait de fournir `usePostHog()` au provider, qui
 * n'en a plus besoin.
 */

let chargement: Promise<PostHog | null> | null = null;

function client(): Promise<PostHog | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const cle = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!cle) return Promise.resolve(null);

  chargement ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(cle, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        /* Aucun sondage n'existe dans le code, et PostHog telechargeait tout
           de meme surveys.js — 98 Ko sur chaque page. */
        disable_surveys: true,
      });
      return posthog;
    })
    .catch(() => null);

  return chargement;
}

/**
 * Enregistre un evenement. Volontairement sans valeur de retour et sans
 * attente : la mesure ne doit jamais retarder ni faire echouer ce qu'elle
 * observe — surtout dans le tunnel de commande.
 */
export function mesure(nom: string, proprietes?: Record<string, unknown>): void {
  void client().then((posthog) => posthog?.capture(nom, proprietes));
}
