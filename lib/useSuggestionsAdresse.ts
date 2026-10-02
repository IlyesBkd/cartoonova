"use client";

import { useEffect, useState } from "react";

/* Suggestions d'adresse pour la caisse des impressions.

   Une adresse se tapait en sept champs sur un telephone, et une faute de code
   postal ou de rue envoie un colis nulle part. Deux services publics, gratuits
   et sans cle :
   - la Base Adresse Nationale (api-adresse.data.gouv.fr) pour la France et
     Monaco : chaque numero de chaque rue, tenue par l'Etat ;
   - Photon (photon.komoot.io), adosse a OpenStreetMap, pour les autres pays.
     Licence ODbL : la mention « © OpenStreetMap » est obligatoire, elle est
     affichee sous la liste.

   Le service ne fait que proposer. Une panne, une adresse inconnue ou un
   refus : la liste reste vide et la saisie a la main fonctionne comme avant. */

export interface AdresseSuggeree {
  id: string;
  /** Ligne affichee dans la liste. */
  libelle: string;
  ligne1: string;
  codePostal: string;
  ville: string;
}

/** Pays couverts par la Base Adresse Nationale. */
const PAYS_BAN = new Set(["FR", "MC"]);

/* Pays ou le numero precede la rue (« 10 Downing Street ») ; ailleurs en
   Europe il la suit (« Unter den Linden 1 »). */
const NUMERO_DEVANT = new Set(["FR", "MC", "LU", "BE", "GB", "IE", "US", "CA", "AU", "NZ"]);

const LANGUES_PHOTON = new Set(["fr", "en", "de", "it"]);

const ATTENTE_MS = 300;
const LONGUEUR_MIN = 4;

async function viaBan(q: string, signal: AbortSignal): Promise<AdresseSuggeree[]> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&autocomplete=1&limit=5`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const j = (await r.json()) as { features?: { properties: Record<string, string> }[] };
  // Une rue trouvee sans le numero : on reprend celui que le client a tape.
  const numeroTape = q.match(/d+s?(bis|ter)?/i)?.[0] ?? "";
  return (j.features ?? [])
    .map((f) => f.properties)
    .filter((p) => p.postcode && p.city && (p.type === "housenumber" || p.type === "street"))
    .map((p) => {
      const ligne1 = p.type === "street" && numeroTape ? `${numeroTape} ${p.name}` : p.name;
      return {
        id: p.id,
        libelle: `${ligne1}, ${p.postcode} ${p.city}`,
        ligne1,
        codePostal: p.postcode,
        ville: p.city,
      };
    });
}

async function viaPhoton(q: string, pays: string, langue: string, signal: AbortSignal): Promise<AdresseSuggeree[]> {
  const lang = LANGUES_PHOTON.has(langue) ? langue : "en";
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=${lang}&layer=house&layer=street`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const j = (await r.json()) as { features?: { properties: Record<string, string> }[] };
  // Le numero tape par le client, quand Photon ne renvoie que la rue.
  const numeroTape = q.match(/\b\d+[a-zA-Z]?\b/)?.[0] ?? "";
  const vus = new Set<string>();
  const sortie: AdresseSuggeree[] = [];
  for (const f of j.features ?? []) {
    const p = f.properties;
    if ((p.countrycode ?? "").toUpperCase() !== pays) continue;
    const rue = p.street ?? p.name;
    const ville = p.city ?? p.town ?? p.village ?? p.locality;
    if (!rue || !ville || !p.postcode) continue;
    const numero = p.housenumber ?? numeroTape;
    const ligne1 = numero ? (NUMERO_DEVANT.has(pays) ? `${numero} ${rue}` : `${rue} ${numero}`) : rue;
    const cle = `${ligne1}|${p.postcode}|${ville}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({ id: cle, libelle: `${ligne1}, ${p.postcode} ${ville}`, ligne1, codePostal: p.postcode, ville });
    if (sortie.length >= 5) break;
  }
  return sortie;
}

/**
 * Suggestions pour ce que le client tape, dans son pays. Vide tant que le
 * texte est trop court, pendant la frappe, ou si le service ne repond pas.
 * `actif` a false coupe tout (adresse deja choisie, champ quitte).
 */
export function useSuggestionsAdresse(texte: string, pays: string, langue: string, actif: boolean) {
  /* Les resultats sont ranges avec la recherche qui les a produits : une
     liste tapee pour la France ne doit pas rester affichee le temps que la
     recherche allemande reponde. */
  const [resultat, setResultat] = useState<{ cle: string; liste: AdresseSuggeree[] }>({ cle: "", liste: [] });
  const requete = texte.trim();
  const utile = actif && requete.length >= LONGUEUR_MIN;
  const cle = `${pays}|${requete}`;

  useEffect(() => {
    if (!utile) return;
    const controleur = new AbortController();
    const minuterie = setTimeout(async () => {
      try {
        const liste = PAYS_BAN.has(pays)
          ? await viaBan(requete, controleur.signal)
          : await viaPhoton(requete, pays, langue, controleur.signal);
        setResultat({ cle, liste });
      } catch {
        // Service injoignable ou requete annulee : pas de suggestion, rien d'autre.
        if (!controleur.signal.aborted) setResultat({ cle, liste: [] });
      }
    }, ATTENTE_MS);
    return () => {
      clearTimeout(minuterie);
      controleur.abort();
    };
  }, [utile, requete, pays, langue, cle]);

  return { suggestions: utile && resultat.cle === cle ? resultat.liste : [], source: PAYS_BAN.has(pays) ? ("ban" as const) : ("osm" as const) };
}
