"use client";

import { useSyncExternalStore } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  evenementActif,
  type CleEvenement,
} from "@/lib/evenements";
import type { OccasionKey } from "@/lib/giftOccasions";
import Icone, { type NomIcone } from "@/components/tj/Icone";
import type { Locale } from "@/i18n/config";

// Primitive stable pour React, relue à chaque rendu : ni cache de campagne
// périmé après minuit, ni campagne d'une autre occasion réutilisée.
const subscribe = () => () => {};
const getSnapshot = () => new Date().toDateString();
const getServerSnapshot = () => "";
const EVENEMENT_OCCASION: Partial<Record<OccasionKey, CleEvenement>> = {
  noel: "noel",
  "saint-valentin": "saintValentin",
  "fete-des-meres": "feteDesMeres",
};

const ICONES: Record<CleEvenement, NomIcone> = {
  noel: "sapin",
  saintValentin: "coeur",
  feteDesMeres: "cadeau",
  feteDesPeres: "cadeau",
  halloween: "fete",
  blackFriday: "eclair",
};

const formatJour = (locale: Locale, date: Date) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(date);

/**
 * `variante` :
 *  - "ligne"    : texte nu, destine a etre pose dans un conteneur qui porte
 *                 deja son cadre (le bandeau .livraison de la fiche produit) ;
 *  - "pastille" : pastille autonome (.note-cadeau) pour les autres contextes.
 */
export default function GiftDeadlineNote({
  variante = "pastille",
  occasion,
}: {
  variante?: "ligne" | "pastille";
  occasion?: OccasionKey;
}) {
  const t = useTranslations("gift");
  const tDelai = useTranslations("faq");
  const locale = useLocale() as Locale;
  const jour = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const cle = occasion ? EVENEMENT_OCCASION[occasion] : undefined;
  // Une occasion sans date connue reste générique. Hors campagne, idem.
  const evenement = jour && (!occasion || cle)
    ? evenementActif(locale, new Date(), { livraisonSeulement: true, cle })
    : null;

  const contenu = !evenement ? (
    <>
      <Icone nom="cadeau" taille={15} style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 7 }} />
      {tDelai("a1")}
    </>
  ) : (
    <>
      <Icone
        nom={ICONES[evenement.cle]}
        taille={15}
        style={{ display: "inline-block", verticalAlign: "-2px", marginRight: 7 }}
      />
      {/* `livraisonSeulement` fournit les deux dates de repère ; le texte
          précise qu'elles dépendent du paiement, des photos et de la validation. */}
      {evenement.phase === "numerique"
        ? t("deadlineNumerique", {
            event: t(`event_${evenement.cle}` as "event_noel"),
            date: formatJour(locale, evenement.commanderAvantNumerique as Date),
          })
        : t("deadlineDouble", {
            event: t(`event_${evenement.cle}` as "event_noel"),
            date: formatJour(locale, evenement.commanderAvant as Date),
            dateNumerique: formatJour(locale, evenement.commanderAvantNumerique as Date),
          })}
      {" "}{tDelai("a1")}
    </>
  );

  if (variante === "ligne") return <span>{contenu}</span>;

  return <p className="note-cadeau">{contenu}</p>;
}
