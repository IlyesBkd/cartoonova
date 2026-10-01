"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  DRAWING_BUSINESS_DAYS,
  PRINT_SHIPPING_BUSINESS_DAYS,
  PRINT_SHIPPING_MIN_BUSINESS_DAYS,
  VALIDATION_BUSINESS_DAYS,
} from "@/lib/evenements";

/* Une date plutot qu'un delai. « 2 jours ouvres » oblige le visiteur a
   compter, et a deviner ce qu'est un jour ouvre ; « jeudi 8 octobre » se lit
   d'un coup d'oeil, et c'est la question qu'il se pose quand il offre.

   Rendu cote client seulement, comme BandeauLancement : la date depend du
   jour ou la page est lue, pas de celui ou elle a ete mise en cache. Un rendu
   serveur afficherait la date de la construction, et l'hydratation
   divergerait le lendemain. Cote serveur, rien.

   L'instantane est la date du jour en texte : une valeur primitive, stable
   tant que le jour ne change pas — `useSyncExternalStore` exige qu'il ne
   change pas d'un appel a l'autre. */
const subscribe = () => () => {};
const surServeur = () => "";
const dansNavigateur = () => new Date().toDateString();

/** Ajoute `jours` jours ouvres (samedi et dimanche sautes, jours feries non geres). */
function ajouterJoursOuvres(depart: Date, jours: number): Date {
  const resultat = new Date(depart.getTime());
  let restant = jours;
  while (restant > 0) {
    resultat.setDate(resultat.getDate() + 1);
    const jour = resultat.getDay();
    if (jour !== 0 && jour !== 6) restant--;
  }
  return resultat;
}

/* Une fourchette dans le meme mois ne repete pas le mois : « entre le 9 et le
   15 octobre », « between October 9 and 15 ». Le cote qui perd le mois depend
   de la langue — jour en tete (fr, de, es…) ou mois en tete (en) — et se lit
   dans les parties que renvoie Intl plutot que dans une liste de langues. */
function fourchette(debut: Date, fin: Date, locale: string): { debut: string; fin: string } {
  const format = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  const complet = { debut: format.format(debut), fin: format.format(fin) };
  if (debut.getMonth() !== fin.getMonth() || debut.getFullYear() !== fin.getFullYear()) return complet;

  const parties = format.formatToParts(debut);
  const iJour = parties.findIndex((p) => p.type === "day");
  const iMois = parties.findIndex((p) => p.type === "month");
  if (iJour < 0 || iMois < 0) return complet;

  /* Le point allemand ou danois (« 9. ») fait partie du jour ; le « de »
     espagnol ou portugais (« 9 de octubre ») appartient au mois. */
  const jourSeul = (d: Date) => {
    const p = format.formatToParts(d);
    const i = p.findIndex((x) => x.type === "day");
    const suivant = p[i + 1];
    return p[i].value + (suivant?.type === "literal" && suivant.value.trim() === "." ? "." : "");
  };

  return iJour < iMois
    ? { debut: jourSeul(debut), fin: complet.fin }
    : { debut: complet.debut, fin: jourSeul(fin) };
}

/** « Commande aujourd'hui → ton portrait le lundi 5 octobre. » */
export default function DateApercu({ physique, express }: { physique: boolean; express: boolean }) {
  const t = useTranslations("fiche");
  const locale = useLocale();
  const jour = useSyncExternalStore(subscribe, dansNavigateur, surServeur);
  if (!jour) return null;

  const maintenant = new Date();
  const formatJour = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });

  /* L'express est un engagement en heures, week-end compris (CGV, article 6) :
     on ajoute un jour calendaire, pas un jour ouvre. Pour un imprime, il ne
     porte que sur le dessin ; validation, tirage et transport suivent. */
  const dessin = express
    ? new Date(maintenant.getTime() + 24 * 60 * 60 * 1000)
    : ajouterJoursOuvres(maintenant, DRAWING_BUSINESS_DAYS);

  let texte: string;
  if (!physique) {
    texte = express
      ? t("dateExpress", { date: formatJour.format(dessin) })
      : t("dateNumerique", { date: formatJour.format(dessin) });
  } else {
    const plage = fourchette(
      ajouterJoursOuvres(dessin, VALIDATION_BUSINESS_DAYS + PRINT_SHIPPING_MIN_BUSINESS_DAYS),
      ajouterJoursOuvres(dessin, VALIDATION_BUSINESS_DAYS + PRINT_SHIPPING_BUSINESS_DAYS),
      locale
    );
    texte = t(express ? "dateImprimeExpress" : "dateImprime", {
      apercu: formatJour.format(dessin),
      debut: plage.debut,
      fin: plage.fin,
    });
  }

  return (
    <p className="date-apercu">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <span>{texte}</span>
    </p>
  );
}
