"use client";

import { useSyncExternalStore } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  evenementActif,
  DRAWING_BUSINESS_DAYS,
  TOTAL_BUSINESS_DAYS,
  type CleEvenement,
  type EvenementActif,
} from "@/lib/evenements";
import Icone, { type NomIcone } from "@/components/tj/Icone";
import type { Locale } from "@/i18n/config";

// La date limite depend du jour courant : calculee au rendu serveur, elle
// resterait figee a la date du build. On la calcule donc cote client, une seule
// fois par chargement de page (getSnapshot doit renvoyer une valeur stable).
//
// Le cache est indexe par marche : la fete des meres ne tombe pas le meme jour
// en France, au Royaume-Uni et en Allemagne.
const instantanes = new Map<string, EvenementActif | null>();

const subscribe = () => () => {};
const getSnapshot = (locale: Locale) => (): EvenementActif | null => {
  if (!instantanes.has(locale)) {
    instantanes.set(locale, evenementActif(locale, new Date(), { livraisonSeulement: true }));
  }
  return instantanes.get(locale) ?? null;
};
// Cote serveur, on rend le repere generique : toujours vrai, quelle que soit la date.
const getServerSnapshot = (): EvenementActif | null => null;

const ICONES: Record<CleEvenement, NomIcone> = {
  noel: "sapin",
  saintValentin: "coeur",
  feteDesMeres: "cadeau",
  feteDesPeres: "cadeau",
  halloween: "fete",
  blackFriday: "eclair",
};

/**
 * `variante` :
 *  - "ligne"    : texte nu, destine a etre pose dans un conteneur qui porte
 *                 deja son cadre (le bandeau .livraison de la fiche produit) ;
 *  - "pastille" : pastille autonome (.note-cadeau) pour les autres contextes.
 */
export default function GiftDeadlineNote({
  variante = "pastille",
}: {
  variante?: "ligne" | "pastille";
}) {
  const t = useTranslations("gift");
  const locale = useLocale() as Locale;
  const evenement = useSyncExternalStore(subscribe, getSnapshot(locale), getServerSnapshot);

  const contenu = !evenement ? (
    <>
      <Icone nom="cadeau" taille={15} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 7 }} />
      {t("generic", { digitalDays: DRAWING_BUSINESS_DAYS, days: TOTAL_BUSINESS_DAYS })}
    </>
  ) : (
    <>
      <Icone
        nom={ICONES[evenement.cle]}
        taille={15}
        style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 7 }}
      />
      {t("deadline", {
        event: t(`event_${evenement.cle}` as "event_noel"),
        date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(
          // `livraisonSeulement` garantit une date limite : seuls les
          // evenements livrables passent le filtre.
          evenement.commanderAvant as Date
        ),
      })}
    </>
  );

  if (variante === "ligne") return <span>{contenu}</span>;

  return <p className="note-cadeau">{contenu}</p>;
}
