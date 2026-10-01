"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCurrency } from "@/components/CurrencyProvider";
import { FIN_LANCEMENT, PRIX_APRES_LANCEMENT_EUR, lancementEnCours } from "@/lib/lancement";

/* Rendu cote client seulement : une page mise en cache avant le 15 novembre
   garderait sinon l'annonce apres la date, et l'hydratation divergerait le
   jour de la bascule. Cote serveur, rien. */
const subscribe = () => () => {};
const surServeur = () => false;
const dansNavigateur = () => lancementEnCours();

/** « Prix de lancement jusqu'au 15 novembre, puis 19 € le portrait. » */
export default function BandeauLancement({ className = "lancement" }: { className?: string }) {
  const t = useTranslations("tj");
  const locale = useLocale();
  const { format } = useCurrency();
  const actif = useSyncExternalStore(subscribe, dansNavigateur, surServeur);
  if (!actif) return null;

  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(FIN_LANCEMENT);
  return (
    <p className={className}>
      {t("lancement", { date, prix: format(PRIX_APRES_LANCEMENT_EUR.base) })}
    </p>
  );
}
