"use client";
import { enregistrerChoixMesure, rechargerSansMesure } from "@/lib/consentementMesure";
import { COOKIE_CONSENT } from "@/lib/i18n/cookieConsent";
import type { Locale } from "@/i18n/config";

export default function CookiePreferences({ locale }: { locale: string }) {
  const t = COOKIE_CONSENT[locale as Locale] ?? COOKIE_CONSENT.fr;
  return (
    <button
      type="button"
      className="bouton bouton--fantome"
      onClick={() => {
        enregistrerChoixMesure("pending");
        // Pin the withdrawal across reload even if browser Storage is full.
        rechargerSansMesure("pending");
      }}
    >
      {t.preferences}
    </button>
  );
}
