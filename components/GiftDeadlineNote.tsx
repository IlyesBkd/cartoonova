"use client";

import { useSyncExternalStore } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getActiveSeasonalEvent, TOTAL_BUSINESS_DAYS, type ActiveSeasonalEvent } from "@/lib/giftDeadline";

// La date limite depend du jour courant : calculee au rendu serveur, elle
// resterait figee a la date du build. On la calcule donc cote client, une seule
// fois par chargement de page (getSnapshot doit renvoyer une valeur stable).
let snapshot: ActiveSeasonalEvent | null | undefined;

const subscribe = () => () => {};
const getSnapshot = (): ActiveSeasonalEvent | null => {
  if (snapshot === undefined) snapshot = getActiveSeasonalEvent();
  return snapshot;
};
// Cote serveur, on rend le repere generique : toujours vrai, quelle que soit la date.
const getServerSnapshot = (): ActiveSeasonalEvent | null => null;

export default function GiftDeadlineNote({ className = "" }: { className?: string }) {
  const t = useTranslations("gift");
  const locale = useLocale();
  const event = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const base = "inline-block text-sm font-bold rounded-full border-2 border-black px-4 py-2";

  if (!event) {
    return (
      <p className={`${base} bg-white/70 text-black/70 ${className}`}>
        🎁 {t("generic", { days: TOTAL_BUSINESS_DAYS })}
      </p>
    );
  }

  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
  }).format(event.orderByDate);

  return (
    <p className={`${base} bg-[var(--cn-yellow,#facc15)] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${className}`}>
      {event.key === "christmas" ? "🎄" : "💝"}{" "}
      {t("deadline", { event: t(`event_${event.key}`), date: formattedDate })}
    </p>
  );
}
