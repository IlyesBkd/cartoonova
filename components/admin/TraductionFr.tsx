"use client";

import { useEffect, useState } from "react";

/**
 * La traduction francaise d'un texte client, affichee sous l'original.
 *
 * Rien ne s'affiche tant que la traduction n'est pas connue, ni quand le
 * texte est deja en francais : un encadre « traduction » vide ou identique a
 * l'original, repete sous chaque message, noierait justement les messages
 * qui en ont besoin.
 *
 * L'original reste au-dessus, entier. La traduction sert a comprendre ; en
 * cas de doute sur une consigne — une barbe a retirer, une date de cadeau —
 * c'est le texte du client qui fait foi.
 */

type Traduction = { langue: string; fr: string | null } | { erreur: string };

/* ── File partagee entre tous les encadres de la page ─────────────────────
   Chaque encadre demande sa traduction en montant. Les demandes faites dans
   la meme fraction de seconde partent en un seul lot : l'ouverture d'une
   fiche commande avec six messages fait une requete, pas six. */

const LOT_MAX = 30;
const cache = new Map<string, Traduction>();
const enVol = new Map<string, Promise<Traduction>>();
let file: { texte: string; resoudre: (t: Traduction) => void }[] = [];
let minuteur: ReturnType<typeof setTimeout> | null = null;
let motDePasseCourant = "";

function envoyerLeLot() {
  minuteur = null;
  const lot = file;
  file = [];

  for (let k = 0; k < lot.length; k += LOT_MAX) {
    const tranche = lot.slice(k, k + LOT_MAX);
    fetch("/api/traductions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": motDePasseCourant },
      body: JSON.stringify({ textes: tranche.map((d) => d.texte) }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !Array.isArray(data?.resultats)) {
          throw new Error(data?.error || `Erreur ${r.status}`);
        }
        tranche.forEach((d, i) => d.resoudre(data.resultats[i] ?? { erreur: "Réponse incomplète." }));
      })
      .catch((e: unknown) => {
        const erreur = e instanceof Error ? e.message : "Erreur réseau.";
        tranche.forEach((d) => d.resoudre({ erreur }));
      });
  }
}

function demanderTraduction(texte: string, motDePasse: string): Promise<Traduction> {
  const connue = cache.get(texte);
  if (connue) return Promise.resolve(connue);
  const enCours = enVol.get(texte);
  if (enCours) return enCours;

  motDePasseCourant = motDePasse;
  const promesse = new Promise<Traduction>((resoudre) => {
    file.push({ texte, resoudre });
    if (!minuteur) minuteur = setTimeout(envoyerLeLot, 40);
  }).then((t) => {
    enVol.delete(texte);
    /* Un echec n'est pas garde : le prochain affichage retentera. */
    if (!("erreur" in t)) cache.set(texte, t);
    return t;
  });
  enVol.set(texte, promesse);
  return promesse;
}

/* « Traduit de l'anglais », « traduit du polonais » : l'article se choisit
   avec la langue, d'ou une table plutot qu'une regle. */
const DEPUIS: Record<string, string> = {
  en: "de l'anglais",
  es: "de l'espagnol",
  de: "de l'allemand",
  it: "de l'italien",
  nl: "du néerlandais",
  pl: "du polonais",
  sv: "du suédois",
  da: "du danois",
  pt: "du portugais",
  no: "du norvégien",
  nb: "du norvégien",
  fi: "du finnois",
  cs: "du tchèque",
  ro: "du roumain",
  ar: "de l'arabe",
  tr: "du turc",
  ru: "du russe",
  uk: "de l'ukrainien",
  el: "du grec",
  hu: "du hongrois",
  ja: "du japonais",
  zh: "du chinois",
};

export default function TraductionFr({
  texte,
  motDePasse,
  compact = false,
}: {
  texte: string | null | undefined;
  motDePasse: string;
  /** Pour les blocs etroits de la fiche commande : texte plus petit, tronque. */
  compact?: boolean;
}) {
  const [etat, setEtat] = useState<{ texte: string; traduction: Traduction } | null>(null);

  useEffect(() => {
    if (!texte || !texte.trim()) return;
    let actif = true;
    demanderTraduction(texte, motDePasse).then((traduction) => {
      if (actif) setEtat({ texte, traduction });
    });
    return () => {
      actif = false;
    };
  }, [texte, motDePasse]);

  /* L'etat peut appartenir au texte precedent quand l'encadre est reutilise
     pour un autre message : on ne l'affiche que s'il correspond. */
  if (!texte || !etat || etat.texte !== texte) return null;
  const t = etat.traduction;

  if ("erreur" in t) {
    return <p className="mt-1 text-[10px] italic text-gray-400">Traduction indisponible : {t.erreur}</p>;
  }
  if (t.fr === null) return null;

  const fr = compact && t.fr.length > 700 ? t.fr.slice(0, 700) + "…" : t.fr;

  return (
    <div className="mt-2 border-l-2 border-sky-300 bg-sky-50/70 rounded-r-lg px-2 py-1.5">
      <p className="text-[10px] font-bold text-sky-800 mb-0.5">
        🇫🇷 Traduit {DEPUIS[t.langue] ?? `(${t.langue})`}
      </p>
      <p className={`${compact ? "text-xs" : "text-sm"} text-gray-800 whitespace-pre-wrap leading-relaxed`}>{fr}</p>
    </div>
  );
}
